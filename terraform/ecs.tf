resource "aws_ecs_cluster" "main" {
  name = "${var.name_prefix}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_cloudwatch_log_group" "decider" {
  name              = "/ecs/${var.name_prefix}-decider"
  retention_in_days = 14
}

data "aws_iam_policy_document" "ecs_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name_prefix        = "${var.name_prefix}-exec-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name_prefix        = "${var.name_prefix}-task-"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume.json
}

resource "aws_lb" "decider" {
  name               = substr("${var.name_prefix}-decider", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "decider" {
  name_prefix = "gddec-"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  # instance targets: EC2+bridge (no NAT required for ECR pulls from the instance).
  target_type          = "instance"
  deregistration_delay = 30

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 5
    timeout             = 5
    interval            = 30
    matcher             = "200"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.decider.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      message_body = "Forbidden"
      status_code  = "403"
    }
  }
}

resource "aws_lb_listener_rule" "cloudfront" {
  listener_arn = aws_lb_listener.http.arn
  priority     = 1
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.decider.arn
  }
  condition {
    http_header {
      http_header_name = "X-Demo-Origin"
      values           = [random_password.origin.result]
    }
  }
}

# --- EC2 GPU capacity (g4dn) — Fargate has no GPU ---

data "aws_ssm_parameter" "ecs_gpu_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/gpu/recommended/image_id"
}

data "aws_iam_policy_document" "ec2_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_instance" {
  name_prefix        = "${var.name_prefix}-ecs-inst-"
  assume_role_policy = data.aws_iam_policy_document.ec2_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_instance" {
  role       = aws_iam_role.ecs_instance.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_instance_profile" "ecs_instance" {
  name_prefix = "${var.name_prefix}-ecs-inst-"
  role        = aws_iam_role.ecs_instance.name
}

resource "aws_security_group" "ecs_instance" {
  name_prefix = "${var.name_prefix}-ecs-inst-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Decider from ALB"
    from_port       = 8000
    to_port         = 8000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

locals {
  ecs_user_data = <<-EOF
    #!/bin/bash
    echo "ECS_CLUSTER=${aws_ecs_cluster.main.name}" >> /etc/ecs/ecs.config
    echo "ECS_ENABLE_GPU_SUPPORT=true" >> /etc/ecs/ecs.config
  EOF
}

resource "aws_launch_template" "decider_gpu" {
  name_prefix   = "${var.name_prefix}-gpu-"
  image_id      = data.aws_ssm_parameter.ecs_gpu_ami.value
  instance_type = var.decider_instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.ecs_instance.name
  }

  vpc_security_group_ids = [aws_security_group.ecs_instance.id]

  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 80
      volume_type           = "gp3"
      delete_on_termination = true
    }
  }

  user_data = base64encode(local.ecs_user_data)

  monitoring {
    enabled = false
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name = "${var.name_prefix}-decider-gpu"
    }
  }
}

resource "aws_autoscaling_group" "decider_gpu" {
  name_prefix         = "${var.name_prefix}-gpu-"
  vpc_zone_identifier = aws_subnet.public[*].id
  # Keep ASG in sync with ECS desired_count so idle demos do not bill a g4dn.
  desired_capacity = var.decider_desired_count
  min_size         = 0
  max_size         = 1

  launch_template {
    id      = aws_launch_template.decider_gpu.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "${var.name_prefix}-decider-gpu"
    propagate_at_launch = true
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_ecs_task_definition" "decider" {
  family                   = "${var.name_prefix}-decider"
  requires_compatibilities = ["EC2"]
  # bridge + hostPort: instance has public IP (no NAT) and can pull from ECR/HF.
  network_mode       = "bridge"
  execution_role_arn = aws_iam_role.ecs_execution.arn
  task_role_arn      = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "decider"
      image     = var.decider_desired_count > 0 ? "${aws_ecr_repository.decider.repository_url}@${data.aws_ecr_image.decider[0].image_digest}" : "${aws_ecr_repository.decider.repository_url}:${var.decider_image_tag}"
      essential = true
      cpu       = var.decider_cpu
      memory    = var.decider_memory
      resourceRequirements = [
        { type = "GPU", value = "1" }
      ]
      portMappings = [{
        containerPort = 8000
        hostPort      = 8000
        protocol      = "tcp"
      }]
      environment = [
        { name = "DECIDER_MODEL", value = "StrandsAgents/strands-decider-2B-hobson-v19" },
        { name = "PORT", value = "8000" }
        # NVIDIA_VISIBLE_DEVICES is reserved — ECS GPU workflow sets it.
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.decider.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "decider"
        }
      }
      healthCheck = {
        command     = ["CMD-SHELL", "curl -fsS http://127.0.0.1:8000/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 300
      }
    }
  ])
}

resource "aws_ecs_service" "decider" {
  name                  = "${var.name_prefix}-decider"
  cluster               = aws_ecs_cluster.main.id
  task_definition       = aws_ecs_task_definition.decider.arn
  desired_count         = var.decider_desired_count
  launch_type           = "EC2"
  wait_for_steady_state = true
  force_delete          = true
  # One GPU and a fixed host port: stop the old task before starting its replacement.
  deployment_minimum_healthy_percent = 0
  deployment_maximum_percent         = 100
  health_check_grace_period_seconds  = 300
  availability_zone_rebalancing      = "DISABLED"

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  placement_constraints {
    type       = "memberOf"
    expression = "attribute:ecs.instance-type == ${var.decider_instance_type}"
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.decider.arn
    container_name   = "decider"
    container_port   = 8000
  }

  depends_on = [aws_lb_listener_rule.cloudfront, aws_autoscaling_group.decider_gpu]
}

# CodeBuild builds deploy/decider/Dockerfile.gpu in AWS (avoids multi-GB local Docker).
# Trigger: make build-image → zip context → S3 → start-build.

resource "aws_s3_bucket" "codebuild_source" {
  bucket_prefix = "${var.name_prefix}-cb-src-"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "codebuild_source" {
  bucket                  = aws_s3_bucket.codebuild_source.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_cloudwatch_log_group" "codebuild" {
  name              = "/aws/codebuild/${var.name_prefix}-decider-image"
  retention_in_days = 14
}

data "aws_iam_policy_document" "codebuild_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["codebuild.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "codebuild" {
  name_prefix        = "${var.name_prefix}-cb-"
  assume_role_policy = data.aws_iam_policy_document.codebuild_assume.json
}

data "aws_iam_policy_document" "codebuild" {
  statement {
    sid = "Logs"
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
    ]
    resources = [
      aws_cloudwatch_log_group.codebuild.arn,
      "${aws_cloudwatch_log_group.codebuild.arn}:*",
    ]
  }

  statement {
    sid = "SourceBucket"
    actions = [
      "s3:GetObject",
      "s3:GetObjectVersion",
    ]
    resources = ["${aws_s3_bucket.codebuild_source.arn}/*"]
  }

  statement {
    sid       = "SourceBucketList"
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.codebuild_source.arn]
  }

  statement {
    sid = "ECRAuth"
    actions = [
      "ecr:GetAuthorizationToken",
    ]
    resources = ["*"]
  }

  statement {
    sid = "ECRPush"
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:PutImage",
      "ecr:InitiateLayerUpload",
      "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload",
    ]
    resources = [aws_ecr_repository.decider.arn]
  }
}

resource "aws_iam_role_policy" "codebuild" {
  name_prefix = "${var.name_prefix}-cb-"
  role        = aws_iam_role.codebuild.id
  policy      = data.aws_iam_policy_document.codebuild.json
}

resource "aws_codebuild_project" "decider_image" {
  name          = "${var.name_prefix}-decider-image"
  description   = "Build CUDA Decider image and push to ECR"
  service_role  = aws_iam_role.codebuild.arn
  build_timeout = 60

  artifacts {
    type = "NO_ARTIFACTS"
  }

  environment {
    compute_type                = "BUILD_GENERAL1_LARGE"
    image                       = "aws/codebuild/amazonlinux2-x86_64-standard:5.0"
    type                        = "LINUX_CONTAINER"
    privileged_mode             = true
    image_pull_credentials_type = "CODEBUILD"

    environment_variable {
      name  = "AWS_DEFAULT_REGION"
      value = var.aws_region
    }
    environment_variable {
      name  = "AWS_ACCOUNT_ID"
      value = data.aws_caller_identity.current.account_id
    }
    environment_variable {
      name  = "ECR_REPOSITORY_URI"
      value = aws_ecr_repository.decider.repository_url
    }
    environment_variable {
      name  = "IMAGE_TAG"
      value = var.decider_image_tag
    }
  }

  source {
    type      = "S3"
    location  = "${aws_s3_bucket.codebuild_source.bucket}/decider-src.zip"
    buildspec = "buildspec.yml"
  }

  logs_config {
    cloudwatch_logs {
      group_name = aws_cloudwatch_log_group.codebuild.name
      status     = "ENABLED"
    }
  }
}

data "aws_caller_identity" "current" {}

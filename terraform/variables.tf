variable "aws_region" {
  type        = string
  description = "AWS region for all resources"
  default     = "us-east-1"
}

variable "environment" {
  type        = string
  description = "Environment name (e.g. demo)"
  default     = "demo"
}

variable "name_prefix" {
  type        = string
  description = "Prefix for resource names (no account IDs)"
  default     = "grid-dodger"
}

variable "bedrock_model_id" {
  type        = string
  description = "Bedrock model id for game-over recap"
  default     = "amazon.nova-lite-v1:0"
}

variable "decider_cpu" {
  type        = number
  description = "Task CPU units on the GPU instance (1024 = 1 vCPU). Leave headroom for ECS agent."
  default     = 2048
}

variable "decider_memory" {
  type        = number
  description = "Task memory (MiB) on the GPU instance"
  default     = 8192
}

variable "decider_instance_type" {
  type        = string
  description = "EC2 GPU instance type for Decider (T4)"
  default     = "g4dn.xlarge"
}

variable "decider_desired_count" {
  type        = number
  description = "ECS + ASG desired count (0 = stopped / save money). Apply with 0 before first image build."
  default     = 0
  validation {
    condition     = contains([0, 1], var.decider_desired_count)
    error_message = "The single-GPU demo supports desired_count 0 or 1."
  }
}

variable "budget_limit_usd" {
  type        = number
  description = "Monthly AWS budget alarm threshold (USD)"
  default     = 40
}

variable "budget_email" {
  type        = string
  description = "Email for budget notifications (optional empty to skip)"
  default     = ""
}

variable "decider_ecr_repository_name" {
  type        = string
  description = "ECR repository name (created by Terraform)"
  default     = "grid-dodger-decider"
}

variable "decider_image_tag" {
  type        = string
  description = "ECR image tag produced by make build-image"
  default     = "latest"
}

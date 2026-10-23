output "cloudfront_url" {
  description = "HTTPS URL for the game UI"
  value       = "https://${aws_cloudfront_distribution.ui.domain_name}/game/index.html"
}

output "cloudfront_distribution_id" {
  description = "CloudFront distribution id (for invalidations after UI sync)"
  value       = aws_cloudfront_distribution.ui.id
}

output "decider_alb_dns" {
  description = "ALB DNS (Decider). Prefer CloudFront /decider path from the browser."
  value       = aws_lb.decider.dns_name
}

output "ecr_decider_url" {
  description = "ECR repository URL for the Decider image"
  value       = aws_ecr_repository.decider.repository_url
}

output "codebuild_project" {
  description = "CodeBuild project name for make build-image"
  value       = aws_codebuild_project.decider_image.name
}

output "codebuild_source_bucket" {
  description = "S3 bucket for CodeBuild source zip"
  value       = aws_s3_bucket.codebuild_source.bucket
}

output "recap_api_endpoint" {
  description = "API Gateway endpoint (also fronted at CloudFront /api/recap)"
  value       = aws_apigatewayv2_api.recap.api_endpoint
}

output "ui_bucket" {
  description = "S3 bucket for static game assets"
  value       = aws_s3_bucket.ui.bucket
}

output "ecs_cluster" {
  value = aws_ecs_cluster.main.name
}

output "ecs_service" {
  value = aws_ecs_service.decider.name
}

output "destroy_hint" {
  value = "make infra-destroy  # scales down g4dn; ECR is force-deleted with the stack"
}

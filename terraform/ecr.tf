resource "aws_ecr_repository" "decider" {
  name                 = var.decider_ecr_repository_name
  image_tag_mutability = "MUTABLE"
  force_delete         = true

  image_scanning_configuration {
    scan_on_push = true
  }
}

data "aws_ecr_image" "decider" {
  count           = var.decider_desired_count > 0 ? 1 : 0
  repository_name = aws_ecr_repository.decider.name
  image_tag       = var.decider_image_tag
}

resource "aws_ecr_lifecycle_policy" "decider" {
  repository = aws_ecr_repository.decider.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 5 images"
      selection = {
        tagStatus   = "any"
        countType   = "imageCountMoreThan"
        countNumber = 5
      }
      action = { type = "expire" }
    }]
  })
}

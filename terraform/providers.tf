provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "grid-dodger"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "aws" {
  alias  = "edge"
  region = "us-east-1"
  default_tags {
    tags = {
      Project     = "grid-dodger"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# CloudFront overwrites this header; browsers never receive the secret.
resource "random_password" "origin" {
  length  = 48
  special = false
}

resource "aws_wafv2_web_acl" "demo" {
  provider = aws.edge
  name     = "${var.name_prefix}-demo-limits"
  scope    = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Count dynamic requests per viewer IP, rather than CloudFront's origin IP.
  rule {
    name     = "limit-dynamic-requests"
    priority = 1
    action {
      block {}
    }
    statement {
      rate_based_statement {
        limit                 = 1000
        aggregate_key_type    = "IP"
        evaluation_window_sec = 300
        scope_down_statement {
          or_statement {
            statement {
              byte_match_statement {
                positional_constraint = "STARTS_WITH"
                search_string         = "/decider/"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
            statement {
              byte_match_statement {
                positional_constraint = "STARTS_WITH"
                search_string         = "/api/"
                field_to_match {
                  uri_path {}
                }
                text_transformation {
                  priority = 0
                  type     = "NONE"
                }
              }
            }
          }
        }
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "demo-rate-limit"
      sampled_requests_enabled   = false
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "demo-access"
    sampled_requests_enabled   = false
  }
}

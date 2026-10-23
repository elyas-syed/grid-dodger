data "archive_file" "recap" {
  type        = "zip"
  source_file = "${path.module}/../deploy/recap/handler.py"
  output_path = "${path.module}/.build/recap.zip"
}

data "aws_iam_policy_document" "lambda_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "recap_lambda" {
  name_prefix        = "${var.name_prefix}-recap-"
  assume_role_policy = data.aws_iam_policy_document.lambda_assume.json
}

resource "aws_iam_role_policy_attachment" "recap_basic" {
  role       = aws_iam_role.recap_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

data "aws_iam_policy_document" "recap_bedrock" {
  statement {
    sid     = "BedrockConverse"
    actions = ["bedrock:InvokeModel"]
    # Converse API authorizes via InvokeModel on the foundation model.
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "recap_bedrock" {
  name_prefix = "bedrock-"
  role        = aws_iam_role.recap_lambda.id
  policy      = data.aws_iam_policy_document.recap_bedrock.json
}

resource "aws_cloudwatch_log_group" "recap" {
  name              = "/aws/lambda/${var.name_prefix}-recap"
  retention_in_days = 14
}

resource "aws_lambda_function" "recap" {
  function_name    = "${var.name_prefix}-recap"
  role             = aws_iam_role.recap_lambda.arn
  handler          = "handler.handler"
  runtime          = "python3.12"
  filename         = data.archive_file.recap.output_path
  source_code_hash = data.archive_file.recap.output_base64sha256
  timeout          = 30
  memory_size      = 256
  depends_on       = [aws_cloudwatch_log_group.recap]

  environment {
    variables = {
      BEDROCK_MODEL_ID    = var.bedrock_model_id
      ORIGIN_VERIFY_TOKEN = random_password.origin.result
    }
  }
}

resource "aws_apigatewayv2_api" "recap" {
  name          = "${var.name_prefix}-recap"
  protocol_type = "HTTP"

  cors_configuration {
    allow_headers = ["content-type"]
    allow_methods = ["POST", "OPTIONS"]
    allow_origins = ["*"]
    max_age       = 3600
  }
}

resource "aws_apigatewayv2_integration" "recap" {
  api_id                 = aws_apigatewayv2_api.recap.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.recap.invoke_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "recap" {
  api_id    = aws_apigatewayv2_api.recap.id
  route_key = "POST /api/recap"
  target    = "integrations/${aws_apigatewayv2_integration.recap.id}"
}

resource "aws_apigatewayv2_route" "recap_options" {
  api_id    = aws_apigatewayv2_api.recap.id
  route_key = "OPTIONS /api/recap"
  target    = "integrations/${aws_apigatewayv2_integration.recap.id}"
}

resource "aws_apigatewayv2_stage" "recap" {
  api_id      = aws_apigatewayv2_api.recap.id
  name        = "$default"
  auto_deploy = true
  default_route_settings {
    throttling_burst_limit = 5
    throttling_rate_limit  = 2
  }
}

resource "aws_lambda_permission" "recap_apigw" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.recap.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.recap.execution_arn}/*/*"
}

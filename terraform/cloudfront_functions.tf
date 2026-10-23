resource "aws_cloudfront_function" "strip_decider_prefix" {
  name    = "${var.name_prefix}-strip-decider"
  runtime = "cloudfront-js-2.0"
  comment = "Rewrite /decider/* -> /* for ALB origin"
  publish = true

  code = <<-EOF
    function handler(event) {
      var request = event.request;
      if (request.uri.indexOf('/decider') === 0) {
        request.uri = request.uri.replace(/^\/decider/, '') || '/';
      }
      return request;
    }
  EOF
}

resource "aws_cloudfront_function" "game_index" {
  name    = "${var.name_prefix}-game-index"
  runtime = "cloudfront-js-2.0"
  comment = "Resolve the game directory to its S3 index object"
  publish = true
  code    = <<-EOF
    function handler(event) {
      var request = event.request;
      if (request.uri === '/' || request.uri === '/game') {
        return { statusCode: 302, headers: { location: { value: '/game/index.html' } } };
      }
      if (request.uri === '/game/') {
        request.uri = '/game/index.html';
      }
      return request;
    }
  EOF
}

# EventBridge Rule triggering once every day at 00:00 UTC
resource "aws_cloudwatch_event_rule" "daily_expiry_check" {
  name                = "${var.project_name}-daily-expiry-check"
  description         = "Triggers daily document expiration check and dispatches alerts via SNS"
  schedule_expression = "cron(0 0 * * ? *)"
}

resource "aws_cloudwatch_event_target" "trigger_lambda" {
  rule      = aws_cloudwatch_event_rule.daily_expiry_check.name
  target_id = "TargetExpiryLambda"
  arn       = aws_lambda_function.expiry_checker.arn
}

resource "aws_lambda_permission" "allow_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.expiry_checker.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.daily_expiry_check.arn
}

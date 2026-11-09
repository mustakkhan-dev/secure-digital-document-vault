output "region" {
  description = "AWS Deployment Region"
  value       = var.aws_region
}

output "cognito_user_pool_id" {
  description = "Amazon Cognito User Pool ID"
  value       = aws_cognito_user_pool.pool.id
}

output "cognito_client_id" {
  description = "Amazon Cognito App Client ID"
  value       = aws_cognito_user_pool_client.client.id
}

output "api_gateway_endpoint" {
  description = "Amazon API Gateway HTTP Production Endpoint URL"
  value       = aws_apigatewayv2_stage.prod.invoke_url
}

output "s3_bucket_name" {
  description = "Private S3 Document Storage Bucket Name"
  value       = aws_s3_bucket.vault_storage.id
}

output "sns_topic_arn" {
  description = "SNS Alert Topic ARN"
  value       = aws_sns_topic.alerts.arn
}

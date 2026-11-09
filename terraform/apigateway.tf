# HTTP API Gateway (v2)
resource "aws_apigatewayv2_api" "http_api" {
  name          = "${var.project_name}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "prod"
  auto_deploy = true
}

# Cognito JWT Authorizer
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.http_api.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"

  jwt_configuration {
    audience = [aws_cognito_user_pool_client.client.id]
    issuer   = "https://cognito-idp.${var.aws_region}.amazonaws.com/${aws_cognito_user_pool.pool.id}"
  }
}

# Helper Macro for API Gateway Lambda Integrations
# 1. Upload URL Route
resource "aws_apigatewayv2_integration" "upload_url" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_upload_url.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "upload_url" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /documents/upload-url"
  target             = "integrations/${aws_apigatewayv2_integration.upload_url.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "upload_url" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_upload_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 2. List Documents Route
resource "aws_apigatewayv2_integration" "list_docs" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.list_documents.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "list_docs" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /documents"
  target             = "integrations/${aws_apigatewayv2_integration.list_docs.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "list_docs" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.list_documents.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 3. Download URL Route
resource "aws_apigatewayv2_integration" "download_url" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_download_url.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "download_url" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /documents/{docId}/download"
  target             = "integrations/${aws_apigatewayv2_integration.download_url.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "download_url" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_download_url.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 4. Delete Document Route
resource "aws_apigatewayv2_integration" "delete_doc" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.delete_document.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "delete_doc" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "DELETE /documents/{docId}"
  target             = "integrations/${aws_apigatewayv2_integration.delete_doc.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "delete_doc" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.delete_document.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 5. Create Share Link Route
resource "aws_apigatewayv2_integration" "create_share" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.create_share_link.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "create_share" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /shares"
  target             = "integrations/${aws_apigatewayv2_integration.create_share.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "create_share" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.create_share_link.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 6. Access Shared Doc Route (PUBLIC - NO JWT REQUIRED)
resource "aws_apigatewayv2_integration" "access_share" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.access_shared_doc.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "access_share" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /shares/{shareId}"
  target             = "integrations/${aws_apigatewayv2_integration.access_share.id}"
  authorization_type = "NONE" # Public recipient route
}
resource "aws_lambda_permission" "access_share" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.access_shared_doc.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 7. Revoke Share Link Route
resource "aws_apigatewayv2_integration" "revoke_share" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.revoke_share_link.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "revoke_share" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "POST /shares/{shareId}/revoke"
  target             = "integrations/${aws_apigatewayv2_integration.revoke_share.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "revoke_share" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.revoke_share_link.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

# 8. Activity Logs Route
resource "aws_apigatewayv2_integration" "activity_logs" {
  api_id                 = aws_apigatewayv2_api.http_api.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.get_activity_logs.invoke_arn
  payload_format_version = "2.0"
}
resource "aws_apigatewayv2_route" "activity_logs" {
  api_id             = aws_apigatewayv2_api.http_api.id
  route_key          = "GET /activity"
  target             = "integrations/${aws_apigatewayv2_integration.activity_logs.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}
resource "aws_lambda_permission" "activity_logs" {
  statement_id  = "AllowAPIGW"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.get_activity_logs.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

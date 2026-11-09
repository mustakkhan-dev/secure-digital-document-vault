# Package backend source code
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../backend"
  output_path = "${path.module}/backend_bundle.zip"
  excludes    = ["node_modules", "tests"]
}

# IAM Role for Lambda Functions
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-exec-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# Least-Privilege IAM Policy for Lambda
resource "aws_iam_role_policy" "lambda_policy" {
  name = "${var.project_name}-lambda-policy"
  role = aws_iam_role.lambda_exec.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # CloudWatch Logs
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      },
      # S3 Document Operations
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.vault_storage.arn}/*"
      },
      # DynamoDB Operations
      {
        Effect = "Allow"
        Action = [
          "dynamodb:PutItem",
          "dynamodb:GetItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query",
          "dynamodb:Scan"
        ]
        Resource = [
          aws_dynamodb_table.documents.arn,
          aws_dynamodb_table.shares.arn,
          aws_dynamodb_table.activity.arn
        ]
      },
      # SNS Publish
      {
        Effect = "Allow"
        Action = [
          "sns:Publish"
        ]
        Resource = aws_sns_topic.alerts.arn
      }
    ]
  })
}

# Shared Environment Variables
locals {
  lambda_env = {
    DOCUMENTS_BUCKET_NAME = aws_s3_bucket.vault_storage.id
    DOCUMENTS_TABLE_NAME  = aws_dynamodb_table.documents.name
    SHARES_TABLE_NAME     = aws_dynamodb_table.shares.name
    ACTIVITY_TABLE_NAME   = aws_dynamodb_table.activity.name
    NOTIFICATION_TOPIC_ARN= aws_sns_topic.alerts.arn
  }
}

# 1. getUploadUrl Lambda
resource "aws_lambda_function" "get_upload_url" {
  function_name    = "${var.project_name}-getUploadUrl"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/documents/getUploadUrl.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 2. listDocuments Lambda
resource "aws_lambda_function" "list_documents" {
  function_name    = "${var.project_name}-listDocuments"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/documents/listDocuments.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 3. getDownloadUrl Lambda
resource "aws_lambda_function" "get_download_url" {
  function_name    = "${var.project_name}-getDownloadUrl"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/documents/getDownloadUrl.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 4. deleteDocument Lambda
resource "aws_lambda_function" "delete_document" {
  function_name    = "${var.project_name}-deleteDocument"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/documents/deleteDocument.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 5. createShareLink Lambda
resource "aws_lambda_function" "create_share_link" {
  function_name    = "${var.project_name}-createShareLink"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/sharing/createShareLink.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 6. accessSharedDoc Lambda (Public)
resource "aws_lambda_function" "access_shared_doc" {
  function_name    = "${var.project_name}-accessSharedDoc"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/sharing/accessSharedDoc.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 7. revokeShareLink Lambda
resource "aws_lambda_function" "revoke_share_link" {
  function_name    = "${var.project_name}-revokeShareLink"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/sharing/revokeShareLink.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 8. getActivityLogs Lambda
resource "aws_lambda_function" "get_activity_logs" {
  function_name    = "${var.project_name}-getActivityLogs"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/documents/getActivityLogs.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 15

  environment {
    variables = local.lambda_env
  }
}

# 9. expiryChecker Lambda (Cron triggered)
resource "aws_lambda_function" "expiry_checker" {
  function_name    = "${var.project_name}-expiryChecker"
  runtime          = "nodejs20.x"
  role             = aws_iam_role.lambda_exec.arn
  handler          = "src/notifications/expiryChecker.handler"
  filename         = data.archive_file.lambda_zip.output_path
  source_code_hash = data.archive_file.lambda_zip.output_base64sha256
  timeout          = 30

  environment {
    variables = local.lambda_env
  }
}

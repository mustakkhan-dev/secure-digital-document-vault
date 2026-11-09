# Table 1: Vault_Documents
resource "aws_dynamodb_table" "documents" {
  name         = "Vault_Documents"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "docId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "docId"
    type = "S"
  }

  point_in_time_recovery {
    enabled = false
  }
}

# Table 2: Vault_Shares (with DynamoDB TTL on expiresAt)
resource "aws_dynamodb_table" "shares" {
  name         = "Vault_Shares"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "shareId"

  attribute {
    name = "shareId"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# Table 3: Vault_ActivityLogs
resource "aws_dynamodb_table" "activity" {
  name         = "Vault_ActivityLogs"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"
  range_key    = "timestamp"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "timestamp"
    type = "S"
  }
}

resource "aws_s3_bucket" "vault_storage" {
  bucket        = "${var.project_name}-storage-${random_string.suffix.result}"
  force_destroy = true # Convenient for student teardown
}

# Strict Block Public Access enforcement
resource "aws_s3_bucket_public_access_block" "block_public" {
  bucket = aws_s3_bucket.vault_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption with AWS managed key (AES256)
resource "aws_s3_bucket_server_side_encryption_configuration" "sse" {
  bucket = aws_s3_bucket.vault_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Enable S3 Versioning for accidental deletion protection
resource "aws_s3_bucket_versioning" "versioning" {
  bucket = aws_s3_bucket.vault_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# S3 CORS Configuration to allow direct browser uploads via Presigned PUT
resource "aws_s3_bucket_cors_configuration" "cors" {
  bucket = aws_s3_bucket.vault_storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_origins = ["*"] # In strict production, restrict to your frontend domain
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

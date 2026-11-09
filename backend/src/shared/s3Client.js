import { S3Client } from '@aws-sdk/client-s3';

// AWS SDK v3 client initialization
// Uses AWS_REGION environment variable or defaults to ap-south-1 (Mumbai) / us-east-1
export const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
});

export const BUCKET_NAME = process.env.DOCUMENTS_BUCKET_NAME || 'secure-doc-vault-storage';

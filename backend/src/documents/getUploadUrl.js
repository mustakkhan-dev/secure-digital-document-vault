import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
import { s3Client, BUCKET_NAME } from '../shared/s3Client.js';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 Megabytes

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
    'Content-Type': 'application/json',
  };

  try {
    // Extract authenticated user ID from Cognito Authorizer context
    const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub || claims?.username;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized: Missing or invalid token identity' }),
      };
    }

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { fileName, fileType, fileSize, category, description, expiryDate } = body;

    // Server-side validation
    if (!fileName || !fileType) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'fileName and fileType are required' }),
      };
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: `File type '${fileType}' is not permitted. Only PDF, JPG, PNG, DOCX, and TXT are accepted.` }),
      };
    }

    if (fileSize && Number(fileSize) > MAX_FILE_SIZE_BYTES) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'File size exceeds maximum permitted limit of 10MB.' }),
      };
    }

    // Sanitize filename to prevent directory traversal and special character injection
    const baseName = fileName.replace(/^.*[\\\/]/, '');
    const safeFileName = baseName.replace(/\.\.+/g, '.').replace(/[^a-zA-Z0-9._-]/g, '_');
    const docId = `DOC#${randomUUID()}`;
    const s3Key = `vault/${userId}/${docId}/${safeFileName}`;

    // Generate S3 Pre-signed PUT URL with 10-minute expiry
    const putCommand = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
      Metadata: {
        owner: userId,
        docId: docId,
      },
    });

    const uploadUrl = await getSignedUrl(s3Client, putCommand, { expiresIn: 600 });

    const now = new Date().toISOString();
    const docItem = {
      userId,
      docId,
      fileName: safeFileName,
      fileType,
      fileSize: Number(fileSize) || 0,
      s3Key,
      category: category || 'Other',
      description: description || '',
      uploadedAt: now,
      expiryDate: expiryDate || null,
      status: 'ACTIVE',
      reminded: false,
    };

    // Store document metadata in DynamoDB
    await docClient.send(
      new PutCommand({
        TableName: TABLES.DOCUMENTS,
        Item: docItem,
      })
    );

    // Record audit event
    await logSecurityEvent({
      userId,
      eventType: 'UPLOAD_INITIATED',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { docId, fileName: safeFileName, fileType, fileSize },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Pre-signed upload URL generated successfully.',
        uploadUrl,
        document: docItem,
      }),
    };
  } catch (error) {
    console.error('[GET_UPLOAD_URL_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error while preparing upload.' }),
    };
  }
};

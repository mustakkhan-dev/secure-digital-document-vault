import { DeleteObjectCommand } from '@aws-sdk/client-s3';
import { GetCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { s3Client, BUCKET_NAME } from '../shared/s3Client.js';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,DELETE',
    'Content-Type': 'application/json',
  };

  try {
    const claims = event.requestContext?.authorizer?.claims || event.requestContext?.authorizer?.jwt?.claims;
    const userId = claims?.sub || claims?.username;

    if (!userId) {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ error: 'Unauthorized' }),
      };
    }

    const docId = event.pathParameters?.docId;
    if (!docId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'docId path parameter is required' }),
      };
    }

    // Ownership check: Fetch document metadata using Composite Key
    const ddbResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.DOCUMENTS,
        Key: {
          userId,
          docId,
        },
      })
    );

    const doc = ddbResult.Item;
    if (!doc) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Document not found or access denied.' }),
      };
    }

    // 1. Delete actual binary file from S3
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: doc.s3Key,
      })
    );

    // 2. Delete metadata item from DynamoDB
    await docClient.send(
      new DeleteCommand({
        TableName: TABLES.DOCUMENTS,
        Key: {
          userId,
          docId,
        },
      })
    );

    // 3. Log audit event
    await logSecurityEvent({
      userId,
      eventType: 'DOC_DELETED',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { docId, fileName: doc.fileName },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Document permanently deleted from storage and catalog.',
        docId,
      }),
    };
  } catch (error) {
    console.error('[DELETE_DOC_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to delete document.' }),
    };
  }
};

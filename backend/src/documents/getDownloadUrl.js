import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { s3Client, BUCKET_NAME } from '../shared/s3Client.js';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
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

    // Server-Side Authorization: Fetch item by owner Partition Key
    const ddbResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.DOCUMENTS,
        Key: {
          userId: userId,
          docId: docId,
        },
      })
    );

    const doc = ddbResult.Item;
    if (!doc || doc.status !== 'ACTIVE') {
      // Record suspicious / unauthorized attempt if user tried to query a non-existent or other's doc
      await logSecurityEvent({
        userId,
        eventType: 'UNAUTHORIZED_ACCESS_ATTEMPT',
        status: 'FAILED',
        ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
        userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
        details: { requestedDocId: docId, reason: 'Document not found or ownership mismatch' },
      });

      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Document not found or you lack permission to access it.' }),
      };
    }

    // Generate short-lived (5 min = 300s) download pre-signed URL
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: doc.s3Key,
      ResponseContentDisposition: `attachment; filename="${doc.fileName}"`,
    });

    const downloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 300 });

    // Record legitimate download
    await logSecurityEvent({
      userId,
      eventType: 'DOWNLOAD',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { docId: doc.docId, fileName: doc.fileName },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileName: doc.fileName,
        fileType: doc.fileType,
        downloadUrl,
        expiresInSeconds: 300,
      }),
    };
  } catch (error) {
    console.error('[GET_DOWNLOAD_URL_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate download URL' }),
    };
  }
};

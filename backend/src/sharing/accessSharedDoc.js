import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { s3Client, BUCKET_NAME } from '../shared/s3Client.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'OPTIONS,GET',
    'Content-Type': 'application/json',
  };

  try {
    const shareId = event.pathParameters?.shareId;
    if (!shareId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing shareId parameter' }),
      };
    }

    // Retrieve share metadata
    const result = await docClient.send(
      new GetCommand({
        TableName: TABLES.SHARES,
        Key: { shareId },
      })
    );

    const share = result.Item;
    const nowSeconds = Math.floor(Date.now() / 1000);

    if (!share) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Share link not found or has been removed.' }),
      };
    }

    // Check if link was manually revoked
    if (share.isRevoked) {
      await logSecurityEvent({
        userId: share.ownerId,
        eventType: 'REVOKED_LINK_ACCESS_ATTEMPT',
        status: 'FAILED',
        ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
        userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
        details: { shareId, docId: share.docId },
      });

      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          error: 'This sharing link was revoked by the document owner and is no longer accessible.',
          revoked: true,
        }),
      };
    }

    // Check if time has expired
    if (nowSeconds >= share.expiresAt) {
      await logSecurityEvent({
        userId: share.ownerId,
        eventType: 'EXPIRED_LINK_ACCESS_ATTEMPT',
        status: 'FAILED',
        ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
        userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
        details: { shareId, docId: share.docId, expiredAt: share.expiresAt },
      });

      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          error: 'This sharing link has expired.',
          expired: true,
        }),
      };
    }

    // Check optional max view count
    if (share.maxAccessCount > 0 && share.accessCount >= share.maxAccessCount) {
      return {
        statusCode: 410,
        headers,
        body: JSON.stringify({
          error: 'This sharing link has exceeded its maximum permitted view count.',
        }),
      };
    }

    // Atomically increment access count
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SHARES,
        Key: { shareId },
        UpdateExpression: 'SET accessCount = if_not_exists(accessCount, :zero) + :inc',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
        },
      })
    );

    // Issue short-lived 2-minute S3 download URL
    const getCommand = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: share.s3Key,
      ResponseContentDisposition: `inline; filename="${share.fileName}"`,
    });

    const tempDownloadUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 120 });

    // Log successful shared view
    await logSecurityEvent({
      userId: share.ownerId,
      eventType: 'SHARED_DOC_ACCESSED',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { shareId, docId: share.docId, fileName: share.fileName },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        fileName: share.fileName,
        fileType: share.fileType,
        downloadUrl: tempDownloadUrl,
        expiresAt: new Date(share.expiresAt * 1000).toISOString(),
        validForSeconds: 120,
      }),
    };
  } catch (error) {
    console.error('[ACCESS_SHARED_DOC_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal error resolving share token' }),
    };
  }
};

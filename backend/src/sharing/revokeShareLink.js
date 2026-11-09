import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

export const handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST',
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

    const shareId = event.pathParameters?.shareId;
    if (!shareId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'shareId path parameter is required' }),
      };
    }

    // Verify share exists and belongs to this user
    const shareRes = await docClient.send(
      new GetCommand({
        TableName: TABLES.SHARES,
        Key: { shareId },
      })
    );

    const share = shareRes.Item;
    if (!share || share.ownerId !== userId) {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Share link not found or you are not authorized to revoke it.' }),
      };
    }

    // Mark as revoked in DynamoDB
    await docClient.send(
      new UpdateCommand({
        TableName: TABLES.SHARES,
        Key: { shareId },
        UpdateExpression: 'SET isRevoked = :revoked',
        ExpressionAttributeValues: {
          ':revoked': true,
        },
      })
    );

    // Audit log
    await logSecurityEvent({
      userId,
      eventType: 'SHARE_REVOKED',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { shareId, docId: share.docId },
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        message: 'Share link has been revoked immediately. Any future attempts will be rejected.',
        shareId,
      }),
    };
  } catch (error) {
    console.error('[REVOKE_SHARE_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to revoke share link.' }),
    };
  }
};

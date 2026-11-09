import { GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';
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

    const body = typeof event.body === 'string' ? JSON.parse(event.body || '{}') : (event.body || {});
    const { docId, expiryMinutes = 60, maxAccessCount = 0 } = body;

    if (!docId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'docId is required' }),
      };
    }

    // Verify caller owns this document
    const docResult = await docClient.send(
      new GetCommand({
        TableName: TABLES.DOCUMENTS,
        Key: {
          userId,
          docId,
        },
      })
    );

    const doc = docResult.Item;
    if (!doc || doc.status !== 'ACTIVE') {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Document not found or access denied.' }),
      };
    }

    // Calculate expiration timestamp (in seconds for DynamoDB TTL)
    const nowSeconds = Math.floor(Date.now() / 1000);
    const ttlSeconds = Math.min(Math.max(Number(expiryMinutes), 5), 1440) * 60; // 5 min to 24 hrs
    const expiresAt = nowSeconds + ttlSeconds;

    const shareId = randomUUID();

    const shareRecord = {
      shareId,
      docId,
      ownerId: userId,
      fileName: doc.fileName,
      fileType: doc.fileType,
      s3Key: doc.s3Key,
      createdAt: nowSeconds,
      expiresAt: expiresAt,
      isRevoked: false,
      accessCount: 0,
      maxAccessCount: Number(maxAccessCount) || 0,
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.SHARES,
        Item: shareRecord,
      })
    );

    // Audit log
    await logSecurityEvent({
      userId,
      eventType: 'SHARE_LINK_CREATED',
      status: 'SUCCESS',
      ipAddress: event.requestContext?.identity?.sourceIp || 'UNKNOWN',
      userAgent: event.requestContext?.identity?.userAgent || 'UNKNOWN',
      details: { docId, shareId, expiryMinutes, expiresAt },
    });

    return {
      statusCode: 201,
      headers,
      body: JSON.stringify({
        message: 'Secure share token generated.',
        shareId,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        expiresInMinutes: ttlSeconds / 60,
      }),
    };
  } catch (error) {
    console.error('[CREATE_SHARE_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to create share link' }),
    };
  }
};

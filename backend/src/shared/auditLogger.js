import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from './ddbClient.js';
import { randomUUID } from 'crypto';

/**
 * Logs a security or operational event to the DynamoDB activity table.
 * @param {Object} params
 * @param {string} params.userId - Owner ID
 * @param {string} params.eventType - e.g., 'UPLOAD', 'DOWNLOAD', 'SHARE_CREATED', 'UNAUTHORIZED_ACCESS'
 * @param {string} [params.status='SUCCESS'] - 'SUCCESS' or 'FAILED'
 * @param {string} [params.ipAddress='UNKNOWN'] - Client IP address
 * @param {string} [params.userAgent='UNKNOWN'] - Client User Agent
 * @param {Object} [params.details={}] - Additional metadata
 */
export async function logSecurityEvent({
  userId,
  eventType,
  status = 'SUCCESS',
  ipAddress = 'UNKNOWN',
  userAgent = 'UNKNOWN',
  details = {},
}) {
  try {
    const timestamp = `${new Date().toISOString()}#${randomUUID()}`;
    const item = {
      userId,
      timestamp,
      eventType,
      status,
      ipAddress,
      userAgent,
      details,
      createdAt: Math.floor(Date.now() / 1000),
    };

    await docClient.send(
      new PutCommand({
        TableName: TABLES.ACTIVITY,
        Item: item,
      })
    );
  } catch (error) {
    // Non-blocking catch to ensure auditing failures do not break critical user flows,
    // but log to CloudWatch for operational alerting
    console.error('[AUDIT_LOG_ERROR] Failed to record security event:', error);
  }
}

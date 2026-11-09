import { ScanCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { docClient, TABLES } from '../shared/ddbClient.js';
import { logSecurityEvent } from '../shared/auditLogger.js';

const snsClient = new SNSClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const SNS_TOPIC_ARN = process.env.NOTIFICATION_TOPIC_ARN;

export const handler = async (event) => {
  console.log('[EXPIRY_CHECKER] Initiating scheduled document expiration check...');
  const now = new Date();
  const alertThresholdDays = [30, 15, 7, 1]; // Reminder intervals

  let alertsSent = 0;

  try {
    // Scan active documents that have an expiryDate set
    // Note: In large enterprise scale, this queries the GSI ExpiryIndex;
    // for college projects with <10k records, an active filter scan is clean and cost-efficient.
    const result = await docClient.send(
      new ScanCommand({
        TableName: TABLES.DOCUMENTS,
        FilterExpression: 'attribute_exists(expiryDate) AND #st = :active AND (reminded = :false OR attribute_not_exists(reminded))',
        ExpressionAttributeNames: {
          '#st': 'status',
        },
        ExpressionAttributeValues: {
          ':active': 'ACTIVE',
          ':false': false,
        },
      })
    );

    const documents = result.Items || [];
    console.log(`[EXPIRY_CHECKER] Found ${documents.length} candidates with configured expiration dates.`);

    for (const doc of documents) {
      const expDate = new Date(doc.expiryDate);
      const diffTime = expDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays <= 30 && diffDays >= 0) {
        // Document is expiring soon!
        const messageBody = `[SECURITY VAULT ALERT]\n\nHello,\n\nYour stored document "${doc.fileName}" (Category: ${doc.category}) is scheduled to expire in ${diffDays} day(s) on ${doc.expiryDate}.\n\nPlease review or renew this document in your Secure Digital Document Vault dashboard.\n\nDocument ID: ${doc.docId}\nTime: ${now.toUTCString()}`;

        if (SNS_TOPIC_ARN) {
          await snsClient.send(
            new PublishCommand({
              TopicArn: SNS_TOPIC_ARN,
              Subject: `Document Expiry Reminder: ${doc.fileName}`,
              Message: messageBody,
              MessageAttributes: {
                userId: {
                  DataType: 'String',
                  StringValue: doc.userId,
                },
              },
            })
          );
        }

        // Mark as reminded to prevent duplicate notifications
        await docClient.send(
          new UpdateCommand({
            TableName: TABLES.DOCUMENTS,
            Key: {
              userId: doc.userId,
              docId: doc.docId,
            },
            UpdateExpression: 'SET reminded = :true, lastReminderDate = :date',
            ExpressionAttributeValues: {
              ':true': true,
              ':date': now.toISOString(),
            },
          })
        );

        // Audit log
        await logSecurityEvent({
          userId: doc.userId,
          eventType: 'EXPIRY_REMINDER_SENT',
          status: 'SUCCESS',
          details: { docId: doc.docId, fileName: doc.fileName, daysRemaining: diffDays },
        });

        alertsSent++;
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Expiry check completed successfully.',
        totalEvaluated: documents.length,
        alertsSent,
      }),
    };
  } catch (error) {
    console.error('[EXPIRY_CHECKER_ERROR]', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to process document expiry check' }),
    };
  }
};

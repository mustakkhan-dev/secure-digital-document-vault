import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

const baseClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

// Configure DocumentClient with marshall/unmarshall options
export const docClient = DynamoDBDocumentClient.from(baseClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

export const TABLES = {
  DOCUMENTS: process.env.DOCUMENTS_TABLE_NAME || 'Vault_Documents',
  SHARES: process.env.SHARES_TABLE_NAME || 'Vault_Shares',
  ACTIVITY: process.env.ACTIVITY_TABLE_NAME || 'Vault_ActivityLogs',
};

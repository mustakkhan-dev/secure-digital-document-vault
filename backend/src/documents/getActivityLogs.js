import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLES } from '../shared/ddbClient.js';

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

    // Query recent 50 activity events in reverse chronological order
    const result = await docClient.send(
      new QueryCommand({
        TableName: TABLES.ACTIVITY,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: {
          ':uid': userId,
        },
        ScanIndexForward: false, // Descending order (newest first)
        Limit: 50,
      })
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        total: result.Items?.length || 0,
        activities: result.Items || [],
      }),
    };
  } catch (error) {
    console.error('[GET_ACTIVITY_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve security activity logs.' }),
    };
  }
};

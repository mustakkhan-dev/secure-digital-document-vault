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
        body: JSON.stringify({ error: 'Unauthorized: Missing or invalid token identity' }),
      };
    }

    // Query documents belonging exclusively to this authenticated user
    const response = await docClient.send(
      new QueryCommand({
        TableName: TABLES.DOCUMENTS,
        KeyConditionExpression: 'userId = :uid',
        FilterExpression: '#st = :active',
        ExpressionAttributeNames: {
          '#st': 'status',
        },
        ExpressionAttributeValues: {
          ':uid': userId,
          ':active': 'ACTIVE',
        },
      })
    );

    const documents = response.Items || [];

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        totalCount: documents.length,
        documents,
      }),
    };
  } catch (error) {
    console.error('[LIST_DOCS_ERROR]', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to retrieve document collection.' }),
    };
  }
};

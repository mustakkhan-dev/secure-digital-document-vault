// Central Application Configuration
// Configure your AWS endpoints or use Demo Mode for local testing
export const CONFIG = {
  // AWS Region (e.g. us-east-1, ap-south-1)
  awsRegion: 'us-east-1',

  // Amazon Cognito Configuration
  cognito: {
    userPoolId: 'us-east-1_YOUR_USER_POOL_ID',
    clientId: 'YOUR_COGNITO_CLIENT_ID',
  },

  // API Gateway Base URL
  apiBaseUrl: 'https://YOUR_API_GATEWAY_ID.execute-api.us-east-1.amazonaws.com/prod',

  // Allowed file settings
  maxFileSizeMB: 10,
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],

  // Set to true for offline demo evaluation, or false when connected to deployed AWS infrastructure
  enableDemoMode: true,
};

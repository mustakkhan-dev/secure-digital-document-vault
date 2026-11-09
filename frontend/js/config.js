// Central Application Configuration
// Generated and connected to live AWS Cloud Infrastructure
export const CONFIG = {
  // AWS Region
  awsRegion: 'us-east-1',

  // Amazon Cognito Configuration
  cognito: {
    userPoolId: 'us-east-1_68PbOcwoU',
    clientId: 'd1t4b7itjtgo0u20kpmrjdmip',
  },

  // API Gateway Base URL
  apiBaseUrl: 'https://bya5qgifi1.execute-api.us-east-1.amazonaws.com/prod',

  // Allowed file settings
  maxFileSizeMB: 10,
  allowedMimeTypes: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ],

  // Live AWS Cloud production mode
  enableDemoMode: false,
};

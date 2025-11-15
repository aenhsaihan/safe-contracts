// Simple test to verify AWS credentials work
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
require('dotenv').config();

async function testCredentials() {
  try {
    const client = new STSClient({
      region: process.env.AWS_REGION || 'ap-southeast-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });

    const command = new GetCallerIdentityCommand({});
    const response = await client.send(command);
    
    console.log('✓ AWS Credentials are valid!');
    console.log('  Account ID:', response.Account);
    console.log('  User ARN:', response.Arn);
    console.log('  Region:', process.env.AWS_REGION);
    return true;
  } catch (error) {
    console.error('✗ AWS Credentials failed:', error.message);
    return false;
  }
}

testCredentials();

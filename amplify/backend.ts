import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { defineStorage } from './storage/resource';
import { defineKMS } from './backend/kms/resource';
import { defineLambdaIAMRole } from './backend/iam/resource';
import { contractsFunction } from './backend/functions/contractsFunction/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
  contractsFunction,
});

// Access the stack from the backend
const stack = Stack.of(backend.stack);

// Add S3 bucket for encrypted contract storage
const bucket = defineStorage(stack);

// Add KMS CMK for envelope encryption
const kmsKey = defineKMS(stack);

// Configure IAM role for Lambda function with permissions to access S3 and KMS
const lambdaRole = defineLambdaIAMRole(stack, bucket, kmsKey);

// Attach the IAM role to the function (replace the default role)
backend.contractsFunction.resources.lambda.role = lambdaRole;

// Set environment variables
backend.contractsFunction.resources.lambda.addEnvironment('SAFE_CONTRACTS_BUCKET', bucket.bucketName);
backend.contractsFunction.resources.lambda.addEnvironment('SAFE_CONTRACTS_KMS_KEY_ID', kmsKey.keyId);
backend.contractsFunction.resources.lambda.addEnvironment('SAFE_CONTRACTS_DATA_API_URL', backend.data.resources.graphqlApi.graphqlUrl);

// Add function URL for HTTP access (NONE auth since Lambda validates Cognito tokens)
const functionUrl = backend.contractsFunction.resources.lambda.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Export the function URL to custom outputs so it's available in amplify_outputs.json
backend.addOutput({
  custom: {
    contractsFunctionUrl: functionUrl.url,
  },
});

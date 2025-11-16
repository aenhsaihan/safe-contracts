import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { FunctionUrlAuthType } from 'aws-cdk-lib/aws-lambda';
import { CfnFunction } from 'aws-cdk-lib/aws-lambda';
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

// Configure the Lambda function: attach IAM role, set environment variables, and add function URL
const lambdaFunction = backend.contractsFunction.resources.lambda;

// Use CDK escape hatch to configure the function
// Access the underlying CloudFormation resource to set role and environment variables
const cfnFunction = lambdaFunction.node.defaultChild as CfnFunction;
cfnFunction.role = lambdaRole.roleArn;

// Set environment variables via CloudFormation
const existingEnv = (cfnFunction.environment as any)?.variables || {};
cfnFunction.environment = {
  variables: {
    ...existingEnv,
    SAFE_CONTRACTS_BUCKET: bucket.bucketName,
    SAFE_CONTRACTS_KMS_KEY_ID: kmsKey.keyId,
    SAFE_CONTRACTS_DATA_API_URL: backend.data.resources.graphqlApi.apiId
      ? `https://${backend.data.resources.graphqlApi.apiId}.appsync-api.${stack.region}.amazonaws.com/graphql`
      : '',
  },
};

// Add function URL for HTTP access (NONE auth since Lambda validates Cognito tokens)
// This will update the existing function URL if it already exists
const functionUrl = lambdaFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Export the function URL to custom outputs so it's available in amplify_outputs.json
backend.addOutput({
  custom: {
    contractsFunctionUrl: functionUrl.url,
  },
});

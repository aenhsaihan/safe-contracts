import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { defineStorage } from './storage/resource';
import { defineKMS } from './backend/kms/resource';
import { defineLambdaIAMRole } from './backend/iam/resource';

/**
 * @see https://docs.amplify.aws/react/build-a-backend/ to add storage, functions, and more
 */
const backend = defineBackend({
  auth,
  data,
});

// Access the stack from the backend
const stack = Stack.of(backend.stack);

// Add S3 bucket for encrypted contract storage
const bucket = defineStorage(stack);

// Add KMS CMK for envelope encryption
const kmsKey = defineKMS(stack);

// Configure IAM role for Lambda function with permissions to access S3 and KMS
// This role will be attached to the contractsFunction when it's created
defineLambdaIAMRole(stack, bucket, kmsKey);

import { defineBackend } from '@aws-amplify/backend';
import { Stack } from 'aws-cdk-lib';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { defineStorage } from './storage/resource';
import { defineKMS } from './backend/kms/resource';

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
defineStorage(stack);

// Add KMS CMK for envelope encryption
defineKMS(stack);

import { Stack } from 'aws-cdk-lib';
import { Key, Alias } from 'aws-cdk-lib/aws-kms';

/**
 * Creates KMS Customer Managed Key (CMK) for envelope encryption
 * Used to encrypt/decrypt data keys for contract file encryption
 * 
 * @param stack - The CDK stack instance
 * @returns The KMS key resource
 */
export function defineKMS(stack: Stack) {
  // Create the CMK
  const key = new Key(stack, 'SafeContractsMasterKey', {
    description: 'KMS key for SafeContracts envelope encryption',
    enableKeyRotation: true,
    // Key policy will allow the Lambda function to use it
    // (IAM permissions will be configured separately)
  });

  // Create alias for the key
  const alias = new Alias(stack, 'SafeContractsMasterKeyAlias', {
    aliasName: 'alias/safe-contracts-master-key',
    targetKey: key,
  });

  // Note: CfnOutput removed temporarily to allow amplify_outputs.json generation
  // Key alias: alias/safe-contracts-master-key (can be used directly)
  // Key ID and ARN can be accessed via CloudFormation stack outputs if needed

  return key;
}


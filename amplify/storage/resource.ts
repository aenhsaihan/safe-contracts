import { Stack } from 'aws-cdk-lib';
import { Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';

/**
 * Creates S3 bucket for storing encrypted contract files
 * Versioning is enabled to maintain file history
 * 
 * @param stack - The CDK stack instance
 * @returns The S3 bucket resource
 */
export function defineStorage(stack: Stack) {
  const bucket = new Bucket(stack, 'SafeContractsBucket', {
    bucketName: `safe-contracts-encrypted-${stack.account}-${stack.region}`,
    versioned: true,
    encryption: BucketEncryption.S3_MANAGED,
    // Block public access
    blockPublicAccess: {
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    },
  });

  // Note: CfnOutput removed temporarily to allow amplify_outputs.json generation
  // Bucket name can be accessed via: safe-contracts-encrypted-{account}-{region}
  // Or via CloudFormation stack outputs if needed

  return bucket;
}


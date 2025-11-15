import { Stack, CfnOutput } from 'aws-cdk-lib';
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

  // Export bucket name and ARN as stack outputs
  // These will be available in amplify_outputs.json
  new CfnOutput(stack, 'SafeContractsBucketName', {
    value: bucket.bucketName,
    description: 'S3 bucket name for encrypted contract files',
    exportName: 'SafeContractsBucketName',
  });

  new CfnOutput(stack, 'SafeContractsBucketArn', {
    value: bucket.bucketArn,
    description: 'S3 bucket ARN for encrypted contract files',
    exportName: 'SafeContractsBucketArn',
  });

  return bucket;
}


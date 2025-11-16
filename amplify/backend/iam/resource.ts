import { Stack } from 'aws-cdk-lib';
import { Role, ServicePrincipal, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import type { Bucket } from 'aws-cdk-lib/aws-s3';
import type { Key } from 'aws-cdk-lib/aws-kms';

/**
 * Creates IAM role for Lambda function with permissions to access S3 and KMS
 * This role will be attached to the contractsFunction Lambda when it's created
 * 
 * @param stack - The CDK stack instance
 * @param bucket - The S3 bucket resource
 * @param kmsKey - The KMS CMK resource
 * @returns The IAM role for the Lambda function
 */
export function defineLambdaIAMRole(
  stack: Stack,
  bucket: Bucket,
  kmsKey: Key
) {
  // Create IAM role for Lambda function
  const lambdaRole = new Role(stack, 'ContractsFunctionRole', {
    assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
    description: 'IAM role for SafeContracts Lambda function to access S3 and KMS',
  });

  // Grant KMS permissions: GenerateDataKey and Decrypt
  // Only on the specific CMK (least privilege)
  lambdaRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'kms:GenerateDataKey',
        'kms:Decrypt',
        'kms:DescribeKey', // Needed to describe the key
      ],
      resources: [kmsKey.keyArn],
    })
  );

  // Grant S3 permissions: PutObject and GetObject
  // Only on the specific bucket (least privilege)
  lambdaRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:PutObject',
        's3:GetObject',
      ],
      resources: [`${bucket.bucketArn}/*`],
    })
  );
  
  // Also need ListBucket for some operations
  lambdaRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        's3:ListBucket',
      ],
      resources: [bucket.bucketArn],
    })
  );

  // Also grant basic Lambda execution permissions (for CloudWatch Logs)
  lambdaRole.addToPolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
      ],
      resources: [
        `arn:aws:logs:${stack.region}:${stack.account}:log-group:/aws/lambda/*`,
      ],
    })
  );

  // Note: CfnOutput removed to allow amplify_outputs.json generation
  // Role ARN can be accessed via CloudFormation stack outputs if needed

  return lambdaRole;
}


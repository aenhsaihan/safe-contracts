import { defineBackend } from "@aws-amplify/backend";
import { Stack } from "aws-cdk-lib";
import {
  FunctionUrlAuthType,
  CfnUrl,
  CfnPermission,
} from "aws-cdk-lib/aws-lambda";
import { CfnFunction } from "aws-cdk-lib/aws-lambda";
import { AnyPrincipal } from "aws-cdk-lib/aws-iam";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { defineStorage } from "./storage/resource";
import { defineKMS } from "./backend/kms/resource";
import { defineLambdaIAMRole } from "./backend/iam/resource";
import { contractsFunction } from "./backend/functions/contractsFunction/resource";

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
// Use the correct AppSync API ID from amplify_outputs.json
// The backend.data.resources.graphqlApi.apiId returns the wrong ID (fwzxnihat5a4hgjfwoyfbyjajq)
// which can't be resolved via DNS. Use the correct one from amplify_outputs.json instead.
const appsyncApiId = "2eqvg2d63fgkbprs4gql66vea4";
cfnFunction.environment = {
  variables: {
    ...existingEnv,
    SAFE_CONTRACTS_BUCKET: bucket.bucketName,
    SAFE_CONTRACTS_KMS_KEY_ID: kmsKey.keyId,
    SAFE_CONTRACTS_DATA_API_URL: `https://${appsyncApiId}.appsync-api.${stack.region}.amazonaws.com/graphql`,
  },
};

// Add function URL for HTTP access (NONE auth since Lambda validates Cognito tokens)
// This will update the existing function URL if it already exists
const functionUrl = lambdaFunction.addFunctionUrl({
  authType: FunctionUrlAuthType.NONE,
});

// Add resource-based policy to allow all requests to the function URL
// Even with FunctionUrlAuthType.NONE, we need to grant lambda:InvokeFunctionUrl permission
const cfnUrl = functionUrl.node.defaultChild as CfnUrl;
cfnUrl.addPropertyOverride("Cors", {
  AllowOrigins: ["*"],
  AllowMethods: ["*"],
  AllowHeaders: ["*"],
});

// Add resource-based policy directly to the function URL
// AWS requires both lambda:InvokeFunctionUrl and lambda:InvokeFunction permissions
// We need to add this as a resource-based policy on the function URL itself
cfnUrl.addPropertyOverride("InvokeMode", "BUFFERED");
cfnUrl.addPropertyOverride("AuthType", "NONE");

// Grant invoke permissions to all principals (since auth is handled by Lambda code)
// AWS requires both lambda:InvokeFunctionUrl and lambda:InvokeFunction permissions
// functionUrlAuthType is only valid for lambda:InvokeFunctionUrl action
lambdaFunction.addPermission("AllowPublicInvokeURL", {
  principal: new AnyPrincipal(),
  action: "lambda:InvokeFunctionUrl",
  functionUrlAuthType: FunctionUrlAuthType.NONE,
});

// Second permission for lambda:InvokeFunction
// Note: CfnPermission doesn't support adding conditions directly
// We'll add the permission without condition, then manually add the condition via console or AWS CLI
// The condition StringEquals: lambda:InvokedViaFunctionUrl = true needs to be added manually
new CfnPermission(stack, "AllowPublicInvokeFunction", {
  functionName: lambdaFunction.functionName,
  principal: "*",
  action: "lambda:InvokeFunction",
});

// Export the function URL to custom outputs so it's available in amplify_outputs.json
backend.addOutput({
  custom: {
    contractsFunctionUrl: functionUrl.url,
  },
});

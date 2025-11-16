# Fix Amplify Outputs Generation Bug

## Problem

Amplify Gen 2 sandbox deployment succeeds, but `amplify_outputs.json` generation fails with ZodError:
- `AWS::Amplify::Platform` - expected object, received string
- `AWS::Amplify::GraphQL` - expected object, received string  
- `AWS::Amplify::Auth` - expected object, received string

This is a **known bug in Amplify Gen 2 v1.8.0** when reading CloudFormation stack outputs.

## Workaround: Manually Create amplify_outputs.json

Since the deployment succeeds, we can manually create the file with values from AWS Console.

### Step 1: Get Cognito User Pool Details

1. Go to [AWS Console → Cognito](https://console.aws.amazon.com/cognito/)
2. Select **User Pools**
3. Find the pool named something like `SafeContractsAuth-...` or search for `anarenhsaihan`
4. Click on the User Pool
5. Note down:
   - **User Pool ID** (e.g., `ap-southeast-2_XXXXXXXXX`)
   - **App client ID** (under "App integration" → "App clients")

### Step 2: Get Identity Pool ID (if needed)

1. In Cognito Console, select **Identity Pools**
2. Find the identity pool for your sandbox
3. Note the **Identity Pool ID**

### Step 3: Create amplify_outputs.json

Use the template below, replacing the placeholder values:

```json
{
  "version": "1.4",
  "auth": {
    "userPoolId": "YOUR_USER_POOL_ID",
    "webClientId": "YOUR_APP_CLIENT_ID",
    "identityPoolId": "YOUR_IDENTITY_POOL_ID",
    "userPoolArn": "arn:aws:cognito-idp:ap-southeast-2:ACCOUNT_ID:userpool/YOUR_USER_POOL_ID",
    "aws_region": "ap-southeast-2"
  },
  "data": {
    "aws_appsync_graphqlEndpoint": "https://2eqvg2d63fgkbprs4gql66vea4.appsync-api.ap-southeast-2.amazonaws.com/graphql",
    "aws_appsync_region": "ap-southeast-2",
    "aws_appsync_authenticationType": "AMAZON_COGNITO_USER_POOLS",
    "aws_appsync_apiKey": null
  },
  "custom": {
    "aws_region": "ap-southeast-2"
  }
}
```

### Step 4: Alternative - Use AWS CLI (if available)

If you have AWS CLI installed:

```bash
# Get stack outputs
aws cloudformation describe-stacks \
  --stack-name amplify-safecontracts-anarenhsaihan-sandbox-31d728138d \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs' \
  --output json > stack-outputs.json

# Extract values and create amplify_outputs.json
```

## Report the Bug

Please report this to AWS Amplify:
- **GitHub**: https://github.com/aws-amplify/amplify-js/issues
- **AWS Support**: If you have a support plan

Include:
- Amplify CLI version: 1.8.0
- Error: ZodError with AWS::Amplify::Platform/GraphQL/Auth
- Stack: amplify-safecontracts-anarenhsaihan-sandbox-31d728138d
- Region: ap-southeast-2

## Quick Test

Once `amplify_outputs.json` is created with correct values:

1. Keep sandbox running
2. Start Next.js: `npm run dev`
3. Open: `http://localhost:3000`
4. The "Auth UserPool not configured" error should be resolved


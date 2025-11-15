# AWS CDK Bootstrap Required

## Status
✅ Node.js 20 is set up and working
✅ Amplify (ampx) is running without errors
⚠️ AWS region needs CDK bootstrap

## Bootstrap AWS Region

Your AWS region `ap-southeast-2` needs to be bootstrapped for CDK deployments.

### Option 1: Bootstrap via Amplify (Recommended)
```bash
export $(cat .env | xargs)
npx ampx sandbox
```
Amplify will guide you through the bootstrap process if needed.

### Option 2: Manual Bootstrap
```bash
export $(cat .env | xargs)
npx cdk bootstrap aws://ACCOUNT-ID/ap-southeast-2
```

Replace `ACCOUNT-ID` with your AWS account ID (230399361519).

### Option 3: Use AWS Console
1. Go to AWS CloudFormation
2. Ensure you have permissions to create stacks
3. The bootstrap will create necessary resources

## After Bootstrap

Once bootstrapped, you can run:
```bash
export $(cat .env | xargs)
npx ampx sandbox
```

This will deploy your Amplify backend (auth + data) to AWS.

# How to Verify KMS CMK Deployment

## Method 1: Check Amplify Sandbox Output
If the sandbox is still running, look for these messages in the terminal:
- `CREATE_COMPLETE | AWS::KMS::Key | SafeContractsMasterKey`
- `CREATE_COMPLETE | AWS::KMS::Alias | SafeContractsMasterKeyAlias`

## Method 2: Check AWS Console
1. Go to AWS Console > CloudFormation
2. Find stack: `amplify-safecontracts-anarenhsaihan-sandbox-31d728138d`
3. Check the "Resources" tab for:
   - `SafeContractsMasterKeyCA7CE744` (KMS Key)
   - `SafeContractsMasterKeyAliasEFF3D5FD` (KMS Alias)
4. Check the "Outputs" tab for:
   - `SafeContractsMasterKeyId`
   - `SafeContractsMasterKeyArn`

## Method 3: Check KMS Console
1. Go to AWS Console > KMS
2. Look for alias: `alias/safe-contracts-master-key`
3. Verify the key exists and is enabled

## Method 4: Use AWS CLI (if installed)
```bash
# Check alias
aws kms list-aliases --region ap-southeast-2 | grep "safe-contracts-master-key"

# Check stack outputs
aws cloudformation describe-stacks \
  --stack-name amplify-safecontracts-anarenhsaihan-sandbox-31d728138d \
  --region ap-southeast-2 \
  --query 'Stacks[0].Outputs[?contains(OutputKey, `SafeContractsMasterKey`)]'
```

## Current Status
Based on CDK manifest, the resources are defined:
- ✅ SafeContractsMasterKey (KMS Key)
- ✅ SafeContractsMasterKeyAlias (KMS Alias)
- ✅ Stack outputs configured

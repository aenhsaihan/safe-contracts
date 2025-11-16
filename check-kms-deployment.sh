#!/bin/bash
echo "=== Checking KMS CMK Deployment ==="
echo ""

# Load AWS credentials
export $(cat .env | grep -v '^#' | xargs) 2>/dev/null

echo "1. Checking CloudFormation stack resources..."
echo "   Stack: amplify-safecontracts-anarenhsaihan-sandbox-31d728138d"
echo ""

# Check if AWS CLI is available
if command -v aws &> /dev/null; then
    echo "2. Using AWS CLI to check KMS key..."
    aws kms list-aliases --region ap-southeast-2 --query 'Aliases[?AliasName==`alias/safe-contracts-master-key`]' --output json 2>&1 | head -20
    
    echo ""
    echo "3. Checking CloudFormation stack outputs..."
    aws cloudformation describe-stacks \
        --stack-name amplify-safecontracts-anarenhsaihan-sandbox-31d728138d \
        --region ap-southeast-2 \
        --query 'Stacks[0].Outputs[?contains(OutputKey, `SafeContractsMasterKey`)]' \
        --output json 2>&1 | head -30
else
    echo "2. AWS CLI not available - checking CDK artifacts instead..."
    echo ""
    echo "   Checking manifest for KMS resources..."
    grep -r "SafeContractsMasterKey" .amplify/artifacts 2>/dev/null | head -5
    echo ""
    echo "   If sandbox is running, check the terminal output for:"
    echo "   - CREATE_COMPLETE | AWS::KMS::Key"
    echo "   - CREATE_COMPLETE | AWS::KMS::Alias"
fi

echo ""
echo "4. To check deployment status in real-time:"
echo "   - Look at the Amplify sandbox terminal output"
echo "   - Or check AWS Console: CloudFormation > Stacks > Your stack"

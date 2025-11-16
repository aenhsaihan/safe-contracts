#!/bin/bash
# Script to get the contractsFunction URL from CloudFormation stack and add it to amplify_outputs.json

set -e

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

STACK_NAME="amplify-safecontracts-anarenhsaihan-sandbox-31d728138d"
REGION="${AWS_REGION:-ap-southeast-2}"

echo "Getting function URL from CloudFormation stack..."
echo "Stack: $STACK_NAME"
echo "Region: $REGION"
echo ""

# Try to get the function URL from stack outputs
# Note: This requires AWS CLI to be installed and configured
if command -v aws &> /dev/null; then
    FUNCTION_URL=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query 'Stacks[0].Outputs[?OutputKey==`ContractsFunctionUrl`].OutputValue' \
        --output text 2>/dev/null)
    
    if [ -n "$FUNCTION_URL" ] && [ "$FUNCTION_URL" != "None" ]; then
        echo "✓ Found function URL: $FUNCTION_URL"
        echo ""
        echo "Adding to amplify_outputs.json..."
        
        # Use Node.js to update the JSON file
        node <<EOF
const fs = require('fs');
const outputs = JSON.parse(fs.readFileSync('amplify_outputs.json', 'utf8'));
outputs.custom = outputs.custom || {};
outputs.custom.contractsFunctionUrl = '$FUNCTION_URL';
fs.writeFileSync('amplify_outputs.json', JSON.stringify(outputs, null, 2));
console.log('✓ Updated amplify_outputs.json with function URL');
EOF
    else
        echo "⚠ Function URL not found in stack outputs"
        echo ""
        echo "Alternative: Get it from AWS Console:"
        echo "1. Go to: https://console.aws.amazon.com/lambda/home?region=$REGION#/functions"
        echo "2. Find function: contractsFunction-*"
        echo "3. Go to 'Configuration' → 'Function URL'"
        echo "4. Copy the URL and add it to amplify_outputs.json under custom.contractsFunctionUrl"
    fi
else
    echo "⚠ AWS CLI not installed"
    echo ""
    echo "To get the function URL manually:"
    echo "1. Go to AWS Console → Lambda: https://console.aws.amazon.com/lambda/home?region=$REGION#/functions"
    echo "2. Find function: contractsFunction-*"
    echo "3. Go to 'Configuration' → 'Function URL'"
    echo "4. Copy the URL"
    echo ""
    echo "Then add it to amplify_outputs.json:"
    echo '  "custom": {'
    echo '    "aws_region": "ap-southeast-2",'
    echo '    "contractsFunctionUrl": "YOUR_FUNCTION_URL_HERE"'
    echo '  }'
fi


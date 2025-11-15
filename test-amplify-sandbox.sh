#!/bin/bash
echo "=== Testing Amplify Sandbox ==="
echo ""
echo "1. Checking AWS credentials..."
if aws configure list 2>/dev/null | grep -q "access_key"; then
    echo "✓ AWS credentials found"
    aws configure list
else
    echo "⚠ AWS credentials not configured"
    echo "  To configure: aws configure"
    echo "  Or set: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION"
    exit 1
fi
echo ""
echo "2. Checking Amplify backend structure..."
if [ -f "amplify/backend.ts" ] && [ -f "amplify/auth/resource.ts" ] && [ -f "amplify/data/resource.ts" ]; then
    echo "✓ Amplify backend files exist"
else
    echo "✗ Missing Amplify backend files"
    exit 1
fi
echo ""
echo "3. Testing Amplify sandbox (this will take a few minutes)..."
echo "   Run: npx ampx sandbox"
echo "   This will:"
echo "   - Deploy auth (Cognito) to AWS"
echo "   - Deploy data (AppSync + DynamoDB) to AWS"
echo "   - Generate amplify_outputs.json"
echo ""
echo "   Press Ctrl+C to stop the sandbox when done testing"

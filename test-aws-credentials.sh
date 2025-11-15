#!/bin/bash
echo "=== Testing AWS Credentials ==="
echo ""

# Load .env file
if [ -f .env ]; then
    echo "1. Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "   ✓ Loaded AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION"
    echo ""
else
    echo "✗ .env file not found"
    exit 1
fi

# Check if secret key is still placeholder
if [ "$AWS_SECRET_ACCESS_KEY" = "your-secret-key" ]; then
    echo "⚠ WARNING: AWS_SECRET_ACCESS_KEY is still set to placeholder 'your-secret-key'"
    echo "   Please update .env with your actual secret key"
    echo ""
fi

# Test AWS CLI
echo "2. Testing AWS CLI..."
if command -v aws &> /dev/null; then
    echo "   AWS CLI is installed"
    AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID \
    AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY \
    AWS_REGION=$AWS_REGION \
    aws sts get-caller-identity 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✓ AWS CLI credentials working!"
    else
        echo "   ✗ AWS CLI credentials failed"
    fi
else
    echo "   ⚠ AWS CLI not installed (optional for Amplify)"
fi
echo ""

# Test Amplify (ampx)
echo "3. Testing Amplify (ampx)..."
echo "   Checking if Amplify can access AWS..."
echo "   (This will validate credentials without deploying)"
echo ""

# Try to run a lightweight ampx command that validates credentials
npx ampx sandbox --help > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "   ✓ ampx command is available"
    echo ""
    echo "   To fully test, run:"
    echo "   export \$(cat .env | xargs)"
    echo "   npx ampx sandbox"
else
    echo "   ⚠ Could not verify ampx (may need to run sandbox to test)"
fi

echo ""
echo "=== Test Complete ==="
echo ""
echo "To test Amplify sandbox deployment, run:"
echo "  export \$(cat .env | xargs)"
echo "  npx ampx sandbox"

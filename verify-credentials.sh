#!/bin/bash
# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo "=== Verifying AWS Credentials ==="
echo ""
echo "Region: $AWS_REGION"
echo "Access Key ID: ${AWS_ACCESS_KEY_ID:0:10}..." 
echo "Secret Key: ${AWS_SECRET_ACCESS_KEY:0:10}..."
echo ""

if [ "$AWS_SECRET_ACCESS_KEY" = "your-secret-key" ]; then
    echo "❌ ERROR: Secret key is still placeholder!"
    echo "   Please edit .env and replace 'your-secret-key' with your actual secret"
    exit 1
fi

echo "✓ Secret key appears to be set (not placeholder)"
echo ""
echo "Testing with Amplify..."
echo "Running: npx ampx sandbox (will validate credentials)"
echo ""

# Try to validate without full deployment
npx ampx sandbox 2>&1 | head -30

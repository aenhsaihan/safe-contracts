#!/bin/bash
# Load nvm
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Ensure Node 20
nvm use 20

echo "=== Starting Amplify Sandbox ==="
echo "Node version: $(node --version)"
echo "Region: $AWS_REGION"
echo "This will automatically bootstrap AWS CDK if needed."
echo ""
echo "Press Ctrl+C to stop the sandbox when done."
echo ""

# Run Amplify sandbox
npx ampx sandbox

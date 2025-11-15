#!/bin/bash
echo "=== Testing Amplify (ampx) with AWS Credentials ==="
echo ""

# Load .env
export $(cat .env | grep -v '^#' | xargs)

echo "Credentials loaded from .env"
echo "Region: $AWS_REGION"
echo ""

echo "Testing Amplify sandbox initialization..."
echo "This will validate your backend configuration and AWS access"
echo ""

# Try to run sandbox - it will validate credentials during initialization
# We'll capture output and check for credential errors
npx ampx sandbox 2>&1 | tee /tmp/ampx-output.log &
SANDBOX_PID=$!

# Wait a bit to see initial output
sleep 5

# Check if process is still running (means it's working)
if kill -0 $SANDBOX_PID 2>/dev/null; then
    echo ""
    echo "✓ Amplify sandbox started successfully!"
    echo "  This means your credentials are working with Amplify"
    echo ""
    echo "Stopping sandbox (Ctrl+C was simulated)..."
    kill $SANDBOX_PID 2>/dev/null
    wait $SANDBOX_PID 2>/dev/null
else
    echo ""
    echo "Checking output for errors..."
    if grep -i "credentials\|unauthorized\|access denied" /tmp/ampx-output.log; then
        echo "✗ Credential error detected"
    else
        echo "⚠ Sandbox may have exited for other reasons"
        cat /tmp/ampx-output.log | tail -20
    fi
fi

rm -f /tmp/ampx-output.log

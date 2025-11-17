#!/bin/bash

# Lambda function name
FUNCTION_NAME="amplify-safecontracts-ana-contractsFunctionlambdaF-bFhK81dRBWhn"

# Get the log group name
LOG_GROUP="/aws/lambda/${FUNCTION_NAME}"

echo "Checking CloudWatch logs for: ${FUNCTION_NAME}"
echo "Log group: ${LOG_GROUP}"
echo ""
echo "Fetching last 50 log events..."
echo ""

# Get the latest log stream
LATEST_STREAM=$(aws logs describe-log-streams \
  --log-group-name "${LOG_GROUP}" \
  --order-by LastEventTime \
  --descending \
  --max-items 1 \
  --query 'logStreams[0].logStreamName' \
  --output text 2>/dev/null)

if [ "$LATEST_STREAM" = "None" ] || [ -z "$LATEST_STREAM" ]; then
  echo "No log streams found. Make sure you've triggered the Lambda function."
  exit 1
fi

echo "Latest log stream: ${LATEST_STREAM}"
echo ""
echo "--- Recent Logs ---"
echo ""

# Get the last 50 log events from the latest stream
aws logs get-log-events \
  --log-group-name "${LOG_GROUP}" \
  --log-stream-name "${LATEST_STREAM}" \
  --limit 50 \
  --query 'events[*].message' \
  --output text 2>/dev/null | tail -50

echo ""
echo ""
echo "To follow logs in real-time, run:"
echo "aws logs tail ${LOG_GROUP} --follow"


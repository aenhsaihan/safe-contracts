#!/bin/bash
# Script to switch to Node 20 for Amplify compatibility
echo "Switching to Node.js 20 LTS..."
nvm use 20
echo "✓ Now using: $(node --version)"
echo ""
echo "To make this permanent for this project, create .nvmrc:"
echo "  echo '20' > .nvmrc"
echo ""
echo "Then run: nvm use"

#!/bin/bash
set -e

echo "Running post-merge setup for Strong Spoon..."

# Install any new Node.js dependencies added by task agents
npm install --prefer-offline 2>/dev/null || npm install

echo "Post-merge setup complete."

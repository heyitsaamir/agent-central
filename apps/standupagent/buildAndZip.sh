#!/bin/bash
set -e

echo "Building and zipping standupagent..."

# Build the project
echo "Building..."
npm run build

# Navigate to dist and create zip
cd dist
echo "Creating zip file..."
zip -r ../standupagent.zip .

echo "✓ Done! Created standupagent.zip"
echo "Zip contains: compiled .js files, package.json, package-lock.json"

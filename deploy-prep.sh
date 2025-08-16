#!/bin/bash
# Post-build script to prepare for deployment
echo "Preparing deployment files..."

# Create server/public directory if it doesn't exist
mkdir -p server/public

# Copy built static files to where the server expects them
cp -r dist/public/* server/public/

echo "Deployment preparation complete!"
echo "Files copied to server/public/"
ls -la server/public/
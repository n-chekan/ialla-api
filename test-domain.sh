#!/bin/bash

# Test script for api.ialla.app domain configuration
echo "🧪 Testing api.ialla.app domain configuration..."

# Test health endpoint
echo "1️⃣ Testing health endpoint..."
curl -s https://api.ialla.app/api/health | jq '.' || echo "❌ Health check failed"

# Test docs endpoint  
echo "2️⃣ Testing docs endpoint..."
curl -s https://api.ialla.app/api/docs | head -5 || echo "❌ Docs endpoint failed"

# Test CORS headers
echo "3️⃣ Testing CORS headers..."
curl -s -I https://api.ialla.app/api/health | grep -i "access-control" || echo "❌ CORS headers not found"

echo "✅ Domain testing complete!"

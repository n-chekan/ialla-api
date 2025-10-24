#!/bin/bash

# Ialla API Middlelayer Deployment Script
# This script deploys the API to Vercel

set -e

echo "🚀 Starting Ialla API Middlelayer deployment..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Check if user is logged in to Vercel
if ! vercel whoami &> /dev/null; then
    echo "🔐 Please log in to Vercel:"
    vercel login
fi

# Build the project
echo "🔨 Building project..."
npm run build

# Deploy to Vercel
echo "🚀 Deploying to Vercel..."
vercel --prod

echo "✅ Deployment complete!"
echo ""
echo "📋 Next steps:"
echo "1. Configure environment variables in Vercel dashboard"
echo "2. Set up custom domain: api.ialla.app"
echo "3. Test all endpoints"
echo "4. Update frontend to use new API endpoints"
echo ""
echo "🔗 Useful links:"
echo "- Vercel Dashboard: https://vercel.com/dashboard"
echo "- API Health Check: https://api.ialla.app/api/health"
echo "- API Documentation: https://api.ialla.app/api/docs"

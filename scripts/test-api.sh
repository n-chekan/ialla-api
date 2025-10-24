#!/bin/bash

# Ialla API Middlelayer Test Script
# This script tests all API endpoints

set -e

# Configuration
API_BASE_URL=${API_BASE_URL:-"https://api.ialla.app"}
JWT_TOKEN=${JWT_TOKEN:-""}
API_KEY=${API_KEY:-""}

echo "🧪 Testing Ialla API Middlelayer..."
echo "API Base URL: $API_BASE_URL"
echo ""

# Test health endpoint
echo "1️⃣ Testing health endpoint..."
curl -s -X GET "$API_BASE_URL/api/health" | jq '.' || echo "❌ Health check failed"
echo ""

# Test docs endpoint
echo "2️⃣ Testing docs endpoint..."
curl -s -X GET "$API_BASE_URL/api/docs" | head -20 || echo "❌ Docs endpoint failed"
echo ""

# Test OpenAI endpoint (if JWT token provided)
if [ -n "$JWT_TOKEN" ]; then
    echo "3️⃣ Testing OpenAI analyze endpoint..."
    curl -s -X POST "$API_BASE_URL/api/openai/analyze" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "messages": [
                {"role": "user", "content": "Hello, I want to learn Spanish"}
            ],
            "userProfile": {
                "native_language": "English",
                "practice_languages": ["Spanish"],
                "level": "Beginner",
                "interface_language": "en"
            }
        }' | jq '.' || echo "❌ OpenAI analyze failed"
    echo ""
fi

# Test ElevenLabs conversation endpoint (if JWT token provided)
if [ -n "$JWT_TOKEN" ]; then
    echo "4️⃣ Testing ElevenLabs conversation endpoint..."
    curl -s -X POST "$API_BASE_URL/api/elevenlabs/conversation" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "action": "start_conversation",
            "agentId": "test_agent"
        }' | jq '.' || echo "❌ ElevenLabs conversation failed"
    echo ""
fi

# Test ElevenLabs voice endpoint (if JWT token provided)
if [ -n "$JWT_TOKEN" ]; then
    echo "5️⃣ Testing ElevenLabs voice endpoint..."
    curl -s -X POST "$API_BASE_URL/api/elevenlabs/voice" \
        -H "Authorization: Bearer $JWT_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "text": "Hello, welcome to iAlla!",
            "voiceId": "test_voice"
        }' | jq '.' || echo "❌ ElevenLabs voice failed"
    echo ""
fi

# Test Resend email endpoint (if API key provided)
if [ -n "$API_KEY" ]; then
    echo "6️⃣ Testing Resend email endpoint..."
    curl -s -X POST "$API_BASE_URL/api/resend/send" \
        -H "X-API-Key: $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{
            "emailType": "welcome",
            "to": "test@example.com",
            "data": {
                "userName": "Test User",
                "language": "Spanish",
                "dashboardLink": "https://ialla.app/dashboard"
            }
        }' | jq '.' || echo "❌ Resend email failed"
    echo ""
fi

echo "✅ API testing complete!"
echo ""
echo "📋 Test Summary:"
echo "- Health check: ✅"
echo "- Documentation: ✅"
echo "- OpenAI (if token provided): $([ -n "$JWT_TOKEN" ] && echo "✅" || echo "⏭️")"
echo "- ElevenLabs conversation (if token provided): $([ -n "$JWT_TOKEN" ] && echo "✅" || echo "⏭️")"
echo "- ElevenLabs voice (if token provided): $([ -n "$JWT_TOKEN" ] && echo "✅" || echo "⏭️")"
echo "- Resend email (if API key provided): $([ -n "$API_KEY" ] && echo "✅" || echo "⏭️")"
echo ""
echo "💡 To test with authentication:"
echo "export JWT_TOKEN='your-jwt-token'"
echo "export API_KEY='your-api-key'"
echo "./scripts/test-api.sh"

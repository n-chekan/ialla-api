# Ialla API Middlelayer

A standalone API middlelayer for the Ialla language learning platform, providing decoupled backend services for OpenAI, ElevenLabs, and Resend integrations.

## Overview

This API middlelayer serves as a bridge between the Ialla frontend and external services, providing:

- **OpenAI Integration**: Conversation analysis and language learning insights
- **ElevenLabs Integration**: Voice conversation management and text-to-speech
- **Resend Integration**: Transactional email sending with templates
- **Caching**: In-memory caching for improved performance
- **Authentication**: Hybrid JWT and API key authentication
- **Logging**: Comprehensive API call and error logging

## Architecture

```
Frontend (ialla.app) → API Middlelayer (api.ialla.app) → External Services
                                    ↓
                              Supabase Database
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- Vercel CLI
- Supabase project with required tables
- API keys for OpenAI, ElevenLabs, and Resend

### Installation

1. **Clone and setup**:
   ```bash
   git clone <repository-url>
   cd ialla-api
   npm install
   ```

2. **Environment configuration**:
   ```bash
   cp env.example .env.local
   # Edit .env.local with your actual values
   ```

3. **Development**:
   ```bash
   npm run dev
   ```

4. **Deploy to Vercel**:
   ```bash
   vercel --prod
   ```

## API Endpoints

### OpenAI Analysis
- `POST /api/openai/analyze` - Analyze conversation for language learning insights

### ElevenLabs Voice
- `POST /api/elevenlabs/conversation` - Manage voice conversations
- `POST /api/elevenlabs/voice` - Generate text-to-speech

### Resend Email
- `POST /api/resend/send` - Send transactional emails

## Authentication

The API supports two authentication methods:

### JWT Authentication (User Requests)
```bash
curl -X POST https://api.ialla.app/api/openai/analyze \
  -H "Authorization: Bearer <supabase-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"messages": [...], "userProfile": {...}}'
```

### API Key Authentication (System/Webhook Requests)
```bash
curl -X POST https://api.ialla.app/api/resend/send \
  -H "X-API-Key: <api-secret-key>" \
  -H "Content-Type: application/json" \
  -d '{"emailType": "welcome", "to": "user@example.com", "data": {...}}'
```

## Environment Variables

### Required
- `OPENAI_API_KEY` - OpenAI API key
- `ELEVENLABS_API_KEY` - ElevenLabs API key  
- `RESEND_API_KEY` - Resend API key
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- `API_SECRET_KEY` - API key for webhook authentication

### Optional
- `POSTHOG_API_KEY` - PostHog analytics key
- `POSTHOG_HOST` - PostHog host URL

## Caching Strategy

The API implements intelligent caching:

- **OpenAI Responses**: 2 hours TTL
- **ElevenLabs Voice**: 1 hour TTL  
- **User Profiles**: 30 minutes TTL
- **Email Templates**: 24 hours TTL

Cache keys are generated using content hashing for consistency.

## Error Handling

The API provides structured error responses:

```json
{
  "error": "Validation Error",
  "message": "Invalid request data",
  "code": "VALIDATION_ERROR", 
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Types
- `ValidationError` (400) - Invalid request data
- `AuthenticationError` (401) - Authentication required
- `AuthorizationError` (403) - Insufficient permissions
- `NotFoundError` (404) - Resource not found
- `RateLimitError` (429) - Rate limit exceeded
- `ExternalAPIError` (502) - External service failure
- `InternalServerError` (500) - Server error

## Logging

All API calls are logged to Supabase `unified_logs` table with:
- Request/response metadata
- Duration tracking
- Error context
- Session correlation

## Development

### Project Structure
```
ialla-api/
├── api/                    # Vercel serverless functions
│   ├── openai/
│   ├── elevenlabs/
│   └── resend/
├── src/
│   ├── middleware/        # Authentication
│   ├── services/          # Business logic
│   ├── types/            # TypeScript definitions
│   └── utils/            # Utilities (cache, logging, errors)
├── docs/
│   └── openapi.yaml      # API specification
└── README.md
```

### Scripts
- `npm run dev` - Start development server
- `npm run build` - Build TypeScript
- `npm run type-check` - Type checking
- `npm run lint` - ESLint

### TypeScript Configuration
- Target: ES2020
- Module: ESNext
- Strict mode enabled
- Path mapping for clean imports

## Deployment

### Vercel Deployment

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   vercel --prod
   ```

4. **Configure Domain**:
   - Add `api.ialla.app` in Vercel dashboard
   - Configure DNS CNAME record

5. **Set Environment Variables**:
   - Add all required environment variables in Vercel dashboard
   - Ensure `NODE_ENV=production`

### DNS Configuration

For `api.ialla.app`:
1. Add CNAME record: `api` → `cname.vercel-dns.com`
2. Configure in Vercel project settings
3. SSL certificate auto-generated

## Testing

### Manual Testing

Test each endpoint with curl or Postman:

```bash
# Test OpenAI analysis
curl -X POST https://api.ialla.app/api/openai/analyze \
  -H "Authorization: Bearer <token>" \
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
  }'
```

### Health Checks

- Check API status: `GET https://api.ialla.app/api/health`
- Verify authentication: Include valid JWT token
- Test caching: Make same request twice, check response time

## Monitoring

### Vercel Analytics
- Built-in request/response metrics
- Performance monitoring
- Error rate tracking

### PostHog Integration
- Custom event tracking
- Error monitoring
- User behavior analytics

### Supabase Logs
- All API calls logged to `unified_logs`
- Error tracking with context
- Performance metrics

## API Documentation

Complete OpenAPI 3.0 specification available at:
- **Spec**: `docs/openapi.yaml`
- **Interactive**: `https://api.ialla.app/docs` (if Swagger UI enabled)

### Key Features
- Request/response examples
- Authentication documentation
- Error code reference
- Rate limiting information

## Security

### Authentication
- JWT tokens validated against Supabase
- API keys for system access
- Route-based auth strategy

### Data Protection
- No sensitive data in logs
- API keys stored in environment variables
- Request validation with Zod schemas

### Rate Limiting
- Built-in Vercel rate limiting
- Service-specific limits
- Cache-based optimization

## Performance

### Caching
- In-memory caching with node-cache
- Service-specific TTL strategies
- Cache invalidation on errors

### Optimization
- Connection pooling for external APIs
- Request batching where possible
- Response compression

### Metrics
- Response time tracking
- Cache hit/miss ratios
- Error rate monitoring

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify JWT token is valid
   - Check API key format
   - Ensure proper headers

2. **External API Failures**
   - Check API key configuration
   - Verify service availability
   - Review rate limits

3. **Cache Issues**
   - Clear cache if needed: `cacheService.flush()`
   - Check TTL settings
   - Monitor cache statistics

### Debug Mode

Enable debug logging:
```bash
NODE_ENV=development npm run dev
```

### Logs

Check logs in:
- Vercel dashboard (function logs)
- Supabase `unified_logs` table
- PostHog events (if configured)

## Contributing

1. Follow TypeScript best practices
2. Add tests for new features
3. Update OpenAPI spec
4. Document breaking changes
5. Use conventional commits

## License

MIT License - see LICENSE file for details.

## Support

- **Documentation**: This README and OpenAPI spec
- **Issues**: GitHub issues
- **Email**: support@ialla.app

---

**Note**: This API middlelayer is designed for production use with proper monitoring, caching, and error handling. Always test thoroughly before deploying to production.

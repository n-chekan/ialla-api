// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Health Check API Endpoint
 * GET /api/health
 */
export default async (req: VercelRequest, res: VercelResponse) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only GET requests are allowed',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      services: {
        openai: process.env.OPENAI_API_KEY ? 'configured' : 'missing',
        elevenlabs: process.env.ELEVENLABS_API_KEY ? 'configured' : 'missing',
        resend: process.env.RESEND_API_KEY ? 'configured' : 'missing',
        supabase: process.env.SUPABASE_URL ? 'configured' : 'missing'
      },
      environment: process.env.NODE_ENV || 'development'
    };

    res.status(200).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString()
    });
  }
};

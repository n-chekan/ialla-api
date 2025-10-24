// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * API Documentation Endpoint
 * GET /api/docs
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
    // Read OpenAPI spec
    const openApiSpec = readFileSync(join(process.cwd(), 'docs', 'openapi.yaml'), 'utf8');
    
    // Return OpenAPI spec
    res.setHeader('Content-Type', 'application/x-yaml');
    res.status(200).send(openApiSpec);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load API documentation',
      message: 'OpenAPI specification not found',
      timestamp: new Date().toISOString()
    });
  }
};

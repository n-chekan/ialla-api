// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../src/middleware/auth.js';
import { elevenLabsService } from '../../src/services/ElevenLabsService.js';
import { ValidationError, asyncHandler } from '../../src/utils/errors.js';

// Zod schema for voice request validation
const VoiceRequestSchema = z.object({
  text: z.string().min(1).max(5000),
  voiceId: z.string().min(1),
  settings: z.object({
    stability: z.number().min(0).max(1).optional(),
    similarity_boost: z.number().min(0).max(1).optional(),
    style: z.number().min(0).max(1).optional(),
    use_speaker_boost: z.boolean().optional()
  }).optional()
});

/**
 * ElevenLabs Voice Generation API Endpoint
 * POST /api/elevenlabs/voice
 */
export default asyncHandler(async (req: VercelRequest, res: VercelResponse, next?: Function) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'Method Not Allowed',
      message: 'Only POST requests are allowed',
      timestamp: new Date().toISOString()
    });
    return;
  }

  try {
    // Authenticate request
    const authContext = await authMiddleware.authMiddleware(req, res);
    
    // Validate request body
    const validationResult = VoiceRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid request data: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
      );
    }

    const { text, voiceId, settings } = validationResult.data;

    console.log('🔊 ElevenLabs Voice: Processing request', {
      textLength: text.length,
      voiceId,
      userId: authContext.userId
    });

    // Generate voice using ElevenLabs service
    const result = await elevenLabsService.generateVoice(text, voiceId, settings);

    // Set cache headers (voice generation is cached)
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');

    // Return successful response
    res.status(200).json({
      success: true,
      data: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ElevenLabs Voice Error:', error);
    
    // Error handling is done by asyncHandler
    throw error;
  }
});

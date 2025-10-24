// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../src/middleware/auth.js';
import { elevenLabsService } from '../../src/services/ElevenLabsService.js';
import { ValidationError, asyncHandler } from '../../src/utils/errors.js';

// Zod schema for conversation request validation
const ConversationRequestSchema = z.object({
  action: z.enum(['start_conversation', 'send_message', 'end_conversation']),
  agentId: z.string().optional(),
  message: z.string().optional(),
  conversationId: z.string().optional(),
  config: z.record(z.string(), z.any()).optional()
});

/**
 * ElevenLabs Conversation API Endpoint
 * POST /api/elevenlabs/conversation
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
    const authContext = await authMiddleware.authMiddleware(req, res, () => {});
    
    // Validate request body
    const validationResult = ConversationRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid request data: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
      );
    }

    const { action, agentId, message, conversationId, config } = validationResult.data;

    console.log('🔊 ElevenLabs Conversation: Processing request', {
      action,
      agentId,
      conversationId,
      userId: authContext.userId
    });

    let result;

    // Route to appropriate service method
    switch (action) {
      case 'start_conversation':
        if (!agentId) {
          throw new ValidationError('agentId is required for start_conversation');
        }
        result = await elevenLabsService.startConversation(agentId, config);
        break;

      case 'send_message':
        if (!conversationId || !message) {
          throw new ValidationError('conversationId and message are required for send_message');
        }
        result = await elevenLabsService.sendMessage(conversationId, message, config);
        break;

      case 'end_conversation':
        if (!conversationId) {
          throw new ValidationError('conversationId is required for end_conversation');
        }
        result = await elevenLabsService.endConversation(conversationId);
        break;

      default:
        throw new ValidationError(`Unknown action: ${action}`);
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.setHeader('Content-Type', 'application/json');

    // Return successful response
    res.status(200).json({
      success: true,
      data: result,
      action,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ ElevenLabs Conversation Error:', error);
    
    // Error handling is done by asyncHandler
    throw error;
  }
});

// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../src/middleware/auth.js';
import { openAIService } from '../../src/services/OpenAIService.js';
import { ValidationError, asyncHandler } from '../../src/utils/errors.js';
import { Message, UserProfile, StudyTopic, VocabularyContext } from '../../src/types/index.js';

// Zod schema for request validation
const AnalyzeRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().min(1),
    created_at: z.string().optional()
  })).min(1),
  userProfile: z.object({
    native_language: z.string().optional(),
    practice_languages: z.array(z.string()).optional(),
    level: z.string().optional(),
    learning_goals: z.string().optional(),
    first_name: z.string().optional(),
    interface_language: z.string().optional()
  }),
  studyTopic: z.object({
    title: z.string(),
    description: z.string().optional()
  }).optional(),
  vocabularyContext: z.object({
    word_list_title: z.string(),
    word_list_topic: z.string(),
    word_list_words: z.array(z.object({
      word: z.string(),
      translation: z.string().optional()
    }))
  }).optional()
});

/**
 * OpenAI Conversation Analysis API Endpoint
 * POST /api/openai/analyze
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
    const validationResult = AnalyzeRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid request data: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
      );
    }

    const { messages, userProfile, studyTopic, vocabularyContext } = validationResult.data;

    console.log('🔍 OpenAI Analyze: Processing request', {
      messageCount: messages.length,
      hasStudyTopic: !!studyTopic,
      hasVocabularyContext: !!vocabularyContext,
      userId: authContext.userId
    });

    // Call OpenAI service
    let analysis;
    if (vocabularyContext) {
      analysis = await openAIService.analyzeVocabularyPractice(messages, userProfile, vocabularyContext);
    } else {
      analysis = await openAIService.analyzeConversation(messages, userProfile, studyTopic);
    }

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'application/json');

    // Return successful response
    res.status(200).json({
      success: true,
      data: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ OpenAI Analyze Error:', error);
    
    // Error handling is done by asyncHandler
    throw error;
  }
});

// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../../../src/middleware/auth.js';
import { ValidationError, asyncHandler } from '../../../../src/utils/errors.js';
import { createClient } from '@supabase/supabase-js';
import { loggingService } from '../../../../src/utils/logging.js';

// Zod schema for activity log request validation
const ActivityLogRequestSchema = z.object({
  actionType: z.enum([
    'login',
    'logout', 
    'conversation_start',
    'conversation_end',
    'settings_change',
    'profile_update',
    'study_plan_action',
    'vocabulary_practice',
    'voice_interaction',
    'page_view',
    'feature_usage'
  ]),
  actionData: z.record(z.string(), z.any()).optional(),
  metadata: z.object({
    ipAddress: z.string().optional(),
    userAgent: z.string().optional(),
    sessionId: z.string().optional(),
    timestamp: z.string().datetime().optional()
  }).optional()
});

const ActivityLogResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    id: z.string(),
    userId: z.string(),
    actionType: z.string(),
    actionData: z.any().optional(),
    createdAt: z.string()
  }),
  message: z.string()
});

/**
 * User Activity Logs API Endpoint
 * POST /api/users/{userId}/activity/logs
 * GET /api/users/{userId}/activity/logs
 */
export default asyncHandler(async (req: VercelRequest, res: VercelResponse, next?: Function) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Authenticate request
    const authContext = await authMiddleware.authMiddleware(req, res, next);
    
    // Extract userId from URL parameters
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      throw new ValidationError('User ID is required');
    }

    // Validate that the authenticated user can access this user's data
    // Users can only access their own data, admins can access any user's data
    if (authContext.authMethod === 'jwt' && authContext.userId !== userId) {
      // Check if user is admin
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('user_id', authContext.userId)
        .single();
        
      if (profile?.user_role !== 'admin') {
        throw new ValidationError('Access denied: You can only access your own activity logs');
      }
    }

    if (req.method === 'POST') {
      // Create new activity log
      const validationResult = ActivityLogRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        throw new ValidationError(
          `Invalid request data: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
        );
      }

      const { actionType, actionData, metadata } = validationResult.data;

      // Create Supabase client
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      // Insert activity log
      const { data: logEntry, error } = await supabase
        .from('user_action_logs')
        .insert({
          user_id: userId,
          action_type: actionType,
          action_data: actionData || null,
          ip_address: metadata?.ipAddress || null,
          user_agent: metadata?.userAgent || null,
          session_id: metadata?.sessionId || null
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create activity log: ${error.message}`);
      }

      // Log API call for monitoring
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'activity',
        endpoint: `/api/users/${userId}/activity/logs`,
        method: 'POST',
        requestBody: { actionType, actionData, metadata },
        responseStatus: 201,
        responseBody: logEntry,
        duration: Date.now() - Date.now()
      });

      const response = {
        success: true,
        data: {
          id: logEntry.id,
          userId: logEntry.user_id,
          actionType: logEntry.action_type,
          actionData: logEntry.action_data,
          createdAt: logEntry.created_at
        },
        message: 'Activity log created successfully'
      };

      res.status(201).json(response);

    } else if (req.method === 'GET') {
      // Get user's activity logs
      const { limit = '50', offset = '0', actionType } = req.query;
      
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      let query = supabase
        .from('user_action_logs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(parseInt(limit as string))
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

      if (actionType && typeof actionType === 'string') {
        query = query.eq('action_type', actionType);
      }

      const { data: logs, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch activity logs: ${error.message}`);
      }

      // Log API call for monitoring
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'activity',
        endpoint: `/api/users/${userId}/activity/logs`,
        method: 'GET',
        requestBody: { limit, offset, actionType },
        responseStatus: 200,
        responseBody: logs,
        duration: Date.now() - Date.now()
      });

      const response = {
        success: true,
        data: logs,
        message: 'Activity logs retrieved successfully'
      };

      res.status(200).json(response);

    } else {
      res.status(405).json({
        success: false,
        message: 'Method not allowed'
      });
    }

  } catch (error: any) {
    // Error handling is done by asyncHandler
    throw error;
  }
});

// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../src/middleware/auth.js';
import { createClient } from '@supabase/supabase-js';
import { ValidationError, asyncHandler } from '../../src/utils/errors.js';

const AdminActivityLogsQuerySchema = z.object({
  limit: z.string().optional().transform(val => val ? parseInt(val) : 50),
  offset: z.string().optional().transform(val => val ? parseInt(val) : 0),
  actionType: z.string().optional(),
  userId: z.string().optional()
});

/**
 * Admin endpoint to get all users' activity logs
 * GET /api/admin/activity/logs
 */
export default asyncHandler(async (req: VercelRequest, res: VercelResponse, next?: Function) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Authenticate request
    const authContext = await authMiddleware.authMiddleware(req, res, next);
    
    // Check if user is admin
    if (authContext.authMethod !== 'jwt') {
      throw new ValidationError('Admin access required');
    }

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Verify admin role
    const { data: profile } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('user_id', authContext.userId)
      .single();
      
    if (profile?.user_role !== 'admin') {
      throw new ValidationError('Admin access required');
    }

    // Validate query parameters
    const validationResult = AdminActivityLogsQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid query parameters: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
      );
    }

    const { limit, offset, actionType, userId } = validationResult.data;

    // Build query
    let query = supabase
      .from('unified_logs')
      .select('*')
      .eq('event_category', 'user_action')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (actionType) {
      query = query.eq('event_type', actionType);
    }
    
    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      throw new ValidationError(`Database query failed: ${error.message}`);
    }

    // Transform logs to match expected format
    const transformedLogs = (data || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      actionType: log.event_type,
      actionData: log.event_data,
      metadata: log.metadata,
      createdAt: log.created_at,
      sessionId: log.session_id,
      userAgent: log.user_agent,
      ipAddress: log.ip_address
    }));

    // Get total count for pagination
    let countQuery = supabase
      .from('unified_logs')
      .select('*', { count: 'exact', head: true })
      .eq('event_category', 'user_action');

    if (actionType) {
      countQuery = countQuery.eq('event_type', actionType);
    }
    
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    }

    const { count } = await countQuery;

    res.status(200).json({
      success: true,
      data: transformedLogs,
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit
      }
    });

  } catch (error: any) {
    // Error handling is done by asyncHandler
    throw error;
  }
});

// @ts-ignore - @vercel/node types not available
import { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';
import { authMiddleware } from '../../src/middleware/auth.js';
import { resendService } from '../../src/services/ResendService.js';
import { ValidationError, asyncHandler } from '../../src/utils/errors.js';

// Zod schema for email request validation
const EmailRequestSchema = z.object({
  emailType: z.enum(['student_invitation', 'teacher_invitation', 'contact', 'welcome']),
  to: z.string().email(),
  data: z.record(z.string(), z.any())
});

/**
 * Resend Email API Endpoint
 * POST /api/resend/send
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
    const validationResult = EmailRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      throw new ValidationError(
        `Invalid request data: ${validationResult.error.issues.map((e: any) => e.message).join(', ')}`
      );
    }

    const { emailType, to, data } = validationResult.data;

    console.log('📧 Resend Send: Processing request', {
      emailType,
      to,
      userId: authContext.userId
    });

    // Send email using Resend service
    const result = await resendService.sendEmail({
      emailType,
      to,
      data
    });

    // Set cache headers (emails are not cached)
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Content-Type', 'application/json');

    // Return successful response
    res.status(200).json({
      success: true,
      data: result,
      message: 'Email sent successfully',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Resend Send Error:', error);
    
    // Error handling is done by asyncHandler
    throw error;
  }
});

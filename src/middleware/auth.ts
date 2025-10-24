import { createClient } from '@supabase/supabase-js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';
import { AuthContext } from '../types/index.js';

/**
 * Authentication middleware for API middlelayer
 * Supports hybrid authentication: JWT tokens and API keys
 */
export class AuthMiddleware {
  private supabase: any;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Authenticate request using JWT token
   */
  async authenticateJWT(authHeader: string): Promise<AuthContext> {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthenticationError('Invalid authorization header');
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser(token);

      if (error || !user) {
        throw new AuthenticationError('Invalid or expired token');
      }

      return {
        userId: user.id,
        email: user.email || '',
        authMethod: 'jwt'
      };
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Token validation failed');
    }
  }

  /**
   * Authenticate request using API key
   */
  async authenticateAPIKey(apiKey: string): Promise<AuthContext> {
    const validAPIKey = process.env.API_SECRET_KEY;

    if (!validAPIKey) {
      throw new AuthenticationError('API key authentication not configured');
    }

    if (apiKey !== validAPIKey) {
      throw new AuthenticationError('Invalid API key');
    }

    return {
      userId: 'system',
      email: 'system@ialla.app',
      authMethod: 'api_key'
    };
  }

  /**
   * Determine authentication method and authenticate
   */
  async authenticate(req: any): Promise<AuthContext> {
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'];

    // Try JWT authentication first
    if (authHeader) {
      return await this.authenticateJWT(authHeader);
    }

    // Try API key authentication
    if (apiKey) {
      return await this.authenticateAPIKey(apiKey);
    }

    throw new AuthenticationError('No authentication provided');
  }

  /**
   * Middleware function for Vercel serverless functions
   */
  async authMiddleware(req: any, res: any, next?: Function): Promise<AuthContext> {
    try {
      const authContext = await this.authenticate(req);
      
      // Attach auth context to request
      req.auth = authContext;
      
      if (next) {
        next();
      }
      
      return authContext;
    } catch (error) {
      const statusCode = error instanceof AuthenticationError ? 401 : 500;
      const message = error instanceof Error ? error.message : 'Authentication failed';
      
      res.status(statusCode).json({
        error: 'Authentication Error',
        message,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Check if user has required permissions
   */
  async checkPermissions(authContext: AuthContext, requiredPermissions: string[] = []): Promise<void> {
    // For now, all authenticated users have access
    // This can be extended to check user roles/permissions from database
    if (!authContext.userId) {
      throw new AuthorizationError('User context required');
    }

    // Future: Implement role-based access control
    // const userRoles = await this.getUserRoles(authContext.userId);
    // const hasPermission = requiredPermissions.every(permission => 
    //   userRoles.includes(permission)
    // );
    // 
    // if (!hasPermission) {
    //   throw new AuthorizationError('Insufficient permissions');
    // }
  }

  /**
   * Get user information from database
   */
  async getUserInfo(userId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('⚠️ Failed to fetch user info:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.warn('⚠️ Error fetching user info:', error);
      return null;
    }
  }

  /**
   * Validate request for specific service
   */
  validateServiceAccess(authContext: AuthContext, service: string): void {
    // System API key has access to all services
    if (authContext.authMethod === 'api_key') {
      return;
    }

    // JWT users have access to all services for now
    // This can be extended to check service-specific permissions
    if (authContext.authMethod === 'jwt') {
      return;
    }

    throw new AuthorizationError(`Access denied to service: ${service}`);
  }
}

// Export singleton instance
export const authMiddleware = new AuthMiddleware();
export default authMiddleware;

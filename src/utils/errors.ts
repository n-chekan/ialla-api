import { ErrorResponse } from '../types/index.js';

/**
 * Custom error classes for API middlelayer
 */
export class ValidationError extends Error {
  public readonly statusCode = 400;
  public readonly code = 'VALIDATION_ERROR';

  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends Error {
  public readonly statusCode = 401;
  public readonly code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error {
  public readonly statusCode = 403;
  public readonly code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ExternalAPIError extends Error {
  public readonly statusCode = 502;
  public readonly code = 'EXTERNAL_API_ERROR';

  constructor(
    message: string,
    public readonly service: string,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'ExternalAPIError';
  }
}

export class RateLimitError extends Error {
  public readonly statusCode = 429;
  public readonly code = 'RATE_LIMIT_EXCEEDED';

  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class InternalServerError extends Error {
  public readonly statusCode = 500;
  public readonly code = 'INTERNAL_SERVER_ERROR';

  constructor(message: string = 'Internal server error') {
    super(message);
    this.name = 'InternalServerError';
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  /**
   * Create standardized error response
   */
  static createErrorResponse(error: Error): ErrorResponse {
    const timestamp = new Date().toISOString();
    
    // Handle custom error types
    if (error instanceof ValidationError) {
      return {
        error: 'Validation Error',
        message: error.message,
        code: error.code,
        timestamp
      };
    }

    if (error instanceof AuthenticationError) {
      return {
        error: 'Authentication Error',
        message: error.message,
        code: error.code,
        timestamp
      };
    }

    if (error instanceof AuthorizationError) {
      return {
        error: 'Authorization Error',
        message: error.message,
        code: error.code,
        timestamp
      };
    }

    if (error instanceof NotFoundError) {
      return {
        error: 'Not Found',
        message: error.message,
        code: error.code,
        timestamp
      };
    }

    if (error instanceof ExternalAPIError) {
      return {
        error: 'External API Error',
        message: `${error.service}: ${error.message}`,
        code: error.code,
        timestamp
      };
    }

    if (error instanceof RateLimitError) {
      return {
        error: 'Rate Limit Exceeded',
        message: error.message,
        code: error.code,
        timestamp
      };
    }

    // Default internal server error
    return {
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message,
      code: 'INTERNAL_SERVER_ERROR',
      timestamp
    };
  }

  /**
   * Get HTTP status code from error
   */
  static getStatusCode(error: Error): number {
    if (error instanceof ValidationError) return 400;
    if (error instanceof AuthenticationError) return 401;
    if (error instanceof AuthorizationError) return 403;
    if (error instanceof NotFoundError) return 404;
    if (error instanceof RateLimitError) return 429;
    if (error instanceof ExternalAPIError) return 502;
    return 500;
  }

  /**
   * Check if error is retryable
   */
  static isRetryable(error: Error): boolean {
    if (error instanceof RateLimitError) return true;
    if (error instanceof ExternalAPIError) return true;
    if (error instanceof InternalServerError) return true;
    return false;
  }

  /**
   * Log error with context
   */
  static async logError(error: Error, context: Record<string, any> = {}): Promise<void> {
    const { loggingService } = await import('./logging.js');
    
    await loggingService.logError(error, {
      ...context,
      errorType: error.constructor.name,
      statusCode: this.getStatusCode(error),
      isRetryable: this.isRetryable(error)
    });
  }

  /**
   * Handle and format error for API response
   */
  static async handleError(error: Error, context: Record<string, any> = {}): Promise<{
    statusCode: number;
    body: ErrorResponse;
  }> {
    // Log the error
    await this.logError(error, context);

    // Create error response
    const errorResponse = this.createErrorResponse(error);
    const statusCode = this.getStatusCode(error);

    return {
      statusCode,
      body: errorResponse
    };
  }
}

/**
 * Async error wrapper for API routes
 */
export function asyncHandler(fn: Function) {
  return async (req: any, res: any, next?: Function) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      const { statusCode, body } = await ErrorHandler.handleError(error as Error, {
        endpoint: req.url,
        method: req.method,
        userAgent: req.headers['user-agent']
      });

      res.status(statusCode).json(body);
    }
  };
}

/**
 * Validation helper
 */
export function validateRequired(value: any, fieldName: string): void {
  if (value === undefined || value === null || value === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }
}

/**
 * Type guard for error types
 */
export function isAPIError(error: any): error is ValidationError | AuthenticationError | AuthorizationError | NotFoundError | ExternalAPIError | RateLimitError {
  return error instanceof ValidationError ||
         error instanceof AuthenticationError ||
         error instanceof AuthorizationError ||
         error instanceof NotFoundError ||
         error instanceof ExternalAPIError ||
         error instanceof RateLimitError;
}

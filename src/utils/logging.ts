import { createClient } from '@supabase/supabase-js';
import { LogEntry, ConversationEvent } from '../types/index.js';

/**
 * Logging utility for API middlelayer
 * Ported from supabase/functions/_shared/logging.ts
 */
class LoggingService {
  private supabase: any;
  private sessionId!: string;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('⚠️ Supabase configuration missing - logging disabled');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
    this.sessionId = this.generateSessionId();
  }

  /**
   * Generate unique session ID
   */
  generateSessionId(): string {
    return `api_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
   * Log API call to Supabase unified_logs table
   */
  async logApiCall(logData: Partial<LogEntry>): Promise<void> {
    if (!this.supabase) {
      console.log('📝 Logging disabled - Supabase not configured');
      return;
    }

    try {
      const logEntry: LogEntry = {
        sessionId: this.sessionId,
        serviceName: logData.serviceName || 'unknown',
        endpoint: logData.endpoint || '',
        method: logData.method || 'GET',
        requestHeaders: logData.requestHeaders,
        requestBody: logData.requestBody,
        responseStatus: logData.responseStatus,
        responseHeaders: logData.responseHeaders,
        responseBody: logData.responseBody,
        duration: logData.duration,
        errorMessage: logData.errorMessage,
        timestamp: new Date().toISOString(),
        ...logData
      };

      const { error } = await this.supabase
        .from('unified_logs')
        .insert({
          event_category: 'api_call',
          event_type: 'external_api',
          user_id: null, // Will be set by client if available
          event_data: {
            session_id: logEntry.sessionId,
            service_name: logEntry.serviceName,
            endpoint: logEntry.endpoint,
            method: logEntry.method,
            request_headers: logEntry.requestHeaders,
            request_body: logEntry.requestBody,
            response_status: logEntry.responseStatus,
            response_headers: logEntry.responseHeaders,
            response_body: logEntry.responseBody,
            duration: logEntry.duration,
            error_message: logEntry.errorMessage
          },
          metadata: {
            timestamp: logEntry.timestamp,
            api_middlelayer: true
          }
        });

      if (error) {
        console.error('❌ Failed to log API call:', error);
      } else {
        console.log('✅ API call logged successfully');
      }
    } catch (error) {
      console.error('❌ Logging service error:', error);
    }
  }

  /**
   * Log conversation event
   */
  async logConversationEvent(eventData: ConversationEvent): Promise<void> {
    if (!this.supabase) {
      console.log('📝 Logging disabled - Supabase not configured');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('unified_logs')
        .insert({
          event_category: 'conversation',
          event_type: eventData.logType,
          user_id: eventData.userId,
          conversation_id: eventData.conversationId,
          event_data: {
            service_name: eventData.serviceName,
            log_type: eventData.logType,
            ...eventData.eventData
          },
          metadata: {
            ...eventData.metadata,
            api_middlelayer: true
          }
        });

      if (error) {
        console.error('❌ Failed to log conversation event:', error);
      } else {
        console.log('✅ Conversation event logged successfully');
      }
    } catch (error) {
      console.error('❌ Conversation logging error:', error);
    }
  }

  /**
   * Log error with context
   */
  async logError(error: Error, context: Record<string, any> = {}): Promise<void> {
    if (!this.supabase) {
      console.error('❌ Error logging disabled - Supabase not configured');
      return;
    }

    try {
      const { error: logError } = await this.supabase
        .from('unified_logs')
        .insert({
          event_category: 'error',
          event_type: 'api_error',
          user_id: context.userId || null,
          event_data: {
            error_message: error.message,
            error_stack: error.stack,
            error_name: error.name,
            ...context
          },
          metadata: {
            timestamp: new Date().toISOString(),
            api_middlelayer: true
          }
        });

      if (logError) {
        console.error('❌ Failed to log error:', logError);
      }
    } catch (logErr) {
      console.error('❌ Error logging failed:', logErr);
    }
  }

  /**
   * Log performance metrics
   */
  async logPerformance(serviceName: string, operation: string, duration: number, metadata: Record<string, any> = {}): Promise<void> {
    if (!this.supabase) {
      console.log('📊 Performance logging disabled - Supabase not configured');
      return;
    }

    try {
      const { error } = await this.supabase
        .from('unified_logs')
        .insert({
          event_category: 'performance',
          event_type: 'api_performance',
          user_id: metadata.userId || null,
          event_data: {
            service_name: serviceName,
            operation,
            duration,
            ...metadata
          },
          metadata: {
            timestamp: new Date().toISOString(),
            api_middlelayer: true
          }
        });

      if (error) {
        console.error('❌ Failed to log performance:', error);
      }
    } catch (error) {
      console.error('❌ Performance logging error:', error);
    }
  }

  /**
   * Log cache operations
   */
  async logCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string, serviceName: string): Promise<void> {
    console.log(`🗄️ Cache ${operation}: ${key} (${serviceName})`);
    
    // Optional: Log to Supabase for analytics
    if (this.supabase) {
      try {
        await this.supabase
          .from('unified_logs')
          .insert({
            event_category: 'cache',
            event_type: `cache_${operation}`,
            event_data: {
              cache_key: key,
              service_name: serviceName,
              operation
            },
            metadata: {
              timestamp: new Date().toISOString(),
              api_middlelayer: true
            }
          });
      } catch (error) {
        // Don't fail on cache logging errors
        console.warn('⚠️ Cache logging failed:', error);
      }
    }
  }
}

// Export singleton instance
export const loggingService = new LoggingService();
export default loggingService;

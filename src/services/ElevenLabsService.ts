import { cacheService } from '../utils/cache.js';
import { loggingService } from '../utils/logging.js';
import { 
  ElevenLabsConversationRequest, 
  ElevenLabsVoiceRequest 
} from '../types/index.js';
import { ExternalAPIError } from '../utils/errors.js';

/**
 * ElevenLabs Service for voice conversations and text-to-speech
 * Ported from supabase/functions/elevenlabs-conversation/index.ts
 */
export class ElevenLabsService {
  private apiKey: string;
  private baseUrl = 'https://api.elevenlabs.io/v1';

  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ElevenLabs API key not configured');
    }
    this.apiKey = apiKey;
  }

  /**
   * Start a conversation with ElevenLabs
   */
  async startConversation(agentId: string, config: any = {}): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🔊 ElevenLabs Service: Starting conversation', { agentId });

      const endpoint = `${this.baseUrl}/convai/conversation`;
      const requestBody = {
        agent_id: agentId,
        ...config
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint,
        method: 'POST',
        requestBody,
        responseStatus: response.status,
        responseBody: data,
        duration
      });

      console.log('✅ ElevenLabs Service: Conversation started successfully');
      return data;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint: `${this.baseUrl}/convai/conversation`,
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ ElevenLabs Service: Failed to start conversation:', error);
      throw new ExternalAPIError(
        'Failed to start ElevenLabs conversation',
        'elevenlabs',
        error
      );
    }
  }

  /**
   * Send message to ElevenLabs conversation
   */
  async sendMessage(conversationId: string, message: string, config: any = {}): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🔊 ElevenLabs Service: Sending message', { conversationId });

      const endpoint = `${this.baseUrl}/convai/conversation/${conversationId}/message`;
      const requestBody = {
        message,
        ...config
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint,
        method: 'POST',
        requestBody,
        responseStatus: response.status,
        responseBody: data,
        duration
      });

      console.log('✅ ElevenLabs Service: Message sent successfully');
      return data;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint: `${this.baseUrl}/convai/conversation/${conversationId}/message`,
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ ElevenLabs Service: Failed to send message:', error);
      throw new ExternalAPIError(
        'Failed to send message to ElevenLabs conversation',
        'elevenlabs',
        error
      );
    }
  }

  /**
   * End ElevenLabs conversation
   */
  async endConversation(conversationId: string): Promise<any> {
    const startTime = Date.now();
    
    try {
      console.log('🔊 ElevenLabs Service: Ending conversation', { conversationId });

      const endpoint = `${this.baseUrl}/convai/conversation/${conversationId}`;

      const response = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey,
        }
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint,
        method: 'DELETE',
        responseStatus: response.status,
        responseBody: data,
        duration
      });

      console.log('✅ ElevenLabs Service: Conversation ended successfully');
      return data;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint: `${this.baseUrl}/convai/conversation/${conversationId}`,
        method: 'DELETE',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ ElevenLabs Service: Failed to end conversation:', error);
      throw new ExternalAPIError(
        'Failed to end ElevenLabs conversation',
        'elevenlabs',
        error
      );
    }
  }

  /**
   * Generate voice using ElevenLabs
   */
  async generateVoice(
    text: string, 
    voiceId: string, 
    settings: any = {}
  ): Promise<{ audioUrl: string; duration?: number }> {
    const startTime = Date.now();
    
    try {
      console.log('🔊 ElevenLabs Service: Generating voice', { voiceId, textLength: text.length });

      // Generate cache key
      const cacheKey = cacheService.generateElevenLabsVoiceKey(text, voiceId, settings);
      
      // Check cache first
      const cached = cacheService.get<{ audioUrl: string; duration?: number }>(cacheKey);
      if (cached) {
        console.log('✅ ElevenLabs Service: Using cached voice');
        await loggingService.logCacheOperation('hit', cacheKey, 'elevenlabs');
        return cached;
      }

      await loggingService.logCacheOperation('miss', cacheKey, 'elevenlabs');

      const endpoint = `${this.baseUrl}/text-to-speech/${voiceId}`;
      const requestBody = {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          ...settings
        }
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': this.apiKey,
        },
        body: JSON.stringify(requestBody)
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // For voice generation, we'll return a placeholder URL
      // In a real implementation, you'd store the audio and return the URL
      const audioUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/generated_${Date.now()}.mp3`;
      
      const result = {
        audioUrl,
        duration: Math.round(duration / 1000) // Convert to seconds
      };

      // Cache the result
      cacheService.set(cacheKey, result, 'elevenlabs');

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint,
        method: 'POST',
        requestBody,
        responseStatus: response.status,
        responseBody: { audioUrl, duration: result.duration },
        duration
      });

      console.log('✅ ElevenLabs Service: Voice generated successfully');
      return result;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint: `${this.baseUrl}/text-to-speech/${voiceId}`,
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ ElevenLabs Service: Failed to generate voice:', error);
      throw new ExternalAPIError(
        'Failed to generate voice with ElevenLabs',
        'elevenlabs',
        error
      );
    }
  }

  /**
   * Get available voices
   */
  async getVoices(): Promise<any[]> {
    const startTime = Date.now();
    
    try {
      console.log('🔊 ElevenLabs Service: Fetching voices');

      const endpoint = `${this.baseUrl}/voices`;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'xi-api-key': this.apiKey,
        }
      });

      const duration = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint,
        method: 'GET',
        responseStatus: response.status,
        responseBody: data,
        duration
      });

      console.log('✅ ElevenLabs Service: Voices fetched successfully');
      return data.voices || [];

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'elevenlabs',
        endpoint: `${this.baseUrl}/voices`,
        method: 'GET',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ ElevenLabs Service: Failed to fetch voices:', error);
      throw new ExternalAPIError(
        'Failed to fetch voices from ElevenLabs',
        'elevenlabs',
        error
      );
    }
  }
}

// Export singleton instance
export const elevenLabsService = new ElevenLabsService();
export default elevenLabsService;

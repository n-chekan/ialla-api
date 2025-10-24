// @ts-ignore - node-cache types not available
import NodeCache from 'node-cache';
import { CacheConfig, CacheEntry } from '../types/index.js';

/**
 * Cache utility for API middlelayer
 * Provides in-memory caching with configurable TTLs per service
 */
class CacheService {
  private cache: NodeCache;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly serviceTTLs = {
    openai: 7200,      // 2 hours
    elevenlabs: 3600,  // 1 hour
    user_profiles: 1800, // 30 minutes
    email_templates: 86400, // 24 hours
  };

  constructor() {
    this.cache = new NodeCache({
      stdTTL: this.defaultTTL,
      checkperiod: 600, // Check for expired keys every 10 minutes
      useClones: false, // Better performance
    });
  }

  /**
   * Get cached data by key
   */
  get<T>(key: string): T | undefined {
    return this.cache.get<T>(key);
  }

  /**
   * Set cached data with service-specific TTL
   */
  set<T>(key: string, data: T, service?: keyof typeof this.serviceTTLs): boolean {
    const ttl = service ? this.serviceTTLs[service] : this.defaultTTL;
    return this.cache.set(key, data, ttl);
  }

  /**
   * Set cached data with custom TTL
   */
  setWithTTL<T>(key: string, data: T, ttl: number): boolean {
    return this.cache.set(key, data, ttl);
  }

  /**
   * Delete cached data by key
   */
  del(key: string): boolean {
    return this.cache.del(key);
  }

  /**
   * Invalidate cache by pattern
   */
  invalidatePattern(pattern: string): number {
    const keys = this.cache.keys();
    const regex = new RegExp(pattern);
    let deletedCount = 0;

  keys.forEach((key: string) => {
    if (regex.test(key)) {
      if (this.cache.del(key)) {
        deletedCount++;
      }
    }
  });

    return deletedCount;
  }

  /**
   * Clear all cached data
   */
  flush(): void {
    this.cache.flushAll();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Generate cache key for OpenAI analysis
   */
  generateOpenAIKey(messages: any[], userProfile: any, studyTopic?: any, vocabularyContext?: any): string {
    const content = JSON.stringify({
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      userProfile,
      studyTopic,
      vocabularyContext
    });
    return `openai:${this.hashString(content)}`;
  }

  /**
   * Generate cache key for ElevenLabs voice
   */
  generateElevenLabsVoiceKey(text: string, voiceId: string, settings?: any): string {
    const content = JSON.stringify({ text, voiceId, settings });
    return `elevenlabs:voice:${this.hashString(content)}`;
  }

  /**
   * Generate cache key for user profile
   */
  generateUserProfileKey(userId: string): string {
    return `user_profile:${userId}`;
  }

  /**
   * Generate cache key for email template
   */
  generateEmailTemplateKey(templateType: string, language: string): string {
    return `email_template:${templateType}:${language}`;
  }

  /**
   * Simple hash function for consistent key generation
   */
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    return this.cache.has(key);
  }

  /**
   * Get TTL for a key
   */
  getTTL(key: string): number {
    return this.cache.getTtl(key);
  }

  /**
   * Get all keys
   */
  keys(): string[] {
    return this.cache.keys();
  }
}

// Export singleton instance
export const cacheService = new CacheService();
export default cacheService;

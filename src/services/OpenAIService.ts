// @ts-ignore - openai types not available
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { cacheService } from '../utils/cache.js';
import { loggingService } from '../utils/logging.js';
import { 
  Message, 
  UserProfile, 
  StudyTopic, 
  VocabularyContext, 
  ConversationAnalysis,
  AnalysisPrompt,
  PromptContext
} from '../types/index.js';
import { ExternalAPIError } from '../utils/errors.js';

/**
 * OpenAI Service for conversation analysis
 * Ported from supabase/functions/analyze-conversation-v2/index.ts
 */
export class OpenAIService {
  private openai: OpenAI;
  private supabase: any;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    this.openai = new OpenAI({ apiKey });

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  /**
   * Analyze conversation using OpenAI
   */
  async analyzeConversation(
    messages: Message[],
    userProfile: UserProfile,
    studyTopic?: StudyTopic
  ): Promise<ConversationAnalysis> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 OpenAI Service: Analyzing conversation');

      // Generate cache key
      const cacheKey = cacheService.generateOpenAIKey(messages, userProfile, studyTopic);
      
      // Check cache first
      const cached = cacheService.get<ConversationAnalysis>(cacheKey);
      if (cached) {
        console.log('✅ OpenAI Service: Using cached analysis');
        await loggingService.logCacheOperation('hit', cacheKey, 'openai');
        return cached;
      }

      await loggingService.logCacheOperation('miss', cacheKey, 'openai');

      // Determine conversation type
      const conversationType = 'general';
      const languageCode = userProfile?.interface_language || 'en';

      // Get active prompt from database
      const prompt = await this.getActivePrompt(conversationType, languageCode);
      if (!prompt) {
        throw new Error(`No active prompt found for conversation type: ${conversationType}, language: ${languageCode}`);
      }

      console.log(`📝 Using prompt: ${prompt.prompt_name} v${prompt.prompt_version}`);

      // Format conversation for analysis
      const conversationText = messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      // Build study topic context if available
      const studyTopicContext = studyTopic 
        ? `\n\nSTUDY TOPIC CONTEXT:\nThe conversation was focused on: "${studyTopic.title}"\n${studyTopic.description ? `Description: ${studyTopic.description}` : ''}`
        : '';

      // Prepare prompt context
      const promptContext: PromptContext = {
        native_language: userProfile?.native_language || 'Not specified',
        practice_languages: userProfile?.practice_languages || ['Not specified'],
        level: userProfile?.level || 'Not specified',
        learning_goals: userProfile?.learning_goals || 'Not specified',
        interface_language: userProfile?.interface_language || 'en',
        first_name: userProfile?.first_name || 'User',
        study_topic_context: studyTopicContext,
        conversation_text: conversationText
      };

      // Generate the final prompt using variable substitution
      const generatedPrompt = this.generatePrompt(prompt.prompt_template, promptContext);

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert language learning analyst. Analyze conversations and provide structured insights for personalized learning. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: generatedPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const duration = Date.now() - startTime;
      const analysisText = response.choices[0]?.message?.content;

      if (!analysisText) {
        throw new Error('No analysis received from OpenAI');
      }

      // Parse the analysis response
      const analysis = this.parseAnalysisResponse(analysisText);

      // Cache the successful response
      cacheService.set(cacheKey, analysis, 'openai');

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        responseStatus: 200,
        duration,
        requestBody: {
          model: 'gpt-4o-mini',
          messageCount: messages.length,
          hasStudyTopic: !!studyTopic
        },
        responseBody: { analysis: 'success' }
      });

      console.log('✅ OpenAI Service: Analysis completed successfully');
      return analysis;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ OpenAI Service: Analysis failed:', error);
      
      // Return fallback analysis
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Analyze vocabulary practice conversation
   */
  async analyzeVocabularyPractice(
    messages: Message[],
    userProfile: UserProfile,
    vocabularyContext: VocabularyContext
  ): Promise<ConversationAnalysis> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 OpenAI Service: Analyzing vocabulary practice conversation');

      // Generate cache key
      const cacheKey = cacheService.generateOpenAIKey(messages, userProfile, undefined, vocabularyContext);
      
      // Check cache first
      const cached = cacheService.get<ConversationAnalysis>(cacheKey);
      if (cached) {
        console.log('✅ OpenAI Service: Using cached vocabulary analysis');
        await loggingService.logCacheOperation('hit', cacheKey, 'openai');
        return cached;
      }

      await loggingService.logCacheOperation('miss', cacheKey, 'openai');

      // Determine conversation type
      const conversationType = 'vocabulary_practice';
      const languageCode = userProfile?.interface_language || 'en';

      // Get active prompt from database
      const prompt = await this.getActivePrompt(conversationType, languageCode);
      if (!prompt) {
        throw new Error(`No active prompt found for conversation type: ${conversationType}, language: ${languageCode}`);
      }

      // Format conversation for analysis
      const conversationText = messages
        .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
        .join('\n\n');

      // Build vocabulary context
      const vocabularyContextText = `\n\nVOCABULARY CONTEXT:\n- Word List: ${vocabularyContext.word_list_title}\n- Topic: ${vocabularyContext.word_list_topic}\n- Words: ${vocabularyContext.word_list_words.map(w => w.word).join(', ')}`;

      // Prepare prompt context
      const promptContext: PromptContext = {
        native_language: userProfile?.native_language || 'Not specified',
        practice_languages: userProfile?.practice_languages || ['Not specified'],
        level: userProfile?.level || 'Not specified',
        learning_goals: userProfile?.learning_goals || 'Not specified',
        interface_language: userProfile?.interface_language || 'en',
        first_name: userProfile?.first_name || 'User',
        conversation_text: conversationText,
        word_list_title: vocabularyContext.word_list_title,
        word_list_topic: vocabularyContext.word_list_topic,
        vocabulary_words: vocabularyContext.word_list_words.map(w => w.word).join(', ')
      };

      // Generate the final prompt
      const generatedPrompt = this.generatePrompt(prompt.prompt_template, promptContext);

      // Call OpenAI API
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert language learning analyst. Analyze vocabulary practice conversations and provide structured insights. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: generatedPrompt
          }
        ],
        temperature: 0.3,
        max_tokens: 2000
      });

      const duration = Date.now() - startTime;
      const analysisText = response.choices[0]?.message?.content;

      if (!analysisText) {
        throw new Error('No analysis received from OpenAI');
      }

      // Parse the analysis response
      const analysis = this.parseAnalysisResponse(analysisText);

      // Cache the successful response
      cacheService.set(cacheKey, analysis, 'openai');

      // Log the API call
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        responseStatus: 200,
        duration,
        requestBody: {
          model: 'gpt-4o-mini',
          messageCount: messages.length,
          hasVocabularyContext: true
        },
        responseBody: { analysis: 'success' }
      });

      console.log('✅ OpenAI Service: Vocabulary analysis completed successfully');
      return analysis;

    } catch (error) {
      const duration = Date.now() - startTime;
      
      await loggingService.logApiCall({
        sessionId: loggingService.getSessionId(),
        serviceName: 'openai',
        endpoint: 'https://api.openai.com/v1/chat/completions',
        method: 'POST',
        responseStatus: 500,
        duration,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });

      console.error('❌ OpenAI Service: Vocabulary analysis failed:', error);
      
      // Return fallback analysis
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Get active prompt from database
   */
  private async getActivePrompt(conversationType: string, languageCode: string): Promise<AnalysisPrompt | null> {
    try {
      const { data: prompt, error } = await this.supabase
        .from('analysis_prompts')
        .select('*')
        .eq('conversation_type', conversationType)
        .eq('language_code', languageCode)
        .eq('is_active', true)
        .single();

      if (error) {
        console.error('❌ Error fetching analysis prompt:', error);
        return null;
      }

      return prompt;
    } catch (error) {
      console.error('❌ Error in getActivePrompt:', error);
      return null;
    }
  }

  /**
   * Generate prompt with variable substitution
   */
  private generatePrompt(template: string, context: PromptContext): string {
    let generatedPrompt = template;

    // Replace all variables in the template
    const variables = [
      'native_language', 'practice_languages', 'level', 'learning_goals',
      'interface_language', 'first_name', 'study_topic_context',
      'conversation_text', 'word_list_title', 'word_list_topic', 'vocabulary_words'
    ];

    for (const variable of variables) {
      const placeholder = `{{${variable}}}`;
      const value = this.getContextValue(context, variable);
      generatedPrompt = generatedPrompt.replace(new RegExp(placeholder, 'g'), value || '');
    }

    // Clean up any remaining empty variables
    generatedPrompt = generatedPrompt.replace(/\{\{[^}]+\}\}/g, '');

    return generatedPrompt;
  }

  /**
   * Get context value for variable substitution
   */
  private getContextValue(context: PromptContext, variable: string): string {
    switch (variable) {
      case 'native_language':
        return context.native_language || 'Not specified';
      case 'practice_languages':
        return context.practice_languages?.join(', ') || 'Not specified';
      case 'level':
        return context.level || 'Not specified';
      case 'learning_goals':
        return context.learning_goals || 'Not specified';
      case 'interface_language':
        return context.interface_language || 'en';
      case 'first_name':
        return context.first_name || 'User';
      case 'study_topic_context':
        return context.study_topic_context || '';
      case 'conversation_text':
        return context.conversation_text || '';
      case 'word_list_title':
        return context.word_list_title || '';
      case 'word_list_topic':
        return context.word_list_topic || '';
      case 'vocabulary_words':
        return context.vocabulary_words || '';
      default:
        console.warn(`⚠️ Unknown variable: ${variable}`);
        return '';
    }
  }

  /**
   * Parse analysis response from OpenAI
   */
  private parseAnalysisResponse(responseText: string): ConversationAnalysis {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      // Validate and provide defaults
      return {
        summary: analysis.summary || 'No summary available',
        keyTopics: Array.isArray(analysis.keyTopics) ? analysis.keyTopics : [],
        userInsights: {
          languageLevel: analysis.userInsights?.languageLevel || 'Unknown',
          commonMistakes: Array.isArray(analysis.userInsights?.commonMistakes) 
            ? analysis.userInsights.commonMistakes : [],
          interests: Array.isArray(analysis.userInsights?.interests) 
            ? analysis.userInsights.interests : [],
          learningStyle: analysis.userInsights?.learningStyle || 'practical',
          strengths: Array.isArray(analysis.userInsights?.strengths) 
            ? analysis.userInsights.strengths : [],
          areasForImprovement: Array.isArray(analysis.userInsights?.areasForImprovement) 
            ? analysis.userInsights.areasForImprovement : []
        },
        conversationType: analysis.conversationType || 'general',
        learningProgress: {
          vocabularyProgress: analysis.learningProgress?.vocabularyProgress || 'Not assessed',
          grammarProgress: analysis.learningProgress?.grammarProgress || 'Not assessed',
          fluencyProgress: analysis.learningProgress?.fluencyProgress || 'Not assessed'
        }
      };
    } catch (error) {
      console.error('Error parsing OpenAI analysis response:', error);
      return this.getFallbackAnalysis();
    }
  }

  /**
   * Get fallback analysis when OpenAI fails
   */
  private getFallbackAnalysis(): ConversationAnalysis {
    return {
      summary: 'Conversation analysis failed - using fallback summary',
      keyTopics: ['conversation', 'language practice'],
      userInsights: {
        languageLevel: 'Unknown',
        commonMistakes: [],
        interests: [],
        learningStyle: 'practical',
        strengths: [],
        areasForImprovement: []
      },
      conversationType: 'general',
      learningProgress: {
        vocabularyProgress: 'Not assessed',
        grammarProgress: 'Not assessed',
        fluencyProgress: 'Not assessed'
      }
    };
  }
}

// Export singleton instance
export const openAIService = new OpenAIService();
export default openAIService;

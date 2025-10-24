/**
 * Type definitions for Ialla API Middlelayer
 * Ported from existing codebase interfaces
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
}

export interface UserProfile {
  native_language?: string;
  practice_languages?: string[];
  level?: string;
  learning_goals?: string;
  first_name?: string;
  interface_language?: string;
}

export interface ConversationAnalysis {
  summary: string;
  keyTopics: string[];
  userInsights: {
    languageLevel: string;
    commonMistakes: string[];
    interests: string[];
    learningStyle: string;
    strengths: string[];
    areasForImprovement: string[];
  };
  conversationType: 'study_plan' | 'general' | 'practice' | 'vocabulary_practice';
  learningProgress: {
    vocabularyProgress: string;
    grammarProgress: string;
    fluencyProgress: string;
  };
}

export interface StudyTopic {
  title: string;
  description?: string;
}

export interface VocabularyContext {
  word_list_title: string;
  word_list_topic: string;
  word_list_words: Array<{ word: string; translation?: string }>;
}

export interface AnalysisPrompt {
  id: string;
  prompt_name: string;
  prompt_version: string;
  conversation_type: string;
  language_code: string;
  prompt_template: string;
  variables: string[];
  description?: string;
  is_active: boolean;
}

export interface PromptContext {
  native_language?: string;
  practice_languages?: string[];
  level?: string;
  learning_goals?: string;
  interface_language?: string;
  first_name?: string;
  study_topic_context?: string;
  conversation_text?: string;
  word_list_title?: string;
  word_list_topic?: string;
  vocabulary_words?: string;
}

// ElevenLabs Types
export interface ElevenLabsConversationRequest {
  action: 'start_conversation' | 'send_message' | 'end_conversation';
  agentId?: string;
  message?: string;
  conversationId?: string;
}

export interface ElevenLabsVoiceRequest {
  text: string;
  voiceId: string;
  settings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
}

// Resend Email Types
export interface EmailData {
  emailType: 'student_invitation' | 'teacher_invitation' | 'contact' | 'welcome';
  to: string;
  data: Record<string, any>;
}

export interface StudentInvitationData {
  studentName: string;
  teacherName: string;
  invitationLink: string;
  language: string;
}

export interface TeacherInvitationData {
  teacherName: string;
  studentName: string;
  invitationLink: string;
  language: string;
}

export interface ContactData {
  name: string;
  email: string;
  message: string;
  subject?: string;
}

export interface WelcomeData {
  userName: string;
  language: string;
  dashboardLink: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
  timestamp: string;
}

// Authentication Types
export interface AuthContext {
  userId: string;
  email: string;
  authMethod: 'jwt' | 'api_key';
}

// Cache Types
export interface CacheConfig {
  ttl: number;
  checkperiod: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Logging Types
export interface LogEntry {
  sessionId: string;
  serviceName: string;
  endpoint: string;
  method: string;
  requestHeaders?: Record<string, string>;
  requestBody?: any;
  responseStatus?: number;
  responseHeaders?: Record<string, string>;
  responseBody?: any;
  duration?: number;
  errorMessage?: string;
  timestamp: string;
}

export interface ConversationEvent {
  userId: string;
  conversationId?: string;
  logType: 'session_start' | 'message_exchange' | 'session_end' | 'analysis';
  serviceName: string;
  eventData: Record<string, any>;
  metadata: Record<string, any>;
}

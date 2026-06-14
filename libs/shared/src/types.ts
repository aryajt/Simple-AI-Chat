export enum MessageRole {
  USER = 'user',
  ASSISTANT = 'assistant',
}

export interface AiRequestPayload {
  conversationId: string;
  content: string;
}

export interface AiResponsePayload {
  conversationId: string;
  content: string;
}

export type LogLevel = 'log' | 'warn' | 'error' | 'debug' | 'verbose';

export interface LogPayload {
  service: string;
  level: LogLevel;
  message: string;
  context?: string;
  timestamp: string;
  meta?: Record<string, unknown>;
}

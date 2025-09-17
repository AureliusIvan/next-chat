import { z } from 'zod';

// Tool execution parameter schema
export const greetToolSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

export type GreetToolParams = z.infer<typeof greetToolSchema>;

// Agent tool interface
export interface AgentTool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (params: any) => Promise<string> | string;
}

// Agent configuration interface
export interface AgentConfig {
  tools: AgentTool[];
  model: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

// Agent instance interface
export interface AgentInstance {
  run: (message: string) => Promise<AgentResponse>;
  tools: any[]; // Flexible type to accommodate LlamaIndex tools
  config: AgentConfig;
}

// Agent response interface (compatible with LlamaIndex)
export interface AgentResponse {
  data: {
    message: {
      role: 'user' | 'assistant' | 'system';
      content: string;
      toolCalls?: any[];
    };
    state?: any;
    result?: string;
  };
  success: boolean;
  error?: string;
}

// Circuit breaker states
export type CircuitState = 'closed' | 'open' | 'half-open';

// Circuit breaker interface
export interface CircuitBreaker {
  state: CircuitState;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  execute<T>(fn: () => Promise<T>): Promise<T>;
  recordSuccess(): void;
  recordFailure(): void;
  canExecute(): boolean;
}

// Agent manager interface
export interface AgentManager {
  getAgent(): Promise<AgentInstance>;
  initializeAgent(): Promise<AgentInstance>;
  isInitialized(): boolean;
  getHealth(): Promise<{
    status: 'healthy' | 'unhealthy' | 'initializing';
    lastHealthCheck: number;
    error?: string;
  }>;
  shutdown(): Promise<void>;
}

// Cache interface
export interface Cache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

// Rate limiter interface
export interface RateLimiter {
  checkLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }>;
  reset(identifier: string): Promise<void>;
}

// Analytics data interface
export interface AnalyticsData {
  tokenUsage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  responseTime: number;
  toolsUsed: string[];
  model: string;
  timestamp: string;
  cost: number;
  requestId: string;
}

// Error types
export class AgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'AgentError';
  }
}

export class ConfigurationError extends AgentError {
  constructor(message: string) {
    super(message, 'CONFIGURATION_ERROR', 500, false);
    this.name = 'ConfigurationError';
  }
}

export class RateLimitError extends AgentError {
  constructor(message: string, public resetTime: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, false);
    this.name = 'RateLimitError';
  }
}

export class CircuitBreakerError extends AgentError {
  constructor(message: string) {
    super(message, 'CIRCUIT_BREAKER_OPEN', 503, true);
    this.name = 'CircuitBreakerError';
  }
}

// Request context interface
export interface RequestContext {
  requestId: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
  timestamp: number;
}

// Enhanced chat response interface
export interface EnhancedChatResponse {
  response: {
    data: AgentResponse['data'];
    message: AgentResponse['data']['message'] & {
      analytics: AnalyticsData;
    };
  };
  requestId: string;
  processingTime: number;
}

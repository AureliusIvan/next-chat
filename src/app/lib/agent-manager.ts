import { agent } from "@llamaindex/workflow";
import { tool } from "llamaindex";
import { openai } from "@llamaindex/openai";
import { WorkflowEventData, AgentResultData } from "@llamaindex/workflow";
import { z } from "zod";

import {
  AgentInstance,
  AgentManager,
  AgentConfig,
  AgentTool,
  CircuitBreaker,
  CircuitState,
  AgentError,
  CircuitBreakerError,
  ConfigurationError,
  greetToolSchema,
  GreetToolParams,
} from "../types/agent";
import {
  OPENAI_MODEL,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_TIMEOUT,
  MAX_RETRIES,
  RETRY_DELAY_MS,
} from "./config";
import { logger } from "./logger";
import { OPENAI_API_KEY } from "./config";

// Circuit Breaker Implementation
class CircuitBreakerImpl implements CircuitBreaker {
  public state: CircuitState = 'closed';
  public failureCount: number = 0;
  public lastFailureTime: number = 0;
  public nextAttemptTime: number = 0;

  constructor(
    private threshold: number = CIRCUIT_BREAKER_THRESHOLD,
    private timeout: number = CIRCUIT_BREAKER_TIMEOUT
  ) {}

  canExecute(): boolean {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      return Date.now() >= this.nextAttemptTime;
    }
    return true; // half-open state
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerError('Circuit breaker is open');
    }

    try {
      if (this.state === 'open' && Date.now() >= this.nextAttemptTime) {
        this.state = 'half-open';
        logger.info('Circuit breaker transitioning to half-open state');
      }

      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  recordSuccess(): void {
    this.failureCount = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      logger.info('Circuit breaker closed after successful execution');
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.threshold) {
      this.state = 'open';
      this.nextAttemptTime = Date.now() + this.timeout;
      logger.warn('Circuit breaker opened due to repeated failures', {
        failureCount: this.failureCount,
        threshold: this.threshold,
        nextAttemptTime: new Date(this.nextAttemptTime).toISOString(),
      });
    }
  }
}

// Retry utility with exponential backoff
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  baseDelay: number = RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt);
        logger.warn(`Attempt ${attempt + 1} failed, retrying in ${delay}ms`, {
          error: lastError.message,
          attempt: attempt + 1,
          maxRetries,
          delay,
        });
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError!;
}

// Agent Manager Implementation
class AgentManagerImpl implements AgentManager {
  private static instance: AgentManagerImpl;
  private agent: AgentInstance | null = null;
  private isInitializing: boolean = false;
  private initializationPromise: Promise<AgentInstance> | null = null;
  private circuitBreaker: CircuitBreaker;
  private lastHealthCheck: number = 0;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.circuitBreaker = new CircuitBreakerImpl();
    this.startHealthCheck();
  }

  public static getInstance(): AgentManagerImpl {
    if (!AgentManagerImpl.instance) {
      AgentManagerImpl.instance = new AgentManagerImpl();
    }
    return AgentManagerImpl.instance;
  }

  async getAgent(): Promise<AgentInstance> {
    if (this.agent) {
      return this.agent;
    }

    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    return this.initializeAgent();
  }

  async initializeAgent(): Promise<AgentInstance> {
    if (this.agent) {
      return this.agent;
    }

    if (this.isInitializing && this.initializationPromise) {
      return this.initializationPromise;
    }

    this.isInitializing = true;

    this.initializationPromise = withRetry(async () => {
      return this.circuitBreaker.execute(async () => {
        logger.info('Initializing agent...');

        const startTime = Date.now();

        try {
          // Validate API key
          if (!OPENAI_API_KEY) {
            throw new ConfigurationError('OpenAI API key is not configured');
          }

          // Create tools
          const greetTool = tool({
            name: "greet",
            description: "Greets a user with their name",
            parameters: greetToolSchema,
            execute: ({ name }: GreetToolParams) => `Hello, ${name}! How can I help you today?`,
          });

          // Create agent configuration
          const config: AgentConfig = {
            tools: [greetTool as any], // Cast to avoid type mismatch with LlamaIndex
            model: OPENAI_MODEL,
          };

          // Initialize agent
          const agentInstance = agent({
            tools: [greetTool],
            llm: openai({
              model: OPENAI_MODEL,
              apiKey: OPENAI_API_KEY,
            }),
          });

          // Wrap the agent to add our interface
          const wrappedAgent: AgentInstance = {
            run: async (message: string) => {
              return this.circuitBreaker.execute(async () => {
                const runStartTime = Date.now();
                try {
                  const result = await agentInstance.run(message);
                  const runDuration = Date.now() - runStartTime;

                  logger.info('Agent run completed successfully', {
                    duration: runDuration,
                    messageLength: message.length,
                  });

                  // Wrap the result to match our AgentResponse interface
                  const messageContent = typeof result.data.message.content === 'string'
                    ? result.data.message.content
                    : Array.isArray(result.data.message.content)
                      ? result.data.message.content.map(c =>
                          (c as any).text || (c as any).type === 'text' ? (c as any).text || '' : ''
                        ).join('')
                      : '';

                  const resultContent = typeof result.data.result === 'string'
                    ? result.data.result
                    : Array.isArray(result.data.result)
                      ? result.data.result.map(c =>
                          (c as any).text || (c as any).type === 'text' ? (c as any).text || '' : ''
                        ).join('')
                      : result.data.result || '';

                  return {
                    data: {
                      ...result.data,
                      message: {
                        ...result.data.message,
                        role: result.data.message.role as 'user' | 'assistant' | 'system',
                        content: messageContent,
                      },
                      result: resultContent,
                    },
                    success: true,
                  };
                } catch (error) {
                  const runDuration = Date.now() - runStartTime;
                  logger.error('Agent run failed', {
                    duration: runDuration,
                    messageLength: message.length,
                    error: error instanceof Error ? error.message : 'Unknown error',
                  });
                  throw error;
                }
              });
            },
            tools: [greetTool], // LlamaIndex tool type
            config,
          };

          this.agent = wrappedAgent;
          const initDuration = Date.now() - startTime;

          logger.info('Agent initialized successfully', {
            duration: initDuration,
            model: OPENAI_MODEL,
            toolsCount: config.tools.length,
          });

          return wrappedAgent;
        } catch (error) {
          const initDuration = Date.now() - startTime;
          logger.error('Agent initialization failed', {
            duration: initDuration,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      });
    });

    try {
      const result = await this.initializationPromise;
      this.isInitializing = false;
      this.initializationPromise = null;
      return result;
    } catch (error) {
      this.isInitializing = false;
      this.initializationPromise = null;
      throw error;
    }
  }

  isInitialized(): boolean {
    return this.agent !== null;
  }

  async getHealth(): Promise<{ status: 'healthy' | 'unhealthy' | 'initializing'; lastHealthCheck: number; error?: string }> {
    const now = Date.now();

    // Cache health checks for 30 seconds
    if (now - this.lastHealthCheck < 30000) {
      return {
        status: this.agent ? 'healthy' : 'unhealthy',
        lastHealthCheck: this.lastHealthCheck,
      };
    }

    this.lastHealthCheck = now;

    try {
      if (!this.agent) {
        return {
          status: 'initializing',
          lastHealthCheck: now,
          error: 'Agent not initialized',
        };
      }

      // Simple health check - try to access agent properties
      const isHealthy = this.agent.tools.length > 0 && typeof this.agent.run === 'function';

      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        lastHealthCheck: now,
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        lastHealthCheck: now,
        error: error instanceof Error ? error.message : 'Unknown health check error',
      };
    }
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down agent manager...');

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Clean up agent resources if needed
    this.agent = null;
    this.isInitializing = false;
    this.initializationPromise = null;

    logger.info('Agent manager shutdown complete');
  }

  private startHealthCheck(): void {
    // Periodic health check every 5 minutes
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.getHealth();
        if (health.status === 'unhealthy') {
          logger.warn('Agent health check failed', { health });
        }
      } catch (error) {
        logger.error('Health check error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// Export singleton instance
export const agentManager = AgentManagerImpl.getInstance();

// Export class for testing purposes
export { AgentManagerImpl };

import { z } from 'zod';

// Environment configuration schema
const configSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  AGENT_CACHE_TTL: z.coerce.number().default(3600), // 1 hour in seconds
  RATE_LIMIT_REQUESTS: z.coerce.number().default(100), // requests per window
  RATE_LIMIT_WINDOW: z.coerce.number().default(60), // window in seconds
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  MAX_RETRIES: z.coerce.number().default(3),
  RETRY_DELAY_MS: z.coerce.number().default(1000),
  CIRCUIT_BREAKER_THRESHOLD: z.coerce.number().default(5),
  CIRCUIT_BREAKER_TIMEOUT: z.coerce.number().default(60000), // 1 minute
});

// Validate and parse environment variables
function validateConfig() {
  try {
    const env = {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      AGENT_CACHE_TTL: process.env.AGENT_CACHE_TTL,
      RATE_LIMIT_REQUESTS: process.env.RATE_LIMIT_REQUESTS,
      RATE_LIMIT_WINDOW: process.env.RATE_LIMIT_WINDOW,
      LOG_LEVEL: process.env.LOG_LEVEL,
      NODE_ENV: process.env.NODE_ENV,
      MAX_RETRIES: process.env.MAX_RETRIES,
      RETRY_DELAY_MS: process.env.RETRY_DELAY_MS,
      CIRCUIT_BREAKER_THRESHOLD: process.env.CIRCUIT_BREAKER_THRESHOLD,
      CIRCUIT_BREAKER_TIMEOUT: process.env.CIRCUIT_BREAKER_TIMEOUT,
    };

    return configSchema.parse(env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('Configuration validation failed:', error.issues);
      throw new Error(`Invalid configuration: ${error.issues.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
}

// Export validated configuration
export const config = validateConfig();

// Export individual config values for convenience
export const {
  OPENAI_API_KEY,
  OPENAI_MODEL,
  AGENT_CACHE_TTL,
  RATE_LIMIT_REQUESTS,
  RATE_LIMIT_WINDOW,
  LOG_LEVEL,
  NODE_ENV,
  MAX_RETRIES,
  RETRY_DELAY_MS,
  CIRCUIT_BREAKER_THRESHOLD,
  CIRCUIT_BREAKER_TIMEOUT,
} = config;

// Configuration utility functions
export const isProduction = NODE_ENV === 'production';
export const isDevelopment = NODE_ENV === 'development';
export const isTest = NODE_ENV === 'test';

// Cache TTL helpers
export const getCacheTTL = () => AGENT_CACHE_TTL * 1000; // Convert to milliseconds
export const getRateLimitWindow = () => RATE_LIMIT_WINDOW * 1000; // Convert to milliseconds

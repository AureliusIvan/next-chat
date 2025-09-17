import { AnalyticsData } from '../types/agent';
import { OPENAI_MODEL } from './config';
import { logger } from './logger';

// Token counting utilities
// These are approximations based on OpenAI's tokenizer patterns
export function estimateTokens(text: string): number {
  if (!text) return 0;

  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is not perfect but provides reasonable estimates
  const baseTokens = Math.ceil(text.length / 4);

  // Add overhead for special tokens, formatting, etc.
  const overhead = Math.ceil(baseTokens * 0.1);

  return baseTokens + overhead;
}

export function estimateTokensForMessages(messages: Array<{ role: string; content: string }>): {
  promptTokens: number;
  estimatedTotal: number;
} {
  let promptTokens = 0;

  // Add system message overhead if present
  const hasSystemMessage = messages.some(m => m.role === 'system');
  if (hasSystemMessage) {
    promptTokens += 10; // System message overhead
  }

  // Count tokens for each message
  for (const message of messages) {
    // Role token overhead
    promptTokens += 4; // Rough overhead per message

    // Content tokens
    promptTokens += estimateTokens(message.content);

    // Additional overhead for conversation structure
    promptTokens += 3;
  }

  return {
    promptTokens,
    estimatedTotal: promptTokens,
  };
}

// Cost calculation utilities
export function calculateCost(
  promptTokens: number,
  completionTokens: number,
  model: string = OPENAI_MODEL
): number {
  // OpenAI pricing as of 2024 (per 1K tokens)
  const pricing: Record<string, { prompt: number; completion: number }> = {
    'gpt-4o': { prompt: 0.005, completion: 0.015 },
    'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'gpt-4': { prompt: 0.03, completion: 0.06 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  };

  const modelPricing = pricing[model] || pricing['gpt-4o-mini'];

  const promptCost = (promptTokens / 1000) * modelPricing.prompt;
  const completionCost = (completionTokens / 1000) * modelPricing.completion;

  return Math.round((promptCost + completionCost) * 1000000) / 1000000; // Round to 6 decimal places
}

// Analytics data generation
export function generateAnalyticsData(
  requestId: string,
  message: string,
  response: string,
  responseTime: number,
  toolsUsed: string[] = [],
  model: string = OPENAI_MODEL
): AnalyticsData {
  // Estimate token usage
  const promptTokens = estimateTokens(message);
  const completionTokens = estimateTokens(response);
  const totalTokens = promptTokens + completionTokens;

  // Calculate cost
  const cost = calculateCost(promptTokens, completionTokens, model);

  return {
    tokenUsage: {
      promptTokens,
      completionTokens,
      totalTokens,
    },
    responseTime,
    toolsUsed,
    model,
    timestamp: new Date().toISOString(),
    cost,
    requestId,
  };
}

// Performance tracking
export class PerformanceTracker {
  private startTime: number;
  private checkpoints: Map<string, number> = new Map();

  constructor() {
    this.startTime = Date.now();
  }

  checkpoint(name: string): void {
    this.checkpoints.set(name, Date.now());
  }

  getDuration(from?: string): number {
    const endTime = Date.now();
    const startTime = from ? (this.checkpoints.get(from) || this.startTime) : this.startTime;
    return endTime - startTime;
  }

  getCheckpointDuration(from: string, to: string): number {
    const fromTime = this.checkpoints.get(from);
    const toTime = this.checkpoints.get(to);

    if (!fromTime || !toTime) {
      return 0;
    }

    return toTime - fromTime;
  }

  getAllCheckpoints(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [name, time] of this.checkpoints.entries()) {
      result[name] = time - this.startTime;
    }
    return result;
  }

  reset(): void {
    this.startTime = Date.now();
    this.checkpoints.clear();
  }
}

// Request tracking for analytics aggregation
class AnalyticsAggregator {
  private static instance: AnalyticsAggregator;
  private metrics: {
    totalRequests: number;
    totalTokens: number;
    totalCost: number;
    averageResponseTime: number;
    errorCount: number;
    lastReset: number;
  } = {
    totalRequests: 0,
    totalTokens: 0,
    totalCost: 0,
    averageResponseTime: 0,
    errorCount: 0,
    lastReset: Date.now(),
  };

  private constructor() {
    // Reset metrics daily
    setInterval(() => this.reset(), 24 * 60 * 60 * 1000);
  }

  static getInstance(): AnalyticsAggregator {
    if (!AnalyticsAggregator.instance) {
      AnalyticsAggregator.instance = new AnalyticsAggregator();
    }
    return AnalyticsAggregator.instance;
  }

  recordRequest(analytics: AnalyticsData, success: boolean = true): void {
    this.metrics.totalRequests++;
    this.metrics.totalTokens += analytics.tokenUsage.totalTokens;
    this.metrics.totalCost += analytics.cost;

    // Update average response time
    const currentAvg = this.metrics.averageResponseTime;
    const newCount = success ? this.metrics.totalRequests - this.metrics.errorCount : this.metrics.totalRequests - this.metrics.errorCount - 1;
    if (newCount > 0) {
      this.metrics.averageResponseTime = (currentAvg * (newCount - 1) + analytics.responseTime) / newCount;
    } else {
      this.metrics.averageResponseTime = analytics.responseTime;
    }

    if (!success) {
      this.metrics.errorCount++;
    }

    logger.debug('Analytics recorded', {
      requestId: analytics.requestId,
      success,
      totalRequests: this.metrics.totalRequests,
      totalTokens: this.metrics.totalTokens,
      totalCost: this.metrics.totalCost,
      averageResponseTime: Math.round(this.metrics.averageResponseTime),
    });
  }

  getMetrics(): typeof this.metrics {
    return { ...this.metrics };
  }

  reset(): void {
    logger.info('Resetting analytics metrics', {
      previousMetrics: { ...this.metrics },
    });

    this.metrics = {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      averageResponseTime: 0,
      errorCount: 0,
      lastReset: Date.now(),
    };
  }
}

// Export singleton instance
export const analyticsAggregator = AnalyticsAggregator.getInstance();

// Utility functions
export function createRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function logAnalytics(analytics: AnalyticsData, success: boolean = true): void {
  analyticsAggregator.recordRequest(analytics, success);

  logger.info('Request analytics', {
    requestId: analytics.requestId,
    success,
    promptTokens: analytics.tokenUsage.promptTokens,
    completionTokens: analytics.tokenUsage.completionTokens,
    totalTokens: analytics.tokenUsage.totalTokens,
    responseTime: analytics.responseTime,
    cost: analytics.cost,
    model: analytics.model,
    toolsUsed: analytics.toolsUsed,
  });
}

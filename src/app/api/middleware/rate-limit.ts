import { NextRequest, NextResponse } from 'next/server';
import { RateLimiter, RateLimitError } from '../../types/agent';
import { RATE_LIMIT_REQUESTS, RATE_LIMIT_WINDOW, getRateLimitWindow } from '../../lib/config';
import { logger } from '../../lib/logger';

// In-memory rate limiter implementation
// In production, replace with Redis-based implementation
class InMemoryRateLimiter implements RateLimiter {
  private requests: Map<string, { count: number; resetTime: number }> = new Map();

  constructor(
    private maxRequests: number = RATE_LIMIT_REQUESTS,
    private windowMs: number = getRateLimitWindow()
  ) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  async checkLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    const now = Date.now();
    const windowKey = Math.floor(now / this.windowMs);
    const key = `${identifier}:${windowKey}`;

    const current = this.requests.get(key) || { count: 0, resetTime: now + this.windowMs };

    if (now > current.resetTime) {
      // Reset window
      current.count = 0;
      current.resetTime = now + this.windowMs;
    }

    const remaining = Math.max(0, this.maxRequests - current.count);
    const allowed = current.count < this.maxRequests;

    if (allowed) {
      current.count++;
      this.requests.set(key, current);
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : remaining,
      resetTime: current.resetTime,
    };
  }

  async reset(identifier: string): Promise<void> {
    const now = Date.now();
    const windowKey = Math.floor(now / this.windowMs);
    const key = `${identifier}:${windowKey}`;

    this.requests.delete(key);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, data] of this.requests.entries()) {
      if (now > data.resetTime) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.requests.delete(key));

    if (keysToDelete.length > 0) {
      logger.debug('Cleaned up expired rate limit entries', {
        cleanedCount: keysToDelete.length,
        totalEntries: this.requests.size,
      });
    }
  }
}

// Singleton rate limiter instance
const rateLimiter = new InMemoryRateLimiter();

// Rate limiting middleware function
export async function withRateLimit(
  request: NextRequest,
  handler: () => Promise<NextResponse>
): Promise<NextResponse> {
  try {
    // Get client identifier (IP address)
    const clientIP = getClientIP(request);

    // Check rate limit
    const limitResult = await rateLimiter.checkLimit(clientIP);

    // Add rate limit headers
    const response = await handler();

    // Set rate limit headers
    response.headers.set('X-RateLimit-Limit', RATE_LIMIT_REQUESTS.toString());
    response.headers.set('X-RateLimit-Remaining', limitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', limitResult.resetTime.toString());

    if (!limitResult.allowed) {
      logger.warn('Rate limit exceeded', {
        clientIP,
        limit: RATE_LIMIT_REQUESTS,
        windowMs: RATE_LIMIT_WINDOW,
        resetTime: new Date(limitResult.resetTime).toISOString(),
      });

      const resetTime = Math.ceil((limitResult.resetTime - Date.now()) / 1000);

      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Try again in ${resetTime} seconds.`,
          retryAfter: resetTime,
        },
        {
          status: 429,
          headers: {
            'Retry-After': resetTime.toString(),
            'X-RateLimit-Limit': RATE_LIMIT_REQUESTS.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': limitResult.resetTime.toString(),
          },
        }
      );
    }

    return response;
  } catch (error) {
    logger.error('Rate limiting middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // If rate limiting fails, allow the request to proceed
    return handler();
  }
}

// Utility function to get client IP
function getClientIP(request: NextRequest): string {
  // Check various headers for the real IP
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const clientIP = request.headers.get('x-client-ip');

  // Priority: x-forwarded-for > x-real-ip > x-client-ip > fallback
  if (forwardedFor) {
    // Take the first IP if there are multiple
    return forwardedFor.split(',')[0].trim();
  }

  if (realIP) return realIP;
  if (clientIP) return clientIP;

  // Fallback: use a hash of user agent + some entropy
  // This is not ideal but prevents abuse when IP is not available
  const userAgent = request.headers.get('user-agent') || 'unknown';
  const entropy = Date.now().toString();
  return Buffer.from(userAgent + entropy).toString('base64').slice(0, 16);
}

// Export rate limiter for testing or external use
export { rateLimiter, InMemoryRateLimiter };

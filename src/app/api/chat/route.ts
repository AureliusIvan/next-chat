import { NextRequest, NextResponse } from "next/server";
import { agentManager } from "../../lib/agent-manager";
import { withRateLimit } from "../middleware/rate-limit";
import {
  generateAnalyticsData,
  logAnalytics,
  createRequestId,
  PerformanceTracker
} from "../../lib/analytics";
import { logger } from "../../lib/logger";
import {
  AgentError,
  RateLimitError,
  ConfigurationError,
  RequestContext,
  EnhancedChatResponse
} from "../../types/agent";
import { z } from "zod";

// Request validation schema
const chatRequestSchema = z.object({
  message: z.string().min(1, "Message cannot be empty").max(10000, "Message too long"),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
});

// Error response utility
function createErrorResponse(
  error: Error,
  requestId: string,
  statusCode: number = 500
): NextResponse {
  const isProduction = process.env.NODE_ENV === 'production';

  const errorResponse = {
    error: {
      message: isProduction ? 'An error occurred' : error.message,
      code: error instanceof AgentError ? error.code : 'INTERNAL_ERROR',
      requestId,
      timestamp: new Date().toISOString(),
    },
    ...(isProduction ? {} : {
      stack: error.stack,
      name: error.name,
    }),
  };

  logger.error('Request failed', {
    requestId,
    error: error.message,
    statusCode,
    userId: error instanceof RateLimitError ? undefined : 'unknown',
  });

  return NextResponse.json(errorResponse, {
    status: statusCode,
    headers: {
      'X-Request-ID': requestId,
    },
  });
}

// Main chat handler
async function handleChat(request: NextRequest): Promise<NextResponse> {
  const requestId = createRequestId();
  const tracker = new PerformanceTracker();

  let requestContext: RequestContext | undefined;

  try {
    // Parse and validate request
    tracker.checkpoint('parse-start');
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      logger.warn('Invalid request body', {
        requestId,
        errors: validation.error.issues,
      });

      return NextResponse.json(
        {
          error: "Invalid request",
          details: validation.error.issues,
          requestId,
        },
        {
          status: 400,
          headers: { 'X-Request-ID': requestId },
        }
      );
    }

    const { message, userId, sessionId } = validation.data;

    requestContext = {
      requestId,
      userId,
      sessionId,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0] || request.headers.get('x-real-ip') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
      timestamp: Date.now(),
    };

    logger.request('Chat request received', requestId, {
      messageLength: message.length,
      userId,
      sessionId,
    });

    tracker.checkpoint('parse-end');

    // Get agent instance
    tracker.checkpoint('agent-init-start');
    const agent = await agentManager.getAgent();
    tracker.checkpoint('agent-init-end');

    // Execute agent
    tracker.checkpoint('agent-run-start');
    const result = await agent.run(message);
    tracker.checkpoint('agent-run-end');

    const responseTime = tracker.getDuration('agent-run-start');

    // Generate analytics
    tracker.checkpoint('analytics-start');
    const toolsUsed = result.data.message.role === 'assistant' && result.data.message.toolCalls ?
      result.data.message.toolCalls.map(tc => tc.function?.name || 'unknown') :
      [];

    const analytics = generateAnalyticsData(
      requestId,
      message,
      result.data.message.content,
      responseTime,
      toolsUsed
    );
    tracker.checkpoint('analytics-end');

    // Create enhanced response
    const enhancedResponse: EnhancedChatResponse = {
      response: {
        data: result.data,
        message: {
          ...result.data.message,
          analytics,
        },
      },
      requestId,
      processingTime: tracker.getDuration(),
    };

    // Log success
    logger.response('Chat response sent', requestId, responseTime, {
      toolsUsed: toolsUsed.length,
      totalTokens: analytics.tokenUsage.totalTokens,
      cost: analytics.cost,
    });

    // Log analytics
    logAnalytics(analytics, true);

    return NextResponse.json(enhancedResponse, {
      headers: {
        'X-Request-ID': requestId,
        'X-Processing-Time': responseTime.toString(),
      },
    });

  } catch (error) {
    const totalDuration = tracker.getDuration();

    if (error instanceof AgentError) {
      return createErrorResponse(error, requestId, error.statusCode);
    }

    // Handle unexpected errors
    const unexpectedError = new AgentError(
      'An unexpected error occurred',
      'UNEXPECTED_ERROR',
      500,
      false
    );

    logger.error('Unexpected error in chat handler', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: totalDuration,
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Log failed analytics if we have enough context
    if (requestContext) {
      const failedAnalytics = generateAnalyticsData(
        requestId,
        'error', // We don't have the original message
        'Error occurred',
        totalDuration,
        [],
        'unknown'
      );
      logAnalytics(failedAnalytics, false);
    }

    return createErrorResponse(unexpectedError, requestId);
  }
}

// Apply rate limiting to the handler
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRateLimit(request, () => handleChat(request));
}

import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '../../lib/agent-manager';
import { logger } from '../../lib/logger';
import { isProduction } from '../../lib/config';

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  services: {
    agent: {
      status: 'healthy' | 'unhealthy' | 'initializing';
      lastHealthCheck: number;
      error?: string;
    };
    database?: {
      status: 'healthy' | 'unhealthy';
      error?: string;
    };
  };
  environment: {
    nodeEnv: string;
    platform: string;
    arch: string;
    version: string;
  };
  metrics?: {
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage?: NodeJS.CpuUsage;
  };
}

const START_TIME = Date.now();

export async function GET(request: NextRequest) {
  const requestId = `health-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  try {
    logger.debug('Health check requested', { requestId });

    // Get agent health
    const agentHealth = await agentManager.getHealth();

    // Calculate overall status
    const overallStatus = determineOverallStatus(agentHealth);

    const response: HealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - START_TIME,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        agent: agentHealth,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.platform,
        arch: process.arch,
        version: process.version,
      },
    };

    // Add detailed metrics in development or when requested
    const includeMetrics = request.nextUrl.searchParams.get('metrics') === 'true' || !isProduction;

    if (includeMetrics) {
      response.metrics = {
        memoryUsage: process.memoryUsage(),
        cpuUsage: process.cpuUsage(),
      };
    }

    // Log health status
    logger.info('Health check completed', {
      requestId,
      status: overallStatus,
      agentStatus: agentHealth.status,
    });

    // Return appropriate HTTP status
    const httpStatus = overallStatus === 'healthy' ? 200 :
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(response, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    logger.error('Health check failed', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    const errorResponse: HealthResponse = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Date.now() - START_TIME,
      version: process.env.npm_package_version || '1.0.0',
      services: {
        agent: {
          status: 'unhealthy',
          lastHealthCheck: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || 'development',
        platform: process.platform,
        arch: process.arch,
        version: process.version,
      },
    };

    return NextResponse.json(errorResponse, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Content-Type': 'application/json',
      },
    });
  }
}

function determineOverallStatus(agentHealth: any): 'healthy' | 'degraded' | 'unhealthy' {
  if (agentHealth.status === 'healthy') {
    return 'healthy';
  }

  if (agentHealth.status === 'initializing') {
    return 'degraded';
  }

  return 'unhealthy';
}

// HEAD method for simple health checks (load balancers, etc.)
export async function HEAD(request: NextRequest) {
  try {
    const agentHealth = await agentManager.getHealth();
    const status = agentHealth.status === 'healthy' ? 200 : 503;

    return new NextResponse(null, {
      status,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}

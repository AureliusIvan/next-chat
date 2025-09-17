import { LOG_LEVEL, isProduction } from './config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  service: string;
  data?: Record<string, any>;
  error?: Error;
  requestId?: string;
  userId?: string;
  sessionId?: string;
}

class Logger {
  private service: string;

  constructor(service = 'chatbot') {
    this.service = service;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(LOG_LEVEL);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private formatLogEntry(entry: LogEntry): string {
    const baseInfo = {
      timestamp: entry.timestamp,
      level: entry.level.toUpperCase(),
      service: entry.service,
      message: entry.message,
    };

    const additionalInfo = {
      ...(entry.requestId && { requestId: entry.requestId }),
      ...(entry.userId && { userId: entry.userId }),
      ...(entry.sessionId && { sessionId: entry.sessionId }),
      ...(entry.data && { data: entry.data }),
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: isProduction ? undefined : entry.error.stack,
        },
      }),
    };

    if (isProduction) {
      return JSON.stringify({ ...baseInfo, ...additionalInfo });
    }

    // Development: pretty print
    const timestamp = new Date(entry.timestamp).toLocaleString();
    let output = `[${timestamp}] ${entry.level.toUpperCase()} [${entry.service}] ${entry.message}`;

    if (entry.requestId) output += ` [${entry.requestId}]`;
    if (Object.keys(additionalInfo).length > 0) {
      output += `\n${JSON.stringify(additionalInfo, null, 2)}`;
    }

    return output;
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>, error?: Error) {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.service,
      ...(data && { data }),
      ...(error && { error }),
    };

    const formattedMessage = this.formatLogEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'error':
        console.error(formattedMessage);
        break;
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>, error?: Error) {
    this.log('warn', message, data, error);
  }

  error(message: string, data?: Record<string, any>, error?: Error) {
    this.log('error', message, data, error);
  }

  // Convenience methods for common scenarios
  request(message: string, requestId: string, data?: Record<string, any>) {
    this.info(message, { ...data, requestId });
  }

  response(message: string, requestId: string, responseTime: number, data?: Record<string, any>) {
    this.info(message, { ...data, requestId, responseTime: `${responseTime}ms` });
  }

  agent(message: string, requestId: string, agentName: string, data?: Record<string, any>) {
    this.info(message, { ...data, requestId, agent: agentName });
  }

  performance(operation: string, duration: number, requestId?: string, data?: Record<string, any>) {
    this.info(`Performance: ${operation}`, {
      ...data,
      duration: `${duration}ms`,
      ...(requestId && { requestId }),
    });
  }

  // Create child logger with additional context
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.service);
    // In a more advanced implementation, we'd merge context
    return childLogger;
  }
}

// Export singleton instance
export const logger = new Logger();

// Export class for creating service-specific loggers
export { Logger };

// Export types
export type { LogLevel, LogEntry };

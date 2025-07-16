// Structured logging system for better debugging and monitoring

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  CRITICAL = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  context?: Record<string, any>;
  error?: Error;
  stack?: string;
}

class Logger {
  private logLevel: LogLevel = __DEV__ ? LogLevel.DEBUG : LogLevel.INFO;
  private service: string;
  private context: Record<string, any> = {};

  constructor(service: string) {
    this.service = service;
  }

  // Set logging level
  setLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  // Add persistent context that will be included in all logs
  setContext(context: Record<string, any>): void {
    this.context = { ...this.context, ...context };
  }

  // Clear context
  clearContext(): void {
    this.context = {};
  }

  // Core logging method
  private log(level: LogLevel, message: string, context?: Record<string, any>, error?: Error): void {
    if (level < this.logLevel) {
      return; // Skip if below current log level
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      service: this.service,
      context: { ...this.context, ...context },
      error,
      stack: error?.stack,
    };

    // Format for console output
    const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    const levelEmojis = ['🔍', 'ℹ️', '⚠️', '❌', '🚨'];
    const levelName = levelNames[level];
    const levelEmoji = levelEmojis[level];

    const contextStr = Object.keys(logEntry.context || {}).length > 0 
      ? ` | Context: ${JSON.stringify(logEntry.context)}` 
      : '';

    const errorStr = error ? ` | Error: ${error.message}` : '';

    const formattedMessage = `${levelEmoji} [${levelName}] ${this.service}: ${message}${contextStr}${errorStr}`;

    // Output to appropriate console method
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage);
        if (error) console.warn(error);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(formattedMessage);
        if (error) console.error(error);
        break;
    }

    // In production, send to crash reporting service
    if (!__DEV__ && level >= LogLevel.ERROR) {
      this.sendToCrashReporting(logEntry);
    }
  }

  // Public logging methods
  debug(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.WARN, message, context, error);
  }

  error(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  critical(message: string, context?: Record<string, any>, error?: Error): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  // Performance logging
  time(label: string): void {
    if (__DEV__) {
      console.time(`${this.service}:${label}`);
    }
  }

  timeEnd(label: string): void {
    if (__DEV__) {
      console.timeEnd(`${this.service}:${label}`);
    }
  }

  // API request logging
  apiRequest(method: string, url: string, context?: Record<string, any>): void {
    this.debug(`API Request: ${method} ${url}`, {
      ...context,
      requestType: 'outgoing',
      method,
      url,
    });
  }

  apiResponse(method: string, url: string, status: number, duration: number, context?: Record<string, any>): void {
    const level = status >= 400 ? LogLevel.ERROR : LogLevel.DEBUG;
    this.log(level, `API Response: ${method} ${url} - ${status} (${duration}ms)`, {
      ...context,
      responseType: 'incoming',
      method,
      url,
      status,
      duration,
    });
  }

  // Cache logging
  cacheHit(key: string, context?: Record<string, any>): void {
    this.debug(`Cache HIT: ${key}`, { ...context, cacheOperation: 'hit', key });
  }

  cacheMiss(key: string, context?: Record<string, any>): void {
    this.debug(`Cache MISS: ${key}`, { ...context, cacheOperation: 'miss', key });
  }

  cacheSet(key: string, context?: Record<string, any>): void {
    this.debug(`Cache SET: ${key}`, { ...context, cacheOperation: 'set', key });
  }

  // Database logging
  dbQuery(query: string, duration: number, context?: Record<string, any>): void {
    this.debug(`DB Query: ${query} (${duration}ms)`, {
      ...context,
      operationType: 'database',
      query,
      duration,
    });
  }

  // Send critical logs to crash reporting service
  private sendToCrashReporting(logEntry: LogEntry): void {
    // TODO: Integrate with Sentry, Crashlytics, or other service
    // Example: Sentry.captureMessage(logEntry.message, logEntry.level);
    console.warn('📤 Would send to crash reporting:', logEntry);
  }

  // Create child logger with additional context
  child(additionalContext: Record<string, any>): Logger {
    const childLogger = new Logger(this.service);
    childLogger.setLevel(this.logLevel);
    childLogger.setContext({ ...this.context, ...additionalContext });
    return childLogger;
  }
}

// Logger factory
class LoggerFactory {
  private static loggers = new Map<string, Logger>();

  static getLogger(service: string): Logger {
    if (!this.loggers.has(service)) {
      this.loggers.set(service, new Logger(service));
    }
    return this.loggers.get(service)!;
  }

  static setGlobalLogLevel(level: LogLevel): void {
    this.loggers.forEach(logger => logger.setLevel(level));
  }

  static getAllLoggers(): Map<string, Logger> {
    return new Map(this.loggers);
  }
}

// Export common logger instances
export const apiLogger = LoggerFactory.getLogger('API');
export const cacheLogger = LoggerFactory.getLogger('CACHE');
export const dbLogger = LoggerFactory.getLogger('DATABASE');
export const uiLogger = LoggerFactory.getLogger('UI');
export const appLogger = LoggerFactory.getLogger('APP');

export { Logger, LoggerFactory };
export default LoggerFactory;

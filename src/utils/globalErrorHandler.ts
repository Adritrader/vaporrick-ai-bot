// Global error handler for unhandled exceptions and promise rejections

import { apiLogger } from './logger';
import { notificationManager, NotificationType, NotificationPriority } from './notificationManager';

export interface ErrorReport {
  id: string;
  timestamp: number;
  type: 'javascript' | 'promise_rejection' | 'network' | 'api' | 'business_logic' | 'ui';
  message: string;
  stack?: string;
  context?: Record<string, any>;
  userAgent?: string;
  url?: string;
  userId?: string;
  sessionId?: string;
  buildVersion?: string;
  fatal: boolean;
  handled: boolean;
  reportedToUser: boolean;
}

export interface ErrorHandlerConfig {
  enableGlobalHandler: boolean;
  enablePromiseRejectionHandler: boolean;
  enableNetworkErrorHandler: boolean;
  reportToUser: boolean;
  reportToCrashlytics: boolean;
  maxErrorsPerSession: number;
  maxErrorsPerMinute: number;
  enableErrorReporting: boolean;
  filterSensitiveData: boolean;
}

class GlobalErrorHandler {
  private errors: ErrorReport[] = [];
  private errorCounts = new Map<string, number>();
  private lastErrorTime = 0;
  private sessionId: string;
  private config: ErrorHandlerConfig;
  
  private readonly MAX_STORED_ERRORS = 100;
  private readonly ERROR_COOLDOWN = 5000; // 5 seconds
  
  constructor() {
    this.sessionId = this.generateSessionId();
    this.config = this.getDefaultConfig();
    this.initialize();
  }

  // Initialize error handlers
  private initialize(): void {
    this.setupGlobalErrorHandler();
    this.setupPromiseRejectionHandler();
    this.setupNetworkErrorHandler();
    
    apiLogger.info('GlobalErrorHandler initialized', {
      sessionId: this.sessionId,
      config: this.config,
    });
  }

  // Setup global error handler for unhandled JavaScript errors
  private setupGlobalErrorHandler(): void {
    if (!this.config.enableGlobalHandler) return;

    // React Native global error handler
    const globalThis = global as any;
    const originalHandler = globalThis.ErrorUtils?.getGlobalHandler();
    
    if (globalThis.ErrorUtils?.setGlobalHandler) {
      globalThis.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
        this.handleError({
          type: 'javascript',
          message: error.message,
          stack: error.stack,
          fatal: isFatal,
          handled: false,
          context: {
            originalHandler: !!originalHandler,
            errorName: error.name,
          },
        });

        // Call original handler if it exists
        if (originalHandler) {
          originalHandler(error, isFatal);
        }
      });
    }

    apiLogger.debug('Global error handler setup complete');
  }

  // Setup promise rejection handler
  private setupPromiseRejectionHandler(): void {
    if (!this.config.enablePromiseRejectionHandler) return;

    // Handle unhandled promise rejections
    const handleRejection = (event: any) => {
      const reason = event.reason || event.detail?.reason;
      
      this.handleError({
        type: 'promise_rejection',
        message: reason?.message || String(reason),
        stack: reason?.stack,
        fatal: false,
        handled: false,
        context: {
          promise: event.promise?.constructor?.name,
          reasonType: typeof reason,
        },
      });
    };

    // For React Native
    if (typeof global !== 'undefined' && global.addEventListener) {
      global.addEventListener('unhandledrejection', handleRejection);
    }

    // For web environments (if running in WebView)
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('unhandledrejection', handleRejection);
    }

    apiLogger.debug('Promise rejection handler setup complete');
  }

  // Setup network error handler
  private setupNetworkErrorHandler(): void {
    if (!this.config.enableNetworkErrorHandler) return;

    // Monkey patch fetch to catch network errors
    const originalFetch = global.fetch;
    
    global.fetch = async (...args: any[]) => {
      try {
        const response = await originalFetch.apply(global, args);
        
        // Log failed HTTP responses
        if (!response.ok) {
          this.handleError({
            type: 'network',
            message: `HTTP ${response.status}: ${response.statusText}`,
            fatal: false,
            handled: true,
            context: {
              url: args[0],
              status: response.status,
              statusText: response.statusText,
              method: args[1]?.method || 'GET',
            },
          });
        }
        
        return response;
      } catch (networkError) {
        this.handleError({
          type: 'network',
          message: (networkError as Error).message,
          stack: (networkError as Error).stack,
          fatal: false,
          handled: true,
          context: {
            url: args[0],
            method: args[1]?.method || 'GET',
            errorType: 'fetch_error',
          },
        });
        
        throw networkError; // Re-throw the error
      }
    };

    apiLogger.debug('Network error handler setup complete');
  }

  // Handle error with intelligent filtering and reporting
  handleError(errorInfo: Partial<ErrorReport>): string {
    const now = Date.now();
    
    // Generate unique error ID
    const errorId = this.generateErrorId();
    
    // Create full error report
    const errorReport: ErrorReport = {
      id: errorId,
      timestamp: now,
      type: errorInfo.type || 'javascript',
      message: errorInfo.message || 'Unknown error',
      stack: errorInfo.stack,
      context: this.sanitizeContext(errorInfo.context),
      userAgent: this.getUserAgent(),
      url: this.getCurrentUrl(),
      sessionId: this.sessionId,
      buildVersion: this.getBuildVersion(),
      fatal: errorInfo.fatal || false,
      handled: errorInfo.handled || false,
      reportedToUser: false,
      ...errorInfo,
    };

    // Check if error should be filtered
    if (this.shouldFilterError(errorReport)) {
      apiLogger.debug('Error filtered', { 
        errorId,
        message: errorReport.message,
        reason: 'rate_limit_or_duplicate' 
      });
      return errorId;
    }

    // Log the error
    this.logError(errorReport);
    
    // Store error
    this.storeError(errorReport);
    
    // Report to user if needed
    if (this.shouldReportToUser(errorReport)) {
      this.reportToUser(errorReport);
    }
    
    // Report to crash reporting service
    if (this.config.reportToCrashlytics) {
      this.reportToCrashlytics(errorReport);
    }

    return errorId;
  }

  // Check if error should be filtered (rate limiting, duplicates)
  private shouldFilterError(error: ErrorReport): boolean {
    const now = Date.now();
    
    // Rate limiting - max errors per minute
    const recentErrors = this.errors.filter(e => now - e.timestamp < 60000);
    if (recentErrors.length >= this.config.maxErrorsPerMinute) {
      return true;
    }
    
    // Session limit
    if (this.errors.length >= this.config.maxErrorsPerSession) {
      return true;
    }
    
    // Cooldown period
    if (now - this.lastErrorTime < this.ERROR_COOLDOWN) {
      return true;
    }
    
    // Duplicate error detection (same message within 1 minute)
    const duplicateError = this.errors.find(e => 
      e.message === error.message && 
      e.type === error.type &&
      now - e.timestamp < 60000
    );
    
    if (duplicateError) {
      return true;
    }
    
    return false;
  }

  // Log error with appropriate level
  private logError(error: ErrorReport): void {
    const logContext = {
      errorId: error.id,
      type: error.type,
      fatal: error.fatal,
      handled: error.handled,
      sessionId: error.sessionId,
      context: error.context,
    };

    if (error.fatal) {
      apiLogger.critical(error.message, logContext, new Error(error.stack));
    } else if (error.type === 'network' || error.handled) {
      apiLogger.warn(error.message, logContext);
    } else {
      apiLogger.error(error.message, logContext);
    }

    this.lastErrorTime = error.timestamp;
  }

  // Store error in memory (with limit)
  private storeError(error: ErrorReport): void {
    this.errors.push(error);
    
    // Maintain size limit
    if (this.errors.length > this.MAX_STORED_ERRORS) {
      this.errors = this.errors.slice(-this.MAX_STORED_ERRORS);
    }

    // Update error counts
    const errorKey = `${error.type}_${error.message}`;
    this.errorCounts.set(errorKey, (this.errorCounts.get(errorKey) || 0) + 1);
  }

  // Check if error should be reported to user
  private shouldReportToUser(error: ErrorReport): boolean {
    if (!this.config.reportToUser) return false;
    if (error.handled && error.type !== 'api') return false;
    if (error.fatal) return true;
    if (error.type === 'business_logic') return true;
    
    return false;
  }

  // Report error to user via notification
  private reportToUser(error: ErrorReport): void {
    const userMessage = this.getUserFriendlyMessage(error);
    
    notificationManager.sendNotification({
      type: NotificationType.ERROR_ALERT,
      priority: error.fatal ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
      title: 'Application Error',
      message: userMessage,
      data: {
        errorId: error.id,
        errorType: error.type,
        canRetry: this.canRetry(error),
      },
      persistent: error.fatal,
      actions: error.fatal ? [] : [
        {
          id: 'retry',
          title: 'Retry',
          type: 'button',
          data: { action: 'retry', errorId: error.id },
        },
        {
          id: 'dismiss',
          title: 'Dismiss',
          type: 'button',
        },
      ],
    });

    error.reportedToUser = true;
    apiLogger.info('Error reported to user', { errorId: error.id, message: userMessage });
  }

  // Generate user-friendly error message
  private getUserFriendlyMessage(error: ErrorReport): string {
    switch (error.type) {
      case 'network':
        return 'Network connection problem. Please check your internet connection.';
      case 'api':
        return 'Service temporarily unavailable. Please try again later.';
      case 'business_logic':
        return error.message; // Business logic errors are usually user-friendly
      case 'javascript':
      case 'promise_rejection':
        return 'An unexpected error occurred. The app will attempt to recover.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }

  // Check if error can be retried
  private canRetry(error: ErrorReport): boolean {
    return error.type === 'network' || error.type === 'api';
  }

  // Report to crash reporting service (Crashlytics, Sentry, etc.)
  private reportToCrashlytics(error: ErrorReport): void {
    // Mock implementation - replace with actual crash reporting service
    apiLogger.info('Reporting to crashlytics', {
      errorId: error.id,
      service: 'mock_crashlytics',
      fatal: error.fatal,
    });
    
    // Example for Sentry:
    // Sentry.captureException(new Error(error.message), {
    //   tags: {
    //     errorType: error.type,
    //     sessionId: error.sessionId,
    //   },
    //   extra: error.context,
    //   level: error.fatal ? 'fatal' : 'error',
    // });
  }

  // Sanitize context to remove sensitive data
  private sanitizeContext(context?: Record<string, any>): Record<string, any> | undefined {
    if (!context) return undefined;
    if (!this.config.filterSensitiveData) return context;

    const sensitiveKeys = ['password', 'token', 'api_key', 'secret', 'auth', 'credentials'];
    const sanitized = { ...context };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some(sensitive => key.toLowerCase().includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  // Get current user agent
  private getUserAgent(): string {
    if (typeof navigator !== 'undefined' && navigator.userAgent) {
      return navigator.userAgent;
    }
    return 'React Native App';
  }

  // Get current URL (for web environments)
  private getCurrentUrl(): string {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.href;
    }
    return 'app://react-native';
  }

  // Get build version
  private getBuildVersion(): string {
    // In a real app, this would come from app.json or build configuration
    return '1.0.0';
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique error ID
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Get default configuration
  private getDefaultConfig(): ErrorHandlerConfig {
    return {
      enableGlobalHandler: true,
      enablePromiseRejectionHandler: true,
      enableNetworkErrorHandler: true,
      reportToUser: true,
      reportToCrashlytics: !__DEV__, // Only in production
      maxErrorsPerSession: 50,
      maxErrorsPerMinute: 10,
      enableErrorReporting: true,
      filterSensitiveData: true,
    };
  }

  // Update configuration
  updateConfig(config: Partial<ErrorHandlerConfig>): void {
    this.config = { ...this.config, ...config };
    apiLogger.info('Error handler config updated', { config: this.config });
  }

  // Get error statistics
  getErrorStats(): {
    totalErrors: number;
    errorsByType: Record<string, number>;
    errorsByHour: Record<string, number>;
    sessionId: string;
    recentErrors: ErrorReport[];
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const errorsByType = this.errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByHour = this.errors
      .filter(error => error.timestamp > oneHourAgo)
      .reduce((acc, error) => {
        const hour = new Date(error.timestamp).getHours().toString();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    const recentErrors = this.errors
      .filter(error => error.timestamp > oneHourAgo)
      .slice(-10); // Last 10 errors

    return {
      totalErrors: this.errors.length,
      errorsByType,
      errorsByHour,
      sessionId: this.sessionId,
      recentErrors,
    };
  }

  // Get specific error by ID
  getError(errorId: string): ErrorReport | undefined {
    return this.errors.find(error => error.id === errorId);
  }

  // Clear stored errors
  clearErrors(): void {
    this.errors = [];
    this.errorCounts.clear();
    apiLogger.info('Error history cleared');
  }

  // Test error reporting (for development)
  testErrorReporting(): void {
    if (__DEV__) {
      this.handleError({
        type: 'javascript',
        message: 'Test error for development',
        fatal: false,
        handled: true,
        context: { test: true },
      });
    }
  }
}

// Export singleton instance
export const globalErrorHandler = new GlobalErrorHandler();

// Helper functions for manual error reporting
export const reportError = (
  message: string,
  context?: Record<string, any>,
  fatal: boolean = false
): string => {
  return globalErrorHandler.handleError({
    type: 'business_logic',
    message,
    context,
    fatal,
    handled: true,
  });
};

export const reportAPIError = (
  endpoint: string,
  status: number,
  message: string,
  context?: Record<string, any>
): string => {
  return globalErrorHandler.handleError({
    type: 'api',
    message: `API Error ${status}: ${message}`,
    context: {
      endpoint,
      status,
      ...context,
    },
    fatal: false,
    handled: true,
  });
};

export const reportNetworkError = (
  url: string,
  error: Error,
  context?: Record<string, any>
): string => {
  return globalErrorHandler.handleError({
    type: 'network',
    message: error.message,
    stack: error.stack,
    context: {
      url,
      ...context,
    },
    fatal: false,
    handled: true,
  });
};

export { GlobalErrorHandler };
export default globalErrorHandler;

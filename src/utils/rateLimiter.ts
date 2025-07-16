// Rate limiting system to prevent API abuse and respect rate limits

import { apiLogger } from './logger';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  keyGenerator?: (params: any) => string;
}

export interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequestTime: number;
}

export enum RateLimitResult {
  ALLOWED = 'allowed',
  RATE_LIMITED = 'rate_limited',
  ERROR = 'error',
}

export interface RateLimitResponse {
  result: RateLimitResult;
  remainingRequests?: number;
  resetTime?: number;
  retryAfter?: number; // seconds to wait
}

class RateLimiter {
  private entries = new Map<string, RateLimitEntry>();
  private config: RateLimitConfig;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.config = config;
    
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    
    apiLogger.debug('RateLimiter initialized', {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
    });
  }

  // Check if request is allowed
  checkLimit(key: string, context?: Record<string, any>): RateLimitResponse {
    try {
      const now = Date.now();
      const entry = this.entries.get(key);

      // No previous requests for this key
      if (!entry) {
        this.entries.set(key, {
          count: 1,
          resetTime: now + this.config.windowMs,
          firstRequestTime: now,
        });

        apiLogger.debug('Rate limit: First request allowed', {
          key,
          remainingRequests: this.config.maxRequests - 1,
          ...context,
        });

        return {
          result: RateLimitResult.ALLOWED,
          remainingRequests: this.config.maxRequests - 1,
          resetTime: now + this.config.windowMs,
        };
      }

      // Window has expired, reset counter
      if (now >= entry.resetTime) {
        this.entries.set(key, {
          count: 1,
          resetTime: now + this.config.windowMs,
          firstRequestTime: now,
        });

        apiLogger.debug('Rate limit: Window reset, request allowed', {
          key,
          remainingRequests: this.config.maxRequests - 1,
          ...context,
        });

        return {
          result: RateLimitResult.ALLOWED,
          remainingRequests: this.config.maxRequests - 1,
          resetTime: now + this.config.windowMs,
        };
      }

      // Within window, check if limit exceeded
      if (entry.count >= this.config.maxRequests) {
        const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
        
        apiLogger.warn('Rate limit exceeded', {
          key,
          currentCount: entry.count,
          maxRequests: this.config.maxRequests,
          retryAfter,
          ...context,
        });

        return {
          result: RateLimitResult.RATE_LIMITED,
          remainingRequests: 0,
          resetTime: entry.resetTime,
          retryAfter,
        };
      }

      // Increment counter and allow request
      entry.count++;
      this.entries.set(key, entry);

      apiLogger.debug('Rate limit: Request allowed', {
        key,
        currentCount: entry.count,
        remainingRequests: this.config.maxRequests - entry.count,
        ...context,
      });

      return {
        result: RateLimitResult.ALLOWED,
        remainingRequests: this.config.maxRequests - entry.count,
        resetTime: entry.resetTime,
      };

    } catch (error) {
      apiLogger.error('Rate limiter error', { key, error: error as Error, ...context });
      
      // Fail open - allow request on error
      return {
        result: RateLimitResult.ERROR,
      };
    }
  }

  // Get current status for a key
  getStatus(key: string): RateLimitResponse {
    const entry = this.entries.get(key);
    const now = Date.now();

    if (!entry || now >= entry.resetTime) {
      return {
        result: RateLimitResult.ALLOWED,
        remainingRequests: this.config.maxRequests,
        resetTime: now + this.config.windowMs,
      };
    }

    const remainingRequests = Math.max(0, this.config.maxRequests - entry.count);
    const retryAfter = remainingRequests === 0 ? Math.ceil((entry.resetTime - now) / 1000) : undefined;

    return {
      result: remainingRequests > 0 ? RateLimitResult.ALLOWED : RateLimitResult.RATE_LIMITED,
      remainingRequests,
      resetTime: entry.resetTime,
      retryAfter,
    };
  }

  // Reset rate limit for specific key
  reset(key: string): void {
    this.entries.delete(key);
    apiLogger.debug('Rate limit reset', { key });
  }

  // Reset all rate limits
  resetAll(): void {
    const count = this.entries.size;
    this.entries.clear();
    apiLogger.info('All rate limits reset', { clearedEntries: count });
  }

  // Clean up expired entries
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.entries) {
      if (now >= entry.resetTime) {
        this.entries.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      apiLogger.debug('Rate limiter cleanup completed', {
        cleanedEntries: cleaned,
        remainingEntries: this.entries.size,
      });
    }
  }

  // Get current stats
  getStats(): {
    totalKeys: number;
    activeKeys: number;
    config: RateLimitConfig;
  } {
    const now = Date.now();
    let activeKeys = 0;

    for (const [, entry] of this.entries) {
      if (now < entry.resetTime && entry.count > 0) {
        activeKeys++;
      }
    }

    return {
      totalKeys: this.entries.size,
      activeKeys,
      config: this.config,
    };
  }

  // Cleanup resources
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.entries.clear();
    apiLogger.info('RateLimiter destroyed');
  }
}

// Rate limiter factory and presets
class RateLimiterFactory {
  private static limiters = new Map<string, RateLimiter>();

  // Create or get rate limiter
  static create(name: string, config: RateLimitConfig): RateLimiter {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new RateLimiter(config));
    }
    return this.limiters.get(name)!;
  }

  // Get existing rate limiter
  static get(name: string): RateLimiter | undefined {
    return this.limiters.get(name);
  }

  // Destroy rate limiter
  static destroy(name: string): void {
    const limiter = this.limiters.get(name);
    if (limiter) {
      limiter.destroy();
      this.limiters.delete(name);
    }
  }

  // Destroy all rate limiters
  static destroyAll(): void {
    for (const [name, limiter] of this.limiters) {
      limiter.destroy();
    }
    this.limiters.clear();
  }

  // Get all rate limiters
  static getAll(): Map<string, RateLimiter> {
    return new Map(this.limiters);
  }
}

// Predefined rate limiters for different APIs
export const apiRateLimiters = {
  // Alpha Vantage: 5 requests per minute for free tier
  alphaVantage: RateLimiterFactory.create('alphaVantage', {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (params) => `av_${params.function || 'default'}`,
  }),

  // CoinGecko: 10-50 requests per minute depending on plan
  coinGecko: RateLimiterFactory.create('coinGecko', {
    maxRequests: 10,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (params) => `cg_${params.endpoint || 'default'}`,
  }),

  // Yahoo Finance: More lenient but still limit
  yahooFinance: RateLimiterFactory.create('yahooFinance', {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (params) => `yf_${params.symbol || 'default'}`,
  }),

  // General API limiter
  general: RateLimiterFactory.create('general', {
    maxRequests: 20,
    windowMs: 60 * 1000, // 1 minute
    keyGenerator: (params) => `general_${params.service || 'default'}`,
  }),
};

// Helper function to check rate limit with automatic key generation
export function checkRateLimit(
  limiterName: string,
  params: any = {},
  context?: Record<string, any>
): RateLimitResponse {
  const limiter = RateLimiterFactory.get(limiterName);
  
  if (!limiter) {
    apiLogger.error('Rate limiter not found', { limiterName, ...context });
    return { result: RateLimitResult.ERROR };
  }

  const key = limiter['config'].keyGenerator?.(params) || 'default';
  return limiter.checkLimit(key, { params, ...context });
}

// Decorator for rate limiting functions
export function rateLimited(limiterName: string, keyGenerator?: (args: any[]) => string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const key = keyGenerator ? keyGenerator(args) : 'default';
      const limiter = RateLimiterFactory.get(limiterName);

      if (!limiter) {
        apiLogger.warn('Rate limiter not found, proceeding without limit', { limiterName });
        return method.apply(this, args);
      }

      const result = limiter.checkLimit(key, { method: propertyName, args: args.length });

      if (result.result === RateLimitResult.RATE_LIMITED) {
        throw new Error(`Rate limit exceeded. Retry after ${result.retryAfter} seconds.`);
      }

      if (result.result === RateLimitResult.ERROR) {
        apiLogger.warn('Rate limiter error, proceeding without limit', { limiterName });
      }

      return method.apply(this, args);
    };
  };
}

export { RateLimiter, RateLimiterFactory };
export default RateLimiterFactory;

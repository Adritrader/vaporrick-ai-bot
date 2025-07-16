// Circuit Breaker Pattern implementation
// Prevents cascading failures when external services are down

export enum CircuitState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Circuit breaker tripped, failing fast
  HALF_OPEN = 'HALF_OPEN' // Testing if service is back up
}

export interface CircuitBreakerConfig {
  failureThreshold: number;    // Number of failures before opening circuit
  resetTimeout: number;        // Time in ms before attempting to close circuit
  monitoringPeriod: number;    // Time window for counting failures
  successThreshold: number;    // Successes needed in HALF_OPEN to close circuit
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  lastSuccessTime: number;
  nextAttemptTime: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private lastSuccessTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {
    console.log(`🔌 Circuit breaker "${name}" initialized:`, config);
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        const waitTime = Math.ceil((this.nextAttemptTime - Date.now()) / 1000);
        throw new Error(`Circuit breaker "${this.name}" is OPEN. Try again in ${waitTime}s`);
      } else {
        // Transition to HALF_OPEN to test the service
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`🔄 Circuit breaker "${this.name}" transitioning to HALF_OPEN`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.reset();
        console.log(`✅ Circuit breaker "${this.name}" closed after successful recovery`);
      }
    } else {
      // Reset failure count on success in CLOSED state
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Go back to OPEN state
      this.openCircuit();
      console.log(`❌ Circuit breaker "${this.name}" failed during HALF_OPEN, going back to OPEN`);
    } else if (this.failureCount >= this.config.failureThreshold) {
      this.openCircuit();
      console.log(`🚨 Circuit breaker "${this.name}" OPENED due to ${this.failureCount} failures`);
    }
  }

  private openCircuit(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttemptTime = 0;
  }

  // Manual circuit control
  forceOpen(): void {
    this.state = CircuitState.OPEN;
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;
    console.log(`🔐 Circuit breaker "${this.name}" manually OPENED`);
  }

  forceClose(): void {
    this.reset();
    console.log(`🔓 Circuit breaker "${this.name}" manually CLOSED`);
  }

  // Get current stats
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      nextAttemptTime: this.nextAttemptTime,
    };
  }

  // Check if circuit breaker allows requests
  isRequestAllowed(): boolean {
    if (this.state === CircuitState.CLOSED || this.state === CircuitState.HALF_OPEN) {
      return true;
    }

    if (this.state === CircuitState.OPEN && Date.now() >= this.nextAttemptTime) {
      return true; // Allow one request to test the service
    }

    return false;
  }
}

// Factory for creating circuit breakers with common configurations
export class CircuitBreakerFactory {
  private static breakers = new Map<string, CircuitBreaker>();

  static createApiCircuitBreaker(name: string): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const config: CircuitBreakerConfig = {
      failureThreshold: 5,        // 5 failures before opening
      resetTimeout: 60000,        // 1 minute before attempting to close
      monitoringPeriod: 300000,   // 5 minute monitoring window
      successThreshold: 3,        // 3 successes to close from HALF_OPEN
    };

    const breaker = new CircuitBreaker(name, config);
    this.breakers.set(name, breaker);
    return breaker;
  }

  static createDatabaseCircuitBreaker(name: string): CircuitBreaker {
    if (this.breakers.has(name)) {
      return this.breakers.get(name)!;
    }

    const config: CircuitBreakerConfig = {
      failureThreshold: 3,        // 3 failures before opening
      resetTimeout: 30000,        // 30 seconds before attempting to close
      monitoringPeriod: 120000,   // 2 minute monitoring window
      successThreshold: 2,        // 2 successes to close from HALF_OPEN
    };

    const breaker = new CircuitBreaker(name, config);
    this.breakers.set(name, breaker);
    return breaker;
  }

  static getAllBreakers(): Map<string, CircuitBreaker> {
    return new Map(this.breakers);
  }

  static getBreakerStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }
}

export default CircuitBreaker;

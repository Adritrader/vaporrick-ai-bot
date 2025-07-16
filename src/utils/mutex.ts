// Mutex utility for preventing race conditions
// Simple implementation for React Native AsyncStorage operations

class SimpleMutex {
  private locks = new Map<string, Promise<any>>();

  async acquire<T>(key: string, operation: () => Promise<T>): Promise<T> {
    // If there's already an operation for this key, wait for it
    const existingLock = this.locks.get(key);
    if (existingLock) {
      console.log(`🔒 Waiting for existing operation on key: ${key}`);
      await existingLock;
    }

    // Create new lock for this operation
    const currentOperation = this.executeOperation(key, operation);
    this.locks.set(key, currentOperation);

    try {
      const result = await currentOperation;
      return result;
    } finally {
      // Clean up lock when operation completes
      this.locks.delete(key);
    }
  }

  private async executeOperation<T>(key: string, operation: () => Promise<T>): Promise<T> {
    try {
      console.log(`🔐 Executing operation for key: ${key}`);
      const result = await operation();
      console.log(`✅ Operation completed for key: ${key}`);
      return result;
    } catch (error) {
      console.error(`❌ Operation failed for key: ${key}`, error);
      throw error;
    }
  }

  // Check if a key is currently locked
  isLocked(key: string): boolean {
    return this.locks.has(key);
  }

  // Get count of active locks (for debugging)
  getActiveLockCount(): number {
    return this.locks.size;
  }

  // Clear all locks (emergency use only)
  clearAllLocks(): void {
    console.warn('🚨 Clearing all mutex locks - this may cause issues');
    this.locks.clear();
  }
}

// Export singleton instance
export const cacheMutex = new SimpleMutex();

// Utility function for cache operations
export const withCacheLock = async <T>(
  key: string,
  operation: () => Promise<T>
): Promise<T> => {
  return cacheMutex.acquire(`cache_${key}`, operation);
};

export default SimpleMutex;

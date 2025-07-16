// Request deduplication utility
// Prevents multiple identical requests from running simultaneously

class RequestDeduplicator {
  private pendingRequests = new Map<string, Promise<any>>();

  async deduplicate<T>(
    key: string,
    requestFunction: () => Promise<T>,
    ttl: number = 30000 // 30 seconds TTL for deduplication
  ): Promise<T> {
    // Check if there's already a pending request for this key
    const existingRequest = this.pendingRequests.get(key);
    if (existingRequest) {
      console.log(`🔄 Deduplicating request for key: ${key}`);
      return existingRequest as Promise<T>;
    }

    // Create new request
    console.log(`🆕 Creating new request for key: ${key}`);
    const requestPromise = this.executeRequest(key, requestFunction, ttl);
    
    // Store the request promise
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  private async executeRequest<T>(
    key: string,
    requestFunction: () => Promise<T>,
    ttl: number
  ): Promise<T> {
    try {
      // Set TTL cleanup
      const cleanup = () => {
        this.pendingRequests.delete(key);
        console.log(`🧹 Cleaned up request cache for key: ${key}`);
      };

      // Auto-cleanup after TTL
      const timeoutId = setTimeout(cleanup, ttl);

      // Execute the request
      const result = await requestFunction();
      
      // Clear timeout and cleanup immediately on success
      clearTimeout(timeoutId);
      cleanup();
      
      console.log(`✅ Request completed for key: ${key}`);
      return result;
    } catch (error) {
      // Cleanup on error too
      this.pendingRequests.delete(key);
      console.error(`❌ Request failed for key: ${key}`, error);
      throw error;
    }
  }

  // Get pending request count (for monitoring)
  getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  // Get pending request keys (for debugging)
  getPendingRequestKeys(): string[] {
    return Array.from(this.pendingRequests.keys());
  }

  // Force clear all pending requests (emergency use only)
  clearAllRequests(): void {
    console.warn('🚨 Clearing all pending requests - this may cause issues');
    this.pendingRequests.clear();
  }

  // Check if a request is pending
  isRequestPending(key: string): boolean {
    return this.pendingRequests.has(key);
  }
}

// Export singleton instance
export const requestDeduplicator = new RequestDeduplicator();

// Utility function for API requests
export const deduplicateApiRequest = async <T>(
  endpoint: string,
  params: Record<string, any>,
  requestFunction: () => Promise<T>,
  ttl: number = 30000
): Promise<T> => {
  // Create unique key from endpoint and params
  const key = `${endpoint}_${JSON.stringify(params)}`;
  return requestDeduplicator.deduplicate(key, requestFunction, ttl);
};

export default RequestDeduplicator;

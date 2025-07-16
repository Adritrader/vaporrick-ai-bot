// Intelligent persistence manager with caching, compression, and conflict resolution

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogger } from './logger';
import { withCacheLock } from './mutex';

export interface PersistenceConfig {
  compress: boolean;
  encrypt: boolean;
  ttl: number; // Time to live in milliseconds
  maxSize: number; // Maximum size in bytes
  conflictResolution: 'overwrite' | 'merge' | 'reject';
}

export interface StoredData<T = any> {
  data: T;
  timestamp: number;
  version: number;
  checksum?: string;
  compressed?: boolean;
  encrypted?: boolean;
  ttl?: number;
}

export enum PersistenceResult {
  SUCCESS = 'success',
  ERROR = 'error',
  EXPIRED = 'expired',
  CONFLICT = 'conflict',
  SIZE_EXCEEDED = 'size_exceeded',
  VALIDATION_FAILED = 'validation_failed',
}

export interface PersistenceResponse<T = any> {
  result: PersistenceResult;
  data?: T;
  error?: string;
  metadata?: {
    size: number;
    age: number;
    version: number;
  };
}

class PersistenceManager {
  private cache = new Map<string, StoredData>();
  private defaultConfig: PersistenceConfig = {
    compress: false,
    encrypt: false,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 1024 * 1024, // 1MB
    conflictResolution: 'overwrite',
  };

  // Store data with intelligent persistence
  async store<T>(
    key: string,
    data: T,
    config: Partial<PersistenceConfig> = {}
  ): Promise<PersistenceResponse<T>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    
    return withCacheLock(`persistence_${key}`, async () => {
      try {
        apiLogger.debug('Storing data', { key, config: finalConfig });

        // Validate data size
        const serializedData = JSON.stringify(data);
        if (serializedData.length > finalConfig.maxSize) {
          apiLogger.warn('Data size exceeds maximum', {
            key,
            size: serializedData.length,
            maxSize: finalConfig.maxSize,
          });
          return {
            result: PersistenceResult.SIZE_EXCEEDED,
            error: `Data size (${serializedData.length}) exceeds maximum (${finalConfig.maxSize})`,
          };
        }

        // Check for existing data and handle conflicts
        const existing = await this.getStoredData(key);
        if (existing && existing.result === PersistenceResult.SUCCESS) {
          const conflictResult = await this.handleConflict(key, data, existing.data!, finalConfig);
          if (conflictResult.result !== PersistenceResult.SUCCESS) {
            return conflictResult;
          }
          data = conflictResult.data!;
        }

        // Prepare stored data object
        const storedData: StoredData<T> = {
          data,
          timestamp: Date.now(),
          version: existing?.metadata?.version ? existing.metadata.version + 1 : 1,
          ttl: finalConfig.ttl,
        };

        // Generate checksum for integrity
        storedData.checksum = await this.generateChecksum(data);

        // Compress if enabled
        if (finalConfig.compress) {
          storedData.data = await this.compress(data);
          storedData.compressed = true;
        }

        // Encrypt if enabled
        if (finalConfig.encrypt) {
          storedData.data = await this.encrypt(storedData.data);
          storedData.encrypted = true;
        }

        // Store in AsyncStorage
        await AsyncStorage.setItem(key, JSON.stringify(storedData));

        // Update memory cache
        this.cache.set(key, storedData);

        apiLogger.debug('Data stored successfully', {
          key,
          version: storedData.version,
          size: JSON.stringify(storedData).length,
          compressed: storedData.compressed,
          encrypted: storedData.encrypted,
        });

        return {
          result: PersistenceResult.SUCCESS,
          data,
          metadata: {
            size: JSON.stringify(storedData).length,
            age: 0,
            version: storedData.version,
          },
        };

      } catch (error) {
        apiLogger.error('Failed to store data', { key, error: error as Error });
        return {
          result: PersistenceResult.ERROR,
          error: (error as Error).message,
        };
      }
    });
  }

  // Retrieve data with intelligent caching
  async retrieve<T>(key: string): Promise<PersistenceResponse<T>> {
    try {
      apiLogger.debug('Retrieving data', { key });

      // Check memory cache first
      const cached = this.cache.get(key);
      if (cached && this.isDataValid(cached)) {
        apiLogger.debug('Data retrieved from memory cache', { key });
        return {
          result: PersistenceResult.SUCCESS,
          data: cached.data as T,
          metadata: {
            size: JSON.stringify(cached).length,
            age: Date.now() - cached.timestamp,
            version: cached.version,
          },
        };
      }

      // Retrieve from AsyncStorage
      const stored = await AsyncStorage.getItem(key);
      if (!stored) {
        return {
          result: PersistenceResult.ERROR,
          error: 'Data not found',
        };
      }

      let storedData: StoredData<T>;
      try {
        storedData = JSON.parse(stored);
      } catch (parseError) {
        apiLogger.error('Failed to parse stored data', { key, error: parseError as Error });
        return {
          result: PersistenceResult.ERROR,
          error: 'Invalid data format',
        };
      }

      // Check if data is expired
      if (!this.isDataValid(storedData)) {
        await this.remove(key);
        return {
          result: PersistenceResult.EXPIRED,
          error: 'Data has expired',
        };
      }

      // Decrypt if needed
      let data = storedData.data;
      if (storedData.encrypted) {
        data = await this.decrypt(data);
      }

      // Decompress if needed
      if (storedData.compressed) {
        data = await this.decompress(data);
      }

      // Verify checksum if available
      if (storedData.checksum) {
        const expectedChecksum = await this.generateChecksum(data);
        if (expectedChecksum !== storedData.checksum) {
          apiLogger.warn('Data integrity check failed', { key, expected: expectedChecksum, actual: storedData.checksum });
          return {
            result: PersistenceResult.VALIDATION_FAILED,
            error: 'Data integrity check failed',
          };
        }
      }

      // Update memory cache
      this.cache.set(key, { ...storedData, data });

      apiLogger.debug('Data retrieved successfully', {
        key,
        version: storedData.version,
        age: Date.now() - storedData.timestamp,
      });

      return {
        result: PersistenceResult.SUCCESS,
        data: data as T,
        metadata: {
          size: stored.length,
          age: Date.now() - storedData.timestamp,
          version: storedData.version,
        },
      };

    } catch (error) {
      apiLogger.error('Failed to retrieve data', { key, error: error as Error });
      return {
        result: PersistenceResult.ERROR,
        error: (error as Error).message,
      };
    }
  }

  // Remove data
  async remove(key: string): Promise<PersistenceResponse> {
    return withCacheLock(`persistence_${key}`, async () => {
      try {
        await AsyncStorage.removeItem(key);
        this.cache.delete(key);
        
        apiLogger.debug('Data removed', { key });
        
        return {
          result: PersistenceResult.SUCCESS,
        };
      } catch (error) {
        apiLogger.error('Failed to remove data', { key, error: error as Error });
        return {
          result: PersistenceResult.ERROR,
          error: (error as Error).message,
        };
      }
    });
  }

  // Get stored data metadata without retrieving full data
  private async getStoredData(key: string): Promise<PersistenceResponse> {
    try {
      const stored = await AsyncStorage.getItem(key);
      if (!stored) {
        return {
          result: PersistenceResult.ERROR,
          error: 'Data not found',
        };
      }

      const storedData: StoredData = JSON.parse(stored);
      return {
        result: PersistenceResult.SUCCESS,
        data: storedData.data,
        metadata: {
          size: stored.length,
          age: Date.now() - storedData.timestamp,
          version: storedData.version,
        },
      };
    } catch (error) {
      return {
        result: PersistenceResult.ERROR,
        error: (error as Error).message,
      };
    }
  }

  // Handle data conflicts
  private async handleConflict<T>(
    key: string,
    newData: T,
    existingData: T,
    config: PersistenceConfig
  ): Promise<PersistenceResponse<T>> {
    switch (config.conflictResolution) {
      case 'overwrite':
        return {
          result: PersistenceResult.SUCCESS,
          data: newData,
        };

      case 'reject':
        return {
          result: PersistenceResult.CONFLICT,
          error: 'Data conflict - new data rejected',
          data: existingData,
        };

      case 'merge':
        try {
          const mergedData = await this.mergeData(existingData, newData);
          return {
            result: PersistenceResult.SUCCESS,
            data: mergedData,
          };
        } catch (mergeError) {
          apiLogger.error('Failed to merge data', { key, error: mergeError as Error });
          return {
            result: PersistenceResult.CONFLICT,
            error: 'Failed to merge conflicting data',
            data: existingData,
          };
        }

      default:
        return {
          result: PersistenceResult.SUCCESS,
          data: newData,
        };
    }
  }

  // Merge two data objects intelligently
  private async mergeData<T>(existing: T, incoming: T): Promise<T> {
    // Simple merge for objects
    if (typeof existing === 'object' && typeof incoming === 'object' && existing !== null && incoming !== null) {
      return { ...existing, ...incoming };
    }
    
    // For arrays, concatenate and deduplicate
    if (Array.isArray(existing) && Array.isArray(incoming)) {
      const combined = [...existing, ...incoming];
      return Array.from(new Set(combined)) as unknown as T;
    }
    
    // For primitives, prefer incoming
    return incoming;
  }

  // Check if data is still valid (not expired)
  private isDataValid(storedData: StoredData): boolean {
    if (!storedData.ttl) return true;
    
    const age = Date.now() - storedData.timestamp;
    return age < storedData.ttl;
  }

  // Generate checksum for data integrity
  private async generateChecksum(data: any): Promise<string> {
    // Simple checksum using JSON string and basic hashing
    const str = JSON.stringify(data);
    let hash = 0;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(36);
  }

  // Compress data (mock implementation)
  private async compress<T>(data: T): Promise<T> {
    // In a real implementation, you would use a compression library
    // For now, just return the data as-is
    apiLogger.debug('Compressing data (mock)');
    return data;
  }

  // Decompress data (mock implementation)
  private async decompress<T>(data: T): Promise<T> {
    // In a real implementation, you would decompress the data
    // For now, just return the data as-is
    apiLogger.debug('Decompressing data (mock)');
    return data;
  }

  // Encrypt data (mock implementation)
  private async encrypt<T>(data: T): Promise<T> {
    // In a real implementation, you would encrypt the data
    // For now, just return the data as-is
    apiLogger.debug('Encrypting data (mock)');
    return data;
  }

  // Decrypt data (mock implementation)
  private async decrypt<T>(data: T): Promise<T> {
    // In a real implementation, you would decrypt the data
    // For now, just return the data as-is
    apiLogger.debug('Decrypting data (mock)');
    return data;
  }

  // Clear all cached data
  clearCache(): void {
    this.cache.clear();
    apiLogger.info('Persistence cache cleared');
  }

  // Get cache statistics
  getCacheStats(): {
    size: number;
    keys: string[];
    totalMemoryUsage: number;
  } {
    const keys = Array.from(this.cache.keys());
    const totalMemoryUsage = keys.reduce((total, key) => {
      const data = this.cache.get(key);
      return total + (data ? JSON.stringify(data).length : 0);
    }, 0);

    return {
      size: this.cache.size,
      keys,
      totalMemoryUsage,
    };
  }

  // Clean up expired data
  async cleanupExpired(): Promise<{
    removedKeys: string[];
    totalRemoved: number;
  }> {
    const removedKeys: string[] = [];
    
    try {
      // Check memory cache
      for (const [key, data] of this.cache.entries()) {
        if (!this.isDataValid(data)) {
          this.cache.delete(key);
          removedKeys.push(key);
        }
      }

      // Check AsyncStorage (this would be expensive for large datasets)
      // In a real implementation, you might want to store an index of keys with TTL
      const allKeys = await AsyncStorage.getAllKeys();
      const storageKeys = allKeys.filter(key => key.startsWith('data_')); // Assuming prefix
      
      for (const key of storageKeys) {
        const result = await this.retrieve(key);
        if (result.result === PersistenceResult.EXPIRED) {
          removedKeys.push(key);
        }
      }

      apiLogger.info('Cleanup completed', {
        totalRemoved: removedKeys.length,
        removedKeys: removedKeys.slice(0, 10), // Log first 10 keys
      });

      return {
        removedKeys,
        totalRemoved: removedKeys.length,
      };

    } catch (error) {
      apiLogger.error('Failed to cleanup expired data', { error: error as Error });
      return {
        removedKeys,
        totalRemoved: removedKeys.length,
      };
    }
  }
}

// Export singleton instance
export const persistenceManager = new PersistenceManager();

// Helper functions for common use cases
export const storeMarketData = (symbol: string, data: any) => {
  return persistenceManager.store(`market_${symbol}`, data, {
    ttl: 2 * 60 * 1000, // 2 minutes
    compress: true,
  });
};

export const retrieveMarketData = (symbol: string) => {
  return persistenceManager.retrieve(`market_${symbol}`);
};

export const storeUserSettings = (data: any) => {
  return persistenceManager.store('user_settings', data, {
    ttl: 30 * 24 * 60 * 60 * 1000, // 30 days
    conflictResolution: 'merge',
  });
};

export const retrieveUserSettings = () => {
  return persistenceManager.retrieve('user_settings');
};

export { PersistenceManager };
export default persistenceManager;

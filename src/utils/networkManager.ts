// Network state management and offline handling

import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiLogger } from './logger';

// Mock NetInfo for development - replace with actual implementation
const NetInfo = {
  addEventListener: (callback: (state: any) => void) => {
    // Mock network state
    const mockState = {
      isConnected: true,
      isInternetReachable: true,
      type: 'wifi',
      details: {
        strength: 85,
        effectiveType: '4g',
        isConnectionExpensive: false,
      },
    };
    
    // Simulate initial call
    setTimeout(() => callback(mockState), 100);
    
    // Return unsubscribe function
    return () => {};
  },
};

export enum NetworkStatus {
  UNKNOWN = 'unknown',
  OFFLINE = 'offline',
  POOR = 'poor',
  GOOD = 'good',
  EXCELLENT = 'excellent',
}

export enum ConnectionType {
  NONE = 'none',
  UNKNOWN = 'unknown',
  CELLULAR = 'cellular',
  WIFI = 'wifi',
  BLUETOOTH = 'bluetooth',
  ETHERNET = 'ethernet',
  WIMAX = 'wimax',
  VPN = 'vpn',
  OTHER = 'other',
}

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: ConnectionType;
  status: NetworkStatus;
  effectiveType: string | null;
  isExpensive: boolean;
  lastUpdateTime: number;
}

export interface OfflineQueueItem {
  id: string;
  endpoint: string;
  method: string;
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

class NetworkManager {
  private currentNetworkState: NetworkState | null = null;
  private listeners: Set<(state: NetworkState) => void> = new Set();
  private offlineQueue: OfflineQueueItem[] = [];
  private isProcessingQueue = false;
  private unsubscribeNetInfo: (() => void) | null = null;
  
  // Network state persistence
  private readonly NETWORK_STATE_KEY = 'network_state';
  private readonly OFFLINE_QUEUE_KEY = 'offline_queue';

  constructor() {
    this.initialize();
  }

  // Initialize network monitoring
  private async initialize(): Promise<void> {
    try {
      // Load persisted offline queue
      await this.loadOfflineQueue();
      
      // Load last known network state
      await this.loadLastNetworkState();
      
      // Start monitoring network changes
      this.startNetworkMonitoring();
      
      apiLogger.info('NetworkManager initialized', {
        queueSize: this.offlineQueue.length,
        hasLastState: !!this.currentNetworkState,
      });
    } catch (error) {
      apiLogger.error('Failed to initialize NetworkManager', { error: error as Error });
    }
  }

  // Start monitoring network changes
  private startNetworkMonitoring(): void {
    this.unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      const networkState = this.mapNetInfoToNetworkState(state);
      this.updateNetworkState(networkState);
    });
  }

  // Map NetInfo state to our NetworkState format
  private mapNetInfoToNetworkState(netInfoState: any): NetworkState {
    let status = NetworkStatus.UNKNOWN;
    
    if (!netInfoState.isConnected) {
      status = NetworkStatus.OFFLINE;
    } else if (netInfoState.details) {
      // Determine connection quality based on type and details
      if (netInfoState.type === 'wifi') {
        const strength = netInfoState.details.strength;
        if (strength >= 80) status = NetworkStatus.EXCELLENT;
        else if (strength >= 60) status = NetworkStatus.GOOD;
        else status = NetworkStatus.POOR;
      } else if (netInfoState.type === 'cellular') {
        const generation = netInfoState.details.cellularGeneration;
        if (generation === '5g') status = NetworkStatus.EXCELLENT;
        else if (generation === '4g') status = NetworkStatus.GOOD;
        else status = NetworkStatus.POOR;
      } else {
        status = netInfoState.isInternetReachable ? NetworkStatus.GOOD : NetworkStatus.POOR;
      }
    } else {
      status = netInfoState.isInternetReachable ? NetworkStatus.GOOD : NetworkStatus.POOR;
    }

    return {
      isConnected: netInfoState.isConnected || false,
      isInternetReachable: netInfoState.isInternetReachable,
      type: (netInfoState.type as ConnectionType) || ConnectionType.UNKNOWN,
      status,
      effectiveType: netInfoState.details?.effectiveType || null,
      isExpensive: netInfoState.details?.isConnectionExpensive || false,
      lastUpdateTime: Date.now(),
    };
  }

  // Update network state and notify listeners
  private updateNetworkState(newState: NetworkState): void {
    const previousState = this.currentNetworkState;
    this.currentNetworkState = newState;

    // Log significant changes
    if (!previousState || previousState.isConnected !== newState.isConnected) {
      apiLogger.info('Network state changed', {
        from: previousState?.status || 'unknown',
        to: newState.status,
        isConnected: newState.isConnected,
        type: newState.type,
      });
    }

    // Save state persistently
    this.saveNetworkState(newState);

    // Notify listeners
    this.listeners.forEach(listener => {
      try {
        listener(newState);
      } catch (error) {
        apiLogger.error('Error notifying network state listener', { error: error as Error });
      }
    });

    // Process offline queue if back online
    if (newState.isConnected && (!previousState || !previousState.isConnected)) {
      this.processOfflineQueue();
    }
  }

  // Add listener for network state changes
  addListener(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    
    // Immediately call with current state if available
    if (this.currentNetworkState) {
      try {
        listener(this.currentNetworkState);
      } catch (error) {
        apiLogger.error('Error calling network state listener', { error: error as Error });
      }
    }

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Get current network state
  getNetworkState(): NetworkState | null {
    return this.currentNetworkState;
  }

  // Check if currently online
  isOnline(): boolean {
    return this.currentNetworkState?.isConnected || false;
  }

  // Check if connection is good enough for heavy operations
  isGoodConnection(): boolean {
    const state = this.currentNetworkState;
    return !!(state?.isConnected && 
             state.status !== NetworkStatus.POOR && 
             state.status !== NetworkStatus.OFFLINE);
  }

  // Add request to offline queue
  addToOfflineQueue(
    endpoint: string,
    method: string,
    data: any,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    maxRetries: number = 3
  ): string {
    const id = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const queueItem: OfflineQueueItem = {
      id,
      endpoint,
      method,
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries,
      priority,
    };

    this.offlineQueue.push(queueItem);
    
    // Sort by priority and timestamp
    this.offlineQueue.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const aPriority = priorityOrder[a.priority];
      const bPriority = priorityOrder[b.priority];
      
      if (aPriority !== bPriority) {
        return bPriority - aPriority; // Higher priority first
      }
      
      return a.timestamp - b.timestamp; // Older first
    });

    this.saveOfflineQueue();
    
    apiLogger.info('Added to offline queue', {
      id,
      endpoint,
      method,
      priority,
      queueSize: this.offlineQueue.length,
    });

    return id;
  }

  // Process offline queue when back online
  private async processOfflineQueue(): Promise<void> {
    if (this.isProcessingQueue || this.offlineQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;
    apiLogger.info('Processing offline queue', { queueSize: this.offlineQueue.length });

    const startTime = Date.now();
    let processed = 0;
    let failed = 0;

    while (this.offlineQueue.length > 0 && this.isOnline()) {
      const item = this.offlineQueue.shift()!;

      try {
        // Execute the queued request
        await this.executeQueuedRequest(item);
        processed++;
        
        apiLogger.debug('Offline queue item processed', {
          id: item.id,
          endpoint: item.endpoint,
          retryCount: item.retryCount,
        });

      } catch (error) {
        item.retryCount++;
        
        if (item.retryCount < item.maxRetries) {
          // Put back in queue for retry
          this.offlineQueue.unshift(item);
          apiLogger.warn('Offline queue item failed, will retry', {
            id: item.id,
            endpoint: item.endpoint,
            retryCount: item.retryCount,
            maxRetries: item.maxRetries,
            error: error as Error,
          });
        } else {
          failed++;
          apiLogger.error('Offline queue item failed permanently', {
            id: item.id,
            endpoint: item.endpoint,
            retryCount: item.retryCount,
            error: error as Error,
          });
        }
      }

      // Small delay between requests to avoid overwhelming
      if (this.offlineQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.saveOfflineQueue();
    this.isProcessingQueue = false;

    const duration = Date.now() - startTime;
    apiLogger.info('Offline queue processing completed', {
      processed,
      failed,
      remaining: this.offlineQueue.length,
      duration,
    });
  }

  // Execute a queued request (override this method to implement actual request logic)
  private async executeQueuedRequest(item: OfflineQueueItem): Promise<any> {
    // This is a placeholder - in a real implementation, you would:
    // 1. Parse the endpoint and method
    // 2. Make the actual HTTP request
    // 3. Handle the response
    
    // For now, we'll just simulate success
    apiLogger.debug('Executing queued request (simulated)', {
      id: item.id,
      endpoint: item.endpoint,
      method: item.method,
    });
    
    return Promise.resolve({ success: true });
  }

  // Get offline queue statistics
  getOfflineQueueStats(): {
    totalItems: number;
    itemsByPriority: Record<string, number>;
    oldestItem: number | null;
    newestItem: number | null;
  } {
    const itemsByPriority = this.offlineQueue.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const timestamps = this.offlineQueue.map(item => item.timestamp);
    
    return {
      totalItems: this.offlineQueue.length,
      itemsByPriority,
      oldestItem: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestItem: timestamps.length > 0 ? Math.max(...timestamps) : null,
    };
  }

  // Clear offline queue
  clearOfflineQueue(): void {
    this.offlineQueue = [];
    this.saveOfflineQueue();
    apiLogger.info('Offline queue cleared');
  }

  // Save network state to storage
  private async saveNetworkState(state: NetworkState): Promise<void> {
    try {
      await AsyncStorage.setItem(this.NETWORK_STATE_KEY, JSON.stringify(state));
    } catch (error) {
      apiLogger.error('Failed to save network state', { error: error as Error });
    }
  }

  // Load last known network state
  private async loadLastNetworkState(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.NETWORK_STATE_KEY);
      if (stored) {
        this.currentNetworkState = JSON.parse(stored);
        apiLogger.debug('Loaded last network state', { state: this.currentNetworkState });
      }
    } catch (error) {
      apiLogger.error('Failed to load network state', { error: error as Error });
    }
  }

  // Save offline queue to storage
  private async saveOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.OFFLINE_QUEUE_KEY, JSON.stringify(this.offlineQueue));
    } catch (error) {
      apiLogger.error('Failed to save offline queue', { error: error as Error });
    }
  }

  // Load offline queue from storage
  private async loadOfflineQueue(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.OFFLINE_QUEUE_KEY);
      if (stored) {
        this.offlineQueue = JSON.parse(stored);
        apiLogger.debug('Loaded offline queue', { queueSize: this.offlineQueue.length });
      }
    } catch (error) {
      apiLogger.error('Failed to load offline queue', { error: error as Error });
    }
  }

  // Cleanup resources
  destroy(): void {
    if (this.unsubscribeNetInfo) {
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
    
    this.listeners.clear();
    this.currentNetworkState = null;
    
    apiLogger.info('NetworkManager destroyed');
  }
}

// Export singleton instance
export const networkManager = new NetworkManager();

// Helper hook for React components
export const useNetworkState = () => {
  const [networkState, setNetworkState] = useState<NetworkState | null>(
    networkManager.getNetworkState()
  );

  useEffect(() => {
    const unsubscribe = networkManager.addListener(setNetworkState);
    return unsubscribe;
  }, []);

  return {
    networkState,
    isOnline: networkManager.isOnline(),
    isGoodConnection: networkManager.isGoodConnection(),
    offlineQueueStats: networkManager.getOfflineQueueStats(),
  };
};

export { NetworkManager };
export default networkManager;

// Performance monitoring system for React Native app

import React from 'react';
import { apiLogger } from './logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface PerformanceMetric {
  id: string;
  name: string;
  type: 'navigation' | 'api_call' | 'render' | 'memory' | 'bundle' | 'user_interaction';
  startTime: number;
  endTime?: number;
  duration?: number;
  context?: Record<string, any>;
  metadata: {
    sessionId: string;
    userId?: string;
    deviceInfo?: DeviceInfo;
    memoryUsage?: MemoryInfo;
  };
}

export interface DeviceInfo {
  platform: string;
  version: string;
  model?: string;
  memory?: number;
  storage?: number;
  networkType?: string;
}

export interface MemoryInfo {
  used: number;
  total: number;
  percentage: number;
  timestamp: number;
}

export interface PerformanceReport {
  sessionId: string;
  startTime: number;
  endTime: number;
  metrics: PerformanceMetric[];
  summary: {
    totalMetrics: number;
    averageApiTime: number;
    averageRenderTime: number;
    memoryPeakUsage: number;
    slowOperations: PerformanceMetric[];
  };
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private activeMetrics = new Map<string, PerformanceMetric>();
  private sessionId: string;
  private sessionStartTime: number;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  
  private readonly MAX_METRICS = 1000;
  private readonly SLOW_THRESHOLD = 1000; // 1 second
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly STORAGE_KEY = 'performance_metrics';

  constructor() {
    this.sessionId = this.generateSessionId();
    this.sessionStartTime = Date.now();
    this.initialize();
  }

  // Initialize performance monitoring
  private async initialize(): Promise<void> {
    try {
      // Load previous session metrics if needed
      await this.loadPreviousMetrics();
      
      // Start memory monitoring
      this.startMemoryMonitoring();
      
      // Monitor bundle loading time
      this.monitorBundlePerformance();
      
      apiLogger.info('PerformanceMonitor initialized', {
        sessionId: this.sessionId,
        startTime: this.sessionStartTime,
      });
    } catch (error) {
      apiLogger.error('Failed to initialize PerformanceMonitor', { error: error as Error });
    }
  }

  // Start monitoring a performance metric
  startMetric(name: string, type: PerformanceMetric['type'], context?: Record<string, any>): string {
    const metricId = this.generateMetricId();
    const startTime = performance?.now() || Date.now();
    
    const metric: PerformanceMetric = {
      id: metricId,
      name,
      type,
      startTime,
      context,
      metadata: {
        sessionId: this.sessionId,
        deviceInfo: this.getDeviceInfo(),
        memoryUsage: this.getCurrentMemoryInfo(),
      },
    };

    this.activeMetrics.set(metricId, metric);
    
    apiLogger.debug('Performance metric started', {
      metricId,
      name,
      type,
      context,
    });

    return metricId;
  }

  // End monitoring a performance metric
  endMetric(metricId: string, context?: Record<string, any>): PerformanceMetric | null {
    const metric = this.activeMetrics.get(metricId);
    if (!metric) {
      apiLogger.warn('Metric not found for ending', { metricId });
      return null;
    }

    const endTime = performance?.now() || Date.now();
    const duration = endTime - metric.startTime;

    const completedMetric: PerformanceMetric = {
      ...metric,
      endTime,
      duration,
      context: { ...metric.context, ...context },
      metadata: {
        ...metric.metadata,
        memoryUsage: this.getCurrentMemoryInfo(),
      },
    };

    // Remove from active metrics
    this.activeMetrics.delete(metricId);
    
    // Store completed metric
    this.storeMetric(completedMetric);

    // Log if slow
    if (duration > this.SLOW_THRESHOLD) {
      apiLogger.warn('Slow operation detected', {
        metricId,
        name: metric.name,
        type: metric.type,
        duration,
        threshold: this.SLOW_THRESHOLD,
      });
    }

    apiLogger.debug('Performance metric completed', {
      metricId,
      name: metric.name,
      duration,
    });

    return completedMetric;
  }

  // Monitor API call performance
  async monitorApiCall<T>(
    endpoint: string,
    method: string,
    apiCall: () => Promise<T>
  ): Promise<T> {
    const metricId = this.startMetric('api_call', 'api_call', {
      endpoint,
      method,
    });

    try {
      const result = await apiCall();
      
      this.endMetric(metricId, {
        success: true,
        resultSize: JSON.stringify(result).length,
      });
      
      return result;
    } catch (error) {
      this.endMetric(metricId, {
        success: false,
        error: (error as Error).message,
      });
      
      throw error;
    }
  }

  // Monitor React component render performance
  monitorRender(componentName: string): {
    startRender: () => string;
    endRender: (metricId: string) => void;
  } {
    return {
      startRender: () => {
        return this.startMetric(`render_${componentName}`, 'render', {
          component: componentName,
        });
      },
      endRender: (metricId: string) => {
        this.endMetric(metricId);
      },
    };
  }

  // Monitor navigation performance
  monitorNavigation(from: string, to: string): {
    startNavigation: () => string;
    endNavigation: (metricId: string) => void;
  } {
    return {
      startNavigation: () => {
        return this.startMetric('navigation', 'navigation', {
          from,
          to,
        });
      },
      endNavigation: (metricId: string) => {
        this.endMetric(metricId);
      },
    };
  }

  // Monitor user interaction performance
  monitorUserInteraction(action: string, component: string): {
    startInteraction: () => string;
    endInteraction: (metricId: string) => void;
  } {
    return {
      startInteraction: () => {
        return this.startMetric(`interaction_${action}`, 'user_interaction', {
          action,
          component,
        });
      },
      endInteraction: (metricId: string) => {
        this.endMetric(metricId);
      },
    };
  }

  // Store performance metric
  private storeMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Maintain size limit
    if (this.metrics.length > this.MAX_METRICS) {
      this.metrics = this.metrics.slice(-this.MAX_METRICS);
    }

    // Auto-save important metrics
    if (metric.duration && metric.duration > this.SLOW_THRESHOLD) {
      this.saveMetrics();
    }
  }

  // Get device information
  private getDeviceInfo(): DeviceInfo {
    return {
      platform: 'react-native', // In real app, use react-native-device-info
      version: '1.0.0',
      model: 'unknown',
      memory: 0, // Would get from device info
      storage: 0, // Would get from device info
      networkType: 'unknown', // Would get from NetInfo
    };
  }

  // Get current memory information (mock implementation)
  private getCurrentMemoryInfo(): MemoryInfo {
    // In a real React Native app, you would use:
    // - react-native-device-info for device memory
    // - Performance API for JS heap usage
    // - Custom native modules for detailed memory info
    
    const mockUsed = Math.floor(Math.random() * 100) + 50; // 50-150 MB
    const mockTotal = 512; // 512 MB total
    
    return {
      used: mockUsed,
      total: mockTotal,
      percentage: (mockUsed / mockTotal) * 100,
      timestamp: Date.now(),
    };
  }

  // Start memory monitoring
  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      const memoryInfo = this.getCurrentMemoryInfo();
      
      // Log memory usage metric
      const metricId = this.generateMetricId();
      const metric: PerformanceMetric = {
        id: metricId,
        name: 'memory_usage',
        type: 'memory',
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        context: {
          memoryUsed: memoryInfo.used,
          memoryTotal: memoryInfo.total,
          memoryPercentage: memoryInfo.percentage,
        },
        metadata: {
          sessionId: this.sessionId,
          memoryUsage: memoryInfo,
        },
      };

      this.storeMetric(metric);

      // Warn if memory usage is high
      if (memoryInfo.percentage > 80) {
        apiLogger.warn('High memory usage detected', {
          used: memoryInfo.used,
          total: memoryInfo.total,
          percentage: memoryInfo.percentage,
        });
      }
    }, this.MEMORY_CHECK_INTERVAL);
  }

  // Monitor bundle loading performance
  private monitorBundlePerformance(): void {
    // In a real app, this would monitor bundle loading times
    const bundleMetric: PerformanceMetric = {
      id: this.generateMetricId(),
      name: 'bundle_load',
      type: 'bundle',
      startTime: this.sessionStartTime,
      endTime: Date.now(),
      duration: Date.now() - this.sessionStartTime,
      context: {
        bundleSize: 'unknown', // Would get from bundle analyzer
        platform: 'react-native',
      },
      metadata: {
        sessionId: this.sessionId,
        deviceInfo: this.getDeviceInfo(),
      },
    };

    this.storeMetric(bundleMetric);
  }

  // Get performance metrics
  getMetrics(type?: PerformanceMetric['type']): PerformanceMetric[] {
    if (type) {
      return this.metrics.filter(metric => metric.type === type);
    }
    return [...this.metrics];
  }

  // Get performance summary
  getPerformanceSummary(): PerformanceReport['summary'] {
    const apiMetrics = this.metrics.filter(m => m.type === 'api_call' && m.duration);
    const renderMetrics = this.metrics.filter(m => m.type === 'render' && m.duration);
    const slowOperations = this.metrics.filter(m => m.duration && m.duration > this.SLOW_THRESHOLD);
    
    const averageApiTime = apiMetrics.length > 0
      ? apiMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / apiMetrics.length
      : 0;
    
    const averageRenderTime = renderMetrics.length > 0
      ? renderMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / renderMetrics.length
      : 0;

    const memoryMetrics = this.metrics.filter(m => m.type === 'memory');
    const memoryPeakUsage = memoryMetrics.length > 0
      ? Math.max(...memoryMetrics.map(m => m.context?.memoryPercentage || 0))
      : 0;

    return {
      totalMetrics: this.metrics.length,
      averageApiTime,
      averageRenderTime,
      memoryPeakUsage,
      slowOperations: slowOperations.slice(-10), // Last 10 slow operations
    };
  }

  // Get performance report
  generateReport(): PerformanceReport {
    return {
      sessionId: this.sessionId,
      startTime: this.sessionStartTime,
      endTime: Date.now(),
      metrics: [...this.metrics],
      summary: this.getPerformanceSummary(),
    };
  }

  // Save metrics to storage
  async saveMetrics(): Promise<void> {
    try {
      const report = this.generateReport();
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(report));
      
      apiLogger.debug('Performance metrics saved', {
        sessionId: this.sessionId,
        metricCount: this.metrics.length,
      });
    } catch (error) {
      apiLogger.error('Failed to save performance metrics', { error: error as Error });
    }
  }

  // Load previous metrics
  private async loadPreviousMetrics(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const report: PerformanceReport = JSON.parse(stored);
        apiLogger.info('Loaded previous performance metrics', {
          previousSession: report.sessionId,
          metricCount: report.metrics.length,
          summary: report.summary,
        });
      }
    } catch (error) {
      apiLogger.error('Failed to load previous metrics', { error: error as Error });
    }
  }

  // Clear all metrics
  clearMetrics(): void {
    this.metrics = [];
    this.activeMetrics.clear();
    apiLogger.info('Performance metrics cleared');
  }

  // Get active metrics count
  getActiveMetricsCount(): number {
    return this.activeMetrics.size;
  }

  // Generate unique session ID
  private generateSessionId(): string {
    return `perf_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Generate unique metric ID
  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Cleanup resources
  destroy(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }
    
    // Save final metrics
    this.saveMetrics();
    
    apiLogger.info('PerformanceMonitor destroyed', {
      sessionId: this.sessionId,
      finalMetricCount: this.metrics.length,
    });
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Higher-order component for monitoring React component renders
export function withPerformanceMonitoring<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  componentName?: string
) {
  const name = componentName || WrappedComponent.displayName || WrappedComponent.name || 'Component';
  
  return React.memo((props: P) => {
    const renderMonitor = performanceMonitor.monitorRender(name);
    
    React.useLayoutEffect(() => {
      const metricId = renderMonitor.startRender();
      
      return () => {
        renderMonitor.endRender(metricId);
      };
    });

    return React.createElement(WrappedComponent, props);
  });
}

// Hook for monitoring custom operations
export function usePerformanceMonitoring() {
  return {
    startMetric: (name: string, type: PerformanceMetric['type'], context?: Record<string, any>) =>
      performanceMonitor.startMetric(name, type, context),
    endMetric: (metricId: string, context?: Record<string, any>) =>
      performanceMonitor.endMetric(metricId, context),
    monitorApiCall: <T>(endpoint: string, method: string, apiCall: () => Promise<T>) =>
      performanceMonitor.monitorApiCall(endpoint, method, apiCall),
    getMetrics: (type?: PerformanceMetric['type']) =>
      performanceMonitor.getMetrics(type),
    getSummary: () =>
      performanceMonitor.getPerformanceSummary(),
  };
}

export { PerformanceMonitor };
export default performanceMonitor;

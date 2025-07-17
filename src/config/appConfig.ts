// Configuration for data sources
export const appConfig = {
  // Set to true to use mock data instead of Firebase
  useMockData: true,
  
  // Firebase configuration
  firebase: {
    enabled: !true, // Disabled for now
    useEmulator: __DEV__,
    emulatorHost: 'localhost',
    emulatorPort: 8080
  },
  
  // API configuration
  api: {
    timeout: 10000,
    retryAttempts: 3,
    retryDelay: 1000
  },
  
  // UI configuration
  ui: {
    refreshInterval: 30000, // 30 seconds
    animationDuration: 300,
    maxItemsPerPage: 50
  },
  
  // Debug configuration
  debug: {
    enabled: __DEV__,
    logLevel: 'info' as 'debug' | 'info' | 'warn' | 'error',
    showPerformanceMetrics: __DEV__
  }
};

// Export individual configurations for easier access
export const { useMockData, firebase, api, ui, debug } = appConfig;

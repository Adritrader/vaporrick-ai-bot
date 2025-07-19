// API Configuration for Real Data Services
// Uses environment variables for secure API key management
import Constants from 'expo-constants';

// Helper to safely get environment variables
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // Try Expo Constants first (for build-time environment variables)
  const expoExtra = Constants.expoConfig?.extra?.[key];
  if (expoExtra) return expoExtra;
  
  // Fallback to process.env (for development)
  const processEnv = process.env[key];
  if (processEnv) return processEnv;
  
  // For development, provide working defaults
  const devConfig: Record<string, string> = {
    ALPHA_VANTAGE_API_KEY: 'CPIIA8O6V6AWJSCE', // Updated with your real API key
    TWELVE_DATA_API_KEY: '84fe0edd19164ee4981380c034bb4826', // Add Twelve Data key
  };
  
  return devConfig[key] || defaultValue;
};

export const API_CONFIG = {
  // Alpha Vantage (for stocks) - With real API key: 500 requests/day, 5 requests/minute
  // Get your free API key at: https://www.alphavantage.co/support/#api-key
  ALPHA_VANTAGE: {
    API_KEY: getEnvVar('ALPHA_VANTAGE_API_KEY', 'CPIIA8O6V6AWJSCE'), // Use real key as fallback
    BASE_URL: 'https://www.alphavantage.co/query',
    RATE_LIMIT: 12 * 1000, // 12 seconds between requests (5 per minute = safer)
    DEMO_KEY: 'demo' // Keep for fallback
  },

  // CoinGecko (for crypto) - Free tier: 30 requests/minute (conservative)
  // No API key required for basic usage
  COINGECKO: {
    BASE_URL: 'https://api.coingecko.com/api/v3',
    RATE_LIMIT: 30 * 1000, // 30 seconds between requests (improved rate limiting)
    PRO_API_KEY: getEnvVar('COINGECKO_PRO_API_KEY', ''), // Optional: for higher rate limits
  },

  // CoinPaprika (for crypto) - Free tier: 25,000 requests/month (~833/day)
  // No API key required for free tier - Much better than CoinGecko's rate limits
  COINPAPRIKA: {
    BASE_URL: 'https://api.coinpaprika.com/v1',
    RATE_LIMIT: 100, // 100ms between requests (10 req/sec limit)
    FREE_TIER_LIMIT: 833, // requests per day (~25k/month)
    FEATURES: ['prices', 'historical', 'market_data', 'search']
  },

  // Yahoo Finance (for stocks and crypto) - Free but unofficial
  YAHOO_FINANCE: {
    BASE_URL: 'https://query1.finance.yahoo.com',
    RATE_LIMIT: 2000, // 2 seconds between requests
  },

  // Twelve Data (for stocks) - Free tier: 800 requests/day (EXCELLENT for stocks!)
  // Get your free API key at: https://twelvedata.com/pricing
  // Twelve Data (for stocks) - Free tier: 800 requests/day (EXCELLENT for stocks!)
  // Get your free API key at: https://twelvedata.com/pricing
  TWELVE_DATA: {
    API_KEY: getEnvVar('TWELVE_DATA_API_KEY', '84fe0edd19164ee4981380c034bb4826'),
    BASE_URL: 'https://api.twelvedata.com',
    RATE_LIMIT: 60 * 1000, // 1 minute between requests (conservative)
    FEATURES: ['time_series', 'quote', 'real_time', 'technical_indicators'],
    FREE_TIER_LIMIT: 800 // requests per day
  },

  // Financial Modeling Prep - Free tier: 250 requests/day
  // Get your free API key at: https://financialmodelingprep.com/
  FMP: {
    API_KEY: getEnvVar('FMP_API_KEY', 'YOUR_FMP_API_KEY'),
    BASE_URL: 'https://financialmodelingprep.com/api/v3',
    RATE_LIMIT: 5 * 60 * 1000, // 5 minutes between requests
  },

  // General settings
  GENERAL: {
    CACHE_DURATION: 2 * 60 * 1000, // 2 minutes cache
    REQUEST_TIMEOUT: 15000, // 15 seconds (increased for better reliability)
    MAX_RETRIES: 2,
  }
};

// Helper function to check if API keys are configured
export const checkAPIConfiguration = () => {
  const unconfiguredAPIs = [];
  
  if (!API_CONFIG.ALPHA_VANTAGE.API_KEY || API_CONFIG.ALPHA_VANTAGE.API_KEY === 'demo' || API_CONFIG.ALPHA_VANTAGE.API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY') {
    unconfiguredAPIs.push('Alpha Vantage (stocks)');
  }
  
  if (API_CONFIG.TWELVE_DATA.API_KEY === 'YOUR_TWELVE_DATA_API_KEY') {
    unconfiguredAPIs.push('Twelve Data (stocks)');
  }
  
  if (API_CONFIG.FMP.API_KEY === 'YOUR_FMP_API_KEY') {
    unconfiguredAPIs.push('Financial Modeling Prep (stocks)');
  }
  
  return {
    isFullyConfigured: unconfiguredAPIs.length === 0,
    unconfiguredAPIs,
    canUseCrypto: true, // CoinGecko doesn't require API key
    canUseStocks: API_CONFIG.ALPHA_VANTAGE.API_KEY && API_CONFIG.ALPHA_VANTAGE.API_KEY !== 'demo' // At least Alpha Vantage configured
  };
};

// Development mode - uses demo/free endpoints
export const DEV_MODE = __DEV__;

console.log('🔧 API Configuration loaded:', {
  devMode: DEV_MODE,
  configured: checkAPIConfiguration()
});

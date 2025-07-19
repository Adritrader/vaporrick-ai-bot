import { gemsVolumeService } from '../services/gemsVolumeService';

export const DATA_SOURCES = {
  ALPHA_VANTAGE: 'alphavantage',
  COINGECKO: 'coingecko', 
  COINPAPRIKA: 'coinpaprika',
  TWELVE_DATA: 'twelvedata'
} as const;

export type DataSource = typeof DATA_SOURCES[keyof typeof DATA_SOURCES];

export const DATA_SOURCE_CONFIG = {
  [DATA_SOURCES.ALPHA_VANTAGE]: {
    name: 'Alpha Vantage',
    type: 'stocks',
    baseUrl: 'https://www.alphavantage.co/query',
    apiKey: process.env.ALPHA_VANTAGE_API_KEY || 'demo',
    rateLimit: 5, // requests per minute
    features: ['stocks', 'forex', 'crypto'],
  },
  [DATA_SOURCES.COINGECKO]: {
    name: 'CoinGecko',
    type: 'crypto',
    baseUrl: 'https://api.coingecko.com/api/v3',
    apiKey: null, // Free tier doesn't require API key
    rateLimit: 10, // requests per minute
    features: ['crypto', 'market_data'],
  },
  [DATA_SOURCES.COINPAPRIKA]: {
    name: 'CoinPaprika',
    type: 'crypto',
    baseUrl: 'https://api.coinpaprika.com/v1',
    apiKey: null, // Free tier doesn't require API key
    rateLimit: 25, // requests per minute
    features: ['crypto', 'market_data', 'historical'],
  },
  [DATA_SOURCES.TWELVE_DATA]: {
    name: 'Twelve Data',
    type: 'mixed',
    baseUrl: 'https://api.twelvedata.com',
    apiKey: process.env.TWELVE_DATA_API_KEY || 'demo',
    rateLimit: 8, // requests per minute for free tier
    features: ['stocks', 'forex', 'crypto', 'etf'],
  },
};

export const getDataSourceForSymbol = (symbol: string): DataSource => {
  // If symbol contains common crypto patterns, use crypto sources
  if (symbol.includes('-') || symbol.toLowerCase().includes('usd') || 
      symbol.toLowerCase().includes('btc') || symbol.toLowerCase().includes('eth')) {
    return DATA_SOURCES.COINGECKO;
  }
  
  // Default to stocks for traditional symbols
  return DATA_SOURCES.ALPHA_VANTAGE;
};

export const getVolumeFromGems = async (symbol: string): Promise<number> => {
  try {
    // Use real gems volume service
    const volume = await gemsVolumeService.getVolumeFromGems(symbol);
    return volume;
  } catch (error) {
    console.error('Error getting volume from gems collection:', error);
    return 1000000; // Default 1M volume
  }
};

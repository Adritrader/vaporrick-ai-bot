// API Service for fetching market data
import { Asset } from '../context/TradingContext';
import { 
  fetchMockAssetData, 
  fetchMockMultipleAssets, 
  fetchMockHistoricalData,
  HistoricalDataPoint 
} from './mockDataService';

const ALPHA_VANTAGE_API_KEY = 'YOUR_API_KEY'; // Replace with your API key
const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';
const ALPHA_VANTAGE_BASE_URL = 'https://www.alphavantage.co/query';
const USE_MOCK_DATA = true; // Set to false when you have valid API keys

// Cache management
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const cache = new Map<string, { data: any; timestamp: number }>();

const getCachedData = (key: string) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key: string, data: any) => {
  cache.set(key, { data, timestamp: Date.now() });
};

// Stock data service using Alpha Vantage or mock data
export const fetchStockData = async (symbol: string): Promise<Asset> => {
  if (USE_MOCK_DATA) {
    return fetchMockAssetData(symbol);
  }

  const cacheKey = `stock_${symbol}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data['Error Message']) {
      throw new Error(data['Error Message']);
    }
    
    const quote = data['Global Quote'];
    
    if (!quote) {
      throw new Error('No data available for this symbol');
    }
    
    const asset: Asset = {
      symbol: quote['01. symbol'] || symbol,
      name: quote['01. symbol'] || symbol, // Alpha Vantage doesn't provide company name in this endpoint
      price: parseFloat(quote['05. price'] || '0'),
      change: parseFloat(quote['09. change'] || '0'),
      changePercent: parseFloat((quote['10. change percent'] || '0%').replace('%', '')),
      type: 'stock',
      lastUpdate: new Date(),
    };
    
    setCachedData(cacheKey, asset);
    return asset;
  } catch (error) {
    console.error('Error fetching stock data:', error);
    throw error;
  }
};

// Crypto data service using CoinGecko
export const fetchCryptoData = async (symbol: string): Promise<Asset> => {
  const cacheKey = `crypto_${symbol}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }

  try {
    const response = await fetch(
      `${COINGECKO_BASE_URL}/simple/price?ids=${symbol}&vs_currencies=usd&include_24hr_change=true`
    );
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data[symbol]) {
      throw new Error('No data available for this symbol');
    }
    
    const cryptoData = data[symbol];
    
    const asset: Asset = {
      symbol: symbol.toUpperCase(),
      name: symbol.charAt(0).toUpperCase() + symbol.slice(1),
      price: cryptoData.usd,
      change: cryptoData.usd_24h_change || 0,
      changePercent: cryptoData.usd_24h_change || 0,
      type: 'crypto',
      lastUpdate: new Date(),
    };
    
    setCachedData(cacheKey, asset);
    return asset;
  } catch (error) {
    console.error('Error fetching crypto data:', error);
    throw error;
  }
};

// Fetch multiple assets
export const fetchMultipleAssets = async (symbols: string[]): Promise<Asset[]> => {
  if (USE_MOCK_DATA) {
    return fetchMockMultipleAssets(symbols);
  }

  const results = await Promise.allSettled(
    symbols.map(async (symbol) => {
      // Determine if it's a stock or crypto based on symbol format
      const isStock = symbol.length <= 5 && /^[A-Z]+$/.test(symbol);
      
      if (isStock) {
        return await fetchStockData(symbol);
      } else {
        return await fetchCryptoData(symbol.toLowerCase());
      }
    })
  );

  return results
    .filter((result): result is PromiseFulfilledResult<Asset> => result.status === 'fulfilled')
    .map(result => result.value);
};

// Historical data service (simplified version)
export const fetchHistoricalData = async (
  symbol: string,
  type: 'stock' | 'crypto',
  period: '1d' | '7d' | '30d' | '90d' | '1y' = '30d'
): Promise<{ date: string; close: number; volume: number }[]> => {
  if (USE_MOCK_DATA) {
    const days = getDaysFromPeriod(period);
    const mockData = await fetchMockHistoricalData(symbol, days);
    return mockData.map(item => ({
      date: item.date,
      close: item.close,
      volume: item.volume,
    }));
  }

  const cacheKey = `historical_${type}_${symbol}_${period}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }

  try {
    if (type === 'stock') {
      // For stocks, use Alpha Vantage TIME_SERIES_DAILY
      const response = await fetch(
        `${ALPHA_VANTAGE_BASE_URL}?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${ALPHA_VANTAGE_API_KEY}&outputsize=compact`
      );
      
      const data = await response.json();
      const timeSeries = data['Time Series (Daily)'];
      
      if (!timeSeries) {
        throw new Error('No historical data available');
      }
      
      const historicalData = Object.entries(timeSeries)
        .slice(0, getDaysFromPeriod(period))
        .map(([date, values]: [string, any]) => ({
          date,
          close: parseFloat(values['4. close']),
          volume: parseInt(values['5. volume']),
        }))
        .reverse();
      
      setCachedData(cacheKey, historicalData);
      return historicalData;
    } else {
      // For crypto, use CoinGecko market chart
      const days = getDaysFromPeriod(period);
      const response = await fetch(
        `${COINGECKO_BASE_URL}/coins/${symbol}/market_chart?vs_currency=usd&days=${days}`
      );
      
      const data = await response.json();
      
      if (!data.prices) {
        throw new Error('No historical data available');
      }
      
      const historicalData = data.prices.map(([timestamp, price]: [number, number], index: number) => ({
        date: new Date(timestamp).toISOString().split('T')[0],
        close: price,
        volume: data.total_volumes[index] ? data.total_volumes[index][1] : 0,
      }));
      
      setCachedData(cacheKey, historicalData);
      return historicalData;
    }
  } catch (error) {
    console.error('Error fetching historical data:', error);
    throw error;
  }
};

// Search for assets
export const searchAssets = async (query: string): Promise<{ symbol: string; name: string; type: 'stock' | 'crypto' }[]> => {
  const cacheKey = `search_${query}`;
  const cachedData = getCachedData(cacheKey);
  
  if (cachedData) {
    return cachedData;
  }

  try {
    // Search stocks using Alpha Vantage
    const stockResponse = await fetch(
      `${ALPHA_VANTAGE_BASE_URL}?function=SYMBOL_SEARCH&keywords=${query}&apikey=${ALPHA_VANTAGE_API_KEY}`
    );
    
    const stockData = await stockResponse.json();
    const stockResults = stockData.bestMatches?.slice(0, 5).map((match: any) => ({
      symbol: match['1. symbol'],
      name: match['2. name'],
      type: 'stock' as const,
    })) || [];

    // Search crypto using CoinGecko
    const cryptoResponse = await fetch(
      `${COINGECKO_BASE_URL}/search?query=${query}`
    );
    
    const cryptoData = await cryptoResponse.json();
    const cryptoResults = cryptoData.coins?.slice(0, 5).map((coin: any) => ({
      symbol: coin.symbol.toUpperCase(),
      name: coin.name,
      type: 'crypto' as const,
    })) || [];

    const results = [...stockResults, ...cryptoResults];
    setCachedData(cacheKey, results);
    return results;
  } catch (error) {
    console.error('Error searching assets:', error);
    return [];
  }
};

// Helper function to convert period to days
const getDaysFromPeriod = (period: string): number => {
  switch (period) {
    case '1d': return 1;
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case '1y': return 365;
    default: return 30;
  }
};

// Rate limiting helper
class RateLimiter {
  private requests: number[] = [];
  private maxRequests: number;
  private timeWindow: number;

  constructor(maxRequests: number, timeWindowMs: number) {
    this.maxRequests = maxRequests;
    this.timeWindow = timeWindowMs;
  }

  async waitForSlot(): Promise<void> {
    const now = Date.now();
    this.requests = this.requests.filter(timestamp => now - timestamp < this.timeWindow);

    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.timeWindow - (now - oldestRequest);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.waitForSlot();
    }

    this.requests.push(now);
  }
}

// Create rate limiters for different APIs
export const alphaVantageRateLimiter = new RateLimiter(5, 60000); // 5 requests per minute
export const coinGeckoRateLimiter = new RateLimiter(50, 60000); // 50 requests per minute

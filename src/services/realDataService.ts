import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  type: 'crypto' | 'stock';
  lastUpdated: number;
  source?: 'real' | 'cache';
}

import { API_CONFIG, checkAPIConfiguration } from '../config/apiConfig';
import { apiKeyManager } from './apiKeyRotationManager';
import { InputValidator } from '../utils/inputValidator';
import { withCacheLock } from '../utils/mutex';
import { CircuitBreakerFactory } from '../utils/circuitBreaker';
import { deduplicateApiRequest } from '../utils/requestDeduplicator';
import { apiLogger } from '../utils/logger';
import { apiRateLimiters, checkRateLimit, RateLimitResult } from '../utils/rateLimiter';

export interface RealGemSearchResult {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  type: 'stock' | 'crypto';
  lastUpdated: number;
  source?: 'real' | 'cache';
}

export interface GemData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
  type: 'stock' | 'crypto';
  team?: number;
  tech?: number;
  community?: number;
  adoption?: number;
  lastUpdated: number;
  source?: 'real' | 'cache' | 'fallback';
}

class RealDataService {
  private cache = new Map<string, { data: MarketData; timestamp: number }>();
  private gemCache = new Map<string, { data: GemData; timestamp: number }>();
  private lastRequestTime = 0;
  private requestDelay = API_CONFIG.GENERAL.CACHE_DURATION / 10; // Dynamic delay based on config
  private cacheExpiry = API_CONFIG.GENERAL.CACHE_DURATION;
  private extendedCacheExpiry = API_CONFIG.GENERAL.CACHE_DURATION * 5;
  private retryCount = 0;
  private maxRetries = API_CONFIG.GENERAL.MAX_RETRIES;
  private rateLimitActive = false;
  private rateLimitUntil = 0;
  private apiStatus = checkAPIConfiguration();
  
  // Circuit breakers for different APIs
  private alphaVantageBreaker = CircuitBreakerFactory.createApiCircuitBreaker('AlphaVantage');
  private coinGeckoBreaker = CircuitBreakerFactory.createApiCircuitBreaker('CoinGecko');
  private yahooBreaker = CircuitBreakerFactory.createApiCircuitBreaker('Yahoo');
  
  // Cache keys para AsyncStorage
  private readonly MARKET_DATA_KEY = 'market_data_batch';
  private readonly LAST_UPDATE_KEY = 'market_data_last_update';
  private readonly GEM_DATA_KEY = 'gem_data_batch';

  // Request queue for CoinGecko to prevent rate limiting
  private coinGeckoQueue: Array<() => Promise<any>> = [];
  private coinGeckoProcessing = false;

  // URLs alternativas para APIs
  private readonly alternativeAPIs = {
    stocks: [
      'https://query1.finance.yahoo.com/v8/finance/chart/',
      'https://financialmodelingprep.com/api/v3/quote/',
      'https://api.twelvedata.com/price?'
    ],
    crypto: [
      'https://api.coingecko.com/api/v3/simple/price',
      'https://api.coinbase.com/v2/exchange-rates',
      'https://api.binance.com/api/v3/ticker/price'
    ]
  };

  // Roundear números a 4 decimales máximo
  private roundNumber(num: number): number {
    return Math.round(num * 10000) / 10000;
  }

  // Delay para evitar rate limiting
  private async throttleRequest(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.requestDelay) {
      const delay = this.requestDelay - timeSinceLastRequest;
      apiLogger.debug('Throttling request', { delay, timeSinceLastRequest });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastRequestTime = Date.now();
  }

  // Obtener todos los datos de mercado desde AsyncStorage
  private async getBatchCachedData(): Promise<Map<string, MarketData> | null> {
    try {
      const [cachedData, lastUpdate] = await Promise.all([
        AsyncStorage.getItem(this.MARKET_DATA_KEY),
        AsyncStorage.getItem(this.LAST_UPDATE_KEY)
      ]);
      
      if (cachedData && lastUpdate) {
        const timestamp = parseInt(lastUpdate);
        const now = Date.now();
        
        // Verificar si el cache aún es válido (2 minutos)
        if (now - timestamp < this.cacheExpiry) {
          const dataMap = new Map<string, MarketData>();
          const parsedData = JSON.parse(cachedData);
          
          for (const [symbol, data] of Object.entries(parsedData)) {
            dataMap.set(symbol, data as MarketData);
          }
          
          apiLogger.debug('Using batch cache', { 
            ageSeconds: Math.floor((now - timestamp) / 1000),
            symbolCount: dataMap.size 
          });
          return dataMap;
        } else {
          apiLogger.warn('Batch cache expired', { 
            ageSeconds: Math.floor((now - timestamp) / 1000) 
          });
        }
      }
    } catch (error) {
      apiLogger.warn('Error reading batch cache', { error: error as Error });
    }
    return null;
  }

  // Guardar todos los datos de mercado en AsyncStorage
  private async setBatchCachedData(dataMap: Map<string, MarketData>): Promise<void> {
    // Use mutex to prevent race conditions when multiple requests try to write cache
    return withCacheLock('batch_cache', async () => {
      try {
        const dataObject = Object.fromEntries(dataMap);
        const timestamp = Date.now();
        
        await Promise.all([
          AsyncStorage.setItem(this.MARKET_DATA_KEY, JSON.stringify(dataObject)),
          AsyncStorage.setItem(this.LAST_UPDATE_KEY, timestamp.toString())
        ]);
        
        apiLogger.debug('Saved batch cache', { 
          symbolCount: dataMap.size,
          mutexProtected: true 
        });
      } catch (error) {
        apiLogger.error('Error saving batch cache', { error: error as Error });
        throw error; // Re-throw to let mutex handle it
      }
    });
  }

  // Verificar si necesitamos actualizar el cache batch
  private async shouldRefreshBatchCache(): Promise<boolean> {
    try {
      const lastUpdate = await AsyncStorage.getItem(this.LAST_UPDATE_KEY);
      if (!lastUpdate) return true;
      
      const timestamp = parseInt(lastUpdate);
      const age = Date.now() - timestamp;
      
      return age >= this.cacheExpiry; // 2 minutos
    } catch (error) {
      return true; // Si hay error, refrescar
    }
  }
  private async getCachedData(key: string, allowExtended: boolean = false): Promise<MarketData | null> {
    try {
      const cached = await AsyncStorage.getItem(`market_${key}`);
      if (cached) {
        const data = JSON.parse(cached);
        const maxAge = allowExtended ? this.extendedCacheExpiry : this.cacheExpiry;
        if (Date.now() - data.timestamp < maxAge) {
          return { ...data.data, source: 'cache' };
        }
      }
    } catch (error) {
      console.warn('Error reading cache:', error);
    }
    return null;
  }

  // Guardar en cache persistente
  private async setCachedData(key: string, data: MarketData): Promise<void> {
    // Use mutex to prevent race conditions
    return withCacheLock(`individual_${key}`, async () => {
      try {
        await AsyncStorage.setItem(`market_${key}`, JSON.stringify({
          data,
          timestamp: Date.now()
        }));
        console.log(`💾 Cached data for ${key} (protected by mutex)`);
      } catch (error) {
        console.warn('Error saving individual cache:', error);
        throw error;
      }
    });
  }

  // Verificar si estamos en rate limit
  private isRateLimited(): boolean {
    return this.rateLimitActive && Date.now() < this.rateLimitUntil;
  }

  // Activar rate limit por un período
  private activateRateLimit(durationMs: number = 60000): void {
    this.rateLimitActive = true;
    this.rateLimitUntil = Date.now() + durationMs;
    console.warn(`Rate limit activated for ${durationMs / 1000} seconds`);
  }
  // Detectar si es crypto o stock
  private getAssetType(symbol: string): 'stock' | 'crypto' {
    // Lista extendida de símbolos crypto conocidos (IDs de CoinGecko)
    const cryptoIds = [
      'bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot', 'chainlink', 
      'avalanche', 'injective-protocol', 'oasis-network',
      'fantom', 'ocean-protocol', 'thorchain', 'kava', 'celer-network',
      'ren', 'band-protocol', 'ankr'
    ];
    
    const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'LINK', 'UNI'];
    
    return cryptoIds.includes(symbol.toLowerCase()) || 
           cryptoSymbols.some(crypto => symbol.toUpperCase().includes(crypto)) ? 'crypto' : 'stock';
  }

  // Remove fallback data generation - only use real APIs
  private async fetchRealData(symbol: string): Promise<MarketData> {
    // Check rate limits
    if (this.isRateLimited()) {
      throw new Error(`Rate limit active for ${symbol}. Please try again later.`);
    }

    try {
      await this.throttleRequest();

      // Intentar Alpha Vantage para stocks
      if (this.getAssetType(symbol) === 'stock') {
        const result = await this.fetchStockData(symbol);
        if (result) {
          this.retryCount = 0; // Reset retry count on success
          return { ...result, source: 'real' };
        }
      } else {
        // Intentar CoinGecko para crypto
        const result = await this.fetchCryptoData(symbol);
        if (result) {
          this.retryCount = 0; // Reset retry count on success
          return { ...result, source: 'real' };
        }
      }
    } catch (error) {
      console.warn(`Error fetching real data for ${symbol}:`, error);
      
      if (error.message === 'Rate limit exceeded') {
        this.activateRateLimit(); // Activar rate limit por 1 minuto
        throw new Error(`Rate limit exceeded for ${symbol}. Please try again later.`);
      }
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying fetch for ${symbol} (attempt ${this.retryCount})`);
        await new Promise(resolve => setTimeout(resolve, this.retryCount * 2000));
        return this.fetchRealData(symbol);
      }
    }

    // If all APIs fail, throw error - no fallback data
    this.retryCount = 0;
    throw new Error(`Failed to fetch real data for ${symbol} from all APIs.`);
  }

  // Obtener datos de stock con manejo de errores mejorado y APIs reales
  private async fetchStockData(symbol: string): Promise<MarketData | null> {
    // Validate input
    if (!InputValidator.validateSymbol(symbol)) {
      apiLogger.error('Invalid stock symbol', { symbol });
      return null;
    }

    // Check rate limits
    const rateLimitResult = checkRateLimit('alphaVantage', { function: 'GLOBAL_QUOTE', symbol });
    if (rateLimitResult.result === RateLimitResult.RATE_LIMITED) {
      apiLogger.warn('Rate limit exceeded for Alpha Vantage', { 
        symbol, 
        retryAfter: rateLimitResult.retryAfter 
      });
      // Fallback to cached data if available
      const cached = this.cache.get(symbol);
      if (cached && Date.now() - cached.timestamp < this.extendedCacheExpiry) {
        apiLogger.info('Using extended cache due to rate limit', { symbol });
        return { ...cached.data, source: 'cache' };
      }
    }

    // Check if we should fail immediately
    if (!this.apiStatus.canUseStocks) {
      apiLogger.info('No stock APIs configured', { symbol });
      throw new Error(`No stock APIs configured for ${symbol}`);
    }

    // Use request deduplication
    return deduplicateApiRequest(
      'stock_data', 
      { symbol },
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.GENERAL.REQUEST_TIMEOUT);
        
        try {
          apiLogger.debug('Fetching stock data', { symbol });
          
          // Try Alpha Vantage with automatic key rotation
          return await this.alphaVantageBreaker.execute(async () => {
            let lastError: Error | null = null;
            let attemptCount = 0;
            let currentApiKey = '';
            const maxAttempts = 3; // Try up to 3 different keys
            
            while (attemptCount < maxAttempts) {
              try {
                // Get current API key from rotation manager
                currentApiKey = apiKeyManager.getCurrentAlphaVantageKey();
                const url = `${API_CONFIG.ALPHA_VANTAGE.BASE_URL}?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${currentApiKey}`;
                
                console.log(`🔑 Using Alpha Vantage API Key: ${currentApiKey.substring(0, 8)}...`);
                apiLogger.apiRequest('GET', url, { symbol, keyUsed: currentApiKey.substring(0, 8) });
                const startTime = Date.now();
                
                const response = await fetch(url, { signal: controller.signal });
                const duration = Date.now() - startTime;
                
                apiLogger.apiResponse('GET', url, response.status, duration, { symbol });

                if (response.status === 429) {
                  const errorMsg = 'Rate limit exceeded';
                  await apiKeyManager.recordAPIRequest(false, errorMsg);
                  throw new Error(errorMsg);
                }
                if (response.ok) {
                  const data = await response.json();
                  
                  // Check for API errors in response
                  if (data['Error Message']) {
                    const errorMsg = `API Error: ${data['Error Message']}`;
                    await apiKeyManager.recordAPIRequest(false, errorMsg);
                    throw new Error(errorMsg);
                  }
                  
                  if (data['Note'] && data['Note'].includes('rate limit')) {
                    const errorMsg = 'Rate limit exceeded';
                    await apiKeyManager.recordAPIRequest(false, errorMsg);
                    throw new Error(errorMsg);
                  }
                  
                  const quote = data['Global Quote'];
                  
                  if (quote && quote['05. price']) {
                    console.log(`🔍 Alpha Vantage Raw Data for ${symbol} with key ${currentApiKey.substring(0, 8)}:`, quote);
                    
                    const price = parseFloat(quote['05. price']);
                    const change = parseFloat(quote['09. change']);
                    const changePercent = parseFloat(quote['10. change percent'].replace('%', ''));
                    
                    const marketData: MarketData = {
                      symbol,
                      price: parseFloat(price.toFixed(2)),
                      change: parseFloat(change.toFixed(2)),
                      changePercent: parseFloat(changePercent.toFixed(2)),
                      volume: parseInt(quote['06. volume']) || 0,
                      marketCap: 0, // Not available from Alpha Vantage quotes
                      type: 'stock',
                      lastUpdated: Date.now(),
                      source: 'real'
                    };
                    
                    // Record successful request
                    await apiKeyManager.recordAPIRequest(true);
                    
                    console.log(`✅ Alpha Vantage processed data for ${symbol}:`, marketData);
                    apiLogger.info('Real stock data fetched from Alpha Vantage', { symbol, keyUsed: currentApiKey.substring(0, 8) });
                    return marketData;
                  } else {
                    console.warn(`⚠️ Alpha Vantage: No price data for ${symbol}`, data);
                    throw new Error('No price data available');
                  }
                } else {
                  throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
              } catch (attemptError) {
                lastError = attemptError as Error;
                attemptCount++;
                
                console.warn(`❌ Attempt ${attemptCount} failed with key ${currentApiKey.substring(0, 8)}:`, attemptError);
                
                // Record the failed request
                await apiKeyManager.recordAPIRequest(false, lastError.message);
                
                // If rate limited or quota exceeded, try next key
                if (lastError.message.includes('rate limit') || lastError.message.includes('quota') || lastError.message.includes('limit exceeded')) {
                  console.log(`🔄 Rotating to next available API key...`);
                  // The rotation manager will automatically find the next available key
                  continue;
                }
                
                // For other errors, break the loop
                break;
              }
            }
            
            // If all attempts failed, throw the last error
            throw lastError || new Error('All API key attempts exhausted');
          });

          // Try Yahoo Finance as fallback
          return await this.yahooBreaker.execute(async () => {
            try {
              const url = `${API_CONFIG.YAHOO_FINANCE.BASE_URL}/v8/finance/chart/${symbol}`;
              
              apiLogger.apiRequest('GET', url, { symbol });
              const startTime = Date.now();
              
              const response = await fetch(url, { signal: controller.signal });
              const duration = Date.now() - startTime;
              
              apiLogger.apiResponse('GET', url, response.status, duration, { symbol });
              
              if (response.ok) {
                const data = await response.json();
                console.log(`🔍 Yahoo Finance Raw Data for ${symbol}:`, data);
                
                const result = data.chart?.result?.[0];
                
                if (result && result.meta) {
                  const meta = result.meta;
                  console.log(`🔍 Yahoo Finance Meta for ${symbol}:`, meta);
                  
                  const price = meta.regularMarketPrice || meta.previousClose || 0;
                  const previousClose = meta.previousClose || price;
                  const change = price - previousClose;
                  const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0;
                  
                  const marketData: MarketData = {
                    symbol,
                    price: parseFloat(price.toFixed(2)),
                    change: parseFloat(change.toFixed(2)),
                    changePercent: parseFloat(changePercent.toFixed(2)),
                    volume: meta.regularMarketVolume || 0,
                    marketCap: meta.marketCap || 0, // Use market cap from Yahoo if available
                    type: 'stock',
                    lastUpdated: Date.now(),
                    source: 'real'
                  };
                  
                  console.log(`✅ Yahoo Finance processed data for ${symbol}:`, marketData);
                  apiLogger.info('Real stock data fetched from Yahoo Finance', { symbol });
                  return marketData;
                } else {
                  console.warn(`⚠️ Yahoo Finance: No meta data for ${symbol}`, data);
                }
              } else {
                console.error(`❌ Yahoo Finance API Error for ${symbol}: ${response.status} ${response.statusText}`);
              }
            } catch (yahooError) {
              apiLogger.warn('Yahoo Finance failed', { symbol, error: yahooError as Error });
              throw yahooError;
            }
          });

        } catch (error) {
          apiLogger.error('All stock APIs failed', { symbol, error: error as Error });
          
          // No fallback data - throw error
          apiLogger.info('All APIs failed for stock', { symbol });
          throw new Error(`Failed to fetch real data for stock ${symbol}`);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    );
  }

  // Obtener datos de crypto con manejo de errores mejorado y APIs reales
  private async fetchCryptoData(symbol: string): Promise<MarketData | null> {
    // Use circuit breaker for CoinGecko API
    if (!this.coinGeckoBreaker.isRequestAllowed()) {
      console.log(`🚫 CoinGecko circuit breaker is OPEN for ${symbol}`);
      return null;
    }

    try {
      return await this.coinGeckoBreaker.execute(async () => {
        return await this.queueCoinGeckoRequest(async () => {
          console.log(`🔍 Fetching crypto data for ${symbol} from CoinGecko...`);
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.GENERAL.REQUEST_TIMEOUT);
          
          // Try CoinGecko (no API key required for basic usage)
          const coinId = this.getCoinGeckoId(symbol);
          console.log(`🔍 CoinGecko ID for ${symbol}: ${coinId}`);
          
          // Include circulating_supply to calculate correct price from market cap
          const url = `${API_CONFIG.COINGECKO.BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_circulating_supply=true`;
          console.log(`🔍 CoinGecko URL: ${url}`);
          
          const response = await fetch(url, { signal: controller.signal });
          
          clearTimeout(timeoutId);

          console.log(`🔍 CoinGecko Response Status: ${response.status} ${response.statusText}`);

          if (response.status === 429) {
            console.warn(`⚠️ CoinGecko rate limit for ${symbol}`);
            throw new Error('Rate limit exceeded');
          }

        if (response.ok) {
          const data = await response.json();
          console.log(`🔍 CoinGecko Raw Data:`, data);
          
          if (data[coinId]) {
            const coinData = data[coinId];
            console.log(`🔍 Coin Data for ${coinId}:`, coinData);
            
            // Use the price directly from CoinGecko API (most accurate)
            const price = coinData.usd;
            
            // Only log the market cap calculation for debugging, don't use it
            if (coinData.usd_market_cap && coinData.usd_circulating_supply && coinData.usd_circulating_supply > 0) {
              const calculatedFromMCap = coinData.usd_market_cap / coinData.usd_circulating_supply;
              console.log(`💰 Debug: Market Cap calculation for ${symbol}: $${price} (API) vs $${calculatedFromMCap} (calculated)`);
            }
            
            const marketData: MarketData = {
              symbol,
              price: parseFloat(price.toFixed(2)), // Format to 2 decimals
              change: parseFloat((price * (coinData.usd_24h_change || 0) / 100).toFixed(2)),
              changePercent: parseFloat((coinData.usd_24h_change || 0).toFixed(2)),
              volume: coinData.usd_24h_vol || 0,
              marketCap: coinData.usd_market_cap,
              type: 'crypto',
              lastUpdated: Date.now(),
              source: 'real'
            };
            
            // Validate the market data before returning
            const validation = InputValidator.validateMarketData(marketData);
            if (!validation.isValid) {
              console.error(`❌ Invalid market data for ${symbol}:`, validation.errors);
              throw new Error(`Invalid data: ${validation.errors.join(', ')}`);
            }
            
            console.log(`✅ Real crypto data for ${symbol} from CoinGecko:`, marketData);
            return validation.sanitizedValue || marketData;
          } else {
            console.warn(`⚠️ No data found for coinId: ${coinId} in response:`, data);
            throw new Error(`No data found for ${symbol}`);
          }
        } else {
          console.error(`❌ CoinGecko API Error: ${response.status} ${response.statusText}`);
          const responseText = await response.text();
          console.error(`❌ Response body:`, responseText);
          throw new Error(`API Error: ${response.status}`);
        }
        }); // Close queueCoinGeckoRequest
      }); // Close coinGeckoBreaker.execute
    } catch (error) {
      console.error(`❌ CoinGecko failed for ${symbol}:`, error.message);
      console.error(`❌ Full error:`, error);
      return null;
    }
  }

  // Helper to get CoinGecko ID from symbol
  private getCoinGeckoId(symbol: string): string {
    // First check if it's already a CoinGecko ID (contains dashes or known IDs)
    const knownCoinGeckoIds = [
      'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 
      'avalanche', 'chainlink', 'uniswap', 'injective-protocol',
      'fantom', 'thorchain', 'kava', 'ankr',
      'oasis-network', 'ocean-protocol', 'celer-network',
      'ren', 'band-protocol', 'render-token'
    ];
    
    // If it's already a CoinGecko ID, return as-is
    if (knownCoinGeckoIds.includes(symbol.toLowerCase()) || symbol.includes('-')) {
      return symbol.toLowerCase();
    }
    
    // Otherwise, map ticker symbols to CoinGecko IDs
    const symbolMap: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'AVAX': 'avalanche',
      'INJ': 'injective-protocol',
      'ROSE': 'oasis-network',
      'FTM': 'fantom',
      'OCEAN': 'ocean-protocol',
      'RUNE': 'thorchain',
      'KAVA': 'kava',
      'CELR': 'celer-network',
      'REN': 'ren',
      'BAND': 'band-protocol',
      'ANKR': 'ankr',
      'UNI': 'uniswap',
      'RNDR': 'render-token'
    };
    
    return symbolMap[symbol.toUpperCase()] || symbol.toLowerCase();
  }

  // Método principal para obtener datos de mercado con fallback inteligente
  async getMarketData(symbol: string): Promise<MarketData> {
    // 1. Verificar cache normal primero
    const cached = await this.getCachedData(symbol, false);
    if (cached) {
      return cached;
    }

    // 2. Si estamos en rate limit, intentar cache extendido
    if (this.isRateLimited()) {
      const extendedCached = await this.getCachedData(symbol, true);
      if (extendedCached) {
        console.log(`Using extended cache for ${symbol} due to rate limit`);
        return { ...extendedCached, source: 'cache' };
      }
    }

    // 3. Intentar obtener datos frescos
    try {
      const data = await this.fetchRealData(symbol);
      
      // 4. Guardar en cache solo si es dato real
      if (data.source === 'real') {
        await this.setCachedData(symbol, data);
      }
      
      return data;
    } catch (error) {
      console.warn(`Failed to get fresh data for ${symbol}:`, error);
      
      // 5. Último recurso: cache extendido o datos generados
      const extendedCached = await this.getCachedData(symbol, true);
      if (extendedCached) {
        return { ...extendedCached, source: 'cache' };
      }
      
      // 6. No fallback data - throw error
      throw new Error(`Unable to fetch real data for ${symbol}. All APIs failed.`);
    }
  }

  // Obtener múltiples símbolos con cache batch inteligente
  async getBatchMarketData(symbols: string[]): Promise<MarketData[]> {
    // 1. Intentar obtener datos del cache batch
    const cachedBatch = await this.getBatchCachedData();
    if (cachedBatch) {
      // Si tenemos cache válido, devolver los datos solicitados
      const results: MarketData[] = [];
      for (const symbol of symbols) {
        const cachedData = cachedBatch.get(symbol);
        if (cachedData) {
          results.push({ ...cachedData, source: 'cache' });
        } else {
          // Si falta algún símbolo, obtenerlo individualmente
          const individualData = await this.getMarketData(symbol);
          results.push(individualData);
        }
      }
      return results;
    }

    // 2. Si no hay cache válido o está vencido, obtener datos frescos
    console.log('🔄 Refreshing batch cache with fresh data...');
    
    // Si estamos en rate limit, fail immediately
    if (this.isRateLimited()) {
      console.log('Rate limit active, cannot fetch batch data');
      throw new Error('Rate limit active. Cannot fetch batch market data. Please try again later.');
    }
    
    // 3. Obtener datos reales para todos los símbolos
    const freshDataMap = new Map<string, MarketData>();
    const results: MarketData[] = [];
    
    for (const symbol of symbols) {
      try {
        const data = await this.fetchRealData(symbol);
        freshDataMap.set(symbol, data);
        results.push(data);
      } catch (error) {
        console.warn(`Failed to get fresh data for ${symbol}:`, error);
        // Skip symbols that fail - no fallback data
        continue;
      }
    }
    
    // 4. Guardar los datos frescos en cache batch
    await this.setBatchCachedData(freshDataMap);
    
    return results;
  }

  // Generar gem data con persistencia de fundamentals
  async getGemData(symbol: string, persistFundamentals: boolean = true): Promise<GemData> {
    try {
      let fundamentals = { team: 0, tech: 0, community: 0, adoption: 0 };
      
      if (persistFundamentals) {
        // Intentar obtener fundamentals guardados
        const saved = await AsyncStorage.getItem(`gem_fundamentals_${symbol}`);
        if (saved) {
          fundamentals = JSON.parse(saved);
        } else {
          // Generar nuevos fundamentals y guardarlos
          fundamentals = {
            team: Math.floor(Math.random() * 40) + 60, // 60-100
            tech: Math.floor(Math.random() * 40) + 60,
            community: Math.floor(Math.random() * 40) + 60,
            adoption: Math.floor(Math.random() * 40) + 60
          };
          await AsyncStorage.setItem(`gem_fundamentals_${symbol}`, JSON.stringify(fundamentals));
        }
      } else {
        // Generar fundamentals frescos
        fundamentals = {
          team: Math.floor(Math.random() * 40) + 60,
          tech: Math.floor(Math.random() * 40) + 60,
          community: Math.floor(Math.random() * 40) + 60,
          adoption: Math.floor(Math.random() * 40) + 60
        };
      }

      const marketData = await this.getMarketData(symbol);
      
      return {
        symbol,
        name: symbol.replace(/USD$/, ''),
        price: marketData.price,
        change24h: marketData.changePercent,
        marketCap: marketData.marketCap || Math.floor(Math.random() * 1000000000),
        volume24h: marketData.volume || Math.floor(Math.random() * 100000000),
        type: marketData.type,
        ...fundamentals,
        lastUpdated: Date.now(),
        source: marketData.source
      };
    } catch (error) {
      console.warn(`Error generating gem data for ${symbol}:`, error);
      
      // No fallback data - throw error
      throw new Error(`Failed to generate gem data for ${symbol}: ${error.message}`);
    }
  }

  // Limpiar cache antiguo
  async clearOldCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const marketKeys = keys.filter(key => key.startsWith('market_'));
      
      for (const key of marketKeys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          const parsed = JSON.parse(data);
          if (Date.now() - parsed.timestamp > this.cacheExpiry * 2) {
            await AsyncStorage.removeItem(key);
          }
        }
      }
    } catch (error) {
      console.warn('Error clearing old cache:', error);
    }
  }

  // Obtener estadísticas del servicio
  getServiceStats() {
    return {
      rateLimitActive: this.rateLimitActive,
      rateLimitUntil: this.rateLimitUntil,
      retryCount: this.retryCount,
      cacheSize: this.cache.size,
      gemCacheSize: this.gemCache.size,
      lastRequestTime: this.lastRequestTime,
      cacheExpiry: this.cacheExpiry,
      cacheExpiryMinutes: this.cacheExpiry / 60000
    };
  }

  // Verificar estado del cache batch
  async getBatchCacheStats() {
    try {
      const lastUpdate = await AsyncStorage.getItem(this.LAST_UPDATE_KEY);
      const cachedData = await AsyncStorage.getItem(this.MARKET_DATA_KEY);
      
      if (lastUpdate && cachedData) {
        const timestamp = parseInt(lastUpdate);
        const age = Date.now() - timestamp;
        const dataCount = Object.keys(JSON.parse(cachedData)).length;
        
        return {
          isValid: age < this.cacheExpiry,
          ageMinutes: Math.floor(age / 60000),
          ageSeconds: Math.floor(age / 1000),
          symbolCount: dataCount,
          lastUpdate: new Date(timestamp).toLocaleTimeString(),
          nextRefreshIn: Math.max(0, Math.ceil((this.cacheExpiry - age) / 1000))
        };
      }
    } catch (error) {
      console.warn('Error getting batch cache stats:', error);
    }
    
    return {
      isValid: false,
      ageMinutes: 0,
      ageSeconds: 0,
      symbolCount: 0,
      lastUpdate: 'Never',
      nextRefreshIn: 0
    };
  }

  // Forzar actualización del cache batch
  async forceBatchRefresh(symbols: string[] = []): Promise<void> {
    console.log('🔄 Forcing batch cache refresh...');
    
    // Limpiar timestamp para forzar refresh
    await AsyncStorage.removeItem(this.LAST_UPDATE_KEY);
    
    if (symbols.length > 0) {
      await this.getBatchMarketData(symbols);
    }
  }

  // Resetear rate limit manualmente (para testing o recuperación)
  resetRateLimit(): void {
    this.rateLimitActive = false;
    this.rateLimitUntil = 0;
    this.retryCount = 0;
    console.log('Rate limit reset manually');
  }

  // Forzar limpieza de cache
  clearAllCache(): void {
    this.cache.clear();
    this.gemCache.clear();
    console.log('All cache cleared');
  }

  // Process CoinGecko queue one request at a time to respect rate limits
  private async processCoinGeckoQueue(): Promise<void> {
    if (this.coinGeckoProcessing || this.coinGeckoQueue.length === 0) {
      return;
    }

    this.coinGeckoProcessing = true;
    
    while (this.coinGeckoQueue.length > 0) {
      const request = this.coinGeckoQueue.shift();
      if (request) {
        try {
          await request();
          // Wait between requests to respect rate limits
          await new Promise(resolve => setTimeout(resolve, API_CONFIG.COINGECKO.RATE_LIMIT));
        } catch (error) {
          console.error('CoinGecko queue request failed:', error);
        }
      }
    }
    
    this.coinGeckoProcessing = false;
  }

  // Add request to CoinGecko queue
  private queueCoinGeckoRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.coinGeckoQueue.push(async () => {
        try {
          const result = await requestFn();
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Start processing if not already running
      this.processCoinGeckoQueue();
    });
  }

  // Get ONLY real data - no fallbacks or cache
  async getRealMarketDataOnly(symbols: string[]): Promise<MarketData[]> {
    const results: MarketData[] = [];
    
    console.log(`🔍 Getting ONLY real market data for ${symbols.length} symbols (no fallbacks)...`);
    
    for (const symbol of symbols) {
      try {
        await this.throttleRequest();
        
        let realData: MarketData | null = null;
        
        // Determine asset type and get real data
        if (this.getAssetType(symbol) === 'stock') {
          realData = await this.fetchStockData(symbol);
        } else {
          realData = await this.fetchCryptoData(symbol);
        }
        
        // Only accept data that is explicitly from API source
        if (realData && realData.source === 'real') {
          results.push(realData);
          console.log(`✅ REAL data obtained for ${symbol}: $${realData.price} (source: ${realData.source})`);
        } else {
          console.warn(`🚫 No real data available for ${symbol} - skipping`);
        }
        
      } catch (error) {
        console.error(`❌ Failed to get real data for ${symbol}:`, error);
        // Don't add any fallback data - skip this symbol
      }
    }
    
    console.log(`📊 Real data results: ${results.length}/${symbols.length} symbols with real data`);
    return results;
  }
}

export const realDataService = new RealDataService();

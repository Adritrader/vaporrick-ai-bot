import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchMockAssetData, fetchMockMultipleAssets } from './mockDataService';

export interface MarketData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: number;
  marketCap?: number;
  type: 'stock' | 'crypto';
  lastUpdated: number;
  source?: 'real' | 'cache' | 'mock' | 'fallback';
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
  source?: 'real' | 'cache' | 'mock' | 'fallback';
}

class RealDataService {
  private cache = new Map<string, { data: MarketData; timestamp: number }>();
  private gemCache = new Map<string, { data: GemData; timestamp: number }>();
  private lastRequestTime = 0;
  private requestDelay = 3000; // 3 segundos entre requests para evitar rate limiting
  private cacheExpiry = 120000; // 2 minutos de cache (como solicitado)
  private extendedCacheExpiry = 600000; // 10 minutos para cache extendido en caso de error
  private retryCount = 0;
  private maxRetries = 2; // Reducir intentos para fallar más rápido a fallback
  private rateLimitActive = false;
  private rateLimitUntil = 0;
  
  // Cache keys para AsyncStorage
  private readonly MARKET_DATA_KEY = 'market_data_batch';
  private readonly LAST_UPDATE_KEY = 'market_data_last_update';
  private readonly GEM_DATA_KEY = 'gem_data_batch';

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
          
          console.log(`📦 Using batch cache (${Math.floor((now - timestamp) / 1000)}s old) for ${dataMap.size} symbols`);
          return dataMap;
        } else {
          console.log(`⏰ Batch cache expired (${Math.floor((now - timestamp) / 1000)}s old), needs refresh`);
        }
      }
    } catch (error) {
      console.warn('Error reading batch cache:', error);
    }
    return null;
  }

  // Guardar todos los datos de mercado en AsyncStorage
  private async setBatchCachedData(dataMap: Map<string, MarketData>): Promise<void> {
    try {
      const dataObject = Object.fromEntries(dataMap);
      const timestamp = Date.now();
      
      await Promise.all([
        AsyncStorage.setItem(this.MARKET_DATA_KEY, JSON.stringify(dataObject)),
        AsyncStorage.setItem(this.LAST_UPDATE_KEY, timestamp.toString())
      ]);
      
      console.log(`💾 Saved batch cache with ${dataMap.size} symbols`);
    } catch (error) {
      console.warn('Error saving batch cache:', error);
    }
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
    try {
      await AsyncStorage.setItem(`market_${key}`, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Error saving cache:', error);
    }
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

  // Convertir datos mock al formato MarketData
  private convertMockToMarketData(mockAsset: any, symbol: string): MarketData {
    return {
      symbol,
      price: this.roundNumber(mockAsset.price || 0),
      change: this.roundNumber(mockAsset.change || 0),
      changePercent: this.roundNumber(mockAsset.changePercent || 0),
      volume: mockAsset.volume || Math.floor(Math.random() * 10000000),
      marketCap: mockAsset.marketCap || Math.floor(Math.random() * 100000000000),
      type: this.getAssetType(symbol),
      lastUpdated: Date.now(),
      source: 'mock'
    };
  }
  // Detectar si es crypto o stock
  private getAssetType(symbol: string): 'stock' | 'crypto' {
    const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'ADA', 'SOL', 'DOT', 'MATIC', 'AVAX', 'LINK', 'UNI'];
    return cryptoSymbols.some(crypto => symbol.includes(crypto)) ? 'crypto' : 'stock';
  }

  // Generar datos mock realistas
  private generateMockData(symbol: string): MarketData {
    const basePrice = Math.random() * 1000 + 10;
    const changePercent = (Math.random() - 0.5) * 20; // -10% a +10%
    const change = this.roundNumber(basePrice * (changePercent / 100));
    
    return {
      symbol,
      price: this.roundNumber(basePrice),
      change: this.roundNumber(change),
      changePercent: this.roundNumber(changePercent),
      volume: Math.floor(Math.random() * 10000000),
      marketCap: Math.floor(Math.random() * 100000000000),
      type: this.getAssetType(symbol),
      lastUpdated: Date.now(),
      source: 'fallback'
    };
  }

  // Obtener datos usando mock service como fallback inteligente
  private async getMockServiceData(symbol: string): Promise<MarketData> {
    try {
      const mockAsset = await fetchMockAssetData(symbol);
      return this.convertMockToMarketData(mockAsset, symbol);
    } catch (error) {
      console.warn('Mock service failed, using generated data:', error);
      return this.generateMockData(symbol);
    }
  }

  // Intentar obtener datos reales con múltiples fallbacks
  private async fetchRealData(symbol: string): Promise<MarketData> {
    // Si estamos en rate limit, usar directamente fallbacks
    if (this.isRateLimited()) {
      console.log(`Rate limit active, using fallback for ${symbol}`);
      return this.getMockServiceData(symbol);
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
        return this.getMockServiceData(symbol);
      }
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        console.log(`Retrying fetch for ${symbol} (attempt ${this.retryCount})`);
        await new Promise(resolve => setTimeout(resolve, this.retryCount * 2000));
        return this.fetchRealData(symbol);
      }
    }

    // Si todo falla, usar mock service
    this.retryCount = 0;
    return this.getMockServiceData(symbol);
  }

  // Obtener datos de stock con manejo de errores mejorado
  private async fetchStockData(symbol: string): Promise<MarketData | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // Timeout más largo
      
      const response = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data['Global Quote'] && data['Global Quote']['05. price']) {
        const quote = data['Global Quote'];
        return {
          symbol,
          price: this.roundNumber(parseFloat(quote['05. price'])),
          change: this.roundNumber(parseFloat(quote['09. change'])),
          changePercent: this.roundNumber(parseFloat(quote['10. change percent'].replace('%', ''))),
          volume: parseInt(quote['06. volume']),
          type: 'stock',
          lastUpdated: Date.now()
        };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`Request timeout for ${symbol}`);
      }
      throw error;
    }
    
    return null;
  }

  // Obtener datos de crypto con manejo de errores mejorado
  private async fetchCryptoData(symbol: string): Promise<MarketData | null> {
    try {
      const coinId = symbol.toLowerCase().replace('USD', '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);

      if (response.status === 429) {
        throw new Error('Rate limit exceeded');
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data[coinId]) {
        const coinData = data[coinId];
        return {
          symbol,
          price: this.roundNumber(coinData.usd),
          change: this.roundNumber(coinData.usd * (coinData.usd_24h_change || 0) / 100),
          changePercent: this.roundNumber(coinData.usd_24h_change || 0),
          marketCap: coinData.usd_market_cap,
          type: 'crypto',
          lastUpdated: Date.now()
        };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn(`Request timeout for ${symbol}`);
      }
      throw error;
    }
    
    return null;
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
      
      // 4. Guardar en cache solo si es dato real o mock de calidad
      if (data.source === 'real' || data.source === 'mock') {
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
      
      // 6. Generar datos como último recurso
      return this.generateMockData(symbol);
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
    
    // Si estamos en rate limit, usar mock service para todo el batch
    if (this.isRateLimited()) {
      console.log('Rate limit active, using mock service for batch request');
      try {
        const mockAssets = await fetchMockMultipleAssets(symbols);
        const mockDataMap = new Map<string, MarketData>();
        const results = mockAssets.map((asset, index) => {
          const marketData = this.convertMockToMarketData(asset, symbols[index]);
          mockDataMap.set(symbols[index], marketData);
          return marketData;
        });
        
        // Guardar mock data en cache batch
        await this.setBatchCachedData(mockDataMap);
        return results;
      } catch (error) {
        console.warn('Mock batch service failed:', error);
        return symbols.map(symbol => this.generateMockData(symbol));
      }
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
        const fallbackData = await this.getMockServiceData(symbol);
        freshDataMap.set(symbol, fallbackData);
        results.push(fallbackData);
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
      
      // Fallback completo
      return {
        symbol,
        name: symbol.replace(/USD$/, ''),
        price: this.roundNumber(Math.random() * 100),
        change24h: this.roundNumber((Math.random() - 0.5) * 20),
        marketCap: Math.floor(Math.random() * 1000000000),
        volume24h: Math.floor(Math.random() * 100000000),
        type: this.getAssetType(symbol),
        team: Math.floor(Math.random() * 40) + 60,
        tech: Math.floor(Math.random() * 40) + 60,
        community: Math.floor(Math.random() * 40) + 60,
        adoption: Math.floor(Math.random() * 40) + 60,
        lastUpdated: Date.now(),
        source: 'fallback'
      };
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
}

export const realDataService = new RealDataService();

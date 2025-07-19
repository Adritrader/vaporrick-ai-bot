import axios from 'axios';
import { API_CONFIG } from '../config/apiConfig';
import CoinPaprikaService from './coinPaprikaService';
import EnhancedCryptoService from './enhancedCryptoService';

// Real Market Data Service (replaces all mock data)
export class RealMarketDataService {
  private readonly TWELVE_DATA_KEY = API_CONFIG.TWELVE_DATA.API_KEY;
  private readonly ALPHA_VANTAGE_KEY = API_CONFIG.ALPHA_VANTAGE.API_KEY;
  private readonly COINGECKO_BASE_URL = API_CONFIG.COINGECKO.BASE_URL;
  private readonly YAHOO_FINANCE_BASE_URL = API_CONFIG.YAHOO_FINANCE.BASE_URL + '/v8/finance/chart';
  private readonly TWELVE_DATA_BASE_URL = API_CONFIG.TWELVE_DATA.BASE_URL;
  
  // Enhanced crypto service with CoinPaprika fallback
  // Note: EnhancedCryptoService uses static methods
  
  // Cache to avoid excessive API calls with improved rate limiting
  private dataCache = new Map<string, { data: any, timestamp: number }>();
  private readonly CACHE_DURATION = 3 * 60 * 1000; // 3 minutes (reduced for fresher data)
  
  /**
   * Fetch real market data with enhanced fallback sources including CoinPaprika
   */
  async fetchRealMarketData(symbol: string, timeframe: string = '1d'): Promise<any> {
    const cacheKey = `${symbol}_${timeframe}`;
    const cached = this.dataCache.get(cacheKey);
    
    // Return cached data if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      console.log(`📊 Using cached data for ${symbol}`);
      return cached.data;
    }
    
    console.log(`📊 Fetching real market data for ${symbol} with enhanced sources...`);
    
    try {
      let marketData = null;
      
      // Try different data sources in order of preference
      if (this.isCryptocurrency(symbol)) {
        marketData = await this.fetchCoinGeckoData(symbol, timeframe);
      } else {
        marketData = await this.fetchStockData(symbol, timeframe);
      }
      
      // Fallback to Yahoo Finance if primary source fails
      if (!marketData || marketData.length === 0) {
        console.log(`⚠️ Primary source failed, trying Yahoo Finance for ${symbol}`);
        marketData = await this.fetchYahooFinanceData(symbol, timeframe);
      }
      
      // Final fallback to Alpha Vantage
      if (!marketData || marketData.length === 0) {
        console.log(`⚠️ Yahoo Finance failed, trying Alpha Vantage for ${symbol}`);
        marketData = await this.fetchAlphaVantageData(symbol, timeframe);
      }
      
      if (marketData && marketData.length > 0) {
        // Cache the successful result
        this.dataCache.set(cacheKey, {
          data: marketData,
          timestamp: Date.now()
        });
        
        console.log(`✅ Successfully fetched ${marketData.length} data points for ${symbol}`);
        return marketData;
      }
      
      throw new Error(`No data available for ${symbol}`);
      
    } catch (error) {
      console.error(`❌ Failed to fetch real data for ${symbol}:`, error);
      
      // Return empty array if all API sources fail - no mock data
      console.warn(`⚠️ No real data available for ${symbol}, returning empty dataset`);
      return [];
    }
  }
  
  /**
   * Fetch cryptocurrency data from CoinGecko (free API)
   */
  private async fetchCoinGeckoData(symbol: string, timeframe: string): Promise<any[]> {
    try {
      const coinId = this.getCoinGeckoId(symbol);
      const days = this.timeframeToDays(timeframe);
      
      const url = `${this.COINGECKO_BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
      const response = await axios.get(url, { timeout: 15000 });
      
      if (response.data && Array.isArray(response.data)) {
        return response.data.map((item: any) => ({
          timestamp: item[0],
          open: item[1],
          high: item[2],
          low: item[3],
          close: item[4],
          volume: 0, // CoinGecko OHLC doesn't include volume
          date: new Date(item[0])
        }));
      }
      
      return [];
    } catch (error) {
      console.error('CoinGecko API error:', error);
      return [];
    }
  }
  
  /**
   * Fetch stock data from multiple sources (prioritizing Twelve Data)
   */
  private async fetchStockData(symbol: string, timeframe: string): Promise<any[]> {
    // Try Twelve Data first if API key is available (best for stocks)
    if (this.TWELVE_DATA_KEY !== 'demo') {
      const twelveData = await this.fetchTwelveData(symbol, timeframe);
      if (twelveData && twelveData.length > 0) return twelveData;
    }
    
    // Try Alpha Vantage as backup
    if (this.ALPHA_VANTAGE_KEY !== 'demo') {
      const alphaData = await this.fetchAlphaVantageData(symbol, timeframe);
      if (alphaData && alphaData.length > 0) return alphaData;
    }
    
    // Fallback to Yahoo Finance
    return await this.fetchYahooFinanceData(symbol, timeframe);
  }
  
  /**
   * Fetch data from Yahoo Finance (free but may have rate limits)
   */
  private async fetchYahooFinanceData(symbol: string, timeframe: string): Promise<any[]> {
    try {
      const interval = this.timeframeToYahooInterval(timeframe);
      const period = this.timeframeToYahooPeriod(timeframe);
      
      const url = `${this.YAHOO_FINANCE_BASE_URL}/${symbol}?interval=${interval}&range=${period}`;
      const response = await axios.get(url, { 
        timeout: 15000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data?.chart?.result?.[0]) {
        const result = response.data.chart.result[0];
        const timestamps = result.timestamp || [];
        const indicators = result.indicators?.quote?.[0] || {};
        
        return timestamps.map((timestamp: number, index: number) => ({
          timestamp: timestamp * 1000,
          open: indicators.open?.[index] || 0,
          high: indicators.high?.[index] || 0,
          low: indicators.low?.[index] || 0,
          close: indicators.close?.[index] || 0,
          volume: indicators.volume?.[index] || 0,
          date: new Date(timestamp * 1000)
        })).filter((item: any) => item.close > 0); // Filter out invalid data
      }
      
      return [];
    } catch (error) {
      console.error('Yahoo Finance API error:', error);
      return [];
    }
  }
  
  /**
   * Fetch data from Alpha Vantage
   */
  private async fetchAlphaVantageData(symbol: string, timeframe: string): Promise<any[]> {
    try {
      if (this.ALPHA_VANTAGE_KEY === 'demo') {
        console.log('⚠️ Alpha Vantage demo key - limited functionality');
        return [];
      }
      
      const functionName = this.isCryptocurrency(symbol) ? 'DIGITAL_CURRENCY_DAILY' : 'TIME_SERIES_DAILY';
      const market = this.isCryptocurrency(symbol) ? '&market=USD' : '';
      
      const url = `https://www.alphavantage.co/query?function=${functionName}&symbol=${symbol}${market}&apikey=${this.ALPHA_VANTAGE_KEY}`;
      const response = await axios.get(url, { timeout: 15000 });
      
      if (response.data && !response.data.Note && !response.data['Error Message']) {
        const timeSeries = response.data['Time Series (Daily)'] || 
                          response.data['Digital Currency Daily'] ||
                          response.data['Time Series (Digital Currency Daily)'];
        
        if (timeSeries) {
          return Object.entries(timeSeries).map(([date, data]: [string, any]) => ({
            timestamp: new Date(date).getTime(),
            open: parseFloat(data['1. open'] || data['1a. open (USD)'] || 0),
            high: parseFloat(data['2. high'] || data['2a. high (USD)'] || 0),
            low: parseFloat(data['3. low'] || data['3a. low (USD)'] || 0),
            close: parseFloat(data['4. close'] || data['4a. close (USD)'] || 0),
            volume: parseFloat(data['5. volume'] || data['5. volume'] || 0),
            date: new Date(date)
          })).reverse(); // Alpha Vantage returns newest first
        }
      }
      
      return [];
    } catch (error) {
      console.error('Alpha Vantage API error:', error);
      return [];
    }
  }
  
  /**
   * Get current real-time price
   */
  async getCurrentPrice(symbol: string): Promise<number> {
    try {
      if (this.isCryptocurrency(symbol)) {
        return await this.getCryptocurrencyPrice(symbol);
      } else {
        return await this.getStockPrice(symbol);
      }
    } catch (error) {
      console.error(`Error fetching current price for ${symbol}:`, error);
      console.warn(`⚠️ No real price data available for ${symbol}`);
      return 0;
    }
  }
  
  /**
   * Get real cryptocurrency price using Enhanced Crypto Service (CoinPaprika + CoinGecko)
   */
  private async getCryptocurrencyPrice(symbol: string): Promise<number> {
    try {
      // Use enhanced crypto service for better reliability and rate limiting
      const result = await EnhancedCryptoService.getCryptoPrice(symbol);
      
      if (result && result.price > 0) {
        return result.price;
      }
      
      // Return 0 if no real data available - no mock prices
      console.warn(`⚠️ No real price data available for ${symbol}`);
      return 0;
    } catch (error) {
      console.error('Enhanced crypto price fetch error:', error);
      console.warn(`⚠️ No real price data available for ${symbol}`);
      return 0;
    }
  }
  
  /**
   * Get real stock price (prioritizing Twelve Data)
   */
  private async getStockPrice(symbol: string): Promise<number> {
    try {
      // Try Twelve Data quote first (best for stocks)
      if (this.TWELVE_DATA_KEY !== 'demo') {
        const twelvePrice = await this.getTwelveDataPrice(symbol);
        if (twelvePrice > 0) return twelvePrice;
      }
      
      // Fallback to Yahoo Finance quote
      const url = `${this.YAHOO_FINANCE_BASE_URL}/${symbol}?interval=1m&range=1d`;
      const response = await axios.get(url, { 
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      if (response.data?.chart?.result?.[0]) {
        const result = response.data.chart.result[0];
        const meta = result.meta;
        return meta.regularMarketPrice || meta.previousClose || 0;
      }
      
      // Return 0 if no real stock price available - no mock prices
      console.warn(`⚠️ No real stock price available for ${symbol}`);
      return 0;
    } catch (error) {
      console.error('Stock price fetch error:', error);
      console.warn(`⚠️ No real stock price available for ${symbol}`);
      return 0;
    }
  }
  
  /**
   * Get current price from Twelve Data
   */
  private async getTwelveDataPrice(symbol: string): Promise<number> {
    try {
      const url = `${this.TWELVE_DATA_BASE_URL}/price?symbol=${symbol}&apikey=${this.TWELVE_DATA_KEY}`;
      const response = await axios.get(url, { timeout: 10000 });
      
      if (response.data && response.data.price) {
        const price = parseFloat(response.data.price);
        console.log(`📊 Twelve Data: Current price for ${symbol}: $${price}`);
        return price;
      }
      
      return 0;
    } catch (error) {
      console.error(`Twelve Data price fetch error for ${symbol}:`, error);
      return 0;
    }
  }
  
  /**
   * Helper functions
   */
  private isCryptocurrency(symbol: string): boolean {
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'LINK', 'DOT', 'BNB', 'MATIC', 'ALGO'];
    return cryptoSymbols.includes(symbol.toUpperCase());
  }
  
  private getCoinGeckoId(symbol: string): string {
    const mapping: Record<string, string> = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'LINK': 'chainlink',
      'DOT': 'polkadot',
      'BNB': 'binancecoin',
      'MATIC': 'matic-network',
      'ALGO': 'algorand'
    };
    
    return mapping[symbol.toUpperCase()] || symbol.toLowerCase();
  }
  
  private timeframeToDays(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1h': '1',
      '4h': '1',
      '1d': '7',
      '1w': '30',
      '1M': '365'
    };
    
    return mapping[timeframe] || '7';
  }
  
  private timeframeToYahooInterval(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1h': '1h',
      '4h': '4h',
      '1d': '1d',
      '1w': '1wk',
      '1M': '1mo'
    };
    
    return mapping[timeframe] || '1d';
  }
  
  private timeframeToYahooPeriod(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1h': '1d',
      '4h': '5d',
      '1d': '1mo',
      '1w': '3mo',
      '1M': '1y'
    };
    
    return mapping[timeframe] || '1mo';
  }
  
  private timeframeToTwelveDataInterval(timeframe: string): string {
    const mapping: Record<string, string> = {
      '1h': '1h',
      '4h': '4h', 
      '1d': '1day',
      '1w': '1week',
      '1M': '1month'
    };
    
    return mapping[timeframe] || '1day';
  }
  
  /**
   * Fetch data from Twelve Data (excellent for stocks with generous free tier)
   */
  private async fetchTwelveData(symbol: string, timeframe: string): Promise<any[]> {
    try {
      if (this.TWELVE_DATA_KEY === 'demo') {
        console.log('⚠️ Twelve Data demo key - get free key at twelvedata.com');
        return [];
      }
      
      const interval = this.timeframeToTwelveDataInterval(timeframe);
      const outputsize = 30; // Get last 30 periods
      
      const url = `${this.TWELVE_DATA_BASE_URL}/time_series?symbol=${symbol}&interval=${interval}&outputsize=${outputsize}&apikey=${this.TWELVE_DATA_KEY}`;
      const response = await axios.get(url, { timeout: 15000 });
      
      if (response.data && response.data.values && Array.isArray(response.data.values)) {
        console.log(`✅ Twelve Data: Got ${response.data.values.length} data points for ${symbol}`);
        
        return response.data.values.map((item: any) => ({
          timestamp: new Date(item.datetime).getTime(),
          open: parseFloat(item.open),
          high: parseFloat(item.high),
          low: parseFloat(item.low),
          close: parseFloat(item.close),
          volume: parseFloat(item.volume || 0),
          date: new Date(item.datetime)
        })).reverse(); // Twelve Data returns newest first, we want oldest first
      }
      
      // Handle error responses
      if (response.data && response.data.code) {
        console.error(`Twelve Data API error: ${response.data.message}`);
      }
      
      return [];
    } catch (error) {
      console.error('Twelve Data API error:', error);
      return [];
    }
  }
}

export const realMarketDataService = new RealMarketDataService();

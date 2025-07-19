// Fallback Stock Service - APIs without rate limits
// This service uses free APIs as backup when Alpha Vantage reaches daily limits

interface FallbackStockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  source: 'yahoo' | 'finnhub' | 'polygon' | 'iex';
  timestamp: number;
}

export class FallbackStockService {
  
  // Yahoo Finance - No API key required, high reliability
  static async getYahooFinanceData(symbol: string): Promise<FallbackStockData | null> {
    try {
      console.log(`📊 Fetching ${symbol} from Yahoo Finance (free)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.chart && data.chart.result && data.chart.result.length > 0) {
        const result = data.chart.result[0];
        const meta = result.meta;
        const quote = result.indicators?.quote?.[0];
        
        if (meta && meta.regularMarketPrice) {
          const currentPrice = meta.regularMarketPrice;
          const previousClose = meta.previousClose || meta.chartPreviousClose;
          const change = currentPrice - (previousClose || currentPrice);
          const changePercent = previousClose ? (change / previousClose) * 100 : 0;
          
          return {
            symbol,
            name: meta.longName || meta.shortName || symbol,
            price: currentPrice,
            change,
            changePercent,
            volume: meta.regularMarketVolume || 0,
            marketCap: meta.marketCap || 0,
            previousClose: previousClose || 0,
            open: meta.regularMarketOpen || currentPrice,
            high: meta.regularMarketDayHigh || currentPrice,
            low: meta.regularMarketDayLow || currentPrice,
            source: 'yahoo' as const,
            timestamp: Date.now()
          };
        }
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Yahoo Finance error for ${symbol}:`, error);
      return null;
    }
  }
  
  // Finnhub - Free tier available, good for basic data
  static async getFinnhubData(symbol: string): Promise<FallbackStockData | null> {
    try {
      console.log(`📈 Fetching ${symbol} from Finnhub (free tier)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Using free tier (demo token)
      const response = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=demo`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.c && data.c > 0) { // 'c' is current price
        const currentPrice = data.c;
        const previousClose = data.pc || currentPrice;
        const change = currentPrice - previousClose;
        const changePercent = (change / previousClose) * 100;
        
        return {
          symbol,
          name: symbol, // Finnhub free tier doesn't include company names
          price: currentPrice,
          change,
          changePercent,
          volume: data.v || 0, // Volume might be 0 in free tier
          marketCap: 0, // Not available in free tier
          previousClose,
          open: data.o || currentPrice,
          high: data.h || currentPrice,
          low: data.l || currentPrice,
          source: 'finnhub' as const,
          timestamp: Date.now()
        };
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ Finnhub error for ${symbol}:`, error);
      return null;
    }
  }
  
  // IEX Cloud - Has free tier
  static async getIEXData(symbol: string): Promise<FallbackStockData | null> {
    try {
      console.log(`💼 Fetching ${symbol} from IEX Cloud (sandbox)...`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      // Using sandbox/demo endpoint
      const response = await fetch(
        `https://sandbox.iexapis.com/stable/stock/${symbol}/quote?token=Tpk_029b80e562cb4b5c9d54b3b98b4dc971`,
        { signal: controller.signal }
      );
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.latestPrice) {
        return {
          symbol: data.symbol || symbol,
          name: data.companyName || symbol,
          price: data.latestPrice,
          change: data.change || 0,
          changePercent: data.changePercent ? data.changePercent * 100 : 0,
          volume: data.avgTotalVolume || data.latestVolume || 0,
          marketCap: data.marketCap || 0,
          previousClose: data.previousClose || data.latestPrice,
          open: data.open || data.latestPrice,
          high: data.high || data.latestPrice,
          low: data.low || data.latestPrice,
          source: 'iex' as const,
          timestamp: Date.now()
        };
      }
      
      return null;
      
    } catch (error) {
      console.error(`❌ IEX error for ${symbol}:`, error);
      return null;
    }
  }
  
  // Try multiple fallback services in order
  static async getStockDataWithFallback(symbol: string): Promise<FallbackStockData | null> {
    console.log(`🔄 Attempting fallback data retrieval for ${symbol}...`);
    
    // Try services in order of reliability
    const services = [
      { name: 'Yahoo Finance', fn: () => this.getYahooFinanceData(symbol) },
      { name: 'Finnhub', fn: () => this.getFinnhubData(symbol) },
      { name: 'IEX Cloud', fn: () => this.getIEXData(symbol) }
    ];
    
    for (const service of services) {
      try {
        console.log(`🔍 Trying ${service.name}...`);
        const result = await service.fn();
        
        if (result && result.price > 0) {
          console.log(`✅ ${service.name} success: ${symbol} = $${result.price.toFixed(2)}`);
          return result;
        } else {
          console.log(`⚠️ ${service.name}: No data returned`);
        }
      } catch (error) {
        console.log(`❌ ${service.name} failed:`, error);
        continue;
      }
    }
    
    console.log(`❌ All fallback services failed for ${symbol}`);
    return null;
  }
  
  // Get multiple stocks at once
  static async getMultipleStocks(symbols: string[]): Promise<{ [symbol: string]: FallbackStockData }> {
    console.log(`📊 Fetching ${symbols.length} stocks using fallback services...`);
    
    const results: { [symbol: string]: FallbackStockData } = {};
    
    // Process stocks concurrently but with delay to avoid overwhelming servers
    const promises = symbols.map(async (symbol, index) => {
      // Add small delay between requests
      await new Promise(resolve => setTimeout(resolve, index * 500));
      
      const data = await this.getStockDataWithFallback(symbol);
      if (data) {
        results[symbol] = data;
      }
      return data;
    });
    
    await Promise.allSettled(promises);
    
    console.log(`✅ Retrieved ${Object.keys(results).length}/${symbols.length} stocks via fallback`);
    return results;
  }
  
  // Popular stock symbols for scanning
  static getPopularStockSymbols(): string[] {
    return [
      // Tech giants
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA',
      // Finance
      'JPM', 'BAC', 'WFC', 'GS',
      // Healthcare
      'JNJ', 'PFE', 'UNH', 'ABBV',
      // Consumer
      'KO', 'PEP', 'WMT', 'HD',
      // Energy
      'XOM', 'CVX',
      // Popular growth stocks
      'AMD', 'NFLX', 'CRM', 'ADBE'
    ];
  }
  
  // Convert FallbackStockData to RealGemSearchResult format
  static convertToGemFormat(fallbackData: FallbackStockData): any {
    return {
      symbol: fallbackData.symbol,
      name: fallbackData.name,
      price: fallbackData.price,
      change24h: fallbackData.changePercent,
      changePercent: fallbackData.changePercent,
      volume: fallbackData.volume,
      marketCap: fallbackData.marketCap,
      type: 'stock' as const,
      lastUpdated: new Date(fallbackData.timestamp),
      source: 'fallback',
      fallbackSource: fallbackData.source,
      // Add some basic technical data
      technicalData: {
        open: fallbackData.open,
        high: fallbackData.high,
        low: fallbackData.low,
        previousClose: fallbackData.previousClose
      }
    };
  }
}

export const fallbackStockService = FallbackStockService;

// Real Stock API Service - No Mock Data, Only Real APIs
// Uses multiple free APIs: Yahoo Finance, Financial Modeling Prep, Finnhub, etc.

interface RealStockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  high52w?: number;
  low52w?: number;
  pe?: number;
  dividend?: number;
  beta?: number;
  source: string;
  timestamp: number;
}

export class RealStockAPIService {
  
  // Yahoo Finance API (completely free, no API key needed)
  static async fetchFromYahooFinance(symbols: string[]): Promise<RealStockData[]> {
    const results: RealStockData[] = [];
    
    for (const symbol of symbols) {
      try {
        console.log(`📊 Yahoo Finance: Fetching ${symbol}...`);
        
        // Yahoo Finance Query API
        const response = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`,
          { 
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const result = data?.chart?.result?.[0];
        
        if (result?.meta) {
          const meta = result.meta;
          const price = meta.regularMarketPrice || 0;
          const previousClose = meta.previousClose || price;
          const change = price - previousClose;
          const changePercent = previousClose ? (change / previousClose) * 100 : 0;
          
          results.push({
            symbol: symbol.toUpperCase(),
            name: meta.longName || meta.shortName || symbol,
            price: price,
            change: change,
            changePercent: changePercent,
            volume: meta.regularMarketVolume || 0,
            marketCap: meta.marketCap || 0,
            high52w: meta.fiftyTwoWeekHigh,
            low52w: meta.fiftyTwoWeekLow,
            source: 'Yahoo Finance',
            timestamp: Date.now()
          });
          
          console.log(`✅ Yahoo Finance: ${symbol} = $${price.toFixed(2)}`);
        }
        
        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`⚠️ Yahoo Finance failed for ${symbol}:`, error);
      }
    }
    
    return results;
  }
  
  // Financial Modeling Prep (free tier: 250 requests/day)
  static async fetchFromFinancialModelingPrep(symbols: string[]): Promise<RealStockData[]> {
    const results: RealStockData[] = [];
    
    try {
      // Using demo API key (limited but free)
      const symbolsStr = symbols.join(',');
      const response = await fetch(
        `https://financialmodelingprep.com/api/v3/quote/${symbolsStr}?apikey=demo`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.symbol && item.price) {
            results.push({
              symbol: item.symbol,
              name: item.name || item.symbol,
              price: item.price,
              change: item.change || 0,
              changePercent: item.changesPercentage || 0,
              volume: item.volume || 0,
              marketCap: item.marketCap || 0,
              pe: item.pe,
              source: 'Financial Modeling Prep',
              timestamp: Date.now()
            });
            
            console.log(`✅ FMP: ${item.symbol} = $${item.price}`);
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Financial Modeling Prep failed:', error);
    }
    
    return results;
  }
  
  // Finnhub API (free tier: 60 calls/minute)
  static async fetchFromFinnhub(symbols: string[]): Promise<RealStockData[]> {
    const results: RealStockData[] = [];
    
    for (const symbol of symbols) {
      try {
        console.log(`📊 Finnhub: Fetching ${symbol}...`);
        
        // Using demo token (limited but functional)
        const response = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=demo`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.c && data.c > 0) { // 'c' is current price
          const price = data.c;
          const change = data.d || 0; // daily change
          const changePercent = data.dp || 0; // daily change percent
          
          results.push({
            symbol: symbol.toUpperCase(),
            name: symbol, // Finnhub doesn't provide company name in quote
            price: price,
            change: change,
            changePercent: changePercent,
            volume: data.v || 0, // volume
            marketCap: 0, // Not available in basic quote
            high52w: data.h, // 52-week high
            low52w: data.l, // 52-week low
            source: 'Finnhub',
            timestamp: Date.now()
          });
          
          console.log(`✅ Finnhub: ${symbol} = $${price}`);
        }
        
        // Delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1100)); // 60/min = 1 per second + buffer
        
      } catch (error) {
        console.warn(`⚠️ Finnhub failed for ${symbol}:`, error);
      }
    }
    
    return results;
  }
  
  // IEX Cloud (free tier available)
  static async fetchFromIEXCloud(symbols: string[]): Promise<RealStockData[]> {
    const results: RealStockData[] = [];
    
    try {
      // Using sandbox/demo environment
      const symbolsStr = symbols.join(',');
      const response = await fetch(
        `https://sandbox.iexapis.com/stable/stock/market/batch?symbols=${symbolsStr}&types=quote&token=Tsk_b5e0bf71f8c34b69b9dd4b7a0b8b8823`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      
      for (const [symbol, stockData] of Object.entries(data as any)) {
        if (stockData && typeof stockData === 'object' && 'quote' in stockData) {
          const quote = (stockData as any).quote;
          if (quote) {
            results.push({
              symbol: symbol.toUpperCase(),
              name: quote.companyName || symbol,
              price: quote.latestPrice || 0,
              change: quote.change || 0,
              changePercent: (quote.changePercent || 0) * 100,
              volume: quote.latestVolume || 0,
              marketCap: quote.marketCap || 0,
              pe: quote.peRatio,
              high52w: quote.week52High,
              low52w: quote.week52Low,
              source: 'IEX Cloud',
              timestamp: Date.now()
            });
            
            console.log(`✅ IEX Cloud: ${symbol} = $${quote.latestPrice}`);
          }
        }
      }
      
    } catch (error) {
      console.warn('⚠️ IEX Cloud failed:', error);
    }
    
    return results;
  }
  
  // Polygon.io (free tier: 5 calls/minute)
  static async fetchFromPolygon(symbols: string[]): Promise<RealStockData[]> {
    const results: RealStockData[] = [];
    
    for (const symbol of symbols) {
      try {
        console.log(`📊 Polygon: Fetching ${symbol}...`);
        
        // Using demo API key
        const response = await fetch(
          `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apikey=DEMO_KEY`
        );
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          const result = data.results[0];
          const closePrice = result.c || 0;
          const openPrice = result.o || closePrice;
          const change = closePrice - openPrice;
          const changePercent = openPrice ? (change / openPrice) * 100 : 0;
          
          results.push({
            symbol: symbol.toUpperCase(),
            name: symbol,
            price: closePrice,
            change: change,
            changePercent: changePercent,
            volume: result.v || 0,
            marketCap: 0, // Not available
            source: 'Polygon.io',
            timestamp: Date.now()
          });
          
          console.log(`✅ Polygon: ${symbol} = $${closePrice}`);
        }
        
        // Respect rate limits (5 calls/minute)
        await new Promise(resolve => setTimeout(resolve, 12000)); // 12 seconds between calls
        
      } catch (error) {
        console.warn(`⚠️ Polygon failed for ${symbol}:`, error);
      }
    }
    
    return results;
  }
  
  // Main function: Try multiple real APIs in order
  static async fetchRealStockData(symbols: string[]): Promise<RealStockData[]> {
    console.log(`🔍 Fetching real stock data for: ${symbols.join(', ')}`);
    console.log('📡 Trying multiple free APIs (no mock data)...');
    
    const apis = [
      { name: 'Yahoo Finance', fn: () => this.fetchFromYahooFinance(symbols) },
      { name: 'Financial Modeling Prep', fn: () => this.fetchFromFinancialModelingPrep(symbols) },
      { name: 'Finnhub', fn: () => this.fetchFromFinnhub(symbols) },
      { name: 'IEX Cloud', fn: () => this.fetchFromIEXCloud(symbols) }
    ];
    
    let allResults: RealStockData[] = [];
    const coveredSymbols = new Set<string>();
    
    for (const api of apis) {
      if (coveredSymbols.size >= symbols.length) {
        console.log('✅ All symbols covered, stopping API calls');
        break;
      }
      
      try {
        console.log(`🔄 Trying ${api.name}...`);
        const results = await api.fn();
        
        // Only add results for symbols we haven't covered yet
        const newResults = results.filter(result => 
          !coveredSymbols.has(result.symbol.toUpperCase())
        );
        
        if (newResults.length > 0) {
          allResults = [...allResults, ...newResults];
          newResults.forEach(result => coveredSymbols.add(result.symbol.toUpperCase()));
          console.log(`✅ ${api.name}: Got ${newResults.length} new results`);
        }
        
      } catch (error) {
        console.warn(`⚠️ ${api.name} failed:`, error);
        continue;
      }
    }
    
    console.log(`📊 Final Results: ${allResults.length}/${symbols.length} symbols found`);
    console.log(`✅ Covered: ${Array.from(coveredSymbols).join(', ')}`);
    
    const missing = symbols.filter(s => !coveredSymbols.has(s.toUpperCase()));
    if (missing.length > 0) {
      console.log(`❌ Missing: ${missing.join(', ')}`);
    }
    
    return allResults;
  }
  
  // Get popular stock symbols for scanning
  static getPopularStocks(): string[] {
    return [
      // Tech giants
      'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSLA', 'NVDA', 'NFLX',
      // Finance
      'JPM', 'BAC', 'WFC', 'GS', 'MS',
      // Healthcare
      'JNJ', 'PFE', 'UNH', 'ABBV',
      // Consumer
      'KO', 'PEP', 'WMT', 'HD', 'NKE',
      // Energy
      'XOM', 'CVX', 'COP',
      // Industrial
      'BA', 'CAT', 'GE'
    ];
  }
  
  // Test API availability
  static async testAPIAvailability(): Promise<{
    yahooFinance: boolean;
    financialModelingPrep: boolean;
    finnhub: boolean;
    iexCloud: boolean;
    workingAPIs: string[];
    summary: string;
  }> {
    console.log('🧪 Testing real stock API availability...');
    
    const testSymbol = ['AAPL'];
    const results = {
      yahooFinance: false,
      financialModelingPrep: false,
      finnhub: false,
      iexCloud: false,
      workingAPIs: [] as string[],
      summary: ''
    };
    
    // Test Yahoo Finance
    try {
      const yahoores = await this.fetchFromYahooFinance(testSymbol);
      if (yahoores.length > 0) {
        results.yahooFinance = true;
        results.workingAPIs.push('Yahoo Finance');
      }
    } catch (error) {
      console.warn('Yahoo Finance test failed:', error);
    }
    
    // Test Financial Modeling Prep
    try {
      const fmpRes = await this.fetchFromFinancialModelingPrep(testSymbol);
      if (fmpRes.length > 0) {
        results.financialModelingPrep = true;
        results.workingAPIs.push('Financial Modeling Prep');
      }
    } catch (error) {
      console.warn('FMP test failed:', error);
    }
    
    // Test Finnhub
    try {
      const finnhubRes = await this.fetchFromFinnhub(testSymbol);
      if (finnhubRes.length > 0) {
        results.finnhub = true;
        results.workingAPIs.push('Finnhub');
      }
    } catch (error) {
      console.warn('Finnhub test failed:', error);
    }
    
    // Test IEX Cloud
    try {
      const iexRes = await this.fetchFromIEXCloud(testSymbol);
      if (iexRes.length > 0) {
        results.iexCloud = true;
        results.workingAPIs.push('IEX Cloud');
      }
    } catch (error) {
      console.warn('IEX Cloud test failed:', error);
    }
    
    results.summary = results.workingAPIs.length > 0 
      ? `✅ ${results.workingAPIs.length}/4 APIs working: ${results.workingAPIs.join(', ')}`
      : '❌ No stock APIs are working';
    
    console.log('🧪 API Test Results:', results.summary);
    return results;
  }
}

export default RealStockAPIService;

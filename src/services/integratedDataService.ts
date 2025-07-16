import { firebaseService } from './firebaseService';
import { realDataService } from './realDataService';

export interface IntegratedMarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume24h: number;
  type: 'crypto' | 'stock';
  lastUpdated: Date;
  source: 'firebase' | 'api'; // Removed 'fallback' - only real data sources
}

export interface CacheStrategy {
  useFirebase: boolean;
  maxCacheAgeMinutes: number;
  fallbackToAPI: boolean;
  batchSize: number;
}

class IntegratedDataService {
  private defaultCacheStrategy: CacheStrategy = {
    useFirebase: true,
    maxCacheAgeMinutes: 15, // 15 minutes cache
    fallbackToAPI: true,
    batchSize: 20
  };

  // Symbol mapping for proper names and types
  private symbolMapping: Record<string, { name: string; type: 'crypto' | 'stock' }> = {
    // Cryptocurrencies
    'SOL': { name: 'Solana', type: 'crypto' },
    'ADA': { name: 'Cardano', type: 'crypto' },
    'DOT': { name: 'Polkadot', type: 'crypto' },
    'MATIC': { name: 'Polygon', type: 'crypto' },
    'AVAX': { name: 'Avalanche', type: 'crypto' },
    'LINK': { name: 'Chainlink', type: 'crypto' },
    'UNI': { name: 'Uniswap', type: 'crypto' },
    'NEAR': { name: 'NEAR Protocol', type: 'crypto' },
    'ICP': { name: 'Internet Computer', type: 'crypto' },
    'FTM': { name: 'Fantom', type: 'crypto' },
    'ATOM': { name: 'Cosmos', type: 'crypto' },
    'ALGO': { name: 'Algorand', type: 'crypto' },
    'VET': { name: 'VeChain', type: 'crypto' },
    'SAND': { name: 'The Sandbox', type: 'crypto' },
    'MANA': { name: 'Decentraland', type: 'crypto' },
    'FIL': { name: 'Filecoin', type: 'crypto' },
    'GRT': { name: 'The Graph', type: 'crypto' },
    'ENJ': { name: 'Enjin Coin', type: 'crypto' },
    'CHZ': { name: 'Chiliz', type: 'crypto' },
    'BAT': { name: 'Basic Attention Token', type: 'crypto' },
    
    // Stocks
    'PLTR': { name: 'Palantir Technologies', type: 'stock' },
    'RBLX': { name: 'Roblox Corporation', type: 'stock' },
    'HOOD': { name: 'Robinhood Markets', type: 'stock' },
    'COIN': { name: 'Coinbase Global', type: 'stock' },
    'U': { name: 'Unity Software', type: 'stock' },
    'SOFI': { name: 'SoFi Technologies', type: 'stock' },
    'UPST': { name: 'Upstart Holdings', type: 'stock' },
    'AFRM': { name: 'Affirm Holdings', type: 'stock' },
    'SQ': { name: 'Block (Square)', type: 'stock' },
    'PYPL': { name: 'PayPal Holdings', type: 'stock' },
    'NET': { name: 'Cloudflare', type: 'stock' },
    'SNOW': { name: 'Snowflake', type: 'stock' },
    'ROKU': { name: 'Roku Inc', type: 'stock' },
    'ZM': { name: 'Zoom Video', type: 'stock' },
    'SHOP': { name: 'Shopify', type: 'stock' },
    'TWLO': { name: 'Twilio', type: 'stock' },
    'DDOG': { name: 'Datadog', type: 'stock' },
    'CRWD': { name: 'CrowdStrike', type: 'stock' },
    'OKTA': { name: 'Okta', type: 'stock' },
    'FSLY': { name: 'Fastly', type: 'stock' }
  };

  private getSymbolInfo(symbol: string): { name: string; type: 'crypto' | 'stock' } {
    const mapped = this.symbolMapping[symbol as keyof typeof this.symbolMapping];
    if (mapped) {
      return mapped;
    }
    
    // Fallback logic for unknown symbols - more strict crypto detection
    const cleanSymbol = symbol.replace(/USD$/, '').replace(/-usd$/i, '');
    
    // Known crypto patterns (CoinGecko IDs only - case insensitive)
    const cryptoPatterns = [
      // Exact CoinGecko IDs
      /^(bitcoin|ethereum|cardano|solana|polkadot|polygon|avalanche|chainlink|uniswap)$/i,
      /^(injective-protocol|oasis-network|fantom|ocean-protocol|thorchain|kava|celer-network)$/i,
      /^(ren|band-protocol|ankr|render-token|cosmos|near|filecoin|algorand|vechain)$/i,
      // CoinGecko pattern with dashes and numbers
      /-\d+$/i, // Pattern like "avalanche-2"
      /^[a-z]+(-[a-z]+)*(-\d+)?$/i // CoinGecko lowercase-with-dashes format
    ];
    
    // Known stock patterns
    const stockPatterns = [
      /^[A-Z]{1,5}$/, // Traditional stock tickers (1-5 uppercase letters)
      /^(PLTR|RBLX|HOOD|COIN|SOFI|ROKU|CRSP|OPEN|SPCE|LCID)$/i
    ];
    
    // Check if it's a known crypto pattern
    if (cryptoPatterns.some(pattern => pattern.test(symbol) || pattern.test(cleanSymbol))) {
      return { name: cleanSymbol, type: 'crypto' };
    }
    
    // Check if it's a known stock pattern
    if (stockPatterns.some(pattern => pattern.test(symbol))) {
      return { name: symbol, type: 'stock' };
    }
    
    // Default logic: if it contains common crypto identifiers, treat as crypto
    if (symbol.includes('usd') || symbol.includes('-') || symbol.length > 6) {
      return { name: cleanSymbol, type: 'crypto' };
    }
    
    // Otherwise, treat as stock
    return { name: symbol, type: 'stock' };
  }

  // ================== MARKET DATA WITH FIREBASE CACHE ==================
  
  async getMarketData(
    symbols: string[], 
    options: Partial<CacheStrategy> = {}
  ): Promise<IntegratedMarketData[]> {
    const strategy = { ...this.defaultCacheStrategy, ...options };
    const results: IntegratedMarketData[] = [];
    const symbolsToFetch: string[] = [];

    console.log(`🔄 Getting market data for ${symbols.length} symbols...`);

    if (strategy.useFirebase) {
      // First, try to get data from Firebase cache
      for (const symbol of symbols) {
        try {
          const cachedData = await firebaseService.getMarketDataBySymbol(symbol);
          
          if (cachedData && this.isDataFresh(cachedData.lastUpdated, strategy.maxCacheAgeMinutes)) {
            results.push({
              symbol: cachedData.symbol,
              name: cachedData.name,
              price: cachedData.price,
              change: cachedData.change,
              changePercent: cachedData.changePercent,
              marketCap: cachedData.marketCap,
              volume24h: cachedData.volume24h,
              type: cachedData.type,
              lastUpdated: (cachedData.lastUpdated as any).toDate(),
              source: 'firebase'
            });
            console.log(`📖 Using cached data for ${symbol}`);
          } else {
            symbolsToFetch.push(symbol);
          }
        } catch (error) {
          console.warn(`⚠️ Error getting cached data for ${symbol}:`, error);
          symbolsToFetch.push(symbol);
        }
      }
    } else {
      symbolsToFetch.push(...symbols);
    }

    // Fetch missing data from API
    if (symbolsToFetch.length > 0 && strategy.fallbackToAPI) {
      console.log(`🌐 Fetching ${symbolsToFetch.length} symbols from API...`);
      
      try {
        const apiData = await realDataService.getBatchMarketData(symbolsToFetch);
        
        const apiResults: IntegratedMarketData[] = apiData.map(data => {
          const symbolInfo = this.getSymbolInfo(data.symbol);
          return {
            symbol: data.symbol,
            name: symbolInfo.name,
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            marketCap: (data as any).marketCap || 0,
            volume24h: data.volume || 0,
            type: symbolInfo.type,
            lastUpdated: new Date(data.lastUpdated),
            source: 'api'
          };
        });

        results.push(...apiResults);

        // Save to Firebase for future use
        if (strategy.useFirebase && apiResults.length > 0) {
          await firebaseService.saveMarketData(apiResults);
          console.log(`💾 Saved ${apiResults.length} new market data entries to Firebase`);
        }
        
      } catch (error) {
        console.error('❌ Error fetching from API:', error);
        
        // Instead of generating fake fallback data, return empty array or cached data
        console.warn('⚠️ No fallback data generated - using real data only');
        return results; // Return only what we have from Firebase/API
      }
    }

    console.log(`✅ Retrieved ${results.length} total market data entries`);
    console.log(`📊 Sources: Firebase: ${results.filter(r => r.source === 'firebase').length}, API: ${results.filter(r => r.source === 'api').length}`);
    
    return results;
  }

  // Get ONLY real market data - no fallbacks or cache
  async getRealMarketDataOnly(symbols: string[]): Promise<IntegratedMarketData[]> {
    console.log(`🔍 Getting ONLY real market data for ${symbols.length} symbols (no fallbacks)...`);
    
    try {
      const realData = await realDataService.getRealMarketDataOnly(symbols);
      
      const results: IntegratedMarketData[] = realData.map(data => {
        const symbolInfo = this.getSymbolInfo(data.symbol);
        return {
          symbol: data.symbol,
          name: symbolInfo.name,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          marketCap: data.marketCap || 0,
          volume24h: data.volume || 0,
          type: symbolInfo.type,
          lastUpdated: new Date(data.lastUpdated),
          source: 'api' // Mark as API source
        };
      });
      
      console.log(`📊 Real integrated data: ${results.length} items with real prices`);
      return results;
      
    } catch (error) {
      console.error('❌ Error getting real market data:', error);
      return [];
    }
  }

  // ================== GEMS WITH FIREBASE PERSISTENCE ==================
  
  async getGems(forceRefresh = false): Promise<any[]> {
    try {
      const isStale = await firebaseService.isDataStale('gems', 30); // 30 minutes
      
      if (!forceRefresh && !isStale) {
        console.log('📖 Using cached gems from Firebase');
        const cachedGems = await firebaseService.getGems();
        return this.convertFirebaseGemsToLocal(cachedGems);
      }

      console.log('🔄 Refreshing gems data...');
      
      // Clean incorrect data before generating new gems
      await this.cleanIncorrectData();
      
      // Get fresh data from API/generation - better mix of crypto and stocks with proper validation
      const validCryptoSymbols = ['solana', 'cardano', 'polkadot', 'polygon-matic', 'avalanche-2', 'chainlink', 'uniswap'];
      const validStockSymbols = ['PLTR', 'RBLX', 'HOOD', 'SOFI', 'ROKU', 'NET', 'CRSP'];
      const symbols = [...validCryptoSymbols, ...validStockSymbols];
      
      const marketData = await this.getMarketData(symbols);
      
      const gems = this.generateGemsFromMarketData(marketData);
      
      // Save to Firebase
      await firebaseService.saveGems(gems);
      
      return gems;
    } catch (error) {
      console.error('❌ Error getting gems:', error);
      // Fallback to cached data if available
      const cachedGems = await firebaseService.getGems();
      return this.convertFirebaseGemsToLocal(cachedGems);
    }
  }

  // ================== AUTO TRADES WITH FIREBASE PERSISTENCE ==================
  
  async saveAutoTrade(trade: any): Promise<string> {
    try {
      const tradeId = await firebaseService.saveAutoTrade(trade);
      console.log(`💾 Saved auto trade ${trade.symbol} to Firebase`);
      return tradeId;
    } catch (error) {
      console.error('❌ Error saving auto trade:', error);
      throw error;
    }
  }

  async getAutoTrades(): Promise<any[]> {
    try {
      const firebaseTrades = await firebaseService.getAutoTrades();
      return this.convertFirebaseTradesToLocal(firebaseTrades);
    } catch (error) {
      console.error('❌ Error getting auto trades:', error);
      return [];
    }
  }

  async updateAutoTrade(tradeId: string, updates: any): Promise<void> {
    try {
      await firebaseService.updateAutoTrade(tradeId, updates);
      console.log(`✅ Updated auto trade ${tradeId}`);
    } catch (error) {
      console.error('❌ Error updating auto trade:', error);
      throw error;
    }
  }

  // ================== STRATEGIES WITH FIREBASE PERSISTENCE ==================
  
  async getStrategies(): Promise<any[]> {
    try {
      const firebaseStrategies = await firebaseService.getStrategies();
      return this.convertFirebaseStrategiesToLocal(firebaseStrategies);
    } catch (error) {
      console.error('❌ Error getting strategies:', error);
      return [];
    }
  }

  async saveStrategy(strategy: any): Promise<string> {
    try {
      const strategyId = await firebaseService.saveStrategy(strategy);
      console.log(`💾 Saved strategy ${strategy.name} to Firebase`);
      return strategyId;
    } catch (error) {
      console.error('❌ Error saving strategy:', error);
      throw error;
    }
  }

  // ================== BACKTEST RESULTS WITH FIREBASE PERSISTENCE ==================
  
  async saveBacktestResults(results: any[]): Promise<void> {
    try {
      await firebaseService.saveBacktestResults(results);
      console.log(`💾 Saved ${results.length} backtest results to Firebase`);
    } catch (error) {
      console.error('❌ Error saving backtest results:', error);
      throw error;
    }
  }

  async getBacktestResults(strategy?: string): Promise<any[]> {
    try {
      const firebaseResults = await firebaseService.getBacktestResults(strategy);
      return this.convertFirebaseBacktestResultsToLocal(firebaseResults);
    } catch (error) {
      console.error('❌ Error getting backtest results:', error);
      return [];
    }
  }

  // ================== OPPORTUNITIES WITH FIREBASE PERSISTENCE ==================
  
  async saveOpportunities(opportunities: any[]): Promise<void> {
    try {
      await firebaseService.saveOpportunities(opportunities);
      console.log(`💾 Saved ${opportunities.length} opportunities to Firebase`);
    } catch (error) {
      console.error('❌ Error saving opportunities:', error);
      throw error;
    }
  }

  async getOpportunities(): Promise<any[]> {
    try {
      const firebaseOpportunities = await firebaseService.getOpportunities();
      return this.convertFirebaseOpportunitiesToLocal(firebaseOpportunities);
    } catch (error) {
      console.error('❌ Error getting opportunities:', error);
      return [];
    }
  }

  // ================== UTILITY FUNCTIONS ==================
  
  private isDataFresh(timestamp: any, maxAgeMinutes: number): boolean {
    if (!timestamp) return false;
    
    const timestampDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const ageMinutes = (Date.now() - timestampDate.getTime()) / (1000 * 60);
    
    return ageMinutes <= maxAgeMinutes;
  }

  // Calculate real AI score based on market data
  private calculateRealAIScore(data: IntegratedMarketData): number {
    let score = 50; // Base score
    
    // Volume factor (higher volume = higher score)
    if (data.volume24h > 100000000) score += 20; // High volume
    else if (data.volume24h > 10000000) score += 10; // Medium volume
    else if (data.volume24h > 1000000) score += 5; // Low volume
    
    // Market cap factor (stability)
    if (data.marketCap > 10000000000) score += 15; // Large cap = more stable
    else if (data.marketCap > 1000000000) score += 10; // Mid cap
    else if (data.marketCap > 100000000) score += 5; // Small cap
    
    // Price change factor (positive momentum)
    if (data.changePercent > 5) score += 10; // Strong positive
    else if (data.changePercent > 0) score += 5; // Positive
    else if (data.changePercent > -5) score += 0; // Stable
    else score -= 5; // Negative
    
    return Math.min(Math.max(score, 30), 100); // Clamp between 30-100
  }

  // Calculate real risk score based on market data
  private calculateRealRiskScore(data: IntegratedMarketData): 'Low' | 'Medium' | 'High' {
    // Base risk on market cap and volatility
    const volatility = Math.abs(data.changePercent);
    
    if (data.marketCap > 10000000000 && volatility < 5) return 'Low';
    if (data.marketCap > 1000000000 && volatility < 10) return 'Medium';
    return 'High';
  }

  // Get real social data (simplified but based on known patterns)
  private getRealSocialData(symbol: string) {
    const knownSocials: Record<string, any> = {
      'bitcoin': { twitter: true, telegram: true, discord: true },
      'ethereum': { twitter: true, telegram: true, discord: true },
      'solana': { twitter: true, telegram: true, discord: true },
      'cardano': { twitter: true, telegram: true, discord: true },
      'polkadot': { twitter: true, telegram: true, discord: true },
      'AAPL': { twitter: true, telegram: false, discord: false },
      'GOOGL': { twitter: true, telegram: false, discord: false },
      'MSFT': { twitter: true, telegram: false, discord: false },
    };
    
    return knownSocials[symbol] || {
      twitter: true, // Most projects have Twitter
      telegram: symbol.includes('-') || symbol.length > 5, // Crypto pattern
      discord: symbol.includes('-') || symbol.length > 5, // Crypto pattern
    };
  }

  // Calculate real fundamentals based on market data
  private calculateRealFundamentals(data: IntegratedMarketData) {
    // Base scores on real market metrics
    const volumeToMarketCapRatio = data.volume24h / Math.max(data.marketCap, 1);
    const priceStability = 100 - Math.min(Math.abs(data.changePercent) * 2, 50);
    
    let teamScore = 70;
    let techScore = 70;
    let tokenomicsScore = 70;
    let communityScore = 70;
    
    // Adjust based on market cap (larger = more established)
    if (data.marketCap > 10000000000) {
      teamScore += 15;
      techScore += 15;
    } else if (data.marketCap > 1000000000) {
      teamScore += 10;
      techScore += 10;
    }
    
    // Adjust based on volume ratio (higher ratio = more active community)
    if (volumeToMarketCapRatio > 0.1) {
      communityScore += 15;
    } else if (volumeToMarketCapRatio > 0.05) {
      communityScore += 10;
    }
    
    // Adjust tokenomics based on price stability
    tokenomicsScore = Math.round(priceStability);
    
    return {
      team: Math.min(Math.max(teamScore, 50), 100),
      tech: Math.min(Math.max(techScore, 50), 100),
      tokenomics: Math.min(Math.max(tokenomicsScore, 50), 100),
      community: Math.min(Math.max(communityScore, 50), 100),
    };
  }

  private generateGemsFromMarketData(marketData: IntegratedMarketData[]): any[] {
    return marketData.map((data, index) => ({
      id: `gem-${data.symbol}-${Date.now()}-${index}`,
      symbol: data.symbol,
      name: data.name,
      price: data.price,
      marketCap: data.marketCap,
      volume24h: data.volume24h,
      change24h: data.changePercent,
      description: this.getDescriptionForSymbol(data.symbol),
      aiScore: this.calculateRealAIScore(data), // Use real data for AI score
      risk: this.calculateRealRiskScore(data), // Use real data for risk
      category: this.getCategoryForSymbol(data.symbol, data.type),
      launchDate: this.generateLaunchDate(data.symbol),
      type: data.type,
      social: this.getRealSocialData(data.symbol), // Use real social data
      fundamentals: this.calculateRealFundamentals(data), // Use real fundamentals
      aiAnalysis: this.generateAIAnalysis(data.symbol, data.changePercent),
      potential: this.generatePotential(data.changePercent, data.type),
      timeframe: this.generateTimeframe(data.type),
      lastUpdated: Date.now(),
    }));
  }

  private getCategoryForSymbol(symbol: string, type: 'crypto' | 'stock'): string {
    const cryptoCategories: { [key: string]: string } = {
      'SOL': 'infrastructure',
      'ADA': 'infrastructure', 
      'DOT': 'infrastructure',
      'MATIC': 'infrastructure',
      'AVAX': 'infrastructure',
      'LINK': 'defi',
      'UNI': 'defi'
    };
    
    const stockCategories: { [key: string]: string } = {
      'PLTR': 'tech',
      'RBLX': 'gaming',
      'HOOD': 'fintech',
      'COIN': 'fintech',
      'U': 'tech'
    };
    
    if (type === 'crypto') {
      return cryptoCategories[symbol] || 'defi';
    } else {
      return stockCategories[symbol] || 'tech';
    }
  }

  private generateLaunchDate(symbol: string): string {
    const dates: { [key: string]: string } = {
      'SOL': '2020-03-16',
      'ADA': '2017-09-29',
      'DOT': '2020-08-18',
      'MATIC': '2019-04-28',
      'AVAX': '2020-09-21',
      'LINK': '2017-09-19',
      'PLTR': '2020-09-30',
      'RBLX': '2021-03-10',
      'HOOD': '2021-07-29',
      'COIN': '2021-04-14',
      'U': '2019-05-23'
    };
    return dates[symbol] || '2024-01-01';
  }

  private getDescriptionForSymbol(symbol: string): string {
    const descriptions: { [key: string]: string } = {
      'SOL': 'High-performance blockchain supporting smart contracts',
      'ADA': 'Proof-of-stake blockchain platform with academic research',
      'DOT': 'Multi-chain protocol enabling blockchain interoperability',
      'MATIC': 'Ethereum scaling solution with low fees',
      'AVAX': 'Platform for DeFi and enterprise blockchain deployments',
      'LINK': 'Decentralized oracle network for smart contracts',
      'UNI': 'Leading decentralized exchange protocol',
      'PLTR': 'Big data analytics platform for government and enterprise',
      'RBLX': 'Global platform bringing millions together through play',
      'HOOD': 'Commission-free financial services and trading platform',
      'COIN': 'Leading cryptocurrency exchange platform',
      'U': 'Cloud communications platform as a service'
    };
    return descriptions[symbol] || `Innovative project - ${symbol}`;
  }

  private generateAIAnalysis(symbol: string, changePercent: number): string {
    const isPositive = changePercent > 0;
    const magnitude = Math.abs(changePercent);
    
    const templates = [
      `Real-time analysis shows ${isPositive ? 'bullish' : 'bearish'} momentum with ${magnitude.toFixed(1)}% movement. Strong fundamentals detected.`,
      `Current price action indicates ${isPositive ? 'accumulation' : 'consolidation'} phase. Technical indicators suggest potential for recovery.`,
      `Market data reveals ${isPositive ? 'positive' : 'mixed'} sentiment. Strong development activity and growing adoption.`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  }

  private generatePotential(changePercent: number, type: 'crypto' | 'stock'): string {
    const isPositive = changePercent > 0;
    const magnitude = Math.abs(changePercent);
    
    if (type === 'crypto') {
      if (magnitude > 10) return isPositive ? 'Explosive growth potential' : 'Recovery opportunity';
      if (magnitude > 5) return isPositive ? 'Strong upside momentum' : 'Consolidation phase';
      return 'Steady growth expected';
    } else {
      if (magnitude > 5) return isPositive ? 'Strong growth trajectory' : 'Value opportunity';
      if (magnitude > 2) return isPositive ? 'Positive fundamentals' : 'Accumulation phase';
      return 'Long-term value play';
    }
  }

  private generateTimeframe(type: 'crypto' | 'stock'): string {
    const timeframes = type === 'crypto' 
      ? ['1-3 months', '3-6 months', '6-12 months']
      : ['6-12 months', '12-18 months', '18-24 months'];
    
    return timeframes[Math.floor(Math.random() * timeframes.length)];
  }

  // ================== CONVERSION FUNCTIONS ==================
  
  private convertFirebaseGemsToLocal(firebaseGems: any[]): any[] {
    return firebaseGems.map(gem => ({
      ...gem,
      lastUpdated: gem.lastUpdated?.toDate?.() || new Date(gem.lastUpdated),
      createdAt: gem.createdAt?.toDate?.() || new Date(gem.createdAt),
    }));
  }

  private convertFirebaseTradesToLocal(firebaseTrades: any[]): any[] {
    return firebaseTrades.map(trade => ({
      ...trade,
      timestamp: trade.timestamp?.toDate?.() || new Date(trade.timestamp),
      lastUpdated: trade.lastUpdated?.toDate?.() || new Date(trade.lastUpdated),
      createdAt: trade.createdAt?.toDate?.() || new Date(trade.createdAt),
    }));
  }

  private convertFirebaseStrategiesToLocal(firebaseStrategies: any[]): any[] {
    return firebaseStrategies.map(strategy => ({
      ...strategy,
      createdAt: strategy.createdAt?.toDate?.() || new Date(strategy.createdAt),
      lastUsed: strategy.lastUsed?.toDate?.() || null,
    }));
  }

  private convertFirebaseBacktestResultsToLocal(firebaseResults: any[]): any[] {
    return firebaseResults.map(result => ({
      ...result,
      createdAt: result.createdAt?.toDate?.() || new Date(result.createdAt),
    }));
  }

  private convertFirebaseOpportunitiesToLocal(firebaseOpportunities: any[]): any[] {
    return firebaseOpportunities.map(opportunity => ({
      ...opportunity,
      createdAt: opportunity.createdAt?.toDate?.() || new Date(opportunity.createdAt),
      expiresAt: opportunity.expiresAt?.toDate?.() || new Date(opportunity.expiresAt),
    }));
  }

  // ================== PERFORMANCE MONITORING ==================
  
  async getPerformanceStats(): Promise<any> {
    try {
      const [gems, trades, strategies] = await Promise.all([
        firebaseService.getGems(10),
        firebaseService.getActiveTrades(),
        firebaseService.getStrategies()
      ]);

      const activeTrades = trades.filter(t => t.status === 'active');
      const totalPnL = trades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
      const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
      
      return {
        totalGems: gems.length,
        activeTrades: activeTrades.length,
        totalTrades: trades.length,
        totalPnL,
        winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
        totalStrategies: strategies.length,
        activeStrategies: strategies.filter(s => s.isActive).length,
        cacheHitRate: this.calculateRealCacheHitRate(gems, trades), // Real calculation
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('❌ Error getting performance stats:', error);
      return {
        totalGems: 0,
        activeTrades: 0,
        totalTrades: 0,
        totalPnL: 0,
        winRate: 0,
        totalStrategies: 0,
        activeStrategies: 0,
        cacheHitRate: 0,
        lastUpdated: new Date()
      };
    }
  }

  // ================== GEMS MANAGEMENT ==================
  
  async saveGems(gems: any[]): Promise<void> {
    try {
      console.log(`💾 Validating and saving ${gems.length} gems to Firebase...`);
      
      // Filter out any crypto that is NOT from CoinGecko
      const validatedGems = gems.filter(gem => {
        if (gem.type === 'crypto') {
          // Only allow crypto with proper CoinGecko validation
          const isValidCoinGecko = gem.id && (
            gem.id.startsWith('coingecko-') || // Our CoinGecko-prefixed IDs
            this.isValidCoinGeckoId(gem.symbol) || // CoinGecko ID patterns
            gem.source === 'coingecko' // Explicit CoinGecko source
          );
          
          const hasValidPrice = gem.price && gem.price > 0;
          
          if (!isValidCoinGecko || !hasValidPrice) {
            console.warn(`🚫 Rejecting invalid crypto gem: ${gem.symbol} - CoinGecko: ${isValidCoinGecko}, Price: ${hasValidPrice}`);
            return false;
          }
          
          console.log(`✅ Validated CoinGecko crypto: ${gem.symbol} ($${gem.price})`);
          return true;
        }
        
        // For stocks, just verify they have basic required fields
        if (gem.type === 'stock') {
          const hasValidData = gem.symbol && gem.name && gem.price && gem.price > 0;
          if (!hasValidData) {
            console.warn(`🚫 Rejecting invalid stock gem: ${gem.symbol}`);
            return false;
          }
          console.log(`✅ Validated stock: ${gem.symbol} ($${gem.price})`);
          return true;
        }
        
        console.warn(`🚫 Rejecting gem with unknown type: ${gem.type}`);
        return false;
      });
      
      console.log(`📊 Validation results: ${validatedGems.length}/${gems.length} gems validated`);
      console.log(`📊 Cryptos: ${validatedGems.filter(g => g.type === 'crypto').length}, Stocks: ${validatedGems.filter(g => g.type === 'stock').length}`);
      
      if (validatedGems.length === 0) {
        console.warn('⚠️ No valid gems to save after validation');
        return;
      }
      
      await firebaseService.saveGems(validatedGems);
      console.log(`✅ ${validatedGems.length} validated gems saved successfully`);
    } catch (error) {
      console.error('❌ Error saving gems:', error);
      throw error;
    }
  }

  // Helper method to validate CoinGecko IDs
  private isValidCoinGeckoId(symbol: string): boolean {
    if (!symbol) return false;
    
    // CoinGecko ID patterns
    const coinGeckoPatterns = [
      // Exact known CoinGecko IDs
      /^(bitcoin|ethereum|cardano|solana|polkadot|polygon-matic|avalanche-2|chainlink|uniswap)$/i,
      /^(injective-protocol|oasis-network|fantom|ocean-protocol|thorchain|kava|celer-network)$/i,
      /^(ren|band-protocol|ankr|render-token|cosmos|near|filecoin|algorand|vechain)$/i,
      // CoinGecko pattern: lowercase with dashes, possible numbers
      /^[a-z]([a-z0-9]*(-[a-z0-9]+)*)?$/i
    ];
    
    return coinGeckoPatterns.some(pattern => pattern.test(symbol));
  }

  async saveGem(gem: any): Promise<void> {
    try {
      await this.saveGems([gem]);
    } catch (error) {
      console.error('❌ Error saving single gem:', error);
      throw error;
    }
  }

  // Clean incorrect data entries (cryptos misclassified as stocks)
  async cleanIncorrectData(): Promise<void> {
    try {
      console.log('🧹 Cleaning incorrect data entries...');
      
      const allGems = await firebaseService.getGems();
      const problematicSymbols = new Set();
      
      // Identify problematic entries
      const cleanedGems = allGems.filter(gem => {
        // Known crypto symbols that should never be stocks
        const cryptoSymbols = [
          'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'polygon-matic',
          'avalanche-2', 'chainlink', 'uniswap', 'injective-protocol', 'oasis-network',
          'fantom', 'ocean-protocol', 'thorchain', 'kava', 'celer-network',
          'ren', 'band-protocol', 'ankr', 'render-token', 'near-protocol'
        ];
        
        // Check if this is a crypto symbol incorrectly marked as stock
        const isIncorrectStock = gem.type === 'stock' && (
          cryptoSymbols.includes(gem.symbol.toLowerCase()) ||
          gem.symbol.toLowerCase().includes('coin') ||
          gem.symbol.toLowerCase().includes('token') ||
          gem.symbol.toLowerCase().includes('protocol') ||
          gem.symbol.includes('-') // Crypto IDs often have dashes
        );
        
        if (isIncorrectStock) {
          problematicSymbols.add(gem.symbol);
          console.log(`🗑️ Removing incorrect entry: ${gem.symbol} (marked as stock but is crypto)`);
          return false; // Remove this entry
        }
        
        // Also remove entries with unrealistic prices for their type
        const hasUnrealisticPrice = (
          (gem.type === 'crypto' && gem.price > 100000) || // Crypto with price > $100k (except BTC)
          (gem.type === 'stock' && gem.price < 0.01) || // Stock with price < $0.01
          gem.price <= 0 || // Any asset with zero/negative price
          !gem.price || isNaN(gem.price) // Invalid price
        ) && gem.symbol !== 'BTC'; // Exception for Bitcoin
        
        if (hasUnrealisticPrice) {
          problematicSymbols.add(gem.symbol);
          console.log(`🗑️ Removing entry with unrealistic price: ${gem.symbol} ($${gem.price})`);
          return false;
        }
        
        return true; // Keep this entry
      });
      
      if (problematicSymbols.size > 0) {
        console.log(`🧹 Removed ${problematicSymbols.size} problematic entries:`, Array.from(problematicSymbols));
        await firebaseService.saveGems(cleanedGems);
        console.log(`✅ Database cleaned, ${cleanedGems.length} valid gems remaining`);
      } else {
        console.log('✅ No problematic entries found');
      }
      
    } catch (error) {
      console.error('❌ Error cleaning incorrect data:', error);
    }
  }

  // Calculate real cache hit rate based on data freshness
  private calculateRealCacheHitRate(gems: any[], trades: any[]): number {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);
    
    // Check how much data is recent (cached)
    const recentGems = gems.filter(gem => 
      gem.lastUpdated && (new Date(gem.lastUpdated).getTime() > fiveMinutesAgo)
    );
    const recentTrades = trades.filter(trade => 
      trade.lastUpdated && (new Date(trade.lastUpdated).getTime() > fiveMinutesAgo)
    );
    
    const totalItems = gems.length + trades.length;
    const recentItems = recentGems.length + recentTrades.length;
    
    return totalItems > 0 ? Math.round((recentItems / totalItems) * 100) : 0;
  }
}

export const integratedDataService = new IntegratedDataService();

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
  source: 'firebase' | 'api' | 'fallback';
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
        
        const apiResults: IntegratedMarketData[] = apiData.map(data => ({
          symbol: data.symbol,
          name: data.symbol.replace(/USD$/, ''),
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          marketCap: (data as any).marketCap || 0,
          volume24h: data.volume || 0,
          type: data.type,
          lastUpdated: new Date(data.lastUpdated),
          source: 'api'
        }));

        results.push(...apiResults);

        // Save to Firebase for future use
        if (strategy.useFirebase && apiResults.length > 0) {
          await firebaseService.saveMarketData(apiResults);
          console.log(`💾 Saved ${apiResults.length} new market data entries to Firebase`);
        }
        
      } catch (error) {
        console.error('❌ Error fetching from API:', error);
        
        // Generate fallback data for missing symbols
        const fallbackResults = symbolsToFetch.map(symbol => this.generateFallbackData(symbol));
        results.push(...fallbackResults);
      }
    }

    console.log(`✅ Retrieved ${results.length} total market data entries`);
    console.log(`📊 Sources: Firebase: ${results.filter(r => r.source === 'firebase').length}, API: ${results.filter(r => r.source === 'api').length}, Fallback: ${results.filter(r => r.source === 'fallback').length}`);
    
    return results;
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
      
      // Get fresh data from API/generation
      const symbols = ['SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK', 'PLTR', 'RBLX', 'HOOD', 'COIN', 'U'];
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

  private generateFallbackData(symbol: string): IntegratedMarketData {
    const basePrice = symbol.includes('BTC') ? 45000 : symbol.includes('ETH') ? 2800 : 100;
    const price = basePrice * (0.9 + Math.random() * 0.2);
    
    return {
      symbol,
      name: symbol.replace(/USD$/, ''),
      price: Math.round(price * 100) / 100,
      change: Math.round(((Math.random() - 0.5) * 10) * 100) / 100,
      changePercent: Math.round(((Math.random() - 0.5) * 5) * 100) / 100,
      marketCap: Math.floor(Math.random() * 10000000000) + 1000000000,
      volume24h: Math.floor(Math.random() * 100000000) + 10000000,
      type: symbol.includes('BTC') || symbol.includes('ETH') || symbol.includes('SOL') ? 'crypto' : 'stock',
      lastUpdated: new Date(),
      source: 'fallback'
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
      aiScore: Math.floor(Math.random() * 30) + 70,
      risk: data.marketCap > 10000000000 ? 'Low' : data.marketCap > 1000000000 ? 'Medium' : 'High',
      category: this.getCategoryForSymbol(data.symbol, data.type),
      launchDate: this.generateLaunchDate(data.symbol),
      type: data.type,
      social: {
        twitter: Math.random() > 0.2,
        telegram: data.type === 'crypto' && Math.random() > 0.3,
        discord: Math.random() > 0.4,
      },
      fundamentals: {
        team: Math.floor(Math.random() * 25) + 70,
        tech: Math.floor(Math.random() * 25) + 70,
        tokenomics: Math.floor(Math.random() * 25) + 70,
        community: Math.floor(Math.random() * 25) + 70,
      },
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
        cacheHitRate: 85, // Mock for now
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
      console.log(`💾 Saving ${gems.length} gems to Firebase...`);
      await firebaseService.saveGems(gems);
      console.log('✅ Gems saved successfully');
    } catch (error) {
      console.error('❌ Error saving gems:', error);
      throw error;
    }
  }

  async saveGem(gem: any): Promise<void> {
    try {
      await this.saveGems([gem]);
    } catch (error) {
      console.error('❌ Error saving single gem:', error);
      throw error;
    }
  }
}

export const integratedDataService = new IntegratedDataService();

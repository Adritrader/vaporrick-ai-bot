import { realDataService } from './realDataService';
import { enhancedAIService } from './enhancedAIService';
import { vectorFluxAIService } from './vectorFluxAIService';
import { Alert } from 'react-native';

// Simple logger replacement
const apiLogger = {
  info: (message: string, data?: any) => console.log(`[INFO] ${message}`, data || ''),
  error: (message: string, data?: any) => console.error(`[ERROR] ${message}`, data || ''),
  warn: (message: string, data?: any) => console.warn(`[WARN] ${message}`, data || '')
};

export interface RealGemSearchResult {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  type: 'crypto' | 'stock';
  
  // AI Analysis Results
  aiScore: number;
  aiAnalysis: string;
  aiRecommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  aiConfidence: number;
  
  // Technical Analysis
  technicalScore: number;
  technicalSignals: string[];
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  
  // Predictions
  priceTarget1d: number;
  priceTarget7d: number;
  priceTarget30d: number;
  
  // Quality Metrics
  qualityScore: number;
  potential: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  
  // Timestamps
  lastUpdated: Date;
  source: 'real' | 'cache';
}

export interface GemSearchOptions {
  maxResults: number;
  minMarketCap?: number;
  maxMarketCap?: number;
  minVolume?: number;
  minAIScore?: number;
  riskTolerance?: 'low' | 'medium' | 'high';
  sortBy?: 'aiScore' | 'potential' | 'volume' | 'marketCap';
  onlyWithPositiveAI?: boolean;
}

class RealGemSearchService {
  private cache = new Map<string, { data: RealGemSearchResult; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  // Top crypto symbols to search (CoinGecko IDs)
  private readonly TOP_CRYPTO_SYMBOLS = [
    'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'chainlink',
    'avalanche-2', 'polygon', 'uniswap', 'arbitrum', 'optimism', 'sui',
    'render-token', 'injective-protocol', 'ocean-protocol', 'fetch-ai',
    'thorchain', 'kava', 'oasis-network', 'fantom', 'near', 'algorand',
    'vechain', 'the-sandbox', 'decentraland', 'filecoin', 'aave', 'compound',
    'maker', 'synthetix', 'yearn-finance', 'curve-dao-token', 'lido-dao',
    'rocket-pool', 'frax-share', 'convex-finance', 'liquity', 'balancer'
  ];

  // Top stock symbols to search
  private readonly TOP_STOCK_SYMBOLS = [
    'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMD', 'META', 'AMZN',
    'NFLX', 'PLTR', 'COIN', 'RBLX', 'HOOD', 'SOFI', 'NET', 'SNOW',
    'CRWD', 'DDOG', 'OKTA', 'ZM', 'SHOP', 'SQ', 'PYPL', 'ROKU',
    'TWLO', 'CRSP', 'EDIT', 'BEAM', 'PACB', 'ILMN', 'MRNA', 'BNTX',
    'SPCE', 'LCID', 'RIVN', 'F', 'GM', 'OPEN', 'ABNB', 'UBER',
    'LYFT', 'DASH', 'SPOT', 'PINS', 'SNAP', 'TWTR', 'UPST', 'AFRM'
  ];

  /**
   * Search for crypto gems with real data and AI analysis
   */
  async searchCryptoGems(options: GemSearchOptions = { maxResults: 20 }): Promise<RealGemSearchResult[]> {
    try {
      apiLogger.info('Starting crypto gem search with real data...');
      
      const results: RealGemSearchResult[] = [];
      const symbolsToSearch = this.TOP_CRYPTO_SYMBOLS.slice(0, options.maxResults * 2); // Search more to filter later
      
      // Get real market data for all symbols
      const marketDataPromises = symbolsToSearch.map(symbol => 
        this.getMarketDataWithRetry(symbol, 'crypto')
      );
      
      const marketDataResults = await Promise.allSettled(marketDataPromises);
      
      // Filter out failed requests and process successful ones
      const validMarketData = marketDataResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(data => data && data.price && data.price > 0);
      
      if (validMarketData.length === 0) {
        throw new Error('No valid market data retrieved');
      }
      
      // Analyze each gem with AI
      for (const marketData of validMarketData) {
        try {
          const gemResult = await this.analyzeGemWithAI(marketData, 'crypto');
          
          // Apply filters
          if (this.passesFilters(gemResult, options)) {
            results.push(gemResult);
          }
        } catch (error) {
          apiLogger.error('Error analyzing crypto gem', { symbol: marketData.symbol, error: error as Error });
          continue;
        }
      }
      
      // Sort results
      const sortedResults = this.sortResults(results, options.sortBy || 'aiScore');
      
      apiLogger.info(`Found ${sortedResults.length} crypto gems`);
      return sortedResults.slice(0, options.maxResults);
      
    } catch (error) {
      apiLogger.error('Error searching crypto gems', { error: error as Error });
      throw error;
    }
  }

  /**
   * Search for stock gems with real data and AI analysis
   */
  async searchStockGems(options: GemSearchOptions = { maxResults: 20 }): Promise<RealGemSearchResult[]> {
    try {
      apiLogger.info('Starting stock gem search with real data...');
      
      const results: RealGemSearchResult[] = [];
      const symbolsToSearch = this.TOP_STOCK_SYMBOLS.slice(0, options.maxResults * 2); // Search more to filter later
      
      // Get real market data for all symbols
      const marketDataPromises = symbolsToSearch.map(symbol => 
        this.getMarketDataWithRetry(symbol, 'stock')
      );
      
      const marketDataResults = await Promise.allSettled(marketDataPromises);
      
      // Filter out failed requests and process successful ones
      const validMarketData = marketDataResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => result.value)
        .filter(data => data && data.price && data.price > 0);
      
      if (validMarketData.length === 0) {
        throw new Error('No valid market data retrieved');
      }
      
      // Analyze each gem with AI
      for (const marketData of validMarketData) {
        try {
          const gemResult = await this.analyzeGemWithAI(marketData, 'stock');
          
          // Apply filters
          if (this.passesFilters(gemResult, options)) {
            results.push(gemResult);
          }
        } catch (error) {
          apiLogger.error('Error analyzing stock gem', { symbol: marketData.symbol, error: error as Error });
          continue;
        }
      }
      
      // Sort results
      const sortedResults = this.sortResults(results, options.sortBy || 'aiScore');
      
      apiLogger.info(`Found ${sortedResults.length} stock gems`);
      return sortedResults.slice(0, options.maxResults);
      
    } catch (error) {
      apiLogger.error('Error searching stock gems', { error: error as Error });
      throw error;
    }
  }

  /**
   * Search for a specific symbol with AI analysis
   */
  async searchSpecificSymbol(symbol: string, type: 'crypto' | 'stock'): Promise<RealGemSearchResult | null> {
    try {
      const cacheKey = `${symbol}_${type}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < this.CACHE_DURATION) {
        return cached.data;
      }
      
      // Get real market data
      const marketData = await this.getMarketDataWithRetry(symbol, type);
      
      if (!marketData || !marketData.price || marketData.price <= 0) {
        return null;
      }
      
      // Analyze with AI
      const gemResult = await this.analyzeGemWithAI(marketData, type);
      
      // Cache the result
      this.cache.set(cacheKey, { data: gemResult, timestamp: Date.now() });
      
      return gemResult;
      
    } catch (error) {
      apiLogger.error('Error searching specific symbol', { symbol, type, error: error as Error });
      return null;
    }
  }

  /**
   * Get market data with retry logic
   */
  private async getMarketDataWithRetry(symbol: string, type: 'crypto' | 'stock', retries = 2): Promise<any> {
    for (let i = 0; i <= retries; i++) {
      try {
        const marketData = await realDataService.getMarketData(symbol);
        
        if (marketData && marketData.price && marketData.price > 0 && marketData.source === 'real') {
          return marketData;
        }
        
        // If not real data, try again
        if (i < retries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1))); // Progressive delay
        }
      } catch (error) {
        if (i === retries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
    
    throw new Error(`Failed to get real market data for ${symbol} after ${retries + 1} attempts`);
  }

  /**
   * Analyze a gem with AI services
   */
  private async analyzeGemWithAI(marketData: any, type: 'crypto' | 'stock'): Promise<RealGemSearchResult> {
    try {
      // Get AI analysis from enhanced AI service
      const aiAnalysis = await enhancedAIService.generateAIAnalysis(marketData.symbol);
      
      // Get VectorFlux analysis
      const vectorFluxAnalysis = await vectorFluxAIService.getPrediction(marketData.symbol, '1d');
      
      // Calculate scores
      const aiScore = this.calculateAIScore(aiAnalysis, vectorFluxAnalysis);
      const technicalScore = this.calculateTechnicalScore(aiAnalysis);
      const riskScore = this.calculateRiskScore(aiAnalysis, marketData);
      const qualityScore = this.calculateQualityScore(aiScore, technicalScore, riskScore);
      
      // Generate predictions
      const predictions = this.generatePredictions(aiAnalysis, vectorFluxAnalysis, marketData);
      
      // Get symbol name
      const symbolName = this.getSymbolName(marketData.symbol, type);
      
      return {
        symbol: marketData.symbol,
        name: symbolName,
        price: marketData.price,
        change24h: marketData.change || 0,
        changePercent: marketData.changePercent || 0,
        volume: marketData.volume || 0,
        marketCap: marketData.marketCap || 0,
        type,
        aiScore,
        aiAnalysis: aiAnalysis.analysis.reasoning.join('. '),
        aiRecommendation: aiAnalysis.analysis.recommendation,
        aiConfidence: aiAnalysis.analysis.confidence,
        technicalScore,
        technicalSignals: this.extractTechnicalSignals(aiAnalysis),
        riskLevel: this.determineRiskLevel(riskScore),
        riskScore,
        priceTarget1d: predictions.priceTarget1d,
        priceTarget7d: predictions.priceTarget7d,
        priceTarget30d: predictions.priceTarget30d,
        qualityScore,
        potential: this.determinePotential(qualityScore, aiScore),
        lastUpdated: new Date(),
        source: marketData.source || 'real'
      };
      
    } catch (error) {
      apiLogger.error('Error analyzing gem with AI', { symbol: marketData.symbol, error: error as Error });
      throw error;
    }
  }

  /**
   * Calculate AI score based on analysis results
   */
  private calculateAIScore(aiAnalysis: any, vectorFluxAnalysis: any): number {
    let score = 0;
    let count = 0;
    
    if (aiAnalysis && aiAnalysis.analysis && aiAnalysis.analysis.score) {
      score += aiAnalysis.analysis.score;
      count++;
    }
    
    if (vectorFluxAnalysis && vectorFluxAnalysis.confidence) {
      score += vectorFluxAnalysis.confidence;
      count++;
    }
    
    return count > 0 ? score / count : 0.5;
  }

  /**
   * Calculate technical score
   */
  private calculateTechnicalScore(aiAnalysis: any): number {
    if (!aiAnalysis || !aiAnalysis.predictions || !aiAnalysis.predictions.technicalIndicators) {
      return 0.5;
    }
    
    const indicators = aiAnalysis.predictions.technicalIndicators;
    let score = 0;
    let count = 0;
    
    // RSI score
    if (indicators.rsi) {
      const rsi = indicators.rsi;
      if (rsi >= 30 && rsi <= 70) score += 0.8;
      else if (rsi < 30) score += 0.9; // Oversold - potential buy
      else score += 0.3; // Overbought
      count++;
    }
    
    // MACD score
    if (indicators.macd) {
      score += indicators.macd > 0 ? 0.7 : 0.3;
      count++;
    }
    
    return count > 0 ? score / count : 0.5;
  }

  /**
   * Calculate risk score
   */
  private calculateRiskScore(aiAnalysis: any, marketData: any): number {
    let risk = 0;
    
    // Volatility risk
    const changePercent = Math.abs(marketData.changePercent || 0);
    risk += Math.min(changePercent / 10, 0.5); // Cap volatility risk at 0.5
    
    // AI risk assessment
    if (aiAnalysis && aiAnalysis.predictions && aiAnalysis.predictions.riskAssessment) {
      risk += aiAnalysis.predictions.riskAssessment.riskScore * 0.5;
    }
    
    return Math.min(risk, 1);
  }

  /**
   * Calculate quality score
   */
  private calculateQualityScore(aiScore: number, technicalScore: number, riskScore: number): number {
    return (aiScore * 0.5 + technicalScore * 0.3 + (1 - riskScore) * 0.2);
  }

  /**
   * Generate price predictions
   */
  private generatePredictions(aiAnalysis: any, vectorFluxAnalysis: any, marketData: any): {
    priceTarget1d: number;
    priceTarget7d: number;
    priceTarget30d: number;
  } {
    const currentPrice = marketData.price;
    
    // Use AI predictions if available
    if (aiAnalysis && aiAnalysis.predictions && aiAnalysis.predictions.prediction) {
      const aiPrediction = aiAnalysis.predictions.prediction;
      const predictedPrice = aiPrediction.price;
      
      return {
        priceTarget1d: predictedPrice,
        priceTarget7d: predictedPrice * 1.02,
        priceTarget30d: predictedPrice * 1.05
      };
    }
    
    // Fallback to basic predictions
    const direction = vectorFluxAnalysis?.recommendation === 'buy' ? 1 : -1;
    const confidence = vectorFluxAnalysis?.confidence || 0.5;
    
    return {
      priceTarget1d: currentPrice * (1 + direction * confidence * 0.02),
      priceTarget7d: currentPrice * (1 + direction * confidence * 0.05),
      priceTarget30d: currentPrice * (1 + direction * confidence * 0.10)
    };
  }

  /**
   * Extract technical signals
   */
  private extractTechnicalSignals(aiAnalysis: any): string[] {
    const signals: string[] = [];
    
    if (aiAnalysis && aiAnalysis.analysis && aiAnalysis.analysis.keyFactors) {
      return aiAnalysis.analysis.keyFactors.slice(0, 3); // Take first 3 key factors
    }
    
    return ['Technical analysis available', 'Market conditions evaluated', 'Risk assessment complete'];
  }

  /**
   * Determine risk level
   */
  private determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore < 0.3) return 'low';
    if (riskScore < 0.7) return 'medium';
    return 'high';
  }

  /**
   * Determine potential
   */
  private determinePotential(qualityScore: number, aiScore: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    const avgScore = (qualityScore + aiScore) / 2;
    
    if (avgScore < 0.2) return 'very_low';
    if (avgScore < 0.4) return 'low';
    if (avgScore < 0.6) return 'medium';
    if (avgScore < 0.8) return 'high';
    return 'very_high';
  }

  /**
   * Get symbol name
   */
  private getSymbolName(symbol: string, type: 'crypto' | 'stock'): string {
    const names: Record<string, string> = {
      // Crypto names
      'bitcoin': 'Bitcoin',
      'ethereum': 'Ethereum',
      'solana': 'Solana',
      'cardano': 'Cardano',
      'polkadot': 'Polkadot',
      'chainlink': 'Chainlink',
      'avalanche-2': 'Avalanche',
      'polygon': 'Polygon',
      'uniswap': 'Uniswap',
      'render-token': 'Render',
      'injective-protocol': 'Injective',
      'ocean-protocol': 'Ocean Protocol',
      'fetch-ai': 'Fetch.ai',
      
      // Stock names
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corp.',
      'TSLA': 'Tesla Inc.',
      'NVDA': 'NVIDIA Corp.',
      'AMD': 'Advanced Micro Devices',
      'META': 'Meta Platforms',
      'AMZN': 'Amazon.com Inc.',
      'PLTR': 'Palantir Technologies',
      'COIN': 'Coinbase Global',
      'RBLX': 'Roblox Corporation',
      'HOOD': 'Robinhood Markets',
      'SOFI': 'SoFi Technologies',
      'NET': 'Cloudflare Inc.',
      'SNOW': 'Snowflake Inc.',
      'CRWD': 'CrowdStrike Holdings',
      'ROKU': 'Roku Inc.'
    };
    
    return names[symbol] || symbol.toUpperCase();
  }

  /**
   * Check if result passes filters
   */
  private passesFilters(result: RealGemSearchResult, options: GemSearchOptions): boolean {
    if (options.minMarketCap && result.marketCap < options.minMarketCap) return false;
    if (options.maxMarketCap && result.marketCap > options.maxMarketCap) return false;
    if (options.minVolume && result.volume < options.minVolume) return false;
    if (options.minAIScore && result.aiScore < options.minAIScore) return false;
    if (options.onlyWithPositiveAI && result.aiRecommendation === 'sell') return false;
    
    if (options.riskTolerance) {
      const riskLevel = result.riskLevel;
      if (options.riskTolerance === 'low' && riskLevel !== 'low') return false;
      if (options.riskTolerance === 'medium' && riskLevel === 'high') return false;
    }
    
    return true;
  }

  /**
   * Sort results
   */
  private sortResults(results: RealGemSearchResult[], sortBy: string): RealGemSearchResult[] {
    return results.sort((a, b) => {
      switch (sortBy) {
        case 'aiScore':
          return b.aiScore - a.aiScore;
        case 'potential':
          const potentialOrder = { 'very_high': 5, 'high': 4, 'medium': 3, 'low': 2, 'very_low': 1 };
          return potentialOrder[b.potential] - potentialOrder[a.potential];
        case 'volume':
          return b.volume - a.volume;
        case 'marketCap':
          return b.marketCap - a.marketCap;
        default:
          return b.aiScore - a.aiScore;
      }
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export const realGemSearchService = new RealGemSearchService();

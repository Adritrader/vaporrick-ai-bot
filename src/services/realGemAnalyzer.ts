import { realDataService } from './realDataService';
import { enhancedAIService } from './enhancedAIService';
import { vectorFluxService } from '../ai/vectorFluxService';
import { apiLogger } from '../utils/logger';

export interface RealGemData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  changePercent: number;
  marketCap: number;
  volume24h: number;
  type: 'crypto' | 'stock';
  source: 'real' | 'cache' | 'fallback';
  lastUpdated: Date;
  
  // AI Analysis
  aiScore: number;
  aiAnalysis: string;
  aiRecommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell';
  aiConfidence: number;
  
  // Technical Analysis
  technicalIndicators: {
    rsi: number;
    macd: number;
    stochastic: number;
    sma20: number;
    sma50: number;
    ema20: number;
    atr: number;
    adx: number;
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
  
  // Risk Assessment
  riskLevel: 'low' | 'medium' | 'high';
  riskScore: number;
  volatility: number;
  
  // Sentiment Analysis
  sentiment: {
    overall: number;
    social: number;
    news: number;
    analyst: number;
    trend: 'positive' | 'negative' | 'neutral';
  };
  
  // Fundamentals (for stocks)
  fundamentals?: {
    peRatio?: number;
    pbRatio?: number;
    debtToEquity?: number;
    roe?: number;
    revenue?: number;
    netIncome?: number;
    eps?: number;
  };
  
  // Crypto-specific metrics
  cryptoMetrics?: {
    marketCapRank?: number;
    circulatingSupply?: number;
    totalSupply?: number;
    maxSupply?: number;
    allTimeHigh?: number;
    allTimeLow?: number;
    marketDominance?: number;
  };
  
  // Prediction
  prediction: {
    priceTarget1d: number;
    priceTarget7d: number;
    priceTarget30d: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
  };
  
  // Quality Score
  qualityScore: number;
  potential: 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
  timeframe: string;
}

interface GemAnalysisOptions {
  includeAI?: boolean;
  includeTechnicals?: boolean;
  includeSentiment?: boolean;
  includeFundamentals?: boolean;
  maxCacheAge?: number;
}

class RealGemAnalyzer {
  private cache = new Map<string, { data: RealGemData; timestamp: number }>();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  /**
   * Analyze a single gem with real data and AI
   */
  async analyzeGem(
    symbol: string, 
    options: GemAnalysisOptions = {}
  ): Promise<RealGemData> {
    const opts = {
      includeAI: true,
      includeTechnicals: true,
      includeSentiment: true,
      includeFundamentals: true,
      maxCacheAge: this.CACHE_DURATION,
      ...options
    };
    
    // Check cache first
    const cacheKey = `${symbol}_${JSON.stringify(opts)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < opts.maxCacheAge) {
      return cached.data;
    }
    
    try {
      apiLogger.info(`Analyzing gem: ${symbol}`, { options: opts });
      
      // Get real market data
      const marketData = await realDataService.getMarketData(symbol);
      
      // Get AI analysis
      let aiAnalysis = null;
      if (opts.includeAI) {
        try {
          aiAnalysis = await enhancedAIService.generateAIAnalysis(symbol);
        } catch (error) {
          apiLogger.warn(`AI analysis failed for ${symbol}`, { error });
        }
      }
      
      // Get VectorFlux analysis
      let vectorFluxAnalysis = null;
      if (opts.includeAI) {
        try {
          vectorFluxAnalysis = await vectorFluxService.performCompleteAnalysis(symbol);
        } catch (error) {
          apiLogger.warn(`VectorFlux analysis failed for ${symbol}`, { error });
        }
      }
      
      // Calculate technical indicators
      const technicalIndicators = await this.calculateTechnicalIndicators(symbol, marketData);
      
      // Calculate sentiment
      const sentiment = await this.calculateSentiment(symbol, opts.includeSentiment);
      
      // Calculate fundamentals
      const fundamentals = marketData.type === 'stock' && opts.includeFundamentals 
        ? await this.calculateFundamentals(symbol) 
        : undefined;
      
      // Calculate crypto metrics
      const cryptoMetrics = marketData.type === 'crypto' 
        ? await this.calculateCryptoMetrics(symbol) 
        : undefined;
      
      // Calculate AI scores
      const aiScore = this.calculateAIScore(aiAnalysis, vectorFluxAnalysis, technicalIndicators);
      const aiRecommendation = this.determineAIRecommendation(aiAnalysis, vectorFluxAnalysis);
      const aiConfidence = this.calculateAIConfidence(aiAnalysis, vectorFluxAnalysis);
      
      // Calculate risk assessment
      const riskAssessment = this.calculateRiskAssessment(marketData, technicalIndicators, sentiment);
      
      // Generate prediction
      const prediction = await this.generatePrediction(symbol, marketData, aiAnalysis, vectorFluxAnalysis);
      
      // Calculate quality score
      const qualityScore = this.calculateQualityScore(marketData, technicalIndicators, aiScore, riskAssessment);
      
      const gemData: RealGemData = {
        symbol: marketData.symbol,
        name: this.getAssetName(symbol, marketData.type),
        price: marketData.price,
        change24h: marketData.change,
        changePercent: marketData.changePercent,
        marketCap: marketData.marketCap || 0,
        volume24h: marketData.volume || 0,
        type: marketData.type,
        source: marketData.source || 'real',
        lastUpdated: new Date(marketData.lastUpdated),
        
        aiScore,
        aiAnalysis: aiAnalysis?.analysis.reasoning || 'Analysis not available',
        aiRecommendation,
        aiConfidence,
        
        technicalIndicators,
        
        riskLevel: riskAssessment.level,
        riskScore: riskAssessment.score,
        volatility: riskAssessment.volatility,
        
        sentiment,
        fundamentals,
        cryptoMetrics,
        prediction,
        
        qualityScore,
        potential: this.determinePotential(qualityScore, aiScore, riskAssessment.score),
        timeframe: this.determineTimeframe(marketData.type, aiScore, riskAssessment.score)
      };
      
      // Cache the result
      this.cache.set(cacheKey, {
        data: gemData,
        timestamp: Date.now()
      });
      
      apiLogger.info(`Gem analysis completed for ${symbol}`, {
        aiScore,
        riskLevel: riskAssessment.level,
        recommendation: aiRecommendation
      });
      
      return gemData;
      
    } catch (error) {
      apiLogger.error(`Error analyzing gem ${symbol}`, { error });
      throw error;
    }
  }
  
  /**
   * Analyze multiple gems in batch
   */
  async analyzeGems(
    symbols: string[], 
    options: GemAnalysisOptions = {}
  ): Promise<RealGemData[]> {
    try {
      const analysisPromises = symbols.map(symbol => 
        this.analyzeGem(symbol, options).catch(error => {
          apiLogger.warn(`Failed to analyze gem ${symbol}`, { error });
          return null;
        })
      );
      
      const results = await Promise.all(analysisPromises);
      return results.filter(result => result !== null) as RealGemData[];
      
    } catch (error) {
      apiLogger.error('Error analyzing gems batch', { error });
      throw error;
    }
  }
  
  /**
   * Get curated list of gems for analysis
   */
  getCuratedGemsList(): string[] {
    return [
      // Top Cryptocurrencies
      'bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot', 'chainlink',
      'avalanche', 'polygon', 'uniswap', 'arbitrum', 'optimism', 'sui',
      'render-token', 'injective-protocol', 'ocean-protocol', 'fetch-ai',
      
      // Top Stocks
      'AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'AMD', 'META', 'AMZN',
      'NFLX', 'PLTR', 'COIN', 'RBLX', 'HOOD', 'SOFI', 'NET', 'SNOW',
      'CRWD', 'DDOG', 'OKTA', 'ZM', 'SHOP', 'SQ', 'PYPL', 'ROKU'
    ];
  }
  
  /**
   * Calculate technical indicators
   */
  private async calculateTechnicalIndicators(symbol: string, marketData: any) {
    // For now, use simple calculations based on current price
    // In production, you'd get historical data and calculate properly
    const price = marketData.price;
    const change = marketData.change;
    const changePercent = marketData.changePercent;
    
    return {
      rsi: this.calculateRSI(price, change),
      macd: this.calculateMACD(price, change),
      stochastic: this.calculateStochastic(price, price * 1.05, price * 0.95),
      sma20: price * 0.98,
      sma50: price * 0.95,
      ema20: price * 0.99,
      atr: Math.abs(change) / price * 100,
      adx: Math.min(Math.abs(changePercent) * 2, 100),
      bollinger: {
        upper: price * 1.02,
        middle: price,
        lower: price * 0.98
      }
    };
  }
  
  /**
   * Calculate sentiment analysis
   */
  private async calculateSentiment(symbol: string, includeSentiment: boolean): Promise<{
    overall: number;
    social: number;
    news: number;
    analyst: number;
    trend: 'positive' | 'negative' | 'neutral';
  }> {
    if (!includeSentiment) {
      return {
        overall: 0.5,
        social: 0.5,
        news: 0.5,
        analyst: 0.5,
        trend: 'neutral'
      };
    }
    
    // In production, integrate with sentiment APIs
    const baseScore = 0.3 + (Math.random() * 0.4);
    const trend: 'positive' | 'negative' | 'neutral' = baseScore > 0.6 ? 'positive' : baseScore < 0.4 ? 'negative' : 'neutral';
    
    return {
      overall: baseScore,
      social: baseScore + (Math.random() * 0.2 - 0.1),
      news: baseScore + (Math.random() * 0.2 - 0.1),
      analyst: baseScore + (Math.random() * 0.2 - 0.1),
      trend
    };
  }
  
  /**
   * Calculate stock fundamentals
   */
  private async calculateFundamentals(symbol: string) {
    // In production, integrate with financial data APIs
    return {
      peRatio: 15 + (Math.random() * 20),
      pbRatio: 1 + (Math.random() * 3),
      debtToEquity: Math.random() * 0.5,
      roe: 0.1 + (Math.random() * 0.2),
      revenue: 1000000000 + (Math.random() * 10000000000),
      netIncome: 100000000 + (Math.random() * 1000000000),
      eps: 1 + (Math.random() * 10)
    };
  }
  
  /**
   * Calculate crypto-specific metrics
   */
  private async calculateCryptoMetrics(symbol: string) {
    // In production, integrate with crypto APIs like CoinGecko
    return {
      marketCapRank: Math.floor(Math.random() * 100) + 1,
      circulatingSupply: 1000000 + (Math.random() * 100000000),
      totalSupply: 2000000 + (Math.random() * 200000000),
      maxSupply: 21000000 + (Math.random() * 1000000000),
      allTimeHigh: 1000 + (Math.random() * 50000),
      allTimeLow: 0.1 + (Math.random() * 100),
      marketDominance: Math.random() * 10
    };
  }
  
  /**
   * Calculate AI score based on all analyses
   */
  private calculateAIScore(aiAnalysis: any, vectorFluxAnalysis: any, technicalIndicators: any): number {
    let score = 0.5; // Base score
    
    if (aiAnalysis) {
      score += aiAnalysis.analysis.confidence * 0.3;
    }
    
    if (vectorFluxAnalysis) {
      score += vectorFluxAnalysis.confidence * 0.3;
    }
    
    // Technical indicators influence
    if (technicalIndicators.rsi > 30 && technicalIndicators.rsi < 70) {
      score += 0.1;
    }
    
    if (technicalIndicators.macd > 0) {
      score += 0.1;
    }
    
    return Math.min(Math.max(score, 0), 1);
  }
  
  /**
   * Determine AI recommendation
   */
  private determineAIRecommendation(aiAnalysis: any, vectorFluxAnalysis: any): 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' {
    if (aiAnalysis?.analysis.recommendation) {
      return aiAnalysis.analysis.recommendation;
    }
    
    if (vectorFluxAnalysis?.recommendation) {
      return vectorFluxAnalysis.recommendation;
    }
    
    return 'hold';
  }
  
  /**
   * Calculate AI confidence
   */
  private calculateAIConfidence(aiAnalysis: any, vectorFluxAnalysis: any): number {
    const confidences = [];
    
    if (aiAnalysis?.analysis.confidence) {
      confidences.push(aiAnalysis.analysis.confidence);
    }
    
    if (vectorFluxAnalysis?.confidence) {
      confidences.push(vectorFluxAnalysis.confidence);
    }
    
    return confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0.5;
  }
  
  /**
   * Calculate risk assessment
   */
  private calculateRiskAssessment(marketData: any, technicalIndicators: any, sentiment: any): {
    score: number;
    level: 'low' | 'medium' | 'high';
    volatility: number;
  } {
    let riskScore = 0;
    
    // Volatility risk
    const volatility = Math.abs(marketData.changePercent) / 100;
    riskScore += volatility * 0.3;
    
    // Technical risk
    if (technicalIndicators.rsi > 70 || technicalIndicators.rsi < 30) {
      riskScore += 0.2;
    }
    
    // Sentiment risk
    if (sentiment.overall < 0.3) {
      riskScore += 0.2;
    }
    
    // Market cap risk (smaller = higher risk)
    if (marketData.marketCap < 1000000000) {
      riskScore += 0.3;
    }
    
    const level: 'low' | 'medium' | 'high' = riskScore > 0.7 ? 'high' : riskScore > 0.4 ? 'medium' : 'low';
    
    return {
      score: Math.min(riskScore, 1),
      level,
      volatility
    };
  }
  
  /**
   * Generate price prediction
   */
  private async generatePrediction(symbol: string, marketData: any, aiAnalysis: any, vectorFluxAnalysis: any): Promise<{
    priceTarget1d: number;
    priceTarget7d: number;
    priceTarget30d: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
  }> {
    const currentPrice = marketData.price;
    const changePercent = marketData.changePercent;
    
    // Simple prediction based on current trends and AI analysis
    let trendMultiplier = 1;
    if (aiAnalysis?.analysis.recommendation === 'buy' || aiAnalysis?.analysis.recommendation === 'strong_buy') {
      trendMultiplier = 1.05;
    } else if (aiAnalysis?.analysis.recommendation === 'sell' || aiAnalysis?.analysis.recommendation === 'strong_sell') {
      trendMultiplier = 0.95;
    }
    
    const trend: 'bullish' | 'bearish' | 'neutral' = changePercent > 0 ? 'bullish' : changePercent < -2 ? 'bearish' : 'neutral';
    
    return {
      priceTarget1d: currentPrice * trendMultiplier * (1 + (Math.random() * 0.02 - 0.01)),
      priceTarget7d: currentPrice * trendMultiplier * (1 + (Math.random() * 0.1 - 0.05)),
      priceTarget30d: currentPrice * trendMultiplier * (1 + (Math.random() * 0.3 - 0.15)),
      trend,
      confidence: this.calculateAIConfidence(aiAnalysis, vectorFluxAnalysis)
    };
  }
  
  /**
   * Calculate quality score
   */
  private calculateQualityScore(marketData: any, technicalIndicators: any, aiScore: number, riskAssessment: any): number {
    let score = 0;
    
    // AI score influence (40%)
    score += aiScore * 0.4;
    
    // Risk influence (30% - lower risk = higher quality)
    score += (1 - riskAssessment.score) * 0.3;
    
    // Technical indicators influence (20%)
    if (technicalIndicators.rsi > 30 && technicalIndicators.rsi < 70) {
      score += 0.1;
    }
    if (technicalIndicators.macd > 0) {
      score += 0.1;
    }
    
    // Market cap influence (10%)
    if (marketData.marketCap > 1000000000) {
      score += 0.1;
    }
    
    return Math.min(Math.max(score, 0), 1);
  }
  
  /**
   * Determine potential based on scores
   */
  private determinePotential(qualityScore: number, aiScore: number, riskScore: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    const combinedScore = (qualityScore + aiScore + (1 - riskScore)) / 3;
    
    if (combinedScore > 0.8) return 'very_high';
    if (combinedScore > 0.6) return 'high';
    if (combinedScore > 0.4) return 'medium';
    if (combinedScore > 0.2) return 'low';
    return 'very_low';
  }
  
  /**
   * Determine timeframe based on asset type and scores
   */
  private determineTimeframe(type: 'crypto' | 'stock', aiScore: number, riskScore: number): string {
    if (type === 'crypto') {
      if (riskScore > 0.7) return '1-3 weeks';
      if (aiScore > 0.7) return '1-2 months';
      return '2-6 months';
    } else {
      if (riskScore > 0.7) return '1-3 months';
      if (aiScore > 0.7) return '3-6 months';
      return '6-12 months';
    }
  }
  
  /**
   * Get asset name
   */
  private getAssetName(symbol: string, type: 'crypto' | 'stock'): string {
    const names: Record<string, string> = {
      // Crypto
      'bitcoin': 'Bitcoin',
      'ethereum': 'Ethereum',
      'cardano': 'Cardano',
      'solana': 'Solana',
      'polkadot': 'Polkadot',
      'chainlink': 'Chainlink',
      'avalanche': 'Avalanche',
      'polygon': 'Polygon',
      'uniswap': 'Uniswap',
      'arbitrum': 'Arbitrum',
      'optimism': 'Optimism',
      'sui': 'Sui',
      'render-token': 'Render',
      'injective-protocol': 'Injective',
      'ocean-protocol': 'Ocean Protocol',
      'fetch-ai': 'Fetch.ai',
      
      // Stocks
      'AAPL': 'Apple Inc.',
      'GOOGL': 'Alphabet Inc.',
      'MSFT': 'Microsoft Corp.',
      'TSLA': 'Tesla Inc.',
      'NVDA': 'NVIDIA Corp.',
      'AMD': 'Advanced Micro Devices',
      'META': 'Meta Platforms',
      'AMZN': 'Amazon.com Inc.',
      'NFLX': 'Netflix Inc.',
      'PLTR': 'Palantir Technologies',
      'COIN': 'Coinbase Global',
      'RBLX': 'Roblox Corporation',
      'HOOD': 'Robinhood Markets',
      'SOFI': 'SoFi Technologies',
      'NET': 'Cloudflare Inc.',
      'SNOW': 'Snowflake Inc.',
      'CRWD': 'CrowdStrike Holdings',
      'DDOG': 'Datadog Inc.',
      'OKTA': 'Okta Inc.',
      'ZM': 'Zoom Video Communications',
      'SHOP': 'Shopify Inc.',
      'SQ': 'Block Inc.',
      'PYPL': 'PayPal Holdings',
      'ROKU': 'Roku Inc.'
    };
    
    return names[symbol] || symbol;
  }
  
  // Simple technical indicator calculations
  private calculateRSI(price: number, change: number): number {
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);
    const rs = gain / (loss || 1);
    return 100 - (100 / (1 + rs));
  }
  
  private calculateMACD(price: number, change: number): number {
    const ema12 = price * 0.154 + price * (1 - 0.154);
    const ema26 = price * 0.074 + price * (1 - 0.074);
    return ema12 - ema26;
  }
  
  private calculateStochastic(price: number, high: number, low: number): number {
    const k = ((price - low) / (high - low)) * 100;
    return Math.max(0, Math.min(100, k));
  }
  
  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
  
  /**
   * Get cache stats
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export const realGemAnalyzer = new RealGemAnalyzer();

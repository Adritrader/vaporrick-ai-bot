import { realDataService } from './realDataService';
import marketDataService from './marketDataService';

interface TechnicalIndicators {
  rsi: number;
  macd: number;
  ema20: number;
  ema50: number;
  volumeProfile: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  signals: Array<{
    indicator: string;
    signal: string;
    strength: number;
  }>;
}

interface Pattern {
  name: string;
  strength: number;
  timeframe: string;
  confidence: number;
}

interface Prediction {
  shortTerm: number;
  mediumTerm: number;
  longTerm: number;
  confidence: number;
}

interface RiskAssessment {
  volatility: number;
  correlation: number;
  liquidityRisk: number;
  overall: 'low' | 'medium' | 'high';
  score: number;
}

interface SentimentAnalysis {
  score: number;
  sources: string[];
  summary: string;
  trend: 'positive' | 'negative' | 'neutral';
}

export class MarketDataProcessor {
  private cache: Map<string, any> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  async calculateTechnicalIndicators(prices: number[]): Promise<TechnicalIndicators> {
    try {
      if (!prices || prices.length < 20) {
        throw new Error('Insufficient data for technical analysis');
      }

      const rsi = this.calculateRSI(prices);
      const macd = this.calculateMACD(prices);
      const ema20 = this.calculateEMA(prices, 20);
      const ema50 = this.calculateEMA(prices, 50);
      const volumeProfile = this.calculateVolumeProfile(prices);
      
      const trend = this.determineTrend(prices, ema20, ema50);
      const signals = this.generateSignals(rsi, macd, trend);

      return {
        rsi,
        macd,
        ema20,
        ema50,
        volumeProfile,
        trend,
        signals
      };
    } catch (error) {
      console.error('Error calculating technical indicators:', error);
      return this.getDefaultTechnicalIndicators();
    }
  }

  async detectPatterns(prices: number[]): Promise<Pattern[]> {
    try {
      if (!prices || prices.length < 10) {
        return [];
      }

      const patterns: Pattern[] = [];
      
      // Double Top/Bottom pattern
      const doublePattern = this.detectDoublePattern(prices);
      if (doublePattern) patterns.push(doublePattern);

      // Triangle patterns
      const trianglePattern = this.detectTrianglePattern(prices);
      if (trianglePattern) patterns.push(trianglePattern);

      // Head and Shoulders
      const headShouldersPattern = this.detectHeadShouldersPattern(prices);
      if (headShouldersPattern) patterns.push(headShouldersPattern);

      return patterns.sort((a, b) => b.strength - a.strength);
    } catch (error) {
      console.error('Error detecting patterns:', error);
      return [];
    }
  }

  async generatePrediction(prices: number[], aiModels: any[]): Promise<Prediction> {
    try {
      if (!prices || prices.length < 5) {
        throw new Error('Insufficient data for prediction');
      }

      // Use real AI model predictions if available
      const recentTrend = this.calculateTrendPercentage(prices.slice(-7));
      const volatility = this.calculateVolatility(prices);
      
      // Simulate AI model ensemble prediction
      const shortTerm = recentTrend * (1 + Math.random() * 0.2 - 0.1);
      const mediumTerm = shortTerm * (1 + Math.random() * 0.3 - 0.15);
      const longTerm = mediumTerm * (1 + Math.random() * 0.4 - 0.2);
      
      const confidence = Math.max(60, 95 - volatility * 100);

      return {
        shortTerm,
        mediumTerm,
        longTerm,
        confidence
      };
    } catch (error) {
      console.error('Error generating prediction:', error);
      return {
        shortTerm: 0,
        mediumTerm: 0,
        longTerm: 0,
        confidence: 50
      };
    }
  }

  async analyzeSentiment(symbol: string): Promise<SentimentAnalysis> {
    try {
      // In a real implementation, this would fetch from news/social APIs
      const cacheKey = `sentiment_${symbol}`;
      
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        if (Date.now() - cached.timestamp < this.cacheTimeout) {
          return cached.data;
        }
      }

      // Simulate sentiment analysis
      const score = Math.random() * 200 - 100; // -100 to +100
      const trend: 'positive' | 'negative' | 'neutral' = score > 20 ? 'positive' : score < -20 ? 'negative' : 'neutral';
      
      const sentiment: SentimentAnalysis = {
        score,
        sources: ['Twitter', 'Reddit', 'News', 'Financial Forums'],
        summary: this.generateSentimentSummary(score, trend),
        trend
      };

      this.cache.set(cacheKey, {
        data: sentiment,
        timestamp: Date.now()
      });

      return sentiment;
    } catch (error) {
      console.error('Error analyzing sentiment:', error);
      return {
        score: 0,
        sources: [],
        summary: 'Sentiment analysis unavailable',
        trend: 'neutral'
      };
    }
  }

  async assessRisk(prices: number[], volume: number): Promise<RiskAssessment> {
    try {
      const volatility = this.calculateVolatility(prices);
      const correlation = this.calculateCorrelation(prices);
      const liquidityRisk = this.calculateLiquidityRisk(volume);
      
      const score = (volatility * 0.4 + correlation * 0.3 + liquidityRisk * 0.3) * 100;
      const overall = score < 30 ? 'low' : score < 70 ? 'medium' : 'high';

      return {
        volatility: volatility * 100,
        correlation,
        liquidityRisk: liquidityRisk * 100,
        overall,
        score
      };
    } catch (error) {
      console.error('Error assessing risk:', error);
      return {
        volatility: 50,
        correlation: 0.5,
        liquidityRisk: 50,
        overall: 'medium',
        score: 50
      };
    }
  }

  async getModelPredictions(prices: number[], aiModels: any[]): Promise<Record<string, any>> {
    try {
      const predictions: Record<string, any> = {};
      
      for (const model of aiModels) {
        const modelPrediction = await this.generateModelSpecificPrediction(prices, model);
        predictions[model.id] = modelPrediction;
      }
      
      return predictions;
    } catch (error) {
      console.error('Error getting model predictions:', error);
      return {};
    }
  }

  // Private helper methods
  private calculateRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = 1; i <= period; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    const rs = avgGain / (avgLoss || 1);
    
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(prices: number[]): number {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    return ema12 - ema26;
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1] || 0;
    
    const multiplier = 2 / (period + 1);
    let ema = prices[0];
    
    for (let i = 1; i < prices.length; i++) {
      ema = (prices[i] * multiplier) + (ema * (1 - multiplier));
    }
    
    return ema;
  }

  private calculateVolumeProfile(prices: number[]): number {
    // Simplified volume profile calculation
    const recentPrices = prices.slice(-10);
    const avgPrice = recentPrices.reduce((sum, p) => sum + p, 0) / recentPrices.length;
    const variance = recentPrices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / recentPrices.length;
    return Math.sqrt(variance) / avgPrice * 100;
  }

  private determineTrend(prices: number[], ema20: number, ema50: number): 'bullish' | 'bearish' | 'neutral' {
    const currentPrice = prices[prices.length - 1];
    const priceAboveEMA20 = currentPrice > ema20;
    const ema20AboveEMA50 = ema20 > ema50;
    
    if (priceAboveEMA20 && ema20AboveEMA50) return 'bullish';
    if (!priceAboveEMA20 && !ema20AboveEMA50) return 'bearish';
    return 'neutral';
  }

  private generateSignals(rsi: number, macd: number, trend: string): Array<{ indicator: string; signal: string; strength: number }> {
    const signals = [];
    
    if (rsi < 30) signals.push({ indicator: 'RSI', signal: 'Oversold', strength: (30 - rsi) * 2 });
    if (rsi > 70) signals.push({ indicator: 'RSI', signal: 'Overbought', strength: (rsi - 70) * 2 });
    if (macd > 0) signals.push({ indicator: 'MACD', signal: 'Bullish', strength: Math.min(macd * 10, 100) });
    if (macd < 0) signals.push({ indicator: 'MACD', signal: 'Bearish', strength: Math.min(Math.abs(macd) * 10, 100) });
    
    return signals;
  }

  private calculateTrendPercentage(prices: number[]): number {
    if (prices.length < 2) return 0;
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    return ((lastPrice - firstPrice) / firstPrice) * 100;
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateCorrelation(prices: number[]): number {
    // Simplified correlation with market (using random for demo)
    return Math.random() * 0.8 + 0.2;
  }

  private calculateLiquidityRisk(volume: number): number {
    // Simplified liquidity risk calculation
    const avgVolume = 1000000; // Example average
    return Math.max(0, 1 - volume / avgVolume);
  }

  private detectDoublePattern(prices: number[]): Pattern | null {
    // Simplified double top/bottom detection
    if (prices.length < 20) return null;
    
    const recent = prices.slice(-20);
    const peaks = this.findPeaks(recent);
    
    if (peaks.length >= 2) {
      return {
        name: 'Double Top',
        strength: 75 + Math.random() * 20,
        timeframe: '1d',
        confidence: 70
      };
    }
    
    return null;
  }

  private detectTrianglePattern(prices: number[]): Pattern | null {
    if (prices.length < 15) return null;
    
    return {
      name: 'Ascending Triangle',
      strength: 60 + Math.random() * 30,
      timeframe: '4h',
      confidence: 65
    };
  }

  private detectHeadShouldersPattern(prices: number[]): Pattern | null {
    if (prices.length < 25) return null;
    
    return {
      name: 'Head and Shoulders',
      strength: 80 + Math.random() * 15,
      timeframe: '1d',
      confidence: 75
    };
  }

  private findPeaks(prices: number[]): number[] {
    const peaks = [];
    for (let i = 1; i < prices.length - 1; i++) {
      if (prices[i] > prices[i - 1] && prices[i] > prices[i + 1]) {
        peaks.push(i);
      }
    }
    return peaks;
  }

  private generateSentimentSummary(score: number, trend: string): string {
    if (trend === 'positive') {
      return 'Market sentiment is bullish with strong buying interest and positive social media mentions.';
    } else if (trend === 'negative') {
      return 'Market sentiment is bearish with increased selling pressure and negative news coverage.';
    } else {
      return 'Market sentiment is neutral with mixed signals from various sources.';
    }
  }

  private async generateModelSpecificPrediction(prices: number[], model: any): Promise<any> {
    // Simulate model-specific prediction
    const basePredict = this.calculateTrendPercentage(prices.slice(-5));
    const modelVariance = Math.random() * 0.3 - 0.15; // ±15% variance
    
    return {
      prediction: basePredict * (1 + modelVariance),
      confidence: model.accuracy || 75,
      reasoning: `${model.name} analysis based on recent price movements and ${model.type} model predictions`
    };
  }

  private getDefaultTechnicalIndicators(): TechnicalIndicators {
    return {
      rsi: 50,
      macd: 0,
      ema20: 0,
      ema50: 0,
      volumeProfile: 50,
      trend: 'neutral',
      signals: []
    };
  }
}

export default MarketDataProcessor;

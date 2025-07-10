// AI Strategy Generation using TensorFlow.js
// This is a simplified version - in production, you'd use more sophisticated models

import { PriceData } from '../utils/technicalIndicators';
import { Strategy, StrategyRule } from '../backtesting/BacktestEngine';

export interface AIStrategyConfig {
  lookbackPeriod: number;
  riskTolerance: 'low' | 'medium' | 'high';
  tradingStyle: 'conservative' | 'aggressive' | 'balanced';
  preferredIndicators: string[];
}

export interface AIAnalysisResult {
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    timeHorizon: number; // days
    expectedReturn: number; // percentage
  };
  recommendations: {
    action: 'buy' | 'sell' | 'hold';
    reasoning: string[];
    riskLevel: number; // 0-1
  };
  strategy: Strategy;
}

export class AIStrategyGenerator {
  private config: AIStrategyConfig;
  
  constructor(config: AIStrategyConfig) {
    this.config = config;
  }

  async generateStrategy(historicalData: PriceData[], symbol: string): Promise<Strategy> {
    try {
      // Ensure sufficient data for analysis
      if (historicalData.length < 30) {
        throw new Error('Insufficient historical data for strategy generation');
      }

      // Analyze historical patterns
      const patterns = this.analyzePatterns(historicalData);
      
      // Generate symbol-specific strategy
      const entryRules = this.generateAdvancedEntryRules(patterns, symbol);
      const exitRules = this.generateAdvancedExitRules(patterns, symbol);
      
      // Determine risk management based on volatility and symbol characteristics
      const riskManagement = this.generateAdvancedRiskManagement(historicalData, symbol);
      
      // Generate strategy metadata
      const strategyType = this.determineStrategyType(patterns);
      const confidenceScore = this.calculateConfidenceScore(patterns);
      
      const strategy: Strategy = {
        name: `AI ${strategyType} Strategy - ${symbol}`,
        description: `${strategyType} strategy for ${symbol} based on ${historicalData.length} days of data (Confidence: ${(confidenceScore * 100).toFixed(1)}%)`,
        entryRules,
        exitRules,
        riskManagement,
        symbol, // Symbol-specific strategy
        metadata: {
          strategyType,
          confidenceScore,
          generatedAt: new Date().toISOString(),
          dataPoints: historicalData.length,
          volatility: patterns.volatility,
          trendStrength: patterns.trends.strength,
        },
      };

      return strategy;
    } catch (error) {
      console.error('Error generating AI strategy:', error);
      return this.getDefaultStrategy();
    }
  }

  private analyzePatterns(data: PriceData[]): PatternAnalysis {
    const closes = data.map(d => d.close);
    const volumes = data.map(d => d.volume);
    const volatility = this.calculateVolatility(closes);
    const trends = this.identifyTrends(closes);
    const seasonality = this.detectSeasonality(data);
    
    return {
      volatility,
      trends,
      seasonality,
      averageVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
      priceRange: {
        min: Math.min(...closes),
        max: Math.max(...closes),
        average: closes.reduce((a, b) => a + b, 0) / closes.length,
      },
    };
  }

  private generateEntryRules(patterns: PatternAnalysis): StrategyRule[] {
    const rules: StrategyRule[] = [];
    
    // High volatility environment - use RSI for mean reversion
    if (patterns.volatility > 0.3) {
      rules.push({
        indicator: 'rsi',
        condition: 'less_than',
        value: 25,
      });
    } else {
      // Low volatility - use trend following
      rules.push({
        indicator: 'price',
        condition: 'greater_than',
        value: patterns.priceRange.average,
      });
    }

    // Volume confirmation
    if (patterns.averageVolume > 0) {
      rules.push({
        indicator: 'volume',
        condition: 'greater_than',
        value: patterns.averageVolume * 1.2,
      });
    }

    // Trend following component
    if (patterns.trends.strength > 0.6) {
      if (patterns.trends.direction === 'up') {
        rules.push({
          indicator: 'sma20',
          condition: 'greater_than',
          value: 0, // This would be compared to SMA50 in real implementation
        });
      }
    }

    return rules;
  }

  private generateExitRules(patterns: PatternAnalysis): StrategyRule[] {
    const rules: StrategyRule[] = [];
    
    // High volatility - quick exits
    if (patterns.volatility > 0.3) {
      rules.push({
        indicator: 'rsi',
        condition: 'greater_than',
        value: 75,
      });
    } else {
      // Low volatility - let profits run
      rules.push({
        indicator: 'rsi',
        condition: 'greater_than',
        value: 80,
      });
    }

    // MACD exit signal
    rules.push({
      indicator: 'macd',
      condition: 'less_than',
      value: 0,
    });

    return rules;
  }

  private generateRiskManagement(data: PriceData[]): Strategy['riskManagement'] {
    const volatility = this.calculateVolatility(data.map(d => d.close));
    
    let stopLoss: number;
    let takeProfit: number;
    let positionSize: number;
    
    // Adjust parameters based on volatility and risk tolerance
    switch (this.config.riskTolerance) {
      case 'low':
        stopLoss = Math.max(2, volatility * 100);
        takeProfit = stopLoss * 2;
        positionSize = 5;
        break;
      case 'medium':
        stopLoss = Math.max(3, volatility * 150);
        takeProfit = stopLoss * 2.5;
        positionSize = 10;
        break;
      case 'high':
        stopLoss = Math.max(5, volatility * 200);
        takeProfit = stopLoss * 3;
        positionSize = 15;
        break;
    }

    return {
      stopLoss,
      takeProfit,
      positionSize,
      maxPositions: this.config.tradingStyle === 'aggressive' ? 5 : 3,
    };
  }

  private calculateVolatility(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized volatility
  }

  private identifyTrends(prices: number[]): TrendAnalysis {
    const period = Math.min(20, prices.length);
    const recent = prices.slice(-period);
    const earlier = prices.slice(-period * 2, -period);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;
    
    const direction = recentAvg > earlierAvg ? 'up' : 'down';
    const strength = Math.abs(recentAvg - earlierAvg) / earlierAvg;
    
    return { direction, strength };
  }

  private detectSeasonality(data: PriceData[]): SeasonalityAnalysis {
    // Simplified seasonality detection
    const monthlyReturns = new Map<number, number[]>();
    
    for (let i = 1; i < data.length; i++) {
      const date = new Date(data[i].date);
      const month = date.getMonth();
      const returnPct = (data[i].close - data[i - 1].close) / data[i - 1].close;
      
      if (!monthlyReturns.has(month)) {
        monthlyReturns.set(month, []);
      }
      monthlyReturns.get(month)!.push(returnPct);
    }
    
    const monthlyAverages = new Map<number, number>();
    for (const [month, returns] of monthlyReturns) {
      const avg = returns.reduce((a, b) => a + b, 0) / returns.length;
      monthlyAverages.set(month, avg);
    }
    
    // Find best and worst months
    let bestMonth = 0;
    let worstMonth = 0;
    let bestReturn = -Infinity;
    let worstReturn = Infinity;
    
    for (const [month, avg] of monthlyAverages) {
      if (avg > bestReturn) {
        bestReturn = avg;
        bestMonth = month;
      }
      if (avg < worstReturn) {
        worstReturn = avg;
        worstMonth = month;
      }
    }
    
    return {
      bestMonth,
      worstMonth,
      monthlyAverages: Object.fromEntries(monthlyAverages),
    };
  }

  async analyzeMarketCondition(data: PriceData[]): Promise<AIAnalysisResult> {
    try {
      const patterns = this.analyzePatterns(data);
      const strategy = await this.generateStrategy(data, 'MARKET');
      
      // Predict market direction
      const prediction = this.predictMarketDirection(data, patterns);
      
      // Generate recommendations
      const recommendations = this.generateRecommendations(patterns, prediction);
      
      return {
        prediction,
        recommendations,
        strategy,
      };
    } catch (error) {
      console.error('Error analyzing market condition:', error);
      return this.getDefaultAnalysis();
    }
  }

  private predictMarketDirection(data: PriceData[], patterns: PatternAnalysis): AIAnalysisResult['prediction'] {
    const closes = data.map(d => d.close);
    const recentTrend = this.identifyTrends(closes.slice(-30));
    const momentum = this.calculateMomentum(closes);
    
    let direction: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    let confidence = 0.5;
    
    // Simple prediction logic (in production, use ML models)
    if (recentTrend.direction === 'up' && momentum > 0.02) {
      direction = 'bullish';
      confidence = Math.min(0.8, 0.5 + recentTrend.strength);
    } else if (recentTrend.direction === 'down' && momentum < -0.02) {
      direction = 'bearish';
      confidence = Math.min(0.8, 0.5 + recentTrend.strength);
    }
    
    return {
      direction,
      confidence,
      timeHorizon: 5, // 5 days
      expectedReturn: momentum * 100,
    };
  }

  private calculateMomentum(prices: number[]): number {
    if (prices.length < 10) return 0;
    
    const recent = prices.slice(-5);
    const previous = prices.slice(-10, -5);
    
    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const previousAvg = previous.reduce((a, b) => a + b, 0) / previous.length;
    
    return (recentAvg - previousAvg) / previousAvg;
  }

  private generateRecommendations(patterns: PatternAnalysis, prediction: AIAnalysisResult['prediction']): AIAnalysisResult['recommendations'] {
    const reasoning: string[] = [];
    let action: 'buy' | 'sell' | 'hold' = 'hold';
    let riskLevel = 0.5;
    
    // Risk assessment
    if (patterns.volatility > 0.4) {
      reasoning.push('High volatility detected - increased risk');
      riskLevel += 0.2;
    }
    
    if (patterns.trends.strength > 0.6) {
      reasoning.push(`Strong ${patterns.trends.direction}ward trend identified`);
      if (patterns.trends.direction === 'up') {
        action = 'buy';
      } else {
        action = 'sell';
      }
    }
    
    // Prediction-based recommendations
    if (prediction.confidence > 0.7) {
      if (prediction.direction === 'bullish') {
        action = 'buy';
        reasoning.push(`Strong bullish prediction (${(prediction.confidence * 100).toFixed(1)}% confidence)`);
      } else if (prediction.direction === 'bearish') {
        action = 'sell';
        reasoning.push(`Strong bearish prediction (${(prediction.confidence * 100).toFixed(1)}% confidence)`);
      }
    }
    
    return {
      action,
      reasoning,
      riskLevel: Math.min(1, riskLevel),
    };
  }

  private getDefaultStrategy(): Strategy {
    return {
      name: 'Default Conservative Strategy',
      description: 'Conservative strategy with basic risk management',
      entryRules: [
        { indicator: 'rsi', condition: 'less_than', value: 30 },
      ],
      exitRules: [
        { indicator: 'rsi', condition: 'greater_than', value: 70 },
      ],
      riskManagement: {
        stopLoss: 3,
        takeProfit: 6,
        positionSize: 5,
        maxPositions: 2,
      },
    };
  }

  private getDefaultAnalysis(): AIAnalysisResult {
    return {
      prediction: {
        direction: 'neutral',
        confidence: 0.5,
        timeHorizon: 5,
        expectedReturn: 0,
      },
      recommendations: {
        action: 'hold',
        reasoning: ['Insufficient data for analysis'],
        riskLevel: 0.5,
      },
      strategy: this.getDefaultStrategy(),
    };
  }

  // Advanced entry rules generation with symbol-specific logic
  private generateAdvancedEntryRules(patterns: PatternAnalysis, symbol: string): StrategyRule[] {
    const rules: StrategyRule[] = [];
    
    // Symbol-specific adjustments
    const isStock = /^[A-Z]{1,5}$/.test(symbol);
    const isCrypto = !isStock;
    
    // Volatility-based entry strategy
    if (patterns.volatility > 0.4) {
      // High volatility - mean reversion with multiple confirmations
      rules.push({
        indicator: 'rsi',
        condition: 'less_than',
        value: isCrypto ? 20 : 25, // Crypto markets are more volatile
      });
      
      // Volume spike confirmation
      rules.push({
        indicator: 'volume',
        condition: 'greater_than',
        value: patterns.averageVolume * (isCrypto ? 1.5 : 1.2),
      });
      
    } else if (patterns.volatility < 0.2) {
      // Low volatility - breakout strategy
      rules.push({
        indicator: 'price',
        condition: 'greater_than',
        value: patterns.priceRange.max * 0.98, // Near resistance
      });
      
      rules.push({
        indicator: 'sma20',
        condition: 'greater_than',
        value: 0, // Price above SMA20
      });
      
    } else {
      // Medium volatility - trend following
      if (patterns.trends.strength > 0.5) {
        if (patterns.trends.direction === 'up') {
          rules.push({
            indicator: 'macd',
            condition: 'greater_than',
            value: 0,
          });
          
          rules.push({
            indicator: 'rsi',
            condition: 'greater_than',
            value: 50,
          });
        }
      }
    }
    
    // Seasonality consideration
    const currentMonth = new Date().getMonth();
    if (patterns.seasonality.bestMonth === currentMonth) {
      // More aggressive during best month
      rules.push({
        indicator: 'volume',
        condition: 'greater_than',
        value: patterns.averageVolume * 1.1,
      });
    }
    
    return rules.length > 0 ? rules : this.generateEntryRules(patterns);
  }

  // Advanced exit rules with symbol-specific logic
  private generateAdvancedExitRules(patterns: PatternAnalysis, symbol: string): StrategyRule[] {
    const rules: StrategyRule[] = [];
    
    const isStock = /^[A-Z]{1,5}$/.test(symbol);
    const isCrypto = !isStock;
    
    // Volatility-based exit strategy
    if (patterns.volatility > 0.4) {
      // High volatility - quick exits
      rules.push({
        indicator: 'rsi',
        condition: 'greater_than',
        value: isCrypto ? 75 : 70,
      });
      
      // Momentum reversal
      rules.push({
        indicator: 'macd',
        condition: 'less_than',
        value: 0,
      });
      
    } else {
      // Low volatility - let profits run
      rules.push({
        indicator: 'rsi',
        condition: 'greater_than',
        value: isCrypto ? 80 : 75,
      });
      
      // Trail with moving average
      rules.push({
        indicator: 'sma20',
        condition: 'less_than',
        value: 0, // Price below SMA20
      });
    }
    
    return rules.length > 0 ? rules : this.generateExitRules(patterns);
  }

  // Advanced risk management with symbol-specific adjustments
  private generateAdvancedRiskManagement(data: PriceData[], symbol: string): Strategy['riskManagement'] {
    const volatility = this.calculateVolatility(data.map(d => d.close));
    const isStock = /^[A-Z]{1,5}$/.test(symbol);
    const isCrypto = !isStock;
    
    let stopLoss: number;
    let takeProfit: number;
    let positionSize: number;
    
    // Base adjustments for asset type
    const volatilityMultiplier = isCrypto ? 1.5 : 1.0;
    const baseVolatility = volatility * volatilityMultiplier;
    
    // Adjust parameters based on risk tolerance and volatility
    switch (this.config.riskTolerance) {
      case 'low':
        stopLoss = Math.max(isCrypto ? 3 : 2, baseVolatility * 100);
        takeProfit = stopLoss * 2;
        positionSize = isCrypto ? 3 : 5;
        break;
      case 'medium':
        stopLoss = Math.max(isCrypto ? 5 : 3, baseVolatility * 150);
        takeProfit = stopLoss * 2.5;
        positionSize = isCrypto ? 5 : 10;
        break;
      case 'high':
        stopLoss = Math.max(isCrypto ? 8 : 5, baseVolatility * 200);
        takeProfit = stopLoss * 3;
        positionSize = isCrypto ? 8 : 15;
        break;
    }

    return {
      stopLoss,
      takeProfit,
      positionSize,
      maxPositions: this.config.tradingStyle === 'aggressive' ? 5 : 3,
    };
  }

  // Determine strategy type based on patterns
  private determineStrategyType(patterns: PatternAnalysis): string {
    if (patterns.volatility > 0.4) {
      return 'Mean Reversion';
    } else if (patterns.volatility < 0.2) {
      return 'Breakout';
    } else if (patterns.trends.strength > 0.6) {
      return 'Trend Following';
    } else {
      return 'Balanced';
    }
  }

  // Calculate confidence score for the strategy
  private calculateConfidenceScore(patterns: PatternAnalysis): number {
    let score = 0.5; // Base score
    
    // Add confidence based on trend strength
    if (patterns.trends.strength > 0.7) {
      score += 0.2;
    } else if (patterns.trends.strength > 0.5) {
      score += 0.1;
    }
    
    // Add confidence based on volatility consistency
    if (patterns.volatility > 0.1 && patterns.volatility < 0.5) {
      score += 0.1; // Good volatility range
    } else if (patterns.volatility > 0.5) {
      score -= 0.1; // Too volatile
    }
    
    // Add confidence based on volume patterns
    if (patterns.averageVolume > 0) {
      score += 0.1;
    }
    
    // Seasonality bonus
    const currentMonth = new Date().getMonth();
    if (patterns.seasonality.bestMonth === currentMonth) {
      score += 0.1;
    }
    
    return Math.max(0.1, Math.min(0.9, score));
  }
}

interface PatternAnalysis {
  volatility: number;
  trends: TrendAnalysis;
  seasonality: SeasonalityAnalysis;
  averageVolume: number;
  priceRange: {
    min: number;
    max: number;
    average: number;
  };
}

interface TrendAnalysis {
  direction: 'up' | 'down';
  strength: number;
}

interface SeasonalityAnalysis {
  bestMonth: number;
  worstMonth: number;
  monthlyAverages: { [month: number]: number };
}

// Pre-configured AI strategy generators
export const createConservativeAI = (): AIStrategyGenerator => {
  return new AIStrategyGenerator({
    lookbackPeriod: 50,
    riskTolerance: 'low',
    tradingStyle: 'conservative',
    preferredIndicators: ['rsi', 'sma20', 'sma50'],
  });
};

export const createAggressiveAI = (): AIStrategyGenerator => {
  return new AIStrategyGenerator({
    lookbackPeriod: 30,
    riskTolerance: 'high',
    tradingStyle: 'aggressive',
    preferredIndicators: ['macd', 'rsi', 'volume'],
  });
};

export const createBalancedAI = (): AIStrategyGenerator => {
  return new AIStrategyGenerator({
    lookbackPeriod: 40,
    riskTolerance: 'medium',
    tradingStyle: 'balanced',
    preferredIndicators: ['rsi', 'macd', 'sma20', 'volume'],
  });
};

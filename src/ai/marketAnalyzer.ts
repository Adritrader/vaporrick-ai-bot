import { fetchHistoricalData, fetchMultipleAssets } from '../services/marketDataService';
import { calculateSMA, calculateRSI, calculateMACD } from '../utils/technicalIndicators';

export interface TradingStrategy {
  id: string;
  name: string;
  description: string;
  type: 'momentum' | 'reversal' | 'breakout' | 'scalping' | 'swing';
  conditions: {
    rsiLower: number;
    rsiUpper: number;
    smaShort: number;
    smaLong: number;
    macdThreshold: number;
    volumeMultiplier: number;
  };
  riskManagement: {
    stopLossPercent: number;
    takeProfitPercent: number;
    maxPositionSize: number;
  };
  performance: {
    totalTrades: number;
    winRate: number;
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    lastBacktest: Date;
  };
  aiVersion: number;
  riskLevel?: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export interface StrategyBacktestResult {
  strategyId: string;
  symbol: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  trades: BacktestTrade[];
  metrics: {
    winRate: number;
    profitFactor: number;
    maxDrawdown: number;
    sharpeRatio: number;
    averageReturn: number;
  };
  equity: Array<{
    date: string;
    value: number;
    drawdown: number;
  }>;
}

export interface BacktestTrade {
  id: string;
  entryDate: Date;
  exitDate?: Date;
  entryPrice: number;
  exitPrice?: number;
  quantity: number;
  type: 'buy' | 'sell';
  status: 'open' | 'closed';
  pnl?: number;
  pnlPercent?: number;
  reason: string;
}

export interface MarketOpportunity {
  id: string;
  symbol: string;
  assetType: 'stock' | 'crypto';
  opportunity: 'bullish' | 'bearish' | 'breakout' | 'reversal';
  confidence: number; // 0-100
  predictedChange: number; // Percentage
  timeframe: string; // "2 weeks", "1 month", etc.
  analysis: string;
  indicators: {
    rsi: number;
    sma20: number;
    sma50: number;
    macd: number;
    volume: number;
    support: number;
    resistance: number;
  };
  reasoning: string[];
  discoveredAt: Date;
  expiresAt: Date;
}

export interface MarketScanResults {
  opportunities: MarketOpportunity[];
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  topMovers: Array<{
    symbol: string;
    change: number;
    analysis: string;
  }>;
  scanTime: Date;
}

class MarketAnalyzer {
  private readonly SYMBOLS_TO_SCAN = [
    // Stocks
    { symbol: 'AAPL', type: 'stock' },
    { symbol: 'GOOGL', type: 'stock' },
    { symbol: 'MSFT', type: 'stock' },
    { symbol: 'TSLA', type: 'stock' },
    { symbol: 'AMZN', type: 'stock' },
    { symbol: 'NVDA', type: 'stock' },
    { symbol: 'META', type: 'stock' },
    { symbol: 'NFLX', type: 'stock' },
    // Crypto
    { symbol: 'BTC', type: 'crypto' },
    { symbol: 'ETH', type: 'crypto' },
    { symbol: 'BNB', type: 'crypto' },
    { symbol: 'SOL', type: 'crypto' },
    { symbol: 'ADA', type: 'crypto' },
    { symbol: 'DOT', type: 'crypto' },
  ];

  async scanMarket(): Promise<MarketScanResults> {
    console.log('🔍 Starting AI-powered market scan...');
    
    const opportunities: MarketOpportunity[] = [];
    const topMovers: Array<{ symbol: string; change: number; analysis: string }> = [];
    
    // Scan each symbol
    for (const asset of this.SYMBOLS_TO_SCAN) {
      try {
        // Fetch historical data for change calculation
        const historicalData = await fetchHistoricalData(asset.symbol, asset.type as 'stock' | 'crypto', '7d');
        
        const opportunity = await this.analyzeAsset(asset.symbol, asset.type as 'stock' | 'crypto');
        if (opportunity) {
          opportunities.push(opportunity);
        }

        // Calculate current price change
        if (historicalData.length > 1) {
          const prices = historicalData.map(d => d.close);
          const currentChange = ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100;
          
          if (Math.abs(currentChange) > 3) {
            topMovers.push({
              symbol: asset.symbol,
              change: currentChange,
              analysis: this.generateMoveAnalysis(currentChange, asset.symbol),
            });
          }
        }
      } catch (error) {
        console.log(`Error analyzing ${asset.symbol}:`, error);
      }
    }

    // Sort opportunities by confidence
    opportunities.sort((a, b) => b.confidence - a.confidence);
    
    // Calculate overall market sentiment
    const marketSentiment = this.calculateMarketSentiment(opportunities, topMovers);

    return {
      opportunities: opportunities.slice(0, 10), // Top 10 opportunities
      marketSentiment,
      topMovers: topMovers.slice(0, 5),
      scanTime: new Date(),
    };
  }

  private async analyzeAsset(symbol: string, type: 'stock' | 'crypto'): Promise<MarketOpportunity | null> {
    try {
      // Fetch historical data (90 days)
      const historicalData = await fetchHistoricalData(symbol, type, '90d');
      
      if (historicalData.length < 50) {
        return null; // Not enough data
      }

      const prices = historicalData.map(d => d.close);
      const volumes = historicalData.map(d => d.volume);
      
      // Calculate technical indicators
      const sma20 = calculateSMA(prices, 20);
      const sma50 = calculateSMA(prices, 50);
      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices);
      
      const currentPrice = prices[prices.length - 1];
      const currentSMA20 = sma20[sma20.length - 1];
      const currentSMA50 = sma50[sma50.length - 1];
      const currentRSI = rsi[rsi.length - 1];
      const currentMACD = macd.histogram[macd.histogram.length - 1];
      
      // Find support and resistance levels
      const { support, resistance } = this.findSupportResistance(prices);
      
      // AI Analysis
      const analysis = this.performAIAnalysis({
        symbol,
        currentPrice,
        sma20: currentSMA20,
        sma50: currentSMA50,
        rsi: currentRSI,
        macd: currentMACD,
        support,
        resistance,
        volume: volumes[volumes.length - 1],
        avgVolume: volumes.slice(-20).reduce((a, b) => a + b, 0) / 20,
        priceHistory: prices.slice(-30), // Last 30 days
      });

      if (analysis.confidence > 65) { // Only high-confidence opportunities
        return {
          id: `${symbol}-${Date.now()}`,
          symbol,
          assetType: type,
          opportunity: analysis.opportunity,
          confidence: analysis.confidence,
          predictedChange: analysis.predictedChange,
          timeframe: analysis.timeframe,
          analysis: analysis.summary,
          indicators: {
            rsi: currentRSI,
            sma20: currentSMA20,
            sma50: currentSMA50,
            macd: currentMACD,
            volume: volumes[volumes.length - 1],
            support,
            resistance,
          },
          reasoning: analysis.reasoning,
          discoveredAt: new Date(),
          expiresAt: new Date(Date.now() + (analysis.timeframeDays * 24 * 60 * 60 * 1000)),
        };
      }

      return null;
    } catch (error) {
      console.error(`Error analyzing ${symbol}:`, error);
      return null;
    }
  }

  private performAIAnalysis(data: {
    symbol: string;
    currentPrice: number;
    sma20: number;
    sma50: number;
    rsi: number;
    macd: number;
    support: number;
    resistance: number;
    volume: number;
    avgVolume: number;
    priceHistory: number[];
  }) {
    const {
      symbol,
      currentPrice,
      sma20,
      sma50,
      rsi,
      macd,
      support,
      resistance,
      volume,
      avgVolume,
      priceHistory,
    } = data;

    let confidence = 50;
    let opportunity: 'bullish' | 'bearish' | 'breakout' | 'reversal' = 'bullish';
    let predictedChange = 0;
    let timeframe = '2 weeks';
    let timeframeDays = 14;
    const reasoning: string[] = [];

    // Technical Analysis Rules

    // 1. Moving Average Analysis
    if (currentPrice > sma20 && sma20 > sma50) {
      confidence += 15;
      reasoning.push('Price above SMA20 and SMA50 - uptrend confirmed');
      opportunity = 'bullish';
      predictedChange += 8;
    } else if (currentPrice < sma20 && sma20 < sma50) {
      confidence += 12;
      reasoning.push('Price below SMA20 and SMA50 - downtrend confirmed');
      opportunity = 'bearish';
      predictedChange -= 6;
    }

    // 2. RSI Analysis
    if (rsi < 30) {
      confidence += 20;
      reasoning.push('RSI oversold (< 30) - potential reversal');
      opportunity = 'reversal';
      predictedChange += 12;
    } else if (rsi > 70) {
      confidence += 15;
      reasoning.push('RSI overbought (> 70) - potential correction');
      opportunity = 'bearish';
      predictedChange -= 8;
    } else if (rsi > 50 && rsi < 60) {
      confidence += 10;
      reasoning.push('RSI in bullish zone (50-60)');
      predictedChange += 5;
    }

    // 3. MACD Analysis
    if (macd > 0) {
      confidence += 12;
      reasoning.push('MACD histogram positive - momentum building');
      predictedChange += 6;
    } else if (macd < 0) {
      confidence += 8;
      reasoning.push('MACD histogram negative - selling pressure');
      predictedChange -= 4;
    }

    // 4. Support/Resistance Analysis
    const distanceToSupport = (currentPrice - support) / support;
    const distanceToResistance = (resistance - currentPrice) / currentPrice;

    if (distanceToSupport < 0.02) { // Within 2% of support
      confidence += 18;
      reasoning.push('Price near strong support level - bounce expected');
      opportunity = 'reversal';
      predictedChange += 10;
    } else if (distanceToResistance < 0.02) { // Within 2% of resistance
      confidence += 15;
      reasoning.push('Price near resistance - potential breakout or rejection');
      if (volume > avgVolume * 1.5) {
        opportunity = 'breakout';
        predictedChange += 15;
        reasoning.push('High volume suggests breakout likely');
      } else {
        opportunity = 'bearish';
        predictedChange -= 5;
      }
    }

    // 5. Volume Analysis
    if (volume > avgVolume * 2) {
      confidence += 15;
      reasoning.push('Exceptionally high volume - strong conviction');
      predictedChange *= 1.3;
    } else if (volume > avgVolume * 1.5) {
      confidence += 10;
      reasoning.push('Above average volume - increased interest');
      predictedChange *= 1.15;
    }

    // 6. Momentum Analysis
    const recentChange = (currentPrice - priceHistory[0]) / priceHistory[0] * 100;
    if (Math.abs(recentChange) > 10) {
      confidence += 12;
      reasoning.push(`Strong momentum: ${recentChange.toFixed(1)}% in 30 days`);
      if (recentChange > 0) {
        predictedChange += 8;
        timeframe = '3 weeks';
        timeframeDays = 21;
      } else {
        predictedChange -= 6;
      }
    }

    // 7. Pattern Recognition (Simplified)
    const last5Prices = priceHistory.slice(-5);
    const isUptrend = last5Prices.every((price, i) => i === 0 || price >= last5Prices[i - 1]);
    const isDowntrend = last5Prices.every((price, i) => i === 0 || price <= last5Prices[i - 1]);

    if (isUptrend) {
      confidence += 10;
      reasoning.push('Consistent uptrend in last 5 days');
      predictedChange += 5;
    } else if (isDowntrend) {
      confidence += 8;
      reasoning.push('Consistent downtrend in last 5 days');
      predictedChange -= 4;
    }

    // 8. Crypto-specific adjustments
    if (symbol === 'BTC' || symbol === 'ETH') {
      // Bitcoin and Ethereum tend to have higher volatility
      predictedChange *= 1.2;
      if (confidence > 75) {
        reasoning.push('Major crypto with strong technical setup');
      }
    }

    // Ensure confidence is within bounds
    confidence = Math.min(Math.max(confidence, 0), 95);
    
    // Adjust timeframe based on confidence
    if (confidence > 80) {
      timeframe = '1-2 weeks';
      timeframeDays = 10;
    } else if (confidence > 70) {
      timeframe = '2-3 weeks';
      timeframeDays = 18;
    } else {
      timeframe = '3-4 weeks';
      timeframeDays = 25;
    }

    // Generate summary
    const direction = predictedChange > 0 ? 'upward' : 'downward';
    const magnitude = Math.abs(predictedChange);
    const summary = `${symbol} shows ${confidence}% confidence for ${direction} movement of ${magnitude.toFixed(1)}% over ${timeframe}`;

    return {
      opportunity,
      confidence: Math.round(confidence),
      predictedChange: Math.round(predictedChange * 100) / 100,
      timeframe,
      timeframeDays,
      summary,
      reasoning,
    };
  }

  private findSupportResistance(prices: number[]): { support: number; resistance: number } {
    // Simplified support/resistance calculation
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const len = sortedPrices.length;
    
    // Support: 20th percentile
    const support = sortedPrices[Math.floor(len * 0.2)];
    
    // Resistance: 80th percentile
    const resistance = sortedPrices[Math.floor(len * 0.8)];
    
    return { support, resistance };
  }

  private calculateMarketSentiment(
    opportunities: MarketOpportunity[],
    topMovers: Array<{ symbol: string; change: number; analysis: string }>
  ): 'bullish' | 'bearish' | 'neutral' {
    let bullishScore = 0;
    let bearishScore = 0;

    // Score based on opportunities
    opportunities.forEach(opp => {
      const weight = opp.confidence / 100;
      if (opp.opportunity === 'bullish' || opp.opportunity === 'breakout') {
        bullishScore += weight * Math.abs(opp.predictedChange);
      } else if (opp.opportunity === 'bearish') {
        bearishScore += weight * Math.abs(opp.predictedChange);
      }
    });

    // Score based on top movers
    topMovers.forEach(mover => {
      if (mover.change > 0) {
        bullishScore += mover.change;
      } else {
        bearishScore += Math.abs(mover.change);
      }
    });

    const diff = bullishScore - bearishScore;
    const threshold = Math.max(bullishScore, bearishScore) * 0.2;

    if (diff > threshold) return 'bullish';
    if (diff < -threshold) return 'bearish';
    return 'neutral';
  }

  private generateMoveAnalysis(change: number, symbol: string): string {
    const direction = change > 0 ? 'surge' : 'decline';
    const magnitude = Math.abs(change);
    
    if (magnitude > 10) {
      return `${symbol} experiencing significant ${direction} of ${magnitude.toFixed(1)}% - investigate fundamental catalysts`;
    } else if (magnitude > 5) {
      return `${symbol} showing strong ${direction} of ${magnitude.toFixed(1)}% - monitor for continuation`;
    } else {
      return `${symbol} moderate ${direction} of ${magnitude.toFixed(1)}% - normal market movement`;
    }
  }

  // Strategy Management
  async createAIStrategy(
    type: 'momentum' | 'reversal' | 'breakout' | 'scalping' | 'swing',
    riskLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<TradingStrategy> {
    // Risk multipliers for different levels
    const riskMultipliers = {
      low: { stop: 0.7, profit: 0.8, position: 0.6 },
      medium: { stop: 1.0, profit: 1.0, position: 1.0 },
      high: { stop: 1.4, profit: 1.5, position: 1.5 },
    };
    
    const multiplier = riskMultipliers[riskLevel];
    const baseStrategies = {
      momentum: {
        name: 'AI Momentum Trader',
        description: 'Follows strong price trends with momentum indicators',
        conditions: {
          rsiLower: 40,
          rsiUpper: 60,
          smaShort: 10,
          smaLong: 30,
          macdThreshold: 0.1,
          volumeMultiplier: 1.5,
        },
        riskManagement: {
          stopLossPercent: 3,
          takeProfitPercent: 8,
          maxPositionSize: 0.1,
        },
      },
      reversal: {
        name: 'AI Mean Reversion',
        description: 'Identifies oversold/overbought conditions for reversals',
        conditions: {
          rsiLower: 25,
          rsiUpper: 75,
          smaShort: 5,
          smaLong: 20,
          macdThreshold: -0.1,
          volumeMultiplier: 1.2,
        },
        riskManagement: {
          stopLossPercent: 2,
          takeProfitPercent: 5,
          maxPositionSize: 0.15,
        },
      },
      breakout: {
        name: 'AI Breakout Hunter',
        description: 'Detects price breakouts from consolidation patterns',
        conditions: {
          rsiLower: 50,
          rsiUpper: 70,
          smaShort: 20,
          smaLong: 50,
          macdThreshold: 0.05,
          volumeMultiplier: 2.0,
        },
        riskManagement: {
          stopLossPercent: 2.5,
          takeProfitPercent: 10,
          maxPositionSize: 0.08,
        },
      },
      scalping: {
        name: 'AI Scalper Pro',
        description: 'High-frequency small profit trades',
        conditions: {
          rsiLower: 35,
          rsiUpper: 65,
          smaShort: 5,
          smaLong: 15,
          macdThreshold: 0.02,
          volumeMultiplier: 1.8,
        },
        riskManagement: {
          stopLossPercent: 1,
          takeProfitPercent: 2,
          maxPositionSize: 0.2,
        },
      },
      swing: {
        name: 'AI Swing Trader',
        description: 'Medium-term position trading based on market swings',
        conditions: {
          rsiLower: 30,
          rsiUpper: 70,
          smaShort: 20,
          smaLong: 60,
          macdThreshold: 0.0,
          volumeMultiplier: 1.3,
        },
        riskManagement: {
          stopLossPercent: 4,
          takeProfitPercent: 12,
          maxPositionSize: 0.05,
        },
      },
    };

    const base = baseStrategies[type];
    
    // Apply risk level adjustments
    const adjustedRiskManagement = {
      stopLossPercent: Math.round(base.riskManagement.stopLossPercent * multiplier.stop * 10) / 10,
      takeProfitPercent: Math.round(base.riskManagement.takeProfitPercent * multiplier.profit * 10) / 10,
      maxPositionSize: Math.round(base.riskManagement.maxPositionSize * multiplier.position * 100) / 100,
    };
    
    return {
      id: `strategy-${type}-${riskLevel}-${Date.now()}`,
      name: `${base.name} (${riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk)`,
      description: `${base.description} - Configured for ${riskLevel} risk tolerance`,
      type,
      conditions: base.conditions,
      riskManagement: adjustedRiskManagement,
      performance: {
        totalTrades: 0,
        winRate: 0,
        totalReturn: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        lastBacktest: new Date(),
      },
      aiVersion: 1,
      riskLevel,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async optimizeStrategy(strategy: TradingStrategy, symbols: string[]): Promise<TradingStrategy> {
    console.log(`🤖 Optimizing strategy ${strategy.name} with AI...`);
    
    // Simulate AI optimization by testing different parameter combinations
    const optimizationResults: { params: any; score: number }[] = [];
    
    // Test variations of current parameters
    const variations = [
      { rsiLower: strategy.conditions.rsiLower - 5, rsiUpper: strategy.conditions.rsiUpper + 5 },
      { rsiLower: strategy.conditions.rsiLower + 5, rsiUpper: strategy.conditions.rsiUpper - 5 },
      { smaShort: strategy.conditions.smaShort + 2, smaLong: strategy.conditions.smaLong + 5 },
      { macdThreshold: strategy.conditions.macdThreshold * 1.2 },
      { volumeMultiplier: strategy.conditions.volumeMultiplier * 1.1 },
    ];

    for (const variation of variations) {
      const testStrategy = {
        ...strategy,
        conditions: { ...strategy.conditions, ...variation },
      };
      
      // Run quick backtest simulation
      const score = await this.quickBacktestScore(testStrategy, symbols[0]);
      optimizationResults.push({ params: variation, score });
    }

    // Find best performing variation
    const bestResult = optimizationResults.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    // Apply optimization if better than current
    if (bestResult.score > strategy.performance.totalReturn) {
      const optimizedStrategy = {
        ...strategy,
        conditions: { ...strategy.conditions, ...bestResult.params },
        aiVersion: strategy.aiVersion + 1,
        updatedAt: new Date(),
      };
      
      console.log(`✅ Strategy optimized! New score: ${bestResult.score.toFixed(2)}%`);
      return optimizedStrategy;
    }

    console.log(`📊 No improvement found. Current strategy performs best.`);
    return strategy;
  }

  private async quickBacktestScore(strategy: TradingStrategy, symbol: string): Promise<number> {
    // Simplified backtest for optimization
    try {
      const historicalData = await fetchHistoricalData(symbol, 'stock', '30d');
      if (historicalData.length < 20) return -10; // Penalty for insufficient data

      // Calculate simple moving averages and RSI
      const prices = historicalData.map(d => d.close);
      const smaShort = calculateSMA(prices, strategy.conditions.smaShort);
      const smaLong = calculateSMA(prices, strategy.conditions.smaLong);
      const rsi = calculateRSI(prices, 14);

      let totalReturn = 0;
      let trades = 0;
      let inPosition = false;
      let entryPrice = 0;

      for (let i = Math.max(strategy.conditions.smaLong, 14); i < prices.length; i++) {
        const currentPrice = prices[i];
        const currentRSI = rsi[i - 14] || 50;
        const shortSMA = smaShort[i - strategy.conditions.smaShort] || currentPrice;
        const longSMA = smaLong[i - strategy.conditions.smaLong] || currentPrice;

        // Entry signal
        if (!inPosition) {
          const bullishSignal = currentRSI > strategy.conditions.rsiLower && 
                               currentRSI < strategy.conditions.rsiUpper &&
                               shortSMA > longSMA;
          
          if (bullishSignal) {
            inPosition = true;
            entryPrice = currentPrice;
          }
        } else {
          // Exit signal
          const exitSignal = currentRSI > strategy.conditions.rsiUpper ||
                            (currentPrice - entryPrice) / entryPrice > strategy.riskManagement.takeProfitPercent / 100 ||
                            (entryPrice - currentPrice) / entryPrice > strategy.riskManagement.stopLossPercent / 100;
          
          if (exitSignal) {
            const tradeReturn = (currentPrice - entryPrice) / entryPrice;
            totalReturn += tradeReturn;
            trades++;
            inPosition = false;
          }
        }
      }

      return trades > 0 ? (totalReturn / trades) * 100 : -5;
    } catch (error) {
      return -10; // Penalty for errors
    }
  }

  async backtestStrategy(strategy: TradingStrategy, symbol: string, days: number = 90): Promise<StrategyBacktestResult> {
    console.log(`📊 Running backtest for ${strategy.name} on ${symbol}...`);
    
    try {
      const historicalData = await fetchHistoricalData(symbol, 'stock', days > 30 ? '90d' : '30d');
      const initialCapital = 10000;
      let currentCapital = initialCapital;
      let position = 0;
      let inPosition = false;
      
      const trades: BacktestTrade[] = [];
      const equity: Array<{ date: string; value: number; drawdown: number }> = [];
      let maxEquity = initialCapital;

      // Calculate technical indicators
      const prices = historicalData.map(d => d.close);
      const volumes = historicalData.map(d => d.volume);
      const smaShort = calculateSMA(prices, strategy.conditions.smaShort);
      const smaLong = calculateSMA(prices, strategy.conditions.smaLong);
      const rsi = calculateRSI(prices, 14);
      const macd = calculateMACD(prices);

      for (let i = Math.max(strategy.conditions.smaLong, 14); i < historicalData.length; i++) {
        const dataPoint = historicalData[i];
        const currentPrice = dataPoint.close;
        const currentVolume = dataPoint.volume;
        const avgVolume = volumes.slice(Math.max(0, i - 20), i).reduce((a, b) => a + b, 0) / Math.min(20, i);
        
        const currentRSI = rsi[i - 14] || 50;
        const shortSMA = smaShort[i - strategy.conditions.smaShort] || currentPrice;
        const longSMA = smaLong[i - strategy.conditions.smaLong] || currentPrice;
        const currentMACD = macd.macd[i] || 0;

        // Calculate current portfolio value
        const portfolioValue = inPosition ? position * currentPrice : currentCapital;
        maxEquity = Math.max(maxEquity, portfolioValue);
        const drawdown = ((maxEquity - portfolioValue) / maxEquity) * 100;

        equity.push({
          date: dataPoint.date,
          value: portfolioValue,
          drawdown,
        });

        // Entry signals
        if (!inPosition) {
          let entrySignal = false;
          let entryReason = '';

          switch (strategy.type) {
            case 'momentum':
              entrySignal = currentRSI > strategy.conditions.rsiLower && 
                           currentRSI < strategy.conditions.rsiUpper &&
                           shortSMA > longSMA &&
                           currentMACD > strategy.conditions.macdThreshold &&
                           currentVolume > avgVolume * strategy.conditions.volumeMultiplier;
              entryReason = 'Momentum breakout with volume confirmation';
              break;
              
            case 'reversal':
              entrySignal = (currentRSI < strategy.conditions.rsiLower || currentRSI > strategy.conditions.rsiUpper) &&
                           currentMACD < strategy.conditions.macdThreshold;
              entryReason = 'Mean reversion from oversold/overbought levels';
              break;
              
            case 'breakout':
              entrySignal = shortSMA > longSMA &&
                           currentRSI > strategy.conditions.rsiLower &&
                           currentVolume > avgVolume * strategy.conditions.volumeMultiplier;
              entryReason = 'Price breakout with volume surge';
              break;
              
            case 'swing':
              entrySignal = currentRSI > strategy.conditions.rsiLower && 
                           currentRSI < strategy.conditions.rsiUpper &&
                           shortSMA > longSMA;
              entryReason = 'Swing trading entry signal';
              break;
              
            case 'scalping':
              entrySignal = Math.abs(currentRSI - 50) < 15 && shortSMA > longSMA;
              entryReason = 'Short-term scalping opportunity';
              break;
          }

          if (entrySignal) {
            const positionSize = currentCapital * strategy.riskManagement.maxPositionSize;
            position = Math.floor(positionSize / currentPrice);
            currentCapital -= position * currentPrice;
            inPosition = true;

            trades.push({
              id: `trade-${trades.length + 1}`,
              entryDate: new Date(dataPoint.date),
              entryPrice: currentPrice,
              quantity: position,
              type: 'buy',
              status: 'open',
              reason: entryReason,
            });
          }
        } else {
          // Exit signals
          const currentTrade = trades[trades.length - 1];
          const unrealizedPnL = (currentPrice - currentTrade.entryPrice) / currentTrade.entryPrice;
          
          let exitSignal = false;
          let exitReason = '';

          // Stop loss
          if (unrealizedPnL <= -strategy.riskManagement.stopLossPercent / 100) {
            exitSignal = true;
            exitReason = 'Stop loss triggered';
          }
          // Take profit
          else if (unrealizedPnL >= strategy.riskManagement.takeProfitPercent / 100) {
            exitSignal = true;
            exitReason = 'Take profit reached';
          }
          // Strategy-specific exits
          else {
            switch (strategy.type) {
              case 'momentum':
                if (currentRSI > strategy.conditions.rsiUpper || shortSMA < longSMA) {
                  exitSignal = true;
                  exitReason = 'Momentum weakening';
                }
                break;
              case 'reversal':
                if (currentRSI > strategy.conditions.rsiLower && currentRSI < strategy.conditions.rsiUpper) {
                  exitSignal = true;
                  exitReason = 'Mean reversion completed';
                }
                break;
              case 'scalping':
                if (Math.abs(unrealizedPnL) > 0.01) { // 1% move either way
                  exitSignal = true;
                  exitReason = 'Scalping target reached';
                }
                break;
            }
          }

          if (exitSignal) {
            const exitValue = position * currentPrice;
            currentCapital += exitValue;
            
            const pnl = exitValue - (position * currentTrade.entryPrice);
            const pnlPercent = (pnl / (position * currentTrade.entryPrice)) * 100;

            currentTrade.exitDate = new Date(dataPoint.date);
            currentTrade.exitPrice = currentPrice;
            currentTrade.status = 'closed';
            currentTrade.pnl = pnl;
            currentTrade.pnlPercent = pnlPercent;
            currentTrade.reason += ` | Exit: ${exitReason}`;

            inPosition = false;
            position = 0;
          }
        }
      }

      // Close any remaining position
      if (inPosition && trades.length > 0) {
        const lastTrade = trades[trades.length - 1];
        const lastPrice = prices[prices.length - 1];
        const exitValue = position * lastPrice;
        currentCapital += exitValue;
        
        lastTrade.exitDate = new Date(historicalData[historicalData.length - 1].date);
        lastTrade.exitPrice = lastPrice;
        lastTrade.status = 'closed';
        lastTrade.pnl = exitValue - (position * lastTrade.entryPrice);
        lastTrade.pnlPercent = (lastTrade.pnl! / (position * lastTrade.entryPrice)) * 100;
      }

      // Calculate metrics
      const closedTrades = trades.filter(t => t.status === 'closed');
      const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      
      const totalReturn = ((currentCapital - initialCapital) / initialCapital) * 100;
      const maxDrawdown = Math.max(...equity.map(e => e.drawdown));
      
      // Simple Sharpe ratio calculation
      const returns = equity.slice(1).map((e, i) => (e.value - equity[i].value) / equity[i].value);
      const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
      const returnStd = Math.sqrt(returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length);
      const sharpeRatio = returnStd > 0 ? (avgReturn / returnStd) * Math.sqrt(252) : 0;

      const profitFactor = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / 
                          Math.abs(closedTrades.filter(t => (t.pnl || 0) < 0).reduce((sum, t) => sum + (t.pnl || 0), 0)) || 1;

      return {
        strategyId: strategy.id,
        symbol,
        startDate: new Date(historicalData[0].date),
        endDate: new Date(historicalData[historicalData.length - 1].date),
        initialCapital,
        finalCapital: currentCapital,
        totalReturn,
        trades: closedTrades,
        metrics: {
          winRate,
          profitFactor,
          maxDrawdown,
          sharpeRatio,
          averageReturn: avgReturn * 100,
        },
        equity,
      };
    } catch (error) {
      console.error('Backtest error:', error);
      throw new Error(`Backtest failed: ${error}`);
    }
  }

  async getDefaultStrategies(): Promise<TradingStrategy[]> {
    return [
      await this.createAIStrategy('momentum'),
      await this.createAIStrategy('reversal'),
      await this.createAIStrategy('breakout'),
      await this.createAIStrategy('swing'),
    ];
  }

}

export const marketAnalyzer = new MarketAnalyzer();

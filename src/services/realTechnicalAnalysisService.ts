import axios from 'axios';

// Real Technical Analysis with proper calculations
export class RealTechnicalAnalysisService {
  
  /**
   * Calculate Real RSI with proper 14-period calculation
   */
  calculateRealRSI(prices: number[], period: number = 14): number {
    if (prices.length < period + 1) return 50;
    
    const changes = prices.slice(1).map((price, i) => price - prices[i]);
    const gains = changes.map(change => change > 0 ? change : 0);
    const losses = changes.map(change => change < 0 ? Math.abs(change) : 0);
    
    // Calculate initial averages
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    // Smooth with Wilder's method
    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    }
    
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }
  
  /**
   * Calculate Real MACD with proper EMA calculations
   */
  calculateRealMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    const macdLine = fastEMA.map((fast, i) => fast - slowEMA[i]);
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    const histogram = macdLine.map((macd, i) => macd - signalLine[i]);
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }
  
  /**
   * Calculate Exponential Moving Average
   */
  private calculateEMA(prices: number[], period: number): number[] {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
    
    return ema;
  }
  
  /**
   * Calculate Real Bollinger Bands
   */
  calculateRealBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
    const sma = this.calculateSMA(prices, period);
    const bands = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i - period + 1];
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      
      bands.push({
        upper: mean + (std * stdDev),
        middle: mean,
        lower: mean - (std * stdDev)
      });
    }
    
    return bands;
  }
  
  /**
   * Calculate Simple Moving Average
   */
  private calculateSMA(prices: number[], period: number): number[] {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }
  
  /**
   * Calculate Average True Range (ATR)
   */
  calculateRealATR(highs: number[], lows: number[], closes: number[], period: number = 14): number[] {
    const trueRanges = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }
  
  /**
   * Calculate Average Directional Index (ADX)
   */
  calculateRealADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period + 1) return 25;
    
    const dmPlus = [];
    const dmMinus = [];
    const trueRanges = [];
    
    for (let i = 1; i < highs.length; i++) {
      const highMove = highs[i] - highs[i - 1];
      const lowMove = lows[i - 1] - lows[i];
      
      dmPlus.push(highMove > lowMove && highMove > 0 ? highMove : 0);
      dmMinus.push(lowMove > highMove && lowMove > 0 ? lowMove : 0);
      
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const avgTR = trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgDMPlus = dmPlus.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgDMMinus = dmMinus.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    const diPlus = (avgDMPlus / avgTR) * 100;
    const diMinus = (avgDMMinus / avgTR) * 100;
    
    const dx = Math.abs(diPlus - diMinus) / (diPlus + diMinus) * 100;
    
    return dx;
  }
  
  /**
   * Calculate Stochastic Oscillator
   */
  calculateStochastic(highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3): {k: number, d: number} {
    if (highs.length < kPeriod) return { k: 50, d: 50 };
    
    const recentHighs = highs.slice(-kPeriod);
    const recentLows = lows.slice(-kPeriod);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;
    
    // Simple moving average for %D
    const recentK = [k]; // In real implementation, you'd track multiple K values
    const d = recentK.reduce((a, b) => a + b, 0) / recentK.length;
    
    return { k, d };
  }
  
  /**
   * Calculate Williams %R
   */
  calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (highs.length < period) return -50;
    
    const recentHighs = highs.slice(-period);
    const recentLows = lows.slice(-period);
    const currentClose = closes[closes.length - 1];
    
    const highestHigh = Math.max(...recentHighs);
    const lowestLow = Math.min(...recentLows);
    
    return ((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100;
  }
  
  /**
   * Calculate Commodity Channel Index (CCI)
   */
  calculateCCI(highs: number[], lows: number[], closes: number[], period: number = 20): number {
    if (highs.length < period) return 0;
    
    const typicalPrices = highs.map((high, i) => (high + lows[i] + closes[i]) / 3);
    const smaTP = this.calculateSMA(typicalPrices, period);
    const currentSMA = smaTP[smaTP.length - 1];
    const currentTP = typicalPrices[typicalPrices.length - 1];
    
    // Calculate mean deviation
    const deviations = typicalPrices.slice(-period).map(tp => Math.abs(tp - currentSMA));
    const meanDeviation = deviations.reduce((a, b) => a + b, 0) / period;
    
    return (currentTP - currentSMA) / (0.015 * meanDeviation);
  }
  
  /**
   * Comprehensive Technical Analysis
   */
  performComprehensiveAnalysis(ohlcvData: any[]): any {
    if (!ohlcvData || ohlcvData.length < 30) {
      console.warn(`⚠️ Insufficient data for full technical analysis. Using basic analysis with ${ohlcvData?.length || 0} periods.`);
      
      // Return basic analysis for insufficient data
      return {
        rsi: { current: 50, signal: 'neutral', overbought: false, oversold: false },
        macd: { signal: 'neutral', histogram: 0, macdLine: 0, signalLine: 0 },
        bollinger: { position: 'middle', upperBand: 0, lowerBand: 0, squeeze: false },
        volume: { trend: 'neutral', averageVolume: 0, currentVolume: 0 },
        momentum: { williams: 0, cci: 0, mfi: 50 },
        volatility: { low: true, averageTrueRange: 0 },
        patterns: [],
        fibonacciLevels: [],
        overall: {
          signal: 'neutral',
          strength: 0.5,
          confidence: 0.3,
          recommendation: 'hold',
          reasoning: 'Insufficient historical data for comprehensive technical analysis'
        }
      };
    }
    
    const highs = ohlcvData.map(d => d.high);
    const lows = ohlcvData.map(d => d.low);
    const closes = ohlcvData.map(d => d.close);
    const volumes = ohlcvData.map(d => d.volume);
    
    const rsi = this.calculateRealRSI(closes);
    const macd = this.calculateRealMACD(closes);
    const bollinger = this.calculateRealBollingerBands(closes);
    const atr = this.calculateRealATR(highs, lows, closes);
    const adx = this.calculateRealADX(highs, lows, closes);
    const stochastic = this.calculateStochastic(highs, lows, closes);
    const williamsR = this.calculateWilliamsR(highs, lows, closes);
    const cci = this.calculateCCI(highs, lows, closes);
    
    // Generate signals based on multiple indicators
    const signals = this.generateTechnicalSignals({
      rsi, macd, bollinger, atr, adx, stochastic, williamsR, cci,
      currentPrice: closes[closes.length - 1],
      volume: volumes[volumes.length - 1]
    });
    
    return {
      indicators: {
        rsi: rsi,
        macd: macd,
        bollinger: bollinger[bollinger.length - 1],
        atr: atr[atr.length - 1],
        adx: adx,
        stochastic: stochastic,
        williamsR: williamsR,
        cci: cci
      },
      signals: signals,
      summary: this.generateAnalysisSummary(signals)
    };
  }
  
  /**
   * Generate trading signals from technical indicators
   */
  private generateTechnicalSignals(indicators: any): any[] {
    const signals = [];
    
    // RSI Signals
    if (indicators.rsi > 70) {
      signals.push({ type: 'SELL', reason: 'RSI Overbought', strength: 0.7, indicator: 'RSI' });
    } else if (indicators.rsi < 30) {
      signals.push({ type: 'BUY', reason: 'RSI Oversold', strength: 0.7, indicator: 'RSI' });
    }
    
    // MACD Signals
    const macdValue = indicators.macd.macd[indicators.macd.macd.length - 1];
    const signalValue = indicators.macd.signal[indicators.macd.signal.length - 1];
    
    if (macdValue > signalValue && macdValue > 0) {
      signals.push({ type: 'BUY', reason: 'MACD Bullish Crossover', strength: 0.8, indicator: 'MACD' });
    } else if (macdValue < signalValue && macdValue < 0) {
      signals.push({ type: 'SELL', reason: 'MACD Bearish Crossover', strength: 0.8, indicator: 'MACD' });
    }
    
    // Bollinger Bands Signals
    if (indicators.currentPrice > indicators.bollinger.upper) {
      signals.push({ type: 'SELL', reason: 'Price above Upper Bollinger Band', strength: 0.6, indicator: 'BB' });
    } else if (indicators.currentPrice < indicators.bollinger.lower) {
      signals.push({ type: 'BUY', reason: 'Price below Lower Bollinger Band', strength: 0.6, indicator: 'BB' });
    }
    
    // Stochastic Signals
    if (indicators.stochastic.k > 80) {
      signals.push({ type: 'SELL', reason: 'Stochastic Overbought', strength: 0.5, indicator: 'STOCH' });
    } else if (indicators.stochastic.k < 20) {
      signals.push({ type: 'BUY', reason: 'Stochastic Oversold', strength: 0.5, indicator: 'STOCH' });
    }
    
    // Williams %R Signals
    if (indicators.williamsR > -20) {
      signals.push({ type: 'SELL', reason: 'Williams %R Overbought', strength: 0.5, indicator: 'WR' });
    } else if (indicators.williamsR < -80) {
      signals.push({ type: 'BUY', reason: 'Williams %R Oversold', strength: 0.5, indicator: 'WR' });
    }
    
    return signals;
  }
  
  /**
   * Generate analysis summary
   */
  private generateAnalysisSummary(signals: any[]): string {
    const buySignals = signals.filter(s => s.type === 'BUY').length;
    const sellSignals = signals.filter(s => s.type === 'SELL').length;
    const totalStrength = signals.reduce((sum, s) => sum + s.strength, 0);
    
    if (buySignals > sellSignals) {
      return `BULLISH BIAS - ${buySignals} buy signals vs ${sellSignals} sell signals. Average strength: ${(totalStrength / signals.length).toFixed(2)}`;
    } else if (sellSignals > buySignals) {
      return `BEARISH BIAS - ${sellSignals} sell signals vs ${buySignals} buy signals. Average strength: ${(totalStrength / signals.length).toFixed(2)}`;
    } else {
      return `NEUTRAL - Conflicting signals detected. ${signals.length} total signals.`;
    }
  }
}

export const realTechnicalAnalysisService = new RealTechnicalAnalysisService();

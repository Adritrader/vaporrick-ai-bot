// Technical indicators utilities
// This is a simplified version - in production, use the 'technicalindicators' library

export interface PriceData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  value: number;
  signal?: 'buy' | 'sell' | 'hold';
}

// Simple Moving Average (SMA)
export const calculateSMA = (prices: number[], period: number): number[] => {
  const sma: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
    sma.push(sum / period);
  }
  
  return sma;
};

// Exponential Moving Average (EMA)
export const calculateEMA = (prices: number[], period: number): number[] => {
  const ema: number[] = [];
  const multiplier = 2 / (period + 1);
  
  // Start with SMA for the first value
  let previousEMA = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  ema.push(previousEMA);
  
  for (let i = period; i < prices.length; i++) {
    const currentEMA = (prices[i] - previousEMA) * multiplier + previousEMA;
    ema.push(currentEMA);
    previousEMA = currentEMA;
  }
  
  return ema;
};

// Relative Strength Index (RSI)
export const calculateRSI = (prices: number[], period: number = 14): number[] => {
  const rsi: number[] = [];
  const changes: number[] = [];
  
  // Calculate price changes
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  // Calculate RSI for each period
  for (let i = period - 1; i < changes.length; i++) {
    const periodChanges = changes.slice(i - period + 1, i + 1);
    const gains = periodChanges.filter(change => change > 0);
    const losses = periodChanges.filter(change => change < 0).map(loss => Math.abs(loss));
    
    const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
    const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;
    
    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
  }
  
  return rsi;
};

// MACD (Moving Average Convergence Divergence)
export const calculateMACD = (prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) => {
  const fastEMA = calculateEMA(prices, fastPeriod);
  const slowEMA = calculateEMA(prices, slowPeriod);
  
  // Calculate MACD line
  const macdLine: number[] = [];
  const startIndex = slowPeriod - fastPeriod;
  
  for (let i = 0; i < fastEMA.length - startIndex; i++) {
    macdLine.push(fastEMA[i + startIndex] - slowEMA[i]);
  }
  
  // Calculate signal line
  const signalLine = calculateEMA(macdLine, signalPeriod);
  
  // Calculate histogram
  const histogram: number[] = [];
  const histogramStartIndex = signalPeriod - 1;
  
  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(macdLine[i + histogramStartIndex] - signalLine[i]);
  }
  
  return {
    macd: macdLine,
    signal: signalLine,
    histogram: histogram,
  };
};

// Bollinger Bands
export const calculateBollingerBands = (prices: number[], period: number = 20, multiplier: number = 2) => {
  const sma = calculateSMA(prices, period);
  const upperBand: number[] = [];
  const lowerBand: number[] = [];
  
  for (let i = period - 1; i < prices.length; i++) {
    const periodPrices = prices.slice(i - period + 1, i + 1);
    const mean = sma[i - period + 1];
    
    // Calculate standard deviation
    const squaredDiffs = periodPrices.map(price => Math.pow(price - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
    const standardDeviation = Math.sqrt(variance);
    
    upperBand.push(mean + (multiplier * standardDeviation));
    lowerBand.push(mean - (multiplier * standardDeviation));
  }
  
  return {
    upperBand,
    middleBand: sma,
    lowerBand,
  };
};

// Stochastic Oscillator
export const calculateStochastic = (highs: number[], lows: number[], closes: number[], kPeriod: number = 14, dPeriod: number = 3) => {
  const kPercent: number[] = [];
  
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const periodHighs = highs.slice(i - kPeriod + 1, i + 1);
    const periodLows = lows.slice(i - kPeriod + 1, i + 1);
    
    const highestHigh = Math.max(...periodHighs);
    const lowestLow = Math.min(...periodLows);
    
    const k = ((closes[i] - lowestLow) / (highestHigh - lowestLow)) * 100;
    kPercent.push(k);
  }
  
  const dPercent = calculateSMA(kPercent, dPeriod);
  
  return {
    k: kPercent,
    d: dPercent,
  };
};

// Support and Resistance levels
export const findSupportResistance = (prices: number[], window: number = 10): { support: number[]; resistance: number[] } => {
  const support: number[] = [];
  const resistance: number[] = [];
  
  for (let i = window; i < prices.length - window; i++) {
    const currentPrice = prices[i];
    const leftPrices = prices.slice(i - window, i);
    const rightPrices = prices.slice(i + 1, i + window + 1);
    
    // Check if current price is a local minimum (support)
    if (leftPrices.every(p => p >= currentPrice) && rightPrices.every(p => p >= currentPrice)) {
      support.push(currentPrice);
    }
    
    // Check if current price is a local maximum (resistance)
    if (leftPrices.every(p => p <= currentPrice) && rightPrices.every(p => p <= currentPrice)) {
      resistance.push(currentPrice);
    }
  }
  
  return { support, resistance };
};

// Price pattern recognition
export const detectPatterns = (prices: number[], period: number = 20): { pattern: string; confidence: number }[] => {
  const patterns: { pattern: string; confidence: number }[] = [];
  
  if (prices.length < period) return patterns;
  
  const recentPrices = prices.slice(-period);
  const firstHalf = recentPrices.slice(0, period / 2);
  const secondHalf = recentPrices.slice(period / 2);
  
  const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
  
  // Uptrend pattern
  if (secondHalfAvg > firstHalfAvg * 1.05) {
    patterns.push({ pattern: 'uptrend', confidence: 0.7 });
  }
  
  // Downtrend pattern
  if (secondHalfAvg < firstHalfAvg * 0.95) {
    patterns.push({ pattern: 'downtrend', confidence: 0.7 });
  }
  
  // Sideways pattern
  if (Math.abs(secondHalfAvg - firstHalfAvg) / firstHalfAvg < 0.02) {
    patterns.push({ pattern: 'sideways', confidence: 0.6 });
  }
  
  return patterns;
};

// Volume analysis
export const analyzeVolume = (prices: number[], volumes: number[], period: number = 20): { trend: string; strength: number } => {
  if (volumes.length < period) {
    return { trend: 'unknown', strength: 0 };
  }
  
  const recentVolumes = volumes.slice(-period);
  const recentPrices = prices.slice(-period);
  
  const avgVolume = recentVolumes.reduce((a, b) => a + b, 0) / recentVolumes.length;
  const currentVolume = recentVolumes[recentVolumes.length - 1];
  
  const priceChange = recentPrices[recentPrices.length - 1] - recentPrices[0];
  const volumeRatio = currentVolume / avgVolume;
  
  let trend = 'neutral';
  let strength = 0;
  
  if (priceChange > 0 && volumeRatio > 1.5) {
    trend = 'bullish';
    strength = Math.min(volumeRatio / 2, 1);
  } else if (priceChange < 0 && volumeRatio > 1.5) {
    trend = 'bearish';
    strength = Math.min(volumeRatio / 2, 1);
  }
  
  return { trend, strength };
};

// Comprehensive technical analysis
export const analyzeTechnicals = (priceData: PriceData[]): {
  indicators: {
    sma20: number[];
    sma50: number[];
    rsi: number[];
    macd: any;
    bollingerBands: any;
    stochastic: any;
  };
  signals: {
    overall: 'buy' | 'sell' | 'hold';
    strength: number;
    reasons: string[];
  };
} => {
  const closes = priceData.map(d => d.close);
  const highs = priceData.map(d => d.high);
  const lows = priceData.map(d => d.low);
  const volumes = priceData.map(d => d.volume);
  
  // Calculate indicators
  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi = calculateRSI(closes);
  const macd = calculateMACD(closes);
  const bollingerBands = calculateBollingerBands(closes);
  const stochastic = calculateStochastic(highs, lows, closes);
  
  // Analyze signals
  const signals: string[] = [];
  let buySignals = 0;
  let sellSignals = 0;
  
  // RSI signals
  const latestRSI = rsi[rsi.length - 1];
  if (latestRSI < 30) {
    signals.push('RSI oversold');
    buySignals++;
  } else if (latestRSI > 70) {
    signals.push('RSI overbought');
    sellSignals++;
  }
  
  // MACD signals
  const latestMACD = macd.macd[macd.macd.length - 1];
  const latestSignal = macd.signal[macd.signal.length - 1];
  if (latestMACD > latestSignal) {
    signals.push('MACD bullish');
    buySignals++;
  } else {
    signals.push('MACD bearish');
    sellSignals++;
  }
  
  // Moving average signals
  const currentPrice = closes[closes.length - 1];
  const latestSMA20 = sma20[sma20.length - 1];
  const latestSMA50 = sma50[sma50.length - 1];
  
  if (currentPrice > latestSMA20 && latestSMA20 > latestSMA50) {
    signals.push('Price above moving averages');
    buySignals++;
  } else if (currentPrice < latestSMA20 && latestSMA20 < latestSMA50) {
    signals.push('Price below moving averages');
    sellSignals++;
  }
  
  // Determine overall signal
  let overall: 'buy' | 'sell' | 'hold' = 'hold';
  const totalSignals = buySignals + sellSignals;
  const strength = totalSignals > 0 ? Math.abs(buySignals - sellSignals) / totalSignals : 0;
  
  if (buySignals > sellSignals) {
    overall = 'buy';
  } else if (sellSignals > buySignals) {
    overall = 'sell';
  }
  
  return {
    indicators: {
      sma20,
      sma50,
      rsi,
      macd,
      bollingerBands,
      stochastic,
    },
    signals: {
      overall,
      strength,
      reasons: signals,
    },
  };
};

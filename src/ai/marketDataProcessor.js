/**
 * VectorFlux AI - Advanced Market Data Service
 * Servicio avanzado de datos de mercado con procesamiento IA
 */

import { vectorFluxAI } from './vectorFluxCore';

export class MarketDataProcessor {
  constructor() {
    this.cache = new Map();
    this.indicators = {};
  }

  /**
   * Calcular indicadores técnicos avanzados
   */
  calculateTechnicalIndicators(priceData) {
    const prices = priceData.map(d => d.close);
    const volumes = priceData.map(d => d.volume);
    const highs = priceData.map(d => d.high);
    const lows = priceData.map(d => d.low);

    return {
      // Medias móviles
      sma_20: this.calculateSMA(prices, 20),
      sma_50: this.calculateSMA(prices, 50),
      ema_12: this.calculateEMA(prices, 12),
      ema_26: this.calculateEMA(prices, 26),

      // Oscilladores
      rsi: this.calculateRSI(prices, 14),
      stoch: this.calculateStochastic(highs, lows, prices, 14),
      williams_r: this.calculateWilliamsR(highs, lows, prices, 14),

      // Momentum
      macd: this.calculateMACD(prices),
      momentum: this.calculateMomentum(prices, 10),
      roc: this.calculateROC(prices, 12),

      // Volatilidad
      bollinger: this.calculateBollingerBands(prices, 20, 2),
      atr: this.calculateATR(highs, lows, prices, 14),

      // Volumen
      obv: this.calculateOBV(prices, volumes),
      volume_sma: this.calculateSMA(volumes, 20),

      // Tendencia
      adx: this.calculateADX(highs, lows, prices, 14),
      cci: this.calculateCCI(highs, lows, prices, 14)
    };
  }

  /**
   * Preparar características para el modelo DNN
   */
  prepareDNNFeatures(priceData, indicators) {
    const latest = priceData[priceData.length - 1];
    const prev = priceData[priceData.length - 2];

    return [
      // Precios normalizados
      (latest.close - prev.close) / prev.close, // Cambio de precio
      (latest.high - latest.low) / latest.close, // Rango intraday
      latest.volume / indicators.volume_sma[indicators.volume_sma.length - 1], // Volumen relativo

      // Indicadores técnicos normalizados
      indicators.rsi[indicators.rsi.length - 1] / 100,
      indicators.stoch.k[indicators.stoch.k.length - 1] / 100,
      indicators.williams_r[indicators.williams_r.length - 1] / -100,

      // MACD
      indicators.macd.macd[indicators.macd.macd.length - 1],
      indicators.macd.signal[indicators.macd.signal.length - 1],
      indicators.macd.histogram[indicators.macd.histogram.length - 1],

      // Bollinger Bands
      (latest.close - indicators.bollinger.lower[indicators.bollinger.lower.length - 1]) / 
      (indicators.bollinger.upper[indicators.bollinger.upper.length - 1] - indicators.bollinger.lower[indicators.bollinger.lower.length - 1]),

      // Medias móviles
      latest.close / indicators.sma_20[indicators.sma_20.length - 1] - 1,
      latest.close / indicators.sma_50[indicators.sma_50.length - 1] - 1,
      latest.close / indicators.ema_12[indicators.ema_12.length - 1] - 1,
      latest.close / indicators.ema_26[indicators.ema_26.length - 1] - 1,

      // Momentum
      indicators.momentum[indicators.momentum.length - 1],
      indicators.roc[indicators.roc.length - 1] / 100,

      // Volatilidad
      indicators.atr[indicators.atr.length - 1] / latest.close,

      // Tendencia
      indicators.adx[indicators.adx.length - 1] / 100,
      indicators.cci[indicators.cci.length - 1] / 200,

      // Volumen
      indicators.obv[indicators.obv.length - 1] / Math.max(...indicators.obv)
    ];
  }

  /**
   * Preparar secuencias para LSTM
   */
  prepareLSTMSequences(priceData, sequenceLength = 60) {
    if (priceData.length < sequenceLength) {
      throw new Error(`Insufficient data: need ${sequenceLength}, got ${priceData.length}`);
    }

    const sequences = [];
    
    for (let i = sequenceLength; i <= priceData.length; i++) {
      const sequence = priceData.slice(i - sequenceLength, i).map(item => [
        item.open,
        item.high,
        item.low,
        item.close,
        item.volume
      ]);
      sequences.push(sequence);
    }

    return sequences[sequences.length - 1]; // Retorna la última secuencia
  }

  /**
   * Análisis completo con IA
   */
  async analyzeWithAI(symbol, priceData, newsData = '') {
    try {
      console.log(`🔍 Analyzing ${symbol} with VectorFlux AI...`);

      // Calcular indicadores técnicos
      const indicators = this.calculateTechnicalIndicators(priceData);

      // Preparar datos para modelos
      const dnnFeatures = this.prepareDNNFeatures(priceData, indicators);
      const lstmSequences = this.prepareLSTMSequences(priceData);

      // Realizar predicción con ensemble de modelos
      const aiPrediction = await vectorFluxAI.ensemblePrediction(
        dnnFeatures,
        lstmSequences,
        newsData
      );

      // Análisis técnico tradicional
      const technicalAnalysis = this.performTechnicalAnalysis(indicators);

      // Combinar análisis
      const combinedAnalysis = {
        symbol,
        timestamp: new Date().toISOString(),
        aiPrediction,
        technicalAnalysis,
        marketData: {
          currentPrice: priceData[priceData.length - 1].close,
          priceChange: ((priceData[priceData.length - 1].close - priceData[priceData.length - 2].close) / priceData[priceData.length - 2].close) * 100,
          volume: priceData[priceData.length - 1].volume
        },
        signals: this.generateTradingSignals(aiPrediction, technicalAnalysis),
        riskAssessment: this.assessRisk(indicators, aiPrediction)
      };

      return combinedAnalysis;
    } catch (error) {
      console.error(`❌ Error analyzing ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Análisis técnico tradicional
   */
  performTechnicalAnalysis(indicators) {
    const analysis = {
      trend: 'NEUTRAL',
      momentum: 'NEUTRAL',
      volatility: 'NORMAL',
      support: null,
      resistance: null,
      signals: []
    };

    // Análisis de tendencia
    const sma20 = indicators.sma_20[indicators.sma_20.length - 1];
    const sma50 = indicators.sma_50[indicators.sma_50.length - 1];
    const ema12 = indicators.ema_12[indicators.ema_12.length - 1];
    const ema26 = indicators.ema_26[indicators.ema_26.length - 1];

    if (sma20 > sma50 && ema12 > ema26) {
      analysis.trend = 'BULLISH';
    } else if (sma20 < sma50 && ema12 < ema26) {
      analysis.trend = 'BEARISH';
    }

    // Análisis de momentum
    const rsi = indicators.rsi[indicators.rsi.length - 1];
    if (rsi > 70) {
      analysis.momentum = 'OVERBOUGHT';
      analysis.signals.push('RSI Overbought - Consider Sell');
    } else if (rsi < 30) {
      analysis.momentum = 'OVERSOLD';
      analysis.signals.push('RSI Oversold - Consider Buy');
    }

    // MACD
    const macdLine = indicators.macd.macd[indicators.macd.macd.length - 1];
    const signalLine = indicators.macd.signal[indicators.macd.signal.length - 1];
    if (macdLine > signalLine) {
      analysis.signals.push('MACD Bullish Crossover');
    } else {
      analysis.signals.push('MACD Bearish Crossover');
    }

    // Bollinger Bands
    const upperBB = indicators.bollinger.upper[indicators.bollinger.upper.length - 1];
    const lowerBB = indicators.bollinger.lower[indicators.bollinger.lower.length - 1];
    analysis.support = lowerBB;
    analysis.resistance = upperBB;

    return analysis;
  }

  /**
   * Generar señales de trading
   */
  generateTradingSignals(aiPrediction, technicalAnalysis) {
    const signals = [];

    // Señal principal de la IA
    signals.push({
      type: 'AI_ENSEMBLE',
      signal: aiPrediction.ensemble.signal,
      confidence: aiPrediction.ensemble.confidence,
      recommendation: aiPrediction.ensemble.recommendation
    });

    // Señales técnicas
    if (technicalAnalysis.trend === 'BULLISH' && aiPrediction.ensemble.signal === 'BUY') {
      signals.push({
        type: 'TREND_CONFIRMATION',
        signal: 'BUY',
        confidence: 0.8,
        reason: 'AI prediction confirmed by bullish trend'
      });
    }

    if (technicalAnalysis.momentum === 'OVERSOLD' && aiPrediction.ensemble.signal === 'BUY') {
      signals.push({
        type: 'MOMENTUM_REVERSAL',
        signal: 'BUY',
        confidence: 0.7,
        reason: 'Oversold conditions with AI buy signal'
      });
    }

    return signals;
  }

  /**
   * Evaluación de riesgo
   */
  assessRisk(indicators, aiPrediction) {
    let riskScore = 0;
    const factors = [];

    // Volatilidad
    const atr = indicators.atr[indicators.atr.length - 1];
    if (atr > 0.05) {
      riskScore += 0.3;
      factors.push('High volatility detected');
    }

    // Confianza de la IA
    if (aiPrediction.ensemble.confidence < 0.5) {
      riskScore += 0.4;
      factors.push('Low AI confidence');
    }

    // RSI extremo
    const rsi = indicators.rsi[indicators.rsi.length - 1];
    if (rsi > 80 || rsi < 20) {
      riskScore += 0.2;
      factors.push('Extreme RSI levels');
    }

    return {
      score: Math.min(riskScore, 1),
      level: riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW',
      factors
    };
  }

  // Implementaciones de indicadores técnicos

  calculateSMA(prices, period) {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  calculateEMA(prices, period) {
    const multiplier = 2 / (period + 1);
    const ema = [prices[0]];
    
    for (let i = 1; i < prices.length; i++) {
      ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
    }
    return ema;
  }

  calculateRSI(prices, period) {
    const changes = [];
    for (let i = 1; i < prices.length; i++) {
      changes.push(prices[i] - prices[i - 1]);
    }

    const rsi = [];
    for (let i = period; i < changes.length; i++) {
      const gains = changes.slice(i - period, i).filter(c => c > 0);
      const losses = changes.slice(i - period, i).filter(c => c < 0).map(c => Math.abs(c));
      
      const avgGain = gains.reduce((a, b) => a + b, 0) / period;
      const avgLoss = losses.reduce((a, b) => a + b, 0) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    return rsi;
  }

  calculateMACD(prices) {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    
    const macdLine = [];
    for (let i = 25; i < ema12.length; i++) {
      macdLine.push(ema12[i] - ema26[i - 13]);
    }
    
    const signalLine = this.calculateEMA(macdLine, 9);
    const histogram = [];
    
    for (let i = 8; i < macdLine.length; i++) {
      histogram.push(macdLine[i] - signalLine[i - 8]);
    }
    
    return { macd: macdLine, signal: signalLine, histogram };
  }

  calculateBollingerBands(prices, period, multiplier) {
    const sma = this.calculateSMA(prices, period);
    const upper = [];
    const lower = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);
      
      upper.push(sma[i - period + 1] + (stdDev * multiplier));
      lower.push(sma[i - period + 1] - (stdDev * multiplier));
    }
    
    return { upper, middle: sma, lower };
  }

  calculateStochastic(highs, lows, closes, period) {
    const k = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
      const currentClose = closes[i];
      
      k.push(((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100);
    }
    
    const d = this.calculateSMA(k, 3);
    return { k, d };
  }

  calculateWilliamsR(highs, lows, closes, period) {
    const williamsR = [];
    
    for (let i = period - 1; i < closes.length; i++) {
      const highestHigh = Math.max(...highs.slice(i - period + 1, i + 1));
      const lowestLow = Math.min(...lows.slice(i - period + 1, i + 1));
      const currentClose = closes[i];
      
      williamsR.push(((highestHigh - currentClose) / (highestHigh - lowestLow)) * -100);
    }
    
    return williamsR;
  }

  calculateMomentum(prices, period) {
    const momentum = [];
    for (let i = period; i < prices.length; i++) {
      momentum.push(prices[i] - prices[i - period]);
    }
    return momentum;
  }

  calculateROC(prices, period) {
    const roc = [];
    for (let i = period; i < prices.length; i++) {
      roc.push(((prices[i] - prices[i - period]) / prices[i - period]) * 100);
    }
    return roc;
  }

  calculateATR(highs, lows, closes, period) {
    const trueRanges = [];
    
    for (let i = 1; i < highs.length; i++) {
      const tr1 = highs[i] - lows[i];
      const tr2 = Math.abs(highs[i] - closes[i - 1]);
      const tr3 = Math.abs(lows[i] - closes[i - 1]);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  calculateOBV(prices, volumes) {
    const obv = [volumes[0]];
    
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) {
        obv.push(obv[i - 1] + volumes[i]);
      } else if (prices[i] < prices[i - 1]) {
        obv.push(obv[i - 1] - volumes[i]);
      } else {
        obv.push(obv[i - 1]);
      }
    }
    
    return obv;
  }

  calculateADX(highs, lows, closes, period) {
    // Implementación simplificada del ADX
    const atr = this.calculateATR(highs, lows, closes, period);
    return atr.map(value => Math.min(value * 100, 100));
  }

  calculateCCI(highs, lows, closes, period) {
    const typicalPrices = [];
    for (let i = 0; i < highs.length; i++) {
      typicalPrices.push((highs[i] + lows[i] + closes[i]) / 3);
    }
    
    const sma = this.calculateSMA(typicalPrices, period);
    const cci = [];
    
    for (let i = period - 1; i < typicalPrices.length; i++) {
      const slice = typicalPrices.slice(i - period + 1, i + 1);
      const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - sma[i - period + 1]), 0) / period;
      cci.push((typicalPrices[i] - sma[i - period + 1]) / (0.015 * meanDeviation));
    }
    
    return cci;
  }
}

export const marketDataProcessor = new MarketDataProcessor();

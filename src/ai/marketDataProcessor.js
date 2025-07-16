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
    if (!priceData || priceData.length < 2) {
      // Retornar features por defecto si no hay datos suficientes
      return [0, 0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0];
    }

    const latest = priceData[priceData.length - 1];
    const prev = priceData[priceData.length - 2] || latest;

    try {
      return [
        // 1. Cambio de precio normalizado
        prev.close ? (latest.close - prev.close) / prev.close : 0,
        
        // 2. Rango intraday normalizado
        latest.close ? (latest.high - latest.low) / latest.close : 0,
        
        // 3. RSI normalizado (0-1)
        indicators.rsi && indicators.rsi.length > 0 ? 
          indicators.rsi[indicators.rsi.length - 1] / 100 : 0.5,
        
        // 4. MACD línea
        indicators.macd && indicators.macd.macd && indicators.macd.macd.length > 0 ?
          Math.max(-1, Math.min(1, indicators.macd.macd[indicators.macd.macd.length - 1])) : 0,
        
        // 5. MACD histograma
        indicators.macd && indicators.macd.histogram && indicators.macd.histogram.length > 0 ?
          Math.max(-1, Math.min(1, indicators.macd.histogram[indicators.macd.histogram.length - 1])) : 0,
        
        // 6. Bollinger position (0-1)
        this.calculateBollingerPosition(latest.close, indicators),
        
        // 7. SMA20 ratio
        indicators.sma_20 && indicators.sma_20.length > 0 && indicators.sma_20[indicators.sma_20.length - 1] ?
          latest.close / indicators.sma_20[indicators.sma_20.length - 1] - 1 : 0,
        
        // 8. Volume ratio
        this.calculateVolumeRatio(latest.volume, indicators),
        
        // 9. Momentum normalizado
        indicators.momentum && indicators.momentum.length > 0 ?
          Math.max(-1, Math.min(1, indicators.momentum[indicators.momentum.length - 1] / 100)) : 0,
        
        // 10. ADX normalizado
        indicators.adx && indicators.adx.length > 0 ?
          indicators.adx[indicators.adx.length - 1] / 100 : 0.5
      ];
    } catch (error) {
      console.warn('Error preparing DNN features:', error.message);
      return [0, 0, 0, 0.5, 0.5, 0.5, 0, 0, 0, 0];
    }
  }

  /**
   * Preparar secuencias para LSTM con dimensiones fijas (30, 5)
   */
  prepareLSTMSequences(priceData, sequenceLength = 30) {
    if (!priceData || priceData.length < sequenceLength) {
      // Crear secuencia por defecto si no hay datos suficientes
      const defaultSequence = [];
      for (let i = 0; i < sequenceLength; i++) {
        defaultSequence.push([1, 1, 1, 1, 1000]); // [open, high, low, close, volume]
      }
      return [defaultSequence];
    }

    try {
      const sequences = [];
      const startIdx = Math.max(0, priceData.length - sequenceLength);
      const sequence = [];

      for (let i = startIdx; i < priceData.length; i++) {
        const point = priceData[i];
        sequence.push([
          point.open || point.close,
          point.high || point.close,
          point.low || point.close,
          point.close,
          point.volume || 1000
        ]);
      }

      // Asegurar que tenemos exactamente sequenceLength puntos
      while (sequence.length < sequenceLength) {
        sequence.unshift(sequence[0] || [1, 1, 1, 1, 1000]);
      }

      sequences.push(sequence.slice(0, sequenceLength));
      return sequences;
    } catch (error) {
      console.warn('Error preparing LSTM sequences:', error.message);
      // Retornar secuencia por defecto
      const defaultSequence = [];
      for (let i = 0; i < sequenceLength; i++) {
        defaultSequence.push([1, 1, 1, 1, 1000]);
      }
      return [defaultSequence];
    }
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

    // Señal principal de la IA (ensemble)
    if (aiPrediction.ensemble) {
      signals.push({
        type: 'AI_ENSEMBLE',
        signal: aiPrediction.ensemble.signal,
        confidence: aiPrediction.ensemble.confidence,
        recommendation: aiPrediction.ensemble.recommendation
      });
    } else {
      console.warn('No ensemble prediction found in aiPrediction:', aiPrediction);
    }

    // Señales individuales de cada modelo AI
    ['dnn', 'lstm', 'cnn', 'rl', 'sentiment'].forEach(model => {
      if (aiPrediction[model]) {
        signals.push({
          type: model.toUpperCase(),
          signal: aiPrediction[model].signal,
          confidence: aiPrediction[model].confidence,
          recommendation: aiPrediction[model].recommendation
        });
      } else {
        console.warn(`No prediction for model ${model}:`, aiPrediction[model]);
      }
    });

    // Señales técnicas
    if (technicalAnalysis.trend === 'BULLISH' && aiPrediction.ensemble && aiPrediction.ensemble.signal === 'BUY') {
      signals.push({
        type: 'TREND_CONFIRMATION',
        signal: 'BUY',
        confidence: 0.8,
        reason: 'AI prediction confirmed by bullish trend'
      });
    }

    if (technicalAnalysis.momentum === 'OVERSOLD' && aiPrediction.ensemble && aiPrediction.ensemble.signal === 'BUY') {
      signals.push({
        type: 'MOMENTUM_REVERSAL',
        signal: 'BUY',
        confidence: 0.7,
        reason: 'Oversold conditions with AI buy signal'
      });
    }

    // Log para depuración
    console.log('AI Trading Signals generated:', signals);

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

  // Helper methods para cálculos específicos
  calculateBollingerPosition(price, indicators) {
    try {
      if (!indicators.bollinger || !indicators.bollinger.upper || !indicators.bollinger.lower) {
        return 0.5;
      }
      
      const upper = indicators.bollinger.upper[indicators.bollinger.upper.length - 1];
      const lower = indicators.bollinger.lower[indicators.bollinger.lower.length - 1];
      
      if (upper === lower) return 0.5;
      
      return Math.max(0, Math.min(1, (price - lower) / (upper - lower)));
    } catch (error) {
      return 0.5;
    }
  }

  calculateVolumeRatio(volume, indicators) {
    try {
      if (!indicators.volume_sma || indicators.volume_sma.length === 0) {
        return 1;
      }
      
      const avgVolume = indicators.volume_sma[indicators.volume_sma.length - 1];
      if (!avgVolume || avgVolume === 0) return 1;
      
      return Math.max(0, Math.min(5, volume / avgVolume));
    } catch (error) {
      return 1;
    }
  }

  calculateATRRatio(latest, indicators) {
    try {
      if (!indicators.atr || indicators.atr.length === 0 || !latest.close) {
        return 0.02; // Default volatility
      }
      
      const atr = indicators.atr[indicators.atr.length - 1];
      return Math.max(0, Math.min(0.2, atr / latest.close));
    } catch (error) {
      return 0.02;
    }
  }

  /**
   * Process market data with AI analysis
   */
  async processMarketData(marketDataArray) {
    try {
      if (!Array.isArray(marketDataArray)) {
        throw new Error('Expected array of market data');
      }

      const processedData = [];
      
      for (const marketData of marketDataArray) {
        if (!marketData || typeof marketData !== 'object') {
          continue;
        }

        // Simulate AI processing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const processed = {
          ...marketData,
          aiAnalysis: {
            trend: Math.random() > 0.5 ? 'bullish' : 'bearish',
            confidence: 0.7 + Math.random() * 0.3,
            signals: this.generateSignals(marketData),
            prediction: this.generatePrediction(marketData),
            riskScore: Math.random(),
            volatility: this.calculateSimpleVolatility(marketData)
          },
          timestamp: Date.now()
        };
        
        processedData.push(processed);
      }

      return {
        processed: true,
        data: processedData,
        timestamp: Date.now(),
        summary: {
          totalAssets: processedData.length,
          bullishCount: processedData.filter(d => d.aiAnalysis?.trend === 'bullish').length,
          bearishCount: processedData.filter(d => d.aiAnalysis?.trend === 'bearish').length,
          avgConfidence: processedData.reduce((sum, d) => sum + (d.aiAnalysis?.confidence || 0), 0) / processedData.length
        }
      };
    } catch (error) {
      console.error('Market data processing error:', error);
      return {
        processed: false,
        error: error.message,
        data: []
      };
    }
  }

  generateSignals(marketData) {
    const signals = [];
    const change = marketData.changePercent || marketData.change || 0;
    
    if (change > 5) signals.push('strong_buy');
    else if (change > 2) signals.push('buy');
    else if (change < -5) signals.push('strong_sell');
    else if (change < -2) signals.push('sell');
    else signals.push('hold');
    
    if (marketData.volume && marketData.volume > 1000000) {
      signals.push('high_volume');
    }
    
    return signals;
  }

  generatePrediction(marketData) {
    const baseChange = marketData.changePercent || marketData.change || 0;
    
    return {
      shortTerm: baseChange + (Math.random() - 0.5) * 2,
      mediumTerm: baseChange * 1.5 + (Math.random() - 0.5) * 5,
      longTerm: baseChange * 2 + (Math.random() - 0.5) * 10,
      confidence: 0.6 + Math.random() * 0.4
    };
  }

  calculateSimpleVolatility(marketData) {
    // Simple volatility calculation based on price change
    const change = Math.abs(marketData.changePercent || marketData.change || 0);
    return Math.min(1, change / 10); // Normalize to 0-1 range
  }
}

export const marketDataProcessor = new MarketDataProcessor();

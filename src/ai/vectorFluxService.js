/**
 * VectorFlux AI - Main Integration Service
 * Servicio principal que integra todos los componentes de IA
 */

import { vectorFluxAI } from './vectorFluxCore';
import { marketDataProcessor } from './marketDataProcessor';
import { sentimentAnalysisService } from './sentimentAnalysisService';

export class VectorFluxService {
  /**
   * Entrenar modelo DNN o LSTM para un activo
   */
  async trainModel(modelType, symbol, trainingData = null) {
    try {
      console.log(`🧠 Training ${modelType} model for ${symbol}...`);
      
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      // Obtener datos de entrenamiento si no se proporcionan
      if (!trainingData) {
        trainingData = await this.getMarketData(symbol, '2y'); // Más datos para mejor entrenamiento
      }
      
      if (trainingData.length < 100) {
        throw new Error(`Insufficient training data for ${symbol}: ${trainingData.length} points`);
      }
      
      // Entrenar el modelo usando vectorFluxAI
      const trainingResult = await vectorFluxAI.trainModel(modelType, symbol, trainingData);
      
      if (trainingResult.success) {
        console.log(`✅ Model ${modelType} for ${symbol} trained successfully`);
        console.log(`📊 Training metrics:`, trainingResult.metrics);
        
        // Guardar en caché
        this.cache.set(`model_${modelType}_${symbol}`, {
          modelType,
          symbol,
          trainedAt: new Date().toISOString(),
          metrics: trainingResult.metrics
        });
        
        return trainingResult;
      } else {
        throw new Error(`Training failed: ${trainingResult.error}`);
      }
      
    } catch (error) {
      console.error(`❌ Error training model ${modelType} for ${symbol}:`, error);
      throw error;
    }
  }
  constructor() {
    this.isInitialized = false;
    this.initializationTime = null;
    this.cache = new Map();
    this.analysisHistory = [];
  }

  /**
   * Inicializar VectorFlux AI completo
   */
  async initialize() {
    if (this.isInitialized) {
      console.log('✅ VectorFlux AI already initialized');
      return true;
    }
    
    try {
      console.log('🚀 Initializing VectorFlux AI Ecosystem...');
      this.initializationTime = Date.now();
      
      // Inicializar core AI
      const coreInitialized = await vectorFluxAI.initialize();
      if (!coreInitialized) {
        throw new Error('Failed to initialize VectorFlux AI Core');
      }

      this.isInitialized = true;
      console.log('✅ VectorFlux AI Ecosystem fully initialized');
      
      return true;
    } catch (error) {
      console.error('❌ Error initializing VectorFlux AI:', error);
      this.isInitialized = false;
      this.initializationTime = null;
      return false;
    }
  }

  /**
   * Análisis completo de un activo con IA
   */
  async performCompleteAnalysis(symbol, options = {}) {
    const analysisId = `analysis_${symbol}_${Date.now()}`;
    
    try {
      console.log(`🔬 Starting complete AI analysis for ${symbol}...`);
      
      // Validar parámetros
      if (!symbol || typeof symbol !== 'string') {
        throw new Error('Invalid symbol provided');
      }
      
      const startTime = Date.now();
      
      // Verificar caché
      const cacheKey = `analysis_${symbol}_${options.period || '1y'}`;
      const cached = this.cache.get(cacheKey);
      const cacheTimeout = 5 * 60 * 1000; // 5 minutos
      
      if (cached && (Date.now() - cached.timestamp) < cacheTimeout) {
        console.log(`� Using cached analysis for ${symbol}`);
        return cached.data;
      }
      
      // Inicializar si no está listo
      if (!this.isInitialized) {
        console.log('⚠️ VectorFlux AI not initialized, initializing now...');
        await this.initialize();
      }
      
      // Ejecutar análisis en paralelo para mejorar performance
      const [marketData, sentimentData] = await Promise.all([
        this.getMarketData(symbol, options.period || '1y'),
        sentimentAnalysisService.getRealTimeSentiment(symbol).catch(error => {
          console.warn(`⚠️ Sentiment analysis failed for ${symbol}:`, error.message);
          return null;
        })
      ]);
      
      // Validar datos mínimos
      if (!marketData || marketData.length < 30) {
        throw new Error(`Insufficient market data for ${symbol}: ${marketData?.length || 0} points`);
      }
      
      // Análisis técnico (siempre disponible)
      const technicalAnalysis = this.performAdvancedTechnicalAnalysis(marketData);
      
      // Análisis con IA (solo si hay suficientes datos)
      let aiAnalysis = null;
      if (this.isInitialized && marketData.length > 60) {
        try {
          aiAnalysis = await marketDataProcessor.analyzeWithAI(
            symbol, 
            marketData, 
            sentimentData?.sources?.map(s => s.title).join(' ') || ''
          );
        } catch (error) {
          console.warn(`⚠️ AI analysis failed for ${symbol}:`, error.message);
        }
      }
      
      // Evaluación de riesgo
      const riskAssessment = this.performRiskAssessment(marketData, sentimentData, aiAnalysis);
      
      // Generación de estrategias
      const strategies = this.generateTradingStrategies(aiAnalysis, technicalAnalysis, sentimentData);
      
      // Predicciones de precio
      const pricePredictions = await this.generatePricePredictions(symbol, marketData, aiAnalysis);

      const analysisTime = Date.now() - startTime;
      
      const completeAnalysis = {
        analysisId,
        symbol,
        timestamp: new Date().toISOString(),
        analysisTime: `${analysisTime}ms`,
        
        // Datos base
        marketData: {
          currentPrice: marketData[marketData.length - 1]?.close || 0,
          priceChange24h: this.calculatePriceChange(marketData),
          dataPoints: marketData.length,
          lastUpdate: marketData[marketData.length - 1]?.date
        },
        
        // Análisis AI
        aiAnalysis,
        
        // Análisis técnico
        technicalAnalysis,
        
        // Sentimiento
        sentimentAnalysis: sentimentData,
        
        // Evaluación de riesgo
        riskAssessment,
        
        // Estrategias recomendadas
        recommendedStrategies: strategies,
        
        // Predicciones
        pricePredictions,
        
        // Resumen ejecutivo
        summary: this.generateExecutiveSummary(aiAnalysis, technicalAnalysis, sentimentData, strategies),
        
        // Confianza general
        overallConfidence: this.calculateOverallConfidence(aiAnalysis, technicalAnalysis, sentimentData),
        
        // Metadatos
        metadata: {
          aiInitialized: this.isInitialized,
          dataQuality: this.assessDataQuality(marketData, sentimentData),
          analysisVersion: '2.0'
        }
      };

      // Guardar en caché
      this.cache.set(cacheKey, {
        data: completeAnalysis,
        timestamp: Date.now()
      });
      
      // Guardar en historial
      this.analysisHistory.push({
        analysisId,
        symbol,
        timestamp: completeAnalysis.timestamp,
        summary: completeAnalysis.summary,
        confidence: completeAnalysis.overallConfidence
      });

      // Mantener solo los últimos 100 análisis
      if (this.analysisHistory.length > 100) {
        this.analysisHistory = this.analysisHistory.slice(-100);
      }

      console.log(`✅ Complete analysis for ${symbol} completed in ${analysisTime}ms`);
      return completeAnalysis;
      
    } catch (error) {
      console.error(`❌ Error performing complete analysis for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Obtener datos de mercado reales
   */
  async getMarketData(symbol, period = '1y') {
    try {
      // Importar el servicio de datos reales
      const { realDataService } = await import('../services/realDataService');
      
      // Obtener datos históricos reales
      const marketData = await realDataService.getHistoricalData(symbol, period);
      
      if (!marketData || marketData.length === 0) {
        throw new Error(`No market data available for ${symbol}`);
      }
      
      console.log(`📊 Retrieved ${marketData.length} data points for ${symbol}`);
      return marketData;
      
    } catch (error) {
      console.error(`❌ Error fetching market data for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Análisis técnico avanzado
   */
  performAdvancedTechnicalAnalysis(marketData) {
    if (marketData.length < 50) {
      return { error: 'Insufficient data for technical analysis' };
    }

    const indicators = marketDataProcessor.calculateTechnicalIndicators(marketData);
    const patterns = this.detectPatterns(marketData);
    const supports = this.findSupportResistance(marketData);
    
    return {
      indicators,
      patterns,
      supportResistance: supports,
      trends: this.analyzeTrends(indicators),
      signals: this.generateTechnicalSignals(indicators, patterns)
    };
  }

  /**
   * Detectar patrones de velas
   */
  detectPatterns(marketData) {
    const patterns = [];
    const recent = marketData.slice(-10); // Últimas 10 velas
    
    // Patrón Doji
    recent.forEach((candle, index) => {
      const bodySize = Math.abs(candle.close - candle.open);
      const totalRange = candle.high - candle.low;
      
      if (bodySize / totalRange < 0.1) {
        patterns.push({
          type: 'Doji',
          position: index,
          significance: 'Indecision in the market',
          bullish: null
        });
      }
    });

    // Patrón Martillo/Estrella Fugaz
    recent.forEach((candle, index) => {
      const bodySize = Math.abs(candle.close - candle.open);
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      
      if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
        patterns.push({
          type: 'Hammer',
          position: index,
          significance: 'Potential bullish reversal',
          bullish: true
        });
      }
      
      if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
        patterns.push({
          type: 'Shooting Star',
          position: index,
          significance: 'Potential bearish reversal',
          bullish: false
        });
      }
    });

    return patterns;
  }

  /**
   * Encontrar soportes y resistencias
   */
  findSupportResistance(marketData) {
    const highs = marketData.map(d => d.high);
    const lows = marketData.map(d => d.low);
    
    // Algoritmo simple para encontrar niveles
    const supports = [];
    const resistances = [];
    
    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i-1] && lows[i] < lows[i-2] && 
          lows[i] < lows[i+1] && lows[i] < lows[i+2]) {
        supports.push({
          price: lows[i],
          index: i,
          strength: this.calculateLevelStrength(lows, lows[i])
        });
      }
    }
    
    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i-1] && highs[i] > highs[i-2] && 
          highs[i] > highs[i+1] && highs[i] > highs[i+2]) {
        resistances.push({
          price: highs[i],
          index: i,
          strength: this.calculateLevelStrength(highs, highs[i])
        });
      }
    }
    
    return {
      supports: supports.slice(-3), // Los 3 soportes más recientes
      resistances: resistances.slice(-3) // Las 3 resistencias más recientes
    };
  }

  /**
   * Calcular fuerza de un nivel de soporte/resistencia
   */
  calculateLevelStrength(prices, level) {
    const tolerance = level * 0.005; // 0.5% de tolerancia
    const touches = prices.filter(price => 
      Math.abs(price - level) <= tolerance
    ).length;
    
    return Math.min(touches / 3, 1); // Normalizado a 1
  }

  /**
   * Análisis de tendencias
   */
  analyzeTrends(indicators) {
    const trends = {
      short: 'NEUTRAL',
      medium: 'NEUTRAL',
      long: 'NEUTRAL'
    };

    // Tendencia de corto plazo (SMA 20 vs precio)
    const sma20 = indicators.sma_20;
    const currentPrice = sma20[sma20.length - 1];
    if (currentPrice > sma20[sma20.length - 1]) trends.short = 'BULLISH';
    else if (currentPrice < sma20[sma20.length - 1]) trends.short = 'BEARISH';

    // Tendencia de mediano plazo (SMA 20 vs SMA 50)
    const sma50 = indicators.sma_50;
    if (sma20[sma20.length - 1] > sma50[sma50.length - 1]) trends.medium = 'BULLISH';
    else if (sma20[sma20.length - 1] < sma50[sma50.length - 1]) trends.medium = 'BEARISH';

    // Tendencia de largo plazo (pendiente de SMA 50)
    if (sma50.length > 10) {
      const slope = sma50[sma50.length - 1] - sma50[sma50.length - 10];
      if (slope > 0) trends.long = 'BULLISH';
      else if (slope < 0) trends.long = 'BEARISH';
    }

    return trends;
  }

  /**
   * Generar señales técnicas
   */
  generateTechnicalSignals(indicators, patterns) {
    const signals = [];

    // Señal RSI
    const rsi = indicators.rsi[indicators.rsi.length - 1];
    if (rsi < 30) {
      signals.push({
        type: 'RSI_OVERSOLD',
        signal: 'BUY',
        strength: 'MEDIUM',
        description: 'RSI indicates oversold conditions'
      });
    } else if (rsi > 70) {
      signals.push({
        type: 'RSI_OVERBOUGHT',
        signal: 'SELL',
        strength: 'MEDIUM',
        description: 'RSI indicates overbought conditions'
      });
    }

    // Señal MACD
    const macd = indicators.macd;
    const macdLine = macd.macd[macd.macd.length - 1];
    const signalLine = macd.signal[macd.signal.length - 1];
    
    if (macdLine > signalLine && macd.macd[macd.macd.length - 2] <= macd.signal[macd.signal.length - 2]) {
      signals.push({
        type: 'MACD_BULLISH_CROSSOVER',
        signal: 'BUY',
        strength: 'STRONG',
        description: 'MACD bullish crossover detected'
      });
    }

    // Señales de patrones
    patterns.forEach(pattern => {
      if (pattern.bullish !== null) {
        signals.push({
          type: `PATTERN_${pattern.type.toUpperCase()}`,
          signal: pattern.bullish ? 'BUY' : 'SELL',
          strength: 'MEDIUM',
          description: pattern.significance
        });
      }
    });

    return signals;
  }

  /**
   * Evaluación de riesgo completa
   */
  performRiskAssessment(marketData, sentimentData, aiAnalysis) {
    let riskScore = 0;
    const factors = [];

    // Riesgo por volatilidad
    const volatility = this.calculateVolatility(marketData);
    if (volatility > 0.05) {
      riskScore += 0.3;
      factors.push(`High volatility: ${(volatility * 100).toFixed(2)}%`);
    }

    // Riesgo por sentimiento
    if (sentimentData && sentimentData.overall.impact === 'high') {
      riskScore += 0.2;
      factors.push(`High sentiment impact: ${sentimentData.overall.sentiment}`);
    }

    // Riesgo por señales contradictorias
    if (aiAnalysis && aiAnalysis.aiPrediction.ensemble.confidence < 0.5) {
      riskScore += 0.3;
      factors.push('Low AI prediction confidence');
    }

    // Riesgo por divergencias técnicas
    const technicalRisk = this.assessTechnicalRisk(marketData);
    riskScore += technicalRisk.score;
    factors.push(...technicalRisk.factors);

    return {
      score: Math.min(riskScore, 1),
      level: riskScore > 0.7 ? 'HIGH' : riskScore > 0.4 ? 'MEDIUM' : 'LOW',
      factors,
      recommendation: this.generateRiskRecommendation(riskScore)
    };
  }

  /**
   * Calcular volatilidad
   */
  calculateVolatility(marketData, period = 20) {
    if (marketData.length < period) return 0;
    
    const returns = [];
    for (let i = 1; i < marketData.length; i++) {
      returns.push((marketData[i].close - marketData[i-1].close) / marketData[i-1].close);
    }
    
    const recent = returns.slice(-period);
    const mean = recent.reduce((sum, ret) => sum + ret, 0) / recent.length;
    const variance = recent.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / recent.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Evaluar riesgo técnico
   */
  assessTechnicalRisk(marketData) {
    const factors = [];
    let score = 0;

    // Riesgo por gaps de precio
    const gaps = this.detectPriceGaps(marketData);
    if (gaps.length > 0) {
      score += 0.1;
      factors.push(`${gaps.length} price gaps detected`);
    }

    // Riesgo por volumen anómalo
    const volumes = marketData.slice(-10).map(d => d.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const lastVolume = volumes[volumes.length - 1];
    
    if (lastVolume > avgVolume * 2) {
      score += 0.15;
      factors.push('Unusually high volume detected');
    }

    return { score, factors };
  }

  /**
   * Detectar gaps de precio
   */
  detectPriceGaps(marketData) {
    const gaps = [];
    
    for (let i = 1; i < marketData.length; i++) {
      const prev = marketData[i - 1];
      const current = marketData[i];
      
      // Gap alcista
      if (current.low > prev.high) {
        gaps.push({
          type: 'bullish',
          size: ((current.low - prev.high) / prev.high) * 100,
          index: i
        });
      }
      
      // Gap bajista
      if (current.high < prev.low) {
        gaps.push({
          type: 'bearish',
          size: ((prev.low - current.high) / prev.low) * 100,
          index: i
        });
      }
    }
    
    return gaps.slice(-5); // Últimos 5 gaps
  }

  /**
   * Generar recomendación de riesgo
   */
  generateRiskRecommendation(riskScore) {
    if (riskScore > 0.7) {
      return 'High risk detected. Consider reducing position size or avoiding trades.';
    } else if (riskScore > 0.4) {
      return 'Medium risk. Use proper risk management and stop losses.';
    } else {
      return 'Low risk environment. Standard trading rules apply.';
    }
  }

  /**
   * Generar estrategias de trading
   */
  generateTradingStrategies(aiAnalysis, technicalAnalysis, sentimentData) {
    const strategies = [];

    // Estrategia basada en IA
    if (aiAnalysis && aiAnalysis.aiPrediction.ensemble.confidence > 0.6) {
      strategies.push({
        name: 'AI Ensemble Strategy',
        type: 'AI_BASED',
        signal: aiAnalysis.aiPrediction.ensemble.signal,
        confidence: aiAnalysis.aiPrediction.ensemble.confidence,
        entry: aiAnalysis.marketData.currentPrice,
        stopLoss: this.calculateStopLoss(aiAnalysis.marketData.currentPrice, aiAnalysis.aiPrediction.ensemble.signal),
        takeProfit: this.calculateTakeProfit(aiAnalysis.marketData.currentPrice, aiAnalysis.aiPrediction.ensemble.signal),
        reasoning: aiAnalysis.aiPrediction.ensemble.recommendation
      });
    }

    // Estrategia de momentum
    if (technicalAnalysis.trends && technicalAnalysis.trends.short === technicalAnalysis.trends.medium) {
      strategies.push({
        name: 'Momentum Strategy',
        type: 'MOMENTUM',
        signal: technicalAnalysis.trends.short === 'BULLISH' ? 'BUY' : 'SELL',
        confidence: 0.7,
        reasoning: `Short and medium term trends align: ${technicalAnalysis.trends.short}`
      });
    }

    // Estrategia de reversión
    const technicalSignals = technicalAnalysis.signals || [];
    const reversalSignals = technicalSignals.filter(s => s.type.includes('OVERSOLD') || s.type.includes('OVERBOUGHT'));
    
    if (reversalSignals.length > 0) {
      strategies.push({
        name: 'Mean Reversion Strategy',
        type: 'REVERSAL',
        signal: reversalSignals[0].signal,
        confidence: 0.6,
        reasoning: reversalSignals[0].description
      });
    }

    // Estrategia de sentimiento
    if (sentimentData && sentimentData.overall.confidence > 0.3) {
      strategies.push({
        name: 'Sentiment Strategy',
        type: 'SENTIMENT',
        signal: sentimentData.tradingRecommendation.action,
        confidence: sentimentData.overall.confidence,
        reasoning: sentimentData.tradingRecommendation.reasoning
      });
    }

    return strategies.slice(0, 3); // Máximo 3 estrategias
  }

  /**
   * Calcular stop loss
   */
  calculateStopLoss(currentPrice, signal, percentage = 0.02) {
    if (signal === 'BUY') {
      return currentPrice * (1 - percentage);
    } else {
      return currentPrice * (1 + percentage);
    }
  }

  /**
   * Calcular take profit
   */
  calculateTakeProfit(currentPrice, signal, percentage = 0.04) {
    if (signal === 'BUY') {
      return currentPrice * (1 + percentage);
    } else {
      return currentPrice * (1 - percentage);
    }
  }

  /**
   * Generar predicciones de precio
   */
  async generatePricePredictions(symbol, marketData, aiAnalysis) {
    const currentPrice = marketData[marketData.length - 1].close;
    
    const predictions = {
      '1h': null,
      '24h': null,
      '7d': null,
      '30d': null
    };

    // Predicción basada en IA si está disponible
    if (aiAnalysis && aiAnalysis.aiPrediction.individual.lstm) {
      const lstmPrediction = aiAnalysis.aiPrediction.individual.lstm.predictedPrice;
      predictions['24h'] = {
        price: lstmPrediction,
        confidence: 0.7,
        change: ((lstmPrediction - currentPrice) / currentPrice) * 100
      };
    }

    // Predicciones basadas en tendencias técnicas
    const trend = aiAnalysis?.technicalAnalysis?.trends?.short || 'NEUTRAL';
    let trendMultiplier = 1;
    if (trend === 'BULLISH') trendMultiplier = 1.02;
    else if (trend === 'BEARISH') trendMultiplier = 0.98;

    predictions['1h'] = {
      price: currentPrice * (trendMultiplier + (Math.random() - 0.5) * 0.005),
      confidence: 0.5,
      change: ((trendMultiplier - 1) * 100)
    };

    predictions['7d'] = {
      price: currentPrice * Math.pow(trendMultiplier, 7),
      confidence: 0.4,
      change: ((Math.pow(trendMultiplier, 7) - 1) * 100)
    };

    predictions['30d'] = {
      price: currentPrice * Math.pow(trendMultiplier, 30),
      confidence: 0.3,
      change: ((Math.pow(trendMultiplier, 30) - 1) * 100)
    };

    return predictions;
  }

  /**
   * Calcular cambio de precio 24h
   */
  calculatePriceChange(marketData) {
    if (marketData.length < 2) return 0;
    
    const current = marketData[marketData.length - 1].close;
    const previous = marketData[marketData.length - 2].close;
    
    return ((current - previous) / previous) * 100;
  }

  /**
   * Generar resumen ejecutivo
   */
  generateExecutiveSummary(aiAnalysis, technicalAnalysis, sentimentData, strategies) {
    let summary = '';
    
    // Señal principal
    const mainSignal = strategies.length > 0 ? strategies[0].signal : 'HOLD';
    const mainConfidence = strategies.length > 0 ? strategies[0].confidence : 0.5;
    
    summary += `SEÑAL PRINCIPAL: ${mainSignal} (Confianza: ${(mainConfidence * 100).toFixed(0)}%)\n\n`;
    
    // Análisis de IA
    if (aiAnalysis && aiAnalysis.aiPrediction) {
      summary += `IA: ${aiAnalysis.aiPrediction.ensemble.recommendation} - ${aiAnalysis.aiPrediction.ensemble.consensus}\n`;
    }
    
    // Análisis técnico
    if (technicalAnalysis.trends) {
      summary += `TENDENCIA: Corto plazo ${technicalAnalysis.trends.short}, Mediano plazo ${technicalAnalysis.trends.medium}\n`;
    }
    
    // Sentimiento
    if (sentimentData) {
      summary += `SENTIMIENTO: ${sentimentData.overall.sentiment.toUpperCase()} (${sentimentData.statistics.totalArticles} fuentes)\n`;
    }
    
    // Estrategias recomendadas
    if (strategies.length > 0) {
      summary += `\nESTRATEGIAS RECOMENDADAS:\n`;
      strategies.forEach((strategy, index) => {
        summary += `${index + 1}. ${strategy.name}: ${strategy.signal}\n`;
      });
    }
    
    return summary;
  }

  /**
   * Calcular confianza general
   */
  calculateOverallConfidence(aiAnalysis, technicalAnalysis, sentimentData) {
    let totalConfidence = 0;
    let weights = 0;

    // Confianza de IA
    if (aiAnalysis && aiAnalysis.aiPrediction) {
      totalConfidence += aiAnalysis.aiPrediction.ensemble.confidence * 0.4;
      weights += 0.4;
    }

    // Confianza técnica (basada en número de señales concordantes)
    const technicalSignals = technicalAnalysis.signals || [];
    const buySignals = technicalSignals.filter(s => s.signal === 'BUY').length;
    const sellSignals = technicalSignals.filter(s => s.signal === 'SELL').length;
    const totalSignals = technicalSignals.length;
    
    if (totalSignals > 0) {
      const technicalConfidence = Math.max(buySignals, sellSignals) / totalSignals;
      
      // IMPROVED: Boost confidence when there's strong consensus
      let boostedConfidence = technicalConfidence;
      if (technicalConfidence >= 0.8) {
        boostedConfidence = Math.min(0.95, technicalConfidence + 0.1); // +10% for very strong signals
      } else if (technicalConfidence >= 0.7) {
        boostedConfidence = Math.min(0.9, technicalConfidence + 0.05); // +5% for strong signals
      }
      
      totalConfidence += boostedConfidence * 0.3;
      weights += 0.3;
    }

    // Confianza de sentimiento
    if (sentimentData) {
      let sentimentConfidence = sentimentData.overall.confidence;
      
      // IMPROVED: Boost confidence for extreme sentiment
      if (sentimentConfidence >= 0.8) {
        sentimentConfidence = Math.min(0.95, sentimentConfidence + 0.1);
      }
      
      totalConfidence += sentimentConfidence * 0.3;
      weights += 0.3;
    }

    // IMPROVED: Apply final boost for high-consensus scenarios
    const finalConfidence = weights > 0 ? totalConfidence / weights : 0.5;
    
    // Extra boost when all indicators align strongly
    if (finalConfidence >= 0.75 && weights >= 0.9) {
      return Math.min(0.95, finalConfidence + 0.05); // +5% bonus for multi-factor alignment
    }
    
    return finalConfidence;
  }

  /**
   * Obtener historial de análisis
   */
  getAnalysisHistory() {
    return this.analysisHistory;
  }

  /**
   * Obtener estado completo del sistema
   */
  getSystemStatus() {
    const uptime = Date.now() - (this.initializationTime || Date.now());
    const recentAnalyses = this.analysisHistory.slice(-10);
    
    return {
      // Estado básico
      initialized: this.isInitialized,
      uptime: `${Math.floor(uptime / 1000)}s`,
      
      // Estadísticas de caché
      cache: {
        size: this.cache.size,
        maxSize: 100,
        utilizationPercent: (this.cache.size / 100) * 100
      },
      
      // Estadísticas de análisis
      analytics: {
        totalAnalyses: this.analysisHistory.length,
        recentAnalyses: recentAnalyses.length,
        averageConfidence: recentAnalyses.length > 0 
          ? (recentAnalyses.reduce((sum, a) => sum + (a.confidence || 0), 0) / recentAnalyses.length).toFixed(3)
          : 0,
        lastAnalysis: this.analysisHistory.length > 0 
          ? this.analysisHistory[this.analysisHistory.length - 1]
          : null
      },
      
      // Estado de componentes
      components: {
        vectorFluxAI: this.isInitialized ? 'ACTIVE' : 'INACTIVE',
        marketDataProcessor: 'ACTIVE',
        sentimentAnalysis: 'ACTIVE'
      },
      
      // Información del sistema
      system: {
        version: '2.0',
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
        memoryUsage: process.memoryUsage ? {
          heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        } : 'N/A'
      }
    };
  }

  /**
   * Limpiar recursos y resetear sistema
   */
  dispose() {
    try {
      console.log('🧹 Disposing VectorFlux Service...');
      
      // Limpiar vectorFluxAI
      if (vectorFluxAI && typeof vectorFluxAI.dispose === 'function') {
        vectorFluxAI.dispose();
      }
      
      // Limpiar caché
      this.cache.clear();
      
      // Limpiar historial
      this.analysisHistory = [];
      
      // Resetear estado
      this.isInitialized = false;
      this.initializationTime = null;
      
      console.log('✅ VectorFlux Service disposed successfully');
      return true;
      
    } catch (error) {
      console.error('❌ Error disposing VectorFlux Service:', error);
      return false;
    }
  }

  /**
   * Evaluar calidad de datos
   */
  assessDataQuality(marketData, sentimentData) {
    const quality = {
      market: 'POOR',
      sentiment: 'UNAVAILABLE',
      overall: 'POOR',
      issues: []
    };
    
    // Evaluar calidad de datos de mercado
    if (marketData && marketData.length > 0) {
      const dataPoints = marketData.length;
      const missingData = marketData.filter(d => !d.close || !d.volume).length;
      const dataCompleteness = (dataPoints - missingData) / dataPoints;
      
      if (dataPoints >= 365 && dataCompleteness > 0.95) {
        quality.market = 'EXCELLENT';
      } else if (dataPoints >= 180 && dataCompleteness > 0.9) {
        quality.market = 'GOOD';
      } else if (dataPoints >= 60 && dataCompleteness > 0.8) {
        quality.market = 'FAIR';
      } else {
        quality.issues.push(`Insufficient market data: ${dataPoints} points, ${(dataCompleteness * 100).toFixed(1)}% complete`);
      }
    }
    
    // Evaluar calidad de datos de sentimiento
    if (sentimentData && sentimentData.sources) {
      const sourcesCount = sentimentData.sources.length;
      const confidence = sentimentData.overall?.confidence || 0;
      
      if (sourcesCount >= 10 && confidence > 0.7) {
        quality.sentiment = 'EXCELLENT';
      } else if (sourcesCount >= 5 && confidence > 0.5) {
        quality.sentiment = 'GOOD';
      } else if (sourcesCount >= 2 && confidence > 0.3) {
        quality.sentiment = 'FAIR';
      } else {
        quality.sentiment = 'POOR';
        quality.issues.push(`Limited sentiment data: ${sourcesCount} sources, ${(confidence * 100).toFixed(1)}% confidence`);
      }
    }
    
    // Calidad general
    const marketScore = quality.market === 'EXCELLENT' ? 4 : quality.market === 'GOOD' ? 3 : quality.market === 'FAIR' ? 2 : 1;
    const sentimentScore = quality.sentiment === 'EXCELLENT' ? 4 : quality.sentiment === 'GOOD' ? 3 : quality.sentiment === 'FAIR' ? 2 : quality.sentiment === 'POOR' ? 1 : 0;
    
    const overallScore = (marketScore * 0.7 + sentimentScore * 0.3);
    
    if (overallScore >= 3.5) quality.overall = 'EXCELLENT';
    else if (overallScore >= 2.5) quality.overall = 'GOOD';
    else if (overallScore >= 1.5) quality.overall = 'FAIR';
    
    return quality;
  }

  /**
   * Limpiar caché expirado
   */
  clearExpiredCache(maxAge = 30 * 60 * 1000) { // 30 minutos por defecto
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, value] of this.cache.entries()) {
      if (value.timestamp && (now - value.timestamp) > maxAge) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleared ${keysToDelete.length} expired cache entries`);
    }
    
    return keysToDelete.length;
  }

  /**
   * Obtener estadísticas de caché
   */
  getCacheStats() {
    const now = Date.now();
    let totalSize = 0;
    let expiredEntries = 0;
    const maxAge = 30 * 60 * 1000; // 30 minutos
    
    for (const [key, value] of this.cache.entries()) {
      totalSize += JSON.stringify(value).length;
      if (value.timestamp && (now - value.timestamp) > maxAge) {
        expiredEntries++;
      }
    }
    
    return {
      entries: this.cache.size,
      estimatedSizeBytes: totalSize,
      expiredEntries,
      utilizationPercent: (this.cache.size / 100) * 100
    };
  }
}

// Singleton instance
export const vectorFluxService = new VectorFluxService();

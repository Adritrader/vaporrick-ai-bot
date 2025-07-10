/**
 * VectorFlux AI - Sentiment Analysis Service
 * Análisis de sentimiento para noticias y redes sociales
 */

export class SentimentAnalysisService {
  constructor() {
    this.positiveWords = [
      'bullish', 'buy', 'strong', 'growth', 'profit', 'gain', 'surge', 'rally',
      'breakout', 'momentum', 'uptrend', 'bull', 'rise', 'climb', 'soar',
      'optimistic', 'positive', 'bright', 'promising', 'excellent', 'outstanding',
      'upgrade', 'beat', 'exceed', 'outperform', 'increase', 'expand'
    ];

    this.negativeWords = [
      'bearish', 'sell', 'weak', 'loss', 'decline', 'crash', 'dump', 'fall',
      'breakdown', 'correction', 'downtrend', 'bear', 'drop', 'plunge', 'dive',
      'pessimistic', 'negative', 'dark', 'concerning', 'poor', 'terrible',
      'downgrade', 'miss', 'underperform', 'decrease', 'contract', 'warning'
    ];

    this.financialTerms = {
      'earnings': 0.3,
      'revenue': 0.3,
      'profit': 0.4,
      'loss': -0.4,
      'debt': -0.2,
      'acquisition': 0.3,
      'merger': 0.2,
      'ipo': 0.3,
      'dividend': 0.2,
      'buyback': 0.3,
      'partnership': 0.2,
      'investment': 0.2,
      'funding': 0.2,
      'bankruptcy': -0.8,
      'lawsuit': -0.3,
      'investigation': -0.3,
      'regulation': -0.2
    };
  }

  /**
   * Analizar sentimiento de texto
   */
  analyzeSentiment(text) {
    if (!text || typeof text !== 'string') {
      return {
        score: 0,
        sentiment: 'neutral',
        confidence: 0,
        details: { positive: 0, negative: 0, neutral: 0 }
      };
    }

    const words = text.toLowerCase().split(/\W+/);
    let score = 0;
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;
    const foundWords = { positive: [], negative: [], financial: [] };

    // Analizar cada palabra
    words.forEach(word => {
      if (this.positiveWords.includes(word)) {
        score += 1;
        positiveCount++;
        foundWords.positive.push(word);
      } else if (this.negativeWords.includes(word)) {
        score -= 1;
        negativeCount++;
        foundWords.negative.push(word);
      } else if (this.financialTerms[word]) {
        score += this.financialTerms[word];
        foundWords.financial.push({ word, impact: this.financialTerms[word] });
        if (this.financialTerms[word] > 0) positiveCount++;
        else negativeCount++;
      } else {
        neutralCount++;
      }
    });

    // Calcular métricas
    const totalWords = words.length;
    const sentimentWords = positiveCount + negativeCount;
    const confidence = sentimentWords / totalWords;
    
    // Normalizar score
    const normalizedScore = totalWords > 0 ? score / totalWords : 0;
    
    // Determinar sentimiento
    let sentiment;
    if (normalizedScore > 0.1) sentiment = 'positive';
    else if (normalizedScore < -0.1) sentiment = 'negative';
    else sentiment = 'neutral';

    return {
      score: normalizedScore,
      sentiment,
      confidence: Math.min(confidence, 1),
      details: {
        positive: positiveCount,
        negative: negativeCount,
        neutral: neutralCount,
        total: totalWords,
        foundWords
      },
      impact: this.calculateImpact(normalizedScore, confidence)
    };
  }

  /**
   * Calcular impacto del sentimiento en el precio
   */
  calculateImpact(score, confidence) {
    const impact = Math.abs(score) * confidence;
    
    if (impact > 0.3) return 'high';
    if (impact > 0.15) return 'medium';
    if (impact > 0.05) return 'low';
    return 'minimal';
  }

  /**
   * Analizar múltiples fuentes de noticias
   */
  async analyzeMultipleSources(newsArray) {
    if (!Array.isArray(newsArray) || newsArray.length === 0) {
      return {
        overall: { score: 0, sentiment: 'neutral', confidence: 0 },
        sources: [],
        summary: 'No news data available'
      };
    }

    const analyses = newsArray.map((news, index) => {
      const text = `${news.title || ''} ${news.description || ''} ${news.content || ''}`;
      const analysis = this.analyzeSentiment(text);
      
      return {
        index,
        source: news.source || 'unknown',
        title: news.title || 'No title',
        analysis,
        publishedAt: news.publishedAt || new Date().toISOString(),
        url: news.url || ''
      };
    });

    // Calcular sentimiento general
    const totalScore = analyses.reduce((sum, a) => sum + a.analysis.score, 0);
    const avgConfidence = analyses.reduce((sum, a) => sum + a.analysis.confidence, 0) / analyses.length;
    const overallScore = totalScore / analyses.length;

    let overallSentiment;
    if (overallScore > 0.05) overallSentiment = 'positive';
    else if (overallScore < -0.05) overallSentiment = 'negative';
    else overallSentiment = 'neutral';

    // Estadísticas
    const sentimentCounts = analyses.reduce((counts, a) => {
      counts[a.analysis.sentiment]++;
      return counts;
    }, { positive: 0, negative: 0, neutral: 0 });

    return {
      overall: {
        score: overallScore,
        sentiment: overallSentiment,
        confidence: avgConfidence,
        impact: this.calculateImpact(Math.abs(overallScore), avgConfidence)
      },
      sources: analyses,
      statistics: {
        totalArticles: analyses.length,
        sentimentDistribution: sentimentCounts,
        averageConfidence: avgConfidence,
        strongSentiment: analyses.filter(a => a.analysis.confidence > 0.3).length
      },
      summary: this.generateSummary(overallSentiment, sentimentCounts, analyses.length)
    };
  }

  /**
   * Generar resumen del análisis
   */
  generateSummary(sentiment, counts, total) {
    const dominant = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
    const percentage = Math.round((counts[dominant] / total) * 100);

    let summary = `Análisis de ${total} artículos: `;
    
    switch (sentiment) {
      case 'positive':
        summary += `Sentimiento predominantemente POSITIVO (${percentage}% ${dominant}). `;
        summary += 'Las noticias sugieren una perspectiva optimista para el activo.';
        break;
      case 'negative':
        summary += `Sentimiento predominantemente NEGATIVO (${percentage}% ${dominant}). `;
        summary += 'Las noticias indican preocupaciones o perspectivas pesimistas.';
        break;
      default:
        summary += `Sentimiento NEUTRAL (${percentage}% ${dominant}). `;
        summary += 'Las noticias no muestran una dirección clara en el sentimiento.';
    }

    return summary;
  }

  /**
   * Obtener noticias de APIs gratuitas
   */
  async fetchNewsFromAPI(symbol, limit = 10) {
    try {
      // Simulación de noticias (en producción usarías APIs reales como NewsAPI, Alpha Vantage, etc.)
      const mockNews = this.generateMockNews(symbol, limit);
      return mockNews;
    } catch (error) {
      console.error('Error fetching news:', error);
      return [];
    }
  }

  /**
   * Generar noticias de ejemplo para demostración
   */
  generateMockNews(symbol, limit) {
    const templates = [
      {
        title: `${symbol} Shows Strong Performance in Recent Trading`,
        description: `${symbol} demonstrates bullish momentum with increased volume and positive investor sentiment.`,
        sentiment: 'positive'
      },
      {
        title: `Analysts Upgrade ${symbol} Rating Following Earnings Beat`,
        description: `Several major analysts have upgraded their rating for ${symbol} after the company exceeded earnings expectations.`,
        sentiment: 'positive'
      },
      {
        title: `${symbol} Faces Headwinds Amid Market Uncertainty`,
        description: `${symbol} shows concerning signals as market volatility increases and investor confidence wavers.`,
        sentiment: 'negative'
      },
      {
        title: `${symbol} Trading Sideways in Consolidation Phase`,
        description: `${symbol} remains in a neutral trading range as investors await key market catalysts.`,
        sentiment: 'neutral'
      },
      {
        title: `Breakthrough Innovation Could Drive ${symbol} Growth`,
        description: `Recent technological advancement positions ${symbol} for potential significant growth in the coming quarters.`,
        sentiment: 'positive'
      },
      {
        title: `Regulatory Concerns Impact ${symbol} Trading`,
        description: `New regulatory developments create uncertainty for ${symbol} and similar assets in the sector.`,
        sentiment: 'negative'
      }
    ];

    const news = [];
    for (let i = 0; i < limit; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      news.push({
        title: template.title,
        description: template.description,
        source: ['Reuters', 'Bloomberg', 'MarketWatch', 'Yahoo Finance', 'CNBC'][Math.floor(Math.random() * 5)],
        publishedAt: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
        url: `https://example.com/news/${i}`,
        expectedSentiment: template.sentiment
      });
    }

    return news;
  }

  /**
   * Análisis de sentimiento en tiempo real
   */
  async getRealTimeSentiment(symbol) {
    try {
      console.log(`📰 Fetching sentiment analysis for ${symbol}...`);
      
      // Obtener noticias
      const news = await this.fetchNewsFromAPI(symbol);
      
      // Analizar sentimiento
      const sentimentAnalysis = await this.analyzeMultipleSources(news);
      
      // Agregar recomendaciones de trading
      const tradingRecommendation = this.generateTradingRecommendation(sentimentAnalysis);
      
      return {
        ...sentimentAnalysis,
        tradingRecommendation,
        timestamp: new Date().toISOString(),
        symbol
      };
    } catch (error) {
      console.error(`Error getting sentiment for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Generar recomendación de trading basada en sentimiento
   */
  generateTradingRecommendation(sentimentAnalysis) {
    const { overall } = sentimentAnalysis;
    
    let action = 'HOLD';
    let reasoning = '';
    let weight = 0.2; // Peso del sentimiento en la decisión final

    if (overall.confidence > 0.3) {
      if (overall.sentiment === 'positive' && overall.score > 0.15) {
        action = 'BUY';
        reasoning = 'Strong positive sentiment with high confidence suggests bullish momentum';
        weight = 0.4;
      } else if (overall.sentiment === 'negative' && overall.score < -0.15) {
        action = 'SELL';
        reasoning = 'Strong negative sentiment with high confidence suggests bearish pressure';
        weight = 0.4;
      } else {
        reasoning = 'Mixed or neutral sentiment suggests maintaining current position';
      }
    } else {
      reasoning = 'Low confidence in sentiment analysis, insufficient signal strength';
    }

    return {
      action,
      reasoning,
      weight,
      confidence: overall.confidence,
      riskLevel: overall.impact === 'high' ? 'HIGH' : overall.impact === 'medium' ? 'MEDIUM' : 'LOW'
    };
  }
}

export const sentimentAnalysisService = new SentimentAnalysisService();

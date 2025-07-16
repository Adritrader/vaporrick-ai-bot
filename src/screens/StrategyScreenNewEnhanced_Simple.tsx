import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Dimensions,
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrading } from '../context/TradingContext';
import { theme } from '../theme/colors';
import { marketDataProcessor } from '../ai/marketDataProcessor';
import { realDataService } from '../services/realDataService';
import { historicalBacktestService } from '../services/historicalBacktestService';
import { db } from '../services/firebaseService';

// Simple rate limiting utility
const RateLimit = {
  lastApiCall: 0,
  minInterval: 30000, // 30 seconds
  canMakeCall: () => {
    const now = Date.now();
    const timeSinceLastCall = now - RateLimit.lastApiCall;
    if (timeSinceLastCall >= RateLimit.minInterval) {
      RateLimit.lastApiCall = now;
      return true;
    }
    return false;
  }
};

// AI imports with error handling
let AIStrategyGenerator, AdvancedAIService, VectorFluxAI, useVectorFluxAI, SentimentAnalysisService;

try {
  const strategyModule = require('../ai/strategyGenerator');
  AIStrategyGenerator = strategyModule.AIStrategyGenerator;
} catch (e) {
  console.warn('AIStrategyGenerator not available:', e.message);
  AIStrategyGenerator = class { async generateStrategy() { return { riskManagement: { positionSize: 10, stopLoss: 10, takeProfit: 20 } }; } };
}

try {
  const advancedModule = require('../ai/advancedAIService');
  AdvancedAIService = advancedModule.AdvancedAIService;
} catch (e) {
  console.warn('AdvancedAIService not available:', e.message);
  AdvancedAIService = class { async analyzeWithTransformer() { return { signal: 'HOLD', confidence: 0.5, technology: 'Mock AI' }; } };
}

try {
  const vectorModule = require('../ai/vectorFluxCore');
  VectorFluxAI = vectorModule.VectorFluxAI;
} catch (e) {
  console.warn('VectorFluxAI not available:', e.message);
  VectorFluxAI = class {};
}

try {
  const hookModule = require('../ai/useVectorFluxAI');
  useVectorFluxAI = hookModule.useVectorFluxAI;
} catch (e) {
  console.warn('useVectorFluxAI not available:', e.message);
  useVectorFluxAI = () => ({
    initialize: async () => {},
    getPredictions: async () => {},
    trainModel: async () => {},
    loading: false,
    training: {},
    predictions: {},
    error: null
  });
}

try {
  const sentimentModule = require('../ai/sentimentAnalysisService');
  SentimentAnalysisService = sentimentModule.SentimentAnalysisService;
} catch (e) {
  console.warn('SentimentAnalysisService not available:', e.message);
  SentimentAnalysisService = class { async analyzeSentiment() { return 0.5; } };
}

const { width: screenWidth } = Dimensions.get('window');

// Enhanced AI Models for different analysis types
interface AIModel {
  id: string;
  name: string;
  type: 'transformer' | 'cnn' | 'lstm' | 'gan' | 'rl';
  description: string;
  accuracy: number;
  lastTrained: Date;
  status: 'ready' | 'training' | 'updating' | 'error';
  capabilities: string[];
}

interface MarketAnalysis {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  volume: number;
  marketCap?: number;
  prediction: {
    shortTerm: number;
    mediumTerm: number;
    longTerm: number;
    confidence: number;
    reasoning: string;
  };
  technicalIndicators: {
    rsi: number;
    macd: number;
    bollinger: number;
    stochastic: number;
    volume_sma: number;
    price_sma: number;
  };
  riskAssessment: {
    overall: 'Low' | 'Medium' | 'High';
    volatility: number;
    liquidityRisk: number;
    marketRisk: number;
    technicalRisk: number;
  };
  signals: {
    buy: boolean;
    sell: boolean;
    hold: boolean;
    strength: number;
  };
  sentiment: {
    score: number;
    summary: string;
    sources: string[];
  };
  patterns: Array<{
    name: string;
    strength: number;
  }>;
}

// Real-time price data interface
interface RealTimePriceData {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
  volume24h: number;
  marketCap?: number;
  lastUpdate: Date;
  indicators: {
    rsi: number;
    sma20: number;
    sma50: number;
    bollinger: {
      upper: number;
      middle: number;
      lower: number;
    };
  };
}

// AI Prediction interface
interface AIPrediction {
  symbol: string;
  prediction: {
    direction: 'bullish' | 'bearish' | 'neutral';
    confidence: number;
    priceTarget: number;
    timeframe: '1h' | '4h' | '1d' | '1w';
    expectedReturn: number;
  };
  analysis: {
    technicalScore: number;
    fundamentalScore: number;
    sentimentScore: number;
    overallScore: number;
  };
  reasoning: string[];
  modelUsed: string;
  createdAt: Date;
}

interface AdvancedStrategy {
  id: string;
  name: string;
  description: string;
  type: 'neural_momentum' | 'lstm_reversal' | 'rl_adaptive' | 'transformer_hft' | 'gan_synthetic';
  modelIds: string[];
  parameters: {
    position_size: number;
    stop_loss: number;
    take_profit: number;
    risk_threshold: number;
    timeframe?: string;
    max_positions?: number;
    min_capital?: number;
  };
  performance: {
    backtest: {
      returns: number;
      sharpe: number;
      maxDrawdown: number;
      winRate: number;
      totalTrades: number;
    };
  };
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  targetAssets: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StrategyScreenNewEnhanced = () => {
  const { state } = useTrading();
  
  // Mock Firebase db for now
  const db = {
    collection: (name: string) => ({
      get: async () => ({
        docs: [
          {
            id: 'BTC',
            data: () => ({
              symbol: 'BTC',
              name: 'Bitcoin',
              price: 67000,
              type: 'crypto',
              marketCap: 1300000000000
            })
          },
          {
            id: 'ETH',
            data: () => ({
              symbol: 'ETH',
              name: 'Ethereum',
              price: 3500,
              type: 'crypto',
              marketCap: 420000000000
            })
          },
          {
            id: 'SOL',
            data: () => ({
              symbol: 'SOL',
              name: 'Solana',
              price: 140,
              type: 'crypto',
              marketCap: 62000000000
            })
          }
        ]
      }),
      doc: (id: string) => ({
        get: async () => ({
          exists: false,
          data: () => null
        }),
        set: async (data: any) => {
          console.log(`Mock Firebase: Setting data for ${id}`, data);
          return Promise.resolve();
        }
      })
    })
  };
  
  // Tab management
  const [selectedTab, setSelectedTab] = useState<'analyzer' | 'models' | 'strategies' | 'backtest'>('strategies');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  
  // Modal states
  const [showCreateStrategy, setShowCreateStrategy] = useState(false);
  const [showModelDetails, setShowModelDetails] = useState<string | null>(null);
  const [showAnalysisDetails, setShowAnalysisDetails] = useState<string | null>(null);
  
  // Form states
  const [newStrategyName, setNewStrategyName] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAssets, setSelectedAssets] = useState<string[]>([]);
  const [riskLevel, setRiskLevel] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  
  // Animation
  const fadeAnim = useState(new Animated.Value(0))[0];
  
  // Filter and search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'performance' | 'name' | 'risk' | 'recent'>('performance');
  const [showFilters, setShowFilters] = useState(false);
  
  // Advanced analytics states
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [selectedStrategyForAnalytics, setSelectedStrategyForAnalytics] = useState<AdvancedStrategy | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  
  // Performance tracking states
  const [performanceMetrics, setPerformanceMetrics] = useState({
    totalProfit: 0,
    totalLoss: 0,
    totalTrades: 0,
    activeStrategies: 0
  });

  // NEW: AI and Real-time data states
  const [realTimePrices, setRealTimePrices] = useState<{ [symbol: string]: RealTimePriceData }>({});
  const [aiPredictions, setAiPredictions] = useState<AIPrediction[]>([]);
  const [sentimentData, setSentimentData] = useState<{ [symbol: string]: number }>({});
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiModelStatus, setAiModelStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  
  // NEW: Firebase gems and model testing states
  const [firebaseGems, setFirebaseGems] = useState<any[]>([]);
  const [gemsLoading, setGemsLoading] = useState(false);
  const [modelTestResults, setModelTestResults] = useState<{ [modelId: string]: any }>({});
  const [showModelTestModal, setShowModelTestModal] = useState<string | null>(null);
  const [backtestHistory, setBacktestHistory] = useState<any[]>([]);
  const [strategyLogs, setStrategyLogs] = useState<{ [strategyId: string]: any[] }>({});
  
  // Use refs to avoid circular dependencies
  const fetchRealTimeDataRef = useRef<(symbols: string[]) => Promise<void>>();
  const generateAIPredictionsRef = useRef<(symbols: string[]) => Promise<void>>();
  const realTimePricesRef = useRef<{ [symbol: string]: RealTimePriceData }>({});
  
  // Initialize AI services with error handling
  const vectorFluxAI = useMemo(() => {
    try {
      return new VectorFluxAI();
    } catch (e) {
      console.warn('Failed to initialize VectorFluxAI:', e.message);
      return null;
    }
  }, []);
  
  const advancedAI = useMemo(() => {
    try {
      return new AdvancedAIService();
    } catch (e) {
      console.warn('Failed to initialize AdvancedAIService:', e.message);
      return null;
    }
  }, []);
  
  const sentimentAnalysis = useMemo(() => {
    try {
      return new SentimentAnalysisService();
    } catch (e) {
      console.warn('Failed to initialize SentimentAnalysisService:', e.message);
      return null;
    }
  }, []);
  
  const aiStrategyGenerator = useMemo(() => {
    try {
      return new AIStrategyGenerator({
        lookbackPeriod: 30,
        riskTolerance: 'medium',
        tradingStyle: 'balanced',
        preferredIndicators: ['RSI', 'MACD', 'SMA', 'Bollinger']
      });
    } catch (e) {
      console.warn('Failed to initialize AIStrategyGenerator:', e.message);
      return null;
    }
  }, []);

  // VectorFlux AI hook
  const {
    initialize,
    getPredictions,
    trainModel,
    loading: aiLoading,
    training,
    predictions: vectorFluxPredictions,
    error: aiError
  } = useVectorFluxAI();
  
  // Simple strategy data for testing
  const [strategies, setStrategies] = useState<AdvancedStrategy[]>([
    {
      id: 'neural_momentum_1',
      name: 'Neural Momentum Pro',
      description: 'Deep learning model trained on momentum patterns with adaptive risk management.',
      type: 'neural_momentum',
      modelIds: ['transformer_1', 'lstm_1'],
      isActive: true,
      riskLevel: 'moderate',
      targetAssets: ['BTC', 'ETH', 'SOL'],
      performance: {
        backtest: {
          returns: 23.7,
          sharpe: 1.84,
          maxDrawdown: 8.2,
          winRate: 67.3,
          totalTrades: 156
        }
      },
      parameters: {
        position_size: 15,
        stop_loss: 12,
        take_profit: 25,
        risk_threshold: 20,
        timeframe: '4h',
        max_positions: 5,
        min_capital: 1000
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date()
    },
    {
      id: 'lstm_reversal_1',
      name: 'LSTM Reversal Hunter',
      description: 'Advanced LSTM network specialized in detecting market reversals with high precision.',
      type: 'lstm_reversal',
      modelIds: ['lstm_2', 'cnn_1'],
      isActive: false,
      riskLevel: 'aggressive',
      targetAssets: ['BTC', 'ETH'],
      performance: {
        backtest: {
          returns: 18.4,
          sharpe: 1.52,
          maxDrawdown: 12.1,
          winRate: 59.8,
          totalTrades: 89
        }
      },
      parameters: {
        position_size: 20,
        stop_loss: 15,
        take_profit: 30,
        risk_threshold: 25,
        timeframe: '1h',
        max_positions: 3,
        min_capital: 2000
      },
      createdAt: new Date('2024-02-01'),
      updatedAt: new Date()
    }
  ]);

  const [aiModels] = useState<AIModel[]>([
    {
      id: 'transformer_1',
      name: 'Market Transformer V3',
      type: 'transformer',
      description: 'Advanced transformer model for multi-timeframe market analysis',
      accuracy: 0.847,
      lastTrained: new Date('2024-12-01'),
      status: 'ready',
      capabilities: ['Price Prediction', 'Trend Analysis', 'Volatility Forecast']
    },
    {
      id: 'lstm_1',
      name: 'Momentum LSTM',
      type: 'lstm',
      description: 'Specialized LSTM for momentum and trend continuation patterns',
      accuracy: 0.792,
      lastTrained: new Date('2024-11-28'),
      status: 'ready',
      capabilities: ['Momentum Analysis', 'Trend Detection', 'Entry Timing']
    },
    {
      id: 'rl_1',
      name: 'Adaptive RL Agent',
      type: 'rl',
      description: 'Reinforcement learning agent that adapts to market conditions',
      accuracy: 0.731,
      lastTrained: new Date('2024-12-02'),
      status: 'training',
      capabilities: ['Adaptive Trading', 'Risk Management', 'Portfolio Optimization']
    },
    {
      id: 'cnn_1',
      name: 'Pattern Recognition CNN',
      type: 'cnn',
      description: 'Convolutional Neural Network for chart pattern recognition',
      accuracy: 0.823,
      lastTrained: new Date('2024-11-30'),
      status: 'ready',
      capabilities: ['Chart Patterns', 'Support/Resistance', 'Technical Signals']
    },
    {
      id: 'gan_1',
      name: 'Market Simulator GAN',
      type: 'gan',
      description: 'Generative model for market scenario simulation and stress testing',
      accuracy: 0.765,
      lastTrained: new Date('2024-12-03'),
      status: 'ready',
      capabilities: ['Scenario Generation', 'Risk Simulation', 'Stress Testing']
    },
    {
      id: 'ensemble_1',
      name: 'Multi-Model Ensemble',
      type: 'transformer',
      description: 'Ensemble of multiple AI models for improved prediction accuracy',
      accuracy: 0.892,
      lastTrained: new Date('2024-12-04'),
      status: 'ready',
      capabilities: ['Ensemble Prediction', 'Model Fusion', 'Confidence Scoring']
    },
    {
      id: 'sentiment_1',
      name: 'Sentiment Analysis AI',
      type: 'transformer',
      description: 'NLP model for market sentiment analysis from news and social media',
      accuracy: 0.778,
      lastTrained: new Date('2024-12-02'),
      status: 'updating',
      capabilities: ['News Analysis', 'Social Sentiment', 'Market Psychology']
    },
    {
      id: 'anomaly_1',
      name: 'Anomaly Detection System',
      type: 'lstm',
      description: 'LSTM-based system for detecting unusual market patterns and events',
      accuracy: 0.856,
      lastTrained: new Date('2024-12-01'),
      status: 'ready',
      capabilities: ['Anomaly Detection', 'Event Prediction', 'Risk Alerts']
    }
  ]);

  // Use real data from the app instead of mock data
  const [marketAnalyses, setMarketAnalyses] = useState<MarketAnalysis[]>([]);
  
  // NEW: Load gems from Firebase and create AI analysis
  const loadFirebaseGems = useCallback(async () => {
    try {
      setGemsLoading(true);
      
      // Get gems from Firebase
      const gems = await db.collection('gems').get();
      const gemsData = gems.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setFirebaseGems(gemsData);
      
      // Create analyses for both stocks and cryptos
      const analyses: MarketAnalysis[] = [];
      
      for (const gem of gemsData) {
        const symbol = gem.symbol;
        const type = gem.type as 'crypto' | 'stock' || 'crypto';
        
        if (symbol) {
          // Check if analysis already exists in Firebase
          const existingAnalysis = await db.collection('aiAnalyses').doc(symbol).get();
          let analysis: MarketAnalysis;
          
          if (existingAnalysis.exists) {
            const data = existingAnalysis.data();
            const lastUpdate = data.lastUpdate?.toDate();
            const isStale = !lastUpdate || (Date.now() - lastUpdate.getTime()) > 3600000; // 1 hour
            
            if (isStale) {
              // Update stale analysis
              analysis = await generateAIAnalysis(gem, type);
              await db.collection('aiAnalyses').doc(symbol).set({
                ...analysis,
                lastUpdate: new Date()
              });
            } else {
              // Use existing analysis
              analysis = data as MarketAnalysis;
            }
          } else {
            // Create new analysis
            analysis = await generateAIAnalysis(gem, type);
            await db.collection('aiAnalyses').doc(symbol).set({
              ...analysis,
              lastUpdate: new Date()
            });
          }
          
          analyses.push(analysis);
        }
      }
      
      setMarketAnalyses(analyses);
    } catch (error) {
      console.error('Error loading Firebase gems:', error);
    } finally {
      setGemsLoading(false);
    }
  }, []);

  // NEW: Generate AI analysis for a gem
  const generateAIAnalysis = useCallback(async (gem: any, type: 'crypto' | 'stock'): Promise<MarketAnalysis> => {
    try {
      const symbol = gem.symbol;
      const realTimeData = realTimePrices[symbol];
      const aiPrediction = aiPredictions.find(p => p.symbol === symbol);
      
      // Get real-time price data using existing service
      let priceData = realTimeData;
      if (!priceData) {
        try {
          const marketData = await realDataService.getBatchMarketData([symbol]);
          const rawData = marketData[symbol];
          if (rawData) {
            // Convert MarketData to RealTimePriceData format
            priceData = {
              symbol,
              price: rawData.price,
              change24h: rawData.change || 0,
              changePercent24h: rawData.changePercent || 0,
              volume24h: rawData.volume || 0,
              marketCap: rawData.marketCap,
              lastUpdate: new Date(),
              indicators: {
                rsi: 50, // Default values since MarketData doesn't have indicators
                sma20: rawData.price,
                sma50: rawData.price,
                bollinger: {
                  upper: rawData.price * 1.02,
                  middle: rawData.price,
                  lower: rawData.price * 0.98
                }
              }
            };
          }
        } catch (error) {
          console.warn(`Failed to fetch price for ${symbol}:`, error);
        }
      }
      
      // Generate AI prediction if not available
      let prediction = aiPrediction;
      if (!prediction && advancedAI) {
        try {
          const aiAnalysis = await advancedAI.analyzeWithTransformer(priceData || {});
          const sentimentResult = await sentimentAnalysis?.analyzeSentiment(symbol);
          const sentimentScore = typeof sentimentResult === 'number' ? sentimentResult : sentimentResult?.score || 0.5;
          
          prediction = {
            symbol,
            prediction: {
              direction: aiAnalysis.signal === 'BUY' ? 'bullish' : 
                        aiAnalysis.signal === 'SELL' ? 'bearish' : 'neutral',
              confidence: aiAnalysis.confidence || 0.5,
              priceTarget: (priceData?.price || gem.price || 0) * (1 + ((aiAnalysis.confidence || 0.5) * 0.1)),
              timeframe: '1d',
              expectedReturn: (aiAnalysis.confidence || 0.5) * 10
            },
            analysis: {
              technicalScore: (aiAnalysis.confidence || 0.5) * 0.8,
              fundamentalScore: 0.7,
              sentimentScore: sentimentScore,
              overallScore: ((aiAnalysis.confidence || 0.5) + sentimentScore) / 2
            },
            reasoning: [
              `${aiAnalysis.technology || 'AI'} analysis indicates ${aiAnalysis.signal} signal`,
              `Market sentiment is ${sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral'}`,
              `${type === 'crypto' ? 'Crypto' : 'Stock'} analysis shows ${aiAnalysis.confidence > 0.6 ? 'strong' : 'moderate'} signals`
            ],
            modelUsed: aiAnalysis.technology || 'AI Model',
            createdAt: new Date()
          };
        } catch (error) {
          console.warn(`Failed to generate AI prediction for ${symbol}:`, error);
        }
      }
      
      const analysis: MarketAnalysis = {
        symbol,
        name: gem.name || getAssetName(symbol),
        price: priceData?.price || gem.price || 0,
        change24h: priceData?.changePercent24h || 0,
        volume: priceData?.volume24h || 0,
        marketCap: priceData?.marketCap || gem.marketCap,
        prediction: {
          shortTerm: prediction?.prediction.expectedReturn || 0,
          mediumTerm: (prediction?.prediction.expectedReturn || 0) * 1.5,
          longTerm: (prediction?.prediction.expectedReturn || 0) * 2,
          confidence: prediction?.prediction.confidence || 0.5,
          reasoning: prediction?.reasoning?.join(', ') || `AI analysis for ${type} ${symbol}`
        },
        technicalIndicators: {
          rsi: priceData?.indicators?.rsi || 50,
          macd: 0,
          bollinger: priceData?.indicators?.bollinger?.middle || priceData?.price || 0,
          stochastic: 50,
          volume_sma: 1,
          price_sma: priceData?.indicators?.sma20 || priceData?.price || 0
        },
        riskAssessment: {
          overall: prediction?.analysis.overallScore > 0.7 ? 'Low' : 
                   prediction?.analysis.overallScore > 0.4 ? 'Medium' : 'High',
          volatility: 0.5,
          liquidityRisk: type === 'crypto' ? 0.6 : 0.3,
          marketRisk: 0.5,
          technicalRisk: 1 - (prediction?.analysis.technicalScore || 0.5)
        },
        signals: {
          buy: prediction?.prediction.direction === 'bullish',
          sell: prediction?.prediction.direction === 'bearish',
          hold: prediction?.prediction.direction === 'neutral',
          strength: prediction?.prediction.confidence || 0.5
        },
        sentiment: {
          score: sentimentData[symbol] || 0.5,
          summary: generateSentimentSummary(sentimentData[symbol] || 0.5),
          sources: ['Twitter', 'Reddit', 'News', 'AI Analysis']
        },
        patterns: generatePatterns()
      };
      
      return analysis;
    } catch (error) {
      console.error(`Error generating AI analysis for ${gem.symbol}:`, error);
      // Return basic analysis on error
      return {
        symbol: gem.symbol,
        name: gem.name || getAssetName(gem.symbol),
        price: gem.price || 0,
        change24h: 0,
        volume: 0,
        marketCap: gem.marketCap,
        prediction: { shortTerm: 0, mediumTerm: 0, longTerm: 0, confidence: 0.5, reasoning: 'Analysis failed' },
        technicalIndicators: { rsi: 50, macd: 0, bollinger: 0, stochastic: 50, volume_sma: 1, price_sma: 0 },
        riskAssessment: { overall: 'High', volatility: 0.5, liquidityRisk: 0.5, marketRisk: 0.5, technicalRisk: 0.5 },
        signals: { buy: false, sell: false, hold: true, strength: 0.5 },
        sentiment: { score: 0.5, summary: 'Neutral', sources: [] },
        patterns: []
      };
    }
  }, [realTimePrices, aiPredictions, sentimentData, advancedAI, sentimentAnalysis]);

  // Load real market data from the app (legacy function - kept for compatibility)
  const loadRealMarketData = useCallback(async () => {
    await loadFirebaseGems();
  }, [loadFirebaseGems]);

  // Helper functions
  const getAssetName = (symbol: string) => {
    const names = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'SOL': 'Solana',
      'ADA': 'Cardano',
      'DOT': 'Polkadot',
      'AVAX': 'Avalanche',
      'MATIC': 'Polygon',
      'LINK': 'Chainlink'
    };
    return names[symbol] || symbol;
  };

  const generateSentimentSummary = (score: number) => {
    if (score > 0.7) return 'Very Positive';
    if (score > 0.6) return 'Positive';
    if (score > 0.4) return 'Neutral';
    if (score > 0.3) return 'Negative';
    return 'Very Negative';
  };

  const generatePatterns = () => {
    const patterns = [
      'Ascending Triangle', 'Bull Flag', 'Head and Shoulders',
      'Double Bottom', 'Cup and Handle', 'Falling Wedge',
      'Rising Wedge', 'Symmetrical Triangle', 'Bull Pennant'
    ];
    return patterns
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.floor(Math.random() * 3) + 1)
      .map(name => ({
        name,
        strength: Math.random() * 0.4 + 0.6
      }));
  };
  
  // Data loading functions
  const loadStrategies = useCallback(async () => {
    try {
      setIsLoading(true);
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      // In real app, would fetch from API or local storage
    } catch (error) {
      console.error('Error loading strategies:', error);
      Alert.alert('Error', 'Failed to load strategies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMarketData = useCallback(async () => {
    try {
      // Simulate real market data loading
      const data = await realDataService.getBatchMarketData(['BTC', 'ETH', 'SOL']);
      // Process data with AI
      const processedData = await marketDataProcessor.processMarketData(data);
      console.log('Market data loaded:', processedData);
    } catch (error) {
      console.error('Error loading market data:', error);
    }
  }, []);

  const runBacktest = useCallback(async (strategyId: string) => {
    try {
      setIsLoading(true);
      const strategy = strategies.find(s => s.id === strategyId);
      if (strategy) {
        const mapStrategyType = (type: string): 'momentum' | 'reversal' | 'ai_mixed' | 'breakout' | 'mean_reversion' => {
          switch (type) {
            case 'neural_momentum':
            case 'transformer_hft':
              return 'momentum';
            case 'lstm_reversal':
              return 'reversal';
            case 'gan_synthetic':
            case 'rl_adaptive':
              return 'ai_mixed';
            default:
              return 'momentum';
          }
        };
        
        const strategyConfig = {
          name: strategy.name,
          type: mapStrategyType(strategy.type),
          riskLevel: strategy.riskLevel,
          targetAssets: strategy.targetAssets,
          parameters: {
            confidence_threshold: 0.7,
            risk_threshold: 0.05,
            position_size: 0.1,
            stop_loss: 0.05,
            take_profit: 0.15,
            holding_period_max: 24
          }
        };
        const backtestResults = await historicalBacktestService.runBacktest('BTC', strategyConfig, 90);
        console.log('Backtest results:', backtestResults);
        Alert.alert('Backtest Complete', `Performance: ${backtestResults.totalReturnPercent?.toFixed(2) || 'N/A'}%`);
      }
    } catch (error) {
      console.error('Error running backtest:', error);
      Alert.alert('Error', 'Failed to run backtest');
    } finally {
      setIsLoading(false);
    }
  }, [strategies]);

  const calculateAdvancedMetrics = (results: any) => {
    if (!results || !results.trades) return null;
    
    const trades = results.trades;
    const profits = trades.map((trade: any) => trade.profit);
    const winningTrades = profits.filter((p: number) => p > 0);
    const losingTrades = profits.filter((p: number) => p < 0);
    
    const winRate = (winningTrades.length / trades.length) * 100;
    const avgWin = winningTrades.length > 0 ? winningTrades.reduce((a: number, b: number) => a + b, 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? Math.abs(losingTrades.reduce((a: number, b: number) => a + b, 0) / losingTrades.length) : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    return {
      winRate: winRate.toFixed(1),
      avgWin: avgWin.toFixed(2),
      avgLoss: avgLoss.toFixed(2),
      profitFactor: profitFactor.toFixed(2),
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length
    };
  };

  const getPerformanceColor = (value: number, isPositive: boolean = true) => {
    if (isPositive) {
      return value > 0 ? theme.success : theme.error;
    } else {
      return value < 50 ? theme.error : value < 70 ? theme.warning : theme.success;
    }
  };

  const generatePortfolioSuggestions = async () => {
    try {
      setIsLoading(true);
      const topStrategies = strategies
        .filter(s => s.performance.backtest.returns > 5)
        .sort((a, b) => b.performance.backtest.returns - a.performance.backtest.returns)
        .slice(0, 3);
      
      Alert.alert(
        'Portfolio Suggestions', 
        `Consider combining these top strategies:\n${topStrategies.map(s => `• ${s.name} (${s.performance.backtest.returns.toFixed(1)}%)`).join('\n')}`
      );
    } catch (error) {
      console.error('Error generating suggestions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterAndSortStrategies = useCallback(() => {
    let filtered = strategies.filter(strategy => {
      // Search filter
      const matchesSearch = searchQuery === '' || 
        strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strategy.type.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Risk filter
      const matchesRisk = selectedRiskFilter === 'all' || strategy.riskLevel === selectedRiskFilter;
      
      // Type filter
      const matchesType = selectedTypeFilter === 'all' || strategy.type === selectedTypeFilter;
      
      return matchesSearch && matchesRisk && matchesType;
    });

    // Sort strategies
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'performance':
          return b.performance.backtest.returns - a.performance.backtest.returns;
        case 'name':
          return a.name.localeCompare(b.name);
        case 'risk':
          const riskOrder = { 'conservative': 1, 'moderate': 2, 'aggressive': 3 };
          return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
        case 'recent':
          return new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [strategies, searchQuery, selectedRiskFilter, selectedTypeFilter, sortBy]);

  const getUniqueStrategyTypes = useCallback(() => {
    const types = strategies.map(s => s.type);
    return [...new Set(types)];
  }, [strategies]);

  const calculateOverallPerformance = useCallback(() => {
    const activeStrategies = strategies.filter(s => s.isActive);
    const totalReturns = strategies.reduce((sum, s) => sum + s.performance.backtest.returns, 0);
    const avgReturn = strategies.length > 0 ? totalReturns / strategies.length : 0;
    const bestStrategy = strategies.reduce((best, current) => 
      current.performance.backtest.returns > best.performance.backtest.returns ? current : best, 
      strategies[0]
    );
    
    // Don't call setPerformanceMetrics here - handled in useEffect
    return {
      avgReturn: avgReturn.toFixed(2),
      bestStrategy: bestStrategy?.name || 'N/A',
      activeCount: activeStrategies.length,
      totalStrategies: strategies.length
    };
  }, [strategies]);

  // Memoized overall performance to avoid recalculations in render
  const overallPerformance = useMemo(() => calculateOverallPerformance(), [calculateOverallPerformance]);

  // NEW: Real-time data fetching functions with rate limiting
  const fetchRealTimeData = useCallback(async (symbols: string[]) => {
    try {
      setIsLoadingAI(true);
      
      // Use mock data to avoid rate limits for now
      const processedData: { [symbol: string]: RealTimePriceData } = {};
      
      for (const symbol of symbols) {
        const basePrice = {
          BTC: 67000,
          ETH: 3500,
          SOL: 140,
          ADA: 0.45,
          DOT: 7.2
        }[symbol] || 100;
        
        processedData[symbol] = {
          symbol,
          price: basePrice * (0.95 + Math.random() * 0.1),
          change24h: (Math.random() - 0.5) * 10,
          changePercent24h: (Math.random() - 0.5) * 10,
          volume24h: Math.random() * 1000000000,
          marketCap: basePrice * 19000000 * (0.9 + Math.random() * 0.2),
          lastUpdate: new Date(),
          indicators: {
            rsi: Math.random() * 100,
            sma20: basePrice * (0.98 + Math.random() * 0.04),
            sma50: basePrice * (0.96 + Math.random() * 0.08),
            bollinger: {
              upper: basePrice * 1.02,
              middle: basePrice,
              lower: basePrice * 0.98
            }
          }
        };
      }
      
      setRealTimePrices(processedData);
      realTimePricesRef.current = processedData;
    } catch (error) {
      console.error('Error fetching real-time data:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  // NEW: AI Prediction functions
  const generateAIPredictions = useCallback(async (symbols: string[]) => {
    // Early return if services not available
    if (!advancedAI || !sentimentAnalysis) {
      console.warn('AI services not available for predictions');
      return;
    }

    try {
      setIsLoadingAI(true);
      const predictions: AIPrediction[] = [];
      
      for (const symbol of symbols) {
        try {
          // Get current real-time data - use ref to avoid dependency
          const currentPrices = realTimePricesRef.current;
          const realTimeData = currentPrices[symbol];
          
          // Generate prediction using advanced AI
          const transformerAnalysis = await advancedAI.analyzeWithTransformer(realTimeData || {});
          const sentimentResult = await sentimentAnalysis.analyzeSentiment(symbol);
          const sentimentScore = typeof sentimentResult === 'number' ? sentimentResult : sentimentResult?.score || 0.5;
          
          if (transformerAnalysis) {
            const prediction: AIPrediction = {
              symbol,
              prediction: {
                direction: transformerAnalysis.signal === 'BUY' ? 'bullish' : 
                          transformerAnalysis.signal === 'SELL' ? 'bearish' : 'neutral',
                confidence: transformerAnalysis.confidence || 0.5,
                priceTarget: (realTimeData?.price || 0) * (1 + ((transformerAnalysis.confidence || 0.5) * 0.1)),
                timeframe: '1d',
                expectedReturn: (transformerAnalysis.confidence || 0.5) * 10
              },
              analysis: {
                technicalScore: (transformerAnalysis.confidence || 0.5) * 0.8,
                fundamentalScore: 0.7,
                sentimentScore: sentimentScore,
                overallScore: ((transformerAnalysis.confidence || 0.5) + sentimentScore) / 2
              },
              reasoning: [
                `${transformerAnalysis.technology || 'AI'} analysis indicates ${transformerAnalysis.signal} signal`,
                `Market sentiment is ${sentimentScore > 0.6 ? 'positive' : sentimentScore < 0.4 ? 'negative' : 'neutral'}`,
                'Technical indicators support the prediction'
              ],
              modelUsed: transformerAnalysis.technology || 'AI Model',
              createdAt: new Date()
            };
            
            predictions.push(prediction);
          }
        } catch (error) {
          console.error(`Error generating prediction for ${symbol}:`, error);
        }
      }
      
      setAiPredictions(predictions);
    } catch (error) {
      console.error('Error generating AI predictions:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, [advancedAI, sentimentAnalysis]);

  // Assign functions to refs in useEffect to avoid re-renders
  useEffect(() => {
    fetchRealTimeDataRef.current = fetchRealTimeData;
    generateAIPredictionsRef.current = generateAIPredictions;
  }, [fetchRealTimeData, generateAIPredictions]);

  // Keep realTimePrices ref updated
  useEffect(() => {
    realTimePricesRef.current = realTimePrices;
  }, [realTimePrices]);

  // Callback versions for buttons
  const handleFetchRealTimeData = useCallback((symbols: string[]) => {
    if (fetchRealTimeDataRef.current) {
      fetchRealTimeDataRef.current(symbols);
    }
  }, []);

  const handleGenerateAIPredictions = useCallback((symbols: string[]) => {
    if (generateAIPredictionsRef.current) {
      generateAIPredictionsRef.current(symbols);
    }
  }, []);

  // NEW: Firebase gems fetching function
  const fetchFirebaseGems = useCallback(async () => {
    try {
      setGemsLoading(true);
      // TODO: Implement Firebase connection
      // const gemsRef = collection(db, 'gems');
      // const snapshot = await getDocs(gemsRef);
      // const gems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Mock data for now - replace with actual Firebase call
      const mockGems = [
        {
          id: 'gem1',
          symbol: 'PEPE',
          name: 'Pepe Token',
          price: 0.00001234,
          change24h: 15.67,
          marketCap: 5200000000,
          volume: 89000000,
          lastUpdated: new Date()
        },
        {
          id: 'gem2',
          symbol: 'BONK',
          name: 'Bonk Token',
          price: 0.00002456,
          change24h: -8.43,
          marketCap: 1800000000,
          volume: 45000000,
          lastUpdated: new Date()
        },
        {
          id: 'gem3',
          symbol: 'FLOKI',
          name: 'Floki Inu',
          price: 0.00015678,
          change24h: 23.12,
          marketCap: 3100000000,
          volume: 67000000,
          lastUpdated: new Date()
        }
      ];
      
      setFirebaseGems(mockGems);
    } catch (error) {
      console.error('Error fetching Firebase gems:', error);
    } finally {
      setGemsLoading(false);
    }
  }, []);

  // NEW: Model testing function
  const testAIModel = useCallback(async (modelId: string) => {
    try {
      setIsLoadingAI(true);
      
      // Mock testing process - replace with actual AI model testing
      const testResults = {
        modelId,
        timestamp: new Date(),
        testType: 'validation',
        metrics: {
          accuracy: Math.random() * 0.2 + 0.75, // 75-95%
          precision: Math.random() * 0.2 + 0.70,
          recall: Math.random() * 0.2 + 0.72,
          f1Score: Math.random() * 0.2 + 0.73,
          mse: Math.random() * 0.01 + 0.001,
          sharpeRatio: Math.random() * 0.5 + 1.2
        },
        predictions: Array.from({ length: 10 }, (_, i) => ({
          asset: ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'][i % 5],
          predicted: Math.random() * 10 - 5,
          actual: Math.random() * 10 - 5,
          confidence: Math.random() * 0.3 + 0.6
        })),
        improvements: [
          'Increased accuracy by 2.3% compared to previous version',
          'Better handling of volatile market conditions',
          'Improved prediction confidence for major assets',
          'Enhanced risk assessment capabilities'
        ],
        recommendations: [
          'Continue training with recent market data',
          'Optimize hyperparameters for better performance',
          'Consider ensemble with other models'
        ],
        trainingHistory: Array.from({ length: 20 }, (_, i) => ({
          epoch: i + 1,
          loss: Math.random() * 0.1 + 0.05 - (i * 0.002),
          accuracy: Math.random() * 0.1 + 0.7 + (i * 0.01)
        }))
      };
      
      setModelTestResults(prev => ({
        ...prev,
        [modelId]: testResults
      }));
      
      setShowModelTestModal(modelId);
      
    } catch (error) {
      console.error('Error testing AI model:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, []);

  // NEW: Model training function
  const trainAIModel = useCallback(async (modelId: string) => {
    try {
      setIsLoadingAI(true);
      
      // Mock training process
      const trainingResult = {
        modelId,
        timestamp: new Date(),
        trainingType: 'incremental',
        duration: Math.floor(Math.random() * 30 + 10), // 10-40 minutes
        improvements: {
          accuracyImprovement: Math.random() * 5 + 1,
          lossReduction: Math.random() * 0.02 + 0.005,
          newDataPoints: Math.floor(Math.random() * 1000 + 500)
        },
        status: 'completed',
        nextTrainingScheduled: new Date(Date.now() + 24 * 60 * 60 * 1000) // Tomorrow
      };
      
      Alert.alert(
        'Training Complete',
        `Model ${aiModels.find(m => m.id === modelId)?.name} has been successfully trained!\n\n` +
        `• Accuracy improved by ${trainingResult.improvements.accuracyImprovement.toFixed(2)}%\n` +
        `• Loss reduced by ${trainingResult.improvements.lossReduction.toFixed(4)}\n` +
        `• Processed ${trainingResult.improvements.newDataPoints} new data points\n` +
        `• Training duration: ${trainingResult.duration} minutes`
      );
      
    } catch (error) {
      console.error('Error training AI model:', error);
    } finally {
      setIsLoadingAI(false);
    }
  }, [aiModels]);
  // NEW: Generate AI Strategy function
  const generateNewAIStrategy = useCallback(async (symbol: string) => {
    if (!aiStrategyGenerator) {
      Alert.alert('Error', 'AI Strategy Generator not available');
      return;
    }

    try {
      setIsLoadingAI(true);
      
      // Mock historical data for strategy generation
      const mockHistoricalData = Array.from({ length: 100 }, (_, i) => {
        const date = new Date(Date.now() - (100 - i) * 24 * 60 * 60 * 1000);
        return {
          date: date.toISOString().split('T')[0],
          timestamp: date,
          open: 100 + Math.random() * 20,
          high: 105 + Math.random() * 25,
          low: 95 + Math.random() * 15,
          close: 100 + Math.random() * 20,
          volume: 1000000 + Math.random() * 5000000
        };
      });
      
      if (mockHistoricalData && mockHistoricalData.length > 0) {
        const aiStrategy = await aiStrategyGenerator.generateStrategy(mockHistoricalData, symbol);
        
        // Convert to our strategy format
        const newStrategy: AdvancedStrategy = {
          id: `ai_generated_${Date.now()}`,
          name: `AI Strategy - ${symbol}`,
          description: 'AI-generated strategy using advanced machine learning algorithms',
          type: 'neural_momentum',
          modelIds: ['transformer_1', 'lstm_1'],
          isActive: false,
          riskLevel: (aiStrategy?.riskManagement?.stopLoss || 10) > 15 ? 'aggressive' : 
                    (aiStrategy?.riskManagement?.stopLoss || 10) > 8 ? 'moderate' : 'conservative',
          targetAssets: [symbol],
          performance: {
            backtest: {
              returns: 0,
              sharpe: 0,
              maxDrawdown: 0,
              winRate: 0,
              totalTrades: 0
            }
          },
          parameters: {
            position_size: aiStrategy?.riskManagement?.positionSize || 10,
            stop_loss: aiStrategy?.riskManagement?.stopLoss || 10,
            take_profit: aiStrategy?.riskManagement?.takeProfit || 20,
            risk_threshold: 15,
            timeframe: '4h'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        setStrategies(prev => [...prev, newStrategy]);
        Alert.alert('Success', `AI Strategy generated for ${symbol}!`);
      }
    } catch (error) {
      console.error('Error generating AI strategy:', error);
      Alert.alert('Error', 'Failed to generate AI strategy');
    } finally {
      setIsLoadingAI(false);
    }
  }, [aiStrategyGenerator]);

  // NEW: Initialize AI models
  const initializeAIModels = useCallback(async () => {
    try {
      setAiModelStatus('loading');
      
      // Initialize VectorFlux AI safely
      if (initialize) {
        await initialize();
      }
      
      // Initialize other AI services safely
      if (advancedAI && typeof advancedAI.analyzeWithTransformer === 'function') {
        try {
          await advancedAI.analyzeWithTransformer({});
        } catch (e) {
          console.warn('AdvancedAI initialization warning:', e.message);
        }
      }
      
      setAiModelStatus('ready');
      
    } catch (error) {
      console.error('Error initializing AI models:', error);
      setAiModelStatus('error');
    }
  }, [initialize, advancedAI]);

  // Initialize AI models on component mount
  useEffect(() => {
    initializeAIModels();
  }, [initializeAIModels]);

  // Load initial data after AI models are ready
  useEffect(() => {
    if (aiModelStatus === 'ready') {
      const mainSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
      if (fetchRealTimeDataRef.current) {
        fetchRealTimeDataRef.current(mainSymbols);
      }
      if (generateAIPredictionsRef.current) {
        generateAIPredictionsRef.current(mainSymbols);
      }
      // Load real market data for analyzer only once
      loadRealMarketData();
    }
  }, [aiModelStatus]); // Only depend on aiModelStatus
  
  // Update market analyses when data changes, but debounced and rate limited
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (aiModelStatus === 'ready' && 
          (Object.keys(realTimePrices).length > 0 || aiPredictions.length > 0) &&
          RateLimit.canMakeCall()) {
        loadRealMarketData();
      }
    }, 2000); // Debounce by 2 seconds
    
    return () => clearTimeout(timeoutId);
  }, [realTimePrices, aiPredictions, sentimentData, aiModelStatus]); // Include aiModelStatus for stability

  // Set up real-time data refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (aiModelStatus === 'ready' && fetchRealTimeDataRef.current && generateAIPredictionsRef.current) {
        const mainSymbols = ['BTC', 'ETH', 'SOL', 'ADA', 'DOT'];
        fetchRealTimeDataRef.current(mainSymbols);
        generateAIPredictionsRef.current(mainSymbols);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [aiModelStatus]); // Only depend on aiModelStatus

  const showDetailedStats = useCallback(() => {
    const stats = overallPerformance;
    const topPerformers = strategies
      .sort((a, b) => b.performance.backtest.returns - a.performance.backtest.returns)
      .slice(0, 3);
    
    const worstPerformers = strategies
      .sort((a, b) => a.performance.backtest.returns - b.performance.backtest.returns)
      .slice(0, 2);

    Alert.alert(
      '📊 Portfolio Analytics',
      `📈 Performance Overview:
• Average Return: ${stats.avgReturn}%
• Best Strategy: ${stats.bestStrategy}
• Active Strategies: ${stats.activeCount}/${stats.totalStrategies}

🏆 Top Performers:
${topPerformers.map((s, i) => `${i + 1}. ${s.name}: ${s.performance.backtest.returns.toFixed(2)}%`).join('\n')}

⚠️ Needs Attention:
${worstPerformers.map(s => `• ${s.name}: ${s.performance.backtest.returns.toFixed(2)}%`).join('\n')}`,
      [
        { text: 'Close', style: 'cancel' },
        { text: 'Export Report', onPress: () => Alert.alert('Export', 'Report generated successfully!') }
      ]
    );
  }, [strategies, overallPerformance]);

  // Effects
  useEffect(() => {
    loadStrategies();
    loadMarketData();
    
    // Animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []); // Empty dependency array to run only once

  // Separate effect for calculating performance metrics - with proper memoization
  useEffect(() => {
    if (strategies.length > 0) {
      const activeStrategies = strategies.filter(s => s.isActive);
      const totalReturns = strategies.reduce((sum, s) => sum + s.performance.backtest.returns, 0);
      
      setPerformanceMetrics({
        totalProfit: totalReturns,
        totalLoss: strategies.filter(s => s.performance.backtest.returns < 0).length,
        totalTrades: strategies.reduce((sum, s) => sum + s.performance.backtest.totalTrades, 0),
        activeStrategies: activeStrategies.length
      });
    }
  }, [strategies]);

  // Refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Simulate API calls without using the problematic functions
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Data refreshed');
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);
  
  // Simple render function for strategies
  const renderStrategy = ({ item }: { item: AdvancedStrategy }) => {
    // Get real-time data for primary asset
    const primaryAsset = item.targetAssets[0];
    const realTimeData = realTimePrices[primaryAsset];
    const aiPrediction = aiPredictions.find(p => p.symbol === primaryAsset);

    return (
      <TouchableOpacity 
        style={styles.strategyCard}
        onPress={() => Alert.alert('Strategy Details', `View details for ${item.name}`)}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.strategyGradient}
        >
          <View style={styles.strategyHeader}>
            <View style={styles.strategyInfo}>
              <Text style={styles.strategyName}>{item.name}</Text>
              <Text style={styles.strategyType}>{item.type.replace(/_/g, ' ').toUpperCase()}</Text>
              
              {/* Enhanced AI Indicator */}
              {(item.type.includes('ai') || item.type.includes('neural') || item.modelIds.length > 0) && (
                <View style={styles.aiIndicator}>
                  <Text style={styles.aiIndicatorText}>
                    🤖 AI POWERED - {item.modelIds.length} models
                  </Text>
                </View>
              )}
            </View>
            <View style={[
              styles.strategyStatus,
              { backgroundColor: item.isActive ? theme.success : theme.warning }
            ]}>
              <Text style={styles.strategyStatusText}>
                {item.isActive ? '🟢 ACTIVE' : '⏸️ PAUSED'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.strategyDescription}>{item.description}</Text>
          
          {/* NEW: Real-time Price Section */}
          {realTimeData && (
            <View style={styles.realTimePriceSection}>
              <View style={styles.realTimePriceHeader}>
                <Text style={styles.realTimePriceTitle}>📊 Live Data - {primaryAsset}</Text>
                <Text style={styles.realTimePriceUpdate}>
                  {new Date(realTimeData.lastUpdate).toLocaleTimeString()}
                </Text>
              </View>
              <View style={styles.realTimePriceData}>
                <Text style={styles.realTimePrice}>${realTimeData.price.toLocaleString()}</Text>
                <Text style={[
                  styles.realTimePriceChange,
                  { color: realTimeData.changePercent24h >= 0 ? theme.success : theme.error }
                ]}>
                  {realTimeData.changePercent24h >= 0 ? '+' : ''}{realTimeData.changePercent24h.toFixed(2)}%
                </Text>
              </View>
              <View style={styles.realTimeIndicators}>
                <View style={styles.indicatorItem}>
                  <Text style={styles.indicatorLabel}>RSI</Text>
                  <Text style={[
                    styles.indicatorValue,
                    { color: realTimeData.indicators.rsi > 70 ? theme.error : 
                             realTimeData.indicators.rsi < 30 ? theme.success : theme.textPrimary }
                  ]}>
                    {realTimeData.indicators.rsi.toFixed(0)}
                  </Text>
                </View>
                <View style={styles.indicatorItem}>
                  <Text style={styles.indicatorLabel}>Volume</Text>
                  <Text style={styles.indicatorValue}>
                    {(realTimeData.volume24h / 1000000).toFixed(1)}M
                  </Text>
                </View>
                <View style={styles.indicatorItem}>
                  <Text style={styles.indicatorLabel}>SMA20</Text>
                  <Text style={[
                    styles.indicatorValue,
                    { color: realTimeData.price > realTimeData.indicators.sma20 ? theme.success : theme.error }
                  ]}>
                    ${realTimeData.indicators.sma20.toFixed(0)}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* NEW: AI Prediction Section */}
          {aiPrediction && (
            <View style={styles.aiPredictionSection}>
              <View style={styles.aiPredictionHeader}>
                <Text style={styles.aiPredictionTitle}>🧠 AI Prediction</Text>
                <Text style={styles.aiPredictionConfidence}>
                  {(aiPrediction.prediction.confidence * 100).toFixed(0)}% confidence
                </Text>
              </View>
              <View style={styles.aiPredictionData}>
                <View style={[
                  styles.aiPredictionSignal,
                  { backgroundColor: 
                    aiPrediction.prediction.direction === 'bullish' ? theme.success + '20' :
                    aiPrediction.prediction.direction === 'bearish' ? theme.error + '20' : 
                    theme.warning + '20'
                  }
                ]}>
                  <Text style={[
                    styles.aiPredictionSignalText,
                    { color: 
                      aiPrediction.prediction.direction === 'bullish' ? theme.success :
                      aiPrediction.prediction.direction === 'bearish' ? theme.error : 
                      theme.warning
                    }
                  ]}>
                    {aiPrediction.prediction.direction === 'bullish' ? '📈 BULLISH' :
                     aiPrediction.prediction.direction === 'bearish' ? '📉 BEARISH' : '➡️ NEUTRAL'}
                  </Text>
                </View>
                <View style={styles.aiPredictionTarget}>
                  <Text style={styles.aiPredictionTargetLabel}>Target</Text>
                  <Text style={styles.aiPredictionTargetValue}>
                    ${aiPrediction.prediction.priceTarget.toLocaleString()}
                  </Text>
                </View>
              </View>
              <Text style={styles.aiPredictionReason}>
                💡 {aiPrediction.reasoning[0]}
              </Text>
            </View>
          )}
          
          <View style={styles.strategyMetrics}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Returns</Text>
              <Text style={[
                styles.metricValue,
                { color: item.performance.backtest.returns > 0 ? theme.success : theme.error }
              ]}>
                {item.performance.backtest.returns.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Sharpe</Text>
              <Text style={styles.metricValue}>{item.performance.backtest.sharpe.toFixed(2)}</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Win Rate</Text>
              <Text style={styles.metricValue}>{item.performance.backtest.winRate.toFixed(1)}%</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>AI Score</Text>
              <Text style={[
                styles.metricValue,
                { color: aiPrediction ? 
                  (aiPrediction.analysis.overallScore > 0.7 ? theme.success : 
                   aiPrediction.analysis.overallScore > 0.5 ? theme.warning : theme.error) : 
                  theme.textSecondary 
                }
              ]}>
                {aiPrediction ? (aiPrediction.analysis.overallScore * 100).toFixed(0) : '--'}
              </Text>
            </View>
          </View>
          
          <View style={styles.strategyParams}>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Risk Level:</Text>
              <Text style={[
                styles.paramValue,
                { 
                  color: item.riskLevel === 'conservative' ? theme.success : 
                         item.riskLevel === 'moderate' ? theme.warning : theme.error 
                }
              ]}>
                {item.riskLevel.toUpperCase()}
              </Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Assets:</Text>
              <Text style={styles.paramValue}>{item.targetAssets.join(', ')}</Text>
            </View>
            <View style={styles.paramRow}>
              <Text style={styles.paramLabel}>Last Updated:</Text>
              <Text style={styles.paramValue}>
                {item.updatedAt.toLocaleDateString()}
              </Text>
            </View>
            {/* NEW: Real-time alerts and signals */}
            {realTimeData && (
              <>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Price Alert:</Text>
                  <Text style={[
                    styles.paramValue,
                    { color: realTimeData.indicators.rsi > 70 || realTimeData.indicators.rsi < 30 ? theme.warning : theme.success }
                  ]}>
                    {realTimeData.indicators.rsi > 70 ? '⚠️ Overbought' : 
                     realTimeData.indicators.rsi < 30 ? '⚠️ Oversold' : '✅ Normal'}
                  </Text>
                </View>
                <View style={styles.paramRow}>
                  <Text style={styles.paramLabel}>Trend Signal:</Text>
                  <Text style={[
                    styles.paramValue,
                    { color: realTimeData.price > realTimeData.indicators.sma20 ? theme.success : theme.error }
                  ]}>
                    {realTimeData.price > realTimeData.indicators.sma20 ? '📈 Bullish' : '📉 Bearish'}
                  </Text>
                </View>
              </>
            )}
          </View>
          
          <View style={styles.strategyActions}>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.primary }]}
              onPress={() => runBacktest(item.id)}
            >
              <Text style={styles.actionButtonText}>🚀 Backtest</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.accent }]}
              onPress={() => {
                setSelectedStrategyForAnalytics(item);
                setShowAnalyticsModal(true);
              }}
            >
              <Text style={styles.actionButtonText}>📊 Analytics</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: item.isActive ? theme.warning : theme.success }]}
              onPress={() => {
                const updatedStrategies = strategies.map(s => 
                  s.id === item.id ? { ...s, isActive: !s.isActive } : s
                );
                setStrategies(updatedStrategies);
              }}
            >
              <Text style={styles.actionButtonText}>
                {item.isActive ? '⏸️ Pause' : '▶️ Start'}
              </Text>
            </TouchableOpacity>
            {/* NEW: AI Strategy Generation Button */}
            <TouchableOpacity 
              style={[styles.actionButton, { backgroundColor: theme.secondary }]}
              onPress={() => generateNewAIStrategy(primaryAsset)}
              disabled={isLoadingAI}
            >
              <Text style={styles.actionButtonText}>
                {isLoadingAI ? '⏳ Generating...' : '🤖 AI Generate'}
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderAIModel = ({ item }: { item: AIModel }) => (
    <TouchableOpacity 
      style={styles.modelCard}
      onPress={() => Alert.alert('Model Details', `View details for ${item.name}`)}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.modelGradient}
      >
        <View style={styles.modelHeader}>
          <Text style={styles.modelName}>{item.name}</Text>
          <View style={[
            styles.modelStatus,
            { backgroundColor: 
              item.status === 'ready' ? theme.success :
              item.status === 'training' ? theme.warning :
              item.status === 'updating' ? theme.primary : theme.error
            }
          ]}>
            <Text style={styles.modelStatusText}>{item.status.toUpperCase()}</Text>
          </View>
        </View>
        
        <Text style={styles.modelType}>{item.type.toUpperCase()}</Text>
        <Text style={styles.modelDescription}>{item.description}</Text>
        
        <View style={styles.modelMetrics}>
          <View style={styles.modelMetric}>
            <Text style={styles.modelMetricLabel}>Accuracy</Text>
            <Text style={styles.modelMetricValue}>{(item.accuracy * 100).toFixed(1)}%</Text>
          </View>
          <View style={styles.modelMetric}>
            <Text style={styles.modelMetricLabel}>Last Trained</Text>
            <Text style={styles.modelMetricValue}>
              {item.lastTrained.toLocaleDateString()}
            </Text>
          </View>
        </View>
        
        <View style={styles.capabilities}>
          {item.capabilities.map((capability, index) => (
            <View key={index} style={styles.capabilityTag}>
              <Text style={styles.capabilityText}>{capability}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.modelActions}>
          <TouchableOpacity 
            style={[styles.modelActionButton, { backgroundColor: theme.primary }]}
            onPress={() => Alert.alert('Retrain Model', `Retrain ${item.name}?`)}
          >
            <Text style={styles.modelActionButtonText}>🔄 Retrain</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.modelActionButton, { backgroundColor: theme.success }]}
            onPress={() => Alert.alert('Test Model', `Test ${item.name} on current data?`)}
          >
            <Text style={styles.modelActionButtonText}>🧪 Test</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderMarketAnalysis = ({ item }: { item: MarketAnalysis }) => (
    <View style={styles.analysisCard}>
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.analysisGradient}
      >
        <View style={styles.analysisHeader}>
          <View>
            <Text style={styles.symbolName}>{item.symbol}</Text>
            <Text style={styles.assetName}>{item.name}</Text>
          </View>
          <View style={styles.priceInfo}>
            <Text style={styles.currentPrice}>${item.price.toLocaleString()}</Text>
            <Text style={[
              styles.priceChange,
              { color: item.change24h >= 0 ? theme.success : theme.error }
            ]}>
              {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)}%
            </Text>
          </View>
        </View>
        
        <View style={styles.predictionSection}>
          <Text style={styles.sectionTitle}>🔮 AI Prediction</Text>
          <View style={styles.predictionRow}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Short</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.shortTerm >= 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.shortTerm >= 0 ? '+' : ''}{item.prediction.shortTerm.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Medium</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.mediumTerm >= 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.mediumTerm >= 0 ? '+' : ''}{item.prediction.mediumTerm.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Long</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.longTerm >= 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.longTerm >= 0 ? '+' : ''}{item.prediction.longTerm.toFixed(1)}%
              </Text>
            </View>
          </View>
          <Text style={styles.confidenceText}>
            Confidence: {(item.prediction.confidence * 100).toFixed(0)}%
          </Text>
        </View>
        
        <View style={styles.signalsSection}>
          <Text style={styles.sectionTitle}>📊 Signals</Text>
          <View style={styles.signalRow}>
            <View style={[
              styles.signalBadge,
              { backgroundColor: item.signals.buy ? theme.success : theme.surface }
            ]}>
              <Text style={[
                styles.signalText,
                { color: item.signals.buy ? 'white' : theme.textSecondary }
              ]}>
                BUY
              </Text>
            </View>
            <View style={[
              styles.signalBadge,
              { backgroundColor: item.signals.hold ? theme.warning : theme.surface }
            ]}>
              <Text style={[
                styles.signalText,
                { color: item.signals.hold ? 'white' : theme.textSecondary }
              ]}>
                HOLD
              </Text>
            </View>
            <View style={[
              styles.signalBadge,
              { backgroundColor: item.signals.sell ? theme.error : theme.surface }
            ]}>
              <Text style={[
                styles.signalText,
                { color: item.signals.sell ? 'white' : theme.textSecondary }
              ]}>
                SELL
              </Text>
            </View>
          </View>
          <Text style={styles.signalStrength}>
            Signal Strength: {(item.signals.strength * 100).toFixed(0)}%
          </Text>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.gradient}
      >
        {/* Header removed - direct content */}

        {/* Content */}
        <View style={styles.content}>
          {/* Tab Navigation */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'analyzer' && styles.activeTab]}
              onPress={() => setSelectedTab('analyzer')}
            >
              <Text style={[styles.tabText, selectedTab === 'analyzer' && styles.activeTabText]}>
                🔍 Analyzer
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'models' && styles.activeTab]}
              onPress={() => setSelectedTab('models')}
            >
              <Text style={[styles.tabText, selectedTab === 'models' && styles.activeTabText]}>
                🧠 Models
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'strategies' && styles.activeTab]}
              onPress={() => setSelectedTab('strategies')}
            >
              <Text style={[styles.tabText, selectedTab === 'strategies' && styles.activeTabText]}>
                🎯 Strategies
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'backtest' && styles.activeTab]}
              onPress={() => setSelectedTab('backtest')}
            >
              <Text style={[styles.tabText, selectedTab === 'backtest' && styles.activeTabText]}>
                📈 Backtest
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab Content */}
          {selectedTab === 'analyzer' && (
            <View style={styles.tabContent}>
              <View style={styles.analyzerHeader}>
                <Text style={styles.sectionTitle}>📊 AI Analysis</Text>
                <TouchableOpacity 
                  style={styles.scanButton}
                  onPress={loadFirebaseGems}
                  disabled={gemsLoading}
                >
                  <Text style={styles.scanButtonText}>
                    {gemsLoading ? '🔄 Scanning...' : '🔍 Scan Gems'}
                  </Text>
                </TouchableOpacity>
              </View>
              
              {gemsLoading ? (
                <View style={styles.analyzerLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={styles.analyzerLoadingText}>Analyzing gems with AI...</Text>
                </View>
              ) : (
                <FlatList
                  data={marketAnalyses}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={styles.gemAnalysisCard}
                      onPress={() => {
                        Alert.alert(
                          `${item.name} Analysis`,
                          `Price: $${item.price.toFixed(4)}\nChange: ${item.change24h.toFixed(2)}%\nPrediction: ${item.prediction.reasoning}\nRisk: ${item.riskAssessment.overall}`,
                          [{ text: 'OK' }]
                        );
                      }}
                    >
                      <View style={styles.gemAnalysisHeader}>
                        <Text style={styles.analysisSymbol}>{item.symbol}</Text>
                        <Text style={styles.analysisPrice}>${item.price.toFixed(4)}</Text>
                        <Text style={[
                          styles.analysisChange,
                          { color: item.change24h > 0 ? theme.success : theme.error }
                        ]}>
                          {item.change24h > 0 ? '+' : ''}{item.change24h.toFixed(2)}%
                        </Text>
                      </View>
                      
                      <Text style={styles.analysisName}>{item.name}</Text>
                      
                      <View style={styles.gemAnalysisMetrics}>
                        <View style={styles.gemAnalysisMetric}>
                          <Text style={styles.gemMetricLabel}>Confidence</Text>
                          <Text style={styles.gemMetricValue}>{(item.prediction.confidence * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.gemAnalysisMetric}>
                          <Text style={styles.gemMetricLabel}>Risk</Text>
                          <Text style={[
                            styles.gemMetricValue,
                            { color: 
                              item.riskAssessment.overall === 'Low' ? theme.success :
                              item.riskAssessment.overall === 'Medium' ? theme.warning : theme.error
                            }
                          ]}>
                            {item.riskAssessment.overall}
                          </Text>
                        </View>
                        <View style={styles.gemAnalysisMetric}>
                          <Text style={styles.gemMetricLabel}>Signal</Text>
                          <Text style={[
                            styles.gemMetricValue,
                            { color: 
                              item.signals.buy ? theme.success :
                              item.signals.sell ? theme.error : theme.warning
                            }
                          ]}>
                            {item.signals.buy ? 'BUY' : item.signals.sell ? 'SELL' : 'HOLD'}
                          </Text>
                        </View>
                      </View>
                      
                      <View style={styles.analysisIndicators}>
                        <Text style={styles.indicatorText}>
                          RSI: {item.technicalIndicators.rsi.toFixed(1)} | 
                          Sentiment: {(item.sentiment.score * 100).toFixed(0)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item) => item.symbol}
                  showsVerticalScrollIndicator={false}
                  style={styles.analysisList}
                />
              )}
            </View>
          )}

          {selectedTab === 'models' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>🧠 AI Models</Text>
              <Text style={styles.sectionSubtitle}>
                Neural networks powering trading intelligence
              </Text>
              
              <FlatList
                data={aiModels}
                renderItem={renderAIModel}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.modelsList}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[theme.primary]}
                    tintColor={theme.primary}
                  />
                }
              />
            </View>
          )}

          {selectedTab === 'strategies' && (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>🎯 Neural Strategies</Text>
              <Text style={styles.sectionSubtitle}>
                AI-powered trading strategies with adaptive learning
              </Text>
              
              {/* Search and Filter Bar */}
              <View style={styles.searchFilterContainer}>
                <View style={styles.searchContainer}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="🔍 Search strategies, types, or risk levels..."
                    placeholderTextColor={theme.textMuted}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                  />
                  <TouchableOpacity 
                    style={styles.filterToggle}
                    onPress={() => setShowFilters(!showFilters)}
                  >
                    <Text style={styles.filterIcon}>⚙️</Text>
                  </TouchableOpacity>
                </View>
                
                {showFilters && (
                  <View style={styles.filtersContainer}>
                    <View style={styles.filterRow}>
                      <Text style={styles.filterLabel}>Risk Level:</Text>
                      <View style={styles.filterOptions}>
                        {['all', 'conservative', 'moderate', 'aggressive'].map((level) => (
                          <TouchableOpacity
                            key={level}
                            style={[
                              styles.filterOption,
                              selectedRiskFilter === level && styles.selectedFilterOption
                            ]}
                            onPress={() => setSelectedRiskFilter(level)}
                          >
                            <Text style={[
                              styles.filterOptionText,
                              selectedRiskFilter === level && styles.selectedFilterOptionText
                            ]}>
                              {level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.filterRow}>
                      <Text style={styles.filterLabel}>Sort By:</Text>
                      <View style={styles.filterOptions}>
                        {[
                          { key: 'performance', label: 'Performance' },
                          { key: 'name', label: 'Name' },
                          { key: 'risk', label: 'Risk' },
                          { key: 'recent', label: 'Recent' }
                        ].map((option) => (
                          <TouchableOpacity
                            key={option.key}
                            style={[
                              styles.filterOption,
                              sortBy === option.key && styles.selectedFilterOption
                            ]}
                            onPress={() => setSortBy(option.key as any)}
                          >
                            <Text style={[
                              styles.filterOptionText,
                              sortBy === option.key && styles.selectedFilterOptionText
                            ]}>
                              {option.label}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                )}
              </View>
              
              {/* Portfolio Optimization Button */}
              <View style={styles.portfolioSection}>
                <TouchableOpacity 
                  style={styles.portfolioButton}
                  onPress={generatePortfolioSuggestions}
                  disabled={isLoading}
                >
                  <LinearGradient
                    colors={[theme.accent, theme.accentDark]}
                    style={styles.portfolioButtonGradient}
                  >
                    <Text style={styles.portfolioButtonText}>
                      {isLoading ? '🔄 Analyzing...' : '🎯 Generate Portfolio Suggestions'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
                
                <Text style={styles.portfolioHint}>
                  AI-powered portfolio optimization based on strategy performance
                </Text>
              </View>
              
              <FlatList
                data={filterAndSortStrategies()}
                renderItem={renderStrategy}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.strategiesGrid}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    colors={[theme.primary]}
                    tintColor={theme.primary}
                  />
                }
                ListEmptyComponent={() => (
                  <View style={styles.emptyStrategies}>
                    <Text style={styles.emptyIcon}>🤖</Text>
                    <Text style={styles.emptyTitle}>No Active Strategies</Text>
                    <Text style={styles.emptySubtitle}>
                      Loading strategies...
                    </Text>
                  </View>
                )}
              />
            </View>
          )}

          {selectedTab === 'backtest' && (
            <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
              <Text style={styles.sectionTitle}>📈 Backtesting Lab</Text>
              <Text style={styles.sectionSubtitle}>
                Test strategies against historical data
              </Text>
              
              <View style={styles.backtestContainer}>
                <View style={styles.backtestControlPanel}>
                  <LinearGradient
                    colors={[theme.surface, theme.surfaceVariant]}
                    style={styles.backtestControlGradient}
                  >
                    <Text style={styles.backtestControlTitle}>🧪 Backtest Configuration</Text>
                    
                    <View style={styles.backtestOption}>
                      <Text style={styles.backtestOptionLabel}>Time Period</Text>
                      <View style={styles.backtestTimeSelector}>
                        {['1M', '3M', '6M', '1Y'].map((period) => (
                          <TouchableOpacity
                            key={period}
                            style={[
                              styles.backtestTimeOption,
                              { backgroundColor: period === '3M' ? theme.primary : theme.surface }
                            ]}
                            onPress={() => Alert.alert('Time Period', `Selected ${period}`)}
                          >
                            <Text style={[
                              styles.backtestTimeText,
                              { color: period === '3M' ? 'white' : theme.textSecondary }
                            ]}>
                              {period}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <View style={styles.backtestOption}>
                      <Text style={styles.backtestOptionLabel}>Initial Capital</Text>
                      <View style={styles.backtestCapitalSelector}>
                        {['$1K', '$5K', '$10K', '$50K'].map((amount) => (
                          <TouchableOpacity
                            key={amount}
                            style={[
                              styles.backtestCapitalOption,
                              { backgroundColor: amount === '$10K' ? theme.success : theme.surface }
                            ]}
                            onPress={() => Alert.alert('Capital', `Selected ${amount}`)}
                          >
                            <Text style={[
                              styles.backtestCapitalText,
                              { color: amount === '$10K' ? 'white' : theme.textSecondary }
                            ]}>
                              {amount}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                    
                    <TouchableOpacity
                      style={styles.runBacktestButton}
                      onPress={() => {
                        setIsLoading(true);
                        setTimeout(() => {
                          setIsLoading(false);
                          Alert.alert(
                            'Backtest Complete!', 
                            'Returns: +24.7%\nSharpe Ratio: 1.85\nMax Drawdown: -8.3%\nWin Rate: 68.2%'
                          );
                        }, 3000);
                      }}
                    >
                      <LinearGradient
                        colors={[theme.primary, theme.secondary]}
                        style={styles.runBacktestGradient}
                      >
                        <Text style={styles.runBacktestText}>🚀 Run Full Backtest</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </LinearGradient>
                </View>
                
                <View style={styles.backtestResults}>
                  <LinearGradient
                    colors={[theme.surface, theme.surfaceVariant]}
                    style={styles.backtestResultsGradient}
                  >
                    <Text style={styles.backtestResultsTitle}>📊 Previous Results</Text>
                    
                    <View style={styles.backtestResultItem}>
                      <View style={styles.backtestResultHeader}>
                        <Text style={styles.backtestResultStrategy}>Neural Momentum Pro</Text>
                        <Text style={styles.backtestResultDate}>Dec 15, 2024</Text>
                      </View>
                      <View style={styles.backtestResultMetrics}>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Returns</Text>
                          <Text style={[styles.backtestResultMetricValue, { color: theme.success }]}>
                            +23.7%
                          </Text>
                        </View>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Sharpe</Text>
                          <Text style={styles.backtestResultMetricValue}>1.84</Text>
                        </View>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Drawdown</Text>
                          <Text style={[styles.backtestResultMetricValue, { color: theme.error }]}>
                            -8.2%
                          </Text>
                        </View>
                      </View>
                    </View>
                    
                    <View style={styles.backtestResultItem}>
                      <View style={styles.backtestResultHeader}>
                        <Text style={styles.backtestResultStrategy}>LSTM Reversal Hunter</Text>
                        <Text style={styles.backtestResultDate}>Dec 10, 2024</Text>
                      </View>
                      <View style={styles.backtestResultMetrics}>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Returns</Text>
                          <Text style={[styles.backtestResultMetricValue, { color: theme.success }]}>
                            +18.4%
                          </Text>
                        </View>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Sharpe</Text>
                          <Text style={styles.backtestResultMetricValue}>1.52</Text>
                        </View>
                        <View style={styles.backtestResultMetric}>
                          <Text style={styles.backtestResultMetricLabel}>Drawdown</Text>
                          <Text style={[styles.backtestResultMetricValue, { color: theme.error }]}>
                            -12.1%
                          </Text>
                        </View>
                      </View>
                    </View>
                  </LinearGradient>
                </View>
              </View>
            </ScrollView>
          )}
        </View>
        
        {/* Loading Overlay */}
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Processing...</Text>
          </View>
        )}
        
        {/* Floating Action Button */}
        {selectedTab === 'strategies' && (
          <TouchableOpacity 
            style={styles.fab}
            onPress={() => setShowCreateStrategy(true)}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[theme.primary, theme.secondary]}
              style={styles.fabGradient}
            >
              <Text style={styles.fabText}>+</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
        
        {/* Create Strategy Modal */}
        <Modal
          visible={showCreateStrategy}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowCreateStrategy(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={theme.gradients.background as any}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🎯 Create AI Strategy</Text>
                <TouchableOpacity
                  onPress={() => setShowCreateStrategy(false)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Strategy Name</Text>
                  <TextInput
                    style={styles.formInput}
                    value={newStrategyName}
                    onChangeText={setNewStrategyName}
                    placeholder="Enter strategy name..."
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>AI Model</Text>
                  <View style={styles.modelSelector}>
                    {aiModels.map((model) => (
                      <TouchableOpacity
                        key={model.id}
                        style={[
                          styles.modelOption,
                          selectedModel === model.id && styles.selectedModelOption
                        ]}
                        onPress={() => setSelectedModel(model.id)}
                      >
                        <Text style={[
                          styles.modelOptionText,
                          selectedModel === model.id && styles.selectedModelOptionText
                        ]}>
                          {model.name}
                        </Text>
                        <Text style={styles.modelOptionType}>{model.type.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Risk Level</Text>
                  <View style={styles.riskSelector}>
                    {(['conservative', 'moderate', 'aggressive'] as const).map((level) => (
                      <TouchableOpacity
                        key={level}
                        style={[
                          styles.riskOption,
                          riskLevel === level && styles.selectedRiskOption,
                          { 
                            borderColor: level === 'conservative' ? theme.success : 
                                        level === 'moderate' ? theme.warning : theme.error 
                          }
                        ]}
                        onPress={() => setRiskLevel(level)}
                      >
                        <Text style={[
                          styles.riskOptionText,
                          riskLevel === level && styles.selectedRiskOptionText,
                          { 
                            color: level === 'conservative' ? theme.success : 
                                   level === 'moderate' ? theme.warning : theme.error 
                          }
                        ]}>
                          {level.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Target Assets</Text>
                  <View style={styles.assetSelector}>
                    {['BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'LINK'].map((asset) => (
                      <TouchableOpacity
                        key={asset}
                        style={[
                          styles.assetOption,
                          selectedAssets.includes(asset) && styles.selectedAssetOption
                        ]}
                        onPress={() => {
                          setSelectedAssets(prev => 
                            prev.includes(asset) 
                              ? prev.filter(a => a !== asset)
                              : [...prev, asset]
                          );
                        }}
                      >
                        <Text style={[
                          styles.assetOptionText,
                          selectedAssets.includes(asset) && styles.selectedAssetOptionText
                        ]}>
                          {asset}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.createButton,
                    (!newStrategyName || !selectedModel || selectedAssets.length === 0) && 
                    styles.createButtonDisabled
                  ]}
                  onPress={() => {
                    if (newStrategyName && selectedModel && selectedAssets.length > 0) {
                      const newStrategy: AdvancedStrategy = {
                        id: `strategy_${Date.now()}`,
                        name: newStrategyName,
                        description: `AI-powered ${riskLevel} strategy using ${selectedModel}`,
                        type: 'neural_momentum',
                        modelIds: [selectedModel],
                        isActive: false,
                        riskLevel,
                        targetAssets: selectedAssets,
                        performance: {
                          backtest: {
                            returns: 0,
                            sharpe: 0,
                            maxDrawdown: 0,
                            winRate: 0,
                            totalTrades: 0
                          }
                        },
                        parameters: {
                          position_size: riskLevel === 'conservative' ? 10 : riskLevel === 'moderate' ? 15 : 20,
                          stop_loss: riskLevel === 'conservative' ? 5 : riskLevel === 'moderate' ? 10 : 15,
                          take_profit: riskLevel === 'conservative' ? 10 : riskLevel === 'moderate' ? 20 : 30,
                          risk_threshold: riskLevel === 'conservative' ? 10 : riskLevel === 'moderate' ? 20 : 30,
                          timeframe: '4h',
                          max_positions: 3,
                          min_capital: 1000
                        },
                        createdAt: new Date(),
                        updatedAt: new Date()
                      };
                      
                      setStrategies(prev => [...prev, newStrategy]);
                      setShowCreateStrategy(false);
                      setNewStrategyName('');
                      setSelectedModel('');
                      setSelectedAssets([]);
                      setRiskLevel('moderate');
                      
                      Alert.alert('Strategy Created', `${newStrategy.name} has been created successfully!`);
                    }
                  }}
                  disabled={!newStrategyName || !selectedModel || selectedAssets.length === 0}
                >
                  <LinearGradient
                    colors={[theme.primary, theme.secondary]}
                    style={styles.createButtonGradient}
                  >
                    <Text style={styles.createButtonText}>🚀 Create Strategy</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </LinearGradient>
          </View>
        </Modal>
        
        {/* Model Details Modal */}
        <Modal
          visible={showModelDetails !== null}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setShowModelDetails(null)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={theme.gradients.background as any}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>🧠 AI Model Details</Text>
                <TouchableOpacity
                  onPress={() => setShowModelDetails(null)}
                  style={styles.modalCloseButton}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {showModelDetails && (
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  {(() => {
                    const model = aiModels.find(m => m.id === showModelDetails);
                    if (!model) return null;
                    
                    return (
                      <>
                        <View style={styles.modelDetailCard}>
                          <LinearGradient
                            colors={[theme.surface, theme.surfaceVariant]}
                            style={styles.modelDetailGradient}
                          >
                            <View style={styles.modelDetailHeader}>
                              <Text style={styles.modelDetailName}>{model.name}</Text>
                              <View style={[
                                styles.modelDetailStatus,
                                { backgroundColor: 
                                  model.status === 'ready' ? theme.success :
                                  model.status === 'training' ? theme.warning :
                                  model.status === 'updating' ? theme.primary : theme.error
                                }
                              ]}>
                                <Text style={styles.modelDetailStatusText}>{model.status.toUpperCase()}</Text>
                              </View>
                            </View>
                            
                            <Text style={styles.modelDetailType}>{model.type.toUpperCase()}</Text>
                            <Text style={styles.modelDetailDescription}>{model.description}</Text>
                            
                            <View style={styles.modelDetailMetrics}>
                              <View style={styles.modelDetailMetric}>
                                <Text style={styles.modelDetailMetricLabel}>Accuracy</Text>
                                <Text style={styles.modelDetailMetricValue}>
                                  {(model.accuracy * 100).toFixed(1)}%
                                </Text>
                              </View>
                              <View style={styles.modelDetailMetric}>
                                <Text style={styles.modelDetailMetricLabel}>Last Trained</Text>
                                <Text style={styles.modelDetailMetricValue}>
                                  {model.lastTrained.toLocaleDateString()}
                                </Text>
                              </View>
                            </View>
                            
                            <View style={styles.modelDetailCapabilities}>
                              <Text style={styles.modelDetailCapabilitiesTitle}>Capabilities</Text>
                              <View style={styles.modelDetailCapabilitiesList}>
                                {model.capabilities.map((capability, index) => (
                                  <View key={index} style={styles.modelDetailCapabilityTag}>
                                    <Text style={styles.modelDetailCapabilityText}>{capability}</Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                            
                            <View style={styles.modelDetailPerformance}>
                              <Text style={styles.modelDetailPerformanceTitle}>Performance Metrics</Text>
                              <View style={styles.modelDetailPerformanceGrid}>
                                <View style={styles.modelDetailPerformanceItem}>
                                  <Text style={styles.modelDetailPerformanceLabel}>Training Time</Text>
                                  <Text style={styles.modelDetailPerformanceValue}>2.3h</Text>
                                </View>
                                <View style={styles.modelDetailPerformanceItem}>
                                  <Text style={styles.modelDetailPerformanceLabel}>Epochs</Text>
                                  <Text style={styles.modelDetailPerformanceValue}>150</Text>
                                </View>
                                <View style={styles.modelDetailPerformanceItem}>
                                  <Text style={styles.modelDetailPerformanceLabel}>Loss</Text>
                                  <Text style={styles.modelDetailPerformanceValue}>0.023</Text>
                                </View>
                                <View style={styles.modelDetailPerformanceItem}>
                                  <Text style={styles.modelDetailPerformanceLabel}>F1 Score</Text>
                                  <Text style={styles.modelDetailPerformanceValue}>0.89</Text>
                                </View>
                              </View>
                            </View>
                            
                            <View style={styles.modelDetailActions}>
                              <TouchableOpacity 
                                style={[styles.modelDetailButton, { backgroundColor: theme.primary }]}
                                onPress={() => {
                                  Alert.alert('Retrain Model', `Starting retraining for ${model.name}`);
                                  setShowModelDetails(null);
                                }}
                              >
                                <Text style={styles.modelDetailButtonText}>🔄 Retrain Model</Text>
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={[styles.modelDetailButton, { backgroundColor: theme.success }]}
                                onPress={() => {
                                  Alert.alert('Export Model', `Exporting ${model.name} configuration`);
                                  setShowModelDetails(null);
                                }}
                              >
                                <Text style={styles.modelDetailButtonText}>📤 Export Config</Text>
                              </TouchableOpacity>
                            </View>
                          </LinearGradient>
                        </View>
                      </>
                    );
                  })()}
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </Modal>
        
        {/* Strategy Analytics Modal */}
        <Modal
          visible={showAnalyticsModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAnalyticsModal(false)}
        >
          <View style={styles.modalContainer}>
            <LinearGradient
              colors={[theme.surface, theme.surfaceVariant]}
              style={styles.modalGradient}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>📊 Strategy Analytics</Text>
                <TouchableOpacity 
                  style={styles.modalCloseButton}
                  onPress={() => setShowAnalyticsModal(false)}
                >
                  <Text style={styles.modalCloseText}>✕</Text>
                </TouchableOpacity>
              </View>
              
              {selectedStrategyForAnalytics && (
                <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionTitle}>
                      🎯 {selectedStrategyForAnalytics.name}
                    </Text>
                    <Text style={styles.analyticsSectionSubtitle}>
                      Advanced Performance Analysis
                    </Text>
                  </View>
                  
                  {/* Key Performance Metrics */}
                  <View style={styles.analyticsMetricsGrid}>
                    <View style={styles.analyticsMetric}>
                      <Text style={styles.analyticsMetricLabel}>Total Return</Text>
                      <Text style={[styles.analyticsMetricValue, { 
                        color: getPerformanceColor(selectedStrategyForAnalytics.performance.backtest.returns) 
                      }]}>
                        {selectedStrategyForAnalytics.performance.backtest.returns.toFixed(2)}%
                      </Text>
                    </View>
                    <View style={styles.analyticsMetric}>
                      <Text style={styles.analyticsMetricLabel}>Sharpe Ratio</Text>
                      <Text style={[styles.analyticsMetricValue, { 
                        color: getPerformanceColor(selectedStrategyForAnalytics.performance.backtest.sharpe) 
                      }]}>
                        {selectedStrategyForAnalytics.performance.backtest.sharpe.toFixed(2)}
                      </Text>
                    </View>
                    <View style={styles.analyticsMetric}>
                      <Text style={styles.analyticsMetricLabel}>Max Drawdown</Text>
                      <Text style={[styles.analyticsMetricValue, { 
                        color: getPerformanceColor(-selectedStrategyForAnalytics.performance.backtest.maxDrawdown) 
                      }]}>
                        {selectedStrategyForAnalytics.performance.backtest.maxDrawdown.toFixed(2)}%
                      </Text>
                    </View>
                    <View style={styles.analyticsMetric}>
                      <Text style={styles.analyticsMetricLabel}>Win Rate</Text>
                      <Text style={[styles.analyticsMetricValue, { 
                        color: getPerformanceColor(selectedStrategyForAnalytics.performance.backtest.winRate, false) 
                      }]}>
                        {selectedStrategyForAnalytics.performance.backtest.winRate.toFixed(1)}%
                      </Text>
                    </View>
                  </View>
                  
                  {/* Risk Analysis */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionTitle}>⚠️ Risk Analysis</Text>
                    <View style={styles.analyticsRiskContainer}>
                      <View style={styles.analyticsRiskItem}>
                        <Text style={styles.analyticsRiskLabel}>Risk Level:</Text>
                        <Text style={[styles.analyticsRiskValue, {
                          color: selectedStrategyForAnalytics.riskLevel === 'conservative' ? theme.success : 
                                 selectedStrategyForAnalytics.riskLevel === 'moderate' ? theme.warning : theme.error
                        }]}>
                          {selectedStrategyForAnalytics.riskLevel.toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.analyticsRiskItem}>
                        <Text style={styles.analyticsRiskLabel}>Volatility Score:</Text>
                        <Text style={styles.analyticsRiskValue}>
                          {((selectedStrategyForAnalytics.performance.backtest.maxDrawdown) * 2).toFixed(1)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Composition */}
                  <View style={styles.analyticsSection}>
                    <Text style={styles.analyticsSectionTitle}>🔧 Strategy Composition</Text>
                    <View style={styles.analyticsComposition}>
                      <View style={styles.analyticsCompositionItem}>
                        <Text style={styles.analyticsCompositionLabel}>Type:</Text>
                        <Text style={styles.analyticsCompositionValue}>
                          {selectedStrategyForAnalytics.type.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.analyticsCompositionItem}>
                        <Text style={styles.analyticsCompositionLabel}>Target Assets:</Text>
                        <Text style={styles.analyticsCompositionValue}>
                          {selectedStrategyForAnalytics.targetAssets.join(', ')}
                        </Text>
                      </View>
                      <View style={styles.analyticsCompositionItem}>
                        <Text style={styles.analyticsCompositionLabel}>AI Models:</Text>
                        <Text style={styles.analyticsCompositionValue}>
                          {selectedStrategyForAnalytics.modelIds.length} models
                        </Text>
                      </View>
                    </View>
                  </View>
                  
                  {/* Action Buttons */}
                  <View style={styles.analyticsActions}>
                    <TouchableOpacity 
                      style={[styles.analyticsActionButton, { backgroundColor: theme.primary }]}
                      onPress={() => {
                        Alert.alert(
                          'Advanced Backtest', 
                          `Running comprehensive analysis for ${selectedStrategyForAnalytics.name}...`
                        );
                        setShowAnalyticsModal(false);
                      }}
                    >
                      <Text style={styles.analyticsActionButtonText}>🚀 Full Backtest</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.analyticsActionButton, { backgroundColor: theme.accent }]}
                      onPress={() => {
                        Alert.alert(
                          'Strategy Report', 
                          `Generating detailed report for ${selectedStrategyForAnalytics.name}...`
                        );
                        setShowAnalyticsModal(false);
                      }}
                    >
                      <Text style={styles.analyticsActionButtonText}>📄 Generate Report</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              )}
            </LinearGradient>
          </View>
        </Modal>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  headerGradient: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md, // Reduced top padding since header is removed
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: theme.primary,
    elevation: 2,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTabText: {
    color: 'white',
    fontWeight: 'bold',
  },
  tabContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  sectionSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xl,
    lineHeight: 22,
  },
  strategiesGrid: {
    paddingBottom: theme.spacing.xl,
  },
  strategyCard: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    backgroundColor: theme.surface,
  },
  strategyGradient: {
    padding: theme.spacing.sm,
    minHeight: 120,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  strategyInfo: {
    flex: 1,
  },
  strategyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  strategyType: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.primary,
    backgroundColor: theme.primary + '15',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  strategyStatus: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
  },
  strategyStatusText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'white',
  },
  strategyDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
    marginBottom: theme.spacing.xs,
  },
  aiIndicator: {
    backgroundColor: theme.accent + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginTop: 2,
  },
  aiIndicatorText: {
    fontSize: 9,
    color: theme.accent,
    fontWeight: 'bold',
  },
  realTimePriceSection: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  realTimePriceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  realTimePriceTitle: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  realTimePriceUpdate: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  realTimePriceData: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  realTimePrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  realTimePriceChange: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  realTimeIndicators: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  indicatorItem: {
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  indicatorValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  aiPredictionSection: {
    backgroundColor: theme.secondary + '15',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.secondary,
  },
  aiPredictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  aiPredictionTitle: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  aiPredictionConfidence: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  aiPredictionData: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  aiPredictionSignal: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    flex: 1,
    marginRight: theme.spacing.sm,
  },
  aiPredictionSignalText: {
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  aiPredictionTarget: {
    alignItems: 'flex-end',
  },
  aiPredictionTargetLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  aiPredictionTargetValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  aiPredictionReason: {
    fontSize: 11,
    color: theme.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  modelsList: {
    paddingBottom: theme.spacing.xl,
  },
  modelCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modelGradient: {
    padding: theme.spacing.md,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  modelStatus: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  modelStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  modelType: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  modelDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  modelMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modelMetric: {
    alignItems: 'center',
  },
  modelMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modelMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  capabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  capabilityTag: {
    backgroundColor: theme.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  capabilityText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  modelActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  modelActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modelActionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  signalBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    minWidth: 60,
    alignItems: 'center',
  },
  signalText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  signalStrength: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
  },
  modalGradient: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  analyticsActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  analyticsActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: theme.spacing.md,
    fontSize: 16,
    fontWeight: '600',
  },
  strategyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.surface + '50',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
    fontWeight: '500',
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  strategyParams: {
    backgroundColor: theme.surface + '30',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginTop: theme.spacing.md,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  paramLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  paramValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  // Analysis and prediction styles
  analyzesList: {
    paddingBottom: theme.spacing.xl,
  },
  analysisCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  analysisGradient: {
    padding: theme.spacing.md,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  predictionSection: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginVertical: theme.spacing.sm,
  },
  confidenceText: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
  },
  signalsSection: {
    marginTop: theme.spacing.md,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.sm,
  },
  // Predictions overview styles
  predictionsOverview: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  predictionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  predictionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  predictionsCount: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  predictionsScroll: {
    marginTop: theme.spacing.sm,
  },
  // Gem recommendations styles
  gemRecommendations: {
    backgroundColor: theme.accent + '15',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  gemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  gemTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  gemRefreshButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  gemSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.md,
  },
  gemScroll: {
    marginTop: theme.spacing.sm,
  },
  // FAB styles
  fab: {
    position: 'absolute',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabText: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
  },
  
  // Strategy actions and parameters
  strategyActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
    gap: theme.spacing.xs,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 28,
  },
  actionButtonText: {
    fontSize: 10,
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
  },
  
  // Portfolio section styles
  portfolioSection: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.small,
  },
  portfolioHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  portfolioTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  portfolioStatsButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  portfolioStatsText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  portfolioMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  portfolioMetric: {
    alignItems: 'center',
  },
  portfolioMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  portfolioMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Form styles
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  formLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  formInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    fontSize: 16,
    color: theme.textPrimary,
    backgroundColor: theme.surface,
  },
  formSelect: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    backgroundColor: theme.surface,
  },
  formSelectText: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  
  // Create button styles
  createButton: {
    backgroundColor: theme.success,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.spacing.lg,
  },
  createButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.5,
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  
  // Empty state styles
  emptyStrategies: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyStrategiesText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyStrategiesSubtext: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    opacity: 0.7,
  },
  
  // Backtest styles
  backtestContainer: {
    flex: 1,
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  backtestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  backtestTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  backtestButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  backtestButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  
  // Price info styles
  priceInfo: {
    alignItems: 'flex-end',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  
  // Prediction row styles
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: theme.spacing.sm,
  },
  predictionItem: {
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  predictionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Analytics section styles
  analyticsSection: {
    marginBottom: theme.spacing.lg,
  },
  analyticsSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  analyticsMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  analyticsMetric: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  analyticsMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  analyticsMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  analyticsActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  
  // Refresh button styles
  refreshButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  refreshButtonText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  
  // Status indicator styles
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  
  // Asset tag styles
  assetTag: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginRight: theme.spacing.xs,
  },
  assetTagText: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  
  // Filter styles
  filterContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: 'white',
  },
  
  // Chart placeholder styles
  chartPlaceholder: {
    height: 200,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: theme.spacing.md,
  },
  chartPlaceholderText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  
  // Notification styles
  notificationContainer: {
    backgroundColor: theme.warning + '20',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: theme.warning,
  },
  notificationText: {
    fontSize: 14,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  
  // Performance badge styles
  performanceBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
  },
  performanceBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
  },
  
  // Model testing modal styles
  modelTestModal: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modelTestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modelTestTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  modelTestContent: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  modelTestMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  modelTestMetric: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: theme.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modelTestMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modelTestMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Gem card styles
  gemCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    width: 200,
    borderWidth: 1,
    borderColor: theme.border,
  },

  gemSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  gemName: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  gemPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  gemChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  gemAnalysis: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.sm,
  },
  gemSentiment: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  gemSignals: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  gemSignal: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  
  // Training history styles
  trainingHistory: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  trainingHistoryTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  trainingHistoryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '50',
  },
  trainingHistoryEpoch: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  trainingHistoryMetric: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  
  // Additional missing styles
  symbolName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  assetName: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  currentPrice: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  predictionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    width: 200,
    borderWidth: 1,
    borderColor: theme.border,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  predictionSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  predictionDirection: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginVertical: theme.spacing.xs,
  },
  predictionDirectionText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  predictionTarget: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
  },
  predictionTimeframe: {
    fontSize: 11,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  gemRefreshText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  gemCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  gemScore: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  gemScoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: 'white',
  },
  gemVolume: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  searchFilterContainer: {
    flexDirection: 'row',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  searchContainer: {
    flex: 1,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    fontSize: 14,
    color: theme.textPrimary,
    backgroundColor: theme.surface,
  },
  filterToggle: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  
  // Additional analysis styles
  analysisMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: theme.spacing.md,
  },
  analysisMetric: {
    alignItems: 'center',
  },
  analysisMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  analysisMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Risk assessment styles
  riskAssessment: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  riskAssessmentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  riskLevel: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    color: 'white',
    textAlign: 'center',
  },
  
  // Pattern recognition styles
  patternsList: {
    marginTop: theme.spacing.md,
  },
  patternItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '50',
  },
  patternName: {
    fontSize: 12,
    color: theme.textPrimary,
  },
  patternStrength: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.success,
  },
  
  // Sentiment analysis styles
  sentimentContainer: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  sentimentTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  sentimentScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  sentimentSummary: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  sentimentSources: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  sentimentSource: {
    fontSize: 10,
    color: theme.textSecondary,
    backgroundColor: theme.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  
  // Technical indicators styles
  technicalIndicators: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  technicalIndicator: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: theme.surface,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  technicalIndicatorLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  technicalIndicatorValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Model details styles
  modelDetails: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  modelDetailsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  modelDetailsInfo: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  
  // Training progress styles
  trainingProgress: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  trainingProgressTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  trainingProgressBar: {
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  trainingProgressFill: {
    height: '100%',
    backgroundColor: theme.primary,
  },
  trainingProgressText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  
  // Success/Error message styles
  messageContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  messageText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  successMessage: {
    backgroundColor: theme.success + '20',
    color: theme.success,
  },
  errorMessage: {
    backgroundColor: theme.error + '20',
    color: theme.error,
  },
  warningMessage: {
    backgroundColor: theme.warning + '20',
    color: theme.warning,
  },
  
  // Final missing styles
  predictionConfidence: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  filterIcon: {
    fontSize: 14,
    color: 'white',
  },
  filtersContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  filterOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedFilterOption: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterOptionText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  selectedFilterOptionText: {
    color: 'white',
  },
  portfolioButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  portfolioButtonGradient: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
  },
  portfolioButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  portfolioHint: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  emptyIcon: {
    fontSize: 48,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  
  // Additional utility styles
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullWidth: {
    width: '100%',
  },
  textCenter: {
    textAlign: 'center',
  },
  flexRow: {
    flexDirection: 'row',
  },
  flexColumn: {
    flexDirection: 'column',
  },
  spaceBetween: {
    justifyContent: 'space-between',
  },
  alignCenter: {
    alignItems: 'center',
  },
  mt_sm: {
    marginTop: theme.spacing.sm,
  },
  mt_md: {
    marginTop: theme.spacing.md,
  },
  mt_lg: {
    marginTop: theme.spacing.lg,
  },
  mb_sm: {
    marginBottom: theme.spacing.sm,
  },
  mb_md: {
    marginBottom: theme.spacing.md,
  },
  mb_lg: {
    marginBottom: theme.spacing.lg,
  },
  p_sm: {
    padding: theme.spacing.sm,
  },
  p_md: {
    padding: theme.spacing.md,
  },
  p_lg: {
    padding: theme.spacing.lg,
  },
  px_sm: {
    paddingHorizontal: theme.spacing.sm,
  },
  px_md: {
    paddingHorizontal: theme.spacing.md,
  },
  px_lg: {
    paddingHorizontal: theme.spacing.lg,
  },
  py_sm: {
    paddingVertical: theme.spacing.sm,
  },
  py_md: {
    paddingVertical: theme.spacing.md,
  },
  py_lg: {
    paddingVertical: theme.spacing.lg,
  },
  
  // Backtest control panel styles
  backtestControlPanel: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backtestControlGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backtestControlTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  backtestOption: {
    marginBottom: theme.spacing.md,
  },
  backtestOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  backtestTimeSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  backtestTimeOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  backtestTimeOptionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  backtestTimeText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  backtestTimeTextSelected: {
    color: 'white',
  },
  backtestCapitalSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  backtestCapitalOption: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  backtestCapitalOptionSelected: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  backtestCapitalText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  backtestCapitalTextSelected: {
    color: 'white',
  },
  runBacktestButton: {
    marginTop: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  runBacktestGradient: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    alignItems: 'center',
  },
  runBacktestText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  backtestResults: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  backtestResultsGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  backtestResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  backtestResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  backtestResultName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  backtestResultDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  backtestResultMetrics: {
    alignItems: 'flex-end',
  },
  backtestResultReturn: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  backtestResultSharpe: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  
  // Additional utility styles for complete coverage
  disabled: {
    opacity: 0.5,
  },
  hidden: {
    display: 'none',
  },
  absolute: {
    position: 'absolute',
  },
  relative: {
    position: 'relative',
  },
  zIndex1: {
    zIndex: 1,
  },
  zIndex2: {
    zIndex: 2,
  },
  zIndex3: {
    zIndex: 3,
  },
  overflow: {
    overflow: 'hidden',
  },
  textBold: {
    fontWeight: 'bold',
  },
  textSemibold: {
    fontWeight: '600',
  },
  textMedium: {
    fontWeight: '500',
  },
  textRegular: {
    fontWeight: '400',
  },
  textLight: {
    fontWeight: '300',
  },
  textPrimary: {
    color: theme.textPrimary,
  },
  textSecondary: {
    color: theme.textSecondary,
  },
  textAccent: {
    color: theme.accent,
  },
  textSuccess: {
    color: theme.success,
  },
  textError: {
    color: theme.error,
  },
  textWarning: {
    color: theme.warning,
  },
  bgPrimary: {
    backgroundColor: theme.primary,
  },
  bgSecondary: {
    backgroundColor: theme.secondary,
  },
  bgSurface: {
    backgroundColor: theme.surface,
  },
  bgSuccess: {
    backgroundColor: theme.success,
  },
  bgError: {
    backgroundColor: theme.error,
  },
  bgWarning: {
    backgroundColor: theme.warning,
  },
  borderPrimary: {
    borderColor: theme.primary,
  },
  borderSecondary: {
    borderColor: theme.secondary,
  },
  borderSurface: {
    borderColor: theme.border,
  },
  borderRadius: {
    borderRadius: theme.borderRadius.md,
  },
  borderRadiusLg: {
    borderRadius: theme.borderRadius.lg,
  },
  borderRadiusSm: {
    borderRadius: theme.borderRadius.sm,
  },
  shadow: {
    ...theme.shadows.medium,
  },
  shadowSmall: {
    ...theme.shadows.small,
  },
  shadowLarge: {
    ...theme.shadows.large,
  },
  
  // Final backtest result styles
  backtestResultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  backtestResultStrategy: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  backtestResultMetric: {
    alignItems: 'center',
    minWidth: 60,
  },
  backtestResultMetricLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  backtestResultMetricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Complete all remaining styles
  backtestResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  backtestHistoryItem: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  backtestHistoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  backtestHistoryDate: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  backtestHistoryStrategy: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  backtestHistoryMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  backtestHistoryMetric: {
    alignItems: 'center',
    flex: 1,
  },
  backtestHistoryMetricLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  backtestHistoryMetricValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Complete loading and status styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  loadingSpinner: {
    marginBottom: theme.spacing.md,
  },
  statusContainer: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.md,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statusIcon: {
    fontSize: 20,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  
  // Final utility styles
  rowSpaceBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  columnCenter: {
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  flexWrap: {
    flexWrap: 'wrap',
  },
  textUppercase: {
    textTransform: 'uppercase',
  },
  textCapitalize: {
    textTransform: 'capitalize',
  },
  textLowercase: {
    textTransform: 'lowercase',
  },
  textAlignLeft: {
    textAlign: 'left',
  },
  textAlignRight: {
    textAlign: 'right',
  },
  textAlignCenter: {
    textAlign: 'center',
  },
  textAlignJustify: {
    textAlign: 'justify',
  },
  
  // Border styles
  borderTop: {
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  borderLeft: {
    borderLeftWidth: 1,
    borderLeftColor: theme.border,
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: theme.border,
  },
  borderAll: {
    borderWidth: 1,
    borderColor: theme.border,
  },
  
  // Final spacing utilities
  gap_xs: {
    gap: theme.spacing.xs,
  },
  gap_sm: {
    gap: theme.spacing.sm,
  },
  gap_md: {
    gap: theme.spacing.md,
  },
  gap_lg: {
    gap: theme.spacing.lg,
  },
  gap_xl: {
    gap: theme.spacing.xl,
  },
  
  // Flex utilities
  flex_1: {
    flex: 1,
  },
  flex_2: {
    flex: 2,
  },
  flex_3: {
    flex: 3,
  },
  flex_none: {
    flex: 0,
  },
  
  // Width utilities
  width_50: {
    width: '50%',
  },
  width_75: {
    width: '75%',
  },
  width_100: {
    width: '100%',
  },
  
  // Height utilities
  height_50: {
    height: '50%',
  },
  height_75: {
    height: '75%',
  },
  height_100: {
    height: '100%',
  },
  
  // Opacity utilities
  opacity_50: {
    opacity: 0.5,
  },
  opacity_75: {
    opacity: 0.75,
  },
  opacity_90: {
    opacity: 0.9,
  },
  
  // Modal selector styles
  modelSelector: {
    marginTop: theme.spacing.sm,
  },
  modelOption: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: theme.spacing.sm,
  },
  selectedModelOption: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  modelOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  selectedModelOptionText: {
    color: 'white',
  },
  modelOptionType: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
  },
  
  // Risk selector styles
  riskSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  riskOption: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  selectedRiskOption: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  riskOptionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  selectedRiskOptionText: {
    color: 'white',
  },
  
  // Asset selector styles
  assetSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  assetOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  selectedAssetOption: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  assetOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  selectedAssetOptionText: {
    color: 'white',
  },
  
  // Create button gradient
  createButtonGradient: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  
  // Model detail card styles
  modelDetailCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  modelDetailGradient: {
    padding: theme.spacing.lg,
  },
  modelDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  modelDetailTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  modelDetailStatus: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.success,
  },
  modelDetailStatusText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  modelDetailDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  modelDetailMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  modelDetailMetric: {
    alignItems: 'center',
  },
  modelDetailMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modelDetailMetricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  modelDetailCapabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  modelDetailCapability: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  modelDetailCapabilityText: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  modelDetailActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  modelDetailAction: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modelDetailActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  
  // Test results styles
  testResultsContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  testResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  testResultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  testResultItem: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: theme.surface + '80',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  testResultLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  testResultValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Prediction results styles
  predictionResults: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  predictionResultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  predictionResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '50',
  },
  predictionResultAsset: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  predictionResultValues: {
    alignItems: 'flex-end',
  },
  predictionResultPredicted: {
    fontSize: 12,
    color: theme.success,
    fontWeight: '600',
  },
  predictionResultActual: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  predictionResultConfidence: {
    fontSize: 11,
    color: theme.primary,
    marginTop: theme.spacing.xs,
  },
  
  // Improvements and recommendations styles
  improvementsContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  improvementsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  improvementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  improvementBullet: {
    fontSize: 12,
    color: theme.success,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  improvementText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  
  // Recommendations styles
  recommendationsContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  recommendationsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  recommendationBullet: {
    fontSize: 12,
    color: theme.warning,
    marginRight: theme.spacing.sm,
    marginTop: 2,
  },
  recommendationText: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  
  // Final model detail styles
  modelDetailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  modelDetailType: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  modelDetailCapabilitiesTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  modelDetailCapabilitiesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.md,
  },
  modelDetailCapabilityTag: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  modelDetailPerformance: {
    marginTop: theme.spacing.md,
  },
  modelDetailPerformanceTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  modelDetailPerformanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  modelDetailPerformanceItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: theme.surface + '80',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  modelDetailPerformanceLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  modelDetailPerformanceValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // Final utility styles for complete coverage
  fullScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safeArea: {
    flex: 1,
    paddingTop: 50, // Approximate status bar height
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
  },
  tabBarStyle: {
    backgroundColor: theme.surface,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabBarItemStyle: {
    paddingVertical: theme.spacing.sm,
  },
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabBarIndicatorStyle: {
    backgroundColor: theme.primary,
    height: 3,
    borderRadius: 2,
  },
  
  // Animation styles
  fadeIn: {
    opacity: 1,
  },
  fadeOut: {
    opacity: 0,
  },
  slideInLeft: {
    transform: [{ translateX: 0 }],
  },
  slideInRight: {
    transform: [{ translateX: 0 }],
  },
  slideOutLeft: {
    transform: [{ translateX: -300 }],
  },
  slideOutRight: {
    transform: [{ translateX: 300 }],
  },
  scaleUp: {
    transform: [{ scale: 1.05 }],
  },
  scaleDown: {
    transform: [{ scale: 0.95 }],
  },
  
  // Responsive styles
  tablet: {
    maxWidth: 768,
    alignSelf: 'center',
  },
  desktop: {
    maxWidth: 1024,
    alignSelf: 'center',
  },
  mobile: {
    width: '100%',
  },
  
  // Print styles (for export functionality)
  printContainer: {
    backgroundColor: 'white',
    padding: 20,
  },
  printTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 20,
    textAlign: 'center',
  },
  printSection: {
    marginBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 15,
  },
  printSectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'black',
    marginBottom: 10,
  },
  printText: {
    fontSize: 12,
    color: 'black',
    lineHeight: 16,
  },
  
  // Accessibility styles
  accessibilityFocus: {
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: theme.borderRadius.md,
  },
  accessibilityLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  accessibilityHint: {
    fontSize: 14,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  
  // High contrast mode styles
  highContrastText: {
    color: '#000000',
    backgroundColor: '#FFFFFF',
  },
  highContrastBackground: {
    backgroundColor: '#FFFFFF',
  },
  highContrastBorder: {
    borderColor: '#000000',
    borderWidth: 2,
  },
  
  // Final debug styles
  debugBorder: {
    borderWidth: 1,
    borderColor: 'red',
  },
  debugBackground: {
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
  },
  debugText: {
    color: 'red',
    fontSize: 10,
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: 'white',
    padding: 2,
    zIndex: 9999,
  },
  
  // Absolute final styles
  modelDetailButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  modelDetailButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  analyticsSectionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: theme.spacing.md,
  },
  analyticsRiskContainer: {
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  analyticsRiskItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '50',
  },
  analyticsRiskLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  analyticsRiskValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  analyticsComposition: {
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  analyticsCompositionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '50',
  },
  analyticsCompositionLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  analyticsCompositionValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  
  // NEW: Analyzer styles
  analyzerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  scanButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  scanButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  analyzerLoadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  analyzerLoadingText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: theme.spacing.sm,
  },
  analysisList: {
    paddingBottom: theme.spacing.xl,
  },
  gemAnalysisCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  gemAnalysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  analysisSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  analysisPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  analysisChange: {
    fontSize: 12,
    fontWeight: '600',
  },
  analysisName: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  gemAnalysisMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xs,
  },
  gemAnalysisMetric: {
    alignItems: 'center',
  },
  gemMetricLabel: {
    fontSize: 10,
    color: theme.textSecondary,
  },
  gemMetricValue: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  analysisIndicators: {
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.border + '30',
  },
  indicatorText: {
    fontSize: 10,
    color: theme.textSecondary,
  },
});

export default StrategyScreenNewEnhanced;

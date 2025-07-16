import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { LineChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTrading } from '../context/TradingContext';
import { theme } from '../theme/colors';
import { historicalBacktestService, BacktestResult, StrategyConfig } from '../services/historicalBacktestService';
import { marketDataProcessor } from '../services/marketDataProcessor';
import { useVectorFluxAI } from '../ai/useVectorFluxAI';

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
    shortTerm: number; // 1-7 days
    mediumTerm: number; // 1-4 weeks
    longTerm: number; // 1-3 months
    confidence: number;
  };
  patterns: {
    name: string;
    strength: number;
    timeframe: string;
  }[];
  sentiment: {
    score: number;
    sources: string[];
    summary: string;
    trend: 'positive' | 'negative' | 'neutral';
  };
  technicalSignals: {
    rsi: number;
    macd: number;
    volume: number;
    trend: 'bullish' | 'bearish' | 'neutral';
    signals: { indicator: string; signal: string; strength: number }[];
  };
  riskAssessment: {
    volatility: number;
    correlation: number;
    liquidityRisk: number;
    overall: 'low' | 'medium' | 'high';
    score: number;
  };
  modelPredictions: {
    [modelId: string]: {
      prediction: number;
      confidence: number;
      reasoning: string;
    };
  };
}

interface AdvancedStrategy {
  id: string;
  name: string;
  description: string;
  type: 'neural_momentum' | 'lstm_reversal' | 'transformer_sentiment' | 'gan_synthetic' | 'rl_adaptive';
  modelIds: string[];
  parameters: {
    [key: string]: number | string | boolean;
  };
  performance: {
    backtest: {
      returns: number;
      sharpe: number;
      maxDrawdown: number;
      winRate: number;
      totalTrades: number;
    };
    live?: {
      returns: number;
      trades: number;
      lastUpdate: Date;
    };
  };
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  targetAssets: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StrategyScreenNewEnhanced: React.FC = (): JSX.Element => {
  const { state } = useTrading();
  
  // Tab management
  const [selectedTab, setSelectedTab] = useState<'analyzer' | 'models' | 'strategies' | 'backtest'>('analyzer');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [aiTraining, setAiTraining] = useState<{ [key: string]: boolean }>({});
  
  // Data states
  const [marketAnalyses, setMarketAnalyses] = useState<MarketAnalysis[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [strategies, setStrategies] = useState<AdvancedStrategy[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['BTC', 'ETH', 'AAPL']);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyConfig | null>(null);
  const [backtestPeriod, setBacktestPeriod] = useState(90);
  
  // Modal states
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showCreateStrategyModal, setShowCreateStrategyModal] = useState(false);
  const [showTemplateDetailsModal, setShowTemplateDetailsModal] = useState(false);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MarketAnalysis | null>(null);
  const [selectedTemplateForDetails, setSelectedTemplateForDetails] = useState<any>(null);
  
  // Custom strategy creation state
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    description: '',
    type: 'neural_momentum' as AdvancedStrategy['type'],
    riskLevel: 'moderate' as AdvancedStrategy['riskLevel'],
    targetAssets: [] as string[],
    parameters: {
      position_size: 15,
      stop_loss: 10,
      take_profit: 20,
      risk_threshold: 15
    }
  });
  
  // Animation
  const [scanningAnimation] = useState(new Animated.Value(0));
  
  // Available assets for analysis - Integrated with GemFinderScreen discoveries
  const availableAssets = useMemo(() => [
    // Premium Cryptocurrencies (Major)
    { symbol: 'BTC', name: 'Bitcoin', type: 'crypto', category: 'infrastructure', potential: 'high' },
    { symbol: 'ETH', name: 'Ethereum', type: 'crypto', category: 'infrastructure', potential: 'high' },
    { symbol: 'ADA', name: 'Cardano', type: 'crypto', category: 'infrastructure', potential: 'medium' },
    { symbol: 'SOL', name: 'Solana', type: 'crypto', category: 'infrastructure', potential: 'high' },
    { symbol: 'DOT', name: 'Polkadot', type: 'crypto', category: 'infrastructure', potential: 'medium' },
    { symbol: 'LINK', name: 'Chainlink', type: 'crypto', category: 'defi', potential: 'high' },
    { symbol: 'MATIC', name: 'Polygon', type: 'crypto', category: 'infrastructure', potential: 'high' },
    { symbol: 'AVAX', name: 'Avalanche', type: 'crypto', category: 'infrastructure', potential: 'high' },
    
    // Gem Cryptocurrencies (From GemFinderScreen)
    { symbol: 'INJ', name: 'Injective Protocol', type: 'crypto', category: 'defi', potential: 'high' },
    { symbol: 'ROSE', name: 'Oasis Network', type: 'crypto', category: 'privacy', potential: 'extreme' },
    { symbol: 'FTM', name: 'Fantom', type: 'crypto', category: 'infrastructure', potential: 'high' },
    { symbol: 'OCEAN', name: 'Ocean Protocol', type: 'crypto', category: 'ai', potential: 'high' },
    { symbol: 'RUNE', name: 'THORChain', type: 'crypto', category: 'defi', potential: 'medium' },
    { symbol: 'KAVA', name: 'Kava', type: 'crypto', category: 'defi', potential: 'high' },
    { symbol: 'CELR', name: 'Celer Network', type: 'crypto', category: 'infrastructure', potential: 'extreme' },
    { symbol: 'REN', name: 'Ren Protocol', type: 'crypto', category: 'defi', potential: 'high' },
    { symbol: 'BAND', name: 'Band Protocol', type: 'crypto', category: 'infrastructure', potential: 'medium' },
    { symbol: 'ANKR', name: 'Ankr Network', type: 'crypto', category: 'infrastructure', potential: 'extreme' },
    
    // Premium Stocks (Major)
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock', category: 'tech', potential: 'high' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', category: 'tech', potential: 'high' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock', category: 'tech', potential: 'high' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock', category: 'tech', potential: 'high' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock', category: 'tech', potential: 'extreme' },
    { symbol: 'META', name: 'Meta Platforms', type: 'stock', category: 'tech', potential: 'medium' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock', category: 'tech', potential: 'high' },
    { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock', category: 'tech', potential: 'medium' },
    
    // Gem Stocks (From GemFinderScreen)
    { symbol: 'PLTR', name: 'Palantir Technologies', type: 'stock', category: 'ai', potential: 'high' },
    { symbol: 'CRSP', name: 'CRISPR Therapeutics', type: 'stock', category: 'biotech', potential: 'extreme' },
    { symbol: 'ROKU', name: 'Roku Inc', type: 'stock', category: 'tech', potential: 'medium' },
    { symbol: 'SQ', name: 'Block Inc', type: 'stock', category: 'fintech', potential: 'high' },
    { symbol: 'RBLX', name: 'Roblox Corporation', type: 'stock', category: 'gaming', potential: 'medium' },
    { symbol: 'SOFI', name: 'SoFi Technologies', type: 'stock', category: 'fintech', potential: 'high' },
    { symbol: 'COIN', name: 'Coinbase Global', type: 'stock', category: 'fintech', potential: 'medium' },
    { symbol: 'OPEN', name: 'Opendoor Technologies', type: 'stock', category: 'tech', potential: 'extreme' },
    { symbol: 'SPCE', name: 'Virgin Galactic', type: 'stock', category: 'tech', potential: 'extreme' },
    { symbol: 'NET', name: 'Cloudflare', type: 'stock', category: 'tech', potential: 'high' },
  ], []);

  // Initialize classic AI-enhanced trading strategies
  const initializeStrategies = useCallback(() => {
    const classicAIStrategies: AdvancedStrategy[] = [
      {
        id: 'ai_day_trading_v1',
        name: 'Day Trading AI',
        description: 'Compra/venta en el mismo día (<24h) con IA predictiva. Utiliza análisis en tiempo real y patrones neuronales para maximizar oportunidades intradía',
        type: 'neural_momentum',
        modelIds: ['transformer_v3', 'cnn_patterns_v2'],
        parameters: {
          timeframe: '1m-5m',
          position_size: 25,
          stop_loss: 2,
          take_profit: 6,
          risk_threshold: 25,
          min_capital: 25000
        },
        performance: {
          backtest: {
            returns: 34.7,
            sharpe: 1.6,
            maxDrawdown: 8.2,
            winRate: 72.4,
            totalTrades: 1847
          }
        },
        riskLevel: 'aggressive',
        targetAssets: ['BTC', 'ETH', 'AAPL', 'TSLA', 'NVDA'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'ai_swing_trading_v1',
        name: 'Swing Trading AI',
        description: 'Mantenimiento días/semanas con análisis predictivo LSTM. Ideal para capturar tendencias de mediano plazo con gestión inteligente de riesgo',
        type: 'lstm_reversal',
        modelIds: ['lstm_timeseries_v4', 'transformer_v3'],
        parameters: {
          timeframe: '4h-1d',
          position_size: 15,
          stop_loss: 8,
          take_profit: 20,
          risk_threshold: 15,
          min_capital: 5000
        },
        performance: {
          backtest: {
            returns: 28.3,
            sharpe: 2.1,
            maxDrawdown: 12.7,
            winRate: 68.9,
            totalTrades: 324
          }
        },
        riskLevel: 'moderate',
        targetAssets: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'BTC'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'ai_scalping_v1',
        name: 'Scalping AI',
        description: 'Microganancias (segundos/minutos) con algoritmos de alta frecuencia y predicción neural instantánea para aprovechar micro-movimientos',
        type: 'rl_adaptive',
        modelIds: ['rl_agent_v2', 'cnn_patterns_v2'],
        parameters: {
          timeframe: '1s-30s',
          position_size: 50,
          stop_loss: 0.5,
          take_profit: 1.5,
          risk_threshold: 30,
          min_capital: 10000
        },
        performance: {
          backtest: {
            returns: 45.8,
            sharpe: 1.4,
            maxDrawdown: 15.3,
            winRate: 61.2,
            totalTrades: 8934
          }
        },
        riskLevel: 'aggressive',
        targetAssets: ['BTC', 'ETH', 'EUR/USD', 'GBP/USD'],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'ai_hft_v1',
        name: 'High-Frequency Trading AI',
        description: 'Algoritmos ultra-rápidos con IA. Ejecución en microsegundos con análisis predictivo avanzado para market making y arbitraje',
        type: 'transformer_sentiment',
        modelIds: ['transformer_v3', 'rl_agent_v2'],
        parameters: {
          timeframe: '<1s',
          position_size: 100,
          stop_loss: 0.1,
          take_profit: 0.3,
          risk_threshold: 35,
          min_capital: 100000
        },
        performance: {
          backtest: {
            returns: 67.4,
            sharpe: 1.2,
            maxDrawdown: 22.1,
            winRate: 58.7,
            totalTrades: 45678
          }
        },
        riskLevel: 'aggressive',
        targetAssets: ['BTC', 'ETH', 'SPY', 'QQQ'],
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'ai_position_trading_v1',
        name: 'Position Trading AI',
        description: 'Inversión a largo plazo (semanas/meses) con análisis fundamental potenciado por IA y detección de tendencias macro para máximo crecimiento',
        type: 'gan_synthetic',
        modelIds: ['gan_synthetic_v1', 'lstm_timeseries_v4'],
        parameters: {
          timeframe: '1w-1M',
          position_size: 8,
          stop_loss: 15,
          take_profit: 50,
          risk_threshold: 8,
          min_capital: 2000
        },
        performance: {
          backtest: {
            returns: 21.6,
            sharpe: 2.4,
            maxDrawdown: 18.9,
            winRate: 78.3,
            totalTrades: 67
          }
        },
        riskLevel: 'conservative',
        targetAssets: ['AAPL', 'MSFT', 'BTC', 'ETH', 'VOO'],
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    setStrategies(classicAIStrategies);
  }, []);

  // Initialize AI models
  const initializeAIModels = useCallback(() => {
    const models: AIModel[] = [
      {
        id: 'transformer_v3',
        name: 'Market Transformer',
        type: 'transformer',
        description: 'Advanced transformer model for price prediction and sentiment analysis',
        accuracy: 87.3,
        lastTrained: new Date(),
        status: 'ready',
        capabilities: ['Price Prediction', 'Sentiment Analysis', 'Multi-timeframe Analysis']
      },
      {
        id: 'cnn_patterns_v2',
        name: 'Pattern Recognition CNN',
        type: 'cnn',
        description: 'Convolutional neural network for chartist pattern detection',
        accuracy: 91.2,
        lastTrained: new Date(),
        status: 'ready',
        capabilities: ['Pattern Detection', 'Support/Resistance', 'Candlestick Patterns']
      },
      {
        id: 'lstm_timeseries_v4',
        name: 'Time Series LSTM',
        type: 'lstm',
        description: 'Long Short-Term Memory network for sequence prediction',
        accuracy: 84.7,
        lastTrained: new Date(),
        status: 'ready',
        capabilities: ['Time Series Forecasting', 'Trend Analysis', 'Volatility Prediction']
      },
      {
        id: 'gan_synthetic_v1',
        name: 'Synthetic Data GAN',
        type: 'gan',
        description: 'Generative model for creating synthetic market scenarios',
        accuracy: 78.9,
        lastTrained: new Date(),
        status: 'ready',
        capabilities: ['Stress Testing', 'Data Augmentation', 'Scenario Generation']
      },
      {
        id: 'rl_agent_v2',
        name: 'Adaptive RL Agent',
        type: 'rl',
        description: 'Reinforcement learning agent for dynamic strategy optimization',
        accuracy: 89.1,
        lastTrained: new Date(),
        status: 'ready',
        capabilities: ['Portfolio Optimization', 'Risk Management', 'Adaptive Trading']
      }
    ];
    setAiModels(models);
  }, []);

  // Generate mock market analysis with AI models
  const generateMarketAnalysis = useCallback(async (assets: string[]) => {
    setAnalysisLoading(true);
    
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const analyses: MarketAnalysis[] = assets.map(symbol => {
      const asset = availableAssets.find(a => a.symbol === symbol);
      const basePrice = Math.random() * 50000 + 1000;
      const change = (Math.random() - 0.5) * 20;
      
      return {
        symbol,
        name: asset?.name || symbol,
        price: basePrice,
        change24h: change,
        volume: Math.random() * 1000000000,
        marketCap: asset?.type === 'crypto' ? Math.random() * 500000000000 : undefined,
        prediction: {
          shortTerm: (Math.random() - 0.5) * 30 + 5,
          mediumTerm: (Math.random() - 0.5) * 50 + 8,
          longTerm: (Math.random() - 0.5) * 100 + 15,
          confidence: Math.random() * 30 + 70
        },
        patterns: [
          { name: 'Bull Flag', strength: Math.random() * 100, timeframe: '4h' },
          { name: 'Double Bottom', strength: Math.random() * 100, timeframe: '1d' },
          { name: 'Ascending Triangle', strength: Math.random() * 100, timeframe: '1h' }
        ].sort((a, b) => b.strength - a.strength).slice(0, 2),
        sentiment: {
          score: Math.random() * 200 - 100,
          sources: ['Twitter', 'Reddit', 'News', 'Forums'],
          summary: 'Market sentiment is showing strong bullish signals with increasing social mentions.',
          trend: Math.random() > 0.6 ? 'positive' : Math.random() > 0.3 ? 'neutral' : 'negative'
        },
        technicalSignals: {
          rsi: Math.random() * 100,
          macd: (Math.random() - 0.5) * 2,
          volume: Math.random() * 200 + 50,
          trend: Math.random() > 0.6 ? 'bullish' : Math.random() > 0.3 ? 'neutral' : 'bearish',
          signals: [
            { indicator: 'RSI', signal: 'Oversold', strength: Math.random() * 100 },
            { indicator: 'MACD', signal: 'Bullish Crossover', strength: Math.random() * 100 },
            { indicator: 'Volume', signal: 'High Volume', strength: Math.random() * 100 }
          ]
        },
        riskAssessment: {
          volatility: Math.random() * 100,
          correlation: Math.random(),
          liquidityRisk: Math.random() * 100,
          overall: Math.random() > 0.6 ? 'low' : Math.random() > 0.3 ? 'medium' : 'high',
          score: Math.random() * 100
        },
        modelPredictions: aiModels.reduce((acc, model) => {
          acc[model.id] = {
            prediction: (Math.random() - 0.5) * 50 + 10,
            confidence: Math.random() * 40 + 60,
            reasoning: `${model.name} analysis based on ${model.capabilities.join(', ')}`
          };
          return acc;
        }, {} as any)
      };
    });
    
    setMarketAnalyses(analyses);
    setAnalysisLoading(false);
  }, [availableAssets, aiModels]);

  // Initialize component
  useEffect(() => {
    initializeAIModels();
    initializeStrategies();
  }, [initializeAIModels, initializeStrategies]);

  // Generate analysis when assets change
  useEffect(() => {
    if (selectedAssets.length > 0 && aiModels.length > 0) {
      generateMarketAnalysis(selectedAssets);
    }
  }, [selectedAssets, aiModels, generateMarketAnalysis]);

  // Animation effect
  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanningAnimation, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanningAnimation, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [scanningAnimation]);

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await generateMarketAnalysis(selectedAssets);
    setRefreshing(false);
  }, [selectedAssets, generateMarketAnalysis]);

  // Asset selection handler
  const toggleAsset = useCallback((symbol: string) => {
    setSelectedAssets(prev => 
      prev.includes(symbol) 
        ? prev.filter(s => s !== symbol)
        : [...prev, symbol]
    );
  }, []);

  // Backtest functions
  const runBacktest = useCallback(async (strategy: StrategyConfig, symbols: string[]) => {
    setBacktestLoading(true);
    try {
      console.log(`🚀 Starting backtest for ${strategy.name} on ${symbols.length} assets...`);
      
      const results: BacktestResult[] = [];
      
      for (const symbol of symbols) {
        try {
          const result = await historicalBacktestService.runBacktest(symbol, strategy, backtestPeriod);
          results.push(result);
          
          // Small delay to prevent overwhelming
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error backtesting ${symbol}:`, error);
          Alert.alert('Backtest Error', `Failed to backtest ${symbol}: ${error.message}`);
        }
      }
      
      setBacktestResults(results);
      setShowBacktestModal(true);
      
      Alert.alert(
        'Backtest Complete', 
        `Successfully backtested ${results.length} assets with ${strategy.name} strategy.`
      );
      
    } catch (error) {
      console.error('Backtest error:', error);
      Alert.alert('Error', 'Failed to run backtest: ' + error.message);
    } finally {
      setBacktestLoading(false);
    }
  }, [backtestPeriod]);

  const runMultiStrategyBacktest = useCallback(async () => {
    const strategies = historicalBacktestService.getDefaultStrategies();
    setBacktestLoading(true);
    
    try {
      const allResults: BacktestResult[] = [];
      
      for (const strategy of strategies) {
        const results = await historicalBacktestService.runMultiSymbolBacktest(
          selectedAssets, 
          strategy, 
          backtestPeriod
        );
        allResults.push(...results);
      }
      
      // Sort by performance
      allResults.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
      setBacktestResults(allResults);
      setShowBacktestModal(true);
      
    } catch (error) {
      console.error('Multi-strategy backtest error:', error);
      Alert.alert('Error', 'Failed to run multi-strategy backtest');
    } finally {
      setBacktestLoading(false);
    }
  }, [selectedAssets, backtestPeriod]);

  // Strategy functions
  const createCustomStrategy = useCallback(() => {
    setShowCreateStrategyModal(true);
  }, []);

  const saveCustomStrategy = useCallback(() => {
    if (!newStrategy.name.trim()) {
      Alert.alert('Error', 'Please enter a strategy name');
      return;
    }

    if (newStrategy.targetAssets.length === 0) {
      Alert.alert('Error', 'Please select at least one target asset');
      return;
    }

    // AI-optimized parameters based on risk level and strategy type
    const aiOptimizedParameters = {
      timeframe: newStrategy.type === 'neural_momentum' ? '5m-1h' : 
                newStrategy.type === 'lstm_reversal' ? '4h-1d' :
                newStrategy.type === 'rl_adaptive' ? '1s-5m' :
                newStrategy.type === 'gan_synthetic' ? '1d-1w' : '1h-4h',
      position_size: newStrategy.riskLevel === 'conservative' ? 8 : 
                    newStrategy.riskLevel === 'moderate' ? 15 : 25,
      stop_loss: newStrategy.riskLevel === 'conservative' ? 5 : 
                newStrategy.riskLevel === 'moderate' ? 10 : 15,
      take_profit: newStrategy.riskLevel === 'conservative' ? 15 : 
                  newStrategy.riskLevel === 'moderate' ? 25 : 35,
      risk_threshold: newStrategy.riskLevel === 'conservative' ? 8 : 
                     newStrategy.riskLevel === 'moderate' ? 15 : 25,
      min_capital: newStrategy.riskLevel === 'conservative' ? 1000 : 
                  newStrategy.riskLevel === 'moderate' ? 2500 : 5000,
      confidence_threshold: 0.7,
      max_daily_trades: newStrategy.riskLevel === 'conservative' ? 3 : 
                       newStrategy.riskLevel === 'moderate' ? 5 : 10,
      ai_optimization: true
    };

    // Simulated AI-generated performance metrics
    const aiPerformanceMetrics = {
      returns: (Math.random() * 30 + 10) * (newStrategy.riskLevel === 'aggressive' ? 1.5 : 1),
      sharpe: Math.random() * 1.5 + 0.8,
      maxDrawdown: (Math.random() * 15 + 5) * (newStrategy.riskLevel === 'conservative' ? 0.7 : 1),
      winRate: Math
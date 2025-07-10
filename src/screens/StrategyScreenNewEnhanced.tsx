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
import { marketAnalyzer } from '../ai/marketAnalyzer';

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

const StrategyScreenNew: React.FC = () => {
  const { state } = useTrading();
  
  // Tab management
  const [selectedTab, setSelectedTab] = useState<'analyzer' | 'models' | 'strategies' | 'backtest'>('analyzer');
  
  // Loading states
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  
  // Data states
  const [marketAnalyses, setMarketAnalyses] = useState<MarketAnalysis[]>([]);
  const [aiModels, setAiModels] = useState<AIModel[]>([]);
  const [strategies, setStrategies] = useState<AdvancedStrategy[]>([]);
  const [selectedAssets, setSelectedAssets] = useState<string[]>(['BTC', 'ETH', 'AAPL']);
  
  // Modal states
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [showStrategyModal, setShowStrategyModal] = useState(false);
  const [showCreateStrategyModal, setShowCreateStrategyModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MarketAnalysis | null>(null);
  
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
  
  // Backtest state
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyConfig | null>(null);
  const [backtestPeriod, setBacktestPeriod] = useState(90);
  const [showBacktestModal, setShowBacktestModal] = useState(false);
  
  // Available assets for analysis
  const availableAssets = useMemo(() => [
    // Cryptocurrencies
    { symbol: 'BTC', name: 'Bitcoin', type: 'crypto' },
    { symbol: 'ETH', name: 'Ethereum', type: 'crypto' },
    { symbol: 'ADA', name: 'Cardano', type: 'crypto' },
    { symbol: 'SOL', name: 'Solana', type: 'crypto' },
    { symbol: 'DOT', name: 'Polkadot', type: 'crypto' },
    { symbol: 'LINK', name: 'Chainlink', type: 'crypto' },
    { symbol: 'MATIC', name: 'Polygon', type: 'crypto' },
    { symbol: 'AVAX', name: 'Avalanche', type: 'crypto' },
    // Stocks
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'stock' },
    { symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'stock' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'stock' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'stock' },
    { symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'stock' },
    { symbol: 'META', name: 'Meta Platforms', type: 'stock' },
    { symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'stock' },
    { symbol: 'NFLX', name: 'Netflix Inc.', type: 'stock' },
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
  }, []);

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

    const strategy: AdvancedStrategy = {
      id: `custom_${Date.now()}`,
      name: newStrategy.name,
      description: newStrategy.description || `Custom ${newStrategy.type} strategy`,
      type: newStrategy.type,
      modelIds: getModelIdsForType(newStrategy.type),
      parameters: newStrategy.parameters,
      performance: {
        backtest: {
          returns: 0,
          sharpe: 0,
          maxDrawdown: 0,
          winRate: 0,
          totalTrades: 0
        }
      },
      riskLevel: newStrategy.riskLevel,
      targetAssets: newStrategy.targetAssets,
      isActive: false,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setStrategies(prev => [...prev, strategy]);
    setShowCreateStrategyModal(false);
    
    // Reset form
    setNewStrategy({
      name: '',
      description: '',
      type: 'neural_momentum',
      riskLevel: 'moderate',
      targetAssets: [],
      parameters: {
        position_size: 15,
        stop_loss: 10,
        take_profit: 20,
        risk_threshold: 15
      }
    });

    Alert.alert('Success', 'Custom strategy created successfully!');
  }, [newStrategy]);

  const getModelIdsForType = (type: AdvancedStrategy['type']): string[] => {
    switch (type) {
      case 'neural_momentum':
        return ['transformer_v3', 'lstm_timeseries_v4'];
      case 'lstm_reversal':
        return ['lstm_timeseries_v4', 'cnn_patterns_v2'];
      case 'transformer_sentiment':
        return ['transformer_v3'];
      case 'gan_synthetic':
        return ['gan_synthetic_v1', 'rl_agent_v2'];
      case 'rl_adaptive':
        return ['rl_agent_v2'];
      default:
        return ['transformer_v3'];
    }
  };

  const toggleStrategyAsset = useCallback((symbol: string) => {
    setNewStrategy(prev => ({
      ...prev,
      targetAssets: prev.targetAssets.includes(symbol)
        ? prev.targetAssets.filter(s => s !== symbol)
        : [...prev.targetAssets, symbol]
    }));
  }, []);

  const trainStrategy = useCallback((strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    Alert.alert(
      '🚀 Train Strategy',
      `Start training ${strategy.name}? This will use recent market data to improve the strategy performance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Training', onPress: () => {
          // Update strategy status to training
          setStrategies(prev => prev.map(s => 
            s.id === strategyId 
              ? { ...s, isActive: false }
              : s
          ));
          
          // Simulate training process
          Alert.alert('Training Started', 'Strategy training in progress...');
          
          setTimeout(() => {
            setStrategies(prev => prev.map(s => 
              s.id === strategyId 
                ? { 
                    ...s, 
                    performance: {
                      ...s.performance,
                      backtest: {
                        ...s.performance.backtest,
                        returns: Math.min(80, s.performance.backtest.returns + Math.random() * 5),
                        sharpe: Math.min(3.0, s.performance.backtest.sharpe + Math.random() * 0.3),
                        winRate: Math.min(85, s.performance.backtest.winRate + Math.random() * 3)
                      }
                    },
                    updatedAt: new Date()
                  }
                : s
            ));
            Alert.alert('Training Complete', `${strategy.name} has been optimized with new market data!`);
          }, 3000);
        }}
      ]
    );
  }, [strategies]);

  const optimizeStrategy = useCallback((strategyId: string) => {
    const strategy = strategies.find(s => s.id === strategyId);
    if (!strategy) return;

    Alert.alert(
      '⚡ Optimize Strategy',
      `Optimize ${strategy.name} parameters? This will fine-tune the strategy for current market conditions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Optimization', onPress: () => {
          Alert.alert('Optimization Started', 'Optimizing strategy parameters...');
          
          setTimeout(() => {
            setStrategies(prev => prev.map(s => 
              s.id === strategyId 
                ? { 
                    ...s, 
                    parameters: {
                      ...s.parameters,
                      stop_loss: Math.max(1, Number(s.parameters.stop_loss) * (0.9 + Math.random() * 0.2)),
                      take_profit: Number(s.parameters.take_profit) * (1.1 + Math.random() * 0.1),
                      risk_threshold: Math.max(5, Number(s.parameters.risk_threshold) * (0.95 + Math.random() * 0.1))
                    },
                    performance: {
                      ...s.performance,
                      backtest: {
                        ...s.performance.backtest,
                        returns: Math.min(85, s.performance.backtest.returns + Math.random() * 3),
                        maxDrawdown: Math.max(3, s.performance.backtest.maxDrawdown * (0.9 + Math.random() * 0.1))
                      }
                    },
                    updatedAt: new Date()
                  }
                : s
            ));
            Alert.alert('Optimization Complete', `${strategy.name} parameters have been optimized!`);
          }, 2000);
        }}
      ]
    );
  }, [strategies]);

  const toggleStrategyStatus = useCallback((strategyId: string) => {
    setStrategies(prev => prev.map(strategy => 
      strategy.id === strategyId 
        ? { ...strategy, isActive: !strategy.isActive, updatedAt: new Date() }
        : strategy
    ));
    
    const strategy = strategies.find(s => s.id === strategyId);
    const newStatus = !strategy?.isActive;
    Alert.alert(
      newStatus ? 'Strategy Activated' : 'Strategy Paused',
      `${strategy?.name} is now ${newStatus ? 'active' : 'paused'}`
    );
  }, [strategies]);

  const updateStrategyRisk = useCallback((strategyId: string, newRiskLevel: AdvancedStrategy['riskLevel']) => {
    setStrategies(prev => prev.map(strategy => 
      strategy.id === strategyId 
        ? { 
            ...strategy, 
            riskLevel: newRiskLevel,
            parameters: {
              ...strategy.parameters,
              risk_threshold: newRiskLevel === 'conservative' ? 8 : newRiskLevel === 'moderate' ? 15 : 25,
              position_size: newRiskLevel === 'conservative' ? 10 : newRiskLevel === 'moderate' ? 15 : 25,
              stop_loss: newRiskLevel === 'conservative' ? 5 : newRiskLevel === 'moderate' ? 10 : 15
            },
            updatedAt: new Date()
          }
        : strategy
    ));
    Alert.alert('Updated', `Strategy risk level updated to ${newRiskLevel}`);
  }, []);

  // Get strategy details for classic format
  const getStrategyClassicDetails = (strategy: AdvancedStrategy) => {
    const strategyDetails: Record<string, any> = {
      ai_day_trading_v1: {
        mechanism: 'Compra/venta en el mismo día (<24h)',
        riskLevel: 'Agresivo',
        minCapital: '$25k+ (acciones USA)',
        keyTools: ['Charts Tiempo Real AI', 'Level 2 + Predicción IA', 'Alertas Automáticas'],
        tradingTimeframe: 'Intradía'
      },
      ai_swing_trading_v1: {
        mechanism: 'Mantenimiento días/semanas',
        riskLevel: 'Moderado',
        minCapital: '$5k+',
        keyTools: ['Indicadores técnicos (RSI, MACD) + IA', 'Análisis Sentiment IA', 'Predicción Multi-timeframe'],
        tradingTimeframe: '3-10 días'
      },
      ai_scalping_v1: {
        mechanism: 'Microganancias (segundos/minutos)',
        riskLevel: 'Agresivo',
        minCapital: '$10k+',
        keyTools: ['Plataforma baja latencia + IA', 'Predicción sub-segundo', 'Auto-execution'],
        tradingTimeframe: '30s - 5min'
      },
      ai_hft_v1: {
        mechanism: 'Algoritmos ultra-rápidos IA',
        riskLevel: 'Agresivo',
        minCapital: '$100k+ + Infraestructura',
        keyTools: ['Co-location + IA Edge', 'Predicción Microsegundo', 'Market Making IA'],
        tradingTimeframe: '<1 segundo'
      },
      ai_position_trading_v1: {
        mechanism: 'Mantenimiento meses/años',
        riskLevel: 'Conservador',
        minCapital: '$1k+',
        keyTools: ['Análisis Fundamental IA', 'Sentiment Macro IA', 'Rebalanceo Automático'],
        tradingTimeframe: '3-12 meses'
      }
    };
    
    return strategyDetails[strategy.id] || {
      mechanism: 'Custom Strategy',
      riskLevel: strategy.riskLevel,
      minCapital: `$${strategy.parameters.min_capital?.toLocaleString() || '1k'}+`,
      keyTools: ['AI Analytics', 'Technical Indicators', 'Risk Management'],
      tradingTimeframe: strategy.parameters.timeframe || 'Variable'
    };
  };

  const renderAdvancedStrategy = ({ item }: { item: AdvancedStrategy }) => {
    const classicDetails = getStrategyClassicDetails(item);
    
    return (
      <View style={styles.strategyCard}>
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.strategyGradient}
        >
          <View style={styles.strategyHeader}>
            <View style={styles.strategyInfo}>
              <Text style={styles.strategyName}>{item.name}</Text>
              <Text style={styles.strategyType}>AI-Enhanced Trading</Text>
            </View>
            <View style={[
              styles.strategyStatus,
              { backgroundColor: item.isActive ? theme.success : theme.warning }
            ]}>
              <Text style={styles.strategyStatusText}>
                {item.isActive ? 'ACTIVE' : 'PAUSED'}
              </Text>
            </View>
          </View>
          
          <Text style={styles.strategyDescription}>{item.description}</Text>
          
          {/* Classic Trading Strategy Details Table */}
          <View style={styles.classicDetailsContainer}>
            <Text style={styles.classicDetailsTitle}>📊 Strategy Details</Text>
            
            <View style={styles.classicDetailRow}>
              <Text style={styles.classicDetailLabel}>⚙️ Mecanismo:</Text>
              <Text style={styles.classicDetailValue}>{classicDetails.mechanism}</Text>
            </View>
            
            <View style={styles.classicDetailRow}>
              <Text style={styles.classicDetailLabel}>🎯 Riesgo:</Text>
              <Text style={[
                styles.classicDetailValue,
                { color: 
                  item.riskLevel === 'conservative' ? theme.success : 
                  item.riskLevel === 'moderate' ? theme.warning : 
                  theme.error
                }
              ]}>
                {classicDetails.riskLevel}
              </Text>
            </View>
            
            <View style={styles.classicDetailRow}>
              <Text style={styles.classicDetailLabel}>💰 Capital Mín:</Text>
              <Text style={styles.classicDetailValue}>{classicDetails.minCapital}</Text>
            </View>
            
            <View style={styles.classicDetailRow}>
              <Text style={styles.classicDetailLabel}>⏰ Timeframe:</Text>
              <Text style={styles.classicDetailValue}>{classicDetails.tradingTimeframe}</Text>
            </View>
          </View>
          
          {/* Key Tools */}
          <View style={styles.keyToolsContainer}>
            <Text style={styles.keyToolsTitle}>🛠️ Herramientas Clave</Text>
            <View style={styles.keyToolsList}>
              {classicDetails.keyTools.map((tool: string, index: number) => (
                <View key={index} style={styles.keyToolItem}>
                  <Text style={styles.keyToolBullet}>•</Text>
                  <Text style={styles.keyToolText}>{tool}</Text>
                </View>
              ))}
            </View>
          </View>
          
          {/* Risk Level Selector */}
          <View style={styles.riskSelector}>
            <Text style={styles.riskSelectorLabel}>Adjust Risk Level:</Text>
            <View style={styles.riskButtons}>
              {(['conservative', 'moderate', 'aggressive'] as const).map((risk) => (
                <TouchableOpacity
                  key={risk}
                  style={[
                    styles.riskButton,
                    item.riskLevel === risk && styles.riskButtonActive,
                    { backgroundColor: 
                      risk === 'conservative' ? theme.success + '20' : 
                      risk === 'moderate' ? theme.warning + '20' : 
                      theme.error + '20'
                    }
                  ]}
                  onPress={() => updateStrategyRisk(item.id, risk)}
                >
                  <Text style={[
                    styles.riskButtonText,
                    item.riskLevel === risk && styles.riskButtonTextActive,
                    { color: 
                      risk === 'conservative' ? theme.success : 
                      risk === 'moderate' ? theme.warning : 
                      theme.error
                    }
                  ]}>
                    {risk.charAt(0).toUpperCase() + risk.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          
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
              <Text style={styles.metricLabel}>Trades</Text>
              <Text style={styles.metricValue}>{item.performance.backtest.totalTrades}</Text>
            </View>
          </View>
          
          <View style={styles.strategyActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => runBacktest(
                { 
                  name: item.name, 
                  type: 'momentum', 
                  parameters: {
                    confidence_threshold: Number(item.parameters.risk_threshold) / 100 || 0.7,
                    risk_threshold: Number(item.parameters.risk_threshold) || 15,
                    position_size: Number(item.parameters.position_size) || 15,
                    stop_loss: Number(item.parameters.stop_loss) || 8,
                    take_profit: Number(item.parameters.take_profit) || 20,
                    holding_period_max: 30
                  }
                }, 
                item.targetAssets
              )}
            >
              <Text style={styles.actionButtonText}>📊 Backtest</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => trainStrategy(item.id)}
            >
              <Text style={styles.actionButtonText}>🧠 Train</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => optimizeStrategy(item.id)}
            >
              <Text style={styles.actionButtonText}>⚡ Optimize</Text>
            </TouchableOpacity>
          <TouchableOpacity 
            style={[
              styles.actionButton,
              { backgroundColor: item.isActive ? theme.error + '20' : theme.success + '20' }
            ]}
            onPress={() => toggleStrategyStatus(item.id)}
          >
            <Text style={[
              styles.actionButtonText,
              { color: item.isActive ? theme.error : theme.success }
            ]}>
              {item.isActive ? '⏸️ Pause' : '▶️ Start'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  const getStrategyTemplates = useCallback(() => {
    return [
      {
        id: 'template_day_trading',
        name: 'AI Day Trading Template',
        type: 'neural_momentum',
        description: 'Compra/venta intradía con IA predictiva y gestión automatizada de riesgo',
        riskLevel: 'aggressive' as const,
        expectedReturn: 35.2,
        timeframe: '1m-5m',
        minCapital: 25000,
        complexity: 'advanced' as const,
        features: ['Tiempo Real', 'Level 2 Data', 'AI Patterns']
      },
      {
        id: 'template_swing_trading',
        name: 'AI Swing Trading Template',
        type: 'lstm_reversal',
        description: 'Posiciones de días/semanas con análisis LSTM y indicadores técnicos potenciados',
        riskLevel: 'moderate' as const,
        expectedReturn: 24.7,
        timeframe: '4h-1d',
        minCapital: 5000,
        complexity: 'intermediate' as const,
        features: ['RSI AI', 'MACD Neural', 'Trend Analysis']
      },
      {
        id: 'template_scalping',
        name: 'AI Scalping Template',
        type: 'rl_adaptive',
        description: 'Microganancias con algoritmos ultra-rápidos y ejecución de baja latencia',
        riskLevel: 'aggressive' as const,
        expectedReturn: 42.1,
        timeframe: '1s-30s',
        minCapital: 10000,
        complexity: 'expert' as const,
        features: ['Baja Latencia', 'Micro Patterns', 'RL Optimization']
      },
      {
        id: 'template_position',
        name: 'AI Position Trading Template',
        type: 'gan_synthetic',
        description: 'Inversión a largo plazo con análisis fundamental potenciado por IA',
        riskLevel: 'conservative' as const,
        expectedReturn: 18.9,
        timeframe: '1w-1M',
        minCapital: 2000,
        complexity: 'beginner' as const,
        features: ['Fundamental AI', 'Macro Trends', 'Risk Management']
      },
    ];
  }, []);

  const renderStrategyTemplate = ({ item }: { item: any }) => (
    <TouchableOpacity style={styles.templateCard}>
      <LinearGradient
        colors={[theme.primary + '20', theme.primary + '10']}
        style={styles.templateGradient}
      >
        <Text style={styles.templateName}>{item.name}</Text>
        <Text style={styles.templateType}>{item.type.replace('_', ' ').toUpperCase()}</Text>
        <Text style={styles.templateDescription}>{item.description}</Text>
        
        {/* Trading Details */}
        <View style={styles.templateDetails}>
          <View style={styles.templateDetailItem}>
            <Text style={styles.templateDetailLabel}>⏱️ Timeframe</Text>
            <Text style={styles.templateDetailValue}>{item.timeframe}</Text>
          </View>
          <View style={styles.templateDetailItem}>
            <Text style={styles.templateDetailLabel}>💰 Min Capital</Text>
            <Text style={styles.templateDetailValue}>${item.minCapital?.toLocaleString()}</Text>
          </View>
        </View>
        
        {/* Features */}
        <View style={styles.templateFeatures}>
          {item.features?.map((feature: string, index: number) => (
            <View key={index} style={styles.featureTag}>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.templateMetrics}>
          <View style={styles.templateMetric}>
            <Text style={styles.templateMetricLabel}>Expected Return</Text>
            <Text style={styles.templateMetricValue}>{item.expectedReturn}%</Text>
          </View>
          <View style={styles.templateMetric}>
            <Text style={styles.templateMetricLabel}>Risk Level</Text>
            <Text style={[
              styles.templateMetricValue,
              { color: 
                item.riskLevel === 'conservative' ? theme.success : 
                item.riskLevel === 'moderate' ? theme.warning : 
                theme.error
              }
            ]}>{item.riskLevel}</Text>
          </View>
        </View>
        
        <TouchableOpacity style={styles.templateAction}>
          <Text style={styles.templateActionText}>🚀 Deploy Template</Text>
        </TouchableOpacity>
      </LinearGradient>
    </TouchableOpacity>
  );

  // AI Model training functions
  const trainModel = useCallback((modelId: string) => {
    Alert.alert(
      '🧠 Train AI Model',
      `Start training ${aiModels.find(m => m.id === modelId)?.name}? This will use historical data to improve model accuracy.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Training', onPress: () => {
          setAiModels(prev => prev.map(model => 
            model.id === modelId 
              ? { ...model, status: 'training' as const }
              : model
          ));
          
          // Simulate training
          setTimeout(() => {
            setAiModels(prev => prev.map(model => 
              model.id === modelId 
                ? { 
                    ...model, 
                    status: 'ready' as const,
                    accuracy: Math.min(95, model.accuracy + Math.random() * 3),
                    lastTrained: new Date()
                  }
                : model
            ));
            Alert.alert('Training Complete', 'Model has been successfully retrained!');
          }, 5000);
        }}
      ]
    );
  }, [aiModels]);

  const optimizeModel = useCallback((modelId: string) => {
    Alert.alert(
      '⚡ Optimize AI Model',
      `Optimize ${aiModels.find(m => m.id === modelId)?.name} parameters? This will fine-tune the model for better performance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Optimization', onPress: () => {
          setAiModels(prev => prev.map(model => 
            model.id === modelId 
              ? { ...model, status: 'updating' as const }
              : model
          ));
          
          // Simulate optimization
          setTimeout(() => {
            setAiModels(prev => prev.map(model => 
              model.id === modelId 
                ? { 
                    ...model, 
                    status: 'ready' as const,
                    accuracy: Math.min(98, model.accuracy + Math.random() * 2),
                    lastTrained: new Date()
                  }
                : model
            ));
            Alert.alert('Optimization Complete', 'Model parameters have been optimized!');
          }, 3000);
        }}
      ]
    );
  }, [aiModels]);

  // Render asset selector
  const renderAssetSelector = () => (
    <View style={styles.assetSelector}>
      <Text style={styles.sectionTitle}>Select Assets for Analysis</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.assetGrid}>
          {availableAssets.map(asset => (
            <TouchableOpacity
              key={asset.symbol}
              style={[
                styles.assetChip,
                selectedAssets.includes(asset.symbol) && styles.assetChipSelected
              ]}
              onPress={() => toggleAsset(asset.symbol)}
            >
              <Text style={[
                styles.assetChipText,
                selectedAssets.includes(asset.symbol) && styles.assetChipTextSelected
              ]}>
                {asset.symbol}
              </Text>
              <Text style={[
                styles.assetChipSubtext,
                selectedAssets.includes(asset.symbol) && styles.assetChipSubtextSelected
              ]}>
                {asset.type}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );

  // Render AI model card
  const renderAIModel = ({ item }: { item: AIModel }) => (
    <View style={styles.modelCard}>
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.modelGradient}
      >
        <View style={styles.modelHeader}>
          <View style={styles.modelInfo}>
            <Text style={styles.modelName}>{item.name}</Text>
            <Text style={styles.modelType}>{item.type.toUpperCase()}</Text>
          </View>
          <View style={styles.modelAccuracy}>
            <Text style={styles.accuracyValue}>{item.accuracy}%</Text>
            <Text style={styles.accuracyLabel}>Accuracy</Text>
          </View>
        </View>
        
        <Text style={styles.modelDescription}>{item.description}</Text>
        
        <View style={styles.modelCapabilities}>
          {item.capabilities.map((capability, index) => (
            <View key={index} style={styles.capabilityTag}>
              <Text style={styles.capabilityText}>{capability}</Text>
            </View>
          ))}
        </View>
        
        <View style={styles.modelStatus}>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: item.status === 'ready' ? theme.success : theme.warning }
          ]} />
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>

        {/* Model Action Buttons */}
        <View style={styles.modelActions}>
          <TouchableOpacity 
            style={[styles.modelButton, styles.trainButton]}
            onPress={() => trainModel(item.id)}
            disabled={item.status === 'training'}
          >
            <Text style={styles.modelButtonText}>
              {item.status === 'training' ? '🔄 Training...' : '🧠 Train Model'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.modelButton, styles.optimizeButton]}
            onPress={() => optimizeModel(item.id)}
            disabled={item.status === 'training'}
          >
            <Text style={styles.modelButtonText}>⚡ Optimize</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  // Render market analysis card
  const renderMarketAnalysis = ({ item }: { item: MarketAnalysis }) => {
    const isPositive = item.change24h > 0;
    const confidenceColor = item.prediction.confidence > 80 ? theme.success : 
                           item.prediction.confidence > 60 ? theme.warning : theme.error;
    
    return (
      <TouchableOpacity
        style={styles.analysisCard}
        onPress={() => {
          setSelectedAnalysis(item);
          setShowAnalysisModal(true);
        }}
      >
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.analysisGradient}
        >
          <View style={styles.analysisHeader}>
            <View style={styles.assetInfo}>
              <Text style={styles.assetSymbol}>{item.symbol}</Text>
              <Text style={styles.assetName}>{item.name}</Text>
            </View>
            <View style={styles.priceInfo}>
              <Text style={styles.currentPrice}>
                ${item.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </Text>
              <Text style={[
                styles.priceChange,
                { color: isPositive ? theme.success : theme.error }
              ]}>
                {isPositive ? '+' : ''}{item.change24h.toFixed(2)}%
              </Text>
            </View>
          </View>

          <View style={styles.predictionRow}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>7D</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.shortTerm > 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.shortTerm > 0 ? '+' : ''}{item.prediction.shortTerm.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>30D</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.mediumTerm > 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.mediumTerm > 0 ? '+' : ''}{item.prediction.mediumTerm.toFixed(1)}%
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>90D</Text>
              <Text style={[
                styles.predictionValue,
                { color: item.prediction.longTerm > 0 ? theme.success : theme.error }
              ]}>
                {item.prediction.longTerm > 0 ? '+' : ''}{item.prediction.longTerm.toFixed(1)}%
              </Text>
            </View>
          </View>

          <View style={styles.signalsRow}>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Trend</Text>
              <Text style={[
                styles.signalValue,
                { color: 
                  item.technicalSignals.trend === 'bullish' ? theme.success :
                  item.technicalSignals.trend === 'bearish' ? theme.error : theme.warning
                }
              ]}>
                {item.technicalSignals.trend.toUpperCase()}
              </Text>
            </View>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Sentiment</Text>
              <Text style={[
                styles.signalValue,
                { color: 
                  item.sentiment.trend === 'positive' ? theme.success :
                  item.sentiment.trend === 'negative' ? theme.error : theme.warning
                }
              ]}>
                {item.sentiment.score > 0 ? '+' : ''}{item.sentiment.score.toFixed(0)}
              </Text>
            </View>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Confidence</Text>
              <Text style={[styles.signalValue, { color: confidenceColor }]}>
                {item.prediction.confidence.toFixed(0)}%
              </Text>
            </View>
          </View>

          {item.patterns.length > 0 && (
            <View style={styles.patternsRow}>
              <Text style={styles.patternsLabel}>Detected Patterns:</Text>
              <View style={styles.patternsList}>
                {item.patterns.slice(0, 2).map((pattern, index) => (
                  <View key={index} style={styles.patternTag}>
                    <Text style={styles.patternText}>{pattern.name}</Text>
                    <Text style={styles.patternStrength}>
                      {pattern.strength.toFixed(0)}%
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  // Render detailed analysis modal
  const renderAnalysisModal = () => (
    <Modal
      visible={showAnalysisModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowAnalysisModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.modalContent}
          >
            {selectedAnalysis && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {selectedAnalysis.symbol} - {selectedAnalysis.name}
                  </Text>
                  <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => setShowAnalysisModal(false)}
                  >
                    <Text style={styles.closeButtonText}>×</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {/* Model Predictions */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>🤖 AI Model Predictions</Text>
                    {Object.entries(selectedAnalysis.modelPredictions).map(([modelId, pred]) => {
                      const model = aiModels.find(m => m.id === modelId);
                      return (
                        <View key={modelId} style={styles.predictionCard}>
                          <View style={styles.predictionHeader}>
                            <Text style={styles.predictionModelName}>{model?.name}</Text>
                            <Text style={[
                              styles.predictionResult,
                              { color: pred.prediction > 0 ? theme.success : theme.error }
                            ]}>
                              {pred.prediction > 0 ? '+' : ''}{pred.prediction.toFixed(1)}%
                            </Text>
                          </View>
                          <Text style={styles.predictionConfidence}>
                            Confidence: {pred.confidence.toFixed(1)}%
                          </Text>
                          <Text style={styles.predictionReasoning}>{pred.reasoning}</Text>
                        </View>
                      );
                    })}
                  </View>

                  {/* Technical Analysis */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>📊 Technical Analysis</Text>
                    <View style={styles.technicalGrid}>
                      <View style={styles.technicalItem}>
                        <Text style={styles.technicalLabel}>RSI</Text>
                        <Text style={styles.technicalValue}>
                          {selectedAnalysis.technicalSignals.rsi.toFixed(1)}
                        </Text>
                      </View>
                      <View style={styles.technicalItem}>
                        <Text style={styles.technicalLabel}>MACD</Text>
                        <Text style={styles.technicalValue}>
                          {selectedAnalysis.technicalSignals.macd.toFixed(3)}
                        </Text>
                      </View>
                      <View style={styles.technicalItem}>
                        <Text style={styles.technicalLabel}>Volume</Text>
                        <Text style={styles.technicalValue}>
                          {selectedAnalysis.technicalSignals.volume.toFixed(0)}%
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Risk Assessment */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>⚠️ Risk Assessment</Text>
                    <View style={styles.riskGrid}>
                      <View style={styles.riskItem}>
                        <Text style={styles.riskLabel}>Volatility</Text>
                        <Text style={styles.riskValue}>
                          {selectedAnalysis.riskAssessment.volatility.toFixed(1)}%
                        </Text>
                      </View>
                      <View style={styles.riskItem}>
                        <Text style={styles.riskLabel}>Overall Risk</Text>
                        <Text style={[
                          styles.riskOverall,
                          { color: 
                            selectedAnalysis.riskAssessment.overall === 'low' ? theme.success :
                            selectedAnalysis.riskAssessment.overall === 'medium' ? theme.warning : theme.error
                          }
                        ]}>
                          {selectedAnalysis.riskAssessment.overall.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Sentiment Analysis */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionTitle}>😊 Sentiment Analysis</Text>
                    <Text style={styles.sentimentSummary}>
                      {selectedAnalysis.sentiment.summary}
                    </Text>
                    <View style={styles.sentimentSources}>
                      <Text style={styles.sourcesLabel}>Sources:</Text>
                      {selectedAnalysis.sentiment.sources.map((source, index) => (
                        <Text key={index} style={styles.sourceItem}>{source}</Text>
                      ))}
                    </View>
                  </View>
                </ScrollView>
              </>
            )}
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  // Render backtest results modal
  const renderBacktestModal = () => (
    <Modal
      visible={showBacktestModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowBacktestModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.background, theme.surface]}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  📊 Backtest Results
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowBacktestModal(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {backtestResults.length > 0 ? (
                <>
                  <Text style={styles.resultsHeader}>
                    Performance Summary ({backtestResults.length} results)
                  </Text>
                  
                  <FlatList
                    data={backtestResults}
                    keyExtractor={(item, index) => `${item.symbol}-${item.strategy}-${index}`}
                    renderItem={({ item, index }) => (
                      <View style={styles.resultCard}>
                        <LinearGradient
                          colors={[
                            item.totalReturnPercent > 0 ? theme.success + '15' : theme.error + '15',
                            theme.surface
                          ]}
                          style={styles.resultGradient}
                        >
                          <View style={styles.resultHeader}>
                            <Text style={styles.resultSymbol}>{item.symbol}</Text>
                            <Text style={styles.resultStrategy}>{item.strategy}</Text>
                            <Text style={[
                              styles.resultReturn,
                              { color: item.totalReturnPercent > 0 ? theme.success : theme.error }
                            ]}>
                              {item.totalReturnPercent > 0 ? '+' : ''}{item.totalReturnPercent.toFixed(2)}%
                            </Text>
                          </View>
                          
                          <View style={styles.resultMetrics}>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricLabel}>Total Trades:</Text>
                              <Text style={styles.metricValue}>{item.totalTrades}</Text>
                            </View>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricLabel}>Win Rate:</Text>
                              <Text style={[
                                styles.metricValue,
                                { color: item.winRate > 50 ? theme.success : theme.error }
                              ]}>
                                {item.winRate.toFixed(1)}%
                              </Text>
                            </View>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricLabel}>Max Drawdown:</Text>
                              <Text style={[styles.metricValue, { color: theme.error }]}>
                                -{item.maxDrawdown.toFixed(2)}%
                              </Text>
                            </View>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricLabel}>Sharpe Ratio:</Text>
                              <Text style={[
                                styles.metricValue,
                                { color: item.sharpeRatio > 1 ? theme.success : theme.warning }
                              ]}>
                                {item.sharpeRatio.toFixed(2)}
                              </Text>
                            </View>
                            <View style={styles.metricRow}>
                              <Text style={styles.metricLabel}>Profit Factor:</Text>
                              <Text style={[
                                styles.metricValue,
                                { color: item.profitFactor > 1 ? theme.success : theme.error }
                              ]}>
                                {item.profitFactor.toFixed(2)}
                              </Text>
                            </View>
                          </View>
                          
                          <View style={styles.resultPeriod}>
                            <Text style={styles.periodText}>
                              Period: {item.period} ({item.startDate} to {item.endDate})
                            </Text>
                          </View>
                        </LinearGradient>
                      </View>
                    )}
                    showsVerticalScrollIndicator={false}
                  />

                  <TouchableOpacity
                    style={styles.exportButton}
                    onPress={() => {
                      Alert.alert('Export', 'Export functionality coming soon');
                    }}
                  >
                    <LinearGradient
                      colors={[theme.primary, theme.primaryDark]}
                      style={styles.exportGradient}
                    >
                      <Text style={styles.exportText}>📊 Export Results</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.noResultsContainer}>
                  <Text style={styles.noResultsText}>
                    No backtest results available. Run a backtest first.
                  </Text>
                </View>
              )}
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  // Render create strategy modal
  const renderCreateStrategyModal = () => (
    <Modal
      visible={showCreateStrategyModal}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => setShowCreateStrategyModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.background, theme.surface]}
            style={styles.modalContent}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  ✨ Create Custom Strategy
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setShowCreateStrategyModal(false)}
                >
                  <Text style={styles.closeButtonText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Strategy Name */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Strategy Name</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Enter strategy name..."
                  value={newStrategy.name}
                  onChangeText={(text) => setNewStrategy(prev => ({ ...prev, name: text }))}
                  placeholderTextColor={theme.textMuted}
                />
              </View>

              {/* Strategy Description */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Description (Optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Describe your strategy..."
                  value={newStrategy.description}
                  onChangeText={(text) => setNewStrategy(prev => ({ ...prev, description: text }))}
                  placeholderTextColor={theme.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Strategy Type */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Strategy Type</Text>
                <View style={styles.strategyTypeGrid}>
                  {([
                    { key: 'neural_momentum', name: 'Neural Momentum', desc: 'AI momentum trading' },
                    { key: 'lstm_reversal', name: 'LSTM Reversal', desc: 'Mean reversion with LSTM' },
                    { key: 'transformer_sentiment', name: 'Sentiment Analysis', desc: 'Transformer sentiment' },
                    { key: 'gan_synthetic', name: 'GAN Synthetic', desc: 'Synthetic data modeling' },
                    { key: 'rl_adaptive', name: 'RL Adaptive', desc: 'Reinforcement learning' }
                  ] as const).map((type) => (
                    <TouchableOpacity
                      key={type.key}
                      style={[
                        styles.strategyTypeCard,
                        newStrategy.type === type.key && styles.strategyTypeCardActive
                      ]}
                      onPress={() => setNewStrategy(prev => ({ ...prev, type: type.key }))
                      }
                    >
                      <Text style={[
                        styles.strategyTypeName,
                        newStrategy.type === type.key && styles.strategyTypeNameActive
                      ]}>
                        {type.name}
                      </Text>
                      <Text style={[
                        styles.strategyTypeDesc,
                        newStrategy.type === type.key && styles.strategyTypeDescActive
                      ]}>
                        {type.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Risk Level */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Risk Level</Text>
                <View style={styles.riskButtons}>
                  {(['conservative', 'moderate', 'aggressive'] as const).map((risk) => (
                    <TouchableOpacity
                      key={risk}
                      style={[
                        styles.riskButton,
                        newStrategy.riskLevel === risk && styles.riskButtonActive,
                        { backgroundColor: 
                          risk === 'conservative' ? theme.success + '20' : 
                          risk === 'moderate' ? theme.warning + '20' : 
                          theme.error + '20'
                        }
                      ]}
                      onPress={() => setNewStrategy(prev => ({ 
                        ...prev, 
                        riskLevel: risk,
                        parameters: {
                          ...prev.parameters,
                          position_size: risk === 'conservative' ? 10 : risk === 'moderate' ? 15 : 25,
                          stop_loss: risk === 'conservative' ? 5 : risk === 'moderate' ? 10 : 15,
                          risk_threshold: risk === 'conservative' ? 8 : risk === 'moderate' ? 15 : 25
                        }
                      }))
                      }
                    >
                      <Text style={[
                        styles.riskButtonText,
                        newStrategy.riskLevel === risk && styles.riskButtonTextActive,
                        { color: 
                          risk === 'conservative' ? theme.success : 
                          risk === 'moderate' ? theme.warning : 
                          theme.error
                        }
                      ]}>
                        {risk.charAt(0).toUpperCase() + risk.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Target Assets */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Target Assets</Text>
                <View style={styles.assetGrid}>
                  {availableAssets.map(asset => (
                    <TouchableOpacity
                      key={asset.symbol}
                      style={[
                        styles.assetChip,
                        newStrategy.targetAssets.includes(asset.symbol) && styles.assetChipSelected
                      ]}
                      onPress={() => toggleStrategyAsset(asset.symbol)}
                    >
                      <Text style={[
                        styles.assetChipText,
                        newStrategy.targetAssets.includes(asset.symbol) && styles.assetChipTextSelected
                      ]}>
                        {asset.symbol}
                      </Text>
                      <Text style={[
                        styles.assetChipSubtext,
                        newStrategy.targetAssets.includes(asset.symbol) && styles.assetChipSubtextSelected
                      ]}>
                        {asset.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Parameters */}
              <View style={styles.modalSection}>
                <Text style={styles.modalSectionTitle}>Strategy Parameters</Text>
                <View style={styles.parametersGrid}>
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterLabel}>Position Size (%)</Text>
                    <TextInput
                      style={styles.parameterInput}
                      value={newStrategy.parameters.position_size.toString()}
                      onChangeText={(text) => setNewStrategy(prev => ({
                        ...prev,
                        parameters: { ...prev.parameters, position_size: parseInt(text) || 15 }
                      }))}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterLabel}>Stop Loss (%)</Text>
                    <TextInput
                      style={styles.parameterInput}
                      value={newStrategy.parameters.stop_loss.toString()}
                      onChangeText={(text) => setNewStrategy(prev => ({
                        ...prev,
                        parameters: { ...prev.parameters, stop_loss: parseInt(text) || 10 }
                      }))}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                  
                  <View style={styles.parameterItem}>
                    <Text style={styles.parameterLabel}>Take Profit (%)</Text>
                    <TextInput
                      style={styles.parameterInput}
                      value={newStrategy.parameters.take_profit.toString()}
                      onChangeText={(text) => setNewStrategy(prev => ({
                        ...prev,
                        parameters: { ...prev.parameters, take_profit: parseInt(text) || 20 }
                      }))}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textMuted}
                    />
                  </View>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.cancelButton]}
                  onPress={() => setShowCreateStrategyModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.modalActionButton, styles.saveButton]}
                  onPress={saveCustomStrategy}
                >
                  <LinearGradient
                    colors={[theme.primary, theme.primaryDark]}
                    style={styles.saveButtonGradient}
                  >
                    <Text style={styles.saveButtonText}>Create Strategy</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );

  // Render tab content
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'analyzer':
        return (
          <View style={styles.tabContent}>
            {renderAssetSelector()}
            
            {analysisLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.loadingText}>Analyzing markets with AI models...</Text>
                <Animated.View style={[
                  styles.scanningIndicator,
                  {
                    opacity: scanningAnimation,
                    transform: [{
                      scale: scanningAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    }],
                  }
                ]}>
                  <Text style={styles.scanningText}>🤖 AI Processing</Text>
                </Animated.View>
              </View>
            ) : (
              <FlatList
                data={marketAnalyses}
                renderItem={renderMarketAnalysis}
                keyExtractor={(item) => item.symbol}
                showsVerticalScrollIndicator={false}
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={theme.primary}
                    colors={[theme.primary]}
                  />
                }
                contentContainerStyle={styles.analysisGrid}
              />
            )}
          </View>
        );

      case 'models':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>🧠 AI Models</Text>
            <Text style={styles.sectionSubtitle}>
              Advanced neural networks powering market analysis
            </Text>
            <FlatList
              data={aiModels}
              renderItem={renderAIModel}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modelsGrid}
            />
          </View>
        );

      case 'strategies':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>🎯 Neural Strategies</Text>
            <Text style={styles.sectionSubtitle}>
              AI-powered trading strategies with adaptive learning
            </Text>
            
            {/* Strategy Creation Button */}
            <TouchableOpacity
              style={styles.createStrategyButton}
              onPress={createCustomStrategy}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDark]}
                style={styles.createStrategyGradient}
              >
                <Text style={styles.createStrategyIcon}>✨</Text>
                <Text style={styles.createStrategyText}>Create Custom Strategy</Text>
                <Text style={styles.createStrategySubtext}>AI-assisted strategy builder</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Active Strategies */}
            <Text style={styles.subsectionTitle}>🎯 Active Strategies</Text>
            <FlatList
              data={strategies}
              renderItem={renderAdvancedStrategy}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.strategiesGrid}
              ListEmptyComponent={() => (
                <View style={styles.emptyStrategies}>
                  <Text style={styles.emptyIcon}>🤖</Text>
                  <Text style={styles.emptyTitle}>No Active Strategies</Text>
                  <Text style={styles.emptySubtitle}>
                    Create your first AI-powered strategy to get started
                  </Text>
                </View>
              )}
            />

            {/* Strategy Templates */}
            <Text style={styles.subsectionTitle}>📋 Strategy Templates</Text>
            <FlatList
              data={getStrategyTemplates()}
              renderItem={renderStrategyTemplate}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              horizontal={true}
              contentContainerStyle={styles.templatesContainer}
            />
          </View>
        );

      case 'backtest':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionTitle}>📈 AI Backtesting Engine</Text>
            <Text style={styles.sectionSubtitle}>
              Professional-grade backtesting with advanced analytics
            </Text>
            
            {/* Backtest Controls */}
            <View style={styles.backtestControls}>
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Period (Days):</Text>
                <View style={styles.periodSelector}>
                  {[30, 60, 90, 180].map(period => (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.periodButton,
                        backtestPeriod === period && styles.periodButtonActive
                      ]}
                      onPress={() => setBacktestPeriod(period)}
                    >
                      <Text style={[
                        styles.periodButtonText,
                        backtestPeriod === period && styles.periodButtonTextActive
                      ]}>
                        {period}d
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              
              <View style={styles.controlRow}>
                <Text style={styles.controlLabel}>Selected Assets:</Text>
                <Text style={styles.controlValue}>
                  {selectedAssets.join(', ')} ({selectedAssets.length} total)
                </Text>
              </View>
            </View>

            {/* Strategy Cards */}
            <Text style={styles.sectionTitle}>Available Strategies</Text>
            <FlatList
              data={historicalBacktestService.getDefaultStrategies()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.strategyCard}
                  onPress={() => runBacktest(item, selectedAssets)}
                  disabled={backtestLoading}
                >
                  <LinearGradient
                    colors={[theme.surface, theme.surfaceVariant]}
                    style={styles.strategyGradient}
                  >
                    <View style={styles.strategyHeader}>
                      <Text style={styles.strategyName}>{item.name}</Text>
                      <Text style={styles.strategyType}>
                        {item.type.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                    
                    <View style={styles.strategyParams}>
                      <Text style={styles.paramText}>
                        Risk: {item.parameters.risk_threshold}% | 
                        Position: {item.parameters.position_size}% | 
                        SL: {item.parameters.stop_loss}%
                      </Text>
                    </View>
                    
                    {backtestLoading && (
                      <ActivityIndicator 
                        color={theme.primary} 
                        style={styles.strategyLoader}
                      />
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.name}
              showsVerticalScrollIndicator={false}
            />

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity
                style={[styles.quickActionButton, styles.primaryAction]}
                onPress={runMultiStrategyBacktest}
                disabled={backtestLoading || selectedAssets.length === 0}
              >
                <LinearGradient
                  colors={[theme.primary, theme.primaryDark]}
                  style={styles.quickActionGradient}
                >
                  {backtestLoading ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <>
                      <Text style={styles.quickActionText}>🚀 Multi-Strategy Backtest</Text>
                      <Text style={styles.quickActionSubtext}>
                        Test all strategies on {selectedAssets.length} assets
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Results Summary */}
            {backtestResults.length > 0 && (
              <View style={styles.resultsPreview}>
                <Text style={styles.sectionTitle}>📊 Latest Results</Text>
                <TouchableOpacity
                  style={styles.resultsCard}
                  onPress={() => setShowBacktestModal(true)}
                >
                  <LinearGradient
                    colors={[theme.success + '20', theme.success + '10']}
                    style={styles.resultsGradient}
                  >
                    <Text style={styles.resultsTitle}>
                      {backtestResults.length} Strategy Results
                    </Text>
                    <Text style={styles.resultsSubtitle}>
                      Best: {backtestResults[0]?.totalReturnPercent.toFixed(2)}% | 
                      Avg: {(backtestResults.reduce((sum, r) => sum + r.totalReturnPercent, 0) / backtestResults.length).toFixed(2)}%
                    </Text>
                    <Text style={styles.viewDetailsText}>
                      Tap to view detailed analysis →
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            )}
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.gradient}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>🧠 AI Strategy Lab</Text>
            <Text style={styles.headerSubtitle}>
              Advanced Machine Learning for Trading
            </Text>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'analyzer', title: 'Market AI', icon: '🔍' },
              { key: 'models', title: 'Neural Models', icon: '🧠' },
              { key: 'strategies', title: 'Strategies', icon: '🎯' },
              { key: 'backtest', title: 'Backtest', icon: '📈' },
            ].map((tab) => (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, selectedTab === tab.key && styles.activeTab]}
                onPress={() => setSelectedTab(tab.key as any)}
              >
                <Text style={styles.tabIcon}>{tab.icon}</Text>
                <Text style={[styles.tabText, selectedTab === tab.key && styles.activeTabText]}>
                  {tab.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {renderTabContent()}
        </View>

        {/* Modals */}
        {renderAnalysisModal()}
        {renderBacktestModal()}
        {renderCreateStrategyModal()}
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
  tabContainer: {
    paddingHorizontal: theme.spacing.md,
    marginVertical: theme.spacing.md,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.surface + '80',
  },
  activeTab: {
    backgroundColor: theme.primary + '20',
  },
  tabIcon: {
    fontSize: 20,
    marginBottom: theme.spacing.xs,
  },
  tabText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  
  // Asset Selector
  assetSelector: {
    marginBottom: theme.spacing.lg,
  },
  assetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  assetChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    minWidth: 80,
  },
  assetChipSelected: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  assetChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  assetChipTextSelected: {
    color: theme.primary,
  },
  assetChipSubtext: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  assetChipSubtextSelected: {
    color: theme.primary + '80',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: theme.spacing.lg,
    textAlign: 'center',
  },
  scanningIndicator: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.surface + '80',
  },
  scanningText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
  },

  // Models
  modelsGrid: {
    paddingBottom: theme.spacing.xl,
  },
  modelCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  modelGradient: {
    padding: theme.spacing.lg,
  },
  modelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  modelInfo: {
    flex: 1,
  },
  modelName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  modelType: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  modelAccuracy: {
    alignItems: 'center',
  },
  accuracyValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.success,
  },
  accuracyLabel: {
    fontSize: 10,
    color: theme.textMuted,
  },
  modelDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  modelCapabilities: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  capabilityTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.accent + '20',
  },
  capabilityText: {
    fontSize: 10,
    color: theme.accent,
    fontWeight: '500',
  },
  modelStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },

  // Analysis
  analysisGrid: {
    paddingBottom: theme.spacing.xl,
  },
  analysisCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  analysisGradient: {
    padding: theme.spacing.lg,
  },
  analysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  assetInfo: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  assetName: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: theme.spacing.xs,
  },
  priceInfo: {
    alignItems: 'flex-end',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  priceChange: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: theme.spacing.xs,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.background + '40',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  predictionItem: {
    alignItems: 'center',
  },
  predictionLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  predictionValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  signalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  signalItem: {
    alignItems: 'center',
  },
  signalLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  signalValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  patternsRow: {
    marginTop: theme.spacing.sm,
  },
  patternsLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  patternsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  patternTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.warning + '20',
    gap: theme.spacing.xs,
  },
  patternText: {
    fontSize: 10,
    color: theme.warning,
    fontWeight: '500',
  },
  patternStrength: {
    fontSize: 10,
    color: theme.warning,
    fontWeight: 'bold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    maxHeight: '90%',
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalContent: {
    maxHeight: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: theme.textSecondary,
    fontWeight: 'bold',
  },
  modalScroll: {
    maxHeight: '100%',
  },
  modalSection: {
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '40',
  },
  modalSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  predictionCard: {
    backgroundColor: theme.background + '40',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  predictionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  predictionModelName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  predictionResult: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  predictionConfidence: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  predictionReasoning: {
    fontSize: 12,
    color: theme.textMuted,
    lineHeight: 16,
  },
  technicalGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  technicalItem: {
    alignItems: 'center',
    flex: 1,
  },
  technicalLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  technicalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  riskGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskItem: {
    alignItems: 'center',
    flex: 1,
  },
  riskLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  riskValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  riskOverall: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  sentimentSummary: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  sentimentSources: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sourcesLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginRight: theme.spacing.sm,
  },
  sourceItem: {
    fontSize: 12,
    color: theme.accent,
    fontWeight: '500',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.accent + '20',
  },
  comingSoon: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xl * 2,
    fontStyle: 'italic',
  },
  
  // Backtest styles
  backtestControls: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.border,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  controlValue: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 2,
    textAlign: 'right',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  periodButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surfaceVariant,
    borderWidth: 1,
    borderColor: theme.border,
  },
  periodButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  periodButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  periodButtonTextActive: {
    color: 'white',
  },
  strategyCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  strategyGradient: {
    padding: theme.spacing.md,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  strategyType: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  strategyParams: {
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  paramText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  strategyLoader: {
    marginTop: theme.spacing.sm,
  },
  quickActions: {
    marginTop: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  quickActionButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  primaryAction: {
    elevation: 6,
  },
  quickActionGradient: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  quickActionSubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 4,
  },
  resultsPreview: {
    marginTop: theme.spacing.xl,
  },
  resultsCard: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginTop: theme.spacing.md,
  },
  resultsGradient: {
    padding: theme.spacing.lg,
  },
  resultsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.success,
    marginBottom: theme.spacing.sm,
  },
  resultsSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  viewDetailsText: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
  },
  
  // Modal styles for backtest results
  resultsHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  resultCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  resultGradient: {
    padding: theme.spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  resultSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  resultStrategy: {
    fontSize: 12,
    color: theme.textSecondary,
    backgroundColor: theme.surfaceVariant,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  resultReturn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultMetrics: {
    gap: theme.spacing.sm,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  resultPeriod: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  periodText: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  exportButton: {
    marginTop: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  exportGradient: {
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  exportText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  noResultsContainer: {
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Model Action Buttons
  modelActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modelButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainButton: {
    backgroundColor: theme.primary + '20',
    borderWidth: 1,
    borderColor: theme.primary + '40',
  },
  optimizeButton: {
    backgroundColor: theme.accent + '20',
    borderWidth: 1,
    borderColor: theme.accent + '40',
  },
  modelButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },

  // Strategy Creation
  createStrategyButton: {
    marginBottom: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  createStrategyGradient: {
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  createStrategyIcon: {
    fontSize: 32,
    marginBottom: theme.spacing.sm,
  },
  createStrategyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: theme.spacing.xs,
  },
  createStrategySubtext: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
  },

  // Strategy Sections
  subsectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  strategiesGrid: {
    paddingBottom: theme.spacing.xl,
  },
  emptyStrategies: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Templates
  templatesContainer: {
    paddingBottom: theme.spacing.xl,
  },
  templateCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  templateGradient: {
    padding: theme.spacing.lg,
  },
  templateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  templateType: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  templateDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  templateMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  templateMetric: {
    alignItems: 'center',
  },
  templateMetricLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  templateMetricValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  templateAction: {
    backgroundColor: theme.accent + '20',
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.accent + '40',
  },
  templateActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.accent,
  },

  // Additional Styles for Strategy Components
  strategyInfo: {
    flex: 1,
  },
  strategyStatus: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.success + '20',
  },
  strategyStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.success,
  },
  strategyDescription: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.md,
  },
  strategyMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  metricItem: {
    alignItems: 'center',
  },
  strategyActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },

  // Risk Level Selector
  riskSelector: {
    marginBottom: theme.spacing.md,
  },
  riskSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  riskButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  riskButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  riskButtonActive: {
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  riskButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  riskButtonTextActive: {
    fontWeight: 'bold',
  },

  // Text Input
  textInput: {
    height: 40,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Strategy Type
  strategyTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  strategyTypeCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  strategyTypeCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + '10',
  },
  strategyTypeName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  strategyTypeDesc: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  strategyTypeDescActive: {
    color: theme.primary,
  },

  // Parameters
  parametersGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  parameterItem: {
    flex: 1,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'flex-start',
  },
  parameterLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
  },
  parameterInput: {
    height: 40,
    width: '100%',
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
    fontSize: 14,
    color: theme.textPrimary,
  },

  // Modal Actions
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  saveButton: {
    backgroundColor: theme.primary,
  },
  saveButtonGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
  },

  // Missing Modal Styles
 
  strategyTypeNameActive: {
    color: theme.primary,
  },
  
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  // Strategy Details
  strategyDetails: {
    backgroundColor: theme.background + '40',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 12,
    color: theme.textPrimary,
    fontWeight: '600',
  },

  // Template Details
  templateDetails: {
    marginBottom: theme.spacing.sm,
  },
  templateDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  templateDetailLabel: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
  },
  templateDetailValue: {
    fontSize: 11,
    color: theme.primary,
    fontWeight: '600',
  },
  templateFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: theme.spacing.sm,
  },
  featureTag: {
    backgroundColor: theme.accent + '15',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featureText: {
    fontSize: 9,
    color: theme.accent,
    fontWeight: '500',
  },
  // Classic strategy details styles
  classicDetailsContainer: {
    backgroundColor: theme.surfaceVariant + '50',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  classicDetailsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  classicDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    borderBottomWidth: 0.5,
    borderBottomColor: theme.border + '50',
  },
  classicDetailLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
    flex: 1,
  },
  classicDetailValue: {
    fontSize: 12,
    color: theme.textPrimary,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  // Key tools styles
  keyToolsContainer: {
    backgroundColor: theme.surface + '80',
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.sm,
    marginVertical: theme.spacing.sm,
    borderWidth: 1,
    borderColor: theme.accent + '30',
  },
  keyToolsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.accent,
    marginBottom: theme.spacing.sm,
  },
  keyToolsList: {
    marginLeft: theme.spacing.xs,
  },
  keyToolItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  keyToolBullet: {
    fontSize: 12,
    color: theme.accent,
    marginRight: theme.spacing.xs,
    fontWeight: 'bold',
  },
  keyToolText: {
    fontSize: 11,
    color: theme.textPrimary,
    flex: 1,
  },
});

export default StrategyScreenNew;

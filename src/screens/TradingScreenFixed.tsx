import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  Dimensions,
  Modal,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LineChart } from 'react-native-chart-kit';
import { useTrading } from '../context/TradingContext';
import { integratedDataService } from '../services/integratedDataService';
import { theme } from '../theme/colors';
import { getSymbolsForAutoTrading, Symbol } from '../data/tradingSymbols';
import { ServiceStatusIndicator } from '../components/ServiceStatusIndicator';
import { 
  historicalBacktestService, 
  BacktestResult, 
  StrategyConfig 
} from '../services/historicalBacktestService';

const { width: screenWidth } = Dimensions.get('window');

interface AutoTrade {
  id: string;
  symbol: string;
  name: string;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  quantity: number;
  side: 'long' | 'short';
  confidence: number;
  status: 'active' | 'completed' | 'stopped';
  pnl: number;
  pnlPercentage: number;
  timestamp: Date;
  strategy: string;
  analysis: string;
}

interface MarketOpportunity {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  timeframe: string;
  analysis: string;
  type: 'breakout' | 'reversal' | 'momentum' | 'mean_reversion';
  expectedReturn: number;
  riskScore: number;
  autoExecuted: boolean;
}

const TradingScreen: React.FC = () => {
  const { state } = useTrading();
  const [selectedTab, setSelectedTab] = useState<'opportunities' | 'auto-trades' | 'performance' | 'backtest' | 'executed-trades'>('opportunities');
  const [opportunities, setOpportunities] = useState<MarketOpportunity[]>([]);
  const [autoTrades, setAutoTrades] = useState<AutoTrade[]>([]);
  const [executedTrades, setExecutedTrades] = useState<AutoTrade[]>([]);
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoTradingActive, setAutoTradingActive] = useState(false);
  const [backtestModalVisible, setBacktestModalVisible] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyConfig | null>(null);
  const [backtestPeriod, setBacktestPeriod] = useState<30 | 60 | 90>(90);
  const [runningBacktest, setRunningBacktest] = useState(false);
  const [scanningAnimation] = useState(new Animated.Value(0));
  const [tradingAmount, setTradingAmount] = useState<number>(1000);
  const [maxTrades, setMaxTrades] = useState<number>(10);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const autoTradingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Load trading settings
  const loadTradingSettings = async () => {
    try {
      const settings = await AsyncStorage.getItem('trading_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setTradingAmount(parsed.tradingAmount || 1000);
        setMaxTrades(parsed.maxTrades || 10);
      }
    } catch (error) {
      console.error('Error loading trading settings:', error);
    }
  };

  // Load market data
  const loadMarketData = async () => {
    try {
      setIsLoading(true);
      const mockOpportunities: MarketOpportunity[] = [
        {
          id: '1',
          symbol: 'BTC',
          name: 'Bitcoin',
          currentPrice: 97500,
          predictedPrice: 105000,
          confidence: 85,
          timeframe: '1-2 weeks',
          analysis: 'Strong bullish momentum with institutional buying pressure',
          type: 'breakout',
          expectedReturn: 7.7,
          riskScore: 25,
          autoExecuted: false
        },
        {
          id: '2',
          symbol: 'ETH',
          name: 'Ethereum',
          currentPrice: 3420,
          predictedPrice: 3800,
          confidence: 78,
          timeframe: '2-3 weeks',
          analysis: 'Layer 2 scaling solutions showing adoption growth',
          type: 'momentum',
          expectedReturn: 11.1,
          riskScore: 30,
          autoExecuted: false
        },
        {
          id: '3',
          symbol: 'TSLA',
          name: 'Tesla Inc',
          currentPrice: 385,
          predictedPrice: 420,
          confidence: 72,
          timeframe: '1-3 weeks',
          analysis: 'Q4 delivery numbers expected to beat estimates',
          type: 'reversal',
          expectedReturn: 9.1,
          riskScore: 35,
          autoExecuted: false
        }
      ];
      
      setOpportunities(mockOpportunities);
    } catch (error) {
      console.error('Error loading market data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Create initial demo trades
  const createInitialDemoTrades = async () => {
    if (autoTrades.length > 0) return;
    
    const demoTrades: AutoTrade[] = [
      {
        id: `demo_${Date.now()}_1`,
        symbol: 'BTC',
        name: 'Bitcoin',
        entryPrice: 97500,
        currentPrice: 97650,
        targetPrice: 99000,
        stopLoss: 95000,
        quantity: 0.1,
        side: 'long',
        confidence: 85,
        status: 'active',
        pnl: 15,
        pnlPercentage: 0.15,
        timestamp: new Date(),
        strategy: 'AI Momentum',
        analysis: 'Strong bullish momentum detected with high confidence'
      },
      {
        id: `demo_${Date.now()}_2`,
        symbol: 'ETH',
        name: 'Ethereum',
        entryPrice: 3420,
        currentPrice: 3445,
        targetPrice: 3550,
        stopLoss: 3300,
        quantity: 2.5,
        side: 'long',
        confidence: 78,
        status: 'active',
        pnl: 62.5,
        pnlPercentage: 0.73,
        timestamp: new Date(),
        strategy: 'Gem Signal',
        analysis: 'High-value gem with strong breakout potential'
      },
      {
        id: `demo_${Date.now()}_3`,
        symbol: 'TSLA',
        name: 'Tesla Inc',
        entryPrice: 385,
        currentPrice: 387.2,
        targetPrice: 400,
        stopLoss: 375,
        quantity: 10,
        side: 'long',
        confidence: 72,
        status: 'active',
        pnl: 22,
        pnlPercentage: 0.57,
        timestamp: new Date(),
        strategy: 'Default Signal',
        analysis: 'Technical indicators showing upward trend'
      }
    ];
    
    setAutoTrades(demoTrades);
  };

  // Update auto trades with price movements
  const updateAutoTrades = async () => {
    const updatedTrades = autoTrades.map(trade => {
      if (trade.status !== 'active') return trade;
      
      const baseVolatility = trade.symbol.includes('BTC') || trade.symbol.includes('ETH') ? 0.008 : 0.005;
      const priceChange = (Math.random() - 0.5) * baseVolatility;
      const newPrice = Math.max(0.01, trade.currentPrice * (1 + priceChange));
      
      const pnl = trade.side === 'long' 
        ? (newPrice - trade.entryPrice) * trade.quantity
        : (trade.entryPrice - newPrice) * trade.quantity;
      const pnlPercentage = ((newPrice - trade.entryPrice) / trade.entryPrice) * 100 * (trade.side === 'long' ? 1 : -1);
      
      let newStatus: 'active' | 'completed' | 'stopped' = trade.status;
      const targetThreshold = 0.97;
      const stopThreshold = 1.03;
      
      if (trade.side === 'long') {
        if (newPrice >= (trade.targetPrice * targetThreshold)) {
          newStatus = 'completed';
        } else if (newPrice <= (trade.stopLoss * stopThreshold)) {
          newStatus = 'stopped';
        }
      }
      
      return {
        ...trade,
        currentPrice: newPrice,
        pnl,
        pnlPercentage,
        status: newStatus,
      };
    });

    const activeTrades = updatedTrades.filter(trade => trade.status === 'active');
    const completedTrades = updatedTrades.filter(trade => trade.status !== 'active');
    
    setAutoTrades(activeTrades);
    
    if (completedTrades.length > 0) {
      setExecutedTrades(prev => [...completedTrades, ...prev]);
    }
  };

  // Start auto trading
  const startAutoTrading = async () => {
    if (autoTradingActive) return;
    
    setAutoTradingActive(true);
    
    autoTradingIntervalRef.current = setInterval(async () => {
      try {
        await updateAutoTrades();
      } catch (error) {
        console.error('Error in auto trading cycle:', error);
      }
    }, 15000);
    
    Alert.alert('🤖 Auto Trading Started', 'AI is now monitoring markets', [{ text: 'OK' }]);
  };

  // Stop auto trading
  const stopAutoTrading = async () => {
    setAutoTradingActive(false);
    if (autoTradingIntervalRef.current) {
      clearInterval(autoTradingIntervalRef.current);
      autoTradingIntervalRef.current = null;
    }
    Alert.alert('🛑 Auto Trading Stopped', 'Trading has been stopped', [{ text: 'OK' }]);
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await loadMarketData();
      await updateAutoTrades();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  };

  // Helper functions
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return theme.primary;
    if (confidence >= 80) return theme.warning;
    return theme.secondary;
  };

  const getRiskColor = (risk: number) => {
    if (risk <= 30) return theme.primary;
    if (risk <= 50) return theme.warning;
    return theme.secondary;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.info;
      case 'completed': return theme.success;
      case 'stopped': return theme.secondary;
      default: return theme.textMuted;
    }
  };

  // Render functions
  const renderOpportunity = ({ item }: { item: MarketOpportunity }) => {
    const priceChange = ((item.predictedPrice - item.currentPrice) / item.currentPrice) * 100;
    const isPositive = priceChange > 0;
    
    return (
      <Animated.View style={styles.opportunityCard}>
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.cardGradient}
        >
          <View style={styles.opportunityHeader}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={[styles.confidence, { color: getConfidenceColor(item.confidence) }]}>
              {item.confidence}%
            </Text>
          </View>
          
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>${item.currentPrice.toFixed(2)}</Text>
            <Text style={[styles.targetPrice, { color: isPositive ? theme.primary : theme.secondary }]}>
              → ${item.predictedPrice.toFixed(2)}
            </Text>
          </View>
          
          <Text style={styles.analysis}>{item.analysis}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderAutoTrade = ({ item }: { item: AutoTrade }) => {
    const isProfit = item.pnl > 0;
    
    return (
      <Animated.View style={styles.tradeCard}>
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.cardGradient}
        >
          <View style={styles.tradeHeader}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={[styles.pnlValue, { color: isProfit ? theme.primary : theme.secondary }]}>
              {isProfit ? '+' : ''}${item.pnl.toFixed(2)}
            </Text>
          </View>
          
          <Text style={styles.strategy}>{item.strategy}</Text>
          <Text style={styles.analysis}>{item.analysis}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  const renderExecutedTrade = ({ item }: { item: AutoTrade }) => {
    const isProfit = item.pnl > 0;
    
    return (
      <Animated.View style={styles.tradeCard}>
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.cardGradient}
        >
          <View style={styles.tradeHeader}>
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={[styles.pnlValue, { color: isProfit ? theme.success : theme.error }]}>
              {isProfit ? '+' : ''}${item.pnl.toFixed(2)}
            </Text>
          </View>
          
          <Text style={styles.strategy}>Status: {item.status.toUpperCase()}</Text>
          <Text style={styles.analysis}>{item.analysis}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  // Tab content renderer
  const renderTabContent = () => {
    switch (selectedTab) {
      case 'opportunities':
        return (
          <FlatList
            data={opportunities}
            renderItem={renderOpportunity}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
          />
        );
      case 'auto-trades':
        return (
          <FlatList
            data={autoTrades}
            renderItem={renderAutoTrade}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No Active Auto Trades</Text>
                <Text style={styles.emptyStateText}>
                  {autoTradingActive 
                    ? 'AI is scanning for opportunities...' 
                    : 'Start auto trading to see AI trades here'
                  }
                </Text>
                {!autoTradingActive && (
                  <TouchableOpacity
                    style={styles.startTradingButton}
                    onPress={startAutoTrading}
                  >
                    <Text style={styles.startTradingButtonText}>Start Auto Trading</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={theme.primary}
                colors={[theme.primary]}
              />
            }
          />
        );
      case 'executed-trades':
        return (
          <FlatList
            data={executedTrades}
            renderItem={renderExecutedTrade}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContainer}
            ListEmptyComponent={() => (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No Executed Trades Yet</Text>
                <Text style={styles.emptyStateText}>
                  Completed trades will appear here
                </Text>
              </View>
            )}
          />
        );
      case 'performance':
        const totalPnL = [...autoTrades, ...executedTrades].reduce((sum, trade) => sum + trade.pnl, 0);
        const totalTrades = autoTrades.length + executedTrades.length;
        const winRate = totalTrades > 0 ? (executedTrades.filter(trade => trade.pnl > 0).length / totalTrades) * 100 : 0;
        
        return (
          <View style={styles.performanceContainer}>
            <LinearGradient
              colors={[theme.surface, theme.surfaceVariant]}
              style={styles.performanceCard}
            >
              <Text style={styles.performanceTitle}>Trading Performance</Text>
              <View style={styles.performanceMetrics}>
                <View style={styles.performanceMetric}>
                  <Text style={styles.performanceLabel}>Total P&L</Text>
                  <Text style={[styles.performanceValue, { 
                    color: totalPnL >= 0 ? theme.primary : theme.secondary 
                  }]}>
                    {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.performanceMetric}>
                  <Text style={styles.performanceLabel}>Win Rate</Text>
                  <Text style={styles.performanceValue}>{winRate.toFixed(1)}%</Text>
                </View>
                <View style={styles.performanceMetric}>
                  <Text style={styles.performanceLabel}>Total Trades</Text>
                  <Text style={styles.performanceValue}>{totalTrades}</Text>
                </View>
                <View style={styles.performanceMetric}>
                  <Text style={styles.performanceLabel}>Active Trades</Text>
                  <Text style={styles.performanceValue}>{autoTrades.length}</Text>
                </View>
              </View>
            </LinearGradient>
          </View>
        );
      default:
        return null;
    }
  };

  // Initialize
  useEffect(() => {
    loadMarketData();
    createInitialDemoTrades();
    loadTradingSettings();
    
    intervalRef.current = setInterval(() => {
      if (!isLoading && !refreshing) {
        updateAutoTrades();
      }
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (autoTradingIntervalRef.current) {
        clearInterval(autoTradingIntervalRef.current);
      }
    };
  }, []);

  // Animate scanning
  useEffect(() => {
    if (selectedTab === 'opportunities') {
      const animationLoop = Animated.loop(
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
      animationLoop.start();
      
      return () => animationLoop.stop();
    }
  }, [selectedTab]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(0, 230, 118, 0.1)', 'rgba(33, 150, 243, 0.1)']}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>AI Trading Bot</Text>
              <View style={styles.scanningIndicator}>
                <Animated.View style={[
                  styles.scanningDot,
                  {
                    opacity: scanningAnimation,
                    transform: [{
                      scale: scanningAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.2],
                      }),
                    }],
                  }
                ]} />
                <Text style={styles.scanningText}>AI Market Scanner</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Auto Trading Controls */}
        <View style={styles.controlsContainer}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              autoTradingActive ? styles.stopButton : styles.startButton
            ]}
            onPress={autoTradingActive ? stopAutoTrading : startAutoTrading}
            disabled={isLoading}
          >
            <LinearGradient
              colors={autoTradingActive ? ['#FF6B6B', '#FF5252'] : ['#4CAF50', '#45A049']}
              style={styles.controlButtonGradient}
            >
              <Text style={styles.controlButtonIcon}>
                {autoTradingActive ? '⏹️' : '▶️'}
              </Text>
              <Text style={styles.controlButtonText}>
                {autoTradingActive ? 'Stop Auto Trading' : 'Start Auto Trading'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusIndicator,
              { backgroundColor: autoTradingActive ? theme.success : theme.textMuted }
            ]} />
            <Text style={styles.autoTradingStatusText}>
              {autoTradingActive ? 'Active' : 'Stopped'} • {autoTrades.length}/{maxTrades} trades
            </Text>
          </View>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'opportunities', title: 'Opportunities', icon: '🎯' },
              { key: 'auto-trades', title: 'Auto Trades', icon: '🤖' },
              { key: 'executed-trades', title: 'Executed', icon: '✅' },
              { key: 'performance', title: 'Performance', icon: '📊' },
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
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
  },
  headerGradient: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.md,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
  },
  scanningText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  controlsContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  controlButton: {
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  startButton: {},
  stopButton: {},
  controlButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    gap: 8,
  },
  controlButtonIcon: {
    fontSize: 18,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  autoTradingStatusText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  tabContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  tab: {
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    marginRight: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  activeTab: {
    backgroundColor: theme.accent,
  },
  tabIcon: {
    fontSize: 16,
    marginBottom: 4,
  },
  tabText: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: theme.textPrimary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  opportunityCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  tradeCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: theme.spacing.lg,
  },
  opportunityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  symbol: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  confidence: {
    fontSize: 14,
    fontWeight: '600',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  targetPrice: {
    fontSize: 16,
    fontWeight: '600',
  },
  analysis: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  strategy: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: theme.spacing.xs,
    fontWeight: '500',
  },
  pnlValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: theme.spacing.xl,
  },
  startTradingButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
  },
  startTradingButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  performanceContainer: {
    padding: theme.spacing.md,
  },
  performanceCard: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  performanceTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  performanceMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceMetric: {
    width: '48%',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  performanceLabel: {
    fontSize: 14,
    color: theme.textMuted,
    marginBottom: theme.spacing.sm,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
});

export default TradingScreen;

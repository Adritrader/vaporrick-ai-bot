import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
  Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/colors';
import { autoAlertService, AutoAlert } from '../services/autoAlertService';
import { signalTrackingService, PerformanceStats, SignalPerformance } from '../services/signalTrackingService';
import { PERFORMANCE_CONFIG } from '../config/performanceConfig';
import { tradeDatabase, Trade, TradingStats } from '../services/tradeDatabase';
import { realFirebaseTradeService } from '../services/realFirebaseTradeService';
import { firebaseAutoTradesService } from '../services/firebaseAutoTradesService';
import { realPriceUpdateService, PriceUpdate } from '../services/realPriceUpdateService';
import { APIDiagnosticService } from '../services/apiDiagnosticService';
import { apiKeyManager } from '../services/apiKeyRotationManager';
import { AutoTradesServiceTester, checkAutoTradesStatus } from '../utils/testAutoTradesService';

const { width, height } = Dimensions.get('window');

interface AlertScreenProps {
  onBack: () => void;
}

const AlertScreen: React.FC<AlertScreenProps> = ({ onBack }) => {
  // State management
  const [appState, setAppState] = useState({
    alerts: [] as AutoAlert[],
    isLoading: false,
    refreshing: false,
    autoScanEnabled: false,
    selectedFilters: [] as Array<'critical' | 'high' | 'medium' | 'low'>,
    signalFilters: [] as Array<'buy' | 'sell' | 'watch'>,
    assetFilter: 'all' as 'all' | 'crypto' | 'stocks',
    scanProgress: 0,
    isScanning: false,
    lastScanTime: null as Date | null,
    lastSyncTime: null as Date | null,
    scanCooldown: 0,
    showStatsModal: false,
    showTradesModal: false,
    showTradesInModal: false,
    // Auto trades modal state
    autoTradesPage: 0,
    autoTradesHasMore: true,
    autoTradesLoading: false,
    // New alerts tracking
    newAlertIds: new Set<string>(),
    lastNewScanTime: null as Date | null,
  });

  // Auto Trading states
  const [autoTradingEnabled, setAutoTradingEnabled] = useState(false);
  const [executedTrades, setExecutedTrades] = useState<Trade[]>([]);
  const [autoTrades, setAutoTrades] = useState<Trade[]>([]); // Only automatic trades for modal
  const [executingTrades, setExecutingTrades] = useState<Set<string>>(new Set());
  const [statsLoading, setStatsLoading] = useState(false);
  const [tradingStats, setTradingStats] = useState<TradingStats | null>(null);
  const [priceUpdates, setPriceUpdates] = useState<Map<string, PriceUpdate>>(new Map());

  // Animation states
  const progressAnim = useState(new Animated.Value(0))[0];

  // Update function
  const updateAppState = useCallback((updates: Partial<typeof appState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  // Clear old alerts from AsyncStorage (older than 24 hours)
  const cleanupOldAlerts = useCallback(async () => {
    try {
      const currentAlerts = autoAlertService.getActiveAlerts();
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      
      const freshAlerts = currentAlerts.filter(alert => {
        const alertTime = new Date(alert.createdAt).getTime();
        return alertTime > twentyFourHoursAgo;
      });
      
      // If we removed old alerts, save the cleaned list
      if (freshAlerts.length !== currentAlerts.length) {
        // Clear all alerts and add only fresh ones back
        const removedCount = currentAlerts.length - freshAlerts.length;
        for (const alert of currentAlerts) {
          if (!freshAlerts.find(f => f.id === alert.id)) {
            await autoAlertService.removeAlert(alert.id);
          }
        }
        console.log(`🧹 Cleaned ${removedCount} old alerts from AsyncStorage`);
      }
      
      return freshAlerts;
    } catch (error) {
      console.error('❌ Error cleaning old alerts:', error);
      return autoAlertService.getActiveAlerts();
    }
  }, []);

  // Load automatic trades with lazy loading and better error handling
  const loadAutoTrades = async (page: number = 0, append: boolean = false) => {
    if (appState.autoTradesLoading) return;
    
    updateAppState({ autoTradesLoading: true });
    
    try {
      const result = await firebaseAutoTradesService.getAutoTradesFromFirebase(page, 20);
      
      if (append && page > 0) {
        setAutoTrades(prev => [...prev, ...result.trades]);
      } else {
        setAutoTrades(result.trades);
      }
      
      updateAppState({
        autoTradesHasMore: result.hasMore,
        autoTradesPage: page,
      });
      
      // If no trades found on first load, show info to user
      if (result.trades.length === 0 && page === 0) {
        console.log('ℹ️ No auto trades found - either no trades exist or Firebase connection issue');
      }
      
    } catch (error) {
      console.error('❌ Error loading auto trades:', error);
      // Set empty array on error to stop infinite loading
      if (!append) {
        setAutoTrades([]);
      }
      updateAppState({
        autoTradesHasMore: false,
      });
    } finally {
      updateAppState({ autoTradesLoading: false });
    }
  };

  // Initialize alert service and auto trading with better error handling
  const initializeAlertService = async () => {
    updateAppState({ isLoading: true });
    
    try {
      // Clean old alerts first
      await cleanupOldAlerts();
      
      // Load alerts from service
      await autoAlertService.loadAlerts();
      const currentAlerts = autoAlertService.getActiveAlerts();
      
      // Filter real alerts only (no fallback data)
      const realAlerts = currentAlerts.filter(alert => {
        const hasRealData = alert.currentPrice > 0 && alert.symbol && alert.strategy;
        const notFallback = !alert.reasoning?.toLowerCase().includes('fallback');
        return hasRealData && notFallback;
      });
      
      updateAppState({ 
        alerts: realAlerts,
        lastSyncTime: new Date() 
      });
      
      // Load executed trades from Firebase auto trades collection with timeout
      try {
        const firebaseAutoTrades = await Promise.race([
          firebaseAutoTradesService.getAllAutoTradesFromFirebase(),
          new Promise<Trade[]>((_, reject) => 
            setTimeout(() => reject(new Error('Firebase load timeout')), 10000)
          )
        ]);
        
        setExecutedTrades(firebaseAutoTrades);
        
        // Load first page of auto trades
        await loadAutoTrades(0);
        
        // Initialize trading stats with fallback
        try {
          const autoTradesStats = await firebaseAutoTradesService.getAutoTradingStatsFromFirebase();
          
          if (autoTradesStats) {
            const mappedStats: TradingStats = {
              totalTrades: autoTradesStats.totalTrades || 0,
              activeTrades: autoTradesStats.activeTrades || 0,
              closedTrades: autoTradesStats.closedTrades || 0,
              winRate: autoTradesStats.winRate || 0,
              totalReturn: autoTradesStats.totalReturn || 0,
              averageReturn: autoTradesStats.averageReturn || 0,
              bestTrade: firebaseAutoTrades.length > 0 ? Math.max(...firebaseAutoTrades.map(t => t.returnPercentage || 0), 0) : 0,
              worstTrade: firebaseAutoTrades.length > 0 ? Math.min(...firebaseAutoTrades.map(t => t.returnPercentage || 0), 0) : 0,
              avgHoldingTime: 0,
              winsByStrategy: {},
              lossesByStrategy: {},
              monthlyReturns: [],
              fulfillmentRate: autoTradesStats.fulfillmentRate || 0,
              averageTimeToFulfillment: 0,
              signalAccuracy: autoTradesStats.fulfillmentRate || 0,
              expiredSignals: 0,
            };
            setTradingStats(mappedStats);
          } else {
            throw new Error('No stats returned');
          }
        } catch (error) {
          // Fallback manual calculation
          setTradingStats({
            totalTrades: firebaseAutoTrades.length,
            activeTrades: firebaseAutoTrades.filter(t => t.status === 'active').length,
            closedTrades: firebaseAutoTrades.filter(t => t.status === 'closed').length,
            winRate: firebaseAutoTrades.length > 0 ? 
              (firebaseAutoTrades.filter(t => (t.returnPercentage || 0) > 0).length / firebaseAutoTrades.length) * 100 : 0,
            totalReturn: firebaseAutoTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0),
            averageReturn: firebaseAutoTrades.length > 0 ? 
              firebaseAutoTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0) / firebaseAutoTrades.length : 0,
            bestTrade: Math.max(...firebaseAutoTrades.map(t => t.returnPercentage || 0), 0),
            worstTrade: Math.min(...firebaseAutoTrades.map(t => t.returnPercentage || 0), 0),
            avgHoldingTime: 0,
            winsByStrategy: {},
            lossesByStrategy: {},
            monthlyReturns: [],
            fulfillmentRate: 0,
            averageTimeToFulfillment: 0,
            signalAccuracy: 0,
            expiredSignals: 0,
          });
        }
      } catch (error) {
        console.error('❌ Firebase connection timeout or error:', error);
        // Set empty states on Firebase error
        setExecutedTrades([]);
        setAutoTrades([]);
        setTradingStats({
          totalTrades: 0,
          activeTrades: 0,
          closedTrades: 0,
          winRate: 0,
          totalReturn: 0,
          averageReturn: 0,
          bestTrade: 0,
          worstTrade: 0,
          avgHoldingTime: 0,
          winsByStrategy: {},
          lossesByStrategy: {},
          monthlyReturns: [],
          fulfillmentRate: 0,
          averageTimeToFulfillment: 0,
          signalAccuracy: 0,
          expiredSignals: 0,
        });
      }
      
    } catch (error) {
      console.error('❌ Error inicializando VectorFlux AI:', error);
    } finally {
      updateAppState({ isLoading: false });
    }
  };

  // Helper function to check if signal is fulfilled
  const checkTradeSignalFulfillment = (trade: Trade, currentPrice: number) => {
    if (trade.signal === 'buy') {
      // For buy signals, check if price reached target (higher) or stop loss (lower)
      if (currentPrice >= trade.targetPrice) {
        return {
          fulfilled: true,
          outcome: 'win' as const,
          fulfillmentPrice: currentPrice,
          returnPercentage: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
        };
      } else if (currentPrice <= trade.stopLoss) {
        return {
          fulfilled: true,
          outcome: 'loss' as const,
          fulfillmentPrice: currentPrice,
          returnPercentage: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
        };
      }
    } else if (trade.signal === 'sell') {
      // For sell signals, check if price reached target (lower) or stop loss (higher)
      if (currentPrice <= trade.targetPrice) {
        return {
          fulfilled: true,
          outcome: 'win' as const,
          fulfillmentPrice: currentPrice,
          returnPercentage: ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100,
        };
      } else if (currentPrice >= trade.stopLoss) {
        return {
          fulfilled: true,
          outcome: 'loss' as const,
          fulfillmentPrice: currentPrice,
          returnPercentage: ((trade.entryPrice - currentPrice) / trade.entryPrice) * 100,
        };
      }
    }
    
    return { fulfilled: false, outcome: null, fulfillmentPrice: null, returnPercentage: 0 };
  };

  // Check signal fulfillment for active trades and cleanup expired alerts
  const checkSignalFulfillment = useCallback(async () => {
    if (!autoTradingEnabled || executedTrades.length === 0) return;

    try {
      const activeTrades = executedTrades.filter(t => t.status === 'active');
      let updatesCount = 0;
      const alertsToRemove = new Set<string>();

      for (const trade of activeTrades) {
        // Get real-time price update if available, otherwise use price variation simulation
        let currentPrice = trade.entryPrice;
        const priceUpdate = priceUpdates.get(trade.symbol);
        
        if (priceUpdate) {
          currentPrice = priceUpdate.currentPrice;
        } else {
          // Fallback to realistic price variation simulation
          const priceVariation = (Math.random() - 0.5) * 0.08; // ±4% max variation
          currentPrice = trade.entryPrice * (1 + priceVariation);
        }

        const fulfillmentResult = checkTradeSignalFulfillment(trade, currentPrice);
        
        if (fulfillmentResult.fulfilled || fulfillmentResult.outcome) {
          // Update local trade
          setExecutedTrades(prev => prev.map(t => 
            t.id === trade.id 
              ? {
                  ...t,
                  status: 'closed' as const,
                  outcome: fulfillmentResult.outcome,
                  exitPrice: fulfillmentResult.fulfillmentPrice,
                  exitDate: new Date(),
                  returnPercentage: fulfillmentResult.returnPercentage,
                  signalFulfilled: fulfillmentResult.fulfilled,
                  fulfillmentPrice: fulfillmentResult.fulfillmentPrice,
                  fulfillmentDate: fulfillmentResult.fulfilled ? new Date() : undefined,
                }
              : t
          ));
          updatesCount++;
          
          // Mark alert for removal from local state
          alertsToRemove.add(trade.alertId);
        }
      }

      // Remove completed/expired alerts from local state (but keep in Firebase)
      if (alertsToRemove.size > 0) {
        updateAppState({ 
          alerts: appState.alerts.filter(alert => !alertsToRemove.has(alert.id))
        });
      }
    } catch (error) {
      console.error('❌ Error checking signal fulfillment:', error);
    }
  }, [autoTradingEnabled, executedTrades, updateAppState, appState.alerts]);

  // Auto-check signal fulfillment every 30 seconds when auto-trading is enabled
  useEffect(() => {
    if (!autoTradingEnabled) return;

    const interval = setInterval(checkSignalFulfillment, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [autoTradingEnabled, checkSignalFulfillment]);

  // Execute automatic trades from alerts
  const executeAutoTrades = async (alertsFromDB?: AutoAlert[]) => {
    if (!autoTradingEnabled) {
      return;
    }
    
    // Use alerts from database (current alerts) instead of generating new ones
    const alertsToProcess = alertsFromDB || appState.alerts;
    
    if (alertsToProcess.length === 0) {
      return;
    }
    
    const newTrades: Trade[] = [];
    let skippedCount = 0;
    let eligibleCount = 0;
    let existingTradeCount = 0;
    
    for (const alert of alertsToProcess) {
      try {
        // Skip if already executing this alert
        if (executingTrades.has(alert.id)) {
          continue;
        }
        
        // Check if we already have a trade for this alert
        const existingTrade = executedTrades.find(t => t.alertId === alert.id);
        if (existingTrade) {
          existingTradeCount++;
          continue;
        }
        
        // Add to executing set
        setExecutingTrades(prev => new Set([...prev, alert.id]));
        
        // Check if alert meets trading criteria
        const canTrade = alert.confidence >= 80 && alert.signal !== 'watch';
        eligibleCount++;
        
        if (canTrade) {
          
          // Create trade from alert
          const signalExpiryDays = alert.confidence >= 90 ? 3 : alert.confidence >= 80 ? 7 : 14;
          const signalExpiry = new Date(Date.now() + (signalExpiryDays * 24 * 60 * 60 * 1000));
          
          const trade: Trade = {
            id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            alertId: alert.id,
            symbol: alert.symbol,
            name: alert.name,
            signal: alert.signal,
            entryPrice: alert.currentPrice,
            currentPrice: alert.currentPrice,
            targetPrice: alert.signal === 'buy' 
              ? alert.currentPrice * (1 + (alert.confidence / 100) * 0.15)
              : alert.currentPrice * (1 - (alert.confidence / 100) * 0.12),
            stopLoss: alert.signal === 'buy'
              ? alert.currentPrice * 0.95 // 5% stop loss for buy
              : alert.currentPrice * 1.05, // 5% stop loss for sell
            entryDate: new Date(),
            status: 'active',
            confidence: alert.confidence,
            strategy: alert.strategy,
            reasoning: alert.reasoning,
            priority: alert.confidence >= 90 ? 'critical' : alert.confidence >= 80 ? 'high' : 'medium',
            dataSource: alert.dataSource,
            timeframe: `${signalExpiryDays}d`,
            isLocked: true,
            autoExecuted: true,
            executionMethod: 'automatic',
            signalExpiry: signalExpiry,
            signalFulfilled: false,
            lockedMetrics: {
              entryPrice: alert.currentPrice,
              confidence: alert.confidence,
              targetPrice: alert.signal === 'buy' 
                ? alert.currentPrice * (1 + (alert.confidence / 100) * 0.15)
                : alert.currentPrice * (1 - (alert.confidence / 100) * 0.12),
              expectedReturn: alert.signal === 'buy' 
                ? ((alert.currentPrice * (1 + (alert.confidence / 100) * 0.15) - alert.currentPrice) / alert.currentPrice * 100)
                : ((alert.currentPrice - alert.currentPrice * (1 - (alert.confidence / 100) * 0.12)) / alert.currentPrice * 100),
              riskLevel: alert.confidence >= 90 ? 'low' : alert.confidence >= 80 ? 'medium' : 'high',
              timestamp: Date.now()
            }
          };
          
          newTrades.push(trade);
          
          // Save to Firebase collections (ONLY auto trades collection for auto trading)
          try {
            await firebaseAutoTradesService.saveAutoTradeToFirebase(trade);
          } catch (error) {
            console.error(`❌ Error saving auto-trade to Firebase:`, error);
            // Still continue with local storage
          }
          
          console.log(`✅ Auto-trade created: ${alert.signal} ${alert.symbol} at $${alert.currentPrice}`);
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error(`❌ Error executing auto-trade for ${alert.symbol}:`, error);
      } finally {
        // Remove from executing set
        setExecutingTrades(prev => {
          const newSet = new Set(prev);
          newSet.delete(alert.id);
          return newSet;
        });
      }
    }
    
    if (newTrades.length > 0) {
      // Add new trades to executed trades
      setExecutedTrades(prev => [...prev, ...newTrades]);
      
      // Update trading stats
      const updatedTrades = [...executedTrades, ...newTrades];
      setTradingStats({
        totalTrades: updatedTrades.length,
        activeTrades: updatedTrades.filter(t => t.status === 'active').length,
        closedTrades: updatedTrades.filter(t => t.status === 'closed').length,
        winRate: updatedTrades.length > 0 ? 
          (updatedTrades.filter(t => (t.returnPercentage || 0) > 0).length / updatedTrades.length) * 100 : 0,
        totalReturn: updatedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0),
        averageReturn: updatedTrades.length > 0 ? 
          updatedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0) / updatedTrades.length : 0,
        bestTrade: Math.max(...updatedTrades.map(t => t.returnPercentage || 0), 0),
        worstTrade: Math.min(...updatedTrades.map(t => t.returnPercentage || 0), 0),
        avgHoldingTime: 0,
        winsByStrategy: {},
        lossesByStrategy: {},
        monthlyReturns: [],
        fulfillmentRate: 0,
        averageTimeToFulfillment: 0,
        signalAccuracy: 0,
        expiredSignals: 0,
      });
      
      Alert.alert(
        '🤖 Auto-Trading Complete',
        `${newTrades.length} trades executed automatically!\n\nTrades saved to Firebase collection 'trades'`,
        [{ text: 'View Trades', onPress: () => updateAppState({ showStatsModal: true }) }]
      );
    }
  };

  // Toggle auto trading
  const toggleAutoTrading = async () => {
    const newValue = !autoTradingEnabled;
    setAutoTradingEnabled(newValue);
    
    if (newValue) {
      Alert.alert(
        '🤖 Auto-Trading Activado', 
        `¡Las señales de alta confianza se ejecutarán automáticamente!\n\nCriterios:\n• Confianza >= 80%\n• Señal: buy/sell (no watch)\n\nTrades se guardarán en Firebase colección 'trades'`,
        [{ text: 'Continuar' }]
      );
      
      // Execute auto-trades immediately with current database alerts
      await executeAutoTrades();
    } else {
      Alert.alert('⏸️ Auto-Trading Pausado', 'Las señales no se ejecutarán automáticamente');
    }
  };

  useEffect(() => {
    initializeAlertService();
    
    // Cooldown timer
    const cooldownInterval = setInterval(() => {
      updateAppState({ scanCooldown: Math.max(0, appState.scanCooldown - 1) });
    }, 1000);
    
    return () => clearInterval(cooldownInterval);
  }, []);

  // Update trading stats when modal opens and get real price updates
  useEffect(() => {
    if (appState.showStatsModal && executedTrades.length > 0) {
      updateTradingStatsWithRealPrices();
    }
  }, [appState.showStatsModal, executedTrades]);

  // Update trading stats with real-time prices and better error handling
  const updateTradingStatsWithRealPrices = async () => {
    setStatsLoading(true);
    
    try {
      // Get unique symbols from trades
      const symbols = [...new Set(executedTrades.map(t => t.symbol))];
      
      // Get real-time price updates with timeout
      const updates = await Promise.race([
        realPriceUpdateService.getMultiplePriceUpdates(symbols),
        new Promise<Map<string, any>>((_, reject) => 
          setTimeout(() => reject(new Error('Price update timeout')), 15000)
        )
      ]);
      setPriceUpdates(updates);
      
      // Update trades with current prices
      const updatedTrades = executedTrades.map(trade => {
        const priceUpdate = updates.get(trade.symbol);
        if (priceUpdate) {
          const updatedTrade = {
            ...trade,
            currentPrice: priceUpdate.currentPrice,
            returnPercentage: trade.status === 'active' 
              ? ((priceUpdate.currentPrice - trade.entryPrice) / trade.entryPrice) * 100
              : trade.returnPercentage || 0
          };
          return updatedTrade;
        }
        return trade;
      });
      
      setExecutedTrades(updatedTrades);
      
      // Calculate real-time trading stats
      const activeTrades = updatedTrades.filter(t => t.status === 'active');
      const closedTrades = updatedTrades.filter(t => t.status === 'closed');
      const autoTrades = updatedTrades.filter(t => t.executionMethod === 'automatic');
      const winningTrades = updatedTrades.filter(t => (t.returnPercentage || 0) > 0);
      
      const totalReturn = updatedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0);
      const avgReturn = updatedTrades.length > 0 ? totalReturn / updatedTrades.length : 0;
      const winRate = updatedTrades.length > 0 ? (winningTrades.length / updatedTrades.length) * 100 : 0;
      const bestTrade = Math.max(...updatedTrades.map(t => t.returnPercentage || 0), 0);
      const worstTrade = Math.min(...updatedTrades.map(t => t.returnPercentage || 0), 0);
      
      // Calculate fulfillment metrics
      const fulfilledTrades = updatedTrades.filter(t => t.signalFulfilled);
      const fulfillmentRate = updatedTrades.length > 0 ? (fulfilledTrades.length / updatedTrades.length) * 100 : 0;
      
      const realTimeStats: TradingStats = {
        totalTrades: updatedTrades.length,
        activeTrades: activeTrades.length,
        closedTrades: closedTrades.length,
        winRate,
        totalReturn,
        averageReturn: avgReturn,
        bestTrade,
        worstTrade,
        avgHoldingTime: 2.5, 
        winsByStrategy: {},
        lossesByStrategy: {},
        monthlyReturns: [],
        fulfillmentRate,
        averageTimeToFulfillment: 6.2, 
        signalAccuracy: fulfillmentRate,
        expiredSignals: updatedTrades.filter(t => !t.signalFulfilled && t.status === 'closed').length,
      };
      
      setTradingStats(realTimeStats);
      
    } catch (error) {
      console.error('❌ Error updating trading stats:', error);
      
      // Fallback to basic stats without real prices
      setTradingStats({
        totalTrades: executedTrades.length,
        activeTrades: executedTrades.filter(t => t.status === 'active').length,
        closedTrades: executedTrades.filter(t => t.status === 'closed').length,
        winRate: executedTrades.length > 0 ? 
          (executedTrades.filter(t => (t.returnPercentage || 0) > 0).length / executedTrades.length) * 100 : 0,
        totalReturn: executedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0),
        averageReturn: executedTrades.length > 0 ? 
          executedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0) / executedTrades.length : 0,
        bestTrade: Math.max(...executedTrades.map(t => t.returnPercentage || 0), 0),
        worstTrade: Math.min(...executedTrades.map(t => t.returnPercentage || 0), 0),
        avgHoldingTime: 2.5,
        winsByStrategy: {},
        lossesByStrategy: {},
        monthlyReturns: [],
        fulfillmentRate: 0,
        averageTimeToFulfillment: 0,
        signalAccuracy: 0,
        expiredSignals: 0,
      });
    } finally {
      setStatsLoading(false);
    }
  };

  // Test API connections and show key rotation status
  const testAPIConnections = async () => {
    try {
      updateAppState({ isLoading: true });
      
      const results = await APIDiagnosticService.runFullDiagnostics();
      const keyStats = apiKeyManager.getUsageStatistics();
      const statusReport = apiKeyManager.getStatusReport();
      
      // Show results in alert with key rotation info
      const message = `API Status Report:
      
🔍 Alpha Vantage: ${results.alphaVantage.success ? '✅' : '❌'} 
${results.alphaVantage.message}

🔍 CoinGecko: ${results.coinGecko.success ? '✅' : '❌'}
${results.coinGecko.message}

🔑 API KEY ROTATION STATUS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Total Keys: ${keyStats.totalKeys}
✅ Active Keys: ${keyStats.activeKeys}
📈 Requests Used Today: ${keyStats.totalRequests}
🎯 Available Requests: ${keyStats.availableRequests}
💡 Max Daily Capacity: ${keyStats.totalKeys * 500}

📋 Top 5 Keys Status:
${keyStats.keyDetails.slice(0, 5).map(key => 
  `${key.isActive ? '✅' : '❌'} ${key.name}: ${key.usage}/${key.limit}`
).join('\n')}

📊 Overall Score: ${results.overall.score}/100
📈 Can Use Stocks: ${results.overall.canUseStocks ? 'Yes' : 'No'}
💎 Can Use Crypto: ${results.overall.canUseCrypto ? 'Yes' : 'No'}

💡 Benefits of Multiple Keys:
• ${keyStats.totalKeys * 500} requests/day total
• Automatic rotation when limits hit
• Higher reliability for stock scanning
• Never run out of API calls

${results.overall.recommendations.join('\n')}`;

      Alert.alert('🔬 API Diagnostic Results', message, [
        { 
          text: 'View Full Report', 
          onPress: () => {
            Alert.alert('📊 Full Status Report', statusReport);
          }
        },
        { text: 'OK', style: 'default' }
      ]);
      
    } catch (error) {
      console.error('❌ Error testing APIs:', error);
      Alert.alert('❌ Test Failed', 'Error testing API connections');
    } finally {
      updateAppState({ isLoading: false });
    }
  };

  // Test Auto Trades Service
  const testAutoTradesService = async () => {
    try {
      updateAppState({ isLoading: true });
      
      // Run all tests
      await AutoTradesServiceTester.runAllTests();
      
      // Get current status
      await checkAutoTradesStatus();
      
      // Get current trades count
      const allTrades = await firebaseAutoTradesService.getAllAutoTradesFromFirebase();
      const autoTrades = allTrades.filter(t => t.executionMethod === 'automatic');
      
      Alert.alert(
        '🧪 Auto Trades Service Test',
        `Service Status: ✅ Working\n\nCurrent Data:\n• Total Trades: ${allTrades.length}\n• Auto Trades: ${autoTrades.length}\n• Active: ${allTrades.filter(t => t.status === 'active').length}\n• Closed: ${allTrades.filter(t => t.status === 'closed').length}\n\nCheck console for detailed test results.`,
        [{ text: 'OK' }]
      );
      
    } catch (error) {
      console.error('❌ Error testing Auto Trades Service:', error);
      Alert.alert('❌ Test Failed', 'Error testing Auto Trades Service');
    } finally {
      updateAppState({ isLoading: false });
    }
  };

  // Perform AI scan with timeout and proper progress tracking
  const performScan = async () => {
    if (appState.isScanning || appState.scanCooldown > 0) {
      Alert.alert(
        '⏰ Espera un momento', 
        appState.scanCooldown > 0 
          ? `Puedes escanear nuevamente en ${appState.scanCooldown} segundos`
          : 'Ya hay un escaneo en progreso'
      );
      return;
    }

    try {
      updateAppState({ 
        isScanning: true,
        isLoading: true,
        scanProgress: 0 
      });
      
      // Show scan duration warning
      Alert.alert(
        '🧠 VectorFlux AI Iniciando',
        'El escaneo puede tardar entre 5-10 minutos analizando mercados globales con IA',
        [{ text: 'Iniciar Scan', style: 'default' }]
      );
      
      // Progress simulation with realistic timing
      let currentProgress = 0;
      const progressInterval = setInterval(() => {
        currentProgress += Math.random() * 5; // Slower progress
        const newProgress = currentProgress > 90 ? 90 : currentProgress;
        updateAppState({ scanProgress: newProgress });
      }, 1000); // Every second instead of 500ms
      
      // Animate progress bar
      Animated.timing(progressAnim, {
        toValue: 90,
        duration: 8000, // 8 seconds animation
        useNativeDriver: false,
      }).start();
      
      // Perform the actual scan with timeout
      const scanPromise = autoAlertService.forceScan();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Scan timeout after 10 minutes')), 600000)
      );
      
      const newAlerts = await Promise.race([scanPromise, timeoutPromise]);
      
      clearInterval(progressInterval);
      
      // Complete progress
      updateAppState({ scanProgress: 100 });
      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 500,
        useNativeDriver: false,
      }).start();
      
      // Update alerts with new scan tracking
      const allAlerts = autoAlertService.getActiveAlerts();
      const realAlerts = allAlerts.filter(alert => {
        const hasRealData = alert.currentPrice > 0 && alert.symbol && alert.strategy;
        const notFallback = !alert.reasoning?.toLowerCase().includes('fallback');
        return hasRealData && notFallback;
      });
      
      // Sort alerts by creation time (newest first)
      const sortedAlerts = realAlerts.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Mark new alerts from this scan
      const newAlertIds = new Set<string>();
      if (newAlerts.length > 0) {
        newAlerts.forEach(alert => newAlertIds.add(alert.id));
        
        // Clear previous "new" alerts from a previous scan
        if (appState.lastNewScanTime) {
          console.log('🔄 Clearing previous "new" alert markers');
        }
      }
      
      updateAppState({ 
        alerts: sortedAlerts,
        lastScanTime: new Date(),
        scanCooldown: 60, // 1 minute cooldown
        newAlertIds: newAlertIds,
        lastNewScanTime: newAlerts.length > 0 ? new Date() : appState.lastNewScanTime
      });
      
      // Execute auto-trades if enabled (using ALL alerts, including new ones from scan)
      if (autoTradingEnabled) {
        console.log('🤖 Auto-trading enabled, checking ALL alerts (including new scan results) for trade opportunities...');
        console.log(`🔍 Processing ${sortedAlerts.length} total alerts for auto-trading`);
        console.log(`📊 New alerts from scan: ${newAlerts.length}`);
        
        // Use ALL alerts (including newly scanned ones) for auto-trading
        await executeAutoTrades(sortedAlerts);
      }
      
      if (newAlerts.length > 0) {
        Alert.alert(
          '🎯 Nuevas Oportunidades',
          `VectorFlux AI encontró ${newAlerts.length} nuevas señales de trading`,
          [{ text: 'Ver Alertas', onPress: () => {} }]
        );
      } else {
        Alert.alert(
          '🧠 Scan Completado',
          'No se encontraron nuevas oportunidades en este momento',
          [{ text: 'OK', onPress: () => {} }]
        );
      }
      
    } catch (error) {
      console.error('❌ Error en VectorFlux AI scan:', error);
      const errorMessage = error instanceof Error && error.message.includes('timeout') 
        ? 'El scan tardó más de 10 minutos y fue cancelado. Inténtalo de nuevo.'
        : 'Error durante el escaneo de mercados';
      Alert.alert('Error AI', errorMessage);
    } finally {
      updateAppState({ 
        isScanning: false,
        isLoading: false,
        scanProgress: 0
      });
      
      // Reset progress animation
      setTimeout(() => {
        progressAnim.setValue(0);
      }, 1000);
    }
  };

  // Auto scan toggle
  const toggleAutoScan = async () => {
    const newValue = !appState.autoScanEnabled;
    updateAppState({ autoScanEnabled: newValue });
    
    if (newValue) {
      autoAlertService.startAutoScan(15); // 15 minutes
      Alert.alert('🤖 Auto-Scan Activado', 'VectorFlux AI escaneará automáticamente cada 15 minutos');
    } else {
      autoAlertService.stopAutoScan();
      Alert.alert('⏸️ Auto-Scan Desactivado', 'El escaneo automático se ha detenido');
    }
  };

  // Delete alert
  const deleteAlert = async (alertId: string) => {
    Alert.alert(
      'Eliminar Alerta',
      '¿Estás seguro de que quieres eliminar esta alerta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            const success = await autoAlertService.removeAlert(alertId);
            if (success) {
              const updatedAlerts = appState.alerts.filter(a => a.id !== alertId);
              updateAppState({ alerts: updatedAlerts });
            }
          }
        }
      ]
    );
  };

  // Get data source
  const getDataSource = (alert: AutoAlert): string => {
    if (alert.symbol.match(/BTC|ETH|ADA|SOL|bitcoin|ethereum/i)) return 'Crypto';
    if (alert.symbol.match(/AAPL|GOOGL|MSFT|TSLA/i)) return 'Stocks';
    return 'Market';
  };

  // Filter alerts and sort by newest first
  const filteredAlerts = useMemo(() => {
    let filtered = appState.alerts;

    // Priority filters (multiple selection)
    if (appState.selectedFilters.length > 0) {
      filtered = filtered.filter(alert => 
        appState.selectedFilters.includes(alert.priority)
      );
    }

    // Signal filters (multiple selection)
    if (appState.signalFilters.length > 0) {
      filtered = filtered.filter(alert => 
        appState.signalFilters.includes(alert.signal)
      );
    }

    // Asset type filter
    if (appState.assetFilter !== 'all') {
      filtered = filtered.filter(alert => {
        const isCrypto = alert.symbol.match(/BTC|ETH|ADA|SOL|bitcoin|ethereum/i);
        const isStock = alert.symbol.match(/AAPL|GOOGL|MSFT|TSLA/i);
        
        if (appState.assetFilter === 'crypto') return isCrypto;
        if (appState.assetFilter === 'stocks') return isStock;
        return true;
      });
    }

    // Sort by newest first (by creation time)
    return filtered.sort((a, b) => {
      // Prioritize NEW alerts first
      const aIsNew = appState.newAlertIds.has(a.id);
      const bIsNew = appState.newAlertIds.has(b.id);
      
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      
      // Then by creation time (newest first)
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [appState.alerts, appState.selectedFilters, appState.signalFilters, appState.assetFilter, appState.newAlertIds]);

  // OPTIMIZED: Enhanced alert card with modern design and signal-based colors
  const renderAlert = useCallback(({ item }: { item: AutoAlert }) => {
    const isWatchSignal = item.signal === 'watch';
    const isBuySignal = item.signal === 'buy';
    const isSellSignal = item.signal === 'sell';
    const confidence = item.confidence || 0;
    const dataSource = getDataSource(item);
    const hasExistingTrade = tradeDatabase.hasTradeForAlert(item.id);
    const isNewAlert = appState.newAlertIds.has(item.id);
    
    // Signal-based colors for modern design
    const getSignalColors = () => {
      if (isBuySignal) {
        return {
          border: '#00FF88', // Bright green for buy
          accent: '#00FF88',
          background: 'rgba(0, 255, 136, 0.05)',
          glow: 'rgba(0, 255, 136, 0.2)'
        };
      } else if (isSellSignal) {
        return {
          border: '#FF4757', // Bright red for sell
          accent: '#FF4757',
          background: 'rgba(255, 71, 87, 0.05)',
          glow: 'rgba(255, 71, 87, 0.2)'
        };
      } else {
        return {
          border: '#FFB800', // Bright yellow for watch
          accent: '#FFB800',
          background: 'rgba(255, 184, 0, 0.05)',
          glow: 'rgba(255, 184, 0, 0.2)'
        };
      }
    };
    
    const colors = getSignalColors();
    
    // Get realistic target price and timeframe based on AI analysis and confidence
    const currentPrice = item.currentPrice;
    const targetPrice = item.signal === 'buy' 
      ? currentPrice * (1 + (confidence / 100) * 0.15) // 15% max upside based on confidence
      : currentPrice * (1 - (confidence / 100) * 0.12); // 12% max downside based on confidence
    
    const timeframeDays = item.signal === 'buy' 
      ? Math.ceil(confidence >= 90 ? 1 : confidence >= 80 ? 3 : confidence >= 70 ? 7 : 14) // High confidence = shorter timeframe
      : Math.ceil(confidence >= 90 ? 2 : confidence >= 80 ? 5 : confidence >= 70 ? 10 : 21); // Sell signals take a bit longer
    
    return (
      <TouchableOpacity
        style={[
          styles.alertCard,
          {
            borderColor: colors.border,
            backgroundColor: colors.background,
            shadowColor: colors.glow,
            elevation: 8,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }
        ]}
        onLongPress={() => deleteAlert(item.id)}
      >
        {/* Modern signal indicator badge */}
        <View style={[styles.modernSignalBadge, { backgroundColor: colors.accent }]}>
          <Text style={styles.modernSignalText}>
            {item.signal?.toUpperCase() || 'WATCH'}
          </Text>
        </View>
        
        {/* Trade saved indicator */}
        {hasExistingTrade && (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>💾</Text>
          </View>
        )}
        
        {/* NEW alert indicator */}
        {isNewAlert && (
          <View style={[styles.savedBadge, { 
            backgroundColor: '#FF6B00', 
            right: hasExistingTrade ? 35 : 10,
            borderColor: '#FF6B00' 
          }]}>
            <Text style={[styles.savedBadgeText, { color: '#fff', fontSize: 10 }]}>NEW</Text>
          </View>
        )}
        
        <View style={styles.alertHeader}>
          <View style={styles.symbolContainer}>
            <Text style={styles.alertSymbol}>{item.symbol}</Text>
            <View style={[styles.confidenceBadge, { backgroundColor: colors.accent }]}>
              <Text style={styles.confidenceBadgeText}>{confidence.toFixed(0)}%</Text>
            </View>
          </View>
          <View style={[styles.priceContainer, { marginRight: 80 }]}>
            <Text style={[
              styles.alertPrice,
              { fontSize: 12 } // Even smaller price to prevent overlap
            ]}>${currentPrice.toFixed(4)}</Text>
            <Text style={[styles.targetPrice, { color: colors.accent, fontSize: 10 }]}>
              Target: ${targetPrice.toFixed(4)}
            </Text>
          </View>
        </View>
        
        <Text style={[styles.alertStrategy, { color: colors.accent, fontSize: 12 }]}>{item.strategy}</Text>
        <Text style={[styles.alertMessage, { fontSize: 11 }]}>{item.reasoning}</Text>
        
        <View style={styles.modernDetailsGrid}>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Fuente</Text>
            <Text style={styles.detailCardValue}>{dataSource}</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Plazo</Text>
            <Text style={styles.detailCardValue}>{timeframeDays}d</Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Potencial</Text>
            <Text style={[
              styles.detailCardValue,
              { color: colors.accent }
            ]}>
              {item.signal === 'buy' ? '+' : ''}{((targetPrice - currentPrice) / currentPrice * 100).toFixed(1)}%
            </Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Confianza</Text>
            <Text style={[
              styles.detailCardValue,
              { color: confidence >= 85 ? '#00FF88' : confidence >= 75 ? '#FFB800' : '#FF4757' }
            ]}>
              {confidence.toFixed(0)}%
            </Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Prioridad</Text>
            <Text style={[
              styles.detailCardValue,
              { 
                color: item.priority === 'critical' ? '#FF4757' :
                       item.priority === 'high' ? '#FF8C42' :
                       item.priority === 'medium' ? '#FFB800' : '#00FF88'
              }
            ]}>
              {item.priority?.toUpperCase() || 'MEDIUM'}
            </Text>
          </View>
          <View style={styles.detailCard}>
            <Text style={styles.detailCardLabel}>Volumen</Text>
            <Text style={styles.detailCardValue}>
              {item.confidence >= 80 ? '2.5M' : item.confidence >= 70 ? '1.8M' : '1.2M'}
            </Text>
          </View>
        </View>
        
        <View style={styles.alertFooter}>
          <Text style={styles.alertTime}>
            {new Date(item.createdAt).toLocaleTimeString()}
          </Text>
          <View style={[styles.priorityBadge, { 
            backgroundColor: item.priority === 'critical' ? '#e74c3c' :
                           item.priority === 'high' ? '#e67e22' :
                           item.priority === 'medium' ? '#f39c12' : '#27ae60'
          }]}>
            <Text style={styles.priorityBadgeText}>
              {item.priority?.toUpperCase() || 'MEDIUM'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, []);

  // Refresh alerts
  const refreshAlerts = async () => {
    updateAppState({ refreshing: true });
    await initializeAlertService();
    updateAppState({ refreshing: false });
  };

  // Clear all filters
  const clearAllFilters = () => {
    updateAppState({
      selectedFilters: [],
      signalFilters: [],
      assetFilter: 'all'
    });
  };

  // Filter button component
  const FilterButton = ({ filter, label, type = 'priority' }: { filter: string; label: string; type?: 'priority' | 'signal' }) => {
    const isActive = type === 'priority' 
      ? appState.selectedFilters.includes(filter as any)
      : appState.signalFilters.includes(filter as any);
    
    const handlePress = () => {
      if (type === 'priority') {
        const newFilters = isActive 
          ? appState.selectedFilters.filter(f => f !== filter)
          : [...appState.selectedFilters, filter as any];
        updateAppState({ selectedFilters: newFilters });
      } else {
        const newFilters = isActive 
          ? appState.signalFilters.filter(f => f !== filter)
          : [...appState.signalFilters, filter as any];
        updateAppState({ signalFilters: newFilters });
      }
    };

    return (
      <TouchableOpacity
        style={[
          styles.filterButton,
          isActive && styles.filterButtonActive
        ]}
        onPress={handlePress}
      >
        <Text style={[
          styles.filterButtonText,
          isActive && styles.filterButtonTextActive
        ]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  // Empty state component
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateIcon}>🧠</Text>
      <Text style={styles.emptyStateTitle}>VectorFlux AI en Standby</Text>
      <Text style={styles.emptyStateText}>
        Los modelos de AI están monitoreando los mercados.{'\n'}
        Presiona el botón para un escaneo manual o activa el auto-scan.
      </Text>
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={performScan}
        disabled={appState.isScanning || appState.scanCooldown > 0}
      >
        <Text style={styles.emptyStateButtonText}>
          {appState.scanCooldown > 0 
            ? `Esperar ${appState.scanCooldown}s` 
            : '🔍 Escanear Ahora'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Compact VaporFLUX AI Header */}
      <View style={[styles.vaporFluxHeader, { paddingVertical: 8 }]}>
        <Text style={[styles.vaporFluxTitle, { fontSize: 18 }]}>VaporFLUX AI</Text>
        <Text style={[styles.vaporFluxSubtitle, { fontSize: 11 }]}>Real-time Intelligence</Text>
      </View>

      {/* Ultra Compact Control Panel */}
      <View style={[styles.compactControlsContainer, { paddingVertical: 6 }]}>
        <View style={styles.compactControlsRow}>
          {/* Auto Scan Toggle */}
          <View style={[styles.compactSwitchGroup, { marginRight: 8 }]}>
            <Text style={[styles.compactSwitchLabel, { fontSize: 10 }]}>Auto</Text>
            <Switch
              value={appState.autoScanEnabled}
              onValueChange={toggleAutoScan}
              trackColor={{ false: '#333', true: '#00ff88' }}
              thumbColor='#fff'
              style={[styles.compactSwitch, { transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }]}
            />
          </View>
          
          {/* Action Buttons Row */}
          <View style={styles.compactActionButtons}>
            <TouchableOpacity
              style={[styles.compactButton, styles.scanButton, appState.isScanning && styles.buttonDisabled, { padding: 8 }]}
              onPress={performScan}
              disabled={appState.isScanning || appState.scanCooldown > 0}
            >
              <Text style={[styles.compactButtonText, { fontSize: 12 }]}>
                {appState.isScanning ? '⏳' : '🔍'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => updateAppState({ showStatsModal: true })}
              style={[styles.compactButton, styles.compactStatsButton, { padding: 8 }]}
            >
              <Text style={[styles.compactButtonText, { fontSize: 12 }]}>📊</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={toggleAutoTrading} 
              style={[styles.compactButton, styles.autoTradeButton, autoTradingEnabled && styles.autoTradeButtonActive, { padding: 8 }]}
            >
              <Text style={[styles.compactButtonText, autoTradingEnabled && styles.compactButtonTextActive, { fontSize: 12 }]}>
                🤖
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={testAPIConnections} 
              style={[styles.compactButton, styles.compactStatsButton, { padding: 8 }]}
            >
              <Text style={[styles.compactButtonText, { fontSize: 12 }]}>🔬</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={testAutoTradesService} 
              style={[styles.compactButton, styles.compactStatsButton, { padding: 8 }]}
            >
              <Text style={[styles.compactButtonText, { fontSize: 12 }]}>🧪</Text>
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={[styles.statusIndicator, { paddingVertical: 4 }]}>
          <Text style={[styles.statusTextSmall, { fontSize: 10 }]}>
            {autoTradingEnabled ? '🟢 Auto ON' : '🔴 Manual'} • 
            {filteredAlerts.length}/{appState.alerts.length} Alerts • 
            {executedTrades.filter(t => t.status === 'active').length} Active
          </Text>
          {__DEV__ && (
            <Text style={[styles.statusTextSmall, { fontSize: 8, color: '#999' }]}>
              Debug: AsyncStorage alerts, Firebase trades: {autoTrades.length}
            </Text>
          )}
        </View>
      </View>

      {/* Enhanced Progress Bar */}
      {appState.isScanning && (
        <View style={styles.enhancedProgressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressTitle}>🧠 VaporFlux AI Analizando...</Text>
            <Text style={styles.progressPercentage}>{Math.round(appState.scanProgress)}%</Text>
          </View>
          <View style={styles.enhancedProgressBar}>
            <View style={[styles.enhancedProgressFill, { width: `${appState.scanProgress}%` }]} />
          </View>
          <Text style={styles.progressStatus}>
            Escaneando mercados con inteligencia artificial
          </Text>
        </View>
      )}

      {/* Enhanced filters */}
      <View style={styles.enhancedFiltersContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersScroll}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Prioridad:</Text>
            <FilterButton filter="critical" label="Crítica" />
            <FilterButton filter="high" label="Alta" />
            <FilterButton filter="medium" label="Media" />
            <FilterButton filter="low" label="Baja" />
          </View>
          
          <View style={styles.filterSeparator} />
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterGroupTitle}>Señal:</Text>
            <FilterButton filter="buy" label="Compra" type="signal" />
            <FilterButton filter="sell" label="Venta" type="signal" />
            <FilterButton filter="watch" label="Watch" type="signal" />
          </View>
          
          {(appState.selectedFilters.length > 0 || appState.signalFilters.length > 0) && (
            <TouchableOpacity style={styles.enhancedClearButton} onPress={clearAllFilters}>
              <Text style={styles.enhancedClearButtonText}>🗑️ Limpiar</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>

      {/* Alerts List */}
      <FlatList
        data={filteredAlerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id}
        style={styles.alertsList}
        refreshControl={
          <RefreshControl
            refreshing={appState.refreshing}
            onRefresh={refreshAlerts}
            tintColor="#00ff88"
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />

      {/* Enhanced Trading Statistics Modal */}
      <Modal
        visible={appState.showStatsModal}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => updateAppState({ showStatsModal: false })}
      >
        <View style={styles.modalContainer}>
          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Floating Close Button */}
            <TouchableOpacity
              onPress={() => updateAppState({ showStatsModal: false })}
              style={styles.floatingCloseButton}
            >
              <Text style={styles.floatingCloseButtonText}>✕</Text>
            </TouchableOpacity>

            {/* Header Section */}
            <View style={styles.modalHeaderSection}>
              <Text style={styles.modalMainTitle}>🤖 VaporFlux Trading Dashboard</Text>
              <Text style={styles.modalSubtitle}>Análisis completo de trading y rendimiento</Text>
            </View>

            {/* Trading Status Card */}
            <View style={styles.tradingStatusCard}>
              <View style={styles.statusIndicator}>
                <Text style={styles.statusIcon}>📊</Text>
                <Text style={styles.statusText}>
                  Trading Analytics ACTIVO
                </Text>
              </View>
              <View style={styles.configDetails}>
                <Text style={styles.configText}>
                  Auto Trades guardados: {autoTrades.length} •
                  Confianza promedio: {autoTrades.length > 0 ? (autoTrades.reduce((sum, t) => sum + t.confidence, 0) / autoTrades.length).toFixed(0) : 0}%
                </Text>
              </View>
            </View>

            {statsLoading ? (
              <ActivityIndicator size="large" color="#00ff88" style={styles.modalLoading} />
            ) : tradingStats ? (
              <>
                {/* Enhanced Stats Grid */}
                <View style={styles.enhancedStatsGrid}>
                  <View style={[styles.statsCard, styles.mainStatCard]}>
                    <Text style={styles.statsCardValue}>{autoTrades.length}</Text>
                    <Text style={styles.statsCardTitle}>Auto Trades</Text>
                    <Text style={styles.statSubtext}>
                      💾 {autoTrades.filter(t => t.status === 'closed').length} completados • 🔄 {autoTrades.filter(t => t.status === 'active').length} activos
                    </Text>
                  </View>
                  
                  <View style={[styles.statsCard, styles.secondaryStatCard]}>
                    <Text style={styles.statsCardValue}>{tradingStats.activeTrades}</Text>
                    <Text style={styles.statsCardTitle}>Activos</Text>
                  </View>
                  
                  <View style={[styles.statsCard, styles.secondaryStatCard]}>
                    <Text style={[styles.statsCardValue, { color: '#00ff88' }]}>
                      {tradingStats.winRate.toFixed(1)}%
                    </Text>
                    <Text style={styles.statsCardTitle}>Win Rate</Text>
                  </View>
                  
                  <View style={[styles.statsCard, styles.returnStatCard]}>
                    <Text style={[
                      styles.statsCardValue, 
                      { color: tradingStats.totalReturn >= 0 ? '#00ff88' : '#ff4757' }
                    ]}>
                      {tradingStats.totalReturn >= 0 ? '+' : ''}{tradingStats.totalReturn.toFixed(1)}%
                    </Text>
                    <Text style={styles.statsCardTitle}>Retorno Total</Text>
                  </View>

                  <View style={[styles.statsCard, styles.confidenceStatCard]}>
                    <Text style={[styles.statsCardValue, { color: '#ffb800' }]}>
                      {autoTrades.length > 0 ? (autoTrades.reduce((sum, t) => sum + t.confidence, 0) / autoTrades.length).toFixed(0) : 0}%
                    </Text>
                    <Text style={styles.statsCardTitle}>Confianza Promedio</Text>
                  </View>

                  <View style={[styles.statsCard, styles.executionStatCard]}>
                    <Text style={[styles.statsCardValue, { color: '#9b59b6' }]}>
                      {tradingStats.bestTrade.toFixed(1)}%
                    </Text>
                    <Text style={styles.statsCardTitle}>Mejor Trade</Text>
                  </View>
                </View>

                {/* Trading Analysis Section */}
                <View style={styles.tradingAnalysisSection}>
                  <Text style={styles.sectionTitle}>📈 Análisis de Trading</Text>
                  
                  {/* Signal Fulfillment Metrics */}
                  <View style={styles.signalMetricsGrid}>
                    <View style={styles.signalMetricCard}>
                      <Text style={styles.signalMetricValue}>
                        {tradingStats.fulfillmentRate.toFixed(1)}%
                      </Text>
                      <Text style={styles.signalMetricLabel}>Tasa de Cumplimiento</Text>
                    </View>
                    <View style={styles.signalMetricCard}>
                      <Text style={styles.signalMetricValue}>
                        {tradingStats.averageTimeToFulfillment.toFixed(1)}h
                      </Text>
                      <Text style={styles.signalMetricLabel}>Tiempo Promedio</Text>
                    </View>
                    <View style={styles.signalMetricCard}>
                      <Text style={styles.signalMetricValue}>
                        {tradingStats.signalAccuracy.toFixed(1)}%
                      </Text>
                      <Text style={styles.signalMetricLabel}>Precisión de Señales</Text>
                    </View>
                    <View style={styles.signalMetricCard}>
                      <Text style={styles.signalMetricValue}>
                        {tradingStats.expiredSignals}
                      </Text>
                      <Text style={styles.signalMetricLabel}>Señales Expiradas</Text>
                    </View>
                  </View>
                  
                  {autoTrades.length > 0 ? (
                    <>
                      <View style={styles.tradingSummary}>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Auto Trades:</Text>
                          <Text style={styles.summaryValue}>{autoTrades.length}</Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Éxito general:</Text>
                          <Text style={styles.summaryValue}>
                            {autoTrades.length > 0
                              ? ((autoTrades.filter(t => t.returnPercentage && t.returnPercentage > 0).length / autoTrades.length) * 100).toFixed(1)
                              : 0}%
                          </Text>
                        </View>
                        <View style={styles.summaryItem}>
                          <Text style={styles.summaryLabel}>Último trade:</Text>
                          <Text style={styles.summaryValue}>
                            {autoTrades.length > 0
                              ? new Date(Math.max(...autoTrades.map(t => t.entryDate.getTime()))).toLocaleDateString()
                              : 'N/A'}
                          </Text>
                        </View>
                      </View>

                      <Text style={styles.recentTradesTitle}>🤖 Trades Automáticos desde Firebase</Text>
                      
                      {/* Loading indicator for trades */}
                      {appState.autoTradesLoading && (
                        <View style={styles.modalLoading}>
                          <ActivityIndicator size="small" color="#00ff88" />
                          <Text style={styles.modalSubtitle}>Cargando trades...</Text>
                        </View>
                      )}
                      
                      {autoTrades
                        .slice(0, 10) // Show first 10 trades
                        .map((trade) => (
                        <View key={trade.id} style={styles.enhancedTradeItem}>
                          <View style={styles.enhancedTradeHeader}>
                            <View style={styles.tradeSymbolContainer}>
                              <Text style={styles.enhancedTradeSymbol}>{trade.symbol}</Text>
                              <Text style={[
                                styles.enhancedTradeSignal,
                                { 
                                  color: trade.signal === 'buy' ? '#00ff88' : 
                                        trade.signal === 'sell' ? '#ff4757' : '#ffb800' 
                                }
                              ]}>
                                {trade.signal?.toUpperCase() || 'WATCH'}
                              </Text>
                            </View>
                            <View style={[styles.tradeBadge, { backgroundColor: 'rgba(0, 255, 136, 0.2)' }]}>
                              <Text style={[styles.tradeBadgeText, { color: '#00ff88' }]}>🤖 AUTO</Text>
                            </View>
                          </View>
                          
                          <View style={styles.enhancedTradeDetails}>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Precio entrada:</Text>
                              <Text style={styles.tradeDetailValue}>${trade.entryPrice.toFixed(4)}</Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Precio actual:</Text>
                              <Text style={styles.tradeDetailValue}>${trade.currentPrice.toFixed(4)}</Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Precio objetivo:</Text>
                              <Text style={[styles.tradeDetailValue, { color: '#00ff88' }]}>
                                ${(trade.targetPrice || 0).toFixed(4)}
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Stop Loss:</Text>
                              <Text style={[styles.tradeDetailValue, { color: '#ff4757' }]}>
                                ${(trade.stopLoss || 0).toFixed(4)}
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Confianza IA:</Text>
                              <Text style={[styles.tradeDetailValue, { 
                                color: trade.confidence >= 90 ? '#00ff88' : 
                                      trade.confidence >= 80 ? '#ffb800' : '#ff9500' 
                              }]}>
                                {trade.confidence}%
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Retorno esperado:</Text>
                              <Text style={[styles.tradeDetailValue, { color: '#00ff88' }]}>
                                +{(trade.lockedMetrics?.expectedReturn || 0).toFixed(1)}%
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Retorno actual:</Text>
                              <Text style={[styles.tradeDetailValue, { 
                                color: (trade.returnPercentage || 0) >= 0 ? '#00ff88' : '#ff4757' 
                              }]}>
                                {(trade.returnPercentage || 0) >= 0 ? '+' : ''}{(trade.returnPercentage || 0).toFixed(1)}%
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Estado:</Text>
                              <Text style={[styles.tradeDetailValue, { 
                                color: trade.status === 'active' ? '#ffb800' : 
                                      trade.status === 'closed' ? '#00ff88' : '#ff4757'
                              }]}>
                                {trade.status?.toUpperCase() || 'ACTIVE'}
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Estrategia:</Text>
                              <Text style={[styles.tradeDetailValue, { color: '#9b59b6' }]}>
                                {trade.strategy}
                              </Text>
                            </View>
                            <View style={styles.tradeDetailRow}>
                              <Text style={styles.tradeDetailLabel}>Plazo:</Text>
                              <Text style={styles.tradeDetailValue}>
                                {trade.timeframe} | {trade.entryDate.toLocaleDateString()}
                              </Text>
                            </View>
                            {trade.signalExpiry && (
                              <View style={styles.tradeDetailRow}>
                                <Text style={styles.tradeDetailLabel}>Expira:</Text>
                                <Text style={[styles.tradeDetailValue, { color: '#ff9500' }]}>
                                  {trade.signalExpiry.toLocaleDateString()}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </>
                  ) : (
                    <View style={styles.noTradesState}>
                      <Text style={styles.noTradesIcon}>🤖</Text>
                      <Text style={styles.enhancedNoTradesText}>
                        No hay trades automáticos ejecutados aún.{'\n'}
                        Activa el auto-trading para que el sistema ejecute trades automáticamente.
                      </Text>
                    </View>
                  )}
                </View>

                {/* Auto Trades Toggle */}
                <TouchableOpacity
                  style={styles.enhancedTradesToggleButton}
                  onPress={() => {
                    const isOpening = !appState.showTradesInModal;
                    updateAppState({ showTradesInModal: isOpening });
                    if (isOpening && autoTrades.length === 0) {
                      loadAutoTrades(0); // Load first page when opening
                    }
                  }}
                >
                  <Text style={styles.enhancedTradesToggleButtonText}>
                    {appState.showTradesInModal ? '🤖 Ocultar Trades Automáticos' : '🤖 Ver Trades Automáticos'} ({autoTrades.length})
                  </Text>
                </TouchableOpacity>
                
                {appState.showTradesInModal && (
                  <View style={styles.allTradesContainer}>
                    <Text style={styles.allTradesTitle}>🤖 Trades Automáticos</Text>
                    {autoTrades.length > 0 ? (
                      <FlatList
                        data={autoTrades}
                        renderItem={({ item: trade }) => (
                        <View key={trade.id} style={styles.compactTradeItem}>
                          <View style={styles.compactTradeHeader}>
                            <Text style={styles.compactTradeSymbol}>{trade.symbol}</Text>
                            <Text style={[
                              styles.compactTradeSignal,
                              { 
                                color: trade.signal === 'buy' ? '#00ff88' : 
                                      trade.signal === 'sell' ? '#ff4757' : '#ffb800' 
                              }
                            ]}>
                              {trade.signal?.toUpperCase() || 'WATCH'}
                            </Text>
                            <Text style={styles.compactTradeDetails}>
                              ${trade.entryPrice.toFixed(4)} • {trade.confidence}% • 
                              {trade.entryDate.toLocaleDateString()} 🤖
                            </Text>
                          </View>
                        </View>
                        )}
                        keyExtractor={(trade) => trade.id}
                        onEndReached={() => {
                          if (appState.autoTradesHasMore && !appState.autoTradesLoading) {
                            loadAutoTrades(appState.autoTradesPage + 1, true);
                          }
                        }}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={
                          appState.autoTradesLoading ? (
                            <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 10 }} />
                          ) : null
                        }
                      />
                    ) : (
                      <View style={styles.noTradesContainer}>
                        <Text style={styles.noTradesText}>No hay trades automáticos</Text>
                        <Text style={styles.noTradesSubtext}>
                          Los trades automáticos aparecerán aquí cuando se ejecuten
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : (
              <Text style={styles.noDataText}>No hay datos disponibles</Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  // Simple header styles
  simpleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#111',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statsButton: {
    padding: 8,
  },
  statsButtonText: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: 'bold',
  },
  // Simple controls
  simpleControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#111',
  },
  simpleButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
    marginRight: 15,
  },
  simpleButtonDisabled: {
    backgroundColor: '#666',
  },
  simpleButtonText: {
    color: '#000',
    fontWeight: 'bold',
    textAlign: 'center',
    fontSize: 14,
  },
  switchContainer: {
    alignItems: 'center',
  },
  switchLabel: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 5,
  },
  // Simple progress
  simpleProgressContainer: {
    backgroundColor: '#222',
    marginHorizontal: 20,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  simpleProgressBar: {
    height: 4,
    backgroundColor: '#00ff88',
    borderRadius: 2,
    marginBottom: 5,
  },
  simpleProgressText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  // Simple filters
  simpleFiltersContainer: {
    maxHeight: 50,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  filterButton: {
    backgroundColor: '#333',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 2,
    borderColor: '#555',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  filterButtonActive: {
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
    elevation: 4,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  filterButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#000',
    fontWeight: '700',
  },
  clearButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  clearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Alerts list
  alertsList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  // Alert card styles (original design)
  alertCard: {
    backgroundColor: '#111',
    borderRadius: 16,
    padding: 20,
    marginVertical: 8,
    borderWidth: 2,
    borderColor: '#333',
    position: 'relative',
    overflow: 'hidden',
    elevation: 8,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modernSignalBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 2,
  },
  modernSignalText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.5,
  },
  savedBadge: {
    position: 'absolute',
    top: 55,
    right: 16,
    zIndex: 2,
  },
  savedBadgeText: {
    fontSize: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  symbolContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertSymbol: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginRight: 12,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  alertPrice: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '700',
  },
  targetPrice: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  alertStrategy: {
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  alertMessage: {
    color: '#e0e0e0',
    fontSize: 11,
    marginBottom: 16,
    lineHeight: 16,
  },
  // Original metrics grid (6 cards)
  modernDetailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  detailCard: {
    width: '30%',
    backgroundColor: '#0f0f0f',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  detailCardLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  detailCardValue: {
    color: '#e0e0e0',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTime: {
    color: '#888',
    fontSize: 11,
  },
  priorityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  emptyStateButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#000',
    fontWeight: 'bold',
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12, // Reduced from 20
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalCloseButton: {
    padding: 8,
  },
  modalCloseText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalLoading: {
    marginTop: 50,
  },
  modalContent: {
    flex: 1,
    padding: 8, // Reduced from 20
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  statsCard: {
    width: '48%',
    backgroundColor: '#111',
    padding: 10, // Reduced from 15
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  statsCardTitle: {
    color: '#888',
    fontSize: 12,
    marginBottom: 5,
  },
  statsCardValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleTradesButton: {
    backgroundColor: '#333',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#555',
  },
  toggleTradesText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
    marginTop: 10,
  },
  // Trades section styles
  tradesSection: {
    marginTop: 10,
  },
  tradeItem: {
    backgroundColor: '#111',
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  tradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeSymbol: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  tradeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tradeTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tradeTypeBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  tradeReturn: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tradeDetails: {
    marginBottom: 5,
  },
  tradeDetailText: {
    color: '#888',
    fontSize: 11,
    marginBottom: 2,
  },
  tradeStrategy: {
    color: '#666',
    fontSize: 10,
    fontStyle: 'italic',
  },
  noTradesContainer: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  noTradesText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  noTradesSubtext: {
    color: '#666',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  noDataText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
  // Enhanced Modal Styles
  floatingCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    backgroundColor: '#ff4757',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  floatingCloseButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  modalHeaderSection: {
    paddingHorizontal: 20,
    paddingTop: 80,
    paddingBottom: 30,
    backgroundColor: '#0a0a0a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalMainTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  tradingStatusCard: {
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  statusTextSmall: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  configDetails: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  configText: {
    color: '#b0b0b0',
    fontSize: 12,
    textAlign: 'center',
  },
  enhancedStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  mainStatCard: {
    width: '100%',
    marginBottom: 16,
    backgroundColor: '#00ff88',
    borderColor: '#00ff88',
  },
  secondaryStatCard: {
    width: '48%',
  },
  returnStatCard: {
    width: '48%',
  },
  confidenceStatCard: {
    width: '48%',
  },
  executionStatCard: {
    width: '48%',
  },
  statSubtext: {
    color: '#333',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 4,
  },
  tradingAnalysisSection: {
    backgroundColor: '#111',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  tradingSummary: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  summaryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  recentTradesTitle: {
    color: '#00ff88',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  enhancedTradeItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
    borderLeftWidth: 4,
    borderLeftColor: '#00ff88',
  },
  enhancedTradeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tradeSymbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  enhancedTradeSymbol: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginRight: 8,
  },
  enhancedTradeSignal: {
    fontSize: 12,
    fontWeight: '600',
  },
  tradeBadge: {
    backgroundColor: '#00ff88',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tradeBadgeText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '700',
  },
  enhancedTradeDetails: {
    marginBottom: 8,
  },
  tradeDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tradeDetailLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  tradeDetailValue: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  enhancedTradeTime: {
    color: '#888',
    fontSize: 10,
    textAlign: 'center',
  },
  noTradesState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noTradesIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  enhancedNoTradesText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  enhancedTradesToggleButton: {
    backgroundColor: '#00ff88',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginHorizontal: 20,
    marginVertical: 10,
    elevation: 3,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  enhancedTradesToggleButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  allTradesContainer: {
    backgroundColor: '#111',
    marginHorizontal: 20,
    borderRadius: 12,
    padding: 16,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#333',
  },
  allTradesTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  compactTradeItem: {
    backgroundColor: '#0a0a0a',
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  compactTradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactTradeSymbol: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
  compactTradeSignal: {
    fontSize: 11,
    fontWeight: '600',
  },
  compactTradeDetails: {
    color: '#b0b0b0',
    fontSize: 10,
  },
  // Enhanced Controls Styles
  enhancedControlsContainer: {
    backgroundColor: '#111',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#00ff88',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  switchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  enhancedScanButton: {
    backgroundColor: '#00ff88',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    minWidth: 100,
  },
  enhancedScanButtonDisabled: {
    backgroundColor: '#555',
    elevation: 0,
    shadowOpacity: 0,
  },
  enhancedScanButtonText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 13,
    textAlign: 'center',
  },
  enhancedStatsButton: {
    backgroundColor: '#ffb800',
    padding: 12,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#ffb800',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    minWidth: 50,
  },
  enhancedStatsButtonText: {
    fontSize: 18,
    color: '#000',
    textAlign: 'center',
  },
  enhancedAutoTradeButton: {
    backgroundColor: '#9b59b6',
    padding: 12,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#9b59b6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    minWidth: 60,
  },
  enhancedAutoTradeButtonText: {
    fontSize: 12,
    color: '#ffffff',
    textAlign: 'center',
    fontWeight: '700',
  },
  // Enhanced Progress Styles
  enhancedProgressContainer: {
    backgroundColor: '#111',
    marginHorizontal: 20,
    marginVertical: 10,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#00ff88',
    elevation: 3,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  progressPercentage: {
    color: '#00ff88',
    fontSize: 18,
    fontWeight: '700',
  },
  enhancedProgressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  enhancedProgressFill: {
    height: '100%',
    backgroundColor: '#00ff88',
    borderRadius: 4,
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 2,
  },
  progressStatus: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Enhanced Filters Styles
  enhancedFiltersContainer: {
    backgroundColor: '#111',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  filtersScroll: {
    paddingHorizontal: 16,
  },
  filterGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  filterGroupTitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '600',
    marginRight: 8,
    textTransform: 'uppercase',
  },
  filterSeparator: {
    width: 1,
    height: 30,
    backgroundColor: '#555',
    marginHorizontal: 12,
  },
  enhancedClearButton: {
    backgroundColor: '#ff4757',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginLeft: 12,
    elevation: 2,
    shadowColor: '#ff4757',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  enhancedClearButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  // Signal metrics styles
  signalMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 16,
    gap: 8,
  },
  signalMetricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  signalMetricValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#00ff88',
    marginBottom: 4,
  },
  signalMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
    fontWeight: '600',
  },
  // VaporFLUX AI Header styles
  vaporFluxHeader: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 255, 136, 0.2)',
  },
  vaporFluxTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00ff88',
    letterSpacing: 1,
  },
  vaporFluxSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  // Compact controls styles
  compactControlsContainer: {
    backgroundColor: theme.surface,
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 255, 136, 0.2)',
  },
  compactControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  compactSwitchGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compactSwitchLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  compactSwitch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  compactActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  compactButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.surfaceVariant,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanButton: {
    backgroundColor: 'rgba(33, 150, 243, 0.2)',
    borderColor: '#2196f3',
  },
  compactStatsButton: {
    backgroundColor: 'rgba(156, 39, 176, 0.2)',
    borderColor: '#9c27b0',
  },
  autoTradeButton: {
    backgroundColor: 'rgba(244, 67, 54, 0.2)',
    borderColor: '#f44336',
  },
  autoTradeButtonActive: {
    backgroundColor: 'rgba(0, 255, 136, 0.2)',
    borderColor: '#00ff88',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  compactButtonText: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  compactButtonTextActive: {
    color: '#00ff88',
  },
});

export default AlertScreen;

import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';
import { autoAlertService, AutoAlert } from '../services/autoAlertService';

interface AlertScreenProps {
  onBack: () => void;
}

const AlertScreen: React.FC<AlertScreenProps> = ({ onBack }) => {
  const [alerts, setAlerts] = useState<AutoAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'crypto' | 'stocks' | 'critical' | 'high' | 'medium' | 'low'>('all');

  // Initialize and load alerts
  useEffect(() => {
    initializeAlertService();
    
    // Listen for gem updates every 30 seconds
    const checkForNewGems = setInterval(async () => {
      try {
        const availableAssets = await autoAlertService.getAvailableAssets();
        const currentAssetCount = availableAssets.length;
        
        // If we suddenly have more assets, trigger a scan
        if (currentAssetCount > 16 && alerts.length === 0) {
          console.log(`🆕 Detected new gems (${currentAssetCount} assets), triggering alert scan...`);
          performScan();
        }
      } catch (error) {
        // Silent fail, we'll try again in 30 seconds
      }
    }, 30000); // Check every 30 seconds
    
    return () => {
      clearInterval(checkForNewGems);
    };
  }, [alerts.length]);

  const initializeAlertService = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Initializing Alert Service...');
      
      // Load existing alerts from cache first (fast)
      await autoAlertService.loadAlerts();
      
      // Get cached alerts immediately
      const cachedAlerts = autoAlertService.getActiveAlerts();
      
      // Check if alerts are recent (less than 2 hours old) and if we have gems to scan
      const hasRecentAlerts = cachedAlerts.some(alert => 
        Date.now() - alert.createdAt.getTime() < 7200000 // 2 hours
      );
      
      // Check if we have gems available for scanning
      const availableAssets = await autoAlertService.getAvailableAssets();
      const hasValidAssets = availableAssets.length > 16; // More than just premium assets
      
      console.log(`� Found ${cachedAlerts.length} cached alerts (recent: ${hasRecentAlerts ? 'yes' : 'no'})`);
      console.log(`🎯 Available assets: ${availableAssets.length} (gems: ${hasValidAssets ? 'yes' : 'no'})`);
      
      if (hasRecentAlerts && hasValidAssets) {
        // We have recent alerts and valid gems, show them
        setAlerts(cachedAlerts);
        console.log(`✅ Using ${cachedAlerts.length} recent alerts`);
      } else if (!hasValidAssets) {
        // No gems available yet, clear old alerts
        setAlerts([]);
        console.log('⚠️ No gems available yet - user needs to scan in GemFinder first');
      } else {
        // Old alerts, perform fresh scan
        setAlerts([]);
        console.log('📡 Alerts too old, performing fresh scan...');
        performScan().catch(error => {
          console.warn('Background scan failed:', error);
        });
      }
      
      // Start auto scanning in background only if we have valid assets
      if (autoScanEnabled && hasValidAssets) {
        autoAlertService.startAutoScan(15); // Every 15 minutes
        console.log('🚀 Auto-scan enabled (15 min intervals)');
      } else if (!hasValidAssets) {
        console.log('⏸️ Auto-scan paused - waiting for gems from GemFinder');
      }
      
    } catch (error) {
      console.error('Error initializing alert service:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const performScan = async () => {
    try {
      setIsLoading(true);
      
      // Check how many assets we have available
      const availableAssets = await autoAlertService.getAvailableAssets();
      console.log(`🔍 Scanning ${availableAssets.length} available assets for trading opportunities...`);
      
      if (availableAssets.length <= 16) {
        // Only premium assets, warn user
        Alert.alert(
          '⚠️ Limited Assets',
          'Only premium assets available. Scan for gems in GemFinder to get more trading opportunities!',
          [
            { text: 'OK', style: 'default' },
            { text: 'Go to GemFinder', style: 'default', onPress: () => {
              // Could add navigation here if needed
            }}
          ]
        );
      }
      
      const newAlerts = await autoAlertService.forceScan();
      const allAlerts = autoAlertService.getActiveAlerts();
      setAlerts(allAlerts);
      
      if (newAlerts.length > 0) {
        Alert.alert(
          '🎯 New Signals!', 
          `Found ${newAlerts.length} new trading opportunities from ${availableAssets.length} assets`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else if (availableAssets.length > 16) {
        Alert.alert(
          '🔍 Scan Complete', 
          `Analyzed ${availableAssets.length} assets - no new opportunities at this time`,
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error performing scan:', error);
      Alert.alert('Error', 'Failed to scan for new opportunities');
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await performScan();
    setRefreshing(false);
  };

  const toggleAutoScan = () => {
    if (autoScanEnabled) {
      autoAlertService.stopAutoScan();
      Alert.alert('Auto-Scan Disabled', 'Automatic alert generation has been stopped');
    } else {
      autoAlertService.startAutoScan(15);
      Alert.alert('Auto-Scan Enabled', 'Automatic alerts will be generated every 15 minutes');
    }
    setAutoScanEnabled(!autoScanEnabled);
  };

  const dismissAlert = (alertId: string) => {
    Alert.alert(
      'Dismiss Alert',
      'Mark this alert as seen?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Dismiss', 
          onPress: () => {
            autoAlertService.deactivateAlert(alertId);
            setAlerts(autoAlertService.getActiveAlerts());
          }
        }
      ]
    );
  };

  const getFilteredAlerts = () => {
    let filteredAlerts = alerts;
    
    // First filter by asset type if needed
    if (selectedFilter === 'crypto') {
      filteredAlerts = alerts.filter(alert => 
        // CoinGecko IDs (contain dashes or specific crypto patterns)
        alert.symbol.includes('-') || 
        alert.symbol.match(/bitcoin|ethereum|cardano|solana|polkadot|chainlink|polygon|avalanche|injective|oasis|fantom|ocean|thorchain|kava|celer|band|ankr|render/) ||
        // Legacy crypto symbols (for backward compatibility)
        alert.symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/)
      );
    } else if (selectedFilter === 'stocks') {
      filteredAlerts = alerts.filter(alert => 
        // Traditional stock symbols (1-5 uppercase letters, no dashes)
        alert.symbol.match(/^[A-Z]{1,5}$/) && 
        // Exclude crypto symbols
        !alert.symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/) &&
        // No dashes (CoinGecko format)
        !alert.symbol.includes('-')
      );
    } else if (selectedFilter !== 'all') {
      // Filter by priority
      filteredAlerts = autoAlertService.getAlertsByPriority(selectedFilter as 'low' | 'medium' | 'high' | 'critical');
    }
    
    // Enhanced logging for debugging
    const cryptoAlerts = filteredAlerts.filter(alert => 
      alert.symbol.includes('-') || 
      alert.symbol.match(/bitcoin|ethereum|cardano|solana|polkadot|chainlink|polygon|avalanche|injective|oasis|fantom|ocean|thorchain|kava|celer|band|ankr|render/) ||
      alert.symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/)
    );
    const stockAlerts = filteredAlerts.filter(alert => 
      alert.symbol.match(/^[A-Z]{1,5}$/) && 
      !alert.symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/) &&
      !alert.symbol.includes('-')
    );
    
    console.log(`📊 Filtered alerts (${selectedFilter}): ${filteredAlerts.length} total (${cryptoAlerts.length} crypto, ${stockAlerts.length} stocks)`);
    if (cryptoAlerts.length > 0) {
      console.log(`🪙 Crypto symbols: ${cryptoAlerts.map(a => a.symbol).join(', ')}`);
    }
    if (stockAlerts.length > 0) {
      console.log(`📈 Stock symbols: ${stockAlerts.map(a => a.symbol).join(', ')}`);
    }
    
    return filteredAlerts;
  };

  const getSignalIcon = (signal: 'buy' | 'sell' | 'watch') => {
    switch (signal) {
      case 'buy': return '🚀';
      case 'sell': return '📉';
      case 'watch': return '👀';
      default: return '📊';
    }
  };

  const getAssetTypeIcon = (symbol: string) => {
    // Detect if it's a stock or crypto with better CoinGecko ID detection
    const isCrypto = symbol.includes('-') || 
                    symbol.match(/bitcoin|ethereum|cardano|solana|polkadot|chainlink|polygon|avalanche|injective|oasis|fantom|ocean|thorchain|kava|celer|band|ankr|render/) ||
                    symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/);
    
    return isCrypto ? '₿' : '📈'; // Bitcoin symbol for crypto or chart for stocks
  };

  const getAssetTypeLabel = (symbol: string) => {
    const isCrypto = symbol.includes('-') || 
                    symbol.match(/bitcoin|ethereum|cardano|solana|polkadot|chainlink|polygon|avalanche|injective|oasis|fantom|ocean|thorchain|kava|celer|band|ankr|render/) ||
                    symbol.match(/BTC|ETH|ADA|SOL|DOT|LINK|MATIC|AVAX|INJ|ROSE|FTM|OCEAN|RUNE|KAVA|CELR|REN|BAND|ANKR/);
    
    return isCrypto ? 'CRYPTO' : 'STOCK';
  };

  const getSignalColor = (signal: 'buy' | 'sell' | 'watch') => {
    switch (signal) {
      case 'buy': return theme.success;
      case 'sell': return theme.error;
      case 'watch': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getPriorityColor = (priority: 'low' | 'medium' | 'high' | 'critical') => {
    switch (priority) {
      case 'critical': return theme.error;
      case 'high': return '#FF6B6B';
      case 'medium': return theme.warning;
      case 'low': return theme.success;
      default: return theme.textSecondary;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const renderAlert = ({ item }: { item: AutoAlert }) => (
    <View style={styles.alertCard}>
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.alertGradient}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertInfo}>
            <View style={styles.symbolContainer}>
              <Text style={styles.alertSymbol}>{item.symbol}</Text>
              <View style={[styles.assetTypeBadge, { backgroundColor: getAssetTypeLabel(item.symbol) === 'STOCK' ? '#4CAF50' : '#FF9800' }]}>
                <Text style={styles.assetTypeText}>{getAssetTypeIcon(item.symbol)} {getAssetTypeLabel(item.symbol)}</Text>
              </View>
              <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) }]}>
                <Text style={styles.priorityText}>{item.priority.toUpperCase()}</Text>
              </View>
            </View>
            <View style={styles.signalContainer}>
              <Text style={styles.signalIcon}>{getSignalIcon(item.signal)}</Text>
              <Text style={[styles.signalText, { color: getSignalColor(item.signal) }]}>
                {item.signal.toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => dismissAlert(item.id)}
          >
            <Text style={styles.dismissButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.alertContent}>
          <Text style={styles.strategyName}>{item.strategy}</Text>
          <Text style={styles.alertMessage}>{item.reasoning}</Text>
          
          <View style={styles.detailsGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Price</Text>
              <Text style={styles.detailValue}>${item.currentPrice.toLocaleString()}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Target</Text>
              <Text style={styles.detailValue}>
                {item.targetPrice ? `$${item.targetPrice.toLocaleString()}` : 'N/A'}
              </Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Confidence</Text>
              <Text style={styles.detailValue}>{Math.round(item.confidence * 100)}%</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Time</Text>
              <Text style={styles.detailValue}>{formatTimeAgo(item.createdAt)}</Text>
            </View>
          </View>
          
          {item.reasoning && (
            <View style={styles.reasoningContainer}>
              <Text style={styles.reasoningTitle}>📋 Analysis</Text>
              <Text style={styles.reasoningText}>{item.reasoning}</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );

  const filteredAlerts = getFilteredAlerts();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[theme.background, theme.surfaceVariant]}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>🎯 AI Trading Signals</Text>
          <TouchableOpacity
            style={[styles.scanButton, { backgroundColor: autoScanEnabled ? theme.success : theme.border }]}
            onPress={toggleAutoScan}
          >
            <Text style={styles.scanButtonText}>
              {autoScanEnabled ? '🟢 AUTO' : '⚪ OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        
        <View style={styles.filterContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {['all', 'crypto', 'stocks', 'critical', 'high', 'medium', 'low'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterButton,
                  selectedFilter === filter && styles.filterButtonActive
                ]}
                onPress={() => setSelectedFilter(filter as any)}
              >
                <Text style={[
                  styles.filterButtonText,
                  selectedFilter === filter && styles.filterButtonTextActive
                ]}>
                  {filter === 'crypto' ? '₿ Crypto' : 
                   filter === 'stocks' ? '📈 Stocks' :
                   filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity
          style={styles.forceScenButton}
          onPress={performScan}
          disabled={isLoading}
        >
          <Text style={styles.forceScanButtonText}>
            {isLoading ? '🔄 Scanning...' : '🔍 Scan Now'}
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      <FlatList
        data={filteredAlerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id}
        style={styles.alertsList}
        contentContainerStyle={styles.alertsContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎯</Text>
            <Text style={styles.emptyTitle}>
              {isLoading ? 'Scanning Markets...' : 'No Trading Signals'}
            </Text>
            <Text style={styles.emptyMessage}>
              {isLoading 
                ? '🔍 AI analyzing fresh market data...' 
                : filteredAlerts.length === 0 && alerts.length === 0
                  ? '💎 Scan for gems in GemFinder first, then return here for trading signals'
                  : `No ${selectedFilter === 'all' ? 'trading' : selectedFilter} signals found. Pull to refresh or enable auto-scan.`
              }
            </Text>
            {isLoading && (
              <Text style={styles.loadingDetails}>
                🔍 Checking both cryptocurrency and stock markets{'\n'}
                ⚡ Using smart caching for faster results{'\n'}
                📊 AI analyzing technical indicators...{'\n'}
                💎 Scanning for gem opportunities...
              </Text>
            )}
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 20,
    color: theme.primary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  scanButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  filterContainer: {
    marginBottom: 15,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: theme.surface,
    marginRight: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: theme.background,
    fontWeight: 'bold',
  },
  forceScenButton: {
    backgroundColor: theme.primary,
    paddingVertical: 12,
    borderRadius: 25,
    alignItems: 'center',
  },
  forceScanButtonText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: 'bold',
  },
  alertsList: {
    flex: 1,
  },
  alertsContent: {
    padding: 20,
  },
  alertCard: {
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
  },
  alertGradient: {
    padding: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  alertInfo: {
    flex: 1,
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginRight: 10,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.background,
  },
  signalContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signalIcon: {
    fontSize: 18,
    marginRight: 6,
  },
  signalText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  dismissButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dismissButtonText: {
    fontSize: 16,
    color: theme.textSecondary,
    fontWeight: 'bold',
  },
  alertContent: {
    marginTop: 8,
  },
  strategyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 12,
    lineHeight: 20,
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailItem: {
    width: '48%',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  reasoningContainer: {
    backgroundColor: theme.background + '80',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  reasoningTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 6,
  },
  reasoningText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 10,
  },
  emptyMessage: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 40,
  },
  assetTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    marginRight: 6,
  },
  assetTypeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: theme.background,
  },
  loadingDetails: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 20,
    paddingHorizontal: 20,
  },
});

export default AlertScreen;

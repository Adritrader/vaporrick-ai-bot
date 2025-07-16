import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';
import { historicalBacktestService, BacktestResult, StrategyConfig } from '../services/historicalBacktestService';

interface BacktestScreenProps {
  onBack: () => void;
}

const BacktestScreen: React.FC<BacktestScreenProps> = ({ onBack }) => {
  const [backtestResults, setBacktestResults] = useState<BacktestResult[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(false);
  const [backtestPeriod, setBacktestPeriod] = useState(90);
  const [selectedAssets] = useState(['BTC', 'ETH', 'AAPL', 'GOOGL']);

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
      
    } catch (error) {
      console.error('Multi-strategy backtest error:', error);
      Alert.alert('Error', 'Failed to run multi-strategy backtest: ' + error.message);
    } finally {
      setBacktestLoading(false);
    }
  }, [selectedAssets, backtestPeriod]);

  const renderStrategyCard = ({ item }: { item: StrategyConfig }) => (
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
          <View style={styles.strategyTypeContainer}>
            <Text style={styles.strategyType}>AI Strategy</Text>
          </View>
        </View>
        
        <Text style={styles.strategyDescription}>
          Advanced AI-powered trading strategy
        </Text>
        
        <View style={styles.strategyParams}>
          <Text style={styles.paramText}>
            📊 Parámetros: {Object.keys(item.parameters || {}).length} configurados
          </Text>
        </View>
        
        {backtestLoading && (
          <ActivityIndicator size="small" color={theme.primary} style={styles.strategyLoader} />
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  const renderResultCard = ({ item }: { item: BacktestResult }) => {
    const isPositive = item.totalReturnPercent > 0;
    
    return (
      <View style={styles.resultCard}>
        <LinearGradient
          colors={isPositive ? [theme.success + '20', theme.success + '10'] : [theme.error + '20', theme.error + '10']}
          style={styles.resultGradient}
        >
          <View style={styles.resultHeader}>
            <View>
              <Text style={styles.resultSymbol}>{item.symbol}</Text>
              <Text style={styles.resultStrategy}>{item.strategy}</Text>
            </View>
            <Text style={[
              styles.resultReturn,
              { color: isPositive ? theme.success : theme.error }
            ]}>
              {item.totalReturnPercent > 0 ? '+' : ''}{item.totalReturnPercent.toFixed(2)}%
            </Text>
          </View>
          
          <View style={styles.resultMetrics}>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Total Trades</Text>
              <Text style={styles.metricValue}>{item.totalTrades}</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Win Rate</Text>
              <Text style={styles.metricValue}>{item.winRate.toFixed(1)}%</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Max Drawdown</Text>
              <Text style={styles.metricValue}>{item.maxDrawdown.toFixed(2)}%</Text>
            </View>
            <View style={styles.metricRow}>
              <Text style={styles.metricLabel}>Sharpe Ratio</Text>
              <Text style={styles.metricValue}>{item.sharpeRatio.toFixed(2)}</Text>
            </View>
          </View>
          
          <View style={styles.resultPeriod}>
            <Text style={styles.periodText}>
              Period: {new Date(item.startDate).toLocaleDateString()} - {new Date(item.endDate).toLocaleDateString()}
            </Text>
          </View>
        </LinearGradient>
      </View>
    );
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
            <View style={styles.headerContent}>
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backButtonText}>← Volver</Text>
              </TouchableOpacity>
              <Text style={styles.headerTitle}>📈 AI Backtesting Engine</Text>
            </View>
            <Text style={styles.headerSubtitle}>
              Prueba estrategias con datos históricos
            </Text>
          </LinearGradient>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.controlsGradient}
          >
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Período (Días):</Text>
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
              <Text style={styles.controlLabel}>Assets:</Text>
              <Text style={styles.controlValue}>
                {selectedAssets.join(', ')} ({selectedAssets.length} total)
              </Text>
            </View>
          </LinearGradient>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Strategies Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Estrategias Disponibles</Text>
            <FlatList
              data={historicalBacktestService.getDefaultStrategies()}
              renderItem={renderStrategyCard}
              keyExtractor={(item) => item.name}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={runMultiStrategyBacktest}
              disabled={backtestLoading || selectedAssets.length === 0}
            >
              <LinearGradient
                colors={[theme.primary, theme.primaryDark]}
                style={styles.quickActionGradient}
              >
                <Text style={styles.quickActionText}>
                  {backtestLoading ? 'Ejecutando...' : '🚀 Backtest Múltiple'}
                </Text>
                <Text style={styles.quickActionSubtext}>
                  Prueba todas las estrategias
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Results Section */}
          {backtestResults.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📊 Resultados del Backtest</Text>
              <FlatList
                data={backtestResults}
                renderItem={renderResultCard}
                keyExtractor={(item, index) => `${item.symbol}-${item.strategy}-${index}`}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            </View>
          )}
        </ScrollView>
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
    paddingTop: theme.spacing.xxl * 1.5,
    paddingBottom: theme.spacing.sm,
  },
  headerGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  backButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.primary + '20',
    marginRight: theme.spacing.md,
  },
  backButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  controls: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  controlsGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  controlLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  controlValue: {
    fontSize: 12,
    color: theme.textSecondary,
    flex: 2,
    textAlign: 'right',
  },
  periodSelector: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  periodButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  strategyCard: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.small,
  },
  strategyGradient: {
    padding: theme.spacing.md,
  },
  strategyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  strategyName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    flex: 1,
  },
  strategyTypeContainer: {
    backgroundColor: theme.primary + '20',
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  strategyType: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.primary,
  },
  strategyDescription: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  strategyParams: {
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.xs,
  },
  paramText: {
    fontSize: 11,
    color: theme.textSecondary,
  },
  strategyLoader: {
    marginTop: theme.spacing.sm,
  },
  quickActions: {
    marginBottom: theme.spacing.lg,
  },
  quickActionButton: {
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.medium,
  },
  quickActionGradient: {
    padding: theme.spacing.md,
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
  resultCard: {
    marginBottom: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
  },
  resultGradient: {
    padding: theme.spacing.md,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  resultSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  resultStrategy: {
    fontSize: 11,
    color: theme.textSecondary,
    backgroundColor: theme.surfaceVariant,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 1,
    borderRadius: 3,
    marginTop: 2,
  },
  resultReturn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultMetrics: {
    gap: theme.spacing.xs,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  resultPeriod: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.xs,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  periodText: {
    fontSize: 10,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});

export default BacktestScreen;

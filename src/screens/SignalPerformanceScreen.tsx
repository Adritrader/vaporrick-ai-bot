import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert
} from 'react-native';
import { signalTrackingService, PerformanceStats, SignalPerformance } from '../services/signalTrackingService';

const { width } = Dimensions.get('window');

const SignalPerformanceScreen: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats | null>(null);
  const [signals, setSignals] = useState<SignalPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'signals' | 'monthly'>('overview');

  useEffect(() => {
    loadPerformanceData();
  }, []);

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      const [performanceStats, allSignals] = await Promise.all([
        signalTrackingService.getPerformanceStats(),
        Promise.resolve(signalTrackingService.getSignals())
      ]);
      
      setStats(performanceStats);
      setSignals(allSignals);
    } catch (error) {
      console.error('Error loading performance data:', error);
      Alert.alert('Error', 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return '#2196F3';
      case 'closed': return '#4CAF50';
      case 'expired': return '#FF9800';
      default: return '#757575';
    }
  };

  const getOutcomeColor = (outcome?: string) => {
    switch (outcome) {
      case 'win': return '#4CAF50';
      case 'loss': return '#F44336';
      case 'breakeven': return '#FF9800';
      default: return '#757575';
    }
  };

  const renderOverviewTab = () => {
    if (!stats) return null;

    return (
      <ScrollView style={styles.tabContent}>
        {/* Key Metrics */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats.totalSignals}</Text>
            <Text style={styles.metricLabel}>Total Señales</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricValue}>{stats.activeSignals}</Text>
            <Text style={styles.metricLabel}>Activas</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: stats.winRate >= 60 ? '#4CAF50' : stats.winRate >= 40 ? '#FF9800' : '#F44336' }]}>
              {stats.winRate.toFixed(1)}%
            </Text>
            <Text style={styles.metricLabel}>Win Rate</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={[styles.metricValue, { color: stats.averageReturn >= 0 ? '#4CAF50' : '#F44336' }]}>
              {stats.averageReturn >= 0 ? '+' : ''}{stats.averageReturn.toFixed(1)}%
            </Text>
            <Text style={styles.metricLabel}>Retorno Promedio</Text>
          </View>
        </View>

        {/* Performance Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Resumen de Rendimiento</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mejor Operación:</Text>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>+{stats.bestTrade.toFixed(1)}%</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Peor Operación:</Text>
            <Text style={[styles.summaryValue, { color: '#F44336' }]}>{stats.worstTrade.toFixed(1)}%</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Retorno Total:</Text>
            <Text style={[styles.summaryValue, { color: stats.totalReturn >= 0 ? '#4CAF50' : '#F44336' }]}>
              {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturn.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Tiempo Promedio:</Text>
            <Text style={styles.summaryValue}>{stats.avgHoldingTime.toFixed(1)} días</Text>
          </View>
          {stats.sharpeRatio && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sharpe Ratio:</Text>
              <Text style={styles.summaryValue}>{stats.sharpeRatio.toFixed(2)}</Text>
            </View>
          )}
          {stats.maxDrawdown && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Max Drawdown:</Text>
              <Text style={[styles.summaryValue, { color: '#F44336' }]}>{stats.maxDrawdown.toFixed(1)}%</Text>
            </View>
          )}
        </View>

        {/* Performance by Confidence */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Rendimiento por Confianza</Text>
          {Object.entries(stats.performanceByConfidence).map(([level, data]) => (
            <View key={level} style={styles.confidenceRow}>
              <Text style={styles.confidenceLevel}>{level.toUpperCase()}</Text>
              <View style={styles.confidenceStats}>
                <Text style={styles.confidenceWins}>{data.wins}W</Text>
                <Text style={styles.confidenceLosses}>{data.losses}L</Text>
                <Text style={[styles.confidenceReturn, { color: data.avgReturn >= 0 ? '#4CAF50' : '#F44336' }]}>
                  {data.avgReturn >= 0 ? '+' : ''}{data.avgReturn.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Performance by Timeframe */}
        <View style={styles.summaryCard}>
          <Text style={styles.sectionTitle}>Rendimiento por Timeframe</Text>
          {Object.entries(stats.winsByTimeframe).map(([timeframe, wins]) => {
            const losses = stats.lossesByTimeframe[timeframe] || 0;
            const total = wins + losses;
            const winRate = total > 0 ? (wins / total) * 100 : 0;
            
            return (
              <View key={timeframe} style={styles.timeframeRow}>
                <Text style={styles.timeframeLabel}>{timeframe}</Text>
                <View style={styles.timeframeStats}>
                  <Text style={styles.timeframeWins}>{wins}W</Text>
                  <Text style={styles.timeframeLosses}>{losses}L</Text>
                  <Text style={[styles.timeframeWinRate, { color: winRate >= 60 ? '#4CAF50' : winRate >= 40 ? '#FF9800' : '#F44336' }]}>
                    {winRate.toFixed(0)}%
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderSignalsTab = () => {
    return (
      <ScrollView style={styles.tabContent}>
        {signals.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay señales registradas aún</Text>
            <Text style={styles.emptySubtext}>Las señales aparecerán aquí cuando se generen alertas</Text>
          </View>
        ) : (
          signals.map((signal) => (
            <View key={signal.id} style={styles.signalCard}>
              <View style={styles.signalHeader}>
                <Text style={styles.signalSymbol}>{signal.symbol}</Text>
                <View style={styles.signalBadges}>
                  <View style={[styles.signalBadge, { backgroundColor: signal.type === 'buy' ? '#4CAF50' : signal.type === 'sell' ? '#F44336' : '#FF9800' }]}>
                    <Text style={styles.signalBadgeText}>{signal.type.toUpperCase()}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(signal.status) }]}>
                    <Text style={styles.statusBadgeText}>{signal.status.toUpperCase()}</Text>
                  </View>
                </View>
              </View>
              
              <View style={styles.signalDetails}>
                <View style={styles.signalRow}>
                  <Text style={styles.signalLabel}>Precio Entrada:</Text>
                  <Text style={styles.signalValue}>${signal.entryPrice.toFixed(2)}</Text>
                </View>
                
                {signal.currentPrice && (
                  <View style={styles.signalRow}>
                    <Text style={styles.signalLabel}>Precio Actual:</Text>
                    <Text style={styles.signalValue}>${signal.currentPrice.toFixed(2)}</Text>
                  </View>
                )}
                
                {signal.targetPrice && (
                  <View style={styles.signalRow}>
                    <Text style={styles.signalLabel}>Precio Objetivo:</Text>
                    <Text style={styles.signalValue}>${signal.targetPrice.toFixed(2)}</Text>
                  </View>
                )}
                
                {signal.returnPercentage !== undefined && (
                  <View style={styles.signalRow}>
                    <Text style={styles.signalLabel}>Retorno:</Text>
                    <Text style={[styles.signalValue, { color: getOutcomeColor(signal.outcome) }]}>
                      {signal.returnPercentage >= 0 ? '+' : ''}{signal.returnPercentage.toFixed(1)}%
                    </Text>
                  </View>
                )}
                
                <View style={styles.signalRow}>
                  <Text style={styles.signalLabel}>Confianza:</Text>
                  <Text style={styles.signalValue}>{signal.confidence}%</Text>
                </View>
                
                <View style={styles.signalRow}>
                  <Text style={styles.signalLabel}>Timeframe:</Text>
                  <Text style={styles.signalValue}>{signal.timeframe}</Text>
                </View>
                
                <View style={styles.signalRow}>
                  <Text style={styles.signalLabel}>Fuente:</Text>
                  <Text style={styles.signalValue}>{signal.dataSource}</Text>
                </View>
                
                <Text style={styles.signalDate}>
                  {new Date(signal.entryDate).toLocaleDateString('es-ES', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Text>
                
                {signal.aiReasoning && (
                  <Text style={styles.signalReasoning} numberOfLines={2}>
                    {signal.aiReasoning}
                  </Text>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderMonthlyTab = () => {
    if (!stats) return null;

    return (
      <ScrollView style={styles.tabContent}>
        {stats.monthlyPerformance.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay datos mensuales aún</Text>
          </View>
        ) : (
          stats.monthlyPerformance.map((month) => (
            <View key={month.month} style={styles.monthCard}>
              <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{month.month}</Text>
                <Text style={[styles.monthReturn, { color: month.return >= 0 ? '#4CAF50' : '#F44336' }]}>
                  {month.return >= 0 ? '+' : ''}{month.return.toFixed(1)}%
                </Text>
              </View>
              <View style={styles.monthStats}>
                <Text style={styles.monthStat}>{month.trades} operaciones</Text>
                <Text style={[styles.monthStat, { color: month.winRate >= 60 ? '#4CAF50' : month.winRate >= 40 ? '#FF9800' : '#F44336' }]}>
                  {month.winRate.toFixed(0)}% win rate
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rendimiento de Señales</Text>
        <TouchableOpacity onPress={loadPerformanceData} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Resumen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'signals' && styles.activeTab]}
          onPress={() => setSelectedTab('signals')}
        >
          <Text style={[styles.tabText, selectedTab === 'signals' && styles.activeTabText]}>
            Señales ({signals.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'monthly' && styles.activeTab]}
          onPress={() => setSelectedTab('monthly')}
        >
          <Text style={[styles.tabText, selectedTab === 'monthly' && styles.activeTabText]}>
            Mensual
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Cargando estadísticas...</Text>
        </View>
      ) : (
        <>
          {selectedTab === 'overview' && renderOverviewTab()}
          {selectedTab === 'signals' && renderSignalsTab()}
          {selectedTab === 'monthly' && renderMonthlyTab()}
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#2c5aa0',
  },
  tabText: {
    color: '#888',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#2c5aa0',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  metricCard: {
    width: (width - 60) / 2,
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    margin: 5,
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 5,
  },
  metricLabel: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  summaryCard: {
    backgroundColor: '#1a1a1a',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 15,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  summaryLabel: {
    color: '#888',
    fontSize: 14,
  },
  summaryValue: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  confidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  confidenceLevel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  confidenceStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceWins: {
    color: '#4CAF50',
    fontSize: 12,
    marginRight: 8,
  },
  confidenceLosses: {
    color: '#F44336',
    fontSize: 12,
    marginRight: 8,
  },
  confidenceReturn: {
    fontSize: 14,
    fontWeight: '500',
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  timeframeLabel: {
    color: '#ffffff',
    fontSize: 14,
    flex: 1,
  },
  timeframeStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeframeWins: {
    color: '#4CAF50',
    fontSize: 12,
    marginRight: 8,
  },
  timeframeLosses: {
    color: '#F44336',
    fontSize: 12,
    marginRight: 8,
  },
  timeframeWinRate: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  signalCard: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
  },
  signalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  signalSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  signalBadges: {
    flexDirection: 'row',
  },
  signalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 5,
  },
  signalBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 5,
  },
  statusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  signalDetails: {
    marginTop: 10,
  },
  signalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  signalLabel: {
    color: '#888',
    fontSize: 13,
  },
  signalValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '500',
  },
  signalDate: {
    color: '#666',
    fontSize: 11,
    marginTop: 10,
  },
  signalReasoning: {
    color: '#999',
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  monthCard: {
    backgroundColor: '#1a1a1a',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  monthReturn: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  monthStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  monthStat: {
    color: '#888',
    fontSize: 13,
  },
});

export default SignalPerformanceScreen;

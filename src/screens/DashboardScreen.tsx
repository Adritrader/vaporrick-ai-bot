import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart, PieChart, BarChart } from 'react-native-chart-kit';
import { theme } from '../theme/colors';
import { integratedDataService } from '../services/integratedDataService';
import { Ionicons } from '@expo/vector-icons';

const { width: screenWidth } = Dimensions.get('window');

interface DashboardStats {
  totalValue: number;
  totalPnL: number;
  winRate: number;
  activeStrategies: number;
  activePositions: number;
  todayGain: number;
  weeklyGain: number;
  monthlyGain: number;
  bestStrategy: string;
  worstStrategy: string;
  totalTrades: number;
  avgTradeTime: string;
}

interface Position {
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPercentage: number;
  value: number;
  type: 'crypto' | 'stock';
}

interface Alert {
  id: string;
  type: 'profit' | 'loss' | 'signal' | 'strategy';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
}

interface PortfolioChartData {
  labels: string[];
  datasets: [{
    data: number[];
    color?: (opacity: number) => string;
    strokeWidth?: number;
  }];
}

const DashboardScreen: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalValue: 0,
    totalPnL: 0,
    winRate: 0,
    activeStrategies: 0,
    activePositions: 0,
    todayGain: 0,
    weeklyGain: 0,
    monthlyGain: 0,
    bestStrategy: '',
    worstStrategy: '',
    totalTrades: 0,
    avgTradeTime: '0d',
  });
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [portfolioChartData, setPortfolioChartData] = useState<PortfolioChartData>({
    labels: [],
    datasets: [{ data: [] }],
  });
  const [assetAllocation, setAssetAllocation] = useState<any[]>([]);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '1W' | '1M' | '3M'>('1W');

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load portfolio stats
      await loadPortfolioStats();
      
      // Load active positions
      await loadActivePositions();
      
      // Load recent alerts
      await loadRecentAlerts();
      
      // Generate portfolio chart data
      generatePortfolioChart();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const loadPortfolioStats = async () => {
    try {
      const autoTrades = await integratedDataService.getAutoTrades();
      const strategies = await integratedDataService.getStrategies();
      
      // Calculate stats from trades
      const activeTrades = autoTrades.filter(trade => trade.status === 'active');
      const completedTrades = autoTrades.filter(trade => trade.status === 'completed');
      
      const totalPnL = activeTrades.reduce((sum, trade) => sum + trade.pnl, 0);
      const totalValue = activeTrades.reduce((sum, trade) => sum + (trade.quantity * trade.currentPrice), 0);
      const winningTrades = completedTrades.filter(trade => trade.pnl > 0);
      const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
      
      const totalTrades = autoTrades.length;
      const avgTradeHours = completedTrades.length > 0 ? 
        completedTrades.reduce((sum, trade) => sum + (Date.now() - new Date(trade.createdAt).getTime()), 0) / 
        completedTrades.length / (1000 * 60 * 60 * 24) : 0;
      
      // Find best and worst performing strategies
      const strategyPerformance = strategies.map(s => ({
        name: s.name,
        performance: s.performance || 0
      })).sort((a, b) => b.performance - a.performance);
      
      setStats({
        totalValue: totalValue,
        totalPnL: totalPnL,
        winRate: winRate,
        activeStrategies: strategies.filter(s => s.isActive).length,
        activePositions: activeTrades.length,
        todayGain: totalPnL * 0.1, // Mock today's gain
        weeklyGain: totalPnL * 0.3, // Mock weekly gain
        monthlyGain: totalPnL, // Total as monthly
        bestStrategy: strategyPerformance[0]?.name || 'N/A',
        worstStrategy: strategyPerformance[strategyPerformance.length - 1]?.name || 'N/A',
        totalTrades: totalTrades,
        avgTradeTime: `${Math.round(avgTradeHours)}d`,
      });
    } catch (error) {
      console.error('Error loading portfolio stats:', error);
    }
  };

  const loadActivePositions = async () => {
    try {
      const autoTrades = await integratedDataService.getAutoTrades();
      const activeTrades = autoTrades.filter(trade => trade.status === 'active');
      
      const positionsData: Position[] = activeTrades.map(trade => ({
        symbol: trade.symbol,
        name: trade.name,
        quantity: trade.quantity,
        avgPrice: trade.entryPrice,
        currentPrice: trade.currentPrice,
        pnl: trade.pnl,
        pnlPercentage: trade.pnlPercentage,
        value: trade.quantity * trade.currentPrice,
        type: trade.symbol.includes('USDT') || trade.symbol.includes('BTC') || trade.symbol.includes('ETH') ? 'crypto' : 'stock',
      }));
      
      setPositions(positionsData);
    } catch (error) {
      console.error('Error loading positions:', error);
    }
  };

  const loadRecentAlerts = async () => {
    // Mock alerts data - in real app, this would come from notifications/alerts service
    const mockAlerts: Alert[] = [
      {
        id: '1',
        type: 'profit',
        title: 'Position Profit Target',
        message: 'BTC position reached +15% profit target',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
        isRead: false,
        priority: 'high',
      },
      {
        id: '2',
        type: 'signal',
        title: 'New Trading Signal',
        message: 'AI detected bullish momentum in NVDA',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        isRead: false,
        priority: 'medium',
      },
      {
        id: '3',
        type: 'strategy',
        title: 'Strategy Performance',
        message: 'Momentum Pro strategy achieved 78% win rate this week',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
        isRead: true,
        priority: 'low',
      },
    ];
    
    setAlerts(mockAlerts);
  };

  const generatePortfolioChart = () => {
    const baseValue = 10000;
    const dataPoints = selectedTimeframe === '1D' ? 24 : 
                       selectedTimeframe === '1W' ? 7 : 
                       selectedTimeframe === '1M' ? 30 : 90;
    
    const data = [];
    const labels = [];
    
    for (let i = 0; i < dataPoints; i++) {
      const variance = (Math.random() - 0.5) * 0.02;
      const value = baseValue * (1 + variance * i / dataPoints + stats.monthlyGain / baseValue);
      data.push(Math.round(value));
      
      // Generate labels based on timeframe
      if (selectedTimeframe === '1D') {
        labels.push(i % 4 === 0 ? `${i}h` : '');
      } else if (selectedTimeframe === '1W') {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        labels.push(days[i] || '');
      } else {
        labels.push(i % 5 === 0 ? `${i}d` : '');
      }
    }
    
    setPortfolioChartData({
      labels,
      datasets: [{
        data,
        color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
        strokeWidth: 3,
      }],
    });

    // Generate asset allocation data
    const cryptoValue = stats.totalValue * 0.6;
    const stockValue = stats.totalValue * 0.4;
    
    setAssetAllocation([
      {
        name: 'Crypto',
        value: cryptoValue,
        color: theme.primary,
        legendFontColor: theme.textPrimary,
        legendFontSize: 12,
      },
      {
        name: 'Stocks',
        value: stockValue,
        color: theme.accent,
        legendFontColor: theme.textPrimary,
        legendFontSize: 12,
      },
    ]);

    // Generate performance comparison data
    setPerformanceData([
      Math.round(stats.todayGain),
      Math.round(stats.weeklyGain),
      Math.round(stats.monthlyGain),
      Math.round(stats.totalPnL),
    ]);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercentage = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'profit': return '💰';
      case 'loss': return '⚠️';
      case 'signal': return '📊';
      case 'strategy': return '🎯';
      default: return '📢';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.error;
      case 'medium': return theme.warning;
      case 'low': return theme.textSecondary;
      default: return theme.textSecondary;
    }
  };

  const renderModernStatsCard = (
    title: string, 
    value: string, 
    subtitle?: string, 
    icon?: string,
    change?: string, 
    isPositive?: boolean,
    extraInfo?: string
  ) => (
    <LinearGradient 
      colors={[theme.surface, theme.surfaceVariant]} 
      style={styles.modernStatsCard}
    >
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <View style={styles.cardTitleContainer}>
          <Text style={styles.modernStatsTitle}>{title}</Text>
          {subtitle && <Text style={styles.cardSubtitle}>{subtitle}</Text>}
        </View>
      </View>
      
      <Text style={styles.modernStatsValue}>{value}</Text>
      
      <View style={styles.cardFooter}>
        {change && (
          <Text style={[styles.modernStatsChange, isPositive ? styles.positive : styles.negative]}>
            {isPositive ? '↗' : '↘'} {change}
          </Text>
        )}
        {extraInfo && (
          <Text style={styles.extraInfo}>{extraInfo}</Text>
        )}
      </View>
    </LinearGradient>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={theme.gradients.background as any} style={styles.container}>
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        >
          {/* Modern Header */}
          <View style={styles.modernHeader}>
            <View style={styles.headerContent}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.modernHeaderTitle}>Trading Dashboard</Text>
              <Text style={styles.modernHeaderSubtitle}>
                {stats.activePositions} active positions • {stats.activeStrategies} strategies running
              </Text>
            </View>
            <TouchableOpacity style={styles.settingsIconContainer}>
              <Ionicons name="settings-outline" size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Portfolio Overview Cards */}
          <View style={styles.modernStatsGrid}>
            {renderModernStatsCard(
              'Portfolio Value',
              formatCurrency(stats.totalValue),
              'Total investment',
              '💼',
              formatPercentage(stats.todayGain / stats.totalValue * 100),
              stats.todayGain >= 0,
              'Today'
            )}
            {renderModernStatsCard(
              'Total P&L',
              formatCurrency(stats.totalPnL),
              'All time gains',
              '📈',
              formatPercentage(stats.weeklyGain / 10000 * 100),
              stats.totalPnL >= 0,
              'This week'
            )}
          </View>

          <View style={styles.modernStatsGrid}>
            {renderModernStatsCard(
              'Win Rate',
              formatPercentage(stats.winRate),
              `${stats.totalTrades} total trades`,
              '🎯',
              undefined,
              undefined,
              `Avg: ${stats.avgTradeTime}`
            )}
            {renderModernStatsCard(
              'Best Strategy',
              stats.bestStrategy || 'N/A',
              'Top performer',
              '🏆',
              undefined,
              undefined,
              'This month'
            )}
          </View>

          {/* Modern Portfolio Chart */}
          <LinearGradient 
            colors={[theme.surface, theme.surfaceVariant]} 
            style={styles.modernChartContainer}
          >
            <View style={styles.chartHeaderModern}>
              <View>
                <Text style={styles.chartTitleModern}>Portfolio Performance</Text>
                <Text style={styles.chartSubtitle}>
                  {formatCurrency(stats.totalValue)} • {formatPercentage(stats.monthlyGain / stats.totalValue * 100)}
                </Text>
              </View>
              <View style={styles.timeframeSelectorModern}>
                {['1D', '1W', '1M', '3M'].map((timeframe) => (
                  <TouchableOpacity
                    key={timeframe}
                    style={[
                      styles.timeframeButtonModern,
                      selectedTimeframe === timeframe && styles.activeTimeframeButtonModern
                    ]}
                    onPress={() => {
                      setSelectedTimeframe(timeframe as any);
                      generatePortfolioChart();
                    }}
                  >
                    <Text style={[
                      styles.timeframeTextModern,
                      selectedTimeframe === timeframe && styles.activeTimeframeTextModern
                    ]}>
                      {timeframe}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {portfolioChartData.datasets[0].data.length > 0 && (
              <View style={styles.chartWrapper}>
                <LineChart
                  data={portfolioChartData}
                  width={screenWidth - 64}
                  height={220}
                  chartConfig={{
                    backgroundColor: 'transparent',
                    backgroundGradientFrom: 'transparent',
                    backgroundGradientTo: 'transparent',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
                    strokeWidth: 3,
                    propsForLabels: { 
                      fontSize: 10,
                      fontFamily: 'System',
                    },
                    propsForVerticalLabels: { fontSize: 0 },
                    labelColor: () => theme.textSecondary,
                  }}
                  style={styles.modernChart}
                  withShadow={false}
                  withDots={true}
                  withInnerLines={false}
                  withVerticalLines={false}
                  withHorizontalLines={false}
                />
                
                {/* Chart Legend */}
                <View style={styles.chartLegend}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.primary }]} />
                    <Text style={styles.legendText}>Portfolio Value</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: theme.accent }]} />
                    <Text style={styles.legendText}>Target Growth</Text>
                  </View>
                </View>
              </View>
            )}
          </LinearGradient>

          {/* Asset Allocation & Performance */}
          <View style={styles.twoColumnSection}>
            {/* Asset Allocation Pie Chart */}
            <LinearGradient 
              colors={[theme.surface, theme.surfaceVariant]} 
              style={styles.halfWidthCard}
            >
              <Text style={styles.cardTitle}>Asset Allocation</Text>
              {assetAllocation.length > 0 && (
                <>
                  <PieChart
                    data={assetAllocation}
                    width={160}
                    height={120}
                    chartConfig={{
                      color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
                    }}
                    accessor="value"
                    backgroundColor="transparent"
                    paddingLeft="0"
                    hasLegend={false}
                  />
                  <View style={styles.allocationLegend}>
                    {assetAllocation.map((item, index) => (
                      <View key={index} style={styles.allocationItem}>
                        <View style={[styles.allocationDot, { backgroundColor: item.color }]} />
                        <Text style={styles.allocationText}>{item.name}</Text>
                        <Text style={styles.allocationValue}>
                          {((item.value / stats.totalValue) * 100).toFixed(0)}%
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </LinearGradient>

            {/* Performance Metrics */}
            <LinearGradient 
              colors={[theme.surface, theme.surfaceVariant]} 
              style={styles.halfWidthCard}
            >
              <Text style={styles.cardTitle}>Performance</Text>
              {performanceData.length > 0 && (
                <>
                  <BarChart
                    data={{
                      labels: ['1D', '1W', '1M', 'Total'],
                      datasets: [{ data: performanceData }],
                    }}
                    width={160}
                    height={120}
                    yAxisLabel="$"
                    yAxisSuffix=""
                    chartConfig={{
                      backgroundColor: 'transparent',
                      backgroundGradientFrom: 'transparent',
                      backgroundGradientTo: 'transparent',
                      color: (opacity = 1) => `rgba(0, 230, 118, ${opacity})`,
                      barPercentage: 0.7,
                      propsForLabels: { fontSize: 10 },
                    }}
                    style={styles.barChart}
                    withHorizontalLabels={false}
                    withInnerLines={false}
                    showBarTops={false}
                  />
                  <View style={styles.performanceMetrics}>
                    <Text style={styles.bestPerformance}>
                      Best: {formatCurrency(Math.max(...performanceData))}
                    </Text>
                  </View>
                </>
              )}
            </LinearGradient>
          </View>

          {/* Active Positions - Modern Design */}
          <LinearGradient 
            colors={[theme.surface, theme.surfaceVariant]} 
            style={styles.modernSection}
          >
            <View style={styles.modernSectionHeader}>
              <Text style={styles.modernSectionTitle}>Active Positions</Text>
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            
            {positions.slice(0, 3).map((position, index) => (
              <TouchableOpacity key={index} style={styles.modernPositionCard}>
                <View style={styles.positionLeft}>
                  <View style={styles.assetIconContainer}>
                    <Text style={styles.assetIcon}>
                      {position.type === 'crypto' ? '₿' : '📊'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.modernPositionSymbol}>{position.symbol}</Text>
                    <Text style={styles.modernPositionName}>{position.name}</Text>
                    <Text style={styles.positionQuantity}>
                      {position.quantity.toFixed(4)} @ {formatCurrency(position.avgPrice)}
                    </Text>
                  </View>
                </View>
                <View style={styles.positionRight}>
                  <Text style={styles.modernPositionValue}>{formatCurrency(position.value)}</Text>
                  <Text style={[
                    styles.modernPositionPnl,
                    position.pnl >= 0 ? styles.positive : styles.negative
                  ]}>
                    {formatPercentage(position.pnlPercentage)}
                  </Text>
                  <Text style={styles.positionPnlAmount}>
                    {formatCurrency(position.pnl)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </LinearGradient>

          {/* Recent Alerts - Modern Design */}
          <LinearGradient 
            colors={[theme.surface, theme.surfaceVariant]} 
            style={styles.modernSection}
          >
            <View style={styles.modernSectionHeader}>
              <Text style={styles.modernSectionTitle}>Recent Alerts</Text>
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            
            {alerts.slice(0, 3).map((alert) => (
              <TouchableOpacity 
                key={alert.id} 
                style={[styles.modernAlertCard, !alert.isRead && styles.unreadAlertModern]}
              >
                <View style={styles.alertLeftModern}>
                  <View style={[styles.alertIconContainer, { borderColor: getPriorityColor(alert.priority) }]}>
                    <Text style={styles.modernAlertIcon}>{getAlertIcon(alert.type)}</Text>
                  </View>
                  <View style={styles.alertContentModern}>
                    <Text style={styles.modernAlertTitle}>{alert.title}</Text>
                    <Text style={styles.modernAlertMessage}>{alert.message}</Text>
                  </View>
                </View>
                <View style={styles.alertRightModern}>
                  <Text style={styles.modernAlertTime}>
                    {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {!alert.isRead && <View style={styles.unreadDot} />}
                </View>
              </TouchableOpacity>
            ))}
          </LinearGradient>

          {/* Strategy Performance Overview */}
          <LinearGradient 
            colors={[theme.surface, theme.surfaceVariant]} 
            style={styles.modernSection}
          >
            <View style={styles.modernSectionHeader}>
              <Text style={styles.modernSectionTitle}>AI Strategies</Text>
              <TouchableOpacity style={styles.viewAllButton}>
                <Text style={styles.viewAllText}>Manage</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.primary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.strategiesGrid}>
              <View style={styles.strategyItem}>
                <Text style={styles.strategyNumber}>{stats.activeStrategies}</Text>
                <Text style={styles.strategyLabel}>Active Strategies</Text>
                <Text style={styles.strategyDetail}>Running</Text>
              </View>
              
              <View style={styles.strategyItem}>
                <Text style={styles.strategyNumber}>{formatPercentage(stats.winRate)}</Text>
                <Text style={styles.strategyLabel}>Success Rate</Text>
                <Text style={styles.strategyDetail}>Average</Text>
              </View>
              
              <View style={styles.strategyItem}>
                <Text style={styles.strategyNumber}>{stats.totalTrades}</Text>
                <Text style={styles.strategyLabel}>Total Trades</Text>
                <Text style={styles.strategyDetail}>All time</Text>
              </View>
            </View>
            
            <View style={styles.topStrategyCard}>
              <Text style={styles.topStrategyTitle}>🏆 Best Performer</Text>
              <Text style={styles.topStrategyName}>{stats.bestStrategy}</Text>
              <Text style={styles.topStrategyPerformance}>
                {formatCurrency(stats.monthlyGain)} this month
              </Text>
            </View>
          </LinearGradient>

          {/* Bottom Spacing */}
          <View style={{ height: 20 }} />
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
    padding: theme.spacing.md,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  chartContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  timeframeButtons: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
  },
  timeframeButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.surfaceVariant,
  },
  activeTimeframeButton: {
    backgroundColor: theme.primary,
  },
  timeframeText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  activeTimeframeText: {
    color: theme.background,
    fontWeight: 'bold',
  },
  chart: {
    borderRadius: theme.borderRadius.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  statsCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    flex: 1,
    minWidth: '45%',
  },
  statsTitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: theme.spacing.xs,
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.xs,
  },
  statsChange: {
    fontSize: 12,
    fontWeight: '500',
  },
  positive: {
    color: theme.primary,
  },
  negative: {
    color: theme.secondary,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  sectionLink: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '500',
  },
  positionCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  positionName: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  positionValues: {
    alignItems: 'flex-end',
  },
  positionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  positionPnl: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
  },
  alertCard: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  unreadAlert: {
    borderLeftWidth: 3,
    borderLeftColor: theme.primary,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  alertIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  alertMessage: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  alertTime: {
    fontSize: 10,
    color: theme.textMuted,
  },
  strategiesOverview: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  strategyMetric: {
    alignItems: 'center',
  },
  strategyNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: theme.spacing.xs,
  },
  strategyLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },

  // Modern Dashboard Styles
  modernHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm,
  },
  headerContent: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  modernHeaderTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 230, 118, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 10,
  },
  modernHeaderSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  settingsIconContainer: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.surfaceVariant,
  },

  modernStatsGrid: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  modernStatsCard: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  cardIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    ...theme.shadows.small,
  },
  cardIcon: {
    fontSize: 20,
  },
  cardTitleContainer: {
    flex: 1,
  },
  modernStatsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  cardSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  modernStatsValue: {
    fontSize: 28,
    fontWeight: '800',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modernStatsChange: {
    fontSize: 14,
    fontWeight: '600',
    flexDirection: 'row',
    alignItems: 'center',
  },
  extraInfo: {
    fontSize: 12,
    color: theme.textMuted,
    fontStyle: 'italic',
  },

  modernChartContainer: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  chartHeaderModern: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.lg,
  },
  chartTitleModern: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  chartSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
  timeframeSelectorModern: {
    flexDirection: 'row',
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: 4,
  },
  timeframeButtonModern: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    minWidth: 32,
    alignItems: 'center',
  },
  activeTimeframeButtonModern: {
    backgroundColor: theme.primary,
  },
  timeframeTextModern: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  activeTimeframeTextModern: {
    color: theme.background,
  },
  chartWrapper: {
    alignItems: 'center',
  },
  modernChart: {
    borderRadius: theme.borderRadius.lg,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
    gap: theme.spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.xs,
  },
  legendText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },

  twoColumnSection: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  halfWidthCard: {
    flex: 1,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  allocationLegend: {
    marginTop: theme.spacing.sm,
  },
  allocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  allocationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: theme.spacing.xs,
  },
  allocationText: {
    fontSize: 14,
    color: theme.textPrimary,
    flex: 1,
  },
  allocationValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textSecondary,
  },
  performanceMetrics: {
    marginTop: theme.spacing.sm,
    alignItems: 'center',
  },
  bestPerformance: {
    fontSize: 12,
    color: theme.primary,
    fontWeight: '600',
  },
  barChart: {
    borderRadius: theme.borderRadius.md,
  },

  modernSection: {
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    ...theme.shadows.medium,
  },
  modernSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  modernSectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surfaceVariant,
  },
  viewAllText: {
    fontSize: 14,
    color: theme.primary,
    fontWeight: '600',
    marginRight: 4,
  },

  modernPositionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  positionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  assetIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  assetIcon: {
    fontSize: 18,
  },
  modernPositionSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modernPositionName: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },
  positionQuantity: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  positionRight: {
    alignItems: 'flex-end',
  },
  modernPositionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  modernPositionPnl: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  positionPnlAmount: {
    fontSize: 12,
    color: theme.textSecondary,
    marginTop: 2,
  },

  modernAlertCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  unreadAlertModern: {
    backgroundColor: theme.surface,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  alertLeftModern: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  alertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modernAlertIcon: {
    fontSize: 16,
  },
  alertContentModern: {
    flex: 1,
  },
  modernAlertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  modernAlertMessage: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  alertRightModern: {
    alignItems: 'flex-end',
  },
  modernAlertTime: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginTop: 4,
  },

  strategiesGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.lg,
  },
  strategyItem: {
    alignItems: 'center',
    flex: 1,
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginHorizontal: theme.spacing.xs,
  },
  strategyDetail: {
    fontSize: 10,
    color: theme.textMuted,
    marginTop: 2,
  },
  topStrategyCard: {
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.primary + '30',
  },
  topStrategyTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  topStrategyName: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 4,
  },
  topStrategyPerformance: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});

export default DashboardScreen;

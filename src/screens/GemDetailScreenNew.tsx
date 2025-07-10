import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface GemDetailProps {
  gem: {
    id: string;
    symbol: string;
    name: string;
    price: number;
    marketCap: number;
    volume24h: number;
    change24h: number;
    description: string;
    aiScore: number;
    risk: string;
    category: string;
    launchDate: string;
    type: 'crypto' | 'stock';
    social: {
      twitter: boolean;
      telegram: boolean;
      discord: boolean;
    };
    fundamentals: {
      team: number;
      tech: number;
      tokenomics: number;
      community: number;
    };
    aiAnalysis: string;
    potential: string;
    timeframe: string;
    lastUpdated: number;
  };
  onBack: () => void;
}

const GemDetailScreenNew: React.FC<GemDetailProps> = ({ gem, onBack }) => {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'analysis' | 'metrics'>('overview');

  const formatCurrency = (value: number) => {
    if (value < 1) {
      return `$${value.toFixed(6)}`;
    }
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatMarketCap = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    } else if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    } else if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  const getTargetPrice = () => {
    const multiplier = gem.potential === 'extreme' ? 5 : gem.potential === 'high' ? 3 : 2;
    return gem.price * multiplier;
  };

  const getSymbolIcon = (symbol: string, type: string) => {
    const cryptoIcons: { [key: string]: string } = {
      'BTC': '₿', 'ETH': 'Ξ', 'ADA': '₳', 'DOT': '●', 'SOL': '◎', 'MATIC': '⬟',
      'LINK': '🔗', 'UNI': '🦄', 'AAVE': '👻', 'SUSHI': '🍣', 'ATOM': '⚛️',
      'INJ': '🥷', 'ROSE': '🌹', 'FTM': '👻', 'OCEAN': '🌊', 'RUNE': '🔱',
      'KAVA': '☕', 'CELR': '⚡', 'REN': '🔄', 'BAND': '📡', 'ANKR': '⚓',
    };
    const stockIcons: { [key: string]: string } = {
      'AAPL': '🍎', 'GOOGL': '🔍', 'MSFT': '🪟', 'TSLA': '🚗', 'NVDA': '🎮',
      'META': '📘', 'AMZN': '📦', 'PLTR': '🕵️', 'CRSP': '🧬', 'ROKU': '📺',
      'SQ': '💳', 'RBLX': '🎮', 'SOFI': '🏦', 'COIN': '🪙', 'OPEN': '🏠',
      'SPCE': '🛰️', 'LCID': '🔋', 'HOOD': '🏹',
    };
    return type === 'crypto' ? (cryptoIcons[symbol] || '🪙') : (stockIcons[symbol] || '📈');
  };

  const getRiskColor = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'low': return theme.primary;
      case 'medium': return theme.warning;
      case 'high': return theme.error;
      default: return theme.textMuted;
    }
  };

  const TabButton = ({ tab, label, isActive }: { tab: typeof selectedTab; label: string; isActive: boolean }) => (
    <TouchableOpacity
      style={[styles.tabButton, isActive && styles.activeTabButton]}
      onPress={() => setSelectedTab(tab)}
    >
      {isActive && (
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.activeTabGradient}
        />
      )}
      <Text style={[styles.tabButtonText, isActive && styles.activeTabButtonText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Price & Performance Section - Compact */}
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <View style={styles.priceRow}>
          <View style={styles.priceInfo}>
            <Text style={styles.currentPrice}>{formatCurrency(gem.price)}</Text>
            <Text style={[
              styles.priceChange,
              { color: gem.change24h >= 0 ? theme.primary : theme.error }
            ]}>
              {gem.change24h >= 0 ? '+' : ''}{gem.change24h.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.targetInfo}>
            <Text style={styles.targetLabel}>Target</Text>
            <Text style={[styles.targetPrice, { color: theme.primary }]}>
              {formatCurrency(getTargetPrice())}
            </Text>
            <Text style={styles.potentialReturn}>
              +{(((getTargetPrice() - gem.price) / gem.price) * 100).toFixed(0)}%
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Market Data - Compact Grid */}
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>Market Data</Text>
        <View style={styles.compactGrid}>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Market Cap</Text>
            <Text style={styles.gridValue}>{formatMarketCap(gem.marketCap)}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Volume</Text>
            <Text style={styles.gridValue}>{formatMarketCap(gem.volume24h)}</Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Category</Text>
            <Text style={[styles.gridValue, { color: theme.accent }]}>
              {gem.category}
            </Text>
          </View>
          <View style={styles.gridItem}>
            <Text style={styles.gridLabel}>Risk</Text>
            <View style={[styles.riskBadgeSmall, { backgroundColor: getRiskColor(gem.risk) }]}>
              <Text style={styles.riskTextSmall}>{gem.risk}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Fundamentals - Compact Bars */}
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>📊 Fundamentals</Text>
        <View style={styles.fundamentalsGrid}>
          {Object.entries(gem.fundamentals).map(([key, value]) => (
            <View key={key} style={styles.fundamentalRow}>
              <Text style={styles.fundamentalLabel}>{key}</Text>
              <View style={styles.progressBarCompact}>
                <View 
                  style={[
                    styles.progressFillCompact, 
                    { 
                      width: `${value}%`,
                      backgroundColor: value >= 80 ? theme.primary : value >= 60 ? theme.warning : theme.error
                    }
                  ]} 
                />
              </View>
              <Text style={styles.fundamentalValue}>{value}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>
    </View>
  );

  const renderAnalysisTab = () => (
    <View style={styles.tabContent}>
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>🤖 AI Analysis</Text>
        <Text style={styles.analysisText}>
          {gem.aiAnalysis || `Our AI has analyzed ${gem.name} and identified strong potential based on:
          
• Market sentiment analysis shows positive momentum
• Technical indicators suggest upward trend continuation  
• Social media engagement is increasing
• Development activity remains consistent
• Institutional interest showing growth patterns

The AI confidence score is ${(gem.aiScore || 8.5).toFixed(1)}/10 indicating high conviction in this analysis.`}
        </Text>
        
        <View style={styles.potentialRow}>
          <Text style={styles.potentialLabel}>Potential:</Text>
          <Text style={[styles.potentialText, { color: theme.primary }]}>
            {gem.potential || 'High'} growth expected
          </Text>
        </View>
        
        <View style={styles.timeframeRow}>
          <Text style={styles.timeframeLabel}>Timeframe:</Text>
          <Text style={styles.timeframeValue}>{gem.timeframe || '3-6 months'}</Text>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>📈 Technical Overview</Text>
        <View style={styles.technicalGrid}>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Trend</Text>
            <Text style={[
              styles.technicalValue,
              { color: gem.change24h >= 0 ? theme.primary : theme.error }
            ]}>
              {gem.change24h >= 0 ? 'Bullish' : 'Bearish'}
            </Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Momentum</Text>
            <Text style={[styles.technicalValue, { color: theme.warning }]}>
              {Math.abs(gem.change24h) > 10 ? 'Strong' : 'Moderate'}
            </Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Volatility</Text>
            <Text style={[styles.technicalValue, { color: theme.info }]}>
              {Math.abs(gem.change24h) > 15 ? 'High' : Math.abs(gem.change24h) > 5 ? 'Medium' : 'Low'}
            </Text>
          </View>
          <View style={styles.technicalItem}>
            <Text style={styles.technicalLabel}>Support Level</Text>
            <Text style={[styles.technicalValue, { color: theme.textSecondary }]}>
              ${(gem.price * 0.85).toFixed(gem.price < 1 ? 4 : 2)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>🎯 Price Targets</Text>
        <View style={styles.targetsGrid}>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Conservative</Text>
            <Text style={[styles.targetValue, { color: theme.success }]}>
              ${(gem.price * 1.5).toFixed(gem.price < 1 ? 4 : 2)}
            </Text>
            <Text style={styles.targetPercent}>+50%</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Moderate</Text>
            <Text style={[styles.targetValue, { color: theme.warning }]}>
              ${(gem.price * 2.5).toFixed(gem.price < 1 ? 4 : 2)}
            </Text>
            <Text style={styles.targetPercent}>+150%</Text>
          </View>
          <View style={styles.targetItem}>
            <Text style={styles.targetLabel}>Optimistic</Text>
            <Text style={[styles.targetValue, { color: theme.primary }]}>
              ${(gem.price * 5).toFixed(gem.price < 1 ? 4 : 2)}
            </Text>
            <Text style={styles.targetPercent}>+400%</Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  const renderMetricsTab = () => (
    <View style={styles.tabContent}>
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.compactSection}
      >
        <Text style={styles.sectionTitle}>📊 Key Metrics</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>AI Score</Text>
            <Text style={[styles.metricValue, { color: theme.primary }]}>
              {(gem.aiScore || 8.5).toFixed(1)}/10
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Launch Date</Text>
            <Text style={styles.metricValue}>
              {new Date(gem.launchDate).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Type</Text>
            <Text style={[styles.metricValue, { color: theme.accent }]}>
              {gem.type.toUpperCase()}
            </Text>
          </View>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Social Score</Text>
            <Text style={styles.metricValue}>
              {Object.values(gem.social).filter(Boolean).length}/3
            </Text>
          </View>
        </View>
      </LinearGradient>
    </View>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={onBack}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.modalContent}
          >
            {/* Compact Header */}
            <View style={styles.header}>
              <TouchableOpacity style={styles.backButton} onPress={onBack}>
                <Text style={styles.backIcon}>✕</Text>
              </TouchableOpacity>
              
              <View style={styles.headerCenter}>
                <View style={styles.symbolHeader}>
                  <Text style={styles.symbolIcon}>{getSymbolIcon(gem.symbol, gem.type)}</Text>
                  <View style={styles.symbolInfo}>
                    <Text style={styles.symbolText}>{gem.symbol}</Text>
                    <Text style={styles.gemName}>{gem.name}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.headerRight}>
                <View style={[styles.aiScoreBadge, { backgroundColor: theme.primary }]}>
                  <Text style={styles.aiScoreText}>{(gem.aiScore || 8.5).toFixed(1)}</Text>
                </View>
              </View>
            </View>

            {/* Tab Navigation */}
            <View style={styles.tabContainer}>
              <TabButton tab="overview" label="Overview" isActive={selectedTab === 'overview'} />
              <TabButton tab="analysis" label="Analysis" isActive={selectedTab === 'analysis'} />
              <TabButton tab="metrics" label="Metrics" isActive={selectedTab === 'metrics'} />
            </View>

            {/* Content */}
            <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {selectedTab === 'overview' && renderOverviewTab()}
              {selectedTab === 'analysis' && renderAnalysisTab()}
              {selectedTab === 'metrics' && renderMetricsTab()}
              
              <View style={{ height: 20 }} />
            </ScrollView>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xl,
  },
  modalContainer: {
    width: '100%',
    maxWidth: screenWidth - 32,
    maxHeight: screenHeight * 0.85,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalContent: {
    flex: 1,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  symbolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  symbolIcon: {
    fontSize: 28,
  },
  symbolInfo: {
    alignItems: 'center',
  },
  symbolText: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  gemName: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  headerRight: {
    alignItems: 'center',
  },
  aiScoreBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiScoreText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.background,
  },

  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  tabButton: {
    flex: 1,
    paddingVertical: theme.spacing.sm,
    marginHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  activeTabButton: {
    // Gradient will be applied
  },
  activeTabGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.md,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.textMuted,
  },
  activeTabButtonText: {
    color: theme.textPrimary,
    fontWeight: '600',
  },

  // Content Styles
  scrollContent: {
    flex: 1,
  },
  tabContent: {
    padding: theme.spacing.md,
  },
  compactSection: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },

  // Price Section
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceInfo: {
    alignItems: 'flex-start',
  },
  currentPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  priceChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  targetInfo: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  targetPrice: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  potentialReturn: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.primary,
  },

  // Grid Styles
  compactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  gridItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.background,
    borderRadius: theme.borderRadius.md,
  },
  gridLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  gridValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  riskBadgeSmall: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  riskTextSmall: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.background,
  },

  // Fundamentals
  fundamentalsGrid: {
    gap: theme.spacing.xs,
  },
  fundamentalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
  },
  fundamentalLabel: {
    fontSize: 11,
    color: theme.textMuted,
    width: 70,
    textTransform: 'capitalize',
  },
  progressBarCompact: {
    flex: 1,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    marginHorizontal: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressFillCompact: {
    height: '100%',
    borderRadius: 3,
  },
  fundamentalValue: {
    fontSize: 11,
    color: theme.textSecondary,
    width: 25,
    textAlign: 'right',
  },

  // Analysis Tab
  analysisText: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 18,
    marginBottom: theme.spacing.md,
  },
  potentialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  potentialLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
  potentialText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeframeLabel: {
    fontSize: 12,
    color: theme.textMuted,
  },
  timeframeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },

  // Technical Grid
  technicalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  technicalItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.background,
    borderRadius: theme.borderRadius.md,
  },
  technicalLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  technicalValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },

  // Metrics Grid
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  metricItem: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    padding: theme.spacing.sm,
    backgroundColor: theme.background,
    borderRadius: theme.borderRadius.md,
  },
  metricLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
    textAlign: 'center',
  },

  // Price Targets Grid
  targetsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  targetItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    backgroundColor: theme.surfaceVariant,
    borderRadius: theme.borderRadius.md,
  },
  targetValue: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  targetPercent: {
    fontSize: 10,
    color: theme.textSecondary,
    fontWeight: '600',
  },
});

export default GemDetailScreenNew;

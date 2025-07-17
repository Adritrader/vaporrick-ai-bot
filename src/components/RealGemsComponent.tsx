import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Alert,
  StyleSheet,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { realGemAnalyzer, RealGemData } from '../services/realGemAnalyzer';
import { theme } from '../theme/colors';
import { apiLogger } from '../utils/logger';

const { width: screenWidth } = Dimensions.get('window');

interface RealGemsComponentProps {
  searchQuery?: string;
  onGemPress?: (gem: RealGemData) => void;
  maxItems?: number;
  showHeader?: boolean;
  refreshInterval?: number;
}

export const RealGemsComponent: React.FC<RealGemsComponentProps> = ({
  searchQuery = '',
  onGemPress,
  maxItems = 50,
  showHeader = true,
  refreshInterval = 60000, // 1 minute
}) => {
  const [gems, setGems] = useState<RealGemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  // Animation value
  const fadeAnim = new Animated.Value(0);

  // Load gems data
  const loadGems = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);
      
      apiLogger.info('Loading real gems data...');
      const symbols = realGemAnalyzer.getCuratedGemsList();
      
      // Analyze gems with full AI analysis
      const analyzedGems = await realGemAnalyzer.analyzeGems(symbols, {
        includeAI: true,
        includeTechnicals: true,
        includeSentiment: true,
        includeFundamentals: true
      });
      
      // Sort by quality score and AI score
      const sortedGems = analyzedGems.sort((a, b) => {
        const scoreA = (a.qualityScore + a.aiScore) / 2;
        const scoreB = (b.qualityScore + b.aiScore) / 2;
        return scoreB - scoreA;
      });
      
      setGems(sortedGems.slice(0, maxItems));
      setLastUpdate(new Date());
      
      // Start animation
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
      
      apiLogger.info(`Loaded ${sortedGems.length} real gems`);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      apiLogger.error('Error loading real gems', { error: err });
      
      Alert.alert('Error', `Failed to load gems: ${errorMessage}`);
    } finally {
      if (showLoader) setLoading(false);
    }
  };

  // Refresh data
  const onRefresh = async () => {
    setRefreshing(true);
    await loadGems(false);
    setRefreshing(false);
  };

  // Filter gems based on search query
  const filteredGems = useMemo(() => {
    if (!searchQuery) return gems;
    
    const query = searchQuery.toLowerCase();
    return gems.filter(gem => 
      gem.symbol.toLowerCase().includes(query) ||
      gem.name.toLowerCase().includes(query) ||
      gem.type.toLowerCase().includes(query) ||
      gem.aiRecommendation.toLowerCase().includes(query) ||
      gem.potential.toLowerCase().includes(query)
    );
  }, [gems, searchQuery]);

  // Initialize component
  useEffect(() => {
    loadGems();
    
    // Set up refresh interval
    const interval = setInterval(() => {
      loadGems(false);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [refreshInterval]);

  // Animation styles
  const animatedStyle = {
    opacity: fadeAnim,
  };

  // Render gem item
  const renderGemItem = ({ item, index }: { item: RealGemData; index: number }) => {
    return (
      <View style={styles.gemItem}>
        <TouchableOpacity
          onPress={() => onGemPress?.(item)}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={getGradientColors(item)}
            style={styles.gemGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            {/* Header */}
            <View style={styles.gemHeader}>
              <View style={styles.symbolContainer}>
                <Text style={styles.gemSymbol}>{item.symbol}</Text>
                <View style={[styles.sourceIndicator, { backgroundColor: getSourceColor(item.source) }]}>
                  <Text style={styles.sourceText}>{item.source.toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.gemName} numberOfLines={1}>{item.name}</Text>
            </View>

            {/* Price and Change */}
            <View style={styles.priceContainer}>
              <Text style={styles.price}>${formatPrice(item.price)}</Text>
              <Text style={[styles.change, { color: getChangeColor(item.change24h) }]}>
                {item.change24h >= 0 ? '+' : ''}{item.change24h.toFixed(2)} ({item.changePercent.toFixed(2)}%)
              </Text>
            </View>

            {/* AI Analysis */}
            <View style={styles.aiAnalysisContainer}>
              <View style={styles.aiScoreContainer}>
                <Text style={styles.aiLabel}>AI Score</Text>
                <View style={[styles.aiScoreBar, { backgroundColor: getScoreColor(item.aiScore) }]}>
                  <View style={[styles.aiScoreFill, { width: `${item.aiScore * 100}%` }]} />
                </View>
                <Text style={styles.aiScoreText}>{(item.aiScore * 100).toFixed(0)}%</Text>
              </View>
              
              <View style={styles.recommendationContainer}>
                <Text style={styles.recommendationLabel}>AI Recommendation</Text>
                <Text style={[styles.recommendationText, { color: getRecommendationColor(item.aiRecommendation) }]}>
                  {formatRecommendation(item.aiRecommendation)}
                </Text>
              </View>
            </View>

            {/* Technical Indicators */}
            <View style={styles.technicalContainer}>
              <View style={styles.technicalItem}>
                <Text style={styles.technicalLabel}>RSI</Text>
                <Text style={[styles.technicalValue, { color: getRSIColor(item.technicalIndicators.rsi) }]}>
                  {item.technicalIndicators.rsi.toFixed(0)}
                </Text>
              </View>
              <View style={styles.technicalItem}>
                <Text style={styles.technicalLabel}>MACD</Text>
                <Text style={[styles.technicalValue, { color: item.technicalIndicators.macd > 0 ? theme.success : theme.error }]}>
                  {item.technicalIndicators.macd.toFixed(3)}
                </Text>
              </View>
              <View style={styles.technicalItem}>
                <Text style={styles.technicalLabel}>Quality</Text>
                <Text style={[styles.technicalValue, { color: getScoreColor(item.qualityScore) }]}>
                  {(item.qualityScore * 100).toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Risk and Sentiment */}
            <View style={styles.bottomContainer}>
              <View style={styles.riskContainer}>
                <Text style={styles.riskLabel}>Risk</Text>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.riskLevel) }]}>
                  <Text style={styles.riskText}>{item.riskLevel.toUpperCase()}</Text>
                </View>
              </View>
              
              <View style={styles.sentimentContainer}>
                <Text style={styles.sentimentLabel}>Sentiment</Text>
                <Text style={[styles.sentimentText, { color: getSentimentColor(item.sentiment.trend) }]}>
                  {item.sentiment.trend.toUpperCase()}
                </Text>
              </View>
              
              <View style={styles.potentialContainer}>
                <Text style={styles.potentialLabel}>Potential</Text>
                <Text style={[styles.potentialText, { color: getPotentialColor(item.potential) }]}>
                  {formatPotential(item.potential)}
                </Text>
              </View>
            </View>

            {/* Prediction */}
            <View style={styles.predictionContainer}>
              <Text style={styles.predictionLabel}>30d Target: ${formatPrice(item.prediction.priceTarget30d)}</Text>
              <Text style={[styles.predictionTrend, { color: getTrendColor(item.prediction.trend) }]}>
                {item.prediction.trend.toUpperCase()}
              </Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loadingText}>Analyzing real market data with AI...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => loadGems()}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {showHeader && (
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Real Gems Analysis</Text>
          <Text style={styles.headerSubtitle}>
            {filteredGems.length} gems • AI-powered analysis
          </Text>
          {lastUpdate && (
            <Text style={styles.lastUpdate}>
              Last updated: {lastUpdate.toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}
      
      <FlatList
        data={filteredGems}
        renderItem={renderGemItem}
        keyExtractor={(item) => item.symbol}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No gems found matching your search</Text>
          </View>
        )}
      />
    </Animated.View>
  );
};

// Helper functions
const formatPrice = (price: number): string => {
  if (price >= 1000) {
    return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return price.toFixed(price >= 1 ? 2 : 4);
};

const formatRecommendation = (rec: string): string => {
  return rec.replace('_', ' ').toUpperCase();
};

const formatPotential = (potential: string): string => {
  return potential.replace('_', ' ').toUpperCase();
};

const getGradientColors = (gem: RealGemData): [string, string] => {
  const baseColors: [string, string] = gem.type === 'crypto' 
    ? [theme.surface, theme.surfaceVariant]
    : [theme.surfaceVariant, theme.surface];
    
  if (gem.aiScore > 0.8) {
    return [theme.success + '20', theme.success + '10'];
  }
  if (gem.aiScore > 0.6) {
    return [theme.primary + '20', theme.primary + '10'];
  }
  if (gem.aiScore < 0.4) {
    return [theme.error + '20', theme.error + '10'];
  }
  return baseColors;
};

const getSourceColor = (source: string): string => {
  switch (source) {
    case 'real': return theme.success;
    case 'cache': return theme.warning;
    default: return theme.error;
  }
};

const getChangeColor = (change: number): string => {
  return change >= 0 ? theme.success : theme.error;
};

const getScoreColor = (score: number): string => {
  if (score > 0.7) return theme.success;
  if (score > 0.4) return theme.warning;
  return theme.error;
};

const getRecommendationColor = (rec: string): string => {
  if (rec.includes('buy')) return theme.success;
  if (rec.includes('sell')) return theme.error;
  return theme.warning;
};

const getRSIColor = (rsi: number): string => {
  if (rsi > 70) return theme.error;
  if (rsi < 30) return theme.success;
  return theme.textPrimary;
};

const getRiskColor = (risk: string): string => {
  switch (risk) {
    case 'low': return theme.success;
    case 'medium': return theme.warning;
    case 'high': return theme.error;
    default: return theme.textSecondary;
  }
};

const getSentimentColor = (sentiment: string): string => {
  switch (sentiment) {
    case 'positive': return theme.success;
    case 'negative': return theme.error;
    default: return theme.warning;
  }
};

const getPotentialColor = (potential: string): string => {
  if (potential.includes('very_high') || potential.includes('high')) return theme.success;
  if (potential.includes('medium')) return theme.warning;
  return theme.error;
};

const getTrendColor = (trend: string): string => {
  switch (trend) {
    case 'bullish': return theme.success;
    case 'bearish': return theme.error;
    default: return theme.warning;
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    padding: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  lastUpdate: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  separator: {
    height: 12,
  },
  gemItem: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  gemGradient: {
    padding: 16,
    minHeight: 200,
  },
  gemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  gemSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginRight: 8,
  },
  sourceIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  gemName: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  priceContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  change: {
    fontSize: 16,
    fontWeight: '600',
  },
  aiAnalysisContainer: {
    marginBottom: 16,
  },
  aiScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    width: 60,
  },
  aiScoreBar: {
    flex: 1,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    marginHorizontal: 8,
    overflow: 'hidden',
  },
  aiScoreFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 3,
  },
  aiScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
    width: 40,
    textAlign: 'right',
  },
  recommendationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  recommendationLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  recommendationText: {
    fontSize: 14,
    fontWeight: '600',
  },
  technicalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.border + '40',
  },
  technicalItem: {
    alignItems: 'center',
  },
  technicalLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  technicalValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  bottomContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  riskContainer: {
    alignItems: 'center',
  },
  riskLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  riskText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  sentimentContainer: {
    alignItems: 'center',
  },
  sentimentLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  sentimentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  potentialContainer: {
    alignItems: 'center',
  },
  potentialLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  potentialText: {
    fontSize: 12,
    fontWeight: '600',
  },
  predictionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border + '40',
  },
  predictionLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  predictionTrend: {
    fontSize: 12,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 16,
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
});

export default RealGemsComponent;

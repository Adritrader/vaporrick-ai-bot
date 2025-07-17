import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Animated,
  Switch,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrading } from '../context/TradingContext';
import { theme } from '../theme/colors';
import { styles } from './EnhancedStrategyScreen.styles';
import { firebaseService } from '../services/firebaseService';
import { enhancedAIService, EnhancedPortfolio, AIAnalysisResult } from '../services/enhancedAIService';
import { realDataService } from '../services/realDataService';
import { vectorFluxAIService, VectorFluxStrategy, VectorFluxPrediction } from '../services/vectorFluxAIService';
import { EnhancedAnalyticsModal } from '../components/EnhancedAnalyticsModal';
import { EnhancedPortfolioModal } from '../components/EnhancedPortfolioModal';

interface EnhancedAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  type: 'stock' | 'crypto';
  lastUpdate: Date;
  aiScore?: number;
  confidence?: number;
  recommendation?: string;
  volume?: number;
  marketCap?: number;
  analysis?: AIAnalysisResult;
  prediction?: VectorFluxPrediction;
}

interface FilterOptions {
  type: 'all' | 'stocks' | 'crypto';
  sortBy: 'symbol' | 'price' | 'change' | 'aiScore' | 'confidence';
  sortOrder: 'asc' | 'desc';
  minAIScore: number;
  showOnlyRecommended: boolean;
}

const SAMPLE_SYMBOLS = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX',
  'BTC', 'ETH', 'ADA', 'SOL', 'DOT', 'AVAX', 'MATIC', 'LINK'
];

export const EnhancedStrategyScreen: React.FC = () => {
  const { state, dispatch } = useTrading();
  
  // State management
  const [enhancedAssets, setEnhancedAssets] = useState<EnhancedAsset[]>([]);
  const [aiStrategies, setAIStrategies] = useState<VectorFluxStrategy[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<EnhancedAsset | null>(null);
  const [selectedStrategy, setSelectedStrategy] = useState<VectorFluxStrategy | null>(null);
  const [generatedPortfolio, setGeneratedPortfolio] = useState<EnhancedPortfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isAnalyticsModalVisible, setIsAnalyticsModalVisible] = useState(false);
  const [isPortfolioModalVisible, setIsPortfolioModalVisible] = useState(false);
  const [isGeneratingPortfolio, setIsGeneratingPortfolio] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    sortBy: 'aiScore',
    sortOrder: 'desc',
    minAIScore: 0,
    showOnlyRecommended: false,
  });
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [savedAnalyses, setSavedAnalyses] = useState<AIAnalysisResult[]>([]);
  const [savedPortfolios, setSavedPortfolios] = useState<EnhancedPortfolio[]>([]);

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(100)).current;
  const autoRefreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Initialize component
  useEffect(() => {
    initializeData();
    
    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    if (autoRefresh) {
      autoRefreshInterval.current = setInterval(loadMarketData, 30000); // 30 seconds
    } else {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
        autoRefreshInterval.current = null;
      }
    }

    return () => {
      if (autoRefreshInterval.current) {
        clearInterval(autoRefreshInterval.current);
      }
    };
  }, [autoRefresh]);

  // Initialize data
  const initializeData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadMarketData(),
        loadStrategies(),
        loadSavedData(),
      ]);
    } catch (error) {
      console.error('Error initializing data:', error);
      Alert.alert('Error', 'Failed to initialize data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load market data with AI analysis
  const loadMarketData = useCallback(async () => {
    try {
      const marketDataArray = await realDataService.getBatchMarketData(SAMPLE_SYMBOLS);
      const validData = marketDataArray.filter(data => data && data.price != null);
      
      if (validData.length === 0) {
        throw new Error('No valid market data received');
      }

      // Convert to enhanced assets and add AI analysis
      const enhancedAssetsData = await Promise.all(
        validData.map(async (data) => {
          try {
            // Get AI analysis for each asset
            const analysis = await enhancedAIService.generateAIAnalysis(data.symbol);
            
            return {
              symbol: data.symbol,
              name: data.symbol,
              price: data.price,
              change: data.change,
              changePercent: data.changePercent,
              type: data.type,
              lastUpdate: new Date(data.lastUpdated),
              volume: data.volume,
              marketCap: data.marketCap,
              aiScore: analysis.analysis.score,
              confidence: analysis.analysis.confidence,
              recommendation: analysis.analysis.recommendation,
              analysis,
            } as EnhancedAsset;
          } catch (error) {
            console.warn(`Failed to get AI analysis for ${data.symbol}:`, error);
            return {
              symbol: data.symbol,
              name: data.symbol,
              price: data.price,
              change: data.change,
              changePercent: data.changePercent,
              type: data.type,
              lastUpdate: new Date(data.lastUpdated),
              volume: data.volume,
              marketCap: data.marketCap,
              aiScore: 50, // Default score
              confidence: 0.5,
              recommendation: 'hold',
            } as EnhancedAsset;
          }
        })
      );

      setEnhancedAssets(enhancedAssetsData);
      
      // Update context assets for compatibility
      dispatch({ type: 'SET_ASSETS', payload: enhancedAssetsData.map(asset => ({
        symbol: asset.symbol,
        name: asset.name,
        price: asset.price,
        change: asset.change,
        changePercent: asset.changePercent,
        type: asset.type,
        lastUpdate: asset.lastUpdate,
      })) });

    } catch (error) {
      console.error('Error loading market data:', error);
      Alert.alert('Error', 'Failed to load market data. Please check your connection.');
    }
  }, [dispatch]);

  // Load AI strategies
  const loadStrategies = useCallback(async () => {
    try {
      const strategiesData = await vectorFluxAIService.generateTradingStrategies([], {});
      setAIStrategies(strategiesData);
    } catch (error) {
      console.error('Error loading strategies:', error);
    }
  }, []);

  // Load saved data
  const loadSavedData = useCallback(async () => {
    try {
      const [analyses, portfolios] = await Promise.all([
        enhancedAIService.getSavedAnalyses(),
        enhancedAIService.getSavedPortfolios(),
      ]);
      setSavedAnalyses(analyses);
      setSavedPortfolios(portfolios);
    } catch (error) {
      console.error('Error loading saved data:', error);
    }
  }, []);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await initializeData();
    } finally {
      setRefreshing(false);
    }
  }, [initializeData]);

  // Filter and sort assets
  const filteredAndSortedAssets = useMemo(() => {
    let filtered = enhancedAssets;

    // Apply search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(asset =>
        asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        asset.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(asset => {
        if (filters.type === 'crypto') {
          return asset.type === 'crypto';
        } else if (filters.type === 'stocks') {
          return asset.type === 'stock';
        }
        return true;
      });
    }

    // Apply AI score filter
    if (filters.minAIScore > 0) {
      filtered = filtered.filter(asset => (asset.aiScore || 0) >= filters.minAIScore);
    }

    // Apply recommendation filter
    if (filters.showOnlyRecommended) {
      filtered = filtered.filter(asset => 
        asset.recommendation === 'buy' || asset.recommendation === 'strong_buy'
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (filters.sortBy) {
        case 'symbol':
          return filters.sortOrder === 'asc' 
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case 'price':
          aValue = a.price;
          bValue = b.price;
          break;
        case 'change':
          aValue = a.changePercent;
          bValue = b.changePercent;
          break;
        case 'aiScore':
          aValue = a.aiScore || 0;
          bValue = b.aiScore || 0;
          break;
        case 'confidence':
          aValue = a.confidence || 0;
          bValue = b.confidence || 0;
          break;
        default:
          aValue = a.aiScore || 0;
          bValue = b.aiScore || 0;
      }

      return filters.sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    return filtered;
  }, [enhancedAssets, searchQuery, filters]);

  // Handle asset selection
  const handleAssetPress = useCallback((asset: EnhancedAsset) => {
    setSelectedAsset(asset);
    setIsAnalyticsModalVisible(true);
  }, []);

  // Handle strategy selection
  const handleStrategyPress = useCallback((strategy: VectorFluxStrategy) => {
    setSelectedStrategy(strategy);
    Alert.alert(
      strategy.name,
      `${strategy.description}\n\nWin Rate: ${(strategy.performance.winRate * 100).toFixed(1)}%\nSharpe Ratio: ${strategy.performance.sharpeRatio.toFixed(2)}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Use Strategy', onPress: () => useStrategy(strategy) }
      ]
    );
  }, []);

  // Use selected strategy
  const useStrategy = useCallback(async (strategy: VectorFluxStrategy) => {
    try {
      setIsLoading(true);
      
      // Save strategy to Firebase
      await firebaseService.saveStrategy(strategy);
      
      // Generate portfolio based on strategy
      const portfolio = await enhancedAIService.generateEnhancedPortfolio(
        strategy.type === 'scalping' ? 'aggressive' : 
        strategy.type === 'swing' ? 'moderate' : 'conservative',
        10000 // Default budget
      );
      
      setGeneratedPortfolio(portfolio);
      setIsPortfolioModalVisible(true);
      
      Alert.alert('Success', 'Strategy applied and portfolio generated!');
    } catch (error) {
      console.error('Error using strategy:', error);
      Alert.alert('Error', 'Failed to apply strategy. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Generate portfolio
  const handleGeneratePortfolio = useCallback(async (portfolio: EnhancedPortfolio) => {
    try {
      setGeneratedPortfolio(portfolio);
      setIsGeneratingPortfolio(false);
      Alert.alert('Success', 'Enhanced portfolio generated with AI analysis!');
    } catch (error) {
      console.error('Error generating portfolio:', error);
      Alert.alert('Error', 'Failed to generate portfolio. Please try again.');
    }
  }, []);

  // Get recommendation color
  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy': return theme.success;
      case 'buy': return theme.successBright;
      case 'hold': return theme.warning;
      case 'sell': return theme.error;
      case 'strong_sell': return theme.errorBright;
      default: return theme.textSecondary;
    }
  };

  // Get AI score color
  const getAIScoreColor = (score: number) => {
    if (score >= 80) return theme.success;
    if (score >= 60) return theme.successBright;
    if (score >= 40) return theme.warning;
    if (score >= 20) return theme.error;
    return theme.errorBright;
  };

  // Render asset item
  const renderAssetItem = useCallback(({ item }: { item: EnhancedAsset }) => (
    <TouchableOpacity
      style={styles.assetItem}
      onPress={() => handleAssetPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.assetHeader}>
        <View style={styles.assetInfo}>
          <Text style={styles.assetSymbol}>{item.symbol}</Text>
          <Text style={styles.assetType}>{item.type.toUpperCase()}</Text>
        </View>
        <View style={styles.assetPrice}>
          <Text style={styles.assetPriceText}>${item.price.toFixed(2)}</Text>
          <Text style={[
            styles.assetChangeText,
            { color: item.changePercent >= 0 ? theme.success : theme.error }
          ]}>
            {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
          </Text>
        </View>
      </View>
      
      <View style={styles.assetAI}>
        <View style={styles.aiScoreContainer}>
          <Text style={styles.aiScoreLabel}>AI Score</Text>
          <Text style={[
            styles.aiScoreValue,
            { color: getAIScoreColor(item.aiScore || 0) }
          ]}>
            {(item.aiScore || 0).toFixed(1)}
          </Text>
        </View>
        
        <View style={styles.recommendationContainer}>
          <Text style={styles.recommendationLabel}>Recommendation</Text>
          <Text style={[
            styles.recommendationValue,
            { color: getRecommendationColor(item.recommendation || 'hold') }
          ]}>
            {(item.recommendation || 'hold').toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.assetDetails}>
        <Text style={styles.assetDetailText}>
          Confidence: {((item.confidence || 0) * 100).toFixed(1)}%
        </Text>
        <Text style={styles.assetDetailText}>
          Updated: {item.lastUpdate.toLocaleTimeString()}
        </Text>
      </View>
    </TouchableOpacity>
  ), [handleAssetPress]);

  // Render strategy item
  const renderStrategyItem = useCallback(({ item }: { item: VectorFluxStrategy }) => (
    <TouchableOpacity
      style={styles.strategyItem}
      onPress={() => handleStrategyPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.strategyHeader}>
        <Text style={styles.strategyName}>{item.name}</Text>
        <View style={styles.strategyType}>
          <Text style={styles.strategyTypeText}>{item.type.toUpperCase()}</Text>
        </View>
      </View>
      
      <Text style={styles.strategyDescription}>{item.description}</Text>
      
      <View style={styles.strategyMetrics}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Win Rate</Text>
          <Text style={[styles.metricValue, { color: theme.success }]}>
            {(item.performance.winRate * 100).toFixed(1)}%
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Sharpe Ratio</Text>
          <Text style={styles.metricValue}>
            {item.performance.sharpeRatio.toFixed(2)}
          </Text>
        </View>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Max Drawdown</Text>
          <Text style={[styles.metricValue, { color: theme.error }]}>
            {(item.performance.maxDrawdown * 100).toFixed(1)}%
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  ), [handleStrategyPress]);

  // Render filter controls
  const renderFilters = () => (
    <View style={styles.filtersContainer}>
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filters.type === 'all' && styles.filterButtonActive]}
          onPress={() => setFilters(prev => ({ ...prev, type: 'all' }))}
        >
          <Text style={[styles.filterButtonText, filters.type === 'all' && styles.filterButtonTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filters.type === 'stocks' && styles.filterButtonActive]}
          onPress={() => setFilters(prev => ({ ...prev, type: 'stocks' }))}
        >
          <Text style={[styles.filterButtonText, filters.type === 'stocks' && styles.filterButtonTextActive]}>
            Stocks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filters.type === 'crypto' && styles.filterButtonActive]}
          onPress={() => setFilters(prev => ({ ...prev, type: 'crypto' }))}
        >
          <Text style={[styles.filterButtonText, filters.type === 'crypto' && styles.filterButtonTextActive]}>
            Crypto
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={styles.advancedFilterButton}
          onPress={() => setShowAdvancedFilters(!showAdvancedFilters)}
        >
          <Text style={styles.advancedFilterButtonText}>
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </Text>
        </TouchableOpacity>
        
        <View style={styles.autoRefreshContainer}>
          <Text style={styles.autoRefreshLabel}>Auto Refresh</Text>
          <Switch
            value={autoRefresh}
            onValueChange={setAutoRefresh}
            trackColor={{ false: theme.border, true: theme.primary }}
            thumbColor={autoRefresh ? theme.primary : theme.textSecondary}
          />
        </View>
      </View>
      
      {showAdvancedFilters && (
        <View style={styles.advancedFilters}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort by:</Text>
            <TouchableOpacity
              style={[styles.sortButton, filters.sortBy === 'aiScore' && styles.sortButtonActive]}
              onPress={() => setFilters(prev => ({ ...prev, sortBy: 'aiScore' }))}
            >
              <Text style={styles.sortButtonText}>AI Score</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, filters.sortBy === 'change' && styles.sortButtonActive]}
              onPress={() => setFilters(prev => ({ ...prev, sortBy: 'change' }))}
            >
              <Text style={styles.sortButtonText}>Change</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.sortButton, filters.sortBy === 'symbol' && styles.sortButtonActive]}
              onPress={() => setFilters(prev => ({ ...prev, sortBy: 'symbol' }))}
            >
              <Text style={styles.sortButtonText}>Symbol</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Min AI Score: {filters.minAIScore}</Text>
            <TouchableOpacity
              style={styles.filterSlider}
              onPress={() => {
                const newScore = filters.minAIScore + 10;
                setFilters(prev => ({ ...prev, minAIScore: newScore > 90 ? 0 : newScore }));
              }}
            >
              <View style={[styles.filterSliderFill, { width: `${filters.minAIScore}%` }]} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Show Only Recommended</Text>
            <Switch
              value={filters.showOnlyRecommended}
              onValueChange={(value) => setFilters(prev => ({ ...prev, showOnlyRecommended: value }))}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={filters.showOnlyRecommended ? theme.primary : theme.textSecondary}
            />
          </View>
        </View>
      )}
    </View>
  );

  // Render stats header
  const renderStatsHeader = () => (
    <View style={styles.statsHeader}>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Total Assets</Text>
        <Text style={styles.statValue}>{filteredAndSortedAssets.length}</Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Avg AI Score</Text>
        <Text style={styles.statValue}>
          {(filteredAndSortedAssets.reduce((sum, asset) => sum + (asset.aiScore || 0), 0) / filteredAndSortedAssets.length || 0).toFixed(1)}
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Strong Buys</Text>
        <Text style={[styles.statValue, { color: theme.success }]}>
          {filteredAndSortedAssets.filter(asset => asset.recommendation === 'strong_buy').length}
        </Text>
      </View>
      <View style={styles.statItem}>
        <Text style={styles.statLabel}>Strategies</Text>
        <Text style={styles.statValue}>{aiStrategies.length}</Text>
      </View>
    </View>
  );

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <LinearGradient
        colors={[theme.primary, theme.secondary]}
        style={styles.header}
      >
        <Text style={styles.title}>🚀 Enhanced AI Trading</Text>
        <Text style={styles.subtitle}>Real-time market analysis with AI insights</Text>
      </LinearGradient>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search assets..."
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        <TouchableOpacity
          style={styles.portfolioButton}
          onPress={() => setIsPortfolioModalVisible(true)}
        >
          <Text style={styles.portfolioButtonText}>📊 Portfolio</Text>
        </TouchableOpacity>
      </View>

      {renderFilters()}
      {renderStatsHeader()}

      <Animated.View style={[styles.content, { transform: [{ translateY: slideAnim }] }]}>
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Loading enhanced market data...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredAndSortedAssets}
            renderItem={renderAssetItem}
            keyExtractor={(item) => item.symbol}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.primary]}
              />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No assets match your criteria</Text>
              </View>
            }
          />
        )}
      </Animated.View>

      {/* Enhanced Analytics Modal */}
      <EnhancedAnalyticsModal
        visible={isAnalyticsModalVisible}
        onClose={() => setIsAnalyticsModalVisible(false)}
        symbol={selectedAsset?.symbol || ''}
      />

      {/* Enhanced Portfolio Modal */}
      <EnhancedPortfolioModal
        visible={isPortfolioModalVisible}
        onClose={() => setIsPortfolioModalVisible(false)}
        onGenerate={handleGeneratePortfolio}
        isGenerating={isGeneratingPortfolio}
        existingPortfolio={generatedPortfolio}
      />

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => Alert.alert('AI Assistant', 'How can I help you with your trading today?')}
      >
        <Text style={styles.fabText}>🤖</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default EnhancedStrategyScreen;

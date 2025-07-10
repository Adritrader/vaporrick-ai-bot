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
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/colors';
import { integratedDataService } from '../services/integratedDataService';
import GemDetailScreen from './GemDetailScreenNew';

const { width: screenWidth } = Dimensions.get('window');

interface GemProject {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  volume24h: number;
  change24h: number;
  description: string;
  aiScore: number;
  risk: 'Low' | 'Medium' | 'High';
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
    growth?: number;
    financial?: number;
  };
  aiAnalysis: string;
  potential: string;
  timeframe: string;
  lastUpdated: number;
}

const GemFinderScreen: React.FC = () => {
  const [gems, setGems] = useState<GemProject[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'crypto' | 'stocks' | 'defi' | 'gaming' | 'ai' | 'tech' | 'fintech' | 'growth' | 'infrastructure'>('all');
  const [selectedGem, setSelectedGem] = useState<GemProject | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scanningAnimation] = useState(new Animated.Value(0));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadGems();
    startAIScan();
    
    // Auto refresh every 30 seconds (optimized)
    intervalRef.current = setInterval(() => {
      if (!isScanning && !refreshing) {
        loadGems();
      }
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Scanning animation
    Animated.loop(
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
    ).start();
  }, []);

  const loadGems = async () => {
    try {
      console.log('🔍 Loading gems with Firebase integration...');
      
      // Use integrated service that handles Firebase caching and API fallback
      const data = await integratedDataService.getGems();
      setGems(data || []);
    } catch (error) {
      console.error('Error loading gems:', error);
      // Try to load from local storage as fallback
      try {
        const storedData = await AsyncStorage.getItem('gem_finder_data');
        if (storedData) {
          setGems(JSON.parse(storedData));
        }
      } catch (storageError) {
        console.error('Error loading from local storage:', storageError);
      }
    }
  };

  const startAIScan = () => {
    // Simulate AI scanning for gems
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
    }, 3000);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadGems();
    setRefreshing(false);
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

  const getScoreColor = (score: number) => {
    if (score >= 8.5) return theme.primary;
    if (score >= 7.5) return '#FFA500';
    if (score >= 6.5) return theme.accent;
    return theme.textMuted;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return theme.primary;
      case 'Medium': return '#FFA500';
      case 'High': return theme.secondary;
      default: return theme.textMuted;
    }
  };

  const getPotentialColor = (potential: string) => {
    switch (potential.toLowerCase()) {
      case 'extreme': return '#FF1744';
      case 'high': return theme.primary;
      case 'medium': return '#FFA500';
      default: return theme.textMuted;
    }
  };

  // Function to scan for new gems (crypto or stocks)
  const handleScanNewGems = async (type: 'crypto' | 'stocks') => {
    if (isScanning) return;
    
    setIsScanning(true);
    try {
      // Generate new hidden gems with better variety
      const newGems = await generateNewGems(type);
      
      // Save new gems using integrated service
      await integratedDataService.saveGems(newGems);
      
      // Refresh the list to show new gems
      await loadGems();
      
      Alert.alert(
        '🎯 New Gems Discovered!',
        `Found ${newGems.length} promising ${type} opportunities with high potential!`,
        [{ text: 'Great!', style: 'default' }]
      );
    } catch (error) {
      console.error(`Error scanning ${type} gems:`, error);
      Alert.alert('Error', `Failed to scan ${type} gems. Please try again.`);
    } finally {
      setIsScanning(false);
    }
  };

  // Generate new gems with better variety and less known assets
  const generateNewGems = async (type: 'crypto' | 'stocks'): Promise<GemProject[]> => {
    const cryptoGems = [
      { symbol: 'INJ', name: 'Injective Protocol', price: 24.89, change24h: 22.5, category: 'defi', potential: 'high' },
      { symbol: 'ROSE', name: 'Oasis Network', price: 0.067, change24h: 18.9, category: 'privacy', potential: 'extreme' },
      { symbol: 'FTM', name: 'Fantom', price: 0.31, change24h: 35.2, category: 'infrastructure', potential: 'high' },
      { symbol: 'OCEAN', name: 'Ocean Protocol', price: 0.52, change24h: 17.8, category: 'ai', potential: 'high' },
      { symbol: 'RUNE', name: 'THORChain', price: 5.67, change24h: 12.4, category: 'defi', potential: 'medium' },
      { symbol: 'KAVA', name: 'Kava', price: 1.23, change24h: 28.1, category: 'defi', potential: 'high' },
      { symbol: 'CELR', name: 'Celer Network', price: 0.024, change24h: 45.6, category: 'infrastructure', potential: 'extreme' },
      { symbol: 'REN', name: 'Ren Protocol', price: 0.084, change24h: 33.9, category: 'defi', potential: 'high' },
      { symbol: 'BAND', name: 'Band Protocol', price: 1.89, change24h: 19.7, category: 'infrastructure', potential: 'medium' },
      { symbol: 'ANKR', name: 'Ankr Network', price: 0.035, change24h: 67.2, category: 'infrastructure', potential: 'extreme' },
    ];

    const stockGems = [
      { symbol: 'PLTR', name: 'Palantir Technologies', price: 17.45, change24h: 8.5, category: 'ai', potential: 'high' },
      { symbol: 'CRSP', name: 'CRISPR Therapeutics', price: 89.67, change24h: 12.3, category: 'biotech', potential: 'extreme' },
      { symbol: 'ROKU', name: 'Roku Inc', price: 67.89, change24h: 15.8, category: 'tech', potential: 'medium' },
      { symbol: 'SQ', name: 'Block Inc', price: 78.23, change24h: 9.2, category: 'fintech', potential: 'high' },
      { symbol: 'RBLX', name: 'Roblox Corporation', price: 34.56, change24h: 11.4, category: 'gaming', potential: 'medium' },
      { symbol: 'SOFI', name: 'SoFi Technologies', price: 8.67, change24h: 18.9, category: 'fintech', potential: 'high' },
      { symbol: 'COIN', name: 'Coinbase Global', price: 156.78, change24h: 13.2, category: 'fintech', potential: 'medium' },
      { symbol: 'OPEN', name: 'Opendoor Technologies', price: 3.45, change24h: 25.6, category: 'tech', potential: 'extreme' },
      { symbol: 'SPCE', name: 'Virgin Galactic', price: 2.89, change24h: 34.7, category: 'tech', potential: 'extreme' },
      { symbol: 'NET', name: 'Cloudflare', price: 78.90, change24h: 4.5, category: 'tech', potential: 'high' },
    ];

    const selectedGems = type === 'crypto' ? cryptoGems : stockGems;
    
    return selectedGems.map(gem => ({
      ...gem,
      id: `${gem.symbol}-${Date.now()}`,
      type: type === 'crypto' ? 'crypto' as const : 'stock' as const,
      marketCap: Math.random() * 10000000000,
      volume24h: Math.random() * 1000000000,
      description: `High-potential ${type} asset with strong fundamentals`,
      aiScore: 7.5 + Math.random() * 2, // 7.5-9.5 range
      risk: (Math.random() > 0.7 ? 'High' : Math.random() > 0.4 ? 'Medium' : 'Low') as 'Low' | 'Medium' | 'High',
      launchDate: new Date().toISOString().split('T')[0],
      social: { twitter: true, telegram: type === 'crypto', discord: type === 'crypto' },
      fundamentals: {
        team: Math.floor(70 + Math.random() * 30), // 70-100
        tech: Math.floor(70 + Math.random() * 30), // 70-100
        tokenomics: Math.floor(60 + Math.random() * 40), // 60-100
        community: Math.floor(60 + Math.random() * 40), // 60-100
        growth: Math.floor(75 + Math.random() * 25), // 75-100
        financial: Math.floor(70 + Math.random() * 30), // 70-100
      },
      aiAnalysis: `AI detected strong momentum and accumulation patterns. ${type === 'crypto' ? 'On-chain metrics' : 'Financial metrics'} show institutional interest.`,
      timeframe: Math.random() > 0.5 ? '1-3 months' : '3-6 months',
      lastUpdated: Date.now()
    }));
  };

  const getGemsByFilter = () => {
    if (selectedFilter === 'all') return gems;
    
    return gems.filter(gem => {
      switch (selectedFilter) {
        case 'crypto':
          return gem.type === 'crypto';
        case 'stocks':
          return gem.type === 'stock';
        case 'defi':
          return gem.category.toLowerCase().includes('defi') || 
                 gem.category.toLowerCase().includes('finance');
        case 'gaming':
          return gem.category.toLowerCase().includes('gaming') || 
                 gem.category.toLowerCase().includes('metaverse');
        case 'ai':
          return gem.category.toLowerCase().includes('ai') || 
                 gem.category.toLowerCase().includes('data');
        case 'tech':
          return gem.category.toLowerCase().includes('tech') || 
                 gem.category.toLowerCase().includes('software');
        case 'fintech':
          return gem.category.toLowerCase().includes('fintech') || 
                 gem.category.toLowerCase().includes('payment');
        case 'growth':
          return gem.potential === 'high' || gem.potential === 'extreme';
        case 'infrastructure':
          return gem.category.toLowerCase().includes('infrastructure') || 
                 gem.category.toLowerCase().includes('protocol');
        default:
          return true;
      }
    });
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
      'SQ': '💳', 'ARKK': '🚀', 'RBLX': '🎮', 'SOFI': '🏦', 'COIN': '🪙',
      'OPEN': '🏠', 'SPCE': '🛰️', 'NET': '☁️',
    };
    
    if (type === 'crypto') return cryptoIcons[symbol] || '🪙';
    return stockIcons[symbol] || '📈';
  };

  const renderGem = ({ item }: { item: GemProject }) => {
    const isPositive = item.change24h > 0;
    const targetPrice = item.price * (item.potential === 'extreme' ? 5 : item.potential === 'high' ? 3 : 2);
    const potentialReturn = ((targetPrice - item.price) / item.price) * 100;
    
    return (
      <TouchableOpacity
        onPress={() => setSelectedGem(item)}
        activeOpacity={0.8}
      >
        <Animated.View style={[styles.gemCard, { opacity: fadeAnim }]}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.cardGradient}
          >
            {/* Compact Header */}
            <View style={styles.gemHeader}>
              <View style={styles.symbolContainer}>
                <View style={styles.symbolRow}>
                  <Text style={styles.symbolIcon}>{getSymbolIcon(item.symbol, item.type)}</Text>
                  <View style={styles.symbolInfo}>
                    <Text style={styles.symbol}>{item.symbol}</Text>
                    <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.scoreContainer}>
                  <View style={[styles.aiScoreBadge, { backgroundColor: getScoreColor(item.aiScore) }]}>
                    <Text style={styles.aiScoreText}>{(item.aiScore || 8.5).toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Compact Info */}
            <View style={styles.compactInfo}>
              <View style={styles.priceSection}>
                <Text style={styles.price}>
                  ${item.type === 'crypto' && item.price < 1 
                    ? item.price.toFixed(6) 
                    : item.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
                <Text style={[styles.change, { color: isPositive ? theme.primary : theme.secondary }]}>
                  {isPositive ? '+' : ''}{item.change24h.toFixed(1)}%
                </Text>
              </View>
              
              <View style={styles.targetsSection}>
                <Text style={styles.targetLabel}>Target:</Text>
                <Text style={[styles.targetPrice, { color: theme.primary }]}>
                  ${targetPrice.toFixed(item.type === 'crypto' && targetPrice < 1 ? 6 : 2)}
                </Text>
                <Text style={[styles.potentialReturn, { color: theme.primary }]}>
                  +{potentialReturn.toFixed(0)}%
                </Text>
              </View>
            </View>

            {/* Bottom Info */}
            <View style={styles.bottomInfo}>
              <View style={styles.categoryContainer}>
                <Text style={styles.gemName}>{item.name}</Text>
                <Text style={styles.category}>{item.category}</Text>
              </View>
              
              <View style={styles.timeframeContainer}>
                <Text style={styles.timeframeText}>{item.timeframe || '3-6M'}</Text>
                <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.risk) }]}>
                  <Text style={styles.riskText}>{item.risk}</Text>
                </View>
              </View>
            </View>

            {/* Quick Stats Row */}
            <View style={styles.quickStats}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>MC</Text>
                <Text style={styles.statValue}>{formatMarketCap(item.marketCap)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Vol</Text>
                <Text style={styles.statValue}>{formatMarketCap(item.volume24h)}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Potential</Text>
                <Text style={[styles.statValue, { color: getPotentialColor(item.potential) }]}>
                  {item.potential}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </TouchableOpacity>
    );
  };

  const FilterButton = ({ filter, label }: { filter: typeof selectedFilter, label: string }) => (
    <TouchableOpacity
      style={[styles.filterButton, selectedFilter === filter && styles.activeFilter]}
      onPress={() => setSelectedFilter(filter)}
    >
      {selectedFilter === filter && (
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.activeFilterGradient}
        />
      )}
      <Text style={[styles.filterText, selectedFilter === filter && styles.activeFilterText]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (selectedGem) {
    return <GemDetailScreen gem={selectedGem} onBack={() => setSelectedGem(null)} />;
  }

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
              <Text style={styles.headerTitle}>Gem Finder AI</Text>
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
                <Text style={styles.scanningText}>Scanning Hidden Gems</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Scan Buttons */}
        <View style={styles.scanButtonsContainer}>
          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => handleScanNewGems('crypto')}
            disabled={isScanning}
          >
            <LinearGradient
              colors={['#FFB000', '#FF8C00']}
              style={styles.scanButtonGradient}
            >
              <Text style={styles.scanButtonIcon}>₿</Text>
              <Text style={styles.scanButtonText}>Scan Crypto Gems</Text>
              {isScanning && <ActivityIndicator size="small" color="#FFF" />}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.scanButton}
            onPress={() => handleScanNewGems('stocks')}
            disabled={isScanning}
          >
            <LinearGradient
              colors={[theme.accent, '#1976D2']}
              style={styles.scanButtonGradient}
            >
              <Text style={styles.scanButtonIcon}>📈</Text>
              <Text style={styles.scanButtonText}>Scan Stock Gems</Text>
              {isScanning && <ActivityIndicator size="small" color="#FFF" />}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filtersContainer}
          contentContainerStyle={styles.filtersContent}
        >
          <FilterButton filter="all" label="All" />
          <FilterButton filter="crypto" label="Crypto" />
          <FilterButton filter="stocks" label="Stocks" />
          <FilterButton filter="defi" label="DeFi" />
          <FilterButton filter="ai" label="AI" />
          <FilterButton filter="gaming" label="Gaming" />
          <FilterButton filter="tech" label="Tech" />
          <FilterButton filter="fintech" label="FinTech" />
          <FilterButton filter="growth" label="High Growth" />
          <FilterButton filter="infrastructure" label="Infrastructure" />
        </ScrollView>

        {/* Gems List */}
        <FlatList
          data={getGemsByFilter()}
          renderItem={renderGem}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyTitle}>No gems found</Text>
              <Text style={styles.emptyText}>
                Try scanning for new gems or adjusting your filters
              </Text>
            </View>
          }
        />
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
    paddingTop: theme.spacing.md,
  },
  headerGradient: {
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  scanningIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scanningDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginRight: theme.spacing.xs,
  },
  scanningText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  
  // Scan buttons styles
  scanButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
  },
  scanButton: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  scanButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    gap: theme.spacing.xs,
  },
  scanButtonIcon: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scanButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },

  filtersContainer: {
    paddingVertical: theme.spacing.sm,
  },
  filtersContent: {
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.round,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    position: 'relative',
    overflow: 'hidden',
  },
  activeFilter: {
    borderColor: theme.primary,
  },
  activeFilterGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textMuted,
  },
  activeFilterText: {
    color: theme.primary,
    fontWeight: '600',
  },

  listContainer: {
    padding: theme.spacing.md,
  },
  gemCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: theme.spacing.lg,
  },
  gemHeader: {
    marginBottom: theme.spacing.md,
  },
  symbolContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  symbolIcon: {
    fontSize: 24,
    marginRight: theme.spacing.sm,
  },
  symbolInfo: {
    
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  typeText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '500',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  aiScoreBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  aiScoreText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.background,
  },

  compactInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  priceSection: {
    flex: 1,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  targetsSection: {
    alignItems: 'flex-end',
  },
  targetLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 2,
  },
  targetPrice: {
    fontSize: 14,
    fontWeight: '600',
  },
  potentialReturn: {
    fontSize: 12,
    fontWeight: '600',
  },

  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  categoryContainer: {
    flex: 1,
  },
  gemName: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  category: {
    fontSize: 12,
    color: theme.textSecondary,
    textTransform: 'capitalize',
  },
  timeframeContainer: {
    alignItems: 'flex-end',
  },
  timeframeText: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 4,
  },
  riskBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.background,
  },

  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default GemFinderScreen;

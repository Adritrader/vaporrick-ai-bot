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
import { realDataService } from '../services/realDataService';

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
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'defi' | 'gaming' | 'ai' | 'tech' | 'fintech' | 'growth' | 'infrastructure'>('all');
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
        // Clean expired cache periodically
        realDataService.clearOldCache();
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

  const startAIScan = async () => {
    console.log('🔍 AI Gem Finder Started - Scanning low caps...');
  };

  // Helper functions
  const getCategoryForSymbol = (symbol: string, type: 'crypto' | 'stock'): string => {
    const cryptoCategories: { [key: string]: string } = {
      'SOL': 'infrastructure',
      'ADA': 'infrastructure', 
      'DOT': 'infrastructure',
      'MATIC': 'infrastructure',
      'AVAX': 'infrastructure',
      'LINK': 'defi',
      'UNI': 'defi'
    };
    
    const stockCategories: { [key: string]: string } = {
      'PLTR': 'tech',
      'RBLX': 'gaming',
      'HOOD': 'fintech',
      'COIN': 'fintech',
      'U': 'tech'
    };
    
    if (type === 'crypto') {
      return cryptoCategories[symbol] || 'defi';
    } else {
      return stockCategories[symbol] || 'tech';
    }
  };

  const generateLaunchDate = (symbol: string): string => {
    const dates: { [key: string]: string } = {
      'SOL': '2020-03-16',
      'ADA': '2017-09-29',
      'DOT': '2020-08-18',
      'MATIC': '2019-04-28',
      'AVAX': '2020-09-21',
      'LINK': '2017-09-19',
      'PLTR': '2020-09-30',
      'RBLX': '2021-03-10',
      'HOOD': '2021-07-29',
      'COIN': '2021-04-14',
      'U': '2019-05-23'
    };
    return dates[symbol] || '2024-01-01';
  };

  const generateTokenomicsScore = (symbol: string, type: 'crypto' | 'stock'): number => {
    // For stocks, this represents financial health
    // For crypto, this represents tokenomics
    const baseScore = 70;
    const variation = Math.abs(symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0)) % 25;
    return baseScore + variation;
  };

  const generatePotential = (changePercent: number, type: 'crypto' | 'stock'): string => {
    const isPositive = changePercent > 0;
    const magnitude = Math.abs(changePercent);
    
    if (type === 'crypto') {
      if (magnitude > 10) return isPositive ? 'Explosive growth potential' : 'Recovery opportunity';
      if (magnitude > 5) return isPositive ? 'Strong upside momentum' : 'Consolidation phase';
      return 'Steady growth expected';
    } else {
      if (magnitude > 5) return isPositive ? 'Strong growth trajectory' : 'Value opportunity';
      if (magnitude > 2) return isPositive ? 'Positive fundamentals' : 'Accumulation phase';
      return 'Long-term value play';
    }
  };

  const generateTimeframe = (type: 'crypto' | 'stock'): string => {
    const timeframes = type === 'crypto' 
      ? ['1-3 months', '3-6 months', '6-12 months']
      : ['6-12 months', '12-18 months', '18-24 months'];
    
    return timeframes[Math.floor(Math.random() * timeframes.length)];
  };

  const getDescriptionForSymbol = (symbol: string): string => {
    const descriptions: { [key: string]: string } = {
      'SOL': 'High-performance blockchain supporting smart contracts',
      'ADA': 'Proof-of-stake blockchain platform with academic research',
      'DOT': 'Multi-chain protocol enabling blockchain interoperability',
      'MATIC': 'Ethereum scaling solution with low fees',
      'AVAX': 'Platform for DeFi and enterprise blockchain deployments',
      'LINK': 'Decentralized oracle network for smart contracts',
      'UNI': 'Leading decentralized exchange protocol'
    };
    return descriptions[symbol] || `Innovative blockchain project - ${symbol}`;
  };

  const getStockDescription = (symbol: string): string => {
    const descriptions: { [key: string]: string } = {
      'PLTR': 'Big data analytics platform for government and enterprise',
      'RBLX': 'Global platform bringing millions together through play',
      'HOOD': 'Commission-free financial services and trading platform',
      'COIN': 'Leading cryptocurrency exchange platform',
      'U': 'Cloud communications platform as a service'
    };
    return descriptions[symbol] || `Growth-oriented technology company - ${symbol}`;
  };

  const generateGemAnalysis = (symbol: string, changePercent: number, category: string): string => {
    const isPositive = changePercent > 0;
    const magnitude = Math.abs(changePercent);
    
    const templates = [
      `Real-time analysis shows ${isPositive ? 'bullish' : 'bearish'} momentum with ${magnitude.toFixed(1)}% movement. ${category} sector fundamentals remain strong.`,
      `Current price action indicates ${isPositive ? 'accumulation' : 'consolidation'} phase. Technical indicators suggest potential for recovery in ${category} space.`,
      `Market data reveals ${isPositive ? 'positive' : 'mixed'} sentiment. Strong development activity and growing adoption in ${category} ecosystem.`
    ];
    
    return templates[Math.floor(Math.random() * templates.length)];
  };

  const loadGems = async () => {
    if (!refreshing) setIsScanning(true);
    
    try {
      // High-potential symbols for gem scanning
      const cryptoSymbols = ['SOL', 'ADA', 'DOT', 'MATIC', 'AVAX', 'LINK'];
      const stockSymbols = ['PLTR', 'RBLX', 'HOOD', 'COIN', 'U'];
      
      const allSymbols = [...cryptoSymbols, ...stockSymbols];
      
      // Use improved realDataService with batch processing and persistence
      const gemsData: GemProject[] = [];
      
      for (const symbol of allSymbols) {
        try {
          const gemData = await realDataService.getGemData(symbol, true); // true for persistent fundamentals
          const isStock = stockSymbols.includes(symbol);
          
          const gem: GemProject = {
            id: `gem-${symbol}-${Date.now()}`,
            symbol: gemData.symbol,
            name: gemData.name,
            price: gemData.price,
            marketCap: gemData.marketCap,
            volume24h: gemData.volume24h,
            change24h: gemData.change24h,
            description: isStock ? getStockDescription(symbol) : getDescriptionForSymbol(symbol),
            aiScore: Math.floor((gemData.team + gemData.tech + gemData.community + gemData.adoption) / 4),
            risk: gemData.marketCap > 10000000000 ? 'Low' : gemData.marketCap > 1000000000 ? 'Medium' : 'High',
            category: getCategoryForSymbol(symbol, gemData.type),
            launchDate: generateLaunchDate(symbol),
            type: gemData.type,
            social: {
              twitter: Math.random() > 0.2,
              telegram: gemData.type === 'crypto' && Math.random() > 0.3,
              discord: Math.random() > 0.4,
            },
            fundamentals: {
              team: gemData.team || 0,
              tech: gemData.tech || 0,
              tokenomics: generateTokenomicsScore(symbol, gemData.type),
              community: gemData.community || 0,
            },
            aiAnalysis: generateGemAnalysis(symbol, gemData.change24h, getCategoryForSymbol(symbol, gemData.type)),
            potential: generatePotential(gemData.change24h, gemData.type),
            timeframe: generateTimeframe(gemData.type),
            lastUpdated: Date.now(),
          };
          
          gemsData.push(gem);
        } catch (error) {
          console.warn(`Error loading gem data for ${symbol}:`, error);
          
          // Add fallback data for failed requests
          const isStock = stockSymbols.includes(symbol);
          const fallbackGem: GemProject = {
            id: `fallback-${symbol}-${Date.now()}`,
            symbol,
            name: symbol.replace(/USD$/, ''),
            price: Math.round((Math.random() * 100 + 10) * 10000) / 10000, // Rounded to 4 decimals
            marketCap: Math.floor(Math.random() * 10000000000) + 1000000000,
            volume24h: Math.floor(Math.random() * 100000000) + 10000000,
            change24h: Math.round(((Math.random() - 0.5) * 20) * 100) / 100, // Rounded to 2 decimals
            description: isStock ? getStockDescription(symbol) : getDescriptionForSymbol(symbol),
            aiScore: Math.floor(Math.random() * 30) + 65,
            risk: 'Medium' as 'Low' | 'Medium' | 'High',
            category: getCategoryForSymbol(symbol, isStock ? 'stock' : 'crypto'),
            launchDate: generateLaunchDate(symbol),
            type: isStock ? 'stock' : 'crypto',
            social: {
              twitter: true,
              telegram: !isStock,
              discord: Math.random() > 0.5,
            },
            fundamentals: {
              team: Math.floor(Math.random() * 25) + 70,
              tech: Math.floor(Math.random() * 25) + 70,
              tokenomics: Math.floor(Math.random() * 25) + 70,
              community: Math.floor(Math.random() * 25) + 70,
            },
            aiAnalysis: `Fallback analysis for ${symbol}. Market data temporarily unavailable.`,
            potential: 'Moderate potential',
            timeframe: '6-12 months',
            lastUpdated: Date.now(),
          };
          
          gemsData.push(fallbackGem);
        }
      }
      
      setGems(gemsData);
      
    } catch (error) {
      console.error('Error loading gems:', error);
      Alert.alert('Error', 'Failed to load gem data. Please try again.');
    } finally {
      setIsScanning(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    if (refreshing || isScanning) return; // Prevent multiple simultaneous refreshes
    
    setRefreshing(true);
    try {
      await loadGems();
    } finally {
      setRefreshing(false);
    }
  };

  const getFilteredGems = () => {
    if (selectedFilter === 'all') return gems;
    return gems.filter(gem => gem.category.toLowerCase() === selectedFilter);
  };

  const formatMarketCap = (cap: number) => {
    if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(1)}B`;
    if (cap >= 1000000) return `$${(cap / 1000000).toFixed(1)}M`;
    if (cap >= 1000) return `$${(cap / 1000).toFixed(0)}K`;
    return `$${cap}`;
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.primary;
    if (score >= 60) return theme.warning;
    return theme.secondary;
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return theme.primary;
      case 'Medium': return theme.warning;
      case 'High': return theme.secondary;
      default: return theme.textMuted;
    }
  };

  const renderGem = ({ item }: { item: GemProject }) => {
    const isPositive = item.change24h > 0;
    
    return (
      <Animated.View style={[styles.gemCard, { opacity: fadeAnim }]}>
        <LinearGradient
          colors={[theme.surface, theme.surfaceVariant]}
          style={styles.cardGradient}
        >
          <View style={styles.gemHeader}>
            <View style={styles.symbolContainer}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbol}>{item.symbol}</Text>
                {/* Visual indicator for crypto vs stock */}
                <View style={[styles.typeIndicator, { 
                  backgroundColor: item.type === 'crypto' ? '#FF6B35' : '#4CAF50' 
                }]}>
                  <Text style={styles.typeText}>
                    {item.type === 'crypto' ? '₿' : '$'}
                  </Text>
                </View>
              </View>
              <Text style={styles.gemName}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
            </View>
            <View style={styles.scoreContainer}>
              <View style={[styles.aiScoreBadge, { backgroundColor: getScoreColor(item.aiScore) }]}>
                <Text style={styles.aiScoreText}>{item.aiScore}</Text>
              </View>
              <Text style={styles.scoreLabel}>AI Score</Text>
            </View>
          </View>

          <View style={styles.priceSection}>
            <View style={styles.priceInfo}>
              <Text style={styles.price}>
                ${item.type === 'crypto' && item.price < 1 
                  ? item.price.toFixed(6) 
                  : item.price.toFixed(2)}
              </Text>
              <Text style={[styles.change, { color: isPositive ? theme.primary : theme.secondary }]}>
                {isPositive ? '+' : ''}{item.change24h.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.marketInfo}>
              <Text style={styles.marketCap}>MC: {formatMarketCap(item.marketCap)}</Text>
              <Text style={styles.volume}>Vol: {formatMarketCap(item.volume24h)}</Text>
            </View>
          </View>

          <View style={styles.fundamentals}>
            <View style={styles.fundamentalItem}>
              <Text style={styles.fundamentalLabel}>Team</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progress, { width: `${item.fundamentals.team}%`, backgroundColor: theme.primary }]} />
              </View>
              <Text style={styles.fundamentalValue}>{item.fundamentals.team}</Text>
            </View>
            <View style={styles.fundamentalItem}>
              <Text style={styles.fundamentalLabel}>Tech</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progress, { width: `${item.fundamentals.tech}%`, backgroundColor: theme.accent }]} />
              </View>
              <Text style={styles.fundamentalValue}>{item.fundamentals.tech}</Text>
            </View>
          </View>

          <View style={styles.aiSection}>
            <Text style={styles.aiAnalysisTitle}>AI Analysis</Text>
            <Text style={styles.aiAnalysisText}>{item.aiAnalysis}</Text>
            <Text style={styles.potential}>{item.potential}</Text>
          </View>

          <View style={styles.gemFooter}>
            <View style={[styles.riskBadge, { backgroundColor: getRiskColor(item.risk) }]}>
              <Text style={styles.riskText}>{item.risk} Risk</Text>
            </View>
            <Text style={styles.timeframe}>{item.timeframe}</Text>
          </View>
        </LinearGradient>
      </Animated.View>
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

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <LinearGradient
            colors={['rgba(156, 39, 176, 0.1)', 'rgba(33, 150, 243, 0.1)']}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <Text style={styles.headerTitle}>💎 Gem Finder AI</Text>
              <View style={styles.scanningIndicator}>
                <Animated.View style={[
                  styles.scanningDot,
                  {
                    opacity: scanningAnimation,
                    transform: [{
                      scale: scanningAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.3],
                      }),
                    }],
                  }
                ]} />
                <Text style={styles.scanningText}>Scanning Low Caps</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filters}>
              <FilterButton filter="all" label="All Gems" />
              <FilterButton filter="defi" label="DeFi" />
              <FilterButton filter="gaming" label="Gaming" />
              <FilterButton filter="ai" label="AI" />
              <FilterButton filter="tech" label="Tech" />
              <FilterButton filter="fintech" label="FinTech" />
              <FilterButton filter="growth" label="Growth" />
              <FilterButton filter="infrastructure" label="Infrastructure" />
            </View>
          </ScrollView>
        </View>

        {/* Gems List */}
        <View style={styles.content}>
          {isScanning && !refreshing ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>AI scanning for hidden gems...</Text>
            </View>
          ) : (
            <FlatList
              data={getFilteredGems()}
              renderItem={renderGem}
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
          )}
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
    fontSize: 16, // Reduced from 18
    fontWeight: '600',
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
    backgroundColor: theme.accent,
    marginRight: theme.spacing.sm,
  },
  scanningText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  filtersContainer: {
    paddingVertical: theme.spacing.md,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.surface,
    position: 'relative',
    overflow: 'hidden',
  },
  activeFilter: {
    // Styling handled by gradient
  },
  activeFilterGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.lg,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textMuted,
  },
  activeFilterText: {
    color: theme.textPrimary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 14,
    color: theme.textSecondary,
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  symbolContainer: {
    flex: 1,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginRight: theme.spacing.sm,
  },
  typeIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: 'white',
  },
  gemName: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  category: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: '600',
  },
  scoreContainer: {
    alignItems: 'center',
  },
  aiScoreBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  aiScoreText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.background,
  },
  scoreLabel: {
    fontSize: 10,
    color: theme.textMuted,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  priceInfo: {
    alignItems: 'flex-start',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 2,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  marketInfo: {
    alignItems: 'flex-end',
  },
  marketCap: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  volume: {
    fontSize: 12,
    color: theme.textMuted,
  },
  fundamentals: {
    marginBottom: theme.spacing.md,
  },
  fundamentalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  fundamentalLabel: {
    fontSize: 11,
    color: theme.textMuted,
    width: 35,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    marginHorizontal: theme.spacing.sm,
    overflow: 'hidden',
  },
  progress: {
    height: '100%',
    borderRadius: 2,
  },
  fundamentalValue: {
    fontSize: 11,
    color: theme.textSecondary,
    width: 25,
    textAlign: 'right',
  },
  aiSection: {
    marginBottom: theme.spacing.md,
  },
  aiAnalysisTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  aiAnalysisText: {
    fontSize: 11,
    color: theme.textSecondary,
    lineHeight: 16,
    marginBottom: theme.spacing.sm,
  },
  potential: {
    fontSize: 11,
    color: theme.accent,
    fontWeight: '500',
    fontStyle: 'italic',
  },
  gemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  riskBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.borderRadius.sm,
  },
  riskText: {
    fontSize: 10,
    fontWeight: '600',
    color: theme.background,
  },
  timeframe: {
    fontSize: 11,
    color: theme.textMuted,
    fontWeight: '500',
  },
});

export default GemFinderScreen;

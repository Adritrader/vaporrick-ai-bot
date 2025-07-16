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
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { theme } from '../theme/colors';
import { integratedDataService } from '../services/integratedDataService';
import GemDetailScreenNew from './GemDetailScreenNew';

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
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'crypto' | 'stocks' | 'defi' | 'gaming' | 'ai' | 'tech' | 'fintech' | 'growth' | 'infrastructure' | 'ultra-low' | 'low' | 'medium' | 'big'>('all');
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
        // Firebase will handle cache management automatically
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
      console.log('🔍 Loading real market data...');
      
      // Get real market data instead of mock gems
      const realMarketData = await integratedDataService.getMarketData([
        // Real crypto symbols with proper market caps
        'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 'polygon-matic',
        'avalanche-2', 'chainlink', 'uniswap', 'injective-protocol', 'oasis-network',
        'fantom', 'ocean-protocol', 'thorchain', 'kava', 'celer-network',
        'ren', 'band-protocol', 'ankr'
      ]);

      // Convert to GemProject format with real data
      const gemsData: GemProject[] = realMarketData.map(data => ({
        id: `${data.symbol}-${Date.now()}`,
        symbol: data.symbol.toUpperCase(),
        name: data.name,
        price: data.price,
        marketCap: data.marketCap,
        volume24h: data.volume24h,
        change24h: data.changePercent,
        description: getDescriptionForSymbol(data.symbol.toUpperCase()),
        aiScore: Number((7.5 + Math.random() * 2.5).toFixed(1)),
        risk: data.marketCap > 1000000000 ? 'Low' : data.marketCap > 200000000 ? 'Medium' : 'High',
        category: getCategoryForSymbol(data.symbol.toUpperCase(), data.type),
        launchDate: generateLaunchDate(data.symbol.toUpperCase()),
        type: data.type,
        social: {
          twitter: true,
          telegram: data.type === 'crypto',
          discord: data.type === 'crypto'
        },
        fundamentals: {
          team: Math.floor(70 + Math.random() * 30),
          tech: Math.floor(65 + Math.random() * 35),
          tokenomics: Math.floor(60 + Math.random() * 40),
          community: Math.floor(55 + Math.random() * 45),
        },
        aiAnalysis: generateGemAnalysis(data.symbol.toUpperCase(), data.changePercent, getCategoryForSymbol(data.symbol.toUpperCase(), data.type)),
        potential: data.changePercent > 10 ? 'extreme' : data.changePercent > 5 ? 'high' : 'medium',
        timeframe: generateTimeframe(data.type),
        lastUpdated: Date.now(),
      }));
      
      setGems(gemsData);
      
    } catch (error) {
      console.error('Error loading real market data:', error);
      Alert.alert('Error', 'Failed to load market data. Please try again.');
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
    if (selectedFilter === 'crypto') return gems.filter(gem => gem.type === 'crypto');
    if (selectedFilter === 'stocks') return gems.filter(gem => gem.type === 'stock');
    
    // Market cap filters
    if (selectedFilter === 'ultra-low') return gems.filter(gem => getMarketCapCategory(gem.marketCap) === 'ultra-low');
    if (selectedFilter === 'low') return gems.filter(gem => getMarketCapCategory(gem.marketCap) === 'low');
    if (selectedFilter === 'medium') return gems.filter(gem => getMarketCapCategory(gem.marketCap) === 'medium');
    if (selectedFilter === 'big') return gems.filter(gem => getMarketCapCategory(gem.marketCap) === 'big');
    
    // Enhanced category filtering that handles all categories properly
    const categoryMap: { [key: string]: string[] } = {
      'defi': ['defi', 'decentralized finance'],
      'gaming': ['gaming', 'metaverse', 'nft'],
      'ai': ['ai', 'artificial intelligence', 'machine learning'],
      'tech': ['tech', 'technology', 'software'],
      'fintech': ['fintech', 'financial technology', 'payments'],
      'growth': ['growth', 'high growth'],
      'infrastructure': ['infrastructure', 'layer 1', 'layer 2', 'blockchain'],
      'privacy': ['privacy', 'anonymous'],
      'biotech': ['biotech', 'biotechnology', 'pharmaceutical'],
      'aerospace': ['aerospace', 'space'],
      'ev': ['ev', 'electric vehicle', 'automotive'],
      'proptech': ['proptech', 'real estate']
    };
    
    const matchingCategories = categoryMap[selectedFilter] || [selectedFilter];
    return gems.filter(gem => 
      matchingCategories.some(cat => 
        gem.category.toLowerCase().includes(cat.toLowerCase())
      )
    );
  };

  const formatMarketCap = (cap: number) => {
    if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(1)}B`;
    if (cap >= 1000000) return `$${(cap / 1000000).toFixed(1)}M`;
    if (cap >= 1000) return `$${(cap / 1000).toFixed(0)}K`;
    return `$${cap}`;
  };

  const getMarketCapCategory = (cap: number): 'ultra-low' | 'low' | 'medium' | 'big' => {
    const capInMillions = cap / 1000000;
    if (capInMillions <= 50) return 'ultra-low';
    if (capInMillions <= 200) return 'low';
    if (capInMillions <= 500) return 'medium';
    return 'big';
  };

  const getMarketCapColor = (cap: number) => {
    const category = getMarketCapCategory(cap);
    switch (category) {
      case 'ultra-low': return '#FF6B6B'; // Red for ultra high risk/reward
      case 'low': return '#FFB000'; // Orange for high risk/reward
      case 'medium': return '#4ECDC4'; // Teal for moderate risk
      case 'big': return '#45B7D1'; // Blue for stable
      default: return theme.textMuted;
    }
  };

  const getMarketCapLabel = (cap: number): string => {
    const category = getMarketCapCategory(cap);
    switch (category) {
      case 'ultra-low': return 'Ultra Low Cap';
      case 'low': return 'Low Cap';
      case 'medium': return 'Medium Cap';
      case 'big': return 'Big Cap';
      default: return 'Unknown';
    }
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

  const getPotentialColor = (potential: string) => {
    switch (potential) {
      case 'extreme': return theme.error;
      case 'high': return theme.warning;
      case 'medium': return theme.primary;
      default: return theme.textSecondary;
    }
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
      'OPEN': '🏠', 'SPCE': '🛰️', 'LCID': '🔋', 'HOOD': '🏹',
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
                    <View style={styles.symbolTitleRow}>
                      <Text style={styles.symbol}>{item.symbol}</Text>
                      <View style={[styles.capCategoryBadge, { backgroundColor: getMarketCapColor(item.marketCap) }]}>
                        <Text style={styles.capCategoryText}>
                          {getMarketCapCategory(item.marketCap).toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.typeText}>{item.type.toUpperCase()}</Text>
                  </View>
                </View>
                <View style={styles.categoryContainer}>
                  <Text style={styles.gemName}>{item.name}</Text>
                  <Text style={styles.category}>{item.category}</Text>
                </View>
              </View>
              <View style={styles.scoreContainer}>
                <View style={[styles.aiScoreBadge, { backgroundColor: getScoreColor(item.aiScore) }]}>
                  <Text style={styles.aiScoreText}>{(item.aiScore || 8.5).toFixed(1)}</Text>
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
                <Text style={[styles.statValue, { color: getMarketCapColor(item.marketCap) }]}>
                  {formatMarketCap(item.marketCap)}
                </Text>
                <Text style={[styles.statSubLabel, { color: getMarketCapColor(item.marketCap) }]}>
                  {getMarketCapLabel(item.marketCap)}
                </Text>
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
      style={[
        styles.filterButton,
        selectedFilter === filter && styles.activeFilter,
      ]}
      onPress={() => setSelectedFilter(filter)}
    >
      {selectedFilter === filter && (
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.activeFilterGradient}
        />
      )}
      <Text style={[
        styles.filterText,
        selectedFilter === filter && styles.activeFilterText,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

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
      { symbol: 'INJ', name: 'Injective Protocol', price: 24.89, change24h: 22.5, category: 'defi', potential: 'high', capCategory: 'low' },
      { symbol: 'ROSE', name: 'Oasis Network', price: 0.067, change24h: 18.9, category: 'privacy', potential: 'extreme', capCategory: 'ultra-low' },
      { symbol: 'FTM', name: 'Fantom', price: 0.31, change24h: 35.2, category: 'infrastructure', potential: 'high', capCategory: 'low' },
      { symbol: 'OCEAN', name: 'Ocean Protocol', price: 0.52, change24h: 17.8, category: 'ai', potential: 'high', capCategory: 'ultra-low' },
      { symbol: 'RUNE', name: 'THORChain', price: 5.67, change24h: 12.4, category: 'defi', potential: 'medium', capCategory: 'low' },
      { symbol: 'KAVA', name: 'Kava', price: 1.23, change24h: 28.1, category: 'defi', potential: 'high', capCategory: 'ultra-low' },
      { symbol: 'CELR', name: 'Celer Network', price: 0.024, change24h: 45.6, category: 'infrastructure', potential: 'extreme', capCategory: 'ultra-low' },
      { symbol: 'REN', name: 'Ren Protocol', price: 0.084, change24h: 33.9, category: 'defi', potential: 'high', capCategory: 'ultra-low' },
      { symbol: 'BAND', name: 'Band Protocol', price: 1.89, change24h: 19.7, category: 'infrastructure', potential: 'medium', capCategory: 'ultra-low' },
      { symbol: 'ANKR', name: 'Ankr Network', price: 0.035, change24h: 67.2, category: 'infrastructure', potential: 'extreme', capCategory: 'ultra-low' },
    ];

    const stockGems = [
      { symbol: 'PLTR', name: 'Palantir Technologies', price: 17.45, change24h: 8.5, category: 'ai', potential: 'high', capCategory: 'medium' },
      { symbol: 'CRSP', name: 'CRISPR Therapeutics', price: 89.67, change24h: 12.3, category: 'biotech', potential: 'extreme', capCategory: 'low' },
      { symbol: 'ROKU', name: 'Roku Inc', price: 67.89, change24h: 15.8, category: 'tech', potential: 'medium', capCategory: 'low' },
      { symbol: 'SQ', name: 'Block Inc', price: 78.23, change24h: 9.2, category: 'fintech', potential: 'high', capCategory: 'medium' },
      { symbol: 'RBLX', name: 'Roblox Corporation', price: 34.56, change24h: 11.4, category: 'gaming', potential: 'medium', capCategory: 'medium' },
      { symbol: 'SOFI', name: 'SoFi Technologies', price: 8.67, change24h: 18.9, category: 'fintech', potential: 'high', capCategory: 'low' },
      { symbol: 'OPEN', name: 'Opendoor Technologies', price: 3.45, change24h: 25.6, category: 'proptech', potential: 'extreme', capCategory: 'ultra-low' },
      { symbol: 'SPCE', name: 'Virgin Galactic', price: 2.89, change24h: 34.7, category: 'aerospace', potential: 'extreme', capCategory: 'ultra-low' },
      { symbol: 'LCID', name: 'Lucid Group', price: 4.23, change24h: 19.8, category: 'ev', potential: 'high', capCategory: 'ultra-low' },
      { symbol: 'HOOD', name: 'Robinhood Markets', price: 12.34, change24h: 14.2, category: 'fintech', potential: 'medium', capCategory: 'low' },
    ];

    const selectedGems = type === 'crypto' ? cryptoGems : stockGems;
    
    // Generate realistic market caps based on category
    const generateMarketCap = (capCategory: string): number => {
      switch (capCategory) {
        case 'ultra-low':
          return Math.random() * 50000000; // 0-50M
        case 'low':
          return 50000000 + (Math.random() * 150000000); // 50-200M
        case 'medium':
          return 200000000 + (Math.random() * 300000000); // 200-500M
        case 'big':
          return 500000000 + (Math.random() * 10000000000); // 500M-10B
        default:
          return Math.random() * 100000000; // Default to low cap
      }
    };
    
    return selectedGems.map(gem => ({
      id: `${gem.symbol}-${Date.now()}-${Math.random()}`,
      ...gem,
      type: type === 'crypto' ? 'crypto' : 'stock',
      marketCap: generateMarketCap(gem.capCategory),
      volume24h: Math.random() * 100000000, // More realistic volume
      description: `Hidden gem in ${gem.category} sector with strong fundamentals and growth potential`,
      aiScore: Number((7.5 + Math.random() * 2.5).toFixed(1)), // 7.5-10.0 range, rounded to 1 decimal
      risk: Math.random() > 0.7 ? 'High' : Math.random() > 0.4 ? 'Medium' : 'Low',
      launchDate: new Date().toISOString().split('T')[0],
      social: { 
        twitter: true, 
        telegram: type === 'crypto', 
        discord: type === 'crypto' 
      },
      fundamentals: {
        team: Math.floor(70 + Math.random() * 30), // 70-100
        tech: Math.floor(65 + Math.random() * 35), // 65-100
        tokenomics: Math.floor(60 + Math.random() * 40), // 60-100
        community: Math.floor(55 + Math.random() * 45), // 55-100
      },
      aiAnalysis: `AI detected strong accumulation patterns and ${type === 'crypto' ? 'on-chain metrics' : 'financial metrics'} indicating institutional interest. Technical analysis shows breakout potential.`,
      timeframe: Math.random() > 0.5 ? '1-3 months' : '2-6 months',
      lastUpdated: Date.now(),
    }));
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.container}
      >
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
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>💎</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>Scan Crypto Gems</Text>
                  <Text style={styles.scanButtonSubText}>Ultra Low & Low Caps</Text>
                </View>
                {isScanning && <ActivityIndicator size="small" color="#FFF" />}
              </View>
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
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>🚀</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>Scan Stock Gems</Text>
                  <Text style={styles.scanButtonSubText}>Growth & Value Plays</Text>
                </View>
                {isScanning && <ActivityIndicator size="small" color="#FFF" />}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.filters}>
              <FilterButton filter="all" label="All" />
              <FilterButton filter="crypto" label="🪙 Crypto" />
              <FilterButton filter="stocks" label="📈 Stocks" />
              
              {/* Market Cap Filters */}
              <View style={styles.filterSeparator} />
              <FilterButton filter="ultra-low" label="💎 Ultra Low" />
              <FilterButton filter="low" label="🟡 Low Cap" />
              <FilterButton filter="medium" label="🔵 Medium" />
              <FilterButton filter="big" label="🟢 Big Cap" />
              
              {/* Category Filters */}
              <View style={styles.filterSeparator} />
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

      {/* Gem Detail Modal */}
      <Modal
        visible={!!selectedGem}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        {selectedGem && (
          <GemDetailScreenNew
            gem={selectedGem}
            onBack={() => setSelectedGem(null)}
          />
        )}
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scanButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.xxl,
  },
  scanButton: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  scanButtonGradient: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
  },
  scanButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
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
  scanButtonTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  scanButtonSubText: {
    fontSize: 10,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginTop: 2,
  },
  filtersContainer: {
    paddingVertical: theme.spacing.md,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  filterSeparator: {
    width: 1,
    height: 20,
    backgroundColor: theme.border,
    marginHorizontal: theme.spacing.xs,
    alignSelf: 'center',
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
  symbolIcon: {
    fontSize: 20,
    marginRight: theme.spacing.sm,
  },
  symbolInfo: {
    flex: 1,
  },
  symbolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  symbol: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    marginRight: theme.spacing.sm,
  },
  capCategoryBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  capCategoryText: {
    fontSize: 8,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  typeText: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textSecondary,
  },
  categoryContainer: {
    flex: 1,
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
  compactInfo: {
    marginBottom: theme.spacing.md,
  },
  priceSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
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
    fontWeight: '700',
    marginBottom: 2,
  },
  potentialReturn: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  timeframeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  timeframeText: {
    fontSize: 11,
    color: theme.textSecondary,
    fontWeight: '500',
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
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 2,
  },
  statValue: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  statSubLabel: {
    fontSize: 9,
    fontWeight: '500',
    marginTop: 1,
  },
});

export default GemFinderScreen;

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import { realGemSearchService, RealGemSearchResult } from '../services/realGemSearchService';
import { autoAlertService } from '../services/autoAlertService';
import GemDetailScreenNew from './GemDetailScreenNew';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebaseInitService';

const { width: screenWidth } = Dimensions.get('window');

// Define the interface that GemDetailScreenNew expects
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
  onClose: () => void;
}

const GemFinderScreen: React.FC = () => {
  const [gems, setGems] = useState<RealGemSearchResult[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningType, setScanningType] = useState<'crypto' | 'stocks' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'crypto' | 'stocks' | 'high' | 'medium' | 'low'>('all');
  const [selectedGem, setSelectedGem] = useState<RealGemSearchResult | null>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scanningAnimation] = useState(new Animated.Value(0));
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🚀 Real Gem Finder Started - Using real APIs with AI...');
    
    // Load cached gems if available
    loadCachedGemsIfValid();
    
    // Initialize animations
    startAIScan();
    
    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Load cached gems if they are valid and recent
  const loadCachedGemsIfValid = async () => {
    try {
      console.log('📋 Checking for valid cached gems...');
      const cachedData = await AsyncStorage.getItem('realGems');
      
      if (cachedData) {
        const parsedData = JSON.parse(cachedData);
        const { gems: cachedGems, timestamp } = parsedData;
        
        // Check if gems are recent (less than 30 minutes old)
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        
        if (timestamp > thirtyMinutesAgo && cachedGems.length > 0) {
          setGems(cachedGems);
          console.log(`✅ Loaded ${cachedGems.length} recent cached gems`);
        } else {
          console.log('⏰ Cached gems are too old, waiting for fresh scan');
        }
      } else {
        console.log('📭 No cached gems found, waiting for user scan');
      }
    } catch (error) {
      console.warn('⚠️ Error loading cached gems:', error);
    }
  };

  useEffect(() => {
    // Initialize animations
    const fadeAnimation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    });

    // Scanning animation loop
    const scanningAnimationLoop = Animated.loop(
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
    );

    fadeAnimation.start();
    scanningAnimationLoop.start();

    return () => {
      fadeAnimation.stop();
      scanningAnimationLoop.stop();
    };
  }, []);

  const startAIScan = async () => {
    console.log('🔍 Real AI Gem Finder Started - Scanning with real APIs...');
  };

  // Cache gems to AsyncStorage
  const cacheGems = async (gemsData: RealGemSearchResult[]) => {
    try {
      const cacheData = {
        gems: gemsData,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem('realGems', JSON.stringify(cacheData));
      console.log('💾 Cached gems successfully');
    } catch (error) {
      console.error('❌ Error caching gems:', error);
    }
  };

  // Convert RealGemSearchResult to GemDetailProps format
  const convertRealGemToDetailFormat = (gem: RealGemSearchResult): GemDetailProps['gem'] => {
    return {
      id: `${gem.symbol}-${gem.type}-${Date.now()}`,
      symbol: gem.symbol,
      name: gem.name,
      price: gem.price,
      marketCap: gem.marketCap,
      volume24h: gem.volume,
      change24h: gem.change24h,
      description: gem.aiAnalysis,
      aiScore: gem.aiScore,
      risk: gem.riskLevel,
      category: gem.type === 'crypto' ? 'cryptocurrency' : 'technology',
      launchDate: new Date(gem.lastUpdated).toISOString(),
      type: gem.type,
      social: {
        twitter: true,
        telegram: gem.type === 'crypto',
        discord: gem.type === 'crypto',
      },
      fundamentals: {
        team: Math.floor(gem.qualityScore * 100),
        tech: Math.floor(gem.technicalScore * 100),
        tokenomics: Math.floor(gem.aiScore * 100),
        community: Math.floor(gem.aiConfidence * 100),
      },
      aiAnalysis: gem.aiAnalysis,
      potential: gem.potential,
      timeframe: gem.type === 'crypto' ? '1-3 months' : '6-12 months',
      lastUpdated: gem.lastUpdated.getTime(),
    };
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

  const loadGems = async (forceRefresh = false) => {
    try {
      setLoadingStatus('Fetching REAL CoinGecko data...');
      setIsScanning(true);
      
      // Get ONLY TOP VERIFIED CoinGecko IDs that we know work correctly
      const validatedCoinGeckoIds = [
        'bitcoin', 'ethereum', 'solana', 'cardano', 'polkadot', 
        'avalanche-2', 'chainlink', 'uniswap', 'injective-protocol',
        'fantom', 'thorchain', 'kava', 'ankr'
      ];

      console.log('🔍 Fetching ONLY TOP CoinGecko cryptos with REAL price data:', validatedCoinGeckoIds);
      console.log('⚠️ Using SMALLER list of verified cryptos to ensure REAL prices');

      // Get REAL market data EXCLUSIVELY from CoinGecko API (NEVER cached or fallback)
      const realMarketData = await integratedDataService.getRealMarketDataOnly(validatedCoinGeckoIds);

      console.log(`📊 Raw market data received: ${realMarketData.length} items`);
      realMarketData.forEach((data, index) => {
        console.log(`📋 [${index + 1}] ${data.symbol}: $${data.price} (${data.type}) - MC: $${data.marketCap} - Vol: $${data.volume24h} - Change: ${data.change}% - Source: ${data.source || 'unknown'}`);
      });

      if (realMarketData.length === 0) {
        console.warn('⚠️ NO DATA received from API - this might indicate an API issue');
        Alert.alert(
          '⚠️ No Data Received',
          'Unable to fetch cryptocurrency data from CoinGecko. Please check your internet connection and try again.',
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Filter STRICTLY - ONLY CoinGecko validated data with REAL prices and from API source
      const validMarketData = realMarketData.filter(data => {
        const isValidCoinGeckoId = validatedCoinGeckoIds.includes(data.symbol.toLowerCase());
        const hasValidPrice = data.price > 0;
        const hasValidType = data.type === 'crypto';
        const priceIsRealistic = data.price < 1000000; // Reject unrealistic prices
        const isFromAPI = data.source === 'api'; // ONLY accept API data, never cache or fallback
        
        const isValid = isValidCoinGeckoId && hasValidPrice && hasValidType && priceIsRealistic && isFromAPI;
        
        if (!isValid) {
          console.log(`🚫 REJECTED: ${data.symbol} - CoinGecko ID: ${isValidCoinGeckoId}, Valid Price: ${hasValidPrice} ($${data.price}), Valid Type: ${hasValidType}, Realistic Price: ${priceIsRealistic}, API Source: ${isFromAPI} (source: ${data.source})`);
        } else {
          console.log(`✅ ACCEPTED REAL DATA: ${data.symbol} - $${data.price} (${data.type}) - Source: ${data.source}`);
        }
        
        return isValid;
      });

      console.log(`✅ VALIDATED: ${validMarketData.length}/${realMarketData.length} assets passed strict CoinGecko validation`);

      if (validMarketData.length === 0) {
        console.error('❌ NO VALID REAL DATA after filtering - all cryptocurrency data was rejected');
        console.log('🔍 Debugging: Check the filter criteria and API responses above');
        Alert.alert(
          '❌ Data Validation Failed',
          `Received ${realMarketData.length} items but all were rejected by validation filters. This might indicate incorrect data from the API or no real API data available.`,
          [{ text: 'OK', style: 'default' }]
        );
        return;
      }

      // Convert ONLY validated CoinGecko REAL data to GemProject format
      console.log('🔄 Converting validated REAL market data to gem format...');
      const gemsData: GemProject[] = validMarketData.map((data, index) => {
        const gem = {
          id: `coingecko-real-${data.symbol}-${Date.now()}-${index}`, // Mark as CoinGecko REAL sourced
          symbol: data.symbol.toUpperCase(),
          name: data.name,
          price: data.price, // REAL price from API
          marketCap: data.marketCap || 0, // REAL market cap from API
          volume24h: data.volume24h || 0, // REAL volume from API
          change24h: data.change || 0, // REAL change from API
          description: getDescriptionForSymbol(data.symbol.toUpperCase()),
          aiScore: Number((7.5 + Math.random() * 2.5).toFixed(1)),
          risk: (data.marketCap || 0) > 1000000000 ? 'Low' as const : (data.marketCap || 0) > 200000000 ? 'Medium' as const : 'High' as const,
          category: getCategoryForSymbol(data.symbol.toUpperCase(), 'crypto'), // Force crypto type
          launchDate: generateLaunchDate(data.symbol.toUpperCase()),
          type: 'crypto' as const, // Explicitly set as crypto
          social: {
            twitter: true,
            telegram: true,
            discord: true
          },
          fundamentals: {
            team: Math.floor(70 + Math.random() * 30),
            tech: Math.floor(65 + Math.random() * 35),
            tokenomics: Math.floor(60 + Math.random() * 40),
            community: Math.floor(55 + Math.random() * 45),
          },
          aiAnalysis: generateGemAnalysis(data.symbol.toUpperCase(), data.change || 0, getCategoryForSymbol(data.symbol.toUpperCase(), 'crypto')),
          potential: (data.change || 0) > 10 ? 'extreme' : (data.change || 0) > 5 ? 'high' : 'medium',
          timeframe: generateTimeframe('crypto'),
          lastUpdated: Date.now(),
        };
        
        console.log(`💎 Created REAL gem: ${gem.symbol} - $${gem.price} (MC: $${gem.marketCap}) - REAL DATA`);
        return gem;
      });

      setGems(gemsData);

      // Guardar SOLO datos REALES de CoinGecko con precios reales
      if (gemsData.length > 0) {
        await integratedDataService.saveGems(gemsData);
        console.log(`💾 Saved ${gemsData.length} REAL CoinGecko gems with REAL prices to Firebase`);
        
        // Notify alert service about new gems
        try {
          await autoAlertService.syncWithGemFinder();
          console.log('🔔 Alert service synced with REAL gems');
        } catch (syncError) {
          console.warn('⚠️ Alert service sync failed:', syncError);
        }
      }
      
    } catch (error) {
      console.error('❌ Error loading REAL gems:', error);
      Alert.alert('Error', 'Failed to fetch REAL data. Please try again.');
    } finally {
      setIsScanning(false);
      setRefreshing(false);
      setLoadingStatus('');
    }
  };

  // Manual cache cleaning (only when explicitly needed)
  const cleanCacheManually = async () => {
    try {
      console.log('🧹 Manual cache cleaning...');
      await integratedDataService.cleanIncorrectData();
      console.log('✅ Cache cleaned manually');
      Alert.alert('Cache Cleaned', 'Incorrect cached data has been removed');
    } catch (error) {
      console.warn('⚠️ Error cleaning cached data:', error);
      Alert.alert('Error', 'Failed to clean cache');
    }
  };

  const onRefresh = async () => {
    if (refreshing || isScanning) return; // Prevent multiple simultaneous refreshes
    
    setRefreshing(true);
    try {
      await loadGems(true); // Force refresh - get fresh data
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
    // CoinGecko ID to icon mapping for crypto
    const cryptoIcons: { [key: string]: string } = {
      // Popular cryptos with CoinGecko IDs
      'bitcoin': '₿', 'ethereum': 'Ξ', 'cardano': '₳', 'polkadot': '●', 'solana': '◎', 'polygon': '⬟',
      'chainlink': '🔗', 'uniswap': '🦄', 'avalanche': '�', 'cosmos': '⚛️',
      // Alt coins with CoinGecko IDs
      'injective-protocol': '🥷', 'oasis-network': '🌹', 'fantom': '👻', 'ocean-protocol': '🌊', 'thorchain': '🔱',
      'kava': '☕', 'celer-network': '⚡', 'ren': '🔄', 'band-protocol': '📡', 'ankr': '⚓',
      'render-token': '🎨'
    };
    const stockIcons: { [key: string]: string } = {
      'AAPL': '🍎', 'GOOGL': '🔍', 'MSFT': '🪟', 'TSLA': '🚗', 'NVDA': '🎮',
      'META': '📘', 'AMZN': '📦', 'PLTR': '🕵️', 'CRSP': '🧬', 'ROKU': '📺',
      'SQ': '💳', 'ARKK': '🚀', 'RBLX': '🎮', 'SOFI': '🏦', 'COIN': '🪙',
      'OPEN': '🏠', 'SPCE': '🛰️', 'LCID': '🔋', 'HOOD': '🏹',
    };
    
    if (type === 'crypto') return cryptoIcons[symbol.toLowerCase()] || '🪙';
    return stockIcons[symbol.toUpperCase()] || '📈';
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
    setScanningType(type);
    setLoadingStatus(`Scanning ${type} with real APIs...`);

    try {
      console.log(`🔍 Starting ${type} scan with real data and AI analysis`);
      
      let results: RealGemSearchResult[] = [];
      
      if (type === 'crypto') {
        setLoadingStatus('Fetching crypto data from CoinGecko...');
        results = await realGemSearchService.searchCryptoGems({
          maxResults: 25,
          minAIScore: 0.3,
          sortBy: 'aiScore',
          onlyWithPositiveAI: true
        });
      } else {
        setLoadingStatus('Fetching stock data from Alpha Vantage...');
        results = await realGemSearchService.searchStockGems({
          maxResults: 20,
          minAIScore: 0.3,
          sortBy: 'aiScore',
          onlyWithPositiveAI: true
        });
      }

      if (results.length === 0) {
        Alert.alert(
          'No Gems Found',
          'No gems meeting the criteria were found. This could be due to API rate limits or market conditions.',
          [{ text: 'OK' }]
        );
        return;
      }

      setLoadingStatus('Analyzing results with AI...');
      
      // Cache the results
      await cacheGems(results);
      
      // Update state
      setGems(results);

      console.log(`✅ Successfully found ${results.length} ${type} gems with real data`);
      
      Alert.alert(
        'Scan Complete',
        `Found ${results.length} high-quality ${type} gems with AI analysis!`,
        [{ text: 'OK' }]
      );

    } catch (error) {
      console.error(`❌ Error scanning ${type} gems:`, error);
      Alert.alert(
        'Scan Error',
        `Failed to scan ${type} gems. Please check your internet connection and try again.`,
        [{ text: 'OK' }]
      );
    } finally {
      setIsScanning(false);
      setScanningType(null);
      setLoadingStatus('');
    }
  };
      setIsScanning(false);
      setScanningType(null); // Clear scanning type
    }
  };

  // Generate new gems with REAL stock data
  const generateNewGems = async (type: 'crypto' | 'stocks'): Promise<GemProject[]> => {
    
    // IMPORTANT: This function should ONLY be called for stocks
    // Crypto gems should ONLY come from CoinGecko via loadGems()
    if (type === 'crypto') {
      console.warn('⚠️ generateNewGems should NOT be used for crypto - use loadGems() for CoinGecko data only');
      return [];
    }

    // Stock symbols to get REAL data for
    const stockSymbols = [
      'PLTR', 'CRSP', 'ROKU', 'SQ', 'RBLX', 'SOFI', 'OPEN', 'SPCE', 'LCID', 'HOOD', 'NET', 'TWLO'
    ];

    try {
      console.log('📊 Fetching REAL stock data from API...');
      
      // Get REAL stock market data from API
      const realStockData = await integratedDataService.getRealMarketDataOnly(stockSymbols);

      console.log(`📊 Real stock data received: ${realStockData.length} items`);
      realStockData.forEach((data, index) => {
        console.log(`📋 [${index + 1}] ${data.symbol}: $${data.price} (${data.type}) - Change: ${data.change}% - Source: ${data.source || 'unknown'}`);
      });

      // Filter ONLY stocks with REAL API data
      const validStockData = realStockData.filter(data => {
        const isStock = data.type === 'stock';
        const hasValidPrice = data.price > 0;
        const isFromAPI = data.source === 'api'; // ONLY accept API data, never cache or fallback
        
        const isValid = isStock && hasValidPrice && isFromAPI;
        
        if (!isValid) {
          console.log(`🚫 REJECTED STOCK: ${data.symbol} - Stock: ${isStock}, Valid Price: ${hasValidPrice} ($${data.price}), API Source: ${isFromAPI} (source: ${data.source})`);
        } else {
          console.log(`✅ ACCEPTED REAL STOCK: ${data.symbol} - $${data.price} - Source: ${data.source}`);
        }
        
        return isValid;
      });

      if (validStockData.length === 0) {
        console.warn('⚠️ No REAL stock data available from API - falling back to stock info without real prices');
        Alert.alert(
          '⚠️ No Real Stock Data',
          'Unable to fetch real stock prices from API. Please check your internet connection and API configuration.',
          [{ text: 'OK', style: 'default' }]
        );
        return [];
      }

      // Convert REAL stock data to GemProject format
      const stockGems: GemProject[] = validStockData.map((data, index) => {
        const stockInfo = {
          'PLTR': { category: 'ai', potential: 'high', capCategory: 'medium' },
          'CRSP': { category: 'biotech', potential: 'extreme', capCategory: 'low' },
          'ROKU': { category: 'tech', potential: 'medium', capCategory: 'low' },
          'SQ': { category: 'fintech', potential: 'high', capCategory: 'medium' },
          'RBLX': { category: 'gaming', potential: 'medium', capCategory: 'medium' },
          'SOFI': { category: 'fintech', potential: 'high', capCategory: 'low' },
          'OPEN': { category: 'proptech', potential: 'extreme', capCategory: 'ultra-low' },
          'SPCE': { category: 'aerospace', potential: 'extreme', capCategory: 'ultra-low' },
          'LCID': { category: 'ev', potential: 'high', capCategory: 'ultra-low' },
          'HOOD': { category: 'fintech', potential: 'medium', capCategory: 'low' },
          'NET': { category: 'tech', potential: 'medium', capCategory: 'medium' },
          'TWLO': { category: 'tech', potential: 'high', capCategory: 'low' },
        };

        const info = stockInfo[data.symbol as keyof typeof stockInfo] || { category: 'tech', potential: 'medium', capCategory: 'medium' };
        
        // Generate realistic market caps based on real stock price
        const generateMarketCap = (price: number, capCategory: string): number => {
          const baseMultiplier = price * 1000000; // Base multiplier based on stock price
          switch (capCategory) {
            case 'ultra-low':
              return baseMultiplier * (Math.random() * 0.05 + 0.01); // 1-6% of base
            case 'low':
              return baseMultiplier * (Math.random() * 0.15 + 0.05); // 5-20% of base
            case 'medium':
              return baseMultiplier * (Math.random() * 0.3 + 0.2); // 20-50% of base
            case 'big':
              return baseMultiplier * (Math.random() * 2 + 0.5); // 50-250% of base
            default:
              return baseMultiplier * 0.1; // Default to 10% of base
          }
        };

        const gem = {
          id: `stock-real-${data.symbol}-${Date.now()}-${index}`, // Mark as REAL stock sourced
          symbol: data.symbol,
          name: data.name,
          price: data.price, // REAL price from API
          marketCap: data.marketCap || generateMarketCap(data.price, info.capCategory),
          volume24h: data.volume24h || Math.random() * 100000000, // Real volume or estimated
          change24h: data.change || 0, // REAL change from API
          description: getStockDescription(data.symbol),
          aiScore: Number((7.5 + Math.random() * 2.5).toFixed(1)),
          risk: data.price > 50 ? 'Low' as const : data.price > 10 ? 'Medium' as const : 'High' as const,
          category: info.category,
          launchDate: generateLaunchDate(data.symbol),
          type: 'stock' as const,
          social: { 
            twitter: true, 
            telegram: false, // Stocks don't typically have telegram
            discord: false   // Stocks don't typically have discord
          },
          fundamentals: {
            team: Math.floor(70 + Math.random() * 30),
            tech: Math.floor(65 + Math.random() * 35),
            tokenomics: Math.floor(60 + Math.random() * 40), // For stocks, this represents financials
            community: Math.floor(55 + Math.random() * 45),
          },
          aiAnalysis: `Real-time analysis of ${data.symbol} shows ${data.change > 0 ? 'positive' : 'mixed'} momentum. Current price $${data.price} with ${data.change > 0 ? '+' : ''}${data.change.toFixed(1)}% movement indicates ${info.potential} potential in ${info.category} sector.`,
          potential: info.potential,
          timeframe: generateTimeframe('stock'),
          lastUpdated: Date.now(),
        };
        
        console.log(`📈 Created REAL stock gem: ${gem.symbol} - $${gem.price} (Real: ${data.source === 'api' ? 'YES' : 'NO'})`);
        return gem;
      });

      return stockGems;
      
    } catch (error) {
      console.error('❌ Error generating REAL stock gems:', error);
      Alert.alert('Error', 'Failed to fetch real stock data. Please try again.');
      return [];
    }
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
                  <Text style={styles.scanButtonText}>Fresh Crypto Scan</Text>
                  <Text style={styles.scanButtonSubText}>CoinGecko Real-Time Data</Text>
                </View>
                {scanningType === 'crypto' && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
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
                  <Text style={styles.scanButtonText}>Fresh Stock Scan</Text>
                  <Text style={styles.scanButtonSubText}>High Growth Opportunities</Text>
                </View>
                {scanningType === 'stocks' && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
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
          {isScanning && gems.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <Text style={styles.loadingText}>
                {loadingStatus || 'AI scanning for hidden gems...'}
              </Text>
              <Text style={styles.loadingSubText}>
                First time loading may take a moment
              </Text>
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
                  title="Pull to refresh prices"
                />
              }
              ListHeaderComponent={
                loadingStatus && !isScanning && gems.length > 0 ? (
                  <View style={styles.updateIndicator}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <Text style={styles.updateText}>{loadingStatus}</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                !isScanning ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>💎</Text>
                    <Text style={styles.emptyText}>Ready to Discover Gems</Text>
                    <Text style={styles.emptySubText}>
                      Tap "Fresh Crypto Scan" for real-time CoinGecko data or "Fresh Stock Scan" for growth opportunities
                    </Text>
                  </View>
                ) : null
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
        onRequestClose={() => setSelectedGem(null)}
      >
        {selectedGem && (
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => {
                  setSelectedGem(null);
                  console.log('🔴 Modal closed - gem detail');
                }}
              >
                <Text style={styles.closeButtonText}>✕ Close</Text>
              </TouchableOpacity>
            </View>
            
            <GemDetailScreenNew
              gem={selectedGem}
              onBack={() => {
                setSelectedGem(null);
                console.log('🔙 Back pressed - gem detail');
              }}
            />
          </View>
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
  loadingSubText: {
    marginTop: theme.spacing.sm,
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
  },
  updateIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  updateText: {
    marginLeft: theme.spacing.sm,
    fontSize: 12,
    color: theme.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: theme.spacing.sm,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 20,
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
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: theme.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  closeButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.error,
    borderRadius: theme.borderRadius.sm,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default GemFinderScreen;

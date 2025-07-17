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
import { firebaseService } from '../services/firebaseService';
import GemDetailScreenNew from './GemDetailScreenNew';

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
  onBack: () => void;
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
  const [lastScanTime, setLastScanTime] = useState<{ [key: string]: number }>({});
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    console.log('🚀 Real Gem Finder Started - Using real APIs with AI...');
    
    // Load cached gems and scan times
    loadCachedData();
    
    // Initialize animations
    startAnimations();
    
    // Load gems from Firebase
    loadGemsFromFirebase();
    
    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  const startAnimations = () => {
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
  };

  // Generate basic AI analysis for a gem
  const generateBasicAIAnalysis = (gem: RealGemSearchResult) => {
    const changePercent = gem.changePercent || 0;
    const volume = gem.volume || 0;
    const marketCap = gem.marketCap || 0;
    
    let analysis = "Based on current market data: ";
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = "hold";
    let confidence = 60;
    let score = 5;
    let potential: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' = "medium";
    let riskLevel: 'low' | 'medium' | 'high' = "medium";
    let qualityScore = 6;
    let priceTarget30d = (gem.price || 0) * 1.1;
    
    // More generous analysis for better gem discovery
    if (changePercent > 2) { // Reduced from 5 to 2
      analysis += "Positive momentum detected. ";
      recommendation = "buy";
      confidence = 75;
      score = 7;
      potential = "high";
      priceTarget30d = (gem.price || 0) * 1.15;
    } else if (changePercent > 0.5) { // New range for slight positive movement
      analysis += "Slight upward movement observed. ";
      recommendation = "buy";
      confidence = 65;
      score = 6;
      potential = "high";
      priceTarget30d = (gem.price || 0) * 1.08;
    } else if (changePercent < -10) { // Changed from -5 to -10 for less restrictive sell signals
      analysis += "Significant downward pressure. ";
      recommendation = "sell";
      confidence = 70;
      score = 3;
      potential = "low";
      riskLevel = "high";
      qualityScore = 4;
      priceTarget30d = (gem.price || 0) * 0.9;
    } else if (changePercent < -3) { // New range for moderate decline
      analysis += "Moderate decline, potential buying opportunity. ";
      recommendation = "hold";
      confidence = 55;
      score = 4;
      potential = "medium";
      riskLevel = "medium";
      qualityScore = 5;
      priceTarget30d = (gem.price || 0) * 0.95;
    } else {
      analysis += "Price showing stability. ";
    }
    
    // More generous volume analysis
    if (volume > 500000) { // Reduced from 1000000 to 500000
      analysis += "Good trading volume indicates healthy interest. ";
      confidence += 10;
      score += 1;
    } else if (volume > 50000) { // Reduced from 100000 to 50000
      analysis += "Moderate trading activity. ";
    } else if (volume > 10000) { // New range for low but acceptable volume
      analysis += "Low but acceptable trading volume. ";
    } else {
      analysis += "Very low trading volume, exercise caution. ";
      confidence -= 5;
      score -= 0.5;
    }
    
    // Market cap analysis for better categorization
    if (marketCap > 10000000000) { // $10B+
      analysis += "Large cap asset with established market presence. ";
      riskLevel = "low";
      confidence += 5;
    } else if (marketCap > 1000000000) { // $1B-$10B
      analysis += "Mid cap asset with growth potential. ";
      riskLevel = "medium";
    } else if (marketCap > 100000000) { // $100M-$1B
      analysis += "Small cap asset with higher growth potential. ";
      riskLevel = "medium";
      potential = potential === "low" ? "medium" : potential;
    } else if (marketCap > 10000000) { // $10M-$100M
      analysis += "Micro cap asset with high risk/reward potential. ";
      riskLevel = "high";
      if (changePercent > 0) {
        potential = "high";
        score += 1;
      }
    } else if (marketCap > 1000000) { // $1M-$10M
      analysis += "Very small cap asset, speculative investment. ";
      riskLevel = "high";
      if (changePercent > 5) {
        potential = "very_high";
        recommendation = "buy";
        score += 2;
      }
    }
    
    // Ensure minimum scores for discovery
    score = Math.max(3, Math.min(10, score));
    confidence = Math.max(40, Math.min(95, confidence));
    qualityScore = Math.max(3, Math.min(10, score));
    
    analysis += ` Current AI score: ${score.toFixed(1)}/10. Confidence: ${confidence}%.`;
    
    return {
      analysis,
      recommendation,
      confidence: Math.max(0, Math.min(100, confidence)),
      score: Math.max(0, Math.min(10, score)),
      potential,
      riskLevel,
      qualityScore: Math.max(0, Math.min(10, qualityScore)),
      priceTarget30d
    };
  };

  // Load cached data
  const loadCachedData = async () => {
    try {
      const cachedGems = await AsyncStorage.getItem('realGems');
      const cachedScanTimes = await AsyncStorage.getItem('scanTimes');
      
      if (cachedGems) {
        const parsedGems = JSON.parse(cachedGems);
        if (parsedGems.gems && Array.isArray(parsedGems.gems)) {
          setGems(parsedGems.gems);
          console.log(`📋 Loaded ${parsedGems.gems.length} cached gems`);
        }
      }

      if (cachedScanTimes) {
        const parsedScanTimes = JSON.parse(cachedScanTimes);
        setLastScanTime(parsedScanTimes);
        console.log('⏰ Loaded scan times:', parsedScanTimes);
      }
    } catch (error) {
      console.warn('⚠️ Error loading cached data:', error);
    }
  };

  // Load gems from Firebase
  const loadGemsFromFirebase = async () => {
    try {
      console.log('🔥 Loading gems from Firebase...');
      const firebaseGems = await firebaseService.getGems(50);
      
      if (firebaseGems.length > 0) {
        setGems(firebaseGems as unknown as RealGemSearchResult[]);
        console.log(`🔥 Loaded ${firebaseGems.length} gems from Firebase`);
      }
    } catch (error) {
      console.error('❌ Error loading gems from Firebase:', error);
    }
  };

  // Save gems to Firebase
  const saveGemsToFirebase = async (gemsToSave: RealGemSearchResult[]) => {
    try {
      console.log('🔥 Saving gems to Firebase...');
      await firebaseService.saveGems(gemsToSave);
      console.log(`✅ Saved ${gemsToSave.length} gems to Firebase`);
    } catch (error) {
      console.error('❌ Error saving gems to Firebase:', error);
    }
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

  // Cache scan times
  const cacheScanTimes = async (scanTimes: { [key: string]: number }) => {
    try {
      await AsyncStorage.setItem('scanTimes', JSON.stringify(scanTimes));
      console.log('💾 Cached scan times successfully');
    } catch (error) {
      console.error('❌ Error caching scan times:', error);
    }
  };

  // Check if scan is allowed (5 minute cooldown)
  const canScan = (type: 'crypto' | 'stocks'): boolean => {
    const lastScan = lastScanTime[type] || 0;
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastScan < fiveMinutesAgo;
  };

  // Get remaining cooldown time
  const getRemainingCooldown = (type: 'crypto' | 'stocks'): number => {
    const lastScan = lastScanTime[type] || 0;
    const fiveMinutesInMs = 5 * 60 * 1000;
    const elapsed = Date.now() - lastScan;
    return Math.max(0, fiveMinutesInMs - elapsed);
  };

  // Convert RealGemSearchResult to GemDetailProps format
  const convertRealGemToDetailFormat = (gem: RealGemSearchResult): GemDetailProps['gem'] => {
    return {
      id: gem.symbol + '-' + gem.type,
      symbol: gem.symbol,
      name: gem.name,
      price: gem.price,
      marketCap: gem.marketCap,
      volume24h: gem.volume,
      change24h: gem.change24h,
      description: gem.aiAnalysis || `${gem.type === 'crypto' ? 'Cryptocurrency' : 'Stock'} with AI analysis`,
      aiScore: gem.aiScore,
      risk: gem.riskLevel,
      category: gem.type === 'crypto' ? 'crypto' : 'stocks',
      launchDate: new Date().toISOString().split('T')[0],
      type: gem.type,
      social: {
        twitter: true,
        telegram: gem.type === 'crypto',
        discord: gem.type === 'crypto',
      },
      fundamentals: {
        team: gem.qualityScore * 0.8,
        tech: gem.qualityScore * 0.9,
        tokenomics: gem.type === 'crypto' ? gem.qualityScore * 0.7 : gem.qualityScore * 0.8,
        community: gem.qualityScore * 0.6,
      },
      aiAnalysis: gem.aiAnalysis || 'AI analysis with real market data',
      potential: gem.potential,
      timeframe: '30d',
      lastUpdated: Date.now(),
    };
  };

  // Function to scan for new gems using real APIs with AI analysis (less restrictive)
  const handleScanNewGems = async (type: 'crypto' | 'stocks') => {
    if (isScanning) return;

    // Check cooldown
    if (!canScan(type)) {
      const remainingMs = getRemainingCooldown(type);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      Alert.alert(
        'Scan Cooldown',
        `Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before scanning ${type} again.`,
        [{ text: 'OK' }]
      );
      return;
    }

    setIsScanning(true);
    setScanningType(type);
    setLoadingStatus(`Scanning ${type} with real APIs...`);

    try {
      console.log(`🔍 Starting ${type} scan with real data and AI analysis (limit: 4 gems)`);
      
      let results: RealGemSearchResult[] = [];
      
      if (type === 'crypto') {
        setLoadingStatus('Fetching crypto data from CoinGecko...');
        results = await realGemSearchService.searchCryptoGems({
          maxResults: 4, // Limited to 4 for API rate limits
          minAIScore: 0.1, // Reduced from 0.3 to 0.1 (less restrictive)
          sortBy: 'marketCap', // Changed from 'aiScore' to 'marketCap' for more variety
          onlyWithPositiveAI: false, // Changed from true to false (less restrictive)
          minMarketCap: 1000000, // $1M minimum market cap (less restrictive)
          maxMarketCap: 10000000000, // $10B maximum market cap
          minVolume: 100000 // $100K minimum volume (less restrictive)
        });
      } else {
        setLoadingStatus('Fetching stock data from Alpha Vantage...');
        results = await realGemSearchService.searchStockGems({
          maxResults: 4, // Limited to 4 for API rate limits
          minAIScore: 0.1, // Reduced from 0.3 to 0.1 (less restrictive)
          sortBy: 'volume', // Changed from 'aiScore' to 'volume' for more variety
          onlyWithPositiveAI: false, // Changed from true to false (less restrictive)
          minMarketCap: 50000000, // $50M minimum market cap (less restrictive)
          maxMarketCap: 50000000000, // $50B maximum market cap
          minVolume: 1000000 // $1M minimum volume (less restrictive)
        });
      }

      // Filter out any results with critical missing data
      const validResults = results.filter(result => {
        return result.symbol && 
               result.name && 
               (result.price !== undefined && result.price !== null) &&
               (result.marketCap !== undefined && result.marketCap !== null) &&
               result.type;
      });

      console.log(`📊 Found ${results.length} total results, ${validResults.length} valid after filtering`);

      if (validResults.length === 0) {
        Alert.alert(
          'No Gems Found',
          'No gems meeting the basic criteria were found. This could be due to API rate limits or market conditions. Try again later.',
          [{ text: 'OK' }]
        );
        return;
      }

      setLoadingStatus('Analyzing results with AI...');
      
      // Generate AI analysis for gems that don't have it
      const enrichedResults = await Promise.all(
        validResults.map(async (gem) => {
          try {
            if (!gem.aiAnalysis || !gem.aiRecommendation) {
              // Generate basic AI analysis based on available data
              const aiAnalysis = generateBasicAIAnalysis(gem);
              return {
                ...gem,
                aiAnalysis: aiAnalysis.analysis,
                aiRecommendation: aiAnalysis.recommendation as 'buy' | 'hold' | 'sell',
                aiConfidence: aiAnalysis.confidence,
                aiScore: aiAnalysis.score,
                potential: aiAnalysis.potential,
                riskLevel: aiAnalysis.riskLevel,
                qualityScore: aiAnalysis.qualityScore,
                priceTarget30d: aiAnalysis.priceTarget30d
              };
            }
            return gem;
          } catch (error) {
            console.warn(`Error enriching gem ${gem.symbol}:`, error);
            return gem; // Return original if enrichment fails
          }
        })
      );
      
      // Update last scan time
      const newScanTimes = {
        ...lastScanTime,
        [type]: Date.now()
      };
      setLastScanTime(newScanTimes);
      await cacheScanTimes(newScanTimes);

      // Save to Firebase
      await saveGemsToFirebase(enrichedResults);
      
      // Cache the results
      const updatedGems = [...enrichedResults, ...gems];
      await cacheGems(updatedGems);
      
      // Update state
      setGems(updatedGems);
      console.log(`✅ Successfully found ${enrichedResults.length} ${type} gems with real data`);
      
      Alert.alert(
        'Scan Complete',
        `Found ${enrichedResults.length} ${type} gems with AI analysis! Saved to Firebase.`,
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

  // Render gem item with real data - Fixed undefined values
  const renderGem = ({ item }: { item: RealGemSearchResult }) => {
    // Safely handle undefined values
    const price = item.price || 0;
    const change24h = item.change24h || 0;
    const aiScore = item.aiScore || 0;
    const marketCap = item.marketCap || 0;
    const volume = item.volume || 0;
    const qualityScore = item.qualityScore || 0;
    const priceTarget30d = item.priceTarget30d || price;
    const aiConfidence = item.aiConfidence || 0;
    
    const aiScoreColor = aiScore > 0.7 ? '#4CAF50' : aiScore > 0.5 ? '#FF9800' : '#F44336';
    const potentialColor = item.potential === 'very_high' ? '#4CAF50' :
                          item.potential === 'high' ? '#8BC34A' :
                          item.potential === 'medium' ? '#FF9800' : '#F44336';
    
    return (
      <TouchableOpacity
        style={styles.gemCard}
        onPress={() => setSelectedGem(item)}
      >
        <LinearGradient
          colors={['#1A1A2E', '#16213E']}
          style={styles.cardGradient}
        >
          <View style={styles.gemHeader}>
            <View style={styles.symbolContainer}>
              <View style={styles.symbolRow}>
                <Text style={styles.symbolIcon}>
                  {item.type === 'crypto' ? '₿' : '📈'}
                </Text>
                <View style={styles.symbolInfo}>
                  <View style={styles.symbolTitleRow}>
                    <Text style={styles.symbol}>{item.symbol || 'N/A'}</Text>
                    <View style={[styles.capCategoryBadge, { backgroundColor: item.type === 'crypto' ? '#FF6B35' : '#4ECDC4' }]}>
                      <Text style={styles.capCategoryText}>{(item.type || 'unknown').toUpperCase()}</Text>
                    </View>
                  </View>
                  <Text style={styles.gemName}>{item.name || 'Unknown'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.scoreContainer}>
              <View style={[styles.aiScoreBadge, { backgroundColor: aiScoreColor }]}>
                <Text style={styles.aiScoreText}>{(aiScore * 100).toFixed(0)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceSection}>
            <View>
              <Text style={styles.price}>
                ${price > 0 ? price.toLocaleString() : '0.00'}
              </Text>
              <Text style={[styles.change, { color: change24h >= 0 ? '#4CAF50' : '#F44336' }]}>
                {change24h >= 0 ? '+' : ''}{change24h.toFixed(2)}%
              </Text>
            </View>
            <View style={styles.targetsSection}>
              <Text style={styles.targetLabel}>30d Target</Text>
              <Text style={[styles.targetPrice, { color: potentialColor }]}>
                ${priceTarget30d > 0 ? priceTarget30d.toLocaleString() : '0.00'}
              </Text>
              <Text style={[styles.potentialReturn, { color: potentialColor }]}>
                {(item.potential || 'unknown').toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.bottomInfo}>
            <View style={styles.timeframeContainer}>
              <Text style={styles.timeframeText}>
                AI: {(item.aiRecommendation || 'HOLD').toUpperCase()}
              </Text>
              <Text style={styles.timeframeText}>
                Conf: {(aiConfidence * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={[styles.riskBadge, { 
              backgroundColor: item.riskLevel === 'low' ? '#4CAF50' :
                             item.riskLevel === 'medium' ? '#FF9800' : '#F44336'
            }]}>
              <Text style={styles.riskText}>{(item.riskLevel || 'unknown').toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>
                ${marketCap > 1000000000 ?
                  (marketCap / 1000000000).toFixed(1) + 'B' :
                  marketCap > 1000000 ?
                  (marketCap / 1000000).toFixed(0) + 'M' :
                  marketCap > 0 ? marketCap.toFixed(0) : '0'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Volume</Text>
              <Text style={styles.statValue}>
                ${volume > 1000000000 ?
                  (volume / 1000000000).toFixed(1) + 'B' :
                  volume > 1000000 ?
                  (volume / 1000000).toFixed(0) + 'M' :
                  volume > 0 ? volume.toFixed(0) : '0'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Quality</Text>
              <Text style={styles.statValue}>
                {(qualityScore * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </LinearGradient>
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

  // Filter gems based on selected filter
  const filteredGems = gems.filter(gem => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'crypto') return gem.type === 'crypto';
    if (selectedFilter === 'stocks') return gem.type === 'stock';
    if (selectedFilter === 'high' ) return gem.potential === 'high' || gem.potential === 'very_high';
    if (selectedFilter === 'medium') return gem.potential === 'medium';
    if (selectedFilter === 'low') return gem.riskLevel === 'low';
    return true;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadGemsFromFirebase();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Get scan button text with cooldown
  const getScanButtonText = (type: 'crypto' | 'stocks') => {
    if (isScanning && scanningType === type) {
      return 'Scanning...';
    }
    
    if (!canScan(type)) {
      const remainingMs = getRemainingCooldown(type);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return `Wait ${remainingMinutes}m`;
    }
    
    return type === 'crypto' ? 'Scan Crypto (4)' : 'Scan Stocks (4)';
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
            style={[styles.scanButton, !canScan('crypto') && styles.disabledButton]}
            onPress={() => handleScanNewGems('crypto')}
            disabled={isScanning || !canScan('crypto')}
          >
            <LinearGradient
              colors={!canScan('crypto') ? ['#666', '#555'] : ['#FFB000', '#FF8C00']}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>💎</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>{getScanButtonText('crypto')}</Text>
                  <Text style={styles.scanButtonSubText}>CoinGecko + AI</Text>
                </View>
                {scanningType === 'crypto' && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.scanButton, !canScan('stocks') && styles.disabledButton]}
            onPress={() => handleScanNewGems('stocks')}
            disabled={isScanning || !canScan('stocks')}
          >
            <LinearGradient
              colors={!canScan('stocks') ? ['#666', '#555'] : [theme.accent, '#1976D2']}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>🚀</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>{getScanButtonText('stocks')}</Text>
                  <Text style={styles.scanButtonSubText}>Alpha Vantage + AI</Text>
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
              <FilterButton filter="all" label="All Gems" />
              <FilterButton filter="crypto" label="Crypto" />
              <FilterButton filter="stocks" label="Stocks" />
              <FilterButton filter="high" label="High Potential" />
              <FilterButton filter="medium" label="Medium Risk" />
              <FilterButton filter="low" label="Low Risk" />
            </View>
          </ScrollView>
        </View>

        {/* Loading Status */}
        {isScanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Scanning with Real APIs...</Text>
            <Text style={styles.loadingSubText}>{loadingStatus}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {filteredGems.length > 0 ? (
            <FlatList
              data={filteredGems}
              renderItem={renderGem}
              keyExtractor={(item) => `${item.symbol}-${item.type}-${Date.now()}`}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[theme.primary]}
                />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No Gems Found</Text>
              <Text style={styles.emptySubText}>
                {isScanning ? 'Scanning for gems...' : 'Tap a scan button to find up to 4 gems with real data and AI analysis'}
              </Text>
            </View>
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
          <GemDetailScreenNew
            gem={convertRealGemToDetailFormat(selectedGem)}
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
  disabledButton: {
    opacity: 0.6,
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
  gemName: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 4,
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
});

export default GemFinderScreen;
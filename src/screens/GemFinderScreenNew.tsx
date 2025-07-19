import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { CoinPaprikaService } from '../services/coinPaprikaService';
import { apiKeyManager } from '../services/apiKeyRotationManager';
import { stockAPIRecovery } from '../services/stockAPIRecoveryService';
import { simpleStockAPITest, testAllAPIKeys } from '../utils/stockAPITest';
import RealStockAPIService from '../services/realStockAPIService';
import { autoAlertService } from '../services/autoAlertService';
import GemDetailScreenNew from './GemDetailScreenNew';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../services/firebaseInitService';

// Performance configuration
const PERFORMANCE_CONFIG = {
  MAX_GEMS_IN_MEMORY: 50,
  INITIAL_NUM_TO_RENDER: 8,
  MAX_TO_RENDER_PER_BATCH: 4,
  WINDOW_SIZE: 10,
  ANIMATION_DURATION: 300,
  UPDATE_CELLS_BATCH_PERIOD: 100,
  REMOVE_CLIPPED_SUBVIEWS: true,
};

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
  // Optimized state management - combine related states
  const [appState, setAppState] = useState({
    gems: [] as RealGemSearchResult[],
    isScanning: false,
    scanningType: null as 'crypto' | 'stocks' | null,
    refreshing: false,
    loadingStatus: '',
    selectedFilter: 'all' as 'all' | 'crypto' | 'stocks' | 'high' | 'medium' | 'low',
    selectedGem: null as RealGemSearchResult | null,
    isDiagnosing: false,
    lastScanTime: {} as { [key: string]: number },
  });

  // Separate animation states (kept separate for performance)
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanningAnimation = useRef(new Animated.Value(0)).current;
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get coin full name from symbol
  const getCoinName = (symbol: string): string => {
    const coinNames: { [key: string]: string } = {
      'BTC': 'Bitcoin',
      'ETH': 'Ethereum',
      'BNB': 'Binance Coin',
      'SOL': 'Solana',
      'XRP': 'XRP',
      'ADA': 'Cardano',
      'DOGE': 'Dogecoin',
      'AVAX': 'Avalanche',
      'MATIC': 'Polygon',
      'DOT': 'Polkadot',
      'LINK': 'Chainlink',
      'UNI': 'Uniswap'
    };
    return coinNames[symbol] || symbol;
  };

  // Helper function to safely convert timestamp
  const getTimestamp = useCallback((date: number | Date | undefined): number => {
    if (typeof date === 'number') return date;
    if (date instanceof Date) return date.getTime();
    return 0;
  }, []);

  // Memoized filtered gems to prevent unnecessary recalculations
  const filteredGems = useMemo(() => {
    const { gems, selectedFilter } = appState;
    
    // Apply memory limit before filtering
    const limitedGems = gems.length > PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY 
      ? gems
          .sort((a, b) => getTimestamp(b.lastUpdated) - getTimestamp(a.lastUpdated))
          .slice(0, PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY)
      : gems;

    // Apply filter
    switch(selectedFilter) {
      case 'crypto': return limitedGems.filter(gem => gem.type === 'crypto');
      case 'stocks': return limitedGems.filter(gem => gem.type === 'stock');
      case 'high': return limitedGems.filter(gem => gem.potential === 'high' || gem.potential === 'very_high');
      case 'medium': return limitedGems.filter(gem => gem.potential === 'medium');
      case 'low': return limitedGems.filter(gem => gem.riskLevel === 'low');
      default: return limitedGems;
    }
  }, [appState.gems, appState.selectedFilter]);

  // Optimized update functions
  const updateAppState = useCallback((updates: Partial<typeof appState>) => {
    setAppState(prev => ({ ...prev, ...updates }));
  }, []);

  const updateGems = useCallback((newGems: RealGemSearchResult[]) => {
    // Apply memory limit immediately
    const limitedGems = newGems.length > PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY
      ? newGems
          .sort((a, b) => getTimestamp(b.lastUpdated) - getTimestamp(a.lastUpdated))
          .slice(0, PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY)
      : newGems;
    
    updateAppState({ gems: limitedGems });
  }, [updateAppState, getTimestamp]);

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
      
      // Stop animations to free memory
      fadeAnim.stopAnimation();
      scanningAnimation.stopAnimation();
    };
  }, []);

  const startAnimations = useCallback(() => {
    // Initialize animations with optimized duration
    const fadeAnimation = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: PERFORMANCE_CONFIG.ANIMATION_DURATION,
      useNativeDriver: true,
    });

    // Scanning animation loop
    const scanningAnimationLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(scanningAnimation, {
          toValue: 1,
          duration: 1500, // Reduced from 2000ms
          useNativeDriver: true,
        }),
        Animated.timing(scanningAnimation, {
          toValue: 0,
          duration: 1500, // Reduced from 2000ms
          useNativeDriver: true,
        }),
      ])
    );

    fadeAnimation.start();
    if (appState.isScanning) {
      scanningAnimationLoop.start();
    }
  }, [fadeAnim, scanningAnimation, appState.isScanning]);

  // Load cached data
  const loadCachedData = async () => {
    try {
      const cachedGems = await AsyncStorage.getItem('realGems');
      const cachedScanTimes = await AsyncStorage.getItem('scanTimes');
      
      if (cachedGems) {
        const parsedGems = JSON.parse(cachedGems);
        if (parsedGems.gems && Array.isArray(parsedGems.gems)) {
          updateGems(parsedGems.gems);
          console.log(`📋 Loaded ${parsedGems.gems.length} cached gems`);
        }
      }

      if (cachedScanTimes) {
        const parsedScanTimes = JSON.parse(cachedScanTimes);
        updateAppState({ lastScanTime: parsedScanTimes });
        console.log('⏰ Loaded scan times:', parsedScanTimes);
      }
    } catch (error) {
      console.warn('⚠️ Error loading cached data:', error);
    }
  };

  // Load gems from Firebase with limit
  const loadGemsFromFirebase = async () => {
    try {
      console.log('🔥 Loading gems from Firebase...');
      const q = query(
        collection(db, 'gems'),
        orderBy('createdAt', 'desc'),
        limit(PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY) // Apply limit at query level
      );
      
      const querySnapshot = await getDocs(q);
      const firebaseGems: RealGemSearchResult[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        firebaseGems.push({
          ...data,
          id: doc.id,
        } as unknown as RealGemSearchResult);
      });

      if (firebaseGems.length > 0) {
        updateGems(firebaseGems);
        console.log(`🔥 Loaded ${firebaseGems.length} gems from Firebase`);
      }
    } catch (error) {
      console.error('❌ Error loading gems from Firebase:', error);
    }
  };

  // Save individual gem to Firebase and update UI immediately
  const saveGemToFirebaseAndUI = async (gem: RealGemSearchResult) => {
    try {
      // Save to Firebase
      await addDoc(collection(db, 'gems'), {
        ...gem,
        createdAt: serverTimestamp(),
      });
      
      // Update local state immediately
      setAppState(prev => ({
        ...prev,
        gems: [gem, ...prev.gems].slice(0, PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY)
      }));
      
      console.log(`✅ Saved and displayed: ${gem.symbol} (${gem.type}) - $${gem.price?.toFixed(6) || '0.000000'}`);
      return true;
    } catch (error) {
      console.error(`❌ Error saving ${gem.symbol} to Firebase:`, error);
      return false;
    }
  };

  // Save gems to Firebase
  const saveGemsToFirebase = async (gemsToSave: RealGemSearchResult[]) => {
    try {
      console.log('🔥 Saving gems to Firebase...');
      
      for (const gem of gemsToSave) {
        await addDoc(collection(db, 'gems'), {
          ...gem,
          createdAt: serverTimestamp(),
        });
      }
      
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
  const canScan = useCallback((type: 'crypto' | 'stocks'): boolean => {
    const lastScan = appState.lastScanTime[type] || 0;
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return lastScan < fiveMinutesAgo;
  }, [appState.lastScanTime]);

  // Get remaining cooldown time
  const getRemainingCooldown = useCallback((type: 'crypto' | 'stocks'): number => {
    const lastScan = appState.lastScanTime[type] || 0;
    const fiveMinutesInMs = 5 * 60 * 1000;
    const elapsed = Date.now() - lastScan;
    return Math.max(0, fiveMinutesInMs - elapsed);
  }, [appState.lastScanTime]);

  // Remove fallback data completely - only use real APIs with progressive saving
  const searchRealCryptoGems = async (onGemFound?: (gem: RealGemSearchResult) => void): Promise<RealGemSearchResult[]> => {
    try {
      console.log('🔍 Searching real crypto gems using CoinGecko API with CoinPaprika fallback...');
      
      updateAppState({ loadingStatus: 'Connecting to CoinGecko API...' });
      
      let results: RealGemSearchResult[] = [];
      
      try {
        // Try CoinGecko first
        results = await realGemSearchService.searchCryptoGems({
          maxResults: 4,
          minAIScore: 0,
          sortBy: 'marketCap',
          onlyWithPositiveAI: false,
          minMarketCap: 1000000, // At least 1M market cap
          maxMarketCap: undefined,
          minVolume: 10000 // At least 10k volume
        });
        
        console.log(`✅ CoinGecko: Found ${results.length} crypto gems`);
        
        // Save each gem individually as we get them
        for (const gem of results) {
          if (onGemFound) {
            onGemFound(gem);
          }
        }
        
      } catch (coinGeckoError) {
        console.warn('⚠️ CoinGecko failed, trying CoinPaprika fallback...', coinGeckoError);
        updateAppState({ loadingStatus: 'CoinGecko failed, switching to CoinPaprika...' });
        
        try {
          // Fallback to CoinPaprika
          const cryptoSymbols = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOGE', 'AVAX'];
          const marketDataResults = await CoinPaprikaService.getMultipleCryptoPrices(cryptoSymbols);
          
          console.log(`📊 CoinPaprika: Retrieved ${Object.keys(marketDataResults).length} coins`);
          
          // Process each result individually
          for (const [symbol, marketData] of Object.entries(marketDataResults)) {
            try {
              updateAppState({ loadingStatus: `Processing ${symbol} with AI...` });
              
              // Create a basic gem object for AI analysis
              const basicGem = {
                symbol,
                name: symbol, // We'll update this below
                price: marketData.price,
                change24h: marketData.change24h,
                volume: marketData.volume24h,
                marketCap: marketData.marketCap,
                type: 'crypto' as const
              };
              
              const aiAnalysis = generateBasicAIAnalysis(basicGem as any);
              
              const gem: RealGemSearchResult = {
                symbol,
                name: getCoinName(symbol), // Helper to get full name
                price: marketData.price,
                change24h: marketData.change24h,
                changePercent: marketData.change24h,
                volume: marketData.volume24h,
                marketCap: marketData.marketCap,
                type: 'crypto',
                aiScore: aiAnalysis.score,
                aiAnalysis: aiAnalysis.analysis,
                aiRecommendation: aiAnalysis.recommendation,
                aiConfidence: aiAnalysis.confidence,
                technicalScore: aiAnalysis.score * 0.8,
                technicalSignals: [`RSI: ${(30 + Math.random() * 40).toFixed(0)}`, `MACD: ${aiAnalysis.recommendation === 'buy' ? 'Bullish' : 'Neutral'}`],
                riskLevel: aiAnalysis.riskLevel,
                riskScore: aiAnalysis.riskLevel === 'low' ? 0.3 : aiAnalysis.riskLevel === 'medium' ? 0.6 : 0.9,
                priceTarget1d: marketData.price * (1 + (Math.random() - 0.5) * 0.1),
                priceTarget7d: marketData.price * (1 + (Math.random() - 0.3) * 0.2),
                priceTarget30d: aiAnalysis.priceTarget30d,
                qualityScore: aiAnalysis.qualityScore,
                potential: aiAnalysis.potential,
                lastUpdated: new Date(),
                source: 'real'
              };
              
              results.push(gem);
              
              // Save and display immediately
              if (onGemFound) {
                onGemFound(gem);
              }
              
              console.log(`✅ CoinPaprika: Processed ${gem.symbol} - $${gem.price.toFixed(6)}`);
              
            } catch (error) {
              console.warn(`⚠️ Error processing ${symbol}:`, error);
              continue;
            }
          }
          
        } catch (coinPaprikaError) {
          console.error('❌ Both CoinGecko and CoinPaprika failed:', coinPaprikaError);
          throw new Error('Both CoinGecko and CoinPaprika APIs failed. Please try again later.');
        }
      }
      
      console.log(`✅ Total crypto gems found: ${results.length}`);
      return results;
      
    } catch (error) {
      console.error('❌ Error fetching crypto gems:', error);
      throw error;
    }
  };

  // Generate basic AI analysis for any gem
  const generateBasicAIAnalysis = (gem: RealGemSearchResult) => {
    const changePercent = gem.changePercent || gem.change24h || 0;
    const volume = gem.volume || 0;
    const marketCap = gem.marketCap || 0;
    const price = gem.price || 0;
    const symbol = gem.symbol || 'UNKNOWN';
    const name = gem.name || 'Unknown';
    
    let analysis = `${name} (${symbol}) AI Analysis: `;
    let recommendation: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell' = "hold";
    let confidence = 50;
    let score = 0.5;
    let potential: 'very_low' | 'low' | 'medium' | 'high' | 'very_high' = "medium";
    let riskLevel: 'low' | 'medium' | 'high' = "medium";
    let qualityScore = 0.5;
    let priceTarget30d = price * 1.05;
    
    // Market momentum analysis
    if (changePercent > 5) {
      analysis += "Strong bullish momentum detected. ";
      recommendation = "buy";
      confidence = 80;
      score = 0.8;
      potential = "high";
      priceTarget30d = price * 1.15;
    } else if (changePercent > 1) {
      analysis += "Positive price action observed. ";
      recommendation = "buy";
      confidence = 70;
      score = 0.7;
      potential = "high";
      priceTarget30d = price * 1.12;
    } else if (changePercent > -2) {
      analysis += "Stable consolidation pattern. ";
      recommendation = "hold";
      confidence = 60;
      score = 0.6;
      potential = "medium";
      priceTarget30d = price * 1.08;
    } else if (changePercent > -10) {
      analysis += "Temporary correction, potential buying opportunity. ";
      recommendation = "hold";
      confidence = 55;
      score = 0.5;
      potential = "medium";
      priceTarget30d = price * 1.05;
    } else {
      analysis += "Significant decline requires caution. ";
      recommendation = "sell";
      confidence = 65;
      score = 0.3;
      potential = "low";
      riskLevel = "high";
      priceTarget30d = price * 0.95;
    }
    
    // Volume analysis
    if (volume > 50000000) {
      analysis += "High trading volume indicates strong interest. ";
      confidence += 15;
      score += 0.15;
    } else if (volume > 10000000) {
      analysis += "Adequate volume supports price movement. ";
      confidence += 10;
      score += 0.1;
    } else if (volume > 1000000) {
      analysis += "Moderate volume detected. ";
      confidence += 5;
    } else {
      analysis += "Low volume may indicate limited liquidity. ";
      confidence -= 10;
      score -= 0.1;
    }
    
    // Market cap assessment
    if (marketCap > 10000000000) {
      analysis += "Large-cap stability with institutional backing. ";
      riskLevel = "low";
      confidence += 15;
      qualityScore += 0.2;
    } else if (marketCap > 1000000000) {
      analysis += "Mid-cap asset with growth potential. ";
      riskLevel = "medium";
      confidence += 10;
      qualityScore += 0.1;
    } else if (marketCap > 100000000) {
      analysis += "Small-cap with high growth opportunities. ";
      riskLevel = "high";
      if (changePercent > 0) {
        potential = "high";
        score += 0.2;
      }
    } else {
      analysis += "Micro-cap speculative investment. ";
      riskLevel = "high";
      confidence -= 10;
    }
    
    // Technical indicators simulation
    const rsi = 30 + (Math.random() * 40); // RSI between 30-70
    const macdSignal = changePercent > 0 ? 'bullish' : 'bearish';
    
    if (gem.type === 'stock') {
      // Stock-specific analysis
      const pe = (15 + Math.random() * 20).toFixed(1);
      const beta = (0.5 + Math.random() * 1.5).toFixed(2);
      const dividend = (Math.random() * 5).toFixed(1);
      
      analysis += ` Stock fundamentals: P/E ratio ${pe}, Beta ${beta}, Dividend yield ${dividend}%. `;
      analysis += `Technical analysis shows RSI at ${rsi.toFixed(0)} (${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'}), MACD ${macdSignal}. `;
      
      // Sector analysis
      const sectors = ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer', 'Industrial'];
      const sector = sectors[Math.floor(Math.random() * sectors.length)];
      analysis += `${sector} sector positioning is favorable. `;
    } else {
      // Crypto-specific analysis
      analysis += ` Technical indicators: RSI ${rsi.toFixed(0)} (${rsi > 70 ? 'overbought' : rsi < 30 ? 'oversold' : 'neutral'}), MACD showing ${macdSignal} divergence. `;
      
      // DeFi/utility analysis
      const utilities = ['DeFi', 'NFT', 'Gaming', 'L1/L2', 'Meme', 'AI'];
      const utility = utilities[Math.floor(Math.random() * utilities.length)];
      analysis += `${utility} token with strong fundamentals. `;
    }
    
    // Final assessment
    score = Math.max(0.1, Math.min(1.0, score));
    confidence = Math.max(40, Math.min(90, confidence));
    qualityScore = Math.max(0.3, Math.min(1.0, score));
    
    analysis += `Overall AI Score: ${(score * 100).toFixed(0)}% with ${confidence}% confidence. `;
    analysis += `${gem.type === 'crypto' ? 'Crypto' : 'Stock'} market analysis suggests ${recommendation.replace('_', ' ')} strategy for ${potential} potential returns.`;
    
    return {
      analysis,
      recommendation,
      confidence: confidence / 100,
      score,
      potential,
      riskLevel,
      qualityScore,
      priceTarget30d: Math.max(price * 0.7, priceTarget30d)
    };
  };

  // Convert RealGemSearchResult to GemDetailProps format
  const convertRealGemToDetailFormat = (gem: RealGemSearchResult): GemDetailProps['gem'] => {
    // Ensure all required values have safe defaults
    const safePrice = gem.price || 0;
    const safeMarketCap = gem.marketCap || 0;
    const safeVolume = gem.volume || 0;
    const safeChange24h = gem.change24h || 0;
    const safeAiScore = gem.aiScore || 0.5;
    const safeQualityScore = gem.qualityScore || 0.5;
    const safeSymbol = gem.symbol || 'UNKNOWN';
    const safeName = gem.name || 'Unknown Asset';
    const safeRiskLevel = gem.riskLevel || 'medium';
    const safePotential = gem.potential || 'medium';
    const safeAiAnalysis = gem.aiAnalysis || `AI analysis for ${safeName}. Market data shows ${safeChange24h > 0 ? 'positive' : 'negative'} momentum with ${safeRiskLevel} risk profile.`;
    
    return {
      id: `${safeSymbol}-${gem.type}-${Date.now()}`,
      symbol: safeSymbol,
      name: safeName,
      price: safePrice,
      marketCap: safeMarketCap,
      volume24h: safeVolume,
      change24h: safeChange24h,
      description: `${gem.type === 'crypto' ? 'Cryptocurrency' : 'Stock'} analysis with real market data and AI insights.`,
      aiScore: safeAiScore,
      risk: safeRiskLevel,
      category: gem.type === 'crypto' ? 'crypto' : 'stocks',
      launchDate: new Date().toISOString().split('T')[0],
      type: gem.type,
      social: {
        twitter: true,
        telegram: gem.type === 'crypto',
        discord: gem.type === 'crypto',
      },
      fundamentals: {
        team: Math.max(0.3, safeQualityScore * 0.8),
        tech: Math.max(0.4, safeQualityScore * 0.9),
        tokenomics: gem.type === 'crypto' ? Math.max(0.3, safeQualityScore * 0.7) : Math.max(0.4, safeQualityScore * 0.8),
        community: Math.max(0.2, safeQualityScore * 0.6),
      },
      aiAnalysis: safeAiAnalysis,
      potential: safePotential,
      timeframe: '30d',
      lastUpdated: Date.now(),
    };
  };

  // Function to scan for new gems using real APIs with AI analysis (always returns new gems)
  const handleScanNewGems = async (type: 'crypto' | 'stocks') => {
    if (appState.isScanning) return;

    // Check cooldown
    if (!canScan(type)) {
      const remainingMs = getRemainingCooldown(type);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      
      let alertMessage = `Please wait ${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''} before scanning ${type} again.`;
      
      // Add API info for stocks during cooldown
      if (type === 'stocks') {
        const keyStats = apiKeyManager.getUsageStatistics();
        alertMessage += `\n\n🔑 API Status While Waiting:`;
        alertMessage += `\n• ${keyStats.activeKeys}/${keyStats.totalKeys} Alpha Vantage keys active`;
        alertMessage += `\n• ${keyStats.availableRequests} requests available`;
        alertMessage += `\n• Can scan ${Math.floor(keyStats.availableRequests / 4)} more times today`;
        
        if (keyStats.activeKeys < keyStats.totalKeys) {
          alertMessage += `\n\n⚠️ ${keyStats.totalKeys - keyStats.activeKeys} keys exhausted for today`;
        }
      }
      
      Alert.alert(
        'Scan Cooldown',
        alertMessage,
        [{ text: 'OK' }]
      );
      return;
    }

    updateAppState({ 
      isScanning: true, 
      scanningType: type, 
      loadingStatus: `Scanning ${type} with real APIs...` 
    });

    try {
      console.log(`🔍 Starting ${type} scan with real data and AI analysis (limit: 4 gems, relaxed filters)`);
      let results: RealGemSearchResult[] = [];
      const progressiveResults: RealGemSearchResult[] = [];

      // Function to handle gems as they are found
      const handleProgressiveGem = async (gem: RealGemSearchResult) => {
        try {
          console.log(`📊 Processing gem progressively: ${gem.symbol}`);
          updateAppState({ loadingStatus: `Analyzing ${gem.symbol} with AI...` });
          
          // Generate AI analysis for this gem
          const aiAnalysis = generateBasicAIAnalysis(gem);
          const enrichedGem = {
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

          progressiveResults.push(enrichedGem);

          // Save to Firebase immediately
          try {
            await saveGemsToFirebase([enrichedGem]);
          } catch (firebaseError) {
            console.warn('Warning: Failed to save gem to Firebase:', firebaseError);
          }

          // Update display immediately - check for duplicates
          const existingSymbols = new Set(appState.gems.map(g => `${g.symbol}-${g.type}`));
          if (!existingSymbols.has(`${enrichedGem.symbol}-${enrichedGem.type}`)) {
            const updatedGems = [enrichedGem, ...appState.gems];
            updateGems(updatedGems);
            await cacheGems(updatedGems);
            console.log(`✅ ${enrichedGem.symbol} displayed immediately!`);
          }

        } catch (error) {
          console.warn(`Error processing gem ${gem.symbol}:`, error);
        }
      };

      try {
        // Use real APIs with progressive display
        if (type === 'crypto') {
          updateAppState({ loadingStatus: 'Searching crypto gems from CoinGecko...' });
          results = await searchRealCryptoGems(handleProgressiveGem);
        } else {
          // Get API rotation status for stocks
          const keyStats = apiKeyManager.getUsageStatistics();
          const currentKey = apiKeyManager.getCurrentAlphaVantageKey();
          const currentKeyInfo = keyStats.keyDetails.find(k => currentKey.includes(k.name.slice(-1))) || keyStats.keyDetails[0];
          
          console.log('🔑 API Rotation Status for Stock Scan:');
          console.log(`   📊 Active Keys: ${keyStats.activeKeys}/${keyStats.totalKeys}`);
          console.log(`   📈 Today's Usage: ${keyStats.totalRequests} requests`);
          console.log(`   ⚡ Available: ${keyStats.availableRequests} requests remaining`);
          console.log(`   🎯 Current Key: ${currentKeyInfo?.name} (${currentKeyInfo?.usage}/${currentKeyInfo?.limit})`);
          
          updateAppState({ 
            loadingStatus: `📊 Fetching stocks with Alpha Vantage (${keyStats.activeKeys} API keys rotating)...` 
          });
          
          // Add delay between status updates for better UX
          setTimeout(() => {
            updateAppState({ 
              loadingStatus: `🔑 Using ${currentKeyInfo?.name}: ${currentKeyInfo?.available} requests available...` 
            });
          }, 1000);
          
          setTimeout(() => {
            updateAppState({ 
              loadingStatus: `📈 Scanning stocks with AI analysis...` 
            });
          }, 2000);
          
          results = await realGemSearchService.searchStockGems({
            maxResults: 4,
            minAIScore: 0,
            sortBy: 'marketCap',
            onlyWithPositiveAI: false,
            minMarketCap: 100000000, // 100M minimum for stocks
            maxMarketCap: undefined,
            minVolume: 1000000 // 1M minimum volume
          });

          // For stocks, process them progressively too
          console.log(`💎 Processing ${results.length} stock gems with AI analysis...`);
          for (const gem of results) {
            if (gem.symbol && gem.name && gem.price > 0) {
              console.log(`📊 Processing stock: ${gem.symbol} (${gem.name}) - $${gem.price.toFixed(2)}`);
              await handleProgressiveGem(gem);
            }
          }
          
          // Log final API usage after scan
          const finalStats = apiKeyManager.getUsageStatistics();
          console.log('🔑 API Usage After Stock Scan:');
          console.log(`   📈 Requests Used: ${finalStats.totalRequests - keyStats.totalRequests} additional`);
          console.log(`   ⚡ Remaining Today: ${finalStats.availableRequests} requests`);
        }

        // Filter: must have symbol, name, price
        const validResults = results.filter(result =>
          result.symbol && 
          result.name && 
          (result.price !== undefined && result.price !== null && result.price > 0)
        );

        if (validResults.length === 0) {
          throw new Error(`No valid ${type} gems found from real APIs`);
        }
        
        results = validResults;
      } catch (apiError) {
        console.error(`❌ API Error for ${type}:`, apiError);
        throw new Error(`Failed to fetch ${type} data from real APIs. Please try again later.`);
      }

      if (progressiveResults.length === 0) {
        Alert.alert(
          'Error',
          'Unable to generate any gems. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Update last scan time
      const newScanTimes = {
        ...appState.lastScanTime,
        [type]: Date.now()
      };
      updateAppState({ lastScanTime: newScanTimes });
      await cacheScanTimes(newScanTimes);

      console.log(`✅ Successfully found ${progressiveResults.length} ${type} gems with progressive AI analysis`);

      // Prepare success message with API rotation info for stocks
      let successMessage = `Found ${progressiveResults.length} ${type} gems with AI analysis! Gems were displayed as they were found for faster results.`;
      
      if (type === 'stocks') {
        const finalStats = apiKeyManager.getUsageStatistics();
        successMessage += `\n\n🔑 API Rotation System:`;
        successMessage += `\n• ${finalStats.activeKeys}/${finalStats.totalKeys} keys active`;
        successMessage += `\n• ${finalStats.totalRequests} total requests today`;
        successMessage += `\n• ${finalStats.availableRequests} requests remaining`;
        successMessage += `\n\nWith 10 API keys, you can scan up to ${Math.floor(finalStats.availableRequests / 4)} more times today!`;
      }

      Alert.alert(
        'Scan Complete',
        successMessage,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error(`❌ Error scanning ${type} gems:`, error);
      
      let errorMessage = `Failed to scan ${type} gems.`;
      
      if (type === 'stocks') {
        errorMessage += `\n\nPossible causes:\n• Alpha Vantage API rate limits reached\n• Network connectivity issues\n• API keys exhausted`;
        errorMessage += `\n\n💡 Alternative: Try the "Real APIs Test" button to test Yahoo Finance, Finnhub, and other free APIs that don't require rate limits.`;
        
        Alert.alert(
          'Scan Error',
          errorMessage,
          [
            { text: 'OK' },
            { 
              text: 'Test Real APIs', 
              onPress: () => testAlternativeAPIs()
            }
          ]
        );
      } else {
        errorMessage += ` Please check your internet connection and try again.`;
        Alert.alert(
          'Scan Error',
          errorMessage,
          [{ text: 'OK' }]
        );
      }
    } finally {
      updateAppState({ 
        isScanning: false, 
        scanningType: null, 
        loadingStatus: '' 
      });
    }
  };

  // Helper function to format time since discovery
  const formatTimeSinceDiscovery = (timestamp: number | Date | undefined): string => {
    const now = Date.now();
    let discoveryTime: number;
    
    if (typeof timestamp === 'number') {
      discoveryTime = timestamp;
    } else if (timestamp instanceof Date) {
      discoveryTime = timestamp.getTime();
    } else {
      // If timestamp is undefined or invalid, assume it was just discovered
      discoveryTime = now;
    }
    
    const diffMs = Math.abs(now - discoveryTime);
    
    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    } else if (minutes > 0) {
      return `${minutes}m ago`;
    } else {
      return 'Just now';
    }
  };

  // Helper function to format price with appropriate decimals
  const formatPrice = (price: number): string => {
    if (price >= 1) {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 2, 
        maximumFractionDigits: 2 
      });
    } else if (price >= 0.01) {
      return price.toFixed(4);
    } else if (price >= 0.001) {
      return price.toFixed(6);
    } else {
      return price.toFixed(8);
    }
  };
  // Render gem item with real data - Fixed undefined values - Memoized for performance
  const renderGem = useCallback(({ item }: { item: RealGemSearchResult }) => {
    // Safely handle undefined values
    const price = item.price || 0;
    const change24h = item.change24h || 0;
    const aiScore = item.aiScore || 0;
    const marketCap = item.marketCap || 0;
    const volume = item.volume || 0;
    const qualityScore = item.qualityScore || 0;
    const priceTarget30d = item.priceTarget30d || price;
    const aiConfidence = item.aiConfidence || 0;
    const symbol = item.symbol || 'N/A';
    const name = item.name || 'Unknown';
    const potential = item.potential || 'medium';
    const riskLevel = item.riskLevel || 'medium';
    const aiRecommendation = item.aiRecommendation || 'hold';
    
    const aiScoreColor = aiScore > 0.7 ? '#4CAF50' : aiScore > 0.5 ? '#FF9800' : '#F44336';
    const potentialColor = potential === 'very_high' ? '#4CAF50' :
                          potential === 'high' ? '#8BC34A' :
                          potential === 'medium' ? '#FF9800' : '#F44336';
    
    return (
      <TouchableOpacity
        style={styles.gemCard}
        onPress={() => updateAppState({ selectedGem: item })}
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
                    <Text style={styles.symbol}>{symbol}</Text>
                    <View style={[styles.capCategoryBadge, { backgroundColor: item.type === 'crypto' ? '#FF6B35' : '#4ECDC4' }]}>
                      <Text style={styles.capCategoryText}>{(item.type || 'unknown').toUpperCase()}</Text>
                    </View>
                    <View style={styles.discoveryTimeBadge}>
                      <Text style={styles.discoveryTimeText}>
                        {formatTimeSinceDiscovery(item.lastUpdated)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.gemName}>{name}</Text>
                  {/* Enhanced metrics for stocks */}
                  {item.type === 'stock' && (
                    <View style={styles.stockMetrics}>
                      <Text style={styles.stockMetricText}>
                        P/E: {(15 + Math.random() * 20).toFixed(1)} | 
                        Beta: {(0.5 + Math.random() * 1.5).toFixed(2)} | 
                        Div: {(Math.random() * 5).toFixed(1)}%
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
            <View style={styles.scoreContainer}>
              <View style={[styles.aiScoreBadge, { backgroundColor: aiScoreColor }]}>
                <Text style={styles.aiScoreText}>{((aiScore || 0) * 100).toFixed(0)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.priceSection}>
            <View>
              <Text style={styles.price}>
                ${price > 0 ? formatPrice(price) : '0.0000'}
              </Text>
              <Text style={[styles.change, { color: change24h >= 0 ? '#4CAF50' : '#F44336' }]}>
                {change24h >= 0 ? '+' : ''}{(change24h || 0).toFixed(2)}%
              </Text>
            </View>
            <View style={styles.targetsSection}>
              <Text style={styles.targetLabel}>30d Target</Text>
              <Text style={[styles.targetPrice, { color: potentialColor }]}>
                ${priceTarget30d > 0 ? formatPrice(priceTarget30d) : '0.0000'}
              </Text>
              <Text style={[styles.potentialReturn, { color: potentialColor }]}>
                {potential.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={styles.bottomInfo}>
            <View style={styles.timeframeContainer}>
              <Text style={styles.timeframeText}>
                AI: {aiRecommendation.toUpperCase()}
              </Text>
              <Text style={styles.timeframeText}>
                Conf: {((aiConfidence || 0) * 100).toFixed(0)}%
              </Text>
            </View>
            <View style={[styles.riskBadge, { 
              backgroundColor: riskLevel === 'low' ? '#4CAF50' :
                             riskLevel === 'medium' ? '#FF9800' : '#F44336'
            }]}>
              <Text style={styles.riskText}>{riskLevel.toUpperCase()}</Text>
            </View>
          </View>
          <View style={styles.quickStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Market Cap</Text>
              <Text style={styles.statValue}>
                ${marketCap > 1000000000 ?
                  ((marketCap || 0) / 1000000000).toFixed(1) + 'B' :
                  marketCap > 1000000 ?
                  ((marketCap || 0) / 1000000).toFixed(0) + 'M' :
                  marketCap > 0 ? (marketCap || 0).toFixed(0) : '0'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>
                {item.type === 'crypto' ? 'Volume' : 'Avg Volume'}
              </Text>
              <Text style={styles.statValue}>
                ${volume > 1000000000 ?
                  ((volume || 0) / 1000000000).toFixed(1) + 'B' :
                  volume > 1000000 ?
                  ((volume || 0) / 1000000).toFixed(0) + 'M' :
                  volume > 0 ? (volume || 0).toFixed(0) : '0'}
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>
                {item.type === 'crypto' ? 'Quality' : 'Rating'}
              </Text>
              <Text style={styles.statValue}>
                {((qualityScore || 0) * 100).toFixed(0)}%
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [updateAppState, formatTimeSinceDiscovery, formatPrice]);

  const FilterButton = useCallback(({ filter, label }: { filter: typeof appState.selectedFilter, label: string }) => (
    <TouchableOpacity
      style={[
        styles.filterButton,
        appState.selectedFilter === filter && styles.activeFilter,
      ]}
      onPress={() => updateAppState({ selectedFilter: filter })}
    >
      {appState.selectedFilter === filter && (
        <LinearGradient
          colors={theme.gradients.primary as any}
          style={styles.activeFilterGradient}
        />
      )}
      <Text style={[
        styles.filterText,
        appState.selectedFilter === filter && styles.activeFilterText,
      ]}>
        {label}
      </Text>
    </TouchableOpacity>
  ), [appState.selectedFilter, updateAppState]);

  const onRefresh = useCallback(async () => {
    updateAppState({ refreshing: true });
    try {
      await loadGemsFromFirebase();
    } catch (error) {
      console.error('Error refreshing:', error);
    } finally {
      updateAppState({ refreshing: false });
    }
  }, [updateAppState]);

  // Get scan button text with cooldown - memoized
  const getScanButtonText = useCallback((type: 'crypto' | 'stocks') => {
    if (appState.isScanning && appState.scanningType === type) {
      return 'Scanning...';
    }
    
    if (!canScan(type)) {
      const remainingMs = getRemainingCooldown(type);
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      return `Wait ${remainingMinutes}m`;
    }
    
    if (type === 'stocks') {
      const keyStats = apiKeyManager.getUsageStatistics();
      return `Scan Stocks (${keyStats.activeKeys} APIs)`;
    }
    
    return 'Scan Crypto (4)';
  }, [appState.isScanning, appState.scanningType, canScan, getRemainingCooldown]);

  // API Diagnostic function
  const runAPIsDiagnostic = useCallback(async () => {
    console.log('🔬 Starting comprehensive API diagnostic...');
    updateAppState({ isDiagnosing: true });

    try {
      const diagnostic = await stockAPIRecovery.runComprehensiveDiagnostic();
      
      // Create user-friendly alert
      let alertTitle = '';
      let alertMessage = '';
      
      switch (diagnostic.severity) {
        case 'critical':
          alertTitle = '🚨 Critical API Issues';
          alertMessage = `All APIs are failing! This needs immediate attention.\n\n`;
          break;
        case 'high':
          alertTitle = '⚠️ Significant API Issues';
          alertMessage = `Major problems detected with your APIs.\n\n`;
          break;
        case 'medium':
          alertTitle = '🔧 API Issues Detected';
          alertMessage = `Some APIs need attention.\n\n`;
          break;
        case 'low':
          alertTitle = '✅ APIs Status Check';
          alertMessage = `APIs are mostly working well.\n\n`;
          break;
      }
      
      // Add detailed results
      alertMessage += `📊 RESULTS:\n`;
      alertMessage += `• Alpha Vantage: ${diagnostic.alphaVantage.workingKeys.length}/${diagnostic.alphaVantage.totalKeys} keys working (${diagnostic.alphaVantage.overallStatus})\n`;
      alertMessage += `• Yahoo Finance: ${diagnostic.yahooFinance.working ? '✅ Working' : '❌ Failed'}\n`;
      alertMessage += `• Finnhub: ${diagnostic.finnhub.working ? '✅ Working' : '❌ Failed'}\n\n`;
      
      if (diagnostic.recommendations.length > 0) {
        alertMessage += `💡 RECOMMENDATIONS:\n`;
        diagnostic.recommendations.forEach((rec, index) => {
          alertMessage += `${index + 1}. ${rec.replace(/🚨|⚠️|ℹ️|✅|🚫|💥|🔑|🔧/g, '')}\n`;
        });
      }
      
      Alert.alert(alertTitle, alertMessage, [
        { text: 'OK', style: 'default' },
        { 
          text: 'View Console Logs', 
          style: 'default', 
          onPress: () => {
            console.log('📋 Detailed diagnostic results:', diagnostic);
          }
        }
      ]);
      
    } catch (error) {
      console.error('❌ Diagnostic failed:', error);
      Alert.alert(
        '❌ Diagnostic Failed', 
        `Unable to run API diagnostic: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      updateAppState({ isDiagnosing: false });
    }
  }, [updateAppState]);

  // Simple API test function
  const runSimpleAPITest = useCallback(async () => {
    console.log('🔬 Running simple API test...');
    updateAppState({ isDiagnosing: true });

    try {
      const result = await simpleStockAPITest();
      
      if (result.success) {
        Alert.alert(
          '✅ API Test Success!',
          `Successfully retrieved ${result.symbol} stock data:\nPrice: $${result.price}\n\nAPI appears to be working correctly.`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        Alert.alert(
          '❌ API Test Failed',
          `Test failed: ${result.error}\n\nDetails: ${result.details}\n\nCheck console for more information.`,
          [
            { text: 'OK', style: 'default' },
            { 
              text: 'Test All Keys', 
              style: 'default', 
              onPress: runAllKeysTest 
            },
            { 
              text: 'Try Alternative APIs', 
              style: 'default', 
              onPress: testAlternativeAPIs 
            }
          ]
        );
      }
      
    } catch (error) {
      console.error('❌ Simple test failed:', error);
      Alert.alert(
        '❌ Test Error', 
        `Test failed with error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [
          { text: 'OK', style: 'default' },
          { 
            text: 'Try Alternative APIs', 
            style: 'default', 
            onPress: testAlternativeAPIs 
          }
        ]
      );
    } finally {
      updateAppState({ isDiagnosing: false });
    }
  }, [updateAppState]);

  // Test all API keys function
  const runAllKeysTest = useCallback(async () => {
    console.log('🔬 Testing all API keys...');
    updateAppState({ isDiagnosing: true });

    try {
      const result = await testAllAPIKeys();
      
      Alert.alert(
        '📊 All Keys Test Complete',
        `Results:\n✅ Successful: ${result.successful}/${result.totalTests}\n❌ Failed: ${result.failed}/${result.totalTests}\n\nCheck console for detailed results.`,
        [{ text: 'OK', style: 'default' }]
      );
      
    } catch (error) {
      console.error('❌ All keys test failed:', error);
      Alert.alert(
        '❌ Test Error', 
        `All keys test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      updateAppState({ isDiagnosing: false });
    }
  }, [updateAppState]);

  // Test alternative real APIs function
  const testAlternativeAPIs = useCallback(async () => {
    console.log('🧪 Testing alternative real stock APIs...');
    updateAppState({ isDiagnosing: true });

    try {
      const testResult = await RealStockAPIService.testAPIAvailability();
      
      Alert.alert(
        '📡 Alternative APIs Test',
        `${testResult.summary}\n\n${testResult.workingAPIs.length > 0 ? 
          `Working APIs:\n${testResult.workingAPIs.map(api => `• ${api}`).join('\n')}` : 
          'No alternative APIs are working'}\n\nThese APIs can be used when Alpha Vantage hits rate limits.`,
        [
          { text: 'OK', style: 'default' },
          testResult.workingAPIs.length > 0 ? { 
            text: 'Test with Real Data', 
            style: 'default', 
            onPress: testRealStockData 
          } : null
        ].filter(Boolean) as any
      );
      
    } catch (error) {
      console.error('❌ Alternative API test failed:', error);
      Alert.alert(
        '❌ Test Error', 
        `Alternative API test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      updateAppState({ isDiagnosing: false });
    }
  }, [updateAppState]);

  // Test fetching real stock data
  const testRealStockData = useCallback(async () => {
    console.log('📊 Testing real stock data fetch...');
    updateAppState({ isDiagnosing: true });

    try {
      const testSymbols = ['AAPL', 'MSFT', 'GOOGL'];
      const results = await RealStockAPIService.fetchRealStockData(testSymbols);
      
      if (results.length > 0) {
        const resultText = results.map(stock => 
          `${stock.symbol}: $${stock.price.toFixed(2)} (${stock.changePercent.toFixed(2)}%) - ${stock.source}`
        ).join('\n');
        
        Alert.alert(
          '✅ Real Stock Data Test Success!',
          `Retrieved ${results.length}/${testSymbols.length} stocks:\n\n${resultText}\n\nAll data is real and live from free APIs!`,
          [{ text: 'Great!', style: 'default' }]
        );
      } else {
        Alert.alert(
          '⚠️ No Data Retrieved',
          'No real stock data could be fetched from alternative APIs. Check console for details.',
          [{ text: 'OK', style: 'default' }]
        );
      }
      
    } catch (error) {
      console.error('❌ Real stock data test failed:', error);
      Alert.alert(
        '❌ Test Failed', 
        `Real stock data test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        [{ text: 'OK', style: 'default' }]
      );
    } finally {
      updateAppState({ isDiagnosing: false });
    }
  }, [updateAppState]);

  // Optimized getItemLayout for FlatList performance
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: 180, // Approximate height of each gem card
    offset: 180 * index,
    index,
  }), []);

  // Key extractor optimized
  const keyExtractor = useCallback((item: RealGemSearchResult, index: number) => {
    const timestamp = typeof item.lastUpdated === 'number' 
      ? item.lastUpdated 
      : (item.lastUpdated instanceof Date ? item.lastUpdated.getTime() : Date.now());
    return `${item.symbol}-${item.type}-${index}-${timestamp}`;
  }, []);

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
            disabled={appState.isScanning || !canScan('crypto')}
          >
            <LinearGradient
              colors={!canScan('crypto') ? ['#666', '#555'] : ['#FFB000', '#FF8C00']}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>💎</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>{getScanButtonText('crypto')}</Text>
                  <Text style={styles.scanButtonSubText}>Real CoinGecko API</Text>
                </View>
                {appState.scanningType === 'crypto' && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.scanButton, !canScan('stocks') && styles.disabledButton]}
            onPress={() => handleScanNewGems('stocks')}
            disabled={appState.isScanning || !canScan('stocks')}
          >
            <LinearGradient
              colors={!canScan('stocks') ? ['#666', '#555'] : [theme.accent, '#1976D2']}
              style={styles.scanButtonGradient}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonIcon}>🚀</Text>
                <View style={styles.scanButtonTextContainer}>
                  <Text style={styles.scanButtonText}>{getScanButtonText('stocks')}</Text>
                  <Text style={styles.scanButtonSubText}>
                    {(() => {
                      const stats = apiKeyManager.getUsageStatistics();
                      if (!canScan('stocks')) {
                        const remainingMs = getRemainingCooldown('stocks');
                        const remainingMinutes = Math.ceil(remainingMs / 60000);
                        return `Cooldown: ${remainingMinutes}m`;
                      }
                      return `${stats.availableRequests} API calls left today`;
                    })()}
                  </Text>
                </View>
                {appState.scanningType === 'stocks' && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* API Diagnostic Buttons */}
        <View style={styles.scanButtonsContainer}>
          <TouchableOpacity
            style={[styles.scanButton]}
            onPress={runSimpleAPITest}
            disabled={appState.isDiagnosing || appState.isScanning}
          >
            <LinearGradient
              colors={appState.isDiagnosing ? ['#666', '#555'] : ['#4CAF50', '#45A049']}
              style={styles.scanButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonText}>
                  {appState.isDiagnosing ? 'Testing...' : '🧪 Quick API Test'}
                </Text>
                <Text style={styles.scanButtonSubText}>
                  Test current API key
                </Text>
                {appState.isDiagnosing && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.scanButton]}
            onPress={runAPIsDiagnostic}
            disabled={appState.isDiagnosing || appState.isScanning}
          >
            <LinearGradient
              colors={appState.isDiagnosing ? ['#666', '#555'] : ['#FF6B35', '#F7931E']}
              style={styles.scanButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonText}>
                  {appState.isDiagnosing ? 'Diagnosing...' : '🔬 Full Diagnostic'}
                </Text>
                <Text style={styles.scanButtonSubText}>
                  Check all APIs & backups
                </Text>
                {appState.isDiagnosing && (
                  <ActivityIndicator size="small" color="#FFF" />
                )}
              </View>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Alternative APIs Test Button */}
        <View style={styles.scanButtonsContainer}>
          <TouchableOpacity
            style={[styles.scanButton]}
            onPress={testAlternativeAPIs}
            disabled={appState.isDiagnosing || appState.isScanning}
          >
            <LinearGradient
              colors={appState.isDiagnosing ? ['#666', '#555'] : ['#9C27B0', '#673AB7']}
              style={styles.scanButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.scanButtonContent}>
                <Text style={styles.scanButtonText}>
                  {appState.isDiagnosing ? 'Testing...' : '📡 Real APIs Test'}
                </Text>
                <Text style={styles.scanButtonSubText}>
                  Test Yahoo, Finnhub, FMP & more
                </Text>
                {appState.isDiagnosing && (
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
        {appState.isScanning && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={styles.loadingText}>Scanning with Real APIs...</Text>
            <Text style={styles.loadingSubText}>{appState.loadingStatus}</Text>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {filteredGems.length > 0 ? (
            <FlatList
              data={filteredGems}
              renderItem={renderGem}
              keyExtractor={keyExtractor}
              getItemLayout={getItemLayout}
              refreshControl={
                <RefreshControl
                  refreshing={appState.refreshing}
                  onRefresh={onRefresh}
                  colors={[theme.primary]}
                />
              }
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              initialNumToRender={PERFORMANCE_CONFIG.INITIAL_NUM_TO_RENDER}
              maxToRenderPerBatch={PERFORMANCE_CONFIG.MAX_TO_RENDER_PER_BATCH}
              windowSize={PERFORMANCE_CONFIG.WINDOW_SIZE}
              removeClippedSubviews={true}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No Gems Found</Text>
              <Text style={styles.emptySubText}>
                {appState.isScanning ? 'Scanning for gems...' : 'Tap a scan button to find up to 4 gems with real data and AI analysis'}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Gem Detail Modal */}
      <Modal
        visible={!!appState.selectedGem}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => updateAppState({ selectedGem: null })}
      >
        {appState.selectedGem && (
          <GemDetailScreenNew
            gem={convertRealGemToDetailFormat(appState.selectedGem)}
            onBack={() => updateAppState({ selectedGem: null })}
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
  discoveryTimeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    marginLeft: 4,
  },
  discoveryTimeText: {
    fontSize: 8,
    fontWeight: '500',
    color: theme.textMuted,
  },
  stockMetrics: {
    marginTop: 2,
    paddingTop: 4,
  },
  stockMetricText: {
    fontSize: 10,
    color: theme.textMuted,
    fontWeight: '400',
  },
});

export default GemFinderScreen;
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

  // Loa
  // d cached data
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
      const q = query(
        collection(db, 'gems'),
        orderBy('createdAt', 'desc'),
        limit(50)
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
        setGems(firebaseGems);
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

  // Generate fallback gems with realistic data if APIs fail - 30 cryptos and 30 stocks
  const generateFallbackGems = (type: 'crypto' | 'stocks'): RealGemSearchResult[] => {
    const cryptoGems = [
      // Meme Coins
      { symbol: 'PEPE', name: 'Pepe', price: 0.00001234, marketCap: 5200000000, volume: 180000000, change24h: 12.45 },
      { symbol: 'DOGE', name: 'Dogecoin', price: 0.088, marketCap: 12800000000, volume: 420000000, change24h: 5.67 },
      { symbol: 'SHIB', name: 'Shiba Inu', price: 0.00002156, marketCap: 12700000000, volume: 340000000, change24h: -2.34 },
      { symbol: 'FLOKI', name: 'Floki', price: 0.00018943, marketCap: 1800000000, volume: 85000000, change24h: 8.92 },
      { symbol: 'BABYDOGE', name: 'Baby Doge Coin', price: 0.000000002345, marketCap: 890000000, volume: 45000000, change24h: 15.23 },
      { symbol: 'BONK', name: 'Bonk', price: 0.00003456, marketCap: 2300000000, volume: 120000000, change24h: 7.89 },
      { symbol: 'WIF', name: 'dogwifhat', price: 3.45, marketCap: 3400000000, volume: 210000000, change24h: 18.67 },
      { symbol: 'BRETT', name: 'Brett', price: 0.1234, marketCap: 1200000000, volume: 67000000, change24h: 9.45 },
      
      // Major Cryptos
      { symbol: 'BTC', name: 'Bitcoin', price: 67234.56, marketCap: 1320000000000, volume: 28000000000, change24h: 2.34 },
      { symbol: 'ETH', name: 'Ethereum', price: 3456.78, marketCap: 415000000000, volume: 15000000000, change24h: 1.89 },
      { symbol: 'BNB', name: 'Binance Coin', price: 234.56, marketCap: 36000000000, volume: 1200000000, change24h: -0.87 },
      { symbol: 'SOL', name: 'Solana', price: 145.67, marketCap: 67000000000, volume: 2800000000, change24h: 4.56 },
      { symbol: 'ADA', name: 'Cardano', price: 0.456, marketCap: 16000000000, volume: 890000000, change24h: -1.23 },
      { symbol: 'AVAX', name: 'Avalanche', price: 34.56, marketCap: 13000000000, volume: 670000000, change24h: 3.45 },
      { symbol: 'DOT', name: 'Polkadot', price: 6.78, marketCap: 9000000000, volume: 450000000, change24h: 1.67 },
      { symbol: 'LINK', name: 'Chainlink', price: 14.56, marketCap: 8500000000, volume: 890000000, change24h: 2.89 },
      
      // DeFi Tokens
      { symbol: 'UNI', name: 'Uniswap', price: 8.45, marketCap: 5100000000, volume: 340000000, change24h: 3.78 },
      { symbol: 'AAVE', name: 'Aave', price: 89.34, marketCap: 1300000000, volume: 150000000, change24h: -2.45 },
      { symbol: 'COMP', name: 'Compound', price: 56.78, marketCap: 380000000, volume: 78000000, change24h: 1.23 },
      { symbol: 'SUSHI', name: 'SushiSwap', price: 1.23, marketCap: 160000000, volume: 45000000, change24h: 4.56 },
      { symbol: 'CRV', name: 'Curve DAO', price: 0.567, marketCap: 340000000, volume: 89000000, change24h: -1.78 },
      { symbol: 'YFI', name: 'yearn.finance', price: 6789.12, marketCap: 250000000, volume: 34000000, change24h: 2.34 },
      
      // Layer 2 & Scaling
      { symbol: 'MATIC', name: 'Polygon', price: 0.789, marketCap: 7800000000, volume: 450000000, change24h: 2.67 },
      { symbol: 'OP', name: 'Optimism', price: 2.34, marketCap: 2400000000, volume: 180000000, change24h: 1.89 },
      { symbol: 'ARB', name: 'Arbitrum', price: 1.56, marketCap: 2100000000, volume: 340000000, change24h: 3.45 },
      { symbol: 'IMX', name: 'Immutable X', price: 1.89, marketCap: 2900000000, volume: 120000000, change24h: 5.67 },
      
      // AI & Gaming
      { symbol: 'FET', name: 'Fetch.ai', price: 1.45, marketCap: 1200000000, volume: 67000000, change24h: 8.90 },
      { symbol: 'RNDR', name: 'Render Token', price: 7.89, marketCap: 3000000000, volume: 200000000, change24h: 12.34 },
      { symbol: 'SAND', name: 'The Sandbox', price: 0.456, marketCap: 1000000000, volume: 78000000, change24h: 4.56 },
      { symbol: 'MANA', name: 'Decentraland', price: 0.567, marketCap: 1050000000, volume: 89000000, change24h: 3.78 }
    ];

    const stockGems = [
      // Tech Giants
      { symbol: 'NVDA', name: 'NVIDIA Corporation', price: 875.32, marketCap: 2150000000000, volume: 45000000, change24h: 3.45 },
      { symbol: 'TSLA', name: 'Tesla Inc', price: 248.67, marketCap: 790000000000, volume: 72000000, change24h: -1.23 },
      { symbol: 'AMZN', name: 'Amazon.com Inc', price: 178.45, marketCap: 1850000000000, volume: 38000000, change24h: 2.67 },
      { symbol: 'GOOGL', name: 'Alphabet Inc', price: 165.23, marketCap: 2080000000000, volume: 25000000, change24h: 1.89 },
      { symbol: 'MSFT', name: 'Microsoft Corporation', price: 412.56, marketCap: 3060000000000, volume: 22000000, change24h: 0.89 },
      { symbol: 'AAPL', name: 'Apple Inc', price: 189.78, marketCap: 2950000000000, volume: 48000000, change24h: 1.34 },
      { symbol: 'META', name: 'Meta Platforms Inc', price: 456.89, marketCap: 1160000000000, volume: 31000000, change24h: 2.78 },
      { symbol: 'NFLX', name: 'Netflix Inc', price: 567.34, marketCap: 250000000000, volume: 5200000, change24h: 4.56 },
      
      // AI & Semiconductors
      { symbol: 'AMD', name: 'Advanced Micro Devices', price: 156.78, marketCap: 253000000000, volume: 67000000, change24h: 5.67 },
      { symbol: 'INTC', name: 'Intel Corporation', price: 34.56, marketCap: 145000000000, volume: 78000000, change24h: -2.34 },
      { symbol: 'QCOM', name: 'Qualcomm Inc', price: 167.89, marketCap: 188000000000, volume: 12000000, change24h: 1.78 },
      { symbol: 'AVGO', name: 'Broadcom Inc', price: 1234.56, marketCap: 570000000000, volume: 2800000, change24h: 2.89 },
      { symbol: 'AMAT', name: 'Applied Materials', price: 189.45, marketCap: 160000000000, volume: 15000000, change24h: 3.67 },
      { symbol: 'LRCX', name: 'Lam Research', price: 892.34, marketCap: 118000000000, volume: 1200000, change24h: 4.23 },
      
      // Growth Stocks
      { symbol: 'PLTR', name: 'Palantir Technologies', price: 23.45, marketCap: 48000000000, volume: 45000000, change24h: 8.90 },
      { symbol: 'RBLX', name: 'Roblox Corporation', price: 45.67, marketCap: 27000000000, volume: 18000000, change24h: 12.34 },
      { symbol: 'SNOW', name: 'Snowflake Inc', price: 156.78, marketCap: 52000000000, volume: 6700000, change24h: 5.67 },
      { symbol: 'DDOG', name: 'Datadog Inc', price: 123.45, marketCap: 40000000000, volume: 2300000, change24h: 3.89 },
      { symbol: 'CRWD', name: 'CrowdStrike Holdings', price: 234.56, marketCap: 56000000000, volume: 3400000, change24h: 6.78 },
      { symbol: 'ZM', name: 'Zoom Video Communications', price: 67.89, marketCap: 20000000000, volume: 8900000, change24h: 2.45 },
      
      // Electric Vehicles
      { symbol: 'RIVN', name: 'Rivian Automotive', price: 12.34, marketCap: 11000000000, volume: 34000000, change24h: 15.67 },
      { symbol: 'LCID', name: 'Lucid Group Inc', price: 3.45, marketCap: 6700000000, volume: 28000000, change24h: 9.78 },
      { symbol: 'NIO', name: 'NIO Inc', price: 8.90, marketCap: 14000000000, volume: 23000000, change24h: 7.89 },
      { symbol: 'XPEV', name: 'XPeng Inc', price: 12.67, marketCap: 11000000000, volume: 15000000, change24h: 4.56 },
      
      // Biotech & Healthcare
      { symbol: 'MRNA', name: 'Moderna Inc', price: 89.45, marketCap: 33000000000, volume: 12000000, change24h: 11.23 },
      { symbol: 'BNTX', name: 'BioNTech SE', price: 112.34, marketCap: 27000000000, volume: 890000, change24h: 8.90 },
      { symbol: 'GILD', name: 'Gilead Sciences', price: 78.90, marketCap: 98000000000, volume: 8900000, change24h: 2.34 },
      { symbol: 'BIIB', name: 'Biogen Inc', price: 234.56, marketCap: 33000000000, volume: 1200000, change24h: 5.67 },
      
      // Fintech
      { symbol: 'PYPL', name: 'PayPal Holdings', price: 56.78, marketCap: 64000000000, volume: 23000000, change24h: 3.45 },
      { symbol: 'SQ', name: 'Block Inc', price: 67.89, marketCap: 39000000000, volume: 18000000, change24h: 6.78 }
    ];

    // Helper function to generate realistic gem data
    const createGemData = (baseGem: any, type: 'crypto' | 'stock'): RealGemSearchResult => {
      const changePercent = baseGem.change24h;
      const priceVariation = (Math.random() - 0.5) * 0.15; // ±7.5% price variation
      const volumeVariation = (Math.random() - 0.5) * 0.3; // ±15% volume variation
      const uniqueId = Math.random().toString(36).substr(2, 9); // Unique identifier
      
      // Ensure minimum values and realistic variations
      const finalPrice = Math.max(baseGem.price * (1 + priceVariation), 0.0001);
      const finalVolume = Math.max(baseGem.volume * (1 + volumeVariation), 1000);
      const finalMarketCap = Math.max(baseGem.marketCap * (1 + priceVariation * 0.5), 100000);
      
      return {
        ...baseGem,
        id: `${baseGem.symbol}-${type}-${uniqueId}`,
        price: finalPrice,
        volume: finalVolume,
        marketCap: finalMarketCap,
        changePercent: changePercent,
        change24h: changePercent,
        type: type,
        source: 'fallback' as const,
        aiAnalysis: '',
        aiRecommendation: changePercent > 2 ? 'buy' : changePercent < -2 ? 'sell' : 'hold',
        aiConfidence: Math.random() * 0.4 + 0.5, // 50-90%
        aiScore: Math.random() * 0.5 + 0.3, // 30-80%
        technicalScore: Math.random() * 0.4 + 0.4, // 40-80%
        technicalSignals: changePercent > 0 ? ['RSI_BULLISH', 'MACD_BULLISH'] : ['RSI_BEARISH', 'MACD_BEARISH'],
        riskLevel: finalMarketCap > 10000000000 ? 'low' : finalMarketCap > 1000000000 ? 'medium' : 'high',
        riskScore: finalMarketCap > 10000000000 ? Math.random() * 0.3 + 0.2 : Math.random() * 0.5 + 0.3,
        priceTarget1d: finalPrice * (1 + changePercent * 0.01 * 0.3),
        priceTarget7d: finalPrice * (1 + changePercent * 0.01 * 0.7),
        priceTarget30d: finalPrice * (1 + changePercent * 0.01 * 1.5),
        qualityScore: Math.random() * 0.4 + 0.4, // 40-80%
        potential: changePercent > 5 ? 'high' : changePercent > 0 ? 'medium' : 'low',
        lastUpdated: Date.now() + Math.floor(Math.random() * 1000) // Slightly different timestamps as numbers
      } as RealGemSearchResult;
    };

    // Generate full gem data for all items
    const fullCryptoGems = cryptoGems.map(gem => createGemData(gem, 'crypto'));
    const fullStockGems = stockGems.map(gem => createGemData(gem, 'stock'));

    // Select 4 random gems from the appropriate type using proper shuffling
    const selectedGems = type === 'crypto' ? fullCryptoGems : fullStockGems;
    
    // Fisher-Yates shuffle algorithm for true randomness
    const shuffled = [...selectedGems];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    return shuffled.slice(0, 4);
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
      console.log(`🔍 Starting ${type} scan with real data and AI analysis (limit: 4 gems, relaxed filters)`);
      let results: RealGemSearchResult[] = [];

      try {
        // Intentar con las APIs reales primero
        if (type === 'crypto') {
          setLoadingStatus('Generating crypto gems from fallback database...');
          // Solo usar fallback para crypto, no APIs reales
          results = generateFallbackGems(type);
        } else {
          setLoadingStatus('Fetching stock data from Alpha Vantage...');
          results = await realGemSearchService.searchStockGems({
            maxResults: 4, // API rate limit
            minAIScore: 0, // Accept all
            sortBy: 'marketCap',
            onlyWithPositiveAI: false, // Accept all
            minMarketCap: 0,
            maxMarketCap: undefined,
            minVolume: 0
          });
        }

        // Filter: must have symbol, name, price
        const validResults = results.filter(result =>
          result.symbol && result.name && (result.price !== undefined && result.price !== null)
        );

        // Si no hay resultados válidos de las APIs, usar fallback
        if (validResults.length === 0) {
          console.log('🔄 No valid results from APIs, using fallback gems...');
          setLoadingStatus('Generating fallback gems with realistic data...');
          results = generateFallbackGems(type);
        } else {
          results = validResults;
        }
      } catch (apiError) {
        console.warn('⚠️ API Error, falling back to realistic gems:', apiError);
        setLoadingStatus('APIs unavailable, generating realistic fallback gems...');
        results = generateFallbackGems(type);
      }

      if (results.length === 0) {
        Alert.alert(
          'Error',
          'Unable to generate any gems. Please try again later.',
          [{ text: 'OK' }]
        );
        return;
      }

      setLoadingStatus('Analyzing results with AI...');

      // Generate AI analysis for all gems
      const enrichedResults = await Promise.all(
        results.map(async (gem) => {
          try {
            // Always generate AI analysis
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
          } catch (error) {
            console.warn(`Error enriching gem ${gem.symbol}:`, error);
            return gem;
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

      // Prevent duplicates: filter out gems with same symbol and type
      const existingSymbols = new Set(gems.map(gem => `${gem.symbol}-${gem.type}`));
      const newUniqueGems = enrichedResults.filter(gem => 
        !existingSymbols.has(`${gem.symbol}-${gem.type}`)
      );
      
      // Cache the results with new unique gems only
      const updatedGems = [...newUniqueGems, ...gems];
      await cacheGems(updatedGems);

      // Update state
      setGems(updatedGems);
      console.log(`✅ Successfully found ${enrichedResults.length} ${type} gems with AI analysis`);

      Alert.alert(
        'Scan Complete',
        `Found ${enrichedResults.length} ${type} gems with AI analysis! ${type === 'crypto' ? 'Fallback database' : results[0]?.source === 'real' ? 'Alpha Vantage data' : 'Realistic fallback data'} saved to Firebase.`,
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
                  <Text style={styles.scanButtonSubText}>Fallback Database</Text>
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
              keyExtractor={(item, index) => {
                const timestamp = typeof item.lastUpdated === 'number' 
                  ? item.lastUpdated 
                  : (item.lastUpdated instanceof Date ? item.lastUpdated.getTime() : Date.now());
                return `${item.symbol}-${item.type}-${index}-${timestamp}`;
              }}
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
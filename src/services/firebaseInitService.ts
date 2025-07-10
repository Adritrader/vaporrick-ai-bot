import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';

import { firebaseService } from './firebaseService';
import type { 
  GemFirestore, 
  AutoTradeFirestore, 
  StrategyFirestore, 
  MarketDataFirestore, 
  OpportunityFirestore 
} from './firebaseService';

// Sample data for initialization
const SAMPLE_GEMS: Omit<GemFirestore, 'id' | 'createdAt' | 'lastUpdated'>[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 43250.00,
    marketCap: 845000000000,
    volume24h: 23450000000,
    change24h: 2.35,
    description: 'The original cryptocurrency and digital store of value',
    aiScore: 8.7,
    risk: 'Medium',
    category: 'Layer 1',
    launchDate: '2009-01-03',
    type: 'crypto',
    social: {
      twitter: true,
      telegram: true,
      discord: true
    },
    fundamentals: {
      team: 9,
      tech: 10,
      tokenomics: 9,
      community: 10
    },
    aiAnalysis: 'Strong institutional adoption and store of value narrative. Technical indicators show bullish momentum with support at $40k.',
    potential: 'High',
    timeframe: '3-6 months'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 2650.00,
    marketCap: 318000000000,
    volume24h: 15200000000,
    change24h: 3.12,
    description: 'Leading smart contract platform with extensive DeFi ecosystem',
    aiScore: 9.1,
    risk: 'Medium',
    category: 'Layer 1',
    launchDate: '2015-07-30',
    type: 'crypto',
    social: {
      twitter: true,
      telegram: true,
      discord: true
    },
    fundamentals: {
      team: 10,
      tech: 9,
      tokenomics: 8,
      community: 9
    },
    aiAnalysis: 'Ethereum continues to dominate smart contract space. Upcoming upgrades and Layer 2 scaling solutions show strong fundamentals.',
    potential: 'Very High',
    timeframe: '2-4 months'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 185.92,
    marketCap: 2890000000000,
    volume24h: 89500000,
    change24h: 1.25,
    description: 'Technology giant specializing in consumer electronics and software',
    aiScore: 8.5,
    risk: 'Low',
    category: 'Technology',
    launchDate: '1980-12-12',
    type: 'stock',
    social: {
      twitter: true,
      telegram: false,
      discord: false
    },
    fundamentals: {
      team: 9,
      tech: 9,
      tokenomics: 8,
      community: 9
    },
    aiAnalysis: 'Strong fundamentals with diversified revenue streams. iPhone sales remain robust with services growth accelerating.',
    potential: 'High',
    timeframe: '6-12 months'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 745.30,
    marketCap: 1840000000000,
    volume24h: 156000000,
    change24h: 4.67,
    description: 'Leading AI and graphics processing unit manufacturer',
    aiScore: 9.3,
    risk: 'Medium',
    category: 'Technology',
    launchDate: '1999-01-22',
    type: 'stock',
    social: {
      twitter: true,
      telegram: false,
      discord: false
    },
    fundamentals: {
      team: 9,
      tech: 10,
      tokenomics: 8,
      community: 8
    },
    aiAnalysis: 'Leading the AI revolution with dominant GPU market share. Data center growth and AI adoption driving strong revenue.',
    potential: 'Very High',
    timeframe: '3-9 months'
  }
];

const SAMPLE_STRATEGIES: Omit<StrategyFirestore, 'id' | 'createdAt' | 'lastUsed'>[] = [
  {
    name: 'AI Momentum Pro',
    type: 'momentum',
    parameters: {
      confidence_threshold: 0.75,
      risk_threshold: 0.25,
      position_size: 0.1,
      stop_loss: 0.08,
      take_profit: 0.15,
      holding_period_max: 30
    },
    isActive: true,
    performance: {
      totalReturn: 23.5,
      sharpeRatio: 1.8,
      maxDrawdown: -12.3,
      winRate: 67.5,
      totalTrades: 45
    }
  },
  {
    name: 'Breakout Hunter',
    type: 'breakout',
    parameters: {
      confidence_threshold: 0.8,
      risk_threshold: 0.2,
      position_size: 0.15,
      stop_loss: 0.06,
      take_profit: 0.20,
      holding_period_max: 21
    },
    isActive: true,
    performance: {
      totalReturn: 18.7,
      sharpeRatio: 1.6,
      maxDrawdown: -8.9,
      winRate: 72.3,
      totalTrades: 32
    }
  },
  {
    name: 'Mean Reversion Scalper',
    type: 'mean_reversion',
    parameters: {
      confidence_threshold: 0.7,
      risk_threshold: 0.3,
      position_size: 0.08,
      stop_loss: 0.05,
      take_profit: 0.10,
      holding_period_max: 14
    },
    isActive: false,
    performance: {
      totalReturn: 12.4,
      sharpeRatio: 1.3,
      maxDrawdown: -6.7,
      winRate: 78.1,
      totalTrades: 89
    }
  }
];

const SAMPLE_AUTO_TRADES: Omit<AutoTradeFirestore, 'id' | 'createdAt' | 'lastUpdated'>[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    entryPrice: 42100.00,
    currentPrice: 43250.00,
    targetPrice: 48500.00,
    stopLoss: 39500.00,
    quantity: 0.25,
    side: 'long',
    confidence: 0.82,
    status: 'active',
    pnl: 287.50,
    pnlPercentage: 2.73,
    timestamp: Timestamp.now(),
    strategy: 'AI Momentum Pro',
    analysis: 'Strong bullish momentum with RSI showing oversold bounce potential. Volume confirmation and institutional buying activity.'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    entryPrice: 2580.00,
    currentPrice: 2650.00,
    targetPrice: 2950.00,
    stopLoss: 2420.00,
    quantity: 3.8,
    side: 'long',
    confidence: 0.78,
    status: 'active',
    pnl: 266.00,
    pnlPercentage: 2.71,
    timestamp: Timestamp.now(),
    strategy: 'Breakout Hunter',
    analysis: 'Breakout above resistance with high volume. DeFi activity increasing and Layer 2 adoption accelerating.'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    entryPrice: 178.45,
    currentPrice: 185.92,
    targetPrice: 198.00,
    stopLoss: 172.00,
    quantity: 50,
    side: 'long',
    confidence: 0.75,
    status: 'completed',
    pnl: 373.50,
    pnlPercentage: 4.19,
    timestamp: Timestamp.now(),
    strategy: 'AI Momentum Pro',
    analysis: 'Earnings beat expectations with strong iPhone sales. Services revenue growing consistently.'
  }
];

const SAMPLE_MARKET_DATA: Omit<MarketDataFirestore, 'id' | 'createdAt' | 'lastUpdated'>[] = [
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    price: 43250.00,
    change: 987.50,
    changePercent: 2.35,
    marketCap: 845000000000,
    volume24h: 23450000000,
    type: 'crypto'
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    price: 2650.00,
    change: 80.25,
    changePercent: 3.12,
    marketCap: 318000000000,
    volume24h: 15200000000,
    type: 'crypto'
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    price: 185.92,
    change: 2.30,
    changePercent: 1.25,
    marketCap: 2890000000000,
    volume24h: 89500000,
    type: 'stock'
  },
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    price: 745.30,
    change: 33.18,
    changePercent: 4.67,
    marketCap: 1840000000000,
    volume24h: 156000000,
    type: 'stock'
  }
];

const SAMPLE_OPPORTUNITIES: Omit<OpportunityFirestore, 'id' | 'createdAt'>[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    currentPrice: 98.45,
    predictedPrice: 125.60,
    confidence: 0.84,
    timeframe: '2-4 weeks',
    analysis: 'Strong ecosystem growth with increasing DeFi and NFT activity. Technical breakout pattern forming.',
    type: 'breakout',
    expectedReturn: 27.6,
    riskScore: 6.2,
    autoExecuted: false,
    expiresAt: new Timestamp(Math.floor(Date.now() / 1000) + (14 * 24 * 60 * 60), 0) // 2 weeks from now
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    currentPrice: 412.18,
    predictedPrice: 445.30,
    confidence: 0.79,
    timeframe: '4-8 weeks',
    analysis: 'AI integration across products driving revenue growth. Cloud services expansion continues.',
    type: 'momentum',
    expectedReturn: 8.0,
    riskScore: 3.8,
    autoExecuted: false,
    expiresAt: new Timestamp(Math.floor(Date.now() / 1000) + (28 * 24 * 60 * 60), 0) // 4 weeks from now
  },
  {
    symbol: 'LINK',
    name: 'Chainlink',
    currentPrice: 14.87,
    predictedPrice: 18.90,
    confidence: 0.76,
    timeframe: '3-6 weeks',
    analysis: 'Oracle adoption increasing with smart contract integration across multiple blockchains.',
    type: 'momentum',
    expectedReturn: 27.1,
    riskScore: 7.1,
    autoExecuted: false,
    expiresAt: new Timestamp(Math.floor(Date.now() / 1000) + (21 * 24 * 60 * 60), 0) // 3 weeks from now
  }
];

class FirebaseInitService {
  private initialized = false;
  private initPromise: Promise<boolean> | null = null;

  /**
   * Initialize Firebase collections with sample data
   * This method is idempotent - safe to call multiple times
   */
  async initializeCollections(): Promise<boolean> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._performInitialization();
    return this.initPromise;
  }

  private async _performInitialization(): Promise<boolean> {
    try {
      console.log('🔥 Starting Firebase collections initialization...');

      // First, test Firebase connection
      const connectionTest = await firebaseService.testConnection();
      if (!connectionTest.success) {
        console.error('❌ Firebase connection failed, cannot initialize:', connectionTest.error);
        return false;
      }

      // Check if already initialized by looking for existing data
      const existingGems = await firebaseService.getGems();
      if (existingGems.length > 0) {
        console.log('✅ Firebase collections already initialized');
        this.initialized = true;
        return true;
      }

      console.log('📦 Initializing Firebase collections with sample data...');

      // Initialize each collection
      await this.initializeGems();
      await this.initializeStrategies();
      await this.initializeAutoTrades();
      await this.initializeMarketData();
      await this.initializeOpportunities();
      await this.initializeSettings();

      this.initialized = true;
      console.log('✅ Firebase collections initialization completed successfully');
      return true;

    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      
      if (error instanceof Error && error.message.includes('permission')) {
        console.error(`
🚨 PERMISSION ERROR DETECTED 🚨

Firebase rules are blocking access. Please:
1. Go to Firebase Console > Firestore Database > Rules
2. Replace rules with: allow read, write: if true;
3. Publish changes and restart the app

Current error: ${error.message}
        `);
      }
      
      this.initPromise = null; // Reset to allow retry
      return false;
    }
  }

  private async initializeGems(): Promise<void> {
    console.log('📊 Initializing gems collection...');
    
    const gemsWithTimestamps = SAMPLE_GEMS.map(gem => ({
      ...gem,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }));
    
    await firebaseService.saveGems(gemsWithTimestamps);
    console.log(`✅ Added ${SAMPLE_GEMS.length} sample gems`);
  }

  private async initializeStrategies(): Promise<void> {
    console.log('🎯 Initializing strategies collection...');
    
    for (const strategy of SAMPLE_STRATEGIES) {
      const strategyWithTimestamps: Omit<StrategyFirestore, 'id'> = {
        ...strategy,
        createdAt: serverTimestamp()
      };
      
      await firebaseService.saveStrategy(strategyWithTimestamps);
    }
    
    console.log(`✅ Added ${SAMPLE_STRATEGIES.length} sample strategies`);
  }

  private async initializeAutoTrades(): Promise<void> {
    console.log('🤖 Initializing auto trades collection...');
    
    for (const trade of SAMPLE_AUTO_TRADES) {
      const tradeWithTimestamps: Omit<AutoTradeFirestore, 'id'> = {
        ...trade,
        createdAt: serverTimestamp(),
        lastUpdated: serverTimestamp()
      };
      
      await firebaseService.saveAutoTrade(tradeWithTimestamps);
    }
    
    console.log(`✅ Added ${SAMPLE_AUTO_TRADES.length} sample auto trades`);
  }

  private async initializeMarketData(): Promise<void> {
    console.log('📈 Initializing market data collection...');
    
    const marketDataWithTimestamps = SAMPLE_MARKET_DATA.map(data => ({
      ...data,
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }));
    
    await firebaseService.saveMarketData(marketDataWithTimestamps);
    console.log(`✅ Added ${SAMPLE_MARKET_DATA.length} sample market data entries`);
  }

  private async initializeOpportunities(): Promise<void> {
    console.log('💎 Initializing opportunities collection...');
    
    const opportunitiesWithTimestamps = SAMPLE_OPPORTUNITIES.map(opportunity => ({
      ...opportunity,
      createdAt: serverTimestamp()
    }));
    
    await firebaseService.saveOpportunities(opportunitiesWithTimestamps);
    console.log(`✅ Added ${SAMPLE_OPPORTUNITIES.length} sample opportunities`);
  }

  private async initializeSettings(): Promise<void> {
    console.log('⚙️ Initializing settings collection...');
    
    const defaultSettings = {
      app: {
        version: '1.0.0',
        theme: 'dark',
        notifications: true,
        autoRefresh: true,
        refreshInterval: 30000
      },
      trading: {
        defaultPositionSize: 0.1,
        maxPositions: 10,
        riskTolerance: 'medium',
        autoTradeEnabled: true
      },
      ai: {
        confidenceThreshold: 0.75,
        riskThreshold: 0.25,
        modelVersion: 'v2.1',
        lastTrainingDate: new Date().toISOString()
      },
      firebase: {
        syncEnabled: true,
        cacheSize: 1000,
        offlineMode: true,
        lastSync: serverTimestamp()
      },
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    };

    // Use setDoc to create the settings document with a fixed ID
    const db = getFirestore();
    await setDoc(doc(db, 'settings', 'app_settings'), defaultSettings);
    
    console.log('✅ Added default app settings');
  }

  /**
   * Check if Firebase collections are initialized
   */
  async isInitialized(): Promise<boolean> {
    try {
      const gems = await firebaseService.getGems();
      return gems.length > 0;
    } catch (error) {
      console.error('Error checking initialization status:', error);
      return false;
    }
  }

  /**
   * Force re-initialization (useful for development/testing)
   */
  async reinitialize(): Promise<boolean> {
    this.initialized = false;
    this.initPromise = null;
    return this.initializeCollections();
  }

  /**
   * Get initialization statistics
   */
  async getInitStats(): Promise<{
    gems: number;
    strategies: number;
    autoTrades: number;
    marketData: number;
    opportunities: number;
    isInitialized: boolean;
  }> {
    try {
      const [gems, strategies, autoTrades, marketData, opportunities] = await Promise.all([
        firebaseService.getGems(),
        firebaseService.getStrategies(),
        firebaseService.getAutoTrades(),
        firebaseService.getMarketData(),
        firebaseService.getOpportunities()
      ]);

      return {
        gems: gems.length,
        strategies: strategies.length,
        autoTrades: autoTrades.length,
        marketData: marketData.length,
        opportunities: opportunities.length,
        isInitialized: gems.length > 0
      };
    } catch (error) {
      console.error('Error getting init stats:', error);
      return {
        gems: 0,
        strategies: 0,
        autoTrades: 0,
        marketData: 0,
        opportunities: 0,
        isInitialized: false
      };
    }
  }
}

export const firebaseInitService = new FirebaseInitService();
export default firebaseInitService;

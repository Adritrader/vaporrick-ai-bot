import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  FieldValue 
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { firebaseConfig, isFirebaseAvailable } from '../config/firebaseConfig';

// Initialize Firebase only if configuration is complete
let app: any = null;
let db: any = null;
let firebaseEnabled = false;

try {
  if (isFirebaseAvailable()) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    firebaseEnabled = true;
    console.log('✅ Firebase initialized successfully');
  } else {
    console.log('📱 Using local storage fallback instead of Firebase');
  }
} catch (error) {
  console.warn('⚠️ Firebase initialization failed, using local storage:', error);
  firebaseEnabled = false;
}

// Collection names
const COLLECTIONS = {
  GEMS: 'gems',
  STRATEGIES: 'strategies',
  AUTO_TRADES: 'autoTrades',
  BACKTEST_RESULTS: 'backtestResults',
  MARKET_DATA: 'marketData',
  OPPORTUNITIES: 'opportunities',
  ALERTS: 'alerts',
  SETTINGS: 'settings'
} as const;

// Interfaces for Firebase documents
export interface GemFirestore {
  id?: string;
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
  lastUpdated: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
}

export interface AutoTradeFirestore {
  id?: string;
  symbol: string;
  name: string;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  quantity: number;
  side: 'long' | 'short';
  confidence: number;
  status: 'active' | 'completed' | 'stopped';
  pnl: number;
  pnlPercentage: number;
  timestamp: Timestamp;
  strategy: string;
  analysis: string;
  lastUpdated: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
}

export interface StrategyFirestore {
  id?: string;
  name: string;
  type: 'breakout' | 'reversal' | 'momentum' | 'mean_reversion' | 'ai_mixed';
  parameters: {
    confidence_threshold: number;
    risk_threshold: number;
    position_size: number;
    stop_loss: number;
    take_profit: number;
    holding_period_max: number;
  };
  isActive: boolean;
  performance?: {
    totalReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
  };
  createdAt: Timestamp | FieldValue;
  lastUsed?: Timestamp;
}

export interface MarketDataFirestore {
  id?: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: number;
  volume24h: number;
  type: 'crypto' | 'stock';
  lastUpdated: Timestamp | FieldValue;
  createdAt: Timestamp | FieldValue;
}

export interface OpportunityFirestore {
  id?: string;
  symbol: string;
  name: string;
  currentPrice: number;
  predictedPrice: number;
  confidence: number;
  timeframe: string;
  analysis: string;
  type: 'breakout' | 'reversal' | 'momentum' | 'mean_reversion';
  expectedReturn: number;
  riskScore: number;
  autoExecuted: boolean;
  createdAt: Timestamp | FieldValue;
  expiresAt: Timestamp;
}

export interface BacktestResultFirestore {
  id?: string;
  symbol: string;
  strategy: string;
  period: string;
  startDate: string;
  endDate: string;
  initialCapital: number;
  finalCapital: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  sharpeRatio: number;
  winRate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  equityCurve: { date: string; value: number }[];
  createdAt: Timestamp | FieldValue;
}

class FirebaseService {
  private _isAvailable: boolean = true;
  private _lastError: string | null = null;
  private _initializationAttempts: number = 0;

  // Check if Firebase is available (for handling permissions issues)
  private isFirebaseAvailable(): boolean {
    return firebaseEnabled && this._isAvailable;
  }

  // Get the last error message
  getLastError(): string | null {
    return this._lastError;
  }

  // Get service status
  getServiceStatus(): {
    isAvailable: boolean;
    lastError: string | null;
    initializationAttempts: number;
  } {
    return {
      isAvailable: this._isAvailable,
      lastError: this._lastError,
      initializationAttempts: this._initializationAttempts
    };
  }

  // Test Firebase connection
  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('🔥 Testing Firebase connection...');
      
      // Try to read from a collection (this will fail if permissions are wrong)
      const testCollection = collection(db, 'test');
      await getDocs(query(testCollection, limit(1)));
      
      console.log('✅ Firebase connection successful');
      this._isAvailable = true;
      this._lastError = null;
      return { success: true };
      
    } catch (error: any) {
      console.error('❌ Firebase connection test failed:', error);
      this._lastError = error.message;
      
      if (error.code === 'permission-denied') {
        console.error(`
🚨 FIREBASE PERMISSION ERROR 🚨
The Firestore security rules are blocking access.

SOLUTION:
1. Go to Firebase Console > Firestore Database > Rules
2. Replace the current rules with:

rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}

3. Click "Publish" and wait 1-2 minutes
4. Restart the app
        `);
      }
      
      this.handleFirebaseError(error, 'connection test');
      return { success: false, error: error.message };
    }
  }

  // Handle Firebase errors and disable if needed
  private handleFirebaseError(error: any, operation: string): void {
    console.error(`❌ Firebase ${operation} error:`, error);
    this._lastError = error.message;
    this._initializationAttempts++;
    
    if (error.code === 'permission-denied' || 
        error.message?.includes('permission') ||
        error.message?.includes('insufficient permissions')) {
      console.warn('⚠️ Firebase permissions denied, switching to local mode');
      console.warn(`
🔧 QUICK FIX:
1. Open Firebase Console
2. Go to Firestore Database > Rules  
3. Set rules to: allow read, write: if true;
4. Publish and restart app
      `);
      this._isAvailable = false;
    }
  }

  // ================== GEMS MANAGEMENT ==================
  
  async saveGems(gems: any[]): Promise<void> {
    try {
      console.log('💾 Saving gems to Firebase...');
      
      // Check if Firebase is accessible
      if (!this.isFirebaseAvailable()) {
        console.warn('⚠️ Firebase not available, skipping save');
        return;
      }
      
      const batch = [];
      
      for (const gem of gems) {
        const gemData: Omit<GemFirestore, 'id'> = {
          symbol: gem.symbol,
          name: gem.name,
          price: gem.price,
          marketCap: gem.marketCap,
          volume24h: gem.volume24h,
          change24h: gem.change24h,
          description: gem.description,
          aiScore: gem.aiScore,
          risk: gem.risk,
          category: gem.category,
          launchDate: gem.launchDate,
          type: gem.type,
          social: gem.social,
          fundamentals: gem.fundamentals,
          aiAnalysis: gem.aiAnalysis,
          potential: gem.potential,
          timeframe: gem.timeframe,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        
        // Check if gem already exists
        const existingGem = await this.getGemBySymbol(gem.symbol);
        if (existingGem) {
          // Update existing gem
          await updateDoc(doc(db, COLLECTIONS.GEMS, existingGem.id!), {
            ...gemData,
            createdAt: existingGem.createdAt // Keep original creation date
          });
        } else {
          // Add new gem
          batch.push(addDoc(collection(db, COLLECTIONS.GEMS), gemData));
        }
      }
      
      if (batch.length > 0) {
        await Promise.all(batch);
      }
      
      console.log(`✅ Saved ${gems.length} gems to Firebase`);
    } catch (error) {
      this.handleFirebaseError(error, 'saveGems');
      // Don't throw error to allow app to continue working
    }
  }

  async getGems(limit_count = 50): Promise<GemFirestore[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GEMS),
        orderBy('lastUpdated', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      const gems: GemFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        gems.push({ id: doc.id, ...doc.data() } as GemFirestore);
      });
      
      console.log(`📖 Retrieved ${gems.length} gems from Firebase`);
      return gems;
    } catch (error) {
      console.error('❌ Error getting gems:', error);
      return [];
    }
  }

  async getGemBySymbol(symbol: string): Promise<GemFirestore | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GEMS),
        where('symbol', '==', symbol),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as GemFirestore;
    } catch (error) {
      console.error('❌ Error getting gem by symbol:', error);
      return null;
    }
  }

  async getGemsByCategory(category: string): Promise<GemFirestore[]> {
    try {
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, COLLECTIONS.GEMS),
        where('category', '==', category)
      );
      
      const querySnapshot = await getDocs(q);
      const gems: GemFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        gems.push({ id: doc.id, ...doc.data() } as GemFirestore);
      });
      
      // Sort by aiScore in memory
      gems.sort((a, b) => b.aiScore - a.aiScore);
      
      return gems;
    } catch (error) {
      console.error('❌ Error getting gems by category:', error);
      return [];
    }
  }

  // ================== AUTO TRADES MANAGEMENT ==================
  
  async saveAutoTrade(trade: any): Promise<string> {
    try {
      const tradeData: Omit<AutoTradeFirestore, 'id'> = {
        symbol: trade.symbol,
        name: trade.name,
        entryPrice: trade.entryPrice,
        currentPrice: trade.currentPrice,
        targetPrice: trade.targetPrice,
        stopLoss: trade.stopLoss,
        quantity: trade.quantity,
        side: trade.side,
        confidence: trade.confidence,
        status: trade.status,
        pnl: trade.pnl,
        pnlPercentage: trade.pnlPercentage,
        timestamp: Timestamp.fromDate(new Date(trade.timestamp)),
        strategy: trade.strategy,
        analysis: trade.analysis,
        lastUpdated: serverTimestamp(),
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.AUTO_TRADES), tradeData);
      console.log(`✅ Saved auto trade ${trade.symbol} to Firebase`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving auto trade:', error);
      throw error;
    }
  }

  async updateAutoTrade(tradeId: string, updates: Partial<AutoTradeFirestore>): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.AUTO_TRADES, tradeId), {
        ...updates,
        lastUpdated: serverTimestamp()
      });
      console.log(`✅ Updated auto trade ${tradeId}`);
    } catch (error) {
      console.error('❌ Error updating auto trade:', error);
      throw error;
    }
  }

  async getAutoTrades(limit_count = 100): Promise<AutoTradeFirestore[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.AUTO_TRADES),
        orderBy('createdAt', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      const trades: AutoTradeFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        trades.push({ id: doc.id, ...doc.data() } as AutoTradeFirestore);
      });
      
      console.log(`📖 Retrieved ${trades.length} auto trades from Firebase`);
      return trades;
    } catch (error) {
      console.error('❌ Error getting auto trades:', error);
      return [];
    }
  }

  async getActiveTrades(): Promise<AutoTradeFirestore[]> {
    try {
      // Simplified query to avoid index requirements
      const q = query(
        collection(db, COLLECTIONS.AUTO_TRADES),
        where('status', '==', 'active')
      );
      
      const querySnapshot = await getDocs(q);
      const trades: AutoTradeFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        trades.push({ id: doc.id, ...doc.data() } as AutoTradeFirestore);
      });
      
      // Sort by createdAt in memory
      trades.sort((a, b) => {
        let aTime: Date;
        let bTime: Date;
        
        if (a.createdAt instanceof Timestamp) {
          aTime = a.createdAt.toDate();
        } else {
          aTime = new Date();
        }
        
        if (b.createdAt instanceof Timestamp) {
          bTime = b.createdAt.toDate();
        } else {
          bTime = new Date();
        }
        
        return bTime.getTime() - aTime.getTime();
      });
      
      return trades;
    } catch (error) {
      console.error('❌ Error getting active trades:', error);
      return [];
    }
  }

  // ================== STRATEGIES MANAGEMENT ==================
  
  async saveStrategy(strategy: any): Promise<string> {
    try {
      const strategyData: Omit<StrategyFirestore, 'id'> = {
        name: strategy.name,
        type: strategy.type,
        parameters: strategy.parameters,
        isActive: strategy.isActive ?? true,
        performance: strategy.performance,
        createdAt: serverTimestamp(),
        lastUsed: strategy.lastUsed ? Timestamp.fromDate(new Date(strategy.lastUsed)) : undefined,
      };
      
      const docRef = await addDoc(collection(db, COLLECTIONS.STRATEGIES), strategyData);
      console.log(`✅ Saved strategy ${strategy.name} to Firebase`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving strategy:', error);
      throw error;
    }
  }

  async getStrategies(): Promise<StrategyFirestore[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.STRATEGIES),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const strategies: StrategyFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        strategies.push({ id: doc.id, ...doc.data() } as StrategyFirestore);
      });
      
      console.log(`📖 Retrieved ${strategies.length} strategies from Firebase`);
      return strategies;
    } catch (error) {
      console.error('❌ Error getting strategies:', error);
      return [];
    }
  }

  async updateStrategyPerformance(strategyId: string, performance: any): Promise<void> {
    try {
      await updateDoc(doc(db, COLLECTIONS.STRATEGIES, strategyId), {
        performance,
        lastUsed: serverTimestamp()
      });
      console.log(`✅ Updated strategy performance ${strategyId}`);
    } catch (error) {
      console.error('❌ Error updating strategy performance:', error);
      throw error;
    }
  }

  // ================== BACKTEST RESULTS MANAGEMENT ==================
  
  async saveBacktestResults(results: any[]): Promise<void> {
    try {
      console.log('💾 Saving backtest results to Firebase...');
      const batch = [];
      
      for (const result of results) {
        const resultData: Omit<BacktestResultFirestore, 'id'> = {
          symbol: result.symbol,
          strategy: result.strategy,
          period: result.period,
          startDate: result.startDate,
          endDate: result.endDate,
          initialCapital: result.initialCapital,
          finalCapital: result.finalCapital,
          totalReturn: result.totalReturn,
          totalReturnPercent: result.totalReturnPercent,
          maxDrawdown: result.maxDrawdown,
          sharpeRatio: result.sharpeRatio,
          winRate: result.winRate,
          totalTrades: result.totalTrades,
          winningTrades: result.winningTrades,
          losingTrades: result.losingTrades,
          averageWin: result.averageWin,
          averageLoss: result.averageLoss,
          profitFactor: result.profitFactor,
          equityCurve: result.equityCurve,
          createdAt: serverTimestamp(),
        };
        
        batch.push(addDoc(collection(db, COLLECTIONS.BACKTEST_RESULTS), resultData));
      }
      
      await Promise.all(batch);
      console.log(`✅ Saved ${results.length} backtest results to Firebase`);
    } catch (error) {
      console.error('❌ Error saving backtest results:', error);
      throw error;
    }
  }

  async getBacktestResults(strategy?: string, limit_count = 50): Promise<BacktestResultFirestore[]> {
    try {
      let q;
      
      if (strategy) {
        q = query(
          collection(db, COLLECTIONS.BACKTEST_RESULTS),
          where('strategy', '==', strategy),
          orderBy('createdAt', 'desc'),
          limit(limit_count)
        );
      } else {
        q = query(
          collection(db, COLLECTIONS.BACKTEST_RESULTS),
          orderBy('createdAt', 'desc'),
          limit(limit_count)
        );
      }
      
      const querySnapshot = await getDocs(q);
      const results: BacktestResultFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data() as any;
        results.push({ id: doc.id, ...data });
      });
      
      console.log(`📖 Retrieved ${results.length} backtest results from Firebase`);
      return results;
    } catch (error) {
      console.error('❌ Error getting backtest results:', error);
      return [];
    }
  }

  // ================== MARKET DATA MANAGEMENT ==================
  
  async saveMarketData(marketData: any[]): Promise<void> {
    try {
      if (!firebaseEnabled || !db) {
        // Use AsyncStorage fallback when Firebase is not available
        console.log('📱 Saving market data to local storage (Firebase unavailable)...');
        for (const data of marketData) {
          const localData = {
            symbol: data.symbol,
            name: data.name || data.symbol,
            price: data.price,
            change: data.change,
            changePercent: data.changePercent,
            marketCap: data.marketCap || 0,
            volume24h: data.volume24h || 0,
            type: data.type,
            lastUpdated: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          };
          await AsyncStorage.setItem(`market_data_${data.symbol}`, JSON.stringify(localData));
        }
        console.log(`✅ Saved ${marketData.length} market data items to local storage`);
        return;
      }

      console.log('💾 Saving market data to Firebase...');
      const batch = [];
      
      for (const data of marketData) {
        const marketDataDoc: Omit<MarketDataFirestore, 'id'> = {
          symbol: data.symbol,
          name: data.name || data.symbol,
          price: data.price,
          change: data.change,
          changePercent: data.changePercent,
          marketCap: data.marketCap || 0,
          volume24h: data.volume24h || 0,
          type: data.type,
          lastUpdated: serverTimestamp(),
          createdAt: serverTimestamp(),
        };
        
        // Check if market data already exists for this symbol
        const existingData = await this.getMarketDataBySymbol(data.symbol);
        if (existingData) {
          // Update existing data
          await updateDoc(doc(db, COLLECTIONS.MARKET_DATA, existingData.id!), {
            ...marketDataDoc,
            createdAt: existingData.createdAt // Keep original creation date
          });
        } else {
          // Add new data
          batch.push(addDoc(collection(db, COLLECTIONS.MARKET_DATA), marketDataDoc));
        }
      }
      
      if (batch.length > 0) {
        await Promise.all(batch);
      }
      
      console.log(`✅ Saved ${marketData.length} market data entries to Firebase`);
    } catch (error) {
      console.error('❌ Error saving market data:', error);
      throw error;
    }
  }

  async getMarketDataBySymbol(symbol: string): Promise<MarketDataFirestore | null> {
    try {
      if (!firebaseEnabled || !db) {
        // Use AsyncStorage fallback when Firebase is not available
        const cachedData = await AsyncStorage.getItem(`market_data_${symbol}`);
        if (cachedData) {
          const parsed = JSON.parse(cachedData);
          // Check if data is less than 5 minutes old
          const isRecent = Date.now() - new Date(parsed.lastUpdated).getTime() < 300000;
          return isRecent ? parsed : null;
        }
        return null;
      }

      const q = query(
        collection(db, COLLECTIONS.MARKET_DATA),
        where('symbol', '==', symbol),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return null;
      
      const doc = querySnapshot.docs[0];
      return { id: doc.id, ...doc.data() } as MarketDataFirestore;
    } catch (error) {
      this.handleFirebaseError(error, 'getMarketDataBySymbol');
      return null;
    }
  }

  async getMarketData(limit_count = 100): Promise<MarketDataFirestore[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.MARKET_DATA),
        orderBy('lastUpdated', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      const data: MarketDataFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as MarketDataFirestore);
      });
      
      console.log(`📖 Retrieved ${data.length} market data entries from Firebase`);
      return data;
    } catch (error) {
      console.error('❌ Error getting market data:', error);
      return [];
    }
  }

  // ================== OPPORTUNITIES MANAGEMENT ==================
  
  async saveOpportunities(opportunities: any[]): Promise<void> {
    try {
      console.log('💾 Saving opportunities to Firebase...');
      
      // First, delete expired opportunities
      await this.cleanupExpiredOpportunities();
      
      const batch = [];
      
      for (const opportunity of opportunities) {
        const opportunityData: Omit<OpportunityFirestore, 'id'> = {
          symbol: opportunity.symbol,
          name: opportunity.name,
          currentPrice: opportunity.currentPrice,
          predictedPrice: opportunity.predictedPrice,
          confidence: opportunity.confidence,
          timeframe: opportunity.timeframe,
          analysis: opportunity.analysis,
          type: opportunity.type,
          expectedReturn: opportunity.expectedReturn,
          riskScore: opportunity.riskScore,
          autoExecuted: opportunity.autoExecuted,
          createdAt: serverTimestamp(),
          expiresAt: Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // Expire in 24 hours
        };
        
        batch.push(addDoc(collection(db, COLLECTIONS.OPPORTUNITIES), opportunityData));
      }
      
      await Promise.all(batch);
      console.log(`✅ Saved ${opportunities.length} opportunities to Firebase`);
    } catch (error) {
      console.error('❌ Error saving opportunities:', error);
      throw error;
    }
  }

  async getOpportunities(limit_count = 50): Promise<OpportunityFirestore[]> {
    try {
      // Simplified query to avoid complex index requirements
      // We'll sort by confidence only for now
      const q = query(
        collection(db, COLLECTIONS.OPPORTUNITIES),
        where('expiresAt', '>', Timestamp.now()),
        orderBy('expiresAt', 'desc'),
        limit(limit_count)
      );
      
      const querySnapshot = await getDocs(q);
      const opportunities: OpportunityFirestore[] = [];
      
      querySnapshot.forEach((doc) => {
        opportunities.push({ id: doc.id, ...doc.data() } as OpportunityFirestore);
      });
      
      // Sort by confidence in memory to avoid complex index
      opportunities.sort((a, b) => b.confidence - a.confidence);
      
      console.log(`📖 Retrieved ${opportunities.length} opportunities from Firebase`);
      return opportunities;
    } catch (error) {
      console.error('❌ Error getting opportunities:', error);
      
      // If the query still fails, try a simpler one
      try {
        console.log('🔄 Retrying with simpler query...');
        const simpleQuery = query(
          collection(db, COLLECTIONS.OPPORTUNITIES),
          limit(limit_count)
        );
        
        const simpleSnapshot = await getDocs(simpleQuery);
        const simpleOpportunities: OpportunityFirestore[] = [];
        
        simpleSnapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as OpportunityFirestore;
          // Filter out expired opportunities in memory
          if (data.expiresAt.toDate() > new Date()) {
            simpleOpportunities.push(data);
          }
        });
        
        // Sort by confidence in memory
        simpleOpportunities.sort((a, b) => b.confidence - a.confidence);
        
        console.log(`📖 Retrieved ${simpleOpportunities.length} opportunities with simple query`);
        return simpleOpportunities;
      } catch (simpleError) {
        console.error('❌ Simple query also failed:', simpleError);
        return [];
      }
    }
  }

  private async cleanupExpiredOpportunities(): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTIONS.OPPORTUNITIES),
        where('expiresAt', '<=', Timestamp.now())
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      console.log(`🧹 Cleaned up ${deletePromises.length} expired opportunities`);
    } catch (error) {
      console.error('❌ Error cleaning up expired opportunities:', error);
    }
  }

  // ================== UTILITY FUNCTIONS ==================
  
  async isDataStale(collectionName: string, maxAgeMinutes = 30): Promise<boolean> {
    try {
      const q = query(
        collection(db, collectionName),
        orderBy('lastUpdated', 'desc'),
        limit(1)
      );
      
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) return true;
      
      const lastDoc = querySnapshot.docs[0];
      const lastUpdated = lastDoc.data().lastUpdated?.toDate();
      
      if (!lastUpdated) return true;
      
      const ageMinutes = (Date.now() - lastUpdated.getTime()) / (1000 * 60);
      return ageMinutes > maxAgeMinutes;
    } catch (error) {
      console.error('❌ Error checking data staleness:', error);
      return true;
    }
  }

  async clearCollection(collectionName: string): Promise<void> {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const deletePromises: Promise<void>[] = [];
      
      querySnapshot.forEach((doc) => {
        deletePromises.push(deleteDoc(doc.ref));
      });
      
      await Promise.all(deletePromises);
      console.log(`🧹 Cleared collection ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error clearing collection ${collectionName}:`, error);
      throw error;
    }
  }

  // Real-time listeners
  subscribeToActiveTrades(callback: (trades: AutoTradeFirestore[]) => void) {
    const q = query(
      collection(db, COLLECTIONS.AUTO_TRADES),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(q, (querySnapshot) => {
      const trades: AutoTradeFirestore[] = [];
      querySnapshot.forEach((doc) => {
        trades.push({ id: doc.id, ...doc.data() } as AutoTradeFirestore);
      });
      callback(trades);
    });
  }

  subscribeToGems(callback: (gems: GemFirestore[]) => void, limit_count = 50) {
    const q = query(
      collection(db, COLLECTIONS.GEMS),
      orderBy('lastUpdated', 'desc'),
      limit(limit_count)
    );

    return onSnapshot(q, (querySnapshot) => {
      const gems: GemFirestore[] = [];
      querySnapshot.forEach((doc) => {
        gems.push({ id: doc.id, ...doc.data() } as GemFirestore);
      });
      callback(gems);
    });
  }

  // ==================== ALERTS MANAGEMENT ====================

  async saveAlert(alert: any): Promise<string | null> {
    if (!firebaseEnabled) {
      console.log('📱 Saving alert to local storage (Firebase unavailable)');
      try {
        const storedAlerts = await AsyncStorage.getItem('stored_alerts');
        const alerts = storedAlerts ? JSON.parse(storedAlerts) : [];
        alerts.push({
          ...alert,
          id: alert.id || Date.now().toString(),
          createdAt: alert.createdAt || new Date(),
          savedAt: new Date()
        });
        await AsyncStorage.setItem('stored_alerts', JSON.stringify(alerts));
        return alert.id;
      } catch (error) {
        console.error('❌ Error saving alert locally:', error);
        return null;
      }
    }

    try {
      console.log(`💾 Saving alert ${alert.symbol} to Firebase...`);
      console.log(`🔍 Firebase enabled: ${firebaseEnabled}, Collection: ${COLLECTIONS.ALERTS}`);
      
      const alertData = {
        ...alert,
        currentPrice: parseFloat(alert.currentPrice?.toFixed(2) || '0'),
        targetPrice: alert.targetPrice ? parseFloat(alert.targetPrice.toFixed(2)) : null,
        stopLoss: alert.stopLoss ? parseFloat(alert.stopLoss.toFixed(2)) : null,
        confidence: typeof alert.confidence === 'number' ? alert.confidence : parseInt(alert.confidence),
        createdAt: alert.createdAt instanceof Date ? Timestamp.fromDate(alert.createdAt) : serverTimestamp(),
        savedAt: serverTimestamp(),
        isActive: alert.isActive ?? true
      };

      console.log(`📊 Alert data prepared for Firebase:`, {
        symbol: alertData.symbol,
        strategy: alertData.strategy,
        confidence: alertData.confidence,
        currentPrice: alertData.currentPrice,
        targetPrice: alertData.targetPrice
      });

      const docRef = await addDoc(collection(db, COLLECTIONS.ALERTS), alertData);
      console.log(`✅ Alert saved to Firebase with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error saving alert to Firebase:', error);
      console.error('📋 Error details:', error.message);
      
      // Don't recursively call saveAlert, just return null
      console.log('📱 Falling back to local storage due to Firebase error');
      try {
        const storedAlerts = await AsyncStorage.getItem('stored_alerts');
        const alerts = storedAlerts ? JSON.parse(storedAlerts) : [];
        alerts.push({
          ...alert,
          id: alert.id || Date.now().toString(),
          createdAt: alert.createdAt || new Date(),
          savedAt: new Date()
        });
        await AsyncStorage.setItem('stored_alerts', JSON.stringify(alerts));
        console.log(`📱 Alert ${alert.symbol} saved to local storage as fallback`);
        return alert.id;
      } catch (localError) {
        console.error('❌ Error saving to local storage fallback:', localError);
        return null;
      }
    }
  }

  async getAlerts(limit_count = 100): Promise<any[]> {
    if (!firebaseEnabled) {
      console.log('📱 Loading alerts from local storage');
      try {
        const storedAlerts = await AsyncStorage.getItem('stored_alerts');
        return storedAlerts ? JSON.parse(storedAlerts) : [];
      } catch (error) {
        console.error('❌ Error loading alerts locally:', error);
        return [];
      }
    }

    try {
      console.log('📥 Loading alerts from Firebase...');
      const q = query(
        collection(db, COLLECTIONS.ALERTS),
        orderBy('createdAt', 'desc'),
        limit(limit_count)
      );

      const querySnapshot = await getDocs(q);
      const alerts: any[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          savedAt: data.savedAt?.toDate ? data.savedAt.toDate() : new Date(data.savedAt)
        });
      });

      console.log(`✅ Loaded ${alerts.length} alerts from Firebase`);
      return alerts;
    } catch (error) {
      console.error('❌ Error loading alerts from Firebase:', error);
      return [];
    }
  }

  async updateAlert(alertId: string, updates: any): Promise<boolean> {
    if (!firebaseEnabled) {
      console.log('📱 Updating alert in local storage');
      try {
        const storedAlerts = await AsyncStorage.getItem('stored_alerts');
        const alerts = storedAlerts ? JSON.parse(storedAlerts) : [];
        const alertIndex = alerts.findIndex((a: any) => a.id === alertId);
        
        if (alertIndex !== -1) {
          alerts[alertIndex] = { ...alerts[alertIndex], ...updates, updatedAt: new Date() };
          await AsyncStorage.setItem('stored_alerts', JSON.stringify(alerts));
          return true;
        }
        return false;
      } catch (error) {
        console.error('❌ Error updating alert locally:', error);
        return false;
      }
    }

    try {
      console.log(`🔄 Updating alert ${alertId} in Firebase...`);
      const alertRef = doc(db, COLLECTIONS.ALERTS, alertId);
      await updateDoc(alertRef, {
        ...updates,
        updatedAt: serverTimestamp()
      });
      console.log(`✅ Alert ${alertId} updated in Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error updating alert in Firebase:', error);
      return false;
    }
  }

  async deleteAlert(alertId: string): Promise<boolean> {
    if (!firebaseEnabled) {
      console.log('📱 Deleting alert from local storage');
      try {
        const storedAlerts = await AsyncStorage.getItem('stored_alerts');
        const alerts = storedAlerts ? JSON.parse(storedAlerts) : [];
        const filteredAlerts = alerts.filter((a: any) => a.id !== alertId);
        await AsyncStorage.setItem('stored_alerts', JSON.stringify(filteredAlerts));
        return true;
      } catch (error) {
        console.error('❌ Error deleting alert locally:', error);
        return false;
      }
    }

    try {
      console.log(`🗑️ Deleting alert ${alertId} from Firebase...`);
      const alertRef = doc(db, COLLECTIONS.ALERTS, alertId);
      await deleteDoc(alertRef);
      console.log(`✅ Alert ${alertId} deleted from Firebase`);
      return true;
    } catch (error) {
      console.error('❌ Error deleting alert from Firebase:', error);
      return false;
    }
  }

  subscribeToAlerts(callback: (alerts: any[]) => void, limit_count = 100) {
    if (!firebaseEnabled) {
      console.log('📱 Firebase unavailable, using local storage for alerts');
      // For local storage, we'll call the callback once with stored data
      this.getAlerts(limit_count).then(callback).catch(() => callback([]));
      return () => {}; // Return empty unsubscribe function
    }

    const q = query(
      collection(db, COLLECTIONS.ALERTS),
      orderBy('createdAt', 'desc'),
      limit(limit_count)
    );

    return onSnapshot(q, (querySnapshot) => {
      const alerts: any[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        alerts.push({
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          savedAt: data.savedAt?.toDate ? data.savedAt.toDate() : new Date(data.savedAt)
        });
      });
      callback(alerts);
    });
  }
}

export const firebaseService = new FirebaseService();
export { COLLECTIONS, db };

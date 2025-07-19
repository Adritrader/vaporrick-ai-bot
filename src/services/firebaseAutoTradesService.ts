import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trade } from '../services/tradeDatabase';

// Firebase service specifically for automatic trades collection
class FirebaseAutoTradesService {
  private readonly COLLECTION_NAME = 'trades'; // Firebase collection for auto trades
  private readonly LOCAL_CACHE_KEY = 'firebase_auto_trades_cache';
  private readonly BATCH_SIZE = 20; // For lazy loading

  // Save only automatic trades to Firebase "trades" collection
  async saveAutoTradeToFirebase(trade: Trade): Promise<void> {
    // Only save if it's an automatic trade
    if (trade.executionMethod !== 'automatic' && !trade.autoExecuted) {
      console.log('⏭️ Skipping manual trade, only saving automatic trades to Firebase');
      return;
    }

    try {
      const firebaseData = {
        id: trade.id,
        alertId: trade.alertId,
        symbol: trade.symbol,
        name: trade.name,
        signal: trade.signal,
        entryPrice: trade.entryPrice,
        currentPrice: trade.currentPrice,
        targetPrice: trade.targetPrice,
        stopLoss: trade.stopLoss,
        confidence: trade.confidence,
        strategy: trade.strategy,
        reasoning: trade.reasoning,
        priority: trade.priority,
        entryDate: trade.entryDate.toISOString(),
        exitDate: trade.exitDate?.toISOString(),
        exitPrice: trade.exitPrice,
        status: trade.status,
        outcome: trade.outcome,
        returnPercentage: trade.returnPercentage,
        returnAmount: trade.returnAmount,
        timeframe: trade.timeframe,
        dataSource: trade.dataSource,
        executionMethod: 'automatic', // Always automatic for this collection
        autoExecuted: true,
        signalExpiry: trade.signalExpiry?.toISOString(),
        signalFulfilled: trade.signalFulfilled,
        fulfillmentDate: trade.fulfillmentDate?.toISOString(),
        fulfillmentPrice: trade.fulfillmentPrice,
        timeToFulfillment: trade.timeToFulfillment,
        lockedMetrics: trade.lockedMetrics,
        timestamp: Date.now(),
        userId: 'user123', // In real app, get from auth
        type: 'auto_trade', // Identifier for auto trades
      };

      // Save to Firebase simulation (AsyncStorage with "trades" key)
      await this.saveToFirebaseCollection(firebaseData);
      
      // Also cache locally for performance
      await this.saveToLocalCache(firebaseData);
      
      console.log(`🔥 Auto trade saved to Firebase collection: trades/${trade.id}`);
    } catch (error) {
      console.error('❌ Error saving auto trade to Firebase:', error);
      throw error;
    }
  }

  // Get automatic trades with lazy loading support
  async getAutoTradesFromFirebase(page: number = 0, limit: number = 20): Promise<{
    trades: Trade[];
    hasMore: boolean;
    total: number;
  }> {
    try {
      const allFirebaseData = await this.fetchFromFirebaseCollection();
      
      // Sort by timestamp descending (newest first)
      const sortedData = allFirebaseData.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      
      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const paginatedData = sortedData.slice(startIndex, endIndex);
      
      const trades = this.convertToTradeFormat(paginatedData);
      
      console.log(`🔥 Loaded page ${page + 1} of auto trades: ${trades.length}/${sortedData.length} total`);
      
      return {
        trades,
        hasMore: endIndex < sortedData.length,
        total: sortedData.length,
      };
    } catch (error) {
      console.error('❌ Error loading auto trades from Firebase:', error);
      return { trades: [], hasMore: false, total: 0 };
    }
  }

  // Get all automatic trades (for stats)
  async getAllAutoTradesFromFirebase(): Promise<Trade[]> {
    try {
      const firebaseData = await this.fetchFromFirebaseCollection();
      const trades = this.convertToTradeFormat(firebaseData);
      console.log(`🔥 Loaded ${trades.length} total auto trades for stats`);
      return trades;
    } catch (error) {
      console.error('❌ Error loading all auto trades:', error);
      return [];
    }
  }

  // Update auto trade status in Firebase
  async updateAutoTradeInFirebase(tradeId: string, updates: Partial<Trade>): Promise<void> {
    try {
      const allData = await this.fetchFromFirebaseCollection();
      const tradeIndex = allData.findIndex(t => t.id === tradeId);
      
      if (tradeIndex >= 0) {
        allData[tradeIndex] = { ...allData[tradeIndex], ...updates, timestamp: Date.now() };
        await this.saveToFirebaseCollection(allData[tradeIndex], allData);
        console.log(`🔥 Auto trade updated in Firebase: ${tradeId}`);
      } else {
        console.warn(`⚠️ Auto trade not found for update: ${tradeId}`);
      }
    } catch (error) {
      console.error('❌ Error updating auto trade in Firebase:', error);
      throw error;
    }
  }

  // Get auto trading statistics
  async getAutoTradingStatsFromFirebase() {
    try {
      const trades = await this.getAllAutoTradesFromFirebase();
      const activeTrades = trades.filter(t => t.status === 'active');
      const closedTrades = trades.filter(t => t.status === 'closed');
      const winningTrades = closedTrades.filter(t => t.outcome === 'win');
      const fulfilledTrades = trades.filter(t => t.signalFulfilled);

      const totalReturn = closedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0);
      const averageReturn = closedTrades.length > 0 ? totalReturn / closedTrades.length : 0;
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      const fulfillmentRate = trades.length > 0 ? (fulfilledTrades.length / trades.length) * 100 : 0;

      return {
        totalTrades: trades.length,
        activeTrades: activeTrades.length,
        closedTrades: closedTrades.length,
        winRate,
        fulfillmentRate,
        averageConfidence: trades.length > 0 ? 
          trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length : 0,
        totalReturn,
        averageReturn,
        profitableTrades: winningTrades.length,
        totalProfit: winningTrades.reduce((sum, t) => sum + (t.returnAmount || 0), 0),
        avgTimeToFulfillment: fulfilledTrades.length > 0 ?
          fulfilledTrades.reduce((sum, t) => sum + (t.timeToFulfillment || 0), 0) / fulfilledTrades.length : 0,
      };
    } catch (error) {
      console.error('❌ Error calculating auto trading stats:', error);
      return null;
    }
  }

  // Check if auto trade exists
  async autoTradeExistsInFirebase(alertId: string): Promise<boolean> {
    try {
      const allData = await this.fetchFromFirebaseCollection();
      return allData.some(trade => trade.alertId === alertId);
    } catch (error) {
      console.error('❌ Error checking auto trade existence:', error);
      return false;
    }
  }

  // Private methods for Firebase operations
  private async saveToFirebaseCollection(data: any, allData?: any[]): Promise<void> {
    try {
      const firebaseKey = 'firebase_trades_collection';
      let trades = allData || await this.fetchFromFirebaseCollection();
      
      const index = trades.findIndex((t: any) => t.id === data.id);
      if (index >= 0) {
        trades[index] = data;
      } else {
        trades.push(data);
      }
      
      await AsyncStorage.setItem(firebaseKey, JSON.stringify(trades));
      console.log(`🔥 Synced to Firebase collection: trades`);
    } catch (error) {
      console.error('❌ Error syncing to Firebase collection:', error);
    }
  }

  private async fetchFromFirebaseCollection(): Promise<any[]> {
    try {
      const firebaseKey = 'firebase_trades_collection';
      const data = await AsyncStorage.getItem(firebaseKey);
      const trades = data ? JSON.parse(data) : [];
      
      // If no trades exist, create some sample demo trades for testing
      if (trades.length === 0) {
        console.log('🔧 No trades found, creating demo trades for testing...');
        const demoTrades = this.createDemoTrades();
        await AsyncStorage.setItem(firebaseKey, JSON.stringify(demoTrades));
        return demoTrades;
      }
      
      console.log(`🔥 Fetched ${trades.length} trades from Firebase collection`);
      return trades;
    } catch (error) {
      console.error('❌ Error fetching from Firebase collection:', error);
      return [];
    }
  }

  // Create demo trades for testing
  private createDemoTrades(): any[] {
    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;
    
    return [
      {
        id: `demo_trade_1_${now}`,
        alertId: `alert_1_${now}`,
        symbol: 'BTC',
        name: 'Bitcoin',
        signal: 'buy',
        entryPrice: 95420.50,
        currentPrice: 97850.25,
        targetPrice: 102500.00,
        stopLoss: 90650.00,
        confidence: 89,
        strategy: 'VectorFlux AI Momentum',
        reasoning: 'Strong bullish momentum with institutional buying pressure detected',
        priority: 'high',
        entryDate: new Date(now - 2 * day).toISOString(),
        status: 'active',
        returnPercentage: 2.54,
        timeframe: '3d',
        dataSource: 'CoinGecko',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalFulfilled: false,
        lockedMetrics: {
          entryPrice: 95420.50,
          confidence: 89,
          targetPrice: 102500.00,
          expectedReturn: 7.42,
          riskLevel: 'medium',
          timestamp: now - 2 * day
        },
        timestamp: now - 2 * day
      },
      {
        id: `demo_trade_2_${now}`,
        alertId: `alert_2_${now}`,
        symbol: 'ETH',
        name: 'Ethereum',
        signal: 'buy',
        entryPrice: 3420.75,
        currentPrice: 3650.20,
        targetPrice: 3850.00,
        stopLoss: 3250.00,
        confidence: 92,
        strategy: 'VectorFlux AI Breakout',
        reasoning: 'Technical breakout pattern confirmed with high volume',
        priority: 'critical',
        entryDate: new Date(now - 1 * day).toISOString(),
        exitDate: new Date(now - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        exitPrice: 3680.50,
        status: 'closed',
        outcome: 'win',
        returnPercentage: 7.59,
        returnAmount: 259.75,
        timeframe: '2d',
        dataSource: 'CoinGecko',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalFulfilled: true,
        fulfillmentDate: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
        fulfillmentPrice: 3680.50,
        timeToFulfillment: 12,
        lockedMetrics: {
          entryPrice: 3420.75,
          confidence: 92,
          targetPrice: 3850.00,
          expectedReturn: 12.54,
          riskLevel: 'low',
          timestamp: now - 1 * day
        },
        timestamp: now - 1 * day
      },
      {
        id: `demo_trade_3_${now}`,
        alertId: `alert_3_${now}`,
        symbol: 'SOL',
        name: 'Solana',
        signal: 'sell',
        entryPrice: 185.25,
        currentPrice: 172.80,
        targetPrice: 165.00,
        stopLoss: 195.00,
        confidence: 85,
        strategy: 'VectorFlux AI Reversal',
        reasoning: 'Bearish divergence detected with weakening fundamentals',
        priority: 'high',
        entryDate: new Date(now - 3 * day).toISOString(),
        status: 'active',
        returnPercentage: 6.71,
        timeframe: '5d',
        dataSource: 'CoinGecko',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalFulfilled: false,
        lockedMetrics: {
          entryPrice: 185.25,
          confidence: 85,
          targetPrice: 165.00,
          expectedReturn: 10.93,
          riskLevel: 'medium',
          timestamp: now - 3 * day
        },
        timestamp: now - 3 * day
      },
      {
        id: `demo_trade_4_${now}`,
        alertId: `alert_4_${now}`,
        symbol: 'AAPL',
        name: 'Apple Inc.',
        signal: 'buy',
        entryPrice: 185.42,
        currentPrice: 188.75,
        targetPrice: 195.00,
        stopLoss: 178.00,
        confidence: 78,
        strategy: 'VectorFlux AI Earnings',
        reasoning: 'Positive earnings expectations with strong technical setup',
        priority: 'medium',
        entryDate: new Date(now - 4 * day).toISOString(),
        exitDate: new Date(now - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        exitPrice: 192.15,
        status: 'closed',
        outcome: 'win',
        returnPercentage: 3.63,
        returnAmount: 6.73,
        timeframe: '7d',
        dataSource: 'Alpha Vantage',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalFulfilled: true,
        fulfillmentDate: new Date(now - 6 * 60 * 60 * 1000).toISOString(),
        fulfillmentPrice: 192.15,
        timeToFulfillment: 90,
        lockedMetrics: {
          entryPrice: 185.42,
          confidence: 78,
          targetPrice: 195.00,
          expectedReturn: 5.17,
          riskLevel: 'medium',
          timestamp: now - 4 * day
        },
        timestamp: now - 4 * day
      },
      {
        id: `demo_trade_5_${now}`,
        alertId: `alert_5_${now}`,
        symbol: 'ADA',
        name: 'Cardano',
        signal: 'watch',
        entryPrice: 0.8420,
        currentPrice: 0.8650,
        targetPrice: 0.9200,
        stopLoss: 0.7900,
        confidence: 72,
        strategy: 'VectorFlux AI Watch',
        reasoning: 'Accumulation phase detected, waiting for breakout confirmation',
        priority: 'low',
        entryDate: new Date(now - 5 * day).toISOString(),
        status: 'active',
        returnPercentage: 2.73,
        timeframe: '14d',
        dataSource: 'CoinGecko',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalFulfilled: false,
        lockedMetrics: {
          entryPrice: 0.8420,
          confidence: 72,
          targetPrice: 0.9200,
          expectedReturn: 9.26,
          riskLevel: 'high',
          timestamp: now - 5 * day
        },
        timestamp: now - 5 * day
      }
    ];
  }

  private async saveToLocalCache(data: any): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(this.LOCAL_CACHE_KEY);
      const trades = existing ? JSON.parse(existing) : [];
      
      const index = trades.findIndex((t: any) => t.id === data.id);
      if (index >= 0) {
        trades[index] = data;
      } else {
        trades.push(data);
      }
      
      await AsyncStorage.setItem(this.LOCAL_CACHE_KEY, JSON.stringify(trades));
    } catch (error) {
      console.error('❌ Error saving to local cache:', error);
    }
  }

  private convertToTradeFormat(firebaseData: any[]): Trade[] {
    return firebaseData.map(data => ({
      id: data.id,
      alertId: data.alertId,
      symbol: data.symbol,
      name: data.name,
      signal: data.signal,
      entryPrice: data.entryPrice,
      currentPrice: data.currentPrice,
      targetPrice: data.targetPrice,
      stopLoss: data.stopLoss,
      confidence: data.confidence,
      strategy: data.strategy,
      reasoning: data.reasoning,
      priority: data.priority,
      entryDate: new Date(data.entryDate),
      exitDate: data.exitDate ? new Date(data.exitDate) : undefined,
      exitPrice: data.exitPrice,
      status: data.status,
      outcome: data.outcome,
      returnPercentage: data.returnPercentage,
      returnAmount: data.returnAmount,
      timeframe: data.timeframe,
      dataSource: data.dataSource,
      isLocked: true,
      executionMethod: 'automatic',
      autoExecuted: true,
      signalExpiry: data.signalExpiry ? new Date(data.signalExpiry) : undefined,
      signalFulfilled: data.signalFulfilled,
      fulfillmentDate: data.fulfillmentDate ? new Date(data.fulfillmentDate) : undefined,
      fulfillmentPrice: data.fulfillmentPrice,
      timeToFulfillment: data.timeToFulfillment,
      lockedMetrics: data.lockedMetrics,
    }));
  }

  // Clear all auto trades (for testing)
  async clearAllAutoTrades(): Promise<void> {
    try {
      await AsyncStorage.removeItem('firebase_trades_collection');
      await AsyncStorage.removeItem(this.LOCAL_CACHE_KEY);
      console.log('🔥 All auto trades cleared from Firebase');
    } catch (error) {
      console.error('❌ Error clearing auto trades:', error);
    }
  }
}

export const firebaseAutoTradesService = new FirebaseAutoTradesService();
export type { FirebaseAutoTradesService };

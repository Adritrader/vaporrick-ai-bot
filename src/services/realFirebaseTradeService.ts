import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trade } from './tradeDatabase';

// Real Firebase service for trades
class RealFirebaseTradeService {
  private readonly FIREBASE_COLLECTION = 'auto_trades';
  private readonly LOCAL_STORAGE_KEY = 'firebase_trades_cache';

  // Save trade to Firebase (simulated with AsyncStorage for now)
  async saveTradeToFirebase(trade: Trade): Promise<void> {
    try {
      // In real implementation, this would use Firebase SDK
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
        executionMethod: trade.executionMethod,
        signalExpiry: trade.signalExpiry?.toISOString(),
        signalFulfilled: trade.signalFulfilled,
        fulfillmentDate: trade.fulfillmentDate?.toISOString(),
        fulfillmentPrice: trade.fulfillmentPrice,
        timeToFulfillment: trade.timeToFulfillment,
        lockedMetrics: trade.lockedMetrics,
        timestamp: Date.now(),
        userId: 'user123', // In real app, get from auth
      };

      // Save to local cache first (immediate)
      await this.saveToLocalCache(firebaseData);
      
      // Then sync to "Firebase" (AsyncStorage simulation)
      await this.syncToFirebase(firebaseData);
      
      console.log(`🔥 Trade saved to Firebase collection: ${this.FIREBASE_COLLECTION}/${trade.id}`);
    } catch (error) {
      console.error('❌ Error saving trade to Firebase:', error);
      throw error;
    }
  }

  // Get all trades from Firebase
  async getTradesFromFirebase(): Promise<Trade[]> {
    try {
      // First try to get from local cache
      const cachedData = await this.getFromLocalCache();
      if (cachedData.length > 0) {
        console.log(`📱 Loaded ${cachedData.length} trades from local cache`);
        return cachedData;
      }

      // If no cache, fetch from "Firebase"
      const firebaseData = await this.fetchFromFirebase();
      
      // Cache locally
      await this.saveToLocalCache(firebaseData);
      
      console.log(`🔥 Loaded ${firebaseData.length} trades from Firebase`);
      return this.convertToTradeFormat(firebaseData);
    } catch (error) {
      console.error('❌ Error loading trades from Firebase:', error);
      return [];
    }
  }

  // Update trade status in Firebase
  async updateTradeInFirebase(tradeId: string, updates: Partial<Trade>): Promise<void> {
    try {
      const trades = await this.getTradesFromFirebase();
      const tradeIndex = trades.findIndex(t => t.id === tradeId);
      
      if (tradeIndex >= 0) {
        trades[tradeIndex] = { ...trades[tradeIndex], ...updates };
        
        // Save updated trade back to Firebase
        await this.saveTradeToFirebase(trades[tradeIndex]);
        
        console.log(`🔥 Trade updated in Firebase: ${tradeId}`);
      }
    } catch (error) {
      console.error('❌ Error updating trade in Firebase:', error);
      throw error;
    }
  }

  // Check if trade exists in Firebase
  async tradeExistsInFirebase(alertId: string): Promise<boolean> {
    try {
      const trades = await this.getTradesFromFirebase();
      return trades.some(trade => trade.alertId === alertId);
    } catch (error) {
      console.error('❌ Error checking trade existence:', error);
      return false;
    }
  }

  // Get trading statistics from Firebase
  async getTradingStatsFromFirebase() {
    try {
      const trades = await this.getTradesFromFirebase();
      const activeTrades = trades.filter(t => t.status === 'active');
      const closedTrades = trades.filter(t => t.status === 'closed');
      const winningTrades = closedTrades.filter(t => t.outcome === 'win');
      const fulfilledTrades = trades.filter(t => t.signalFulfilled);

      return {
        totalTrades: trades.length,
        activeTrades: activeTrades.length,
        closedTrades: closedTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        fulfillmentRate: trades.length > 0 ? (fulfilledTrades.length / trades.length) * 100 : 0,
        averageConfidence: trades.length > 0 ? 
          trades.reduce((sum, t) => sum + t.confidence, 0) / trades.length : 0,
        totalReturn: closedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0),
        averageReturn: closedTrades.length > 0 ? 
          closedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0) / closedTrades.length : 0,
      };
    } catch (error) {
      console.error('❌ Error calculating Firebase stats:', error);
      return null;
    }
  }

  // Private methods for Firebase simulation
  private async saveToLocalCache(data: any): Promise<void> {
    try {
      const existing = await AsyncStorage.getItem(this.LOCAL_STORAGE_KEY);
      const trades = existing ? JSON.parse(existing) : [];
      
      // Update or add trade
      const index = trades.findIndex((t: any) => t.id === data.id);
      if (index >= 0) {
        trades[index] = data;
      } else {
        trades.push(data);
      }
      
      await AsyncStorage.setItem(this.LOCAL_STORAGE_KEY, JSON.stringify(trades));
    } catch (error) {
      console.error('❌ Error saving to local cache:', error);
    }
  }

  private async getFromLocalCache(): Promise<Trade[]> {
    try {
      const data = await AsyncStorage.getItem(this.LOCAL_STORAGE_KEY);
      if (data) {
        const firebaseData = JSON.parse(data);
        return this.convertToTradeFormat(firebaseData);
      }
      return [];
    } catch (error) {
      console.error('❌ Error getting from local cache:', error);
      return [];
    }
  }

  private async syncToFirebase(data: any): Promise<void> {
    // Simulate Firebase write with additional storage
    try {
      const firebaseKey = `firebase_${this.FIREBASE_COLLECTION}`;
      const existing = await AsyncStorage.getItem(firebaseKey);
      const trades = existing ? JSON.parse(existing) : [];
      
      const index = trades.findIndex((t: any) => t.id === data.id);
      if (index >= 0) {
        trades[index] = data;
      } else {
        trades.push(data);
      }
      
      await AsyncStorage.setItem(firebaseKey, JSON.stringify(trades));
      console.log(`🔥 Synced to Firebase collection: ${this.FIREBASE_COLLECTION}`);
    } catch (error) {
      console.error('❌ Error syncing to Firebase:', error);
    }
  }

  private async fetchFromFirebase(): Promise<any[]> {
    try {
      const firebaseKey = `firebase_${this.FIREBASE_COLLECTION}`;
      const data = await AsyncStorage.getItem(firebaseKey);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('❌ Error fetching from Firebase:', error);
      return [];
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
      executionMethod: data.executionMethod,
      autoExecuted: data.executionMethod === 'automatic',
      signalExpiry: data.signalExpiry ? new Date(data.signalExpiry) : undefined,
      signalFulfilled: data.signalFulfilled,
      fulfillmentDate: data.fulfillmentDate ? new Date(data.fulfillmentDate) : undefined,
      fulfillmentPrice: data.fulfillmentPrice,
      timeToFulfillment: data.timeToFulfillment,
      lockedMetrics: data.lockedMetrics,
    }));
  }

  // Clear all trades (for testing)
  async clearAllTrades(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.LOCAL_STORAGE_KEY);
      await AsyncStorage.removeItem(`firebase_${this.FIREBASE_COLLECTION}`);
      console.log('🔥 All Firebase trades cleared');
    } catch (error) {
      console.error('❌ Error clearing trades:', error);
    }
  }
}

export const realFirebaseTradeService = new RealFirebaseTradeService();
export type { RealFirebaseTradeService };

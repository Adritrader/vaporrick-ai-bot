import AsyncStorage from '@react-native-async-storage/async-storage';
import { Trade } from './tradeDatabase';

interface FirebaseTradeData {
  id: string;
  alertId: string;
  symbol: string;
  name: string;
  signal: 'buy' | 'sell' | 'watch';
  entryPrice: number;
  currentPrice: number;
  targetPrice?: number;
  stopLoss?: number;
  confidence: number;
  strategy: string;
  reasoning: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  entryDate: string; // ISO string for Firebase compatibility
  exitDate?: string;
  exitPrice?: number;
  status: 'active' | 'closed' | 'cancelled';
  outcome?: 'win' | 'loss';
  returnPercentage?: number;
  returnAmount?: number;
  timeframe: string;
  dataSource: string;
  executionMethod: 'automatic' | 'manual';
  autoExecuted: boolean;
  signalExpiry?: string; // ISO string for signal expiration
  signalFulfilled?: boolean;
  fulfillmentDate?: string;
  fulfillmentPrice?: number;
  timeToFulfillment?: number; // hours
  lockedMetrics?: {
    entryPrice: number;
    confidence: number;
    targetPrice?: number;
    stopLoss?: number;
    expectedReturn: number;
    riskLevel: string;
    timestamp: number;
  };
}

class FirebaseTradeService {
  private readonly STORAGE_KEY = 'firebase_trades';
  private readonly STATS_KEY = 'firebase_trade_stats';

  // Simulate Firebase operations with AsyncStorage
  async saveTrade(trade: Trade): Promise<void> {
    try {
      const firebaseTrade: FirebaseTradeData = {
        ...trade,
        entryDate: trade.entryDate.toISOString(),
        exitDate: trade.exitDate?.toISOString(),
        signalExpiry: trade.signalExpiry?.toISOString(),
        fulfillmentDate: trade.fulfillmentDate?.toISOString(),
        autoExecuted: trade.executionMethod === 'automatic',
      };

      const existingTrades = await this.getAllTrades();
      const updatedTrades = [...existingTrades.filter(t => t.id !== trade.id), firebaseTrade];
      
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTrades));
      
      console.log(`🔥 Trade saved to Firebase: ${trade.symbol} - ${trade.signal.toUpperCase()}`);
    } catch (error) {
      console.error('Error saving trade to Firebase:', error);
    }
  }

  async getAllTrades(): Promise<FirebaseTradeData[]> {
    try {
      const tradesJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      return tradesJson ? JSON.parse(tradesJson) : [];
    } catch (error) {
      console.error('Error loading trades from Firebase:', error);
      return [];
    }
  }

  async getTradesAsLocalFormat(): Promise<Trade[]> {
    try {
      const firebaseTrades = await this.getAllTrades();
      return firebaseTrades.map(ft => ({
        ...ft,
        entryDate: new Date(ft.entryDate),
        exitDate: ft.exitDate ? new Date(ft.exitDate) : undefined,
        signalExpiry: ft.signalExpiry ? new Date(ft.signalExpiry) : undefined,
        fulfillmentDate: ft.fulfillmentDate ? new Date(ft.fulfillmentDate) : undefined,
        isLocked: true, // All Firebase trades are locked
        lockedMetrics: ft.lockedMetrics,
      }));
    } catch (error) {
      console.error('Error converting Firebase trades:', error);
      return [];
    }
  }

  async updateTradeStatus(tradeId: string, updates: Partial<FirebaseTradeData>): Promise<void> {
    try {
      const trades = await this.getAllTrades();
      const tradeIndex = trades.findIndex(t => t.id === tradeId);
      
      if (tradeIndex >= 0) {
        trades[tradeIndex] = { ...trades[tradeIndex], ...updates };
        await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trades));
        console.log(`🔥 Trade updated in Firebase: ${tradeId}`);
      }
    } catch (error) {
      console.error('Error updating trade in Firebase:', error);
    }
  }

  async checkSignalFulfillment(trade: Trade, currentPrice: number): Promise<{
    fulfilled: boolean;
    outcome?: 'win' | 'loss';
    returnPercentage?: number;
    fulfillmentPrice?: number;
  }> {
    try {
      const now = new Date();
      const signalExpiry = trade.signalExpiry || new Date(trade.entryDate.getTime() + (7 * 24 * 60 * 60 * 1000)); // 7 days default
      
      // Check if signal has expired
      if (now > signalExpiry && !trade.signalFulfilled) {
        // Signal expired without fulfillment
        await this.updateTradeStatus(trade.id, {
          status: 'closed',
          outcome: 'loss',
          exitDate: now.toISOString(),
          exitPrice: currentPrice,
          returnPercentage: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
          signalFulfilled: false,
        });

        return {
          fulfilled: false,
          outcome: 'loss',
          returnPercentage: ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100,
          fulfillmentPrice: currentPrice,
        };
      }

      // Check if target price reached
      const targetReached = trade.signal === 'buy' 
        ? currentPrice >= (trade.targetPrice || trade.entryPrice * 1.05)
        : currentPrice <= (trade.targetPrice || trade.entryPrice * 0.95);

      if (targetReached && !trade.signalFulfilled) {
        const returnPercentage = ((currentPrice - trade.entryPrice) / trade.entryPrice) * 100;
        const outcome: 'win' | 'loss' = returnPercentage > 0 ? 'win' : 'loss';

        await this.updateTradeStatus(trade.id, {
          status: 'closed',
          outcome,
          exitDate: now.toISOString(),
          exitPrice: currentPrice,
          returnPercentage,
          signalFulfilled: true,
          fulfillmentDate: now.toISOString(),
          fulfillmentPrice: currentPrice,
          timeToFulfillment: (now.getTime() - trade.entryDate.getTime()) / (1000 * 60 * 60), // hours
        });

        return {
          fulfilled: true,
          outcome,
          returnPercentage,
          fulfillmentPrice: currentPrice,
        };
      }

      return { fulfilled: false };
    } catch (error) {
      console.error('Error checking signal fulfillment:', error);
      return { fulfilled: false };
    }
  }

  async getTradeStats(): Promise<{
    totalTrades: number;
    activeTrades: number;
    closedTrades: number;
    winRate: number;
    totalReturn: number;
    averageReturn: number;
    fulfillmentRate: number;
    averageTimeToFulfillment: number;
  }> {
    try {
      const trades = await this.getAllTrades();
      const closedTrades = trades.filter(t => t.status === 'closed');
      const fulfilledTrades = trades.filter(t => t.signalFulfilled);
      const winningTrades = closedTrades.filter(t => t.outcome === 'win');
      
      return {
        totalTrades: trades.length,
        activeTrades: trades.filter(t => t.status === 'active').length,
        closedTrades: closedTrades.length,
        winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
        totalReturn: closedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0),
        averageReturn: closedTrades.length > 0 ? 
          closedTrades.reduce((sum, t) => sum + (t.returnPercentage || 0), 0) / closedTrades.length : 0,
        fulfillmentRate: trades.length > 0 ? (fulfilledTrades.length / trades.length) * 100 : 0,
        averageTimeToFulfillment: fulfilledTrades.length > 0 ? 
          fulfilledTrades.reduce((sum, t) => sum + (t.timeToFulfillment || 0), 0) / fulfilledTrades.length : 0,
      };
    } catch (error) {
      console.error('Error calculating trade stats:', error);
      return {
        totalTrades: 0,
        activeTrades: 0,
        closedTrades: 0,
        winRate: 0,
        totalReturn: 0,
        averageReturn: 0,
        fulfillmentRate: 0,
        averageTimeToFulfillment: 0,
      };
    }
  }

  async clearAllTrades(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('🔥 All Firebase trades cleared');
    } catch (error) {
      console.error('Error clearing Firebase trades:', error);
    }
  }
}

export const firebaseTradeService = new FirebaseTradeService();
export type { FirebaseTradeData };

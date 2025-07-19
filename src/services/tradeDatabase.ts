import AsyncStorage from '@react-native-async-storage/async-storage';
import { AutoAlert } from './autoAlertService';
import { TradeExecution } from './autoTradingService';

export interface Trade {
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
  entryDate: Date;
  exitDate?: Date;
  exitPrice?: number;
  status: 'active' | 'closed' | 'cancelled';
  outcome?: 'win' | 'loss';
  returnPercentage?: number;
  returnAmount?: number;
  timeframe: string;
  dataSource: string;
  isLocked: boolean; // Para evitar que las métricas cambien una vez guardado
  // Enhanced automatic trading fields
  executionMethod: 'automatic' | 'manual';
  tradeExecutionId?: string; // Reference to TradeExecution
  commission?: number;
  autoExecuted: boolean;
  // Signal tracking fields
  signalExpiry?: Date; // When the signal expires
  signalFulfilled?: boolean; // Whether the signal was fulfilled
  fulfillmentDate?: Date; // When the signal was fulfilled
  fulfillmentPrice?: number; // Price at which signal was fulfilled
  timeToFulfillment?: number; // Time in hours to fulfillment
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

export interface TradingStats {
  totalTrades: number;
  activeTrades: number;
  closedTrades: number;
  winRate: number;
  totalReturn: number;
  averageReturn: number;
  bestTrade: number;
  worstTrade: number;
  avgHoldingTime: number;
  winsByStrategy: { [strategy: string]: number };
  lossesByStrategy: { [strategy: string]: number };
  monthlyReturns: { month: string; return: number }[];
  // New signal tracking metrics
  fulfillmentRate: number;
  averageTimeToFulfillment: number;
  signalAccuracy: number;
  expiredSignals: number;
}

class TradeDatabase {
  private trades: Trade[] = [];
  private readonly STORAGE_KEY = 'trading_database';

  constructor() {
    this.loadTrades();
  }

  // Cargar trades desde AsyncStorage
  async loadTrades(): Promise<Trade[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.trades = JSON.parse(stored).map((trade: any) => ({
          ...trade,
          entryDate: new Date(trade.entryDate),
          exitDate: trade.exitDate ? new Date(trade.exitDate) : undefined,
        }));
        console.log(`📊 Loaded ${this.trades.length} trades from database`);
      }
      return this.trades;
    } catch (error) {
      console.error('❌ Error loading trades:', error);
      this.trades = [];
      return [];
    }
  }

  // Guardar trades en AsyncStorage
  private async saveTrades(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.trades));
      console.log(`💾 Saved ${this.trades.length} trades to database`);
    } catch (error) {
      console.error('❌ Error saving trades:', error);
    }
  }

  // Crear un nuevo trade desde una alerta
  async createTrade(alert: any, tradeExecution?: TradeExecution): Promise<Trade> {
    const trade: Trade = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: alert.id,
      symbol: alert.symbol,
      name: alert.name || alert.symbol,
      signal: alert.signal,
      entryPrice: alert.currentPrice,
      currentPrice: alert.currentPrice,
      targetPrice: alert.targetPrice,
      stopLoss: alert.stopLoss,
      confidence: alert.confidence || 50,
      strategy: alert.strategy,
      reasoning: alert.reasoning,
      priority: alert.priority,
      entryDate: new Date(alert.createdAt),
      status: 'active',
      timeframe: alert.timeframe || '1-7 days',
      dataSource: this.getDataSource(alert),
      isLocked: true, // Métricas fijas una vez guardado
      // Enhanced automatic trading fields
      executionMethod: tradeExecution ? 'automatic' : 'manual',
      tradeExecutionId: tradeExecution?.id,
      commission: tradeExecution?.commission || 0,
      autoExecuted: !!tradeExecution,
      lockedMetrics: {
        entryPrice: alert.currentPrice,
        confidence: alert.confidence || 50,
        targetPrice: alert.targetPrice,
        stopLoss: alert.stopLoss,
        expectedReturn: this.calculateExpectedReturn(alert),
        riskLevel: this.calculateRiskLevel(alert.confidence || 50),
        timestamp: Date.now()
      }
    };

    this.trades.push(trade);
    await this.saveTrades();
    
    console.log(`✅ Created trade ${trade.id} for ${trade.symbol}`);
    return trade;
  }

  // Calculate expected return based on alert data
  private calculateExpectedReturn(alert: any): number {
    const currentPrice = alert.currentPrice || 0;
    const targetPrice = alert.targetPrice || currentPrice;
    const confidence = alert.confidence || 50;
    
    if (currentPrice === 0) return 0;
    
    const baseReturn = ((targetPrice - currentPrice) / currentPrice) * 100;
    const confidenceAdjustedReturn = baseReturn * (confidence / 100);
    
    return Math.round(confidenceAdjustedReturn * 100) / 100; // Round to 2 decimal places
  }

  // Calculate risk level based on confidence
  private calculateRiskLevel(confidence: number): string {
    if (confidence >= 90) return 'Very Low';
    if (confidence >= 80) return 'Low';
    if (confidence >= 70) return 'Medium';
    if (confidence >= 60) return 'High';
    return 'Very High';
  }

  // Actualizar un trade existente
  async updateTrade(tradeId: string, updates: Partial<Trade>): Promise<boolean> {
    const index = this.trades.findIndex(t => t.id === tradeId);
    if (index === -1) return false;

    this.trades[index] = { ...this.trades[index], ...updates };
    await this.saveTrades();
    
    console.log(`📝 Updated trade ${tradeId}`);
    return true;
  }

  // Cerrar un trade
  async closeTrade(tradeId: string, exitPrice: number, outcome: 'win' | 'loss'): Promise<boolean> {
    const trade = this.trades.find(t => t.id === tradeId);
    if (!trade) return false;

    const returnPercentage = ((exitPrice - trade.entryPrice) / trade.entryPrice) * 100;
    const returnAmount = exitPrice - trade.entryPrice;

    await this.updateTrade(tradeId, {
      exitDate: new Date(),
      exitPrice,
      status: 'closed',
      outcome,
      returnPercentage,
      returnAmount,
      currentPrice: exitPrice,
    });

    console.log(`🏁 Closed trade ${tradeId} with ${outcome}: ${returnPercentage.toFixed(2)}%`);
    return true;
  }

  // Obtener todos los trades
  getTrades(): Trade[] {
    return [...this.trades];
  }

  // Obtener trades activos
  getActiveTrades(): Trade[] {
    return this.trades.filter(t => t.status === 'active');
  }

  // Obtener trades cerrados
  getClosedTrades(): Trade[] {
    return this.trades.filter(t => t.status === 'closed');
  }

  // Obtener estadísticas de trading
  getTradingStats(): TradingStats {
    const closedTrades = this.getClosedTrades();
    const wins = closedTrades.filter(t => t.outcome === 'win');
    const losses = closedTrades.filter(t => t.outcome === 'loss');

    const winRate = closedTrades.length > 0 ? (wins.length / closedTrades.length) * 100 : 0;
    
    const returns = closedTrades.map(t => t.returnPercentage || 0);
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const averageReturn = returns.length > 0 ? totalReturn / returns.length : 0;
    const bestTrade = returns.length > 0 ? Math.max(...returns) : 0;
    const worstTrade = returns.length > 0 ? Math.min(...returns) : 0;

    const holdingTimes = closedTrades
      .filter(t => t.exitDate)
      .map(t => (t.exitDate!.getTime() - t.entryDate.getTime()) / (1000 * 60 * 60 * 24));
    const avgHoldingTime = holdingTimes.length > 0 ? 
      holdingTimes.reduce((sum, h) => sum + h, 0) / holdingTimes.length : 0;

    // Stats por estrategia
    const winsByStrategy: { [strategy: string]: number } = {};
    const lossesByStrategy: { [strategy: string]: number } = {};
    
    wins.forEach(t => {
      winsByStrategy[t.strategy] = (winsByStrategy[t.strategy] || 0) + 1;
    });
    
    losses.forEach(t => {
      lossesByStrategy[t.strategy] = (lossesByStrategy[t.strategy] || 0) + 1;
    });

    // Returns mensuales
    const monthlyReturns = this.calculateMonthlyReturns(closedTrades);

    // New signal tracking metrics
    const fulfilledSignals = this.trades.filter(t => t.signalFulfilled);
    const expiredSignals = this.trades.filter(t => t.signalExpiry && new Date() > t.signalExpiry && !t.signalFulfilled);
    const fulfillmentRate = this.trades.length > 0 ? (fulfilledSignals.length / this.trades.length) * 100 : 0;
    const averageTimeToFulfillment = fulfilledSignals.length > 0 ? 
      fulfilledSignals.reduce((sum, t) => sum + (t.timeToFulfillment || 0), 0) / fulfilledSignals.length : 0;
    const signalAccuracy = closedTrades.length > 0 ? 
      (closedTrades.filter(t => t.signalFulfilled && t.outcome === 'win').length / closedTrades.length) * 100 : 0;

    return {
      totalTrades: this.trades.length,
      activeTrades: this.getActiveTrades().length,
      closedTrades: closedTrades.length,
      winRate,
      totalReturn,
      averageReturn,
      bestTrade,
      worstTrade,
      avgHoldingTime,
      winsByStrategy,
      lossesByStrategy,
      monthlyReturns,
      fulfillmentRate,
      averageTimeToFulfillment,
      signalAccuracy,
      expiredSignals: expiredSignals.length,
    };
  }

  // Calcular returns mensuales
  private calculateMonthlyReturns(closedTrades: Trade[]): { month: string; return: number }[] {
    const monthlyData: { [month: string]: number } = {};
    
    closedTrades.forEach(trade => {
      if (trade.exitDate && trade.returnPercentage !== undefined) {
        const monthKey = trade.exitDate.toISOString().slice(0, 7); // YYYY-MM
        monthlyData[monthKey] = (monthlyData[monthKey] || 0) + trade.returnPercentage;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, return_]) => ({ month, return: return_ }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  // Verificar si existe trade para una alerta
  hasTradeForAlert(alertId: string): boolean {
    return this.trades.some(t => t.alertId === alertId);
  }

  // Obtener trade por alerta ID
  getTradeByAlertId(alertId: string): Trade | undefined {
    return this.trades.find(t => t.alertId === alertId);
  }

  // Limpiar trades antiguos (opcional)
  async cleanOldTrades(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
    const initialCount = this.trades.length;
    
    this.trades = this.trades.filter(trade => 
      trade.status === 'active' || trade.entryDate > cutoffDate
    );
    
    const removedCount = initialCount - this.trades.length;
    if (removedCount > 0) {
      await this.saveTrades();
      console.log(`🧹 Cleaned ${removedCount} old trades`);
    }
    
    return removedCount;
  }

  // Simular outcome para trades activos (para testing)
  async simulateTradeOutcomes(): Promise<void> {
    const activeTrades = this.getActiveTrades();
    const promises = activeTrades.map(async (trade) => {
      // Solo simular trades que tengan más de 1 día
      const daysSinceEntry = (Date.now() - trade.entryDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEntry > 1) {
        const winProbability = Math.min(trade.confidence / 100 * 1.2, 0.9);
        const isWin = Math.random() < winProbability;
        
        const baseReturn = (trade.confidence / 100) * (trade.signal === 'buy' ? 1 : -1) * (2 + Math.random() * 8);
        const returnPercentage = isWin ? Math.abs(baseReturn) : -Math.abs(baseReturn);
        const exitPrice = trade.entryPrice * (1 + returnPercentage / 100);
        
        await this.closeTrade(trade.id, exitPrice, isWin ? 'win' : 'loss');
      }
    });
    
    await Promise.all(promises);
  }

  private getDataSource(alert: any): string {
    if (alert.dataSource) return alert.dataSource;
    if (alert.symbol.match(/BTC|ETH|ADA|SOL/)) return 'crypto';
    if (alert.symbol.match(/AAPL|GOOGL|MSFT|TSLA/)) return 'stocks';
    return 'unknown';
  }
}

export const tradeDatabase = new TradeDatabase();
export default tradeDatabase;

// Signal Performance Tracking Service
import AsyncStorage from '@react-native-async-storage/async-storage';
import { realMarketDataService } from './realMarketDataService';

export interface SignalPerformance {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  currentPrice?: number;
  targetPrice?: number;
  stopLoss?: number;
  entryDate: number;
  exitDate?: number;
  exitPrice?: number;
  status: 'active' | 'closed' | 'expired';
  outcome?: 'win' | 'loss' | 'breakeven';
  returnPercentage?: number;
  confidence: number;
  timeframe: string;
  dataSource: string;
  aiReasoning?: string;
}

export interface PerformanceStats {
  totalSignals: number;
  activeSignals: number;
  closedSignals: number;
  winRate: number;
  averageReturn: number;
  bestTrade: number;
  worstTrade: number;
  totalReturn: number;
  sharpeRatio?: number;
  maxDrawdown?: number;
  avgHoldingTime: number; // en días
  winsByTimeframe: Record<string, number>;
  lossesByTimeframe: Record<string, number>;
  performanceByConfidence: Record<string, { wins: number; losses: number; avgReturn: number }>;
  monthlyPerformance: Array<{
    month: string;
    trades: number;
    winRate: number;
    return: number;
  }>;
}

class SignalTrackingService {
  private readonly STORAGE_KEY = 'signal_performance';
  private readonly STATS_KEY = 'performance_stats';
  private signals: SignalPerformance[] = [];
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.loadSignals();
    this.startPerformanceTracking();
  }

  /**
   * Load signals from storage
   */
  private async loadSignals(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.signals = JSON.parse(stored);
        console.log(`📊 Loaded ${this.signals.length} signals for tracking`);
      }
    } catch (error) {
      console.error('Error loading signals:', error);
    }
  }

  /**
   * Save signals to storage
   */
  private async saveSignals(): Promise<void> {
    try {
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.signals));
    } catch (error) {
      console.error('Error saving signals:', error);
    }
  }

  /**
   * Add new signal to track
   */
  async addSignal(signal: Omit<SignalPerformance, 'id' | 'status'>): Promise<string> {
    const id = `signal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const newSignal: SignalPerformance = {
      ...signal,
      id,
      status: 'active'
    };

    this.signals.push(newSignal);
    await this.saveSignals();
    
    console.log(`🎯 New signal tracked: ${signal.type.toUpperCase()} ${signal.symbol} at $${signal.entryPrice}`);
    return id;
  }

  /**
   * Update signal with current market price
   */
  async updateSignal(id: string, updates: Partial<SignalPerformance>): Promise<void> {
    const signalIndex = this.signals.findIndex(s => s.id === id);
    if (signalIndex === -1) return;

    this.signals[signalIndex] = { ...this.signals[signalIndex], ...updates };
    await this.saveSignals();
  }

  /**
   * Close signal manually (e.g., when target/stop hit)
   */
  async closeSignal(id: string, exitPrice: number, outcome: 'win' | 'loss' | 'breakeven'): Promise<void> {
    const signal = this.signals.find(s => s.id === id);
    if (!signal) return;

    const returnPercentage = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;
    
    await this.updateSignal(id, {
      status: 'closed',
      exitDate: Date.now(),
      exitPrice,
      outcome,
      returnPercentage,
      currentPrice: exitPrice
    });

    console.log(`✅ Signal closed: ${signal.symbol} ${outcome.toUpperCase()} (${returnPercentage.toFixed(2)}%)`);
  }

  /**
   * Start automatic performance tracking
   */
  private startPerformanceTracking(): void {
    // Update every 5 minutes
    this.updateInterval = setInterval(() => {
      this.updateActiveSignals();
    }, 5 * 60 * 1000);

    // Initial update
    this.updateActiveSignals();
  }

  /**
   * Update all active signals with current prices
   */
  private async updateActiveSignals(): Promise<void> {
    const activeSignals = this.signals.filter(s => s.status === 'active');
    
    if (activeSignals.length === 0) return;

    console.log(`🔄 Updating ${activeSignals.length} active signals...`);

    for (const signal of activeSignals) {
      try {
        const currentPrice = await realMarketDataService.getCurrentPrice(signal.symbol);
        
        if (currentPrice > 0) {
          const returnPercentage = ((currentPrice - signal.entryPrice) / signal.entryPrice) * 100;
          
          // Check if signal should be auto-closed
          let shouldClose = false;
          let outcome: 'win' | 'loss' | 'breakeven' = 'breakeven';

          // Check target price
          if (signal.targetPrice && 
              ((signal.type === 'buy' && currentPrice >= signal.targetPrice) ||
               (signal.type === 'sell' && currentPrice <= signal.targetPrice))) {
            shouldClose = true;
            outcome = 'win';
          }

          // Check stop loss
          if (signal.stopLoss && 
              ((signal.type === 'buy' && currentPrice <= signal.stopLoss) ||
               (signal.type === 'sell' && currentPrice >= signal.stopLoss))) {
            shouldClose = true;
            outcome = 'loss';
          }

          // Auto-expire after 30 days
          const daysSinceEntry = (Date.now() - signal.entryDate) / (1000 * 60 * 60 * 24);
          if (daysSinceEntry > 30) {
            shouldClose = true;
            outcome = returnPercentage > 0 ? 'win' : returnPercentage < 0 ? 'loss' : 'breakeven';
          }

          if (shouldClose) {
            await this.closeSignal(signal.id, currentPrice, outcome);
          } else {
            await this.updateSignal(signal.id, {
              currentPrice,
              returnPercentage
            });
          }
        }
      } catch (error) {
        console.error(`Error updating signal ${signal.symbol}:`, error);
      }
    }
  }

  /**
   * Calculate comprehensive performance statistics
   */
  async getPerformanceStats(): Promise<PerformanceStats> {
    const closedSignals = this.signals.filter(s => s.status === 'closed');
    const activeSignals = this.signals.filter(s => s.status === 'active');
    
    const wins = closedSignals.filter(s => s.outcome === 'win');
    const losses = closedSignals.filter(s => s.outcome === 'loss');
    
    const winRate = closedSignals.length > 0 ? (wins.length / closedSignals.length) * 100 : 0;
    
    const returns = closedSignals.map(s => s.returnPercentage || 0);
    const averageReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
    const totalReturn = returns.reduce((a, b) => a + b, 0);
    
    const bestTrade = returns.length > 0 ? Math.max(...returns) : 0;
    const worstTrade = returns.length > 0 ? Math.min(...returns) : 0;
    
    // Calculate average holding time
    const holdingTimes = closedSignals
      .filter(s => s.exitDate)
      .map(s => (s.exitDate! - s.entryDate) / (1000 * 60 * 60 * 24));
    const avgHoldingTime = holdingTimes.length > 0 ? 
      holdingTimes.reduce((a, b) => a + b, 0) / holdingTimes.length : 0;

    // Performance by timeframe
    const winsByTimeframe: Record<string, number> = {};
    const lossesByTimeframe: Record<string, number> = {};
    
    wins.forEach(signal => {
      winsByTimeframe[signal.timeframe] = (winsByTimeframe[signal.timeframe] || 0) + 1;
    });
    
    losses.forEach(signal => {
      lossesByTimeframe[signal.timeframe] = (lossesByTimeframe[signal.timeframe] || 0) + 1;
    });

    // Performance by confidence level
    const performanceByConfidence: Record<string, { wins: number; losses: number; avgReturn: number }> = {};
    
    ['high', 'medium', 'low'].forEach(level => {
      const levelSignals = closedSignals.filter(s => {
        if (level === 'high') return s.confidence >= 80;
        if (level === 'medium') return s.confidence >= 50 && s.confidence < 80;
        return s.confidence < 50;
      });
      
      const levelWins = levelSignals.filter(s => s.outcome === 'win').length;
      const levelLosses = levelSignals.filter(s => s.outcome === 'loss').length;
      const levelReturns = levelSignals.map(s => s.returnPercentage || 0);
      const levelAvgReturn = levelReturns.length > 0 ? 
        levelReturns.reduce((a, b) => a + b, 0) / levelReturns.length : 0;
      
      performanceByConfidence[level] = {
        wins: levelWins,
        losses: levelLosses,
        avgReturn: levelAvgReturn
      };
    });

    // Monthly performance
    const monthlyPerformance = this.calculateMonthlyPerformance(closedSignals);

    // Calculate Sharpe ratio (simplified)
    const sharpeRatio = this.calculateSharpeRatio(returns);
    
    // Calculate max drawdown
    const maxDrawdown = this.calculateMaxDrawdown(closedSignals);

    const stats: PerformanceStats = {
      totalSignals: this.signals.length,
      activeSignals: activeSignals.length,
      closedSignals: closedSignals.length,
      winRate,
      averageReturn,
      bestTrade,
      worstTrade,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      avgHoldingTime,
      winsByTimeframe,
      lossesByTimeframe,
      performanceByConfidence,
      monthlyPerformance
    };

    // Save stats for historical tracking
    await AsyncStorage.setItem(this.STATS_KEY, JSON.stringify(stats));
    
    return stats;
  }

  /**
   * Calculate monthly performance breakdown
   */
  private calculateMonthlyPerformance(closedSignals: SignalPerformance[]): Array<{
    month: string;
    trades: number;
    winRate: number;
    return: number;
  }> {
    const monthlyData: Record<string, SignalPerformance[]> = {};
    
    closedSignals.forEach(signal => {
      const date = new Date(signal.entryDate);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = [];
      }
      monthlyData[monthKey].push(signal);
    });

    return Object.entries(monthlyData).map(([month, signals]) => {
      const wins = signals.filter(s => s.outcome === 'win').length;
      const winRate = (wins / signals.length) * 100;
      const totalReturn = signals.reduce((sum, s) => sum + (s.returnPercentage || 0), 0);
      
      return {
        month,
        trades: signals.length,
        winRate,
        return: totalReturn
      };
    }).sort((a, b) => b.month.localeCompare(a.month));
  }

  /**
   * Calculate Sharpe ratio (simplified)
   */
  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  /**
   * Calculate maximum drawdown
   */
  private calculateMaxDrawdown(closedSignals: SignalPerformance[]): number {
    if (closedSignals.length === 0) return 0;
    
    const sortedSignals = closedSignals.sort((a, b) => a.entryDate - b.entryDate);
    let peak = 0;
    let maxDrawdown = 0;
    let runningTotal = 0;
    
    for (const signal of sortedSignals) {
      runningTotal += signal.returnPercentage || 0;
      
      if (runningTotal > peak) {
        peak = runningTotal;
      }
      
      const drawdown = (peak - runningTotal) / Math.abs(peak) * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  /**
   * Get all signals with optional filtering
   */
  getSignals(filter?: {
    status?: 'active' | 'closed' | 'expired';
    symbol?: string;
    type?: 'buy' | 'sell' | 'hold';
    timeframe?: string;
  }): SignalPerformance[] {
    let filtered = [...this.signals];
    
    if (filter?.status) {
      filtered = filtered.filter(s => s.status === filter.status);
    }
    
    if (filter?.symbol) {
      filtered = filtered.filter(s => s.symbol.toLowerCase().includes(filter.symbol!.toLowerCase()));
    }
    
    if (filter?.type) {
      filtered = filtered.filter(s => s.type === filter.type);
    }
    
    if (filter?.timeframe) {
      filtered = filtered.filter(s => s.timeframe === filter.timeframe);
    }
    
    return filtered.sort((a, b) => b.entryDate - a.entryDate);
  }

  /**
   * Clean up service
   */
  destroy(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }
}

export const signalTrackingService = new SignalTrackingService();

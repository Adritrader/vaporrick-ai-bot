import AsyncStorage from '@react-native-async-storage/async-storage';
import { AutoAlert } from './autoAlertService';

export interface TradeExecution {
  id: string;
  alertId: string;
  symbol: string;
  action: 'buy' | 'sell';
  quantity: number;
  price: number;
  totalValue: number;
  commission: number;
  executedAt: number;
  status: 'pending' | 'executed' | 'failed' | 'cancelled';
  errorMessage?: string;
  confidence: number;
  strategy: string;
  executionMethod: 'automatic' | 'manual';
}

export interface TradingConfig {
  enabled: boolean;
  maxTradeAmount: number; // Maximum amount per trade in USD
  riskPercentage: number; // Percentage of portfolio to risk per trade
  minConfidence: number; // Minimum confidence to auto-execute
  allowedSymbols: string[]; // Symbols allowed for auto-trading
  stopLoss: number; // Stop loss percentage
  takeProfit: number; // Take profit percentage
  tradingHours: {
    start: string; // "09:00"
    end: string; // "16:00"
  };
  maxDailyTrades: number;
  enabledForCrypto: boolean;
  enabledForStocks: boolean;
}

export class AutoTradingService {
  private static instance: AutoTradingService;
  private readonly TRADES_KEY = '@vapor_trades';
  private readonly CONFIG_KEY = '@vapor_trading_config';
  
  private defaultConfig: TradingConfig = {
    enabled: false,
    maxTradeAmount: 100, // $100 per trade
    riskPercentage: 2, // 2% risk per trade
    minConfidence: 85, // 85% minimum confidence
    allowedSymbols: ['BTC', 'ETH', 'AAPL', 'GOOGL', 'MSFT'],
    stopLoss: 5, // 5% stop loss
    takeProfit: 10, // 10% take profit
    tradingHours: {
      start: '09:00',
      end: '16:00'
    },
    maxDailyTrades: 5,
    enabledForCrypto: true,
    enabledForStocks: false // Stocks require broker integration
  };

  public static getInstance(): AutoTradingService {
    if (!AutoTradingService.instance) {
      AutoTradingService.instance = new AutoTradingService();
    }
    return AutoTradingService.instance;
  }

  // Get trading configuration
  async getTradingConfig(): Promise<TradingConfig> {
    try {
      const configData = await AsyncStorage.getItem(this.CONFIG_KEY);
      if (configData) {
        return { ...this.defaultConfig, ...JSON.parse(configData) };
      }
      return this.defaultConfig;
    } catch (error) {
      console.error('Error loading trading config:', error);
      return this.defaultConfig;
    }
  }

  // Save trading configuration
  async saveTradingConfig(config: Partial<TradingConfig>): Promise<void> {
    try {
      const currentConfig = await this.getTradingConfig();
      const updatedConfig = { ...currentConfig, ...config };
      await AsyncStorage.setItem(this.CONFIG_KEY, JSON.stringify(updatedConfig));
      console.log('✅ Trading config saved:', updatedConfig);
    } catch (error) {
      console.error('❌ Error saving trading config:', error);
      throw error;
    }
  }

  // Check if trading is allowed for current conditions
  async canExecuteTrade(alert: AutoAlert): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.getTradingConfig();
    
    // Check if auto-trading is enabled
    if (!config.enabled) {
      return { allowed: false, reason: 'Auto-trading is disabled' };
    }

    // Check confidence threshold
    if (alert.confidence < config.minConfidence) {
      return { allowed: false, reason: `Confidence ${alert.confidence}% below minimum ${config.minConfidence}%` };
    }

    // Check if symbol is allowed
    if (!config.allowedSymbols.includes(alert.symbol)) {
      return { allowed: false, reason: `Symbol ${alert.symbol} not in allowed list` };
    }

    // Check asset type permissions
    const isCrypto = this.isCryptoSymbol(alert.symbol);
    const isStock = !isCrypto;
    
    if (isCrypto && !config.enabledForCrypto) {
      return { allowed: false, reason: 'Crypto trading is disabled' };
    }
    
    if (isStock && !config.enabledForStocks) {
      return { allowed: false, reason: 'Stock trading is disabled' };
    }

    // Check trading hours (for stocks)
    if (isStock && !this.isWithinTradingHours(config.tradingHours)) {
      return { allowed: false, reason: 'Outside trading hours' };
    }

    // Check daily trade limit
    const todayTrades = await this.getTodayTradeCount();
    if (todayTrades >= config.maxDailyTrades) {
      return { allowed: false, reason: `Daily trade limit reached (${config.maxDailyTrades})` };
    }

    // Check signal type (only execute buy/sell, not watch)
    if (alert.signal === 'watch') {
      return { allowed: false, reason: 'Watch signals are not executed automatically' };
    }

    return { allowed: true };
  }

  // Execute trade based on alert
  async executeTradeFromAlert(alert: AutoAlert): Promise<TradeExecution> {
    console.log(`🤖 Attempting to execute trade for ${alert.symbol} (${alert.signal})`);
    
    const canTrade = await this.canExecuteTrade(alert);
    if (!canTrade.allowed) {
      throw new Error(`Trade execution blocked: ${canTrade.reason}`);
    }

    const config = await this.getTradingConfig();
    const tradeExecution: TradeExecution = {
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      alertId: alert.id,
      symbol: alert.symbol,
      action: alert.signal as 'buy' | 'sell',
      quantity: this.calculateTradeQuantity(alert.currentPrice, config.maxTradeAmount),
      price: alert.currentPrice,
      totalValue: 0, // Will be calculated
      commission: 0, // Will be calculated
      executedAt: Date.now(),
      status: 'pending',
      confidence: alert.confidence,
      strategy: alert.strategy,
      executionMethod: 'automatic'
    };

    // Calculate total value and commission
    tradeExecution.totalValue = tradeExecution.quantity * tradeExecution.price;
    tradeExecution.commission = this.calculateCommission(tradeExecution.totalValue);

    try {
      // Simulate trade execution (in real app, this would call broker API)
      const executionResult = await this.simulateTradeExecution(tradeExecution);
      
      if (executionResult.success) {
        tradeExecution.status = 'executed';
        console.log(`✅ Trade executed: ${tradeExecution.action} ${tradeExecution.quantity} ${tradeExecution.symbol} at $${tradeExecution.price}`);
      } else {
        tradeExecution.status = 'failed';
        tradeExecution.errorMessage = executionResult.error;
        console.log(`❌ Trade failed: ${executionResult.error}`);
      }
    } catch (error) {
      tradeExecution.status = 'failed';
      tradeExecution.errorMessage = error.message;
      console.error('❌ Trade execution error:', error);
    }

    // Save trade to storage
    await this.saveTrade(tradeExecution);
    
    return tradeExecution;
  }

  // Get all trades
  async getAllTrades(): Promise<TradeExecution[]> {
    try {
      const tradesData = await AsyncStorage.getItem(this.TRADES_KEY);
      if (tradesData) {
        const trades = JSON.parse(tradesData);
        return trades.sort((a: TradeExecution, b: TradeExecution) => b.executedAt - a.executedAt);
      }
      return [];
    } catch (error) {
      console.error('Error loading trades:', error);
      return [];
    }
  }

  // Save trade to storage
  private async saveTrade(trade: TradeExecution): Promise<void> {
    try {
      const existingTrades = await this.getAllTrades();
      const updatedTrades = [trade, ...existingTrades];
      
      // Keep only last 1000 trades for performance
      const limitedTrades = updatedTrades.slice(0, 1000);
      
      await AsyncStorage.setItem(this.TRADES_KEY, JSON.stringify(limitedTrades));
      console.log(`💾 Trade saved: ${trade.id}`);
    } catch (error) {
      console.error('❌ Error saving trade:', error);
      throw error;
    }
  }

  // Get today's trade count
  private async getTodayTradeCount(): Promise<number> {
    const trades = await this.getAllTrades();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return trades.filter(trade => {
      const tradeDate = new Date(trade.executedAt);
      tradeDate.setHours(0, 0, 0, 0);
      return tradeDate.getTime() === today.getTime();
    }).length;
  }

  // Calculate trade quantity based on price and max amount
  private calculateTradeQuantity(price: number, maxAmount: number): number {
    const quantity = maxAmount / price;
    
    // Round to appropriate decimal places
    if (price > 100) {
      return Math.floor(quantity * 100) / 100; // 2 decimal places
    } else if (price > 1) {
      return Math.floor(quantity * 1000) / 1000; // 3 decimal places
    } else {
      return Math.floor(quantity * 10000) / 10000; // 4 decimal places
    }
  }

  // Calculate commission (0.1% for simulation)
  private calculateCommission(totalValue: number): number {
    return totalValue * 0.001; // 0.1% commission
  }

  // Check if symbol is cryptocurrency
  private isCryptoSymbol(symbol: string): boolean {
    const cryptoSymbols = ['BTC', 'ETH', 'ADA', 'SOL', 'AVAX', 'LINK', 'DOT', 'BNB', 'MATIC', 'UNI'];
    return cryptoSymbols.includes(symbol.toUpperCase());
  }

  // Check if current time is within trading hours
  private isWithinTradingHours(tradingHours: { start: string; end: string }): boolean {
    const now = new Date();
    const currentTime = now.getHours() * 100 + now.getMinutes(); // Convert to HHMM format
    
    const startTime = parseInt(tradingHours.start.replace(':', ''));
    const endTime = parseInt(tradingHours.end.replace(':', ''));
    
    return currentTime >= startTime && currentTime <= endTime;
  }

  // Simulate trade execution (replace with real broker API)
  private async simulateTradeExecution(trade: TradeExecution): Promise<{ success: boolean; error?: string }> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Simulate 95% success rate
    const random = Math.random();
    if (random < 0.95) {
      return { success: true };
    } else {
      const errors = [
        'Insufficient funds',
        'Market closed',
        'Symbol not found',
        'Network timeout',
        'Order rejected by exchange'
      ];
      return { 
        success: false, 
        error: errors[Math.floor(Math.random() * errors.length)]
      };
    }
  }

  // Get trading statistics
  async getTradingStats(): Promise<{
    totalTrades: number;
    successfulTrades: number;
    failedTrades: number;
    successRate: number;
    totalVolume: number;
    totalCommissions: number;
    profitLoss: number;
  }> {
    const trades = await this.getAllTrades();
    const executedTrades = trades.filter(t => t.status === 'executed');
    const failedTrades = trades.filter(t => t.status === 'failed');
    
    const totalVolume = executedTrades.reduce((sum, trade) => sum + trade.totalValue, 0);
    const totalCommissions = executedTrades.reduce((sum, trade) => sum + trade.commission, 0);
    
    // Simplified P&L calculation (in real app, would track actual exits)
    const profitLoss = executedTrades.reduce((sum, trade) => {
      // Simulate 3% average profit for demonstration
      const estimatedReturn = trade.totalValue * 0.03;
      return sum + estimatedReturn;
    }, 0) - totalCommissions;
    
    return {
      totalTrades: trades.length,
      successfulTrades: executedTrades.length,
      failedTrades: failedTrades.length,
      successRate: trades.length > 0 ? (executedTrades.length / trades.length) * 100 : 0,
      totalVolume,
      totalCommissions,
      profitLoss
    };
  }

  // Clear all trades (for testing/reset)
  async clearAllTrades(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.TRADES_KEY);
      console.log('🗑️ All trades cleared');
    } catch (error) {
      console.error('❌ Error clearing trades:', error);
      throw error;
    }
  }
}

export const autoTradingService = AutoTradingService.getInstance();

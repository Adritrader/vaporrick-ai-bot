// Backtesting engine for trading strategies
import { PriceData, analyzeTechnicals } from '../utils/technicalIndicators';

export interface BacktestResult {
  trades: Trade[];
  performance: {
    totalReturn: number;
    annualizedReturn: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    profitFactor: number;
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    averageWin: number;
    averageLoss: number;
    largestWin: number;
    largestLoss: number;
  };
  equityCurve: { date: string; equity: number; drawdown: number }[];
  monthlyReturns: { month: string; return: number }[];
}

export interface Trade {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  commission: number;
  profit: number;
  profitPercent: number;
  holdingPeriod: number;
  reason: string;
}

export interface Strategy {
  name: string;
  description: string;
  entryRules: StrategyRule[];
  exitRules: StrategyRule[];
  riskManagement: {
    stopLoss?: number; // Percentage
    takeProfit?: number; // Percentage
    positionSize: number; // Percentage of capital
    maxPositions: number;
  };
  symbol?: string; // Symbol-specific strategy
  metadata?: {
    strategyType?: string;
    confidenceScore?: number;
    generatedAt?: string;
    dataPoints?: number;
    volatility?: number;
    trendStrength?: number;
  };
}

export interface StrategyRule {
  indicator: string;
  condition: 'greater_than' | 'less_than' | 'crosses_above' | 'crosses_below' | 'between';
  value: number;
  value2?: number; // For 'between' condition
  lookback?: number; // For cross conditions
}

export interface BacktestSettings {
  initialCapital: number;
  commission: number; // Fixed commission per trade
  commissionPercent: number; // Percentage commission
  startDate: string;
  endDate: string;
  benchmark?: string; // Symbol to compare against
}

export class BacktestEngine {
  private settings: BacktestSettings;
  private strategy: Strategy;
  private priceData: PriceData[];
  private trades: Trade[] = [];
  private positions: { [symbol: string]: Position } = {};
  private cash: number;
  private totalEquity: number;
  private equityCurve: { date: string; equity: number; drawdown: number }[] = [];
  private highWaterMark: number;
  private maxDrawdown: number = 0;

  constructor(strategy: Strategy, settings: BacktestSettings) {
    this.strategy = strategy;
    this.settings = settings;
    this.cash = settings.initialCapital;
    this.totalEquity = settings.initialCapital;
    this.highWaterMark = settings.initialCapital;
  }

  async runBacktest(priceData: PriceData[]): Promise<BacktestResult> {
    this.priceData = priceData;
    this.initializeBacktest();

    // Process each day
    for (let i = 50; i < priceData.length; i++) { // Start from day 50 to have enough data for indicators
      const currentDay = priceData[i];
      await this.processDay(currentDay, i);
    }

    // Close all open positions at the end
    await this.closeAllPositions(priceData[priceData.length - 1]);

    return this.generateResults();
  }

  private initializeBacktest(): void {
    this.trades = [];
    this.positions = {};
    this.cash = this.settings.initialCapital;
    this.totalEquity = this.settings.initialCapital;
    this.equityCurve = [];
    this.highWaterMark = this.settings.initialCapital;
    this.maxDrawdown = 0;
  }

  private async processDay(currentDay: PriceData, dayIndex: number): Promise<void> {
    const symbol = 'SYMBOL'; // In real implementation, this would be dynamic
    
    // Get historical data for indicators
    const historicalData = this.priceData.slice(0, dayIndex + 1);
    const technicalAnalysis = analyzeTechnicals(historicalData);

    // Check exit conditions first
    await this.checkExitConditions(currentDay, technicalAnalysis, symbol);

    // Check entry conditions
    await this.checkEntryConditions(currentDay, technicalAnalysis, symbol);

    // Update equity curve
    this.updateEquity(currentDay);
  }

  private async checkEntryConditions(
    currentDay: PriceData,
    technicalAnalysis: any,
    symbol: string
  ): Promise<void> {
    // Don't enter if we already have a position
    if (this.positions[symbol]) return;

    // Check if we've reached max positions
    if (Object.keys(this.positions).length >= this.strategy.riskManagement.maxPositions) return;

    // Evaluate entry rules
    const entrySignal = this.evaluateRules(this.strategy.entryRules, technicalAnalysis, currentDay);

    if (entrySignal.shouldTrade) {
      const positionSize = this.calculatePositionSize(currentDay.close);
      const quantity = Math.floor(positionSize / currentDay.close);

      if (quantity > 0 && this.cash >= quantity * currentDay.close) {
        const commission = this.calculateCommission(quantity * currentDay.close);
        const totalCost = quantity * currentDay.close + commission;

        this.positions[symbol] = {
          symbol,
          quantity,
          entryPrice: currentDay.close,
          entryDate: currentDay.date,
          stopLoss: this.strategy.riskManagement.stopLoss 
            ? currentDay.close * (1 - this.strategy.riskManagement.stopLoss / 100)
            : undefined,
          takeProfit: this.strategy.riskManagement.takeProfit
            ? currentDay.close * (1 + this.strategy.riskManagement.takeProfit / 100)
            : undefined,
        };

        this.cash -= totalCost;
      }
    }
  }

  private async checkExitConditions(
    currentDay: PriceData,
    technicalAnalysis: any,
    symbol: string
  ): Promise<void> {
    const position = this.positions[symbol];
    if (!position) return;

    let shouldExit = false;
    let exitReason = '';

    // Check stop loss
    if (position.stopLoss && currentDay.low <= position.stopLoss) {
      shouldExit = true;
      exitReason = 'Stop loss';
    }

    // Check take profit
    if (position.takeProfit && currentDay.high >= position.takeProfit) {
      shouldExit = true;
      exitReason = 'Take profit';
    }

    // Check exit rules
    if (!shouldExit) {
      const exitSignal = this.evaluateRules(this.strategy.exitRules, technicalAnalysis, currentDay);
      if (exitSignal.shouldTrade) {
        shouldExit = true;
        exitReason = exitSignal.reason;
      }
    }

    if (shouldExit) {
      await this.closePosition(symbol, currentDay, exitReason);
    }
  }

  private evaluateRules(
    rules: StrategyRule[],
    technicalAnalysis: any,
    currentDay: PriceData
  ): { shouldTrade: boolean; reason: string } {
    let satisfied = 0;
    let reasons: string[] = [];

    for (const rule of rules) {
      const result = this.evaluateRule(rule, technicalAnalysis, currentDay);
      if (result.satisfied) {
        satisfied++;
        reasons.push(result.reason);
      }
    }

    // All rules must be satisfied
    const shouldTrade = satisfied === rules.length;

    return {
      shouldTrade,
      reason: reasons.join(', '),
    };
  }

  private evaluateRule(
    rule: StrategyRule,
    technicalAnalysis: any,
    currentDay: PriceData
  ): { satisfied: boolean; reason: string } {
    const indicators = technicalAnalysis.indicators;
    let value: number;
    let reason = '';

    // Get indicator value
    switch (rule.indicator) {
      case 'price':
        value = currentDay.close;
        break;
      case 'sma20':
        value = indicators.sma20[indicators.sma20.length - 1];
        break;
      case 'sma50':
        value = indicators.sma50[indicators.sma50.length - 1];
        break;
      case 'rsi':
        value = indicators.rsi[indicators.rsi.length - 1];
        break;
      case 'macd':
        value = indicators.macd.macd[indicators.macd.macd.length - 1];
        break;
      case 'macd_signal':
        value = indicators.macd.signal[indicators.macd.signal.length - 1];
        break;
      default:
        return { satisfied: false, reason: 'Unknown indicator' };
    }

    // Evaluate condition
    let satisfied = false;

    switch (rule.condition) {
      case 'greater_than':
        satisfied = value > rule.value;
        reason = `${rule.indicator} (${value.toFixed(2)}) > ${rule.value}`;
        break;
      case 'less_than':
        satisfied = value < rule.value;
        reason = `${rule.indicator} (${value.toFixed(2)}) < ${rule.value}`;
        break;
      case 'between':
        satisfied = value >= rule.value && value <= (rule.value2 || 0);
        reason = `${rule.indicator} (${value.toFixed(2)}) between ${rule.value} and ${rule.value2}`;
        break;
      case 'crosses_above':
        // Implementation for cross conditions would need additional logic
        satisfied = false;
        reason = 'Cross conditions not implemented';
        break;
      case 'crosses_below':
        satisfied = false;
        reason = 'Cross conditions not implemented';
        break;
    }

    return { satisfied, reason };
  }

  private calculatePositionSize(price: number): number {
    const positionValue = this.totalEquity * (this.strategy.riskManagement.positionSize / 100);
    return Math.min(positionValue, this.cash);
  }

  private calculateCommission(tradeValue: number): number {
    const fixedCommission = this.settings.commission;
    const percentCommission = tradeValue * (this.settings.commissionPercent / 100);
    return fixedCommission + percentCommission;
  }

  private async closePosition(symbol: string, currentDay: PriceData, reason: string): Promise<void> {
    const position = this.positions[symbol];
    if (!position) return;

    const commission = this.calculateCommission(position.quantity * currentDay.close);
    const proceeds = position.quantity * currentDay.close - commission;
    const profit = proceeds - (position.quantity * position.entryPrice);
    const profitPercent = (profit / (position.quantity * position.entryPrice)) * 100;

    const trade: Trade = {
      id: `${symbol}_${position.entryDate}_${currentDay.date}`,
      symbol,
      type: 'buy', // Assuming long positions for now
      entryDate: position.entryDate,
      exitDate: currentDay.date,
      entryPrice: position.entryPrice,
      exitPrice: currentDay.close,
      quantity: position.quantity,
      commission: commission,
      profit,
      profitPercent,
      holdingPeriod: this.calculateHoldingPeriod(position.entryDate, currentDay.date),
      reason,
    };

    this.trades.push(trade);
    this.cash += proceeds;
    delete this.positions[symbol];
  }

  private async closeAllPositions(currentDay: PriceData): Promise<void> {
    for (const symbol of Object.keys(this.positions)) {
      await this.closePosition(symbol, currentDay, 'End of backtest');
    }
  }

  private updateEquity(currentDay: PriceData): void {
    let positionValue = 0;
    
    for (const position of Object.values(this.positions)) {
      positionValue += position.quantity * currentDay.close;
    }

    this.totalEquity = this.cash + positionValue;

    // Update high water mark and drawdown
    if (this.totalEquity > this.highWaterMark) {
      this.highWaterMark = this.totalEquity;
    }

    const drawdown = (this.highWaterMark - this.totalEquity) / this.highWaterMark;
    this.maxDrawdown = Math.max(this.maxDrawdown, drawdown);

    this.equityCurve.push({
      date: currentDay.date,
      equity: this.totalEquity,
      drawdown: drawdown * 100,
    });
  }

  private calculateHoldingPeriod(entryDate: string, exitDate: string): number {
    const entry = new Date(entryDate);
    const exit = new Date(exitDate);
    return Math.floor((exit.getTime() - entry.getTime()) / (1000 * 60 * 60 * 24));
  }

  private generateResults(): BacktestResult {
    const winningTrades = this.trades.filter(t => t.profit > 0);
    const losingTrades = this.trades.filter(t => t.profit < 0);

    const totalReturn = ((this.totalEquity - this.settings.initialCapital) / this.settings.initialCapital) * 100;
    const totalDays = this.equityCurve.length;
    const annualizedReturn = totalReturn * (365 / totalDays);

    const returns = this.equityCurve.map((point, index) => {
      if (index === 0) return 0;
      return (point.equity - this.equityCurve[index - 1].equity) / this.equityCurve[index - 1].equity;
    });

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const returnStdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStdDev !== 0 ? (avgReturn / returnStdDev) * Math.sqrt(252) : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.profit, 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.profit, 0));
    const profitFactor = grossLoss !== 0 ? grossProfit / grossLoss : 0;

    const performance = {
      totalReturn,
      annualizedReturn,
      sharpeRatio,
      maxDrawdown: this.maxDrawdown * 100,
      winRate: this.trades.length > 0 ? (winningTrades.length / this.trades.length) * 100 : 0,
      profitFactor,
      totalTrades: this.trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin: winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + t.profit, 0) / winningTrades.length : 0,
      averageLoss: losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + t.profit, 0) / losingTrades.length : 0,
      largestWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.profit)) : 0,
      largestLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.profit)) : 0,
    };

    // Calculate monthly returns
    const monthlyReturns = this.calculateMonthlyReturns();

    return {
      trades: this.trades,
      performance,
      equityCurve: this.equityCurve,
      monthlyReturns,
    };
  }

  private calculateMonthlyReturns(): { month: string; return: number }[] {
    const monthlyReturns: { month: string; return: number }[] = [];
    const monthlyData = new Map<string, { start: number; end: number }>();

    for (const point of this.equityCurve) {
      const month = point.date.substring(0, 7); // YYYY-MM
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { start: point.equity, end: point.equity });
      } else {
        monthlyData.get(month)!.end = point.equity;
      }
    }

    for (const [month, data] of monthlyData) {
      const returnPct = ((data.end - data.start) / data.start) * 100;
      monthlyReturns.push({ month, return: returnPct });
    }

    return monthlyReturns;
  }
}

interface Position {
  symbol: string;
  quantity: number;
  entryPrice: number;
  entryDate: string;
  stopLoss?: number;
  takeProfit?: number;
}

// Example strategies
export const sampleStrategies: Strategy[] = [
  {
    name: 'RSI Mean Reversion',
    description: 'Buy when RSI is oversold, sell when overbought',
    entryRules: [
      { indicator: 'rsi', condition: 'less_than', value: 30 },
    ],
    exitRules: [
      { indicator: 'rsi', condition: 'greater_than', value: 70 },
    ],
    riskManagement: {
      stopLoss: 5,
      takeProfit: 10,
      positionSize: 10,
      maxPositions: 3,
    },
  },
  {
    name: 'MACD Crossover',
    description: 'Buy when MACD crosses above signal line',
    entryRules: [
      { indicator: 'macd', condition: 'greater_than', value: 0 },
    ],
    exitRules: [
      { indicator: 'macd', condition: 'less_than', value: 0 },
    ],
    riskManagement: {
      stopLoss: 3,
      positionSize: 15,
      maxPositions: 2,
    },
  },
  {
    name: 'Moving Average Crossover',
    description: 'Buy when price is above both moving averages',
    entryRules: [
      { indicator: 'price', condition: 'greater_than', value: 0 }, // This would be compared to SMA in real implementation
    ],
    exitRules: [
      { indicator: 'price', condition: 'less_than', value: 0 }, // This would be compared to SMA in real implementation
    ],
    riskManagement: {
      stopLoss: 4,
      takeProfit: 8,
      positionSize: 20,
      maxPositions: 1,
    },
  },
];

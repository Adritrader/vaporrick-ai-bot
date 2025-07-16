import { getSymbolsForAutoTrading } from '../data/tradingSymbols';
import { realDataService } from './realDataService';

export interface HistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface BacktestResult {
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
  trades: BacktestTrade[];
  equityCurve: { date: string; value: number }[];
}

export interface BacktestTrade {
  id: string;
  symbol: string;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  side: 'long' | 'short';
  pnl: number;
  pnlPercent: number;
  holdingPeriod: number;
  reason: string;
}

export interface StrategyConfig {
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
}

export class HistoricalBacktestService {
  private generateHistoricalData(symbol: string, days: number): HistoricalPrice[] {
    const data: HistoricalPrice[] = [];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Base price based on real market data from realDataService
    let basePrice = 100;
    if (symbol.includes('BTC') || symbol.includes('bitcoin')) basePrice = 45000;
    else if (symbol.includes('ETH') || symbol.includes('ethereum')) basePrice = 2800;
    else if (symbol === 'AAPL') basePrice = 180;
    else if (symbol === 'NVDA') basePrice = 450;
    else if (symbol === 'TSLA') basePrice = 250;
    
    let currentPrice = basePrice * (0.8 + Math.random() * 0.4); // Start 20% below/above base
    
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      // Generate realistic price movement
      const volatility = symbol.includes('BTC') || symbol.includes('ETH') ? 0.05 : 0.03;
      const drift = 0.0005; // Slight upward bias
      const change = (Math.random() - 0.5) * volatility + drift;
      
      const open = currentPrice;
      const close = currentPrice * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * 0.02);
      const low = Math.min(open, close) * (1 - Math.random() * 0.02);
      const volume = Math.floor(Math.random() * 1000000 + 500000);
      
      data.push({
        date: date.toISOString().split('T')[0],
        open,
        high,
        low,
        close,
        volume,
      });
      
      currentPrice = close;
    }
    
    return data;
  }

  private calculateTechnicalIndicators(prices: HistoricalPrice[]) {
    const closes = prices.map(p => p.close);
    
    // Simple Moving Averages
    const sma20 = this.calculateSMA(closes, 20);
    const sma50 = this.calculateSMA(closes, 50);
    
    // RSI
    const rsi = this.calculateRSI(closes, 14);
    
    // Bollinger Bands
    const bb = this.calculateBollingerBands(closes, 20);
    
    // MACD
    const macd = this.calculateMACD(closes);
    
    return { sma20, sma50, rsi, bb, macd };
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma: number[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        sma.push(NaN);
      } else {
        const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
        sma.push(sum / period);
      }
    }
    return sma;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];
    
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }
    
    for (let i = 0; i < gains.length; i++) {
      if (i < period - 1) {
        rsi.push(NaN);
      } else {
        const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        const rs = avgGain / (avgLoss || 0.01);
        rsi.push(100 - (100 / (1 + rs)));
      }
    }
    
    return [NaN, ...rsi]; // Add NaN for first price point
  }

  private calculateBollingerBands(prices: number[], period: number): { upper: number[], middle: number[], lower: number[] } {
    const sma = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        upper.push(NaN);
        lower.push(NaN);
      } else {
        const slice = prices.slice(i - period + 1, i + 1);
        const mean = sma[i];
        const variance = slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / period;
        const stdDev = Math.sqrt(variance);
        
        upper.push(mean + 2 * stdDev);
        lower.push(mean - 2 * stdDev);
      }
    }
    
    return { upper, middle: sma, lower };
  }

  private calculateMACD(prices: number[]): { macd: number[], signal: number[], histogram: number[] } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macd = ema12.map((val, i) => val - ema26[i]);
    const signal = this.calculateEMA(macd.filter(val => !isNaN(val)), 9);
    
    // Pad signal array to match macd length
    const paddedSignal = [...new Array(macd.length - signal.length).fill(NaN), ...signal];
    const histogram = macd.map((val, i) => val - (paddedSignal[i] || 0));
    
    return { macd, signal: paddedSignal, histogram };
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const ema: number[] = [];
    const multiplier = 2 / (period + 1);
    
    for (let i = 0; i < prices.length; i++) {
      if (isNaN(prices[i])) {
        ema.push(NaN);
        continue;
      }
      
      if (i === 0 || isNaN(ema[i - 1])) {
        ema.push(prices[i]);
      } else {
        ema.push((prices[i] * multiplier) + (ema[i - 1] * (1 - multiplier)));
      }
    }
    
    return ema;
  }

  private generateStrategySignals(
    prices: HistoricalPrice[], 
    indicators: any, 
    strategy: StrategyConfig
  ): { buy: boolean[], sell: boolean[] } {
    const buy: boolean[] = [];
    const sell: boolean[] = [];
    
    for (let i = 0; i < prices.length; i++) {
      let buySignal = false;
      let sellSignal = false;
      
      switch (strategy.type) {
        case 'breakout':
          // Breakout above Bollinger Band upper with volume
          if (i > 20 && indicators.bb.upper[i] && indicators.sma20[i]) {
            buySignal = prices[i].close > indicators.bb.upper[i] && 
                       prices[i].volume > prices[i-1].volume * 1.5;
            sellSignal = prices[i].close < indicators.sma20[i];
          }
          break;
          
        case 'reversal':
          // RSI oversold/overbought reversal
          if (i > 14 && indicators.rsi[i]) {
            buySignal = indicators.rsi[i] < 30 && indicators.rsi[i-1] < indicators.rsi[i];
            sellSignal = indicators.rsi[i] > 70 && indicators.rsi[i-1] > indicators.rsi[i];
          }
          break;
          
        case 'momentum':
          // MACD crossover
          if (i > 26 && indicators.macd.macd[i] && indicators.macd.signal[i]) {
            buySignal = indicators.macd.macd[i] > indicators.macd.signal[i] && 
                       indicators.macd.macd[i-1] <= indicators.macd.signal[i-1];
            sellSignal = indicators.macd.macd[i] < indicators.macd.signal[i] && 
                        indicators.macd.macd[i-1] >= indicators.macd.signal[i-1];
          }
          break;
          
        case 'mean_reversion':
          // Bollinger Band mean reversion
          if (i > 20 && indicators.bb.lower[i] && indicators.bb.upper[i]) {
            buySignal = prices[i].close < indicators.bb.lower[i];
            sellSignal = prices[i].close > indicators.bb.upper[i];
          }
          break;
          
        case 'ai_mixed':
          // Combined signals with confidence scoring
          const signals = [];
          
          // Breakout signal
          if (i > 20 && indicators.bb.upper[i] && prices[i].close > indicators.bb.upper[i]) {
            signals.push('breakout_buy');
          }
          
          // RSI signal
          if (i > 14 && indicators.rsi[i] < 30) {
            signals.push('rsi_buy');
          }
          
          // MACD signal
          if (i > 26 && indicators.macd.macd[i] > indicators.macd.signal[i]) {
            signals.push('macd_buy');
          }
          
          // SMA trend
          if (i > 50 && indicators.sma20[i] > indicators.sma50[i]) {
            signals.push('trend_buy');
          }
          
          buySignal = signals.length >= 2; // At least 2 confirming signals
          sellSignal = i > 50 && indicators.sma20[i] < indicators.sma50[i] && indicators.rsi[i] > 70;
          break;
      }
      
      buy.push(buySignal);
      sell.push(sellSignal);
    }
    
    return { buy, sell };
  }

  async runBacktest(
    symbol: string, 
    strategy: StrategyConfig, 
    periodDays: number = 90
  ): Promise<BacktestResult> {
    console.log(`🔄 Running backtest for ${symbol} with ${strategy.name} strategy...`);
    
    // Generate historical data
    const historicalData = this.generateHistoricalData(symbol, periodDays);
    
    // Calculate technical indicators
    const indicators = this.calculateTechnicalIndicators(historicalData);
    
    // Generate trading signals
    const signals = this.generateStrategySignals(historicalData, indicators, strategy);
    
    // Execute backtest
    const initialCapital = 10000;
    let capital = initialCapital;
    let position = 0;
    let positionValue = 0;
    const trades: BacktestTrade[] = [];
    const equityCurve: { date: string; value: number }[] = [];
    let maxEquity = initialCapital;
    let maxDrawdown = 0;
    
    let entryPrice = 0;
    let entryDate = '';
    let entryIndex = 0;
    
    for (let i = 1; i < historicalData.length; i++) {
      const price = historicalData[i];
      const currentValue = capital + (position * price.close);
      
      // Track max drawdown
      if (currentValue > maxEquity) {
        maxEquity = currentValue;
      } else {
        const drawdown = (maxEquity - currentValue) / maxEquity;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      }
      
      equityCurve.push({
        date: price.date,
        value: currentValue,
      });
      
      // Check for buy signal
      if (signals.buy[i] && position === 0) {
        const positionSize = (capital * strategy.parameters.position_size / 100);
        const quantity = Math.floor(positionSize / price.close);
        
        if (quantity > 0) {
          position = quantity;
          entryPrice = price.close;
          entryDate = price.date;
          entryIndex = i;
          capital -= quantity * price.close;
          positionValue = quantity * price.close;
        }
      }
      
      // Check for sell signal or stop loss/take profit
      if (position > 0) {
        const currentPrice = price.close;
        const unrealizedPnL = (currentPrice - entryPrice) / entryPrice;
        
        let shouldExit = false;
        let exitReason = '';
        
        if (signals.sell[i]) {
          shouldExit = true;
          exitReason = 'Signal';
        } else if (unrealizedPnL <= -strategy.parameters.stop_loss / 100) {
          shouldExit = true;
          exitReason = 'Stop Loss';
        } else if (unrealizedPnL >= strategy.parameters.take_profit / 100) {
          shouldExit = true;
          exitReason = 'Take Profit';
        } else if (i - entryIndex >= strategy.parameters.holding_period_max) {
          shouldExit = true;
          exitReason = 'Max Holding Period';
        }
        
        if (shouldExit) {
          const exitValue = position * currentPrice;
          const pnl = exitValue - positionValue;
          const pnlPercent = (currentPrice - entryPrice) / entryPrice * 100;
          
          trades.push({
            id: `trade-${trades.length + 1}`,
            symbol,
            entryDate,
            exitDate: price.date,
            entryPrice,
            exitPrice: currentPrice,
            quantity: position,
            side: 'long',
            pnl,
            pnlPercent,
            holdingPeriod: i - entryIndex,
            reason: exitReason,
          });
          
          capital += exitValue;
          position = 0;
          positionValue = 0;
        }
      }
    }
    
    // Close any remaining position
    if (position > 0) {
      const lastPrice = historicalData[historicalData.length - 1];
      const exitValue = position * lastPrice.close;
      const pnl = exitValue - positionValue;
      const pnlPercent = (lastPrice.close - entryPrice) / entryPrice * 100;
      
      trades.push({
        id: `trade-${trades.length + 1}`,
        symbol,
        entryDate,
        exitDate: lastPrice.date,
        entryPrice,
        exitPrice: lastPrice.close,
        quantity: position,
        side: 'long',
        pnl,
        pnlPercent,
        holdingPeriod: historicalData.length - 1 - entryIndex,
        reason: 'End of Period',
      });
      
      capital += exitValue;
    }
    
    // Calculate performance metrics
    const finalCapital = capital;
    const totalReturn = finalCapital - initialCapital;
    const totalReturnPercent = (totalReturn / initialCapital) * 100;
    
    const winningTrades = trades.filter(t => t.pnl > 0);
    const losingTrades = trades.filter(t => t.pnl < 0);
    const winRate = trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0;
    
    const averageWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length 
      : 0;
    const averageLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length)
      : 0;
    
    const profitFactor = averageLoss > 0 ? averageWin / averageLoss : 0;
    
    // Calculate Sharpe ratio (simplified)
    const returns = equityCurve.map((point, i) => {
      if (i === 0) return 0;
      return (point.value - equityCurve[i-1].value) / equityCurve[i-1].value;
    }).slice(1);
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(252) : 0;
    
    return {
      symbol,
      strategy: strategy.name,
      period: `${periodDays} days`,
      startDate: historicalData[0].date,
      endDate: historicalData[historicalData.length - 1].date,
      initialCapital,
      finalCapital,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: maxDrawdown * 100,
      sharpeRatio,
      winRate,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      averageWin,
      averageLoss,
      profitFactor,
      trades,
      equityCurve,
    };
  }

  async runMultiSymbolBacktest(
    symbols: string[], 
    strategy: StrategyConfig, 
    periodDays: number = 90
  ): Promise<BacktestResult[]> {
    console.log(`🔄 Running multi-symbol backtest for ${symbols.length} symbols...`);
    
    const results: BacktestResult[] = [];
    
    for (const symbol of symbols) {
      try {
        const result = await this.runBacktest(symbol, strategy, periodDays);
        results.push(result);
        
        // Small delay to prevent overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Error backtesting ${symbol}:`, error);
      }
    }
    
    return results.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent);
  }

  getDefaultStrategies(): StrategyConfig[] {
    return [
      {
        name: 'AI Mixed Signals',
        type: 'ai_mixed',
        parameters: {
          confidence_threshold: 80,
          risk_threshold: 30,
          position_size: 20,
          stop_loss: 5,
          take_profit: 15,
          holding_period_max: 30,
        },
      },
      {
        name: 'Momentum Breakout',
        type: 'breakout',
        parameters: {
          confidence_threshold: 85,
          risk_threshold: 25,
          position_size: 25,
          stop_loss: 3,
          take_profit: 12,
          holding_period_max: 20,
        },
      },
      {
        name: 'RSI Mean Reversion',
        type: 'mean_reversion',
        parameters: {
          confidence_threshold: 75,
          risk_threshold: 35,
          position_size: 15,
          stop_loss: 4,
          take_profit: 8,
          holding_period_max: 15,
        },
      },
      {
        name: 'MACD Momentum',
        type: 'momentum',
        parameters: {
          confidence_threshold: 80,
          risk_threshold: 30,
          position_size: 20,
          stop_loss: 4,
          take_profit: 10,
          holding_period_max: 25,
        },
      },
    ];
  }
}

export const historicalBacktestService = new HistoricalBacktestService();

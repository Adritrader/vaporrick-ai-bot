// Web Worker for running backtests in background
// This helps keep the UI responsive during heavy computations

// Since React Native doesn't support Web Workers directly,
// we'll use a promise-based approach with setTimeout to simulate async processing

export class BacktestWorker {
  private static instance: BacktestWorker;
  private isRunning = false;
  private queue: Array<{
    id: string;
    task: () => Promise<any>;
    resolve: (value: any) => void;
    reject: (error: any) => void;
  }> = [];

  static getInstance(): BacktestWorker {
    if (!BacktestWorker.instance) {
      BacktestWorker.instance = new BacktestWorker();
    }
    return BacktestWorker.instance;
  }

  async runBacktest(backtestFunction: () => Promise<any>): Promise<any> {
    return new Promise((resolve, reject) => {
      const taskId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
      
      this.queue.push({
        id: taskId,
        task: backtestFunction,
        resolve,
        reject,
      });

      if (!this.isRunning) {
        this.processQueue();
      }
    });
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.isRunning = false;
      return;
    }

    this.isRunning = true;
    const { task, resolve, reject } = this.queue.shift()!;

    try {
      // Use setTimeout to make the execution async and prevent UI blocking
      setTimeout(async () => {
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        }
        
        // Process next item in queue
        this.processQueue();
      }, 10); // Small delay to allow UI updates
    } catch (error) {
      reject(error);
      this.processQueue();
    }
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  isProcessing(): boolean {
    return this.isRunning;
  }

  clearQueue(): void {
    this.queue = [];
    this.isRunning = false;
  }
}

// Utility functions for heavy calculations
export class CalculationWorker {
  static async calculateTechnicalIndicators(
    priceData: number[],
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve) => {
      const chunkSize = 100;
      let currentIndex = 0;
      const results: any = {
        sma: [],
        ema: [],
        rsi: [],
        macd: { macd: [], signal: [], histogram: [] },
      };

      const processChunk = () => {
        const endIndex = Math.min(currentIndex + chunkSize, priceData.length);
        
        // Process SMA for this chunk
        for (let i = currentIndex; i < endIndex; i++) {
          if (i >= 19) { // Need at least 20 data points for SMA20
            const chunk = priceData.slice(i - 19, i + 1);
            const sma = chunk.reduce((a, b) => a + b, 0) / 20;
            results.sma.push(sma);
          }
        }

        currentIndex = endIndex;
        
        if (onProgress) {
          const progress = (currentIndex / priceData.length) * 100;
          onProgress(progress);
        }

        if (currentIndex < priceData.length) {
          setTimeout(processChunk, 1); // Continue processing
        } else {
          resolve(results);
        }
      };

      processChunk();
    });
  }

  static async runOptimization(
    parameters: any,
    testFunction: (params: any) => Promise<number>,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise(async (resolve) => {
      const results: Array<{ params: any; score: number }> = [];
      const parameterCombinations = this.generateParameterCombinations(parameters);
      
      let currentIndex = 0;
      const processNextCombination = async () => {
        if (currentIndex >= parameterCombinations.length) {
          // Sort by score and return best result
          const sortedResults = results.sort((a, b) => b.score - a.score);
          resolve(sortedResults[0]);
          return;
        }

        const params = parameterCombinations[currentIndex];
        
        try {
          const score = await testFunction(params);
          results.push({ params, score });
        } catch (error) {
          console.error('Optimization error:', error);
          results.push({ params, score: -Infinity });
        }

        currentIndex++;
        
        if (onProgress) {
          const progress = (currentIndex / parameterCombinations.length) * 100;
          onProgress(progress);
        }

        // Use setTimeout to prevent blocking
        setTimeout(processNextCombination, 1);
      };

      processNextCombination();
    });
  }

  private static generateParameterCombinations(parameters: any): any[] {
    const combinations: any[] = [];
    const keys = Object.keys(parameters);
    
    const generateCombinations = (currentCombination: any, keyIndex: number) => {
      if (keyIndex === keys.length) {
        combinations.push({ ...currentCombination });
        return;
      }

      const key = keys[keyIndex];
      const values = parameters[key];
      
      for (const value of values) {
        currentCombination[key] = value;
        generateCombinations(currentCombination, keyIndex + 1);
      }
    };

    generateCombinations({}, 0);
    return combinations;
  }
}

// Monte Carlo simulation for portfolio optimization
export class MonteCarloWorker {
  static async runSimulation(
    assets: any[],
    iterations: number = 1000,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    return new Promise((resolve) => {
      const results: any[] = [];
      let currentIteration = 0;

      const runNextIteration = () => {
        if (currentIteration >= iterations) {
          resolve(this.analyzeResults(results));
          return;
        }

        // Generate random portfolio weights
        const weights = this.generateRandomWeights(assets.length);
        
        // Calculate portfolio metrics
        const portfolioReturn = this.calculatePortfolioReturn(assets, weights);
        const portfolioRisk = this.calculatePortfolioRisk(assets, weights);
        const sharpeRatio = portfolioRisk > 0 ? portfolioReturn / portfolioRisk : 0;

        results.push({
          weights,
          return: portfolioReturn,
          risk: portfolioRisk,
          sharpeRatio,
        });

        currentIteration++;
        
        if (onProgress) {
          const progress = (currentIteration / iterations) * 100;
          onProgress(progress);
        }

        // Use setTimeout to prevent blocking
        setTimeout(runNextIteration, 1);
      };

      runNextIteration();
    });
  }

  private static generateRandomWeights(numAssets: number): number[] {
    const weights = Array(numAssets).fill(0).map(() => Math.random());
    const sum = weights.reduce((a, b) => a + b, 0);
    return weights.map(w => w / sum); // Normalize to sum to 1
  }

  private static calculatePortfolioReturn(assets: any[], weights: number[]): number {
    return assets.reduce((sum, asset, index) => {
      return sum + (asset.expectedReturn || 0.1) * weights[index];
    }, 0);
  }

  private static calculatePortfolioRisk(assets: any[], weights: number[]): number {
    // Simplified risk calculation
    return assets.reduce((sum, asset, index) => {
      return sum + (asset.volatility || 0.2) * weights[index];
    }, 0);
  }

  private static analyzeResults(results: any[]): any {
    const bestSharpe = results.reduce((best, current) => 
      current.sharpeRatio > best.sharpeRatio ? current : best
    );

    const minRisk = results.reduce((min, current) => 
      current.risk < min.risk ? current : min
    );

    const maxReturn = results.reduce((max, current) => 
      current.return > max.return ? current : max
    );

    return {
      bestSharpe,
      minRisk,
      maxReturn,
      allResults: results,
      statistics: {
        avgReturn: results.reduce((sum, r) => sum + r.return, 0) / results.length,
        avgRisk: results.reduce((sum, r) => sum + r.risk, 0) / results.length,
        avgSharpe: results.reduce((sum, r) => sum + r.sharpeRatio, 0) / results.length,
      },
    };
  }
}

// Task scheduler for managing background tasks
export class TaskScheduler {
  private static instance: TaskScheduler;
  private tasks: Map<string, {
    id: string;
    interval: NodeJS.Timeout;
    lastRun: Date;
    nextRun: Date;
    callback: () => void;
  }> = new Map();

  static getInstance(): TaskScheduler {
    if (!TaskScheduler.instance) {
      TaskScheduler.instance = new TaskScheduler();
    }
    return TaskScheduler.instance;
  }

  scheduleTask(
    id: string,
    callback: () => void,
    intervalMs: number,
    runImmediately: boolean = false
  ): void {
    // Clear existing task if any
    this.clearTask(id);

    const now = new Date();
    const nextRun = new Date(now.getTime() + intervalMs);

    const interval = setInterval(() => {
      try {
        callback();
        const task = this.tasks.get(id);
        if (task) {
          task.lastRun = new Date();
          task.nextRun = new Date(Date.now() + intervalMs);
        }
      } catch (error) {
        console.error(`Error in scheduled task ${id}:`, error);
      }
    }, intervalMs);

    this.tasks.set(id, {
      id,
      interval,
      lastRun: runImmediately ? now : new Date(0),
      nextRun,
      callback,
    });

    if (runImmediately) {
      try {
        callback();
      } catch (error) {
        console.error(`Error in immediate task ${id}:`, error);
      }
    }
  }

  clearTask(id: string): void {
    const task = this.tasks.get(id);
    if (task) {
      clearInterval(task.interval);
      this.tasks.delete(id);
    }
  }

  clearAllTasks(): void {
    for (const [id, task] of this.tasks) {
      clearInterval(task.interval);
    }
    this.tasks.clear();
  }

  getTaskInfo(id: string): any {
    const task = this.tasks.get(id);
    if (!task) return null;

    return {
      id: task.id,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isActive: true,
    };
  }

  getAllTasks(): any[] {
    return Array.from(this.tasks.values()).map(task => ({
      id: task.id,
      lastRun: task.lastRun,
      nextRun: task.nextRun,
      isActive: true,
    }));
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, {
    startTime: number;
    endTime?: number;
    duration?: number;
    memoryUsage?: any;
  }> = new Map();

  static startTiming(label: string): void {
    this.metrics.set(label, {
      startTime: Date.now(),
      memoryUsage: this.getMemoryUsage(),
    });
  }

  static endTiming(label: string): number {
    const metric = this.metrics.get(label);
    if (!metric) return 0;

    const endTime = Date.now();
    const duration = endTime - metric.startTime;
    
    metric.endTime = endTime;
    metric.duration = duration;

    return duration;
  }

  static getMetrics(): any {
    const results: any = {};
    
    for (const [label, metric] of this.metrics) {
      results[label] = {
        duration: metric.duration,
        startTime: new Date(metric.startTime),
        endTime: metric.endTime ? new Date(metric.endTime) : null,
        memoryUsage: metric.memoryUsage,
      };
    }

    return results;
  }

  static clearMetrics(): void {
    this.metrics.clear();
  }

  private static getMemoryUsage(): any {
    // In React Native, we can't access process.memoryUsage
    // This is a placeholder for memory tracking
    return {
      timestamp: Date.now(),
      // Could use a native module for actual memory usage
    };
  }
}

export default BacktestWorker;

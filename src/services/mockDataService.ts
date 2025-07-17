// Mock data service para desarrollo sin Firebase
export interface MockGem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  aiAnalysis: string;
  technicalIndicators: {
    rsi: number;
    macd: number;
    volume: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  source: 'binance' | 'coinbase' | 'kraken';
  timestamp: number;
}

export interface MockAnalysis {
  id: string;
  symbol: string;
  analysis: string;
  confidence: number;
  recommendations: string[];
  timestamp: number;
}

export interface MockStrategy {
  id: string;
  name: string;
  description: string;
  performance: {
    returns: number;
    winRate: number;
    sharpeRatio: number;
  };
  status: 'active' | 'inactive' | 'backtesting';
  lastUpdated: number;
}

class MockDataService {
  private mockGems: MockGem[] = [
    {
      id: '1',
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 45250.50,
      change: 1250.30,
      changePercent: 2.84,
      aiAnalysis: 'Strong bullish momentum with RSI approaching overbought levels. Consider partial profit-taking.',
      technicalIndicators: {
        rsi: 72.5,
        macd: 850.2,
        volume: 1250000,
        trend: 'bullish'
      },
      source: 'binance',
      timestamp: Date.now()
    },
    {
      id: '2',
      symbol: 'ETH',
      name: 'Ethereum',
      price: 3180.75,
      change: -85.25,
      changePercent: -2.61,
      aiAnalysis: 'Consolidation phase after recent gains. Watch for support at $3100 level.',
      technicalIndicators: {
        rsi: 45.8,
        macd: -12.5,
        volume: 890000,
        trend: 'neutral'
      },
      source: 'coinbase',
      timestamp: Date.now()
    },
    {
      id: '3',
      symbol: 'SOL',
      name: 'Solana',
      price: 98.45,
      change: 5.67,
      changePercent: 6.11,
      aiAnalysis: 'Breaking resistance levels with strong volume. Potential for further upside.',
      technicalIndicators: {
        rsi: 68.2,
        macd: 2.8,
        volume: 2100000,
        trend: 'bullish'
      },
      source: 'kraken',
      timestamp: Date.now()
    },
    {
      id: '4',
      symbol: 'ADA',
      name: 'Cardano',
      price: 0.485,
      change: -0.015,
      changePercent: -3.0,
      aiAnalysis: 'Oversold conditions present. Potential bounce from current levels.',
      technicalIndicators: {
        rsi: 28.5,
        macd: -0.008,
        volume: 1800000,
        trend: 'bearish'
      },
      source: 'binance',
      timestamp: Date.now()
    },
    {
      id: '5',
      symbol: 'AVAX',
      name: 'Avalanche',
      price: 34.20,
      change: 2.85,
      changePercent: 9.09,
      aiAnalysis: 'Strong breakout above key resistance. Momentum indicators bullish.',
      technicalIndicators: {
        rsi: 78.1,
        macd: 1.25,
        volume: 950000,
        trend: 'bullish'
      },
      source: 'coinbase',
      timestamp: Date.now()
    },
    {
      id: '6',
      symbol: 'DOT',
      name: 'Polkadot',
      price: 7.85,
      change: 0.12,
      changePercent: 1.55,
      aiAnalysis: 'Sideways movement continues. Wait for clear directional break.',
      technicalIndicators: {
        rsi: 52.3,
        macd: 0.05,
        volume: 720000,
        trend: 'neutral'
      },
      source: 'kraken',
      timestamp: Date.now()
    }
  ];

  private mockAnalyses: MockAnalysis[] = [
    {
      id: '1',
      symbol: 'BTC',
      analysis: 'Bitcoin shows strong bullish momentum with key resistance at $46,000. RSI approaching overbought but momentum remains strong.',
      confidence: 85,
      recommendations: ['Hold current positions', 'Consider partial profit at $46K', 'Watch for pullback to $44K'],
      timestamp: Date.now()
    },
    {
      id: '2',
      symbol: 'ETH',
      analysis: 'Ethereum consolidating after recent gains. Support at $3100 critical for maintaining uptrend.',
      confidence: 72,
      recommendations: ['Monitor $3100 support', 'Accumulate on weakness', 'Target $3400 on breakout'],
      timestamp: Date.now()
    },
    {
      id: '3',
      symbol: 'SOL',
      analysis: 'Solana breaking key resistance with strong volume. Momentum indicators extremely bullish.',
      confidence: 91,
      recommendations: ['Strong buy signal', 'Target $110-115', 'Stop loss at $90'],
      timestamp: Date.now()
    }
  ];

  private mockStrategies: MockStrategy[] = [
    {
      id: '1',
      name: 'BTC Mean Reversion',
      description: 'Buy oversold conditions, sell overbought levels on Bitcoin',
      performance: {
        returns: 24.5,
        winRate: 68.2,
        sharpeRatio: 1.45
      },
      status: 'active',
      lastUpdated: Date.now()
    },
    {
      id: '2',
      name: 'Altcoin Momentum',
      description: 'Momentum-based strategy for high-cap altcoins',
      performance: {
        returns: 45.8,
        winRate: 72.1,
        sharpeRatio: 1.82
      },
      status: 'active',
      lastUpdated: Date.now()
    },
    {
      id: '3',
      name: 'DeFi Arbitrage',
      description: 'Cross-platform arbitrage opportunities in DeFi protocols',
      performance: {
        returns: 18.2,
        winRate: 81.5,
        sharpeRatio: 2.15
      },
      status: 'backtesting',
      lastUpdated: Date.now()
    }
  ];

  // Simulate async operations
  async getGems(): Promise<MockGem[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockGems);
      }, 800); // Simulate network delay
    });
  }

  async getAnalyses(): Promise<MockAnalysis[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockAnalyses);
      }, 600);
    });
  }

  async getStrategies(): Promise<MockStrategy[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(this.mockStrategies);
      }, 500);
    });
  }

  async searchGems(query: string): Promise<MockGem[]> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const filtered = this.mockGems.filter(gem => 
          gem.symbol.toLowerCase().includes(query.toLowerCase()) ||
          gem.name.toLowerCase().includes(query.toLowerCase())
        );
        resolve(filtered);
      }, 300);
    });
  }

  // Simulate real-time updates
  subscribeToGemUpdates(callback: (gems: MockGem[]) => void): () => void {
    const interval = setInterval(() => {
      // Simulate price updates
      this.mockGems = this.mockGems.map(gem => ({
        ...gem,
        price: gem.price + (Math.random() - 0.5) * gem.price * 0.01, // ±1% random change
        change: (Math.random() - 0.5) * gem.price * 0.02, // ±2% random change
        changePercent: (Math.random() - 0.5) * 4, // ±4% random change
        timestamp: Date.now()
      }));
      
      callback(this.mockGems);
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }
}

export const mockDataService = new MockDataService();

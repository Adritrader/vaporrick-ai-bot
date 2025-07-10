// Mock data service for testing without API dependencies
import { Asset } from '../context/TradingContext';

export interface HistoricalDataPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// Generate realistic mock data
const generateMockPrice = (basePrice: number, volatility: number = 0.02) => {
  const change = (Math.random() - 0.5) * 2 * volatility;
  return basePrice * (1 + change);
};

const generateMockHistoricalData = (symbol: string, days: number = 30): HistoricalDataPoint[] => {
  const data: HistoricalDataPoint[] = [];
  const basePrices: { [key: string]: number } = {
    'AAPL': 150,
    'NVDA': 400,
    'META': 300,
    'NFLX': 400,
    'BTC': 45000,
    'ETH': 3000,
    'BNB': 300,
    'SOL': 100,
    'ADA': 0.5,
    'DOT': 25,
  };

  let basePrice = basePrices[symbol] || 100;
  const now = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const open = basePrice;
    const volatility = symbol.includes('BTC') || symbol.includes('ETH') ? 0.05 : 0.03;
    const high = generateMockPrice(open, volatility);
    const low = generateMockPrice(open, volatility);
    const close = generateMockPrice((high + low) / 2, volatility * 0.5);
    const volume = Math.floor(Math.random() * 1000000) + 100000;

    data.push({
      date: date.toISOString().split('T')[0],
      open,
      high: Math.max(open, high, low, close),
      low: Math.min(open, high, low, close),
      close,
      volume,
    });

    basePrice = close; // Use close as next day's base
  }

  return data;
};

const getMockCurrentData = (symbol: string): Asset => {
  const historicalData = generateMockHistoricalData(symbol, 1);
  const latest = historicalData[historicalData.length - 1];
  const previous = generateMockPrice(latest.close, 0.01);
  
  const change = latest.close - previous;
  const changePercent = (change / previous) * 100;

  const assetTypes: { [key: string]: 'stock' | 'crypto' } = {
    'AAPL': 'stock',
    'NVDA': 'stock',
    'META': 'stock',
    'NFLX': 'stock',
    'BTC': 'crypto',
    'ETH': 'crypto',
    'BNB': 'crypto',
    'SOL': 'crypto',
    'ADA': 'crypto',
    'DOT': 'crypto',
  };

  return {
    symbol,
    name: symbol === 'BTC' ? 'Bitcoin' : symbol === 'ETH' ? 'Ethereum' : symbol,
    price: latest.close,
    change,
    changePercent,
    type: assetTypes[symbol] || 'stock',
    lastUpdate: new Date(),
  };
};

// Mock data for popular assets
const MOCK_ASSETS = [
  'AAPL', 'NVDA', 'META', 'NFLX', 'TSLA', 'GOOGL', 'AMZN', 'MSFT',
  'BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI'
];

export const fetchMockAssetData = async (symbol: string): Promise<Asset> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200));
  
  return getMockCurrentData(symbol);
};

export const fetchMockMultipleAssets = async (symbols: string[]): Promise<Asset[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 1000 + 500));
  
  return symbols.map(symbol => getMockCurrentData(symbol));
};

export const fetchMockHistoricalData = async (symbol: string, days: number = 30): Promise<HistoricalDataPoint[]> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 300));
  
  return generateMockHistoricalData(symbol, days);
};

export const getMockPopularAssets = (): string[] => {
  return [...MOCK_ASSETS];
};

// Market trending data
export const getMockTrendingAssets = async (): Promise<Asset[]> => {
  const trending = ['BTC', 'ETH', 'NVDA', 'TSLA', 'AAPL', 'SOL'];
  return fetchMockMultipleAssets(trending);
};

// Market movers (gainers/losers)
export const getMockMarketMovers = async (): Promise<{gainers: Asset[], losers: Asset[]}> => {
  const allAssets = await fetchMockMultipleAssets(MOCK_ASSETS);
  
  const sorted = allAssets.sort((a, b) => b.changePercent - a.changePercent);
  
  return {
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
  };
};

// Sector performance
export const getMockSectorPerformance = async () => {
  return [
    { sector: 'Technology', change: 2.1, trending: 'up' },
    { sector: 'Healthcare', change: -0.8, trending: 'down' },
    { sector: 'Finance', change: 1.5, trending: 'up' },
    { sector: 'Energy', change: -1.2, trending: 'down' },
    { sector: 'Crypto', change: 5.3, trending: 'up' },
  ];
};

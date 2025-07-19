import CoinPaprikaService from './coinPaprikaService';
import { API_CONFIG } from '../config/apiConfig';

// Enhanced Crypto Service with CoinPaprika as primary and CoinGecko as fallback
export class EnhancedCryptoService {
  private static coinGeckoLastRequest = 0;
  private static coinPaprikaLastRequest = 0;

  // Hierarchical data fetching: CoinPaprika -> CoinGecko -> Fallback
  static async getCryptoPrice(symbol: string): Promise<{
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    dataSource: string;
    timestamp: number;
  } | null> {
    
    console.log(`🔄 EnhancedCrypto: Fetching ${symbol} price with improved rate limiting`);

    // 1. Try CoinPaprika first (better rate limits: 833/day vs CoinGecko's 100-1000/day)
    try {
      const paprikaData = await CoinPaprikaService.getCryptoPrice(symbol);
      if (paprikaData && paprikaData.price > 0) {
        console.log(`✅ EnhancedCrypto: ${symbol} price from CoinPaprika: $${paprikaData.price}`);
        return {
          ...paprikaData,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn(`⚠️ EnhancedCrypto: CoinPaprika failed for ${symbol}:`, error);
    }

    // 2. Fallback to CoinGecko with improved rate limiting
    try {
      await this.respectCoinGeckoRateLimit();
      
      const coinGeckoData = await this.fetchFromCoinGecko(symbol);
      if (coinGeckoData && coinGeckoData.price > 0) {
        console.log(`✅ EnhancedCrypto: ${symbol} price from CoinGecko: $${coinGeckoData.price}`);
        return {
          ...coinGeckoData,
          timestamp: Date.now()
        };
      }
    } catch (error) {
      console.warn(`⚠️ EnhancedCrypto: CoinGecko failed for ${symbol}:`, error);
    }

    // 3. If both APIs fail, return null instead of fallback data
    console.error(`❌ EnhancedCrypto: All APIs failed for ${symbol}, no real data available`);
    return null;
  }

  // Improved rate limiting for CoinGecko (30 seconds between requests)
  private static async respectCoinGeckoRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.coinGeckoLastRequest;
    const minInterval = API_CONFIG.COINGECKO.RATE_LIMIT;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      console.log(`⏳ EnhancedCrypto: Waiting ${waitTime}ms for CoinGecko rate limit`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.coinGeckoLastRequest = Date.now();
  }

  // CoinGecko fetcher with improved error handling
  private static async fetchFromCoinGecko(symbol: string): Promise<{
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    dataSource: string;
  } | null> {
    
    const symbolToId: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum', 
      'ADA': 'cardano',
      'SOL': 'solana',
      'LINK': 'chainlink',
      'DOT': 'polkadot',
      'BNB': 'binancecoin',
      'MATIC': 'matic-network',
      'UNI': 'uniswap',
      'LTC': 'litecoin',
      'XRP': 'ripple'
    };

    const coinId = symbolToId[symbol.toUpperCase()];
    if (!coinId) {
      console.warn(`⚠️ EnhancedCrypto: No CoinGecko ID for ${symbol}`);
      return null;
    }

    try {
      const response = await fetch(
        `${API_CONFIG.COINGECKO.BASE_URL}/simple/price?ids=${coinId}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'VaporRick-AI-Bot/1.0'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`CoinGecko HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const coinData = data[coinId];

      if (!coinData) {
        console.warn(`⚠️ EnhancedCrypto: No CoinGecko data for ${symbol}`);
        return null;
      }

      return {
        price: coinData.usd || 0,
        change24h: coinData.usd_24h_change || 0,
        volume24h: coinData.usd_24h_vol || 0,
        marketCap: coinData.usd_market_cap || 0,
        dataSource: 'CoinGecko (Enhanced)'
      };

    } catch (error) {
      console.error(`❌ EnhancedCrypto: CoinGecko error for ${symbol}:`, error);
      return null;
    }
  }

  // Get multiple crypto prices efficiently
  static async getMultipleCryptoPrices(symbols: string[]): Promise<{
    [symbol: string]: {
      price: number;
      change24h: number;
      volume24h: number;
      marketCap: number;
      dataSource: string;
      timestamp: number;
    }
  }> {
    
    console.log(`🔄 EnhancedCrypto: Fetching multiple prices for ${symbols.length} cryptos`);
    
    // Try CoinPaprika first for bulk request
    try {
      const paprikaData = await CoinPaprikaService.getMultipleCryptoPrices(symbols);
      if (Object.keys(paprikaData).length > 0) {
        console.log(`✅ EnhancedCrypto: Got ${Object.keys(paprikaData).length} prices from CoinPaprika`);
        
        const result: any = {};
        Object.entries(paprikaData).forEach(([symbol, data]) => {
          result[symbol] = {
            ...data,
            timestamp: Date.now()
          };
        });
        
        return result;
      }
    } catch (error) {
      console.warn('⚠️ EnhancedCrypto: CoinPaprika bulk request failed:', error);
    }

    // Fallback to individual requests with rate limiting
    const results: any = {};
    
    for (const symbol of symbols) {
      try {
        const data = await this.getCryptoPrice(symbol);
        if (data) {
          results[symbol] = data;
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.warn(`⚠️ EnhancedCrypto: Failed to get price for ${symbol}:`, error);
      }
    }

    return results;
  }

  // Get market overview from best available source
  static async getMarketOverview(): Promise<{
    totalMarketCap: number;
    total24hVolume: number;
    bitcoinDominance: number;
    activeCryptocurrencies: number;
    dataSource: string;
  } | null> {
    
    // Try CoinPaprika first
    try {
      const paprikaOverview = await CoinPaprikaService.getMarketOverview();
      if (paprikaOverview) {
        console.log('✅ EnhancedCrypto: Market overview from CoinPaprika');
        return paprikaOverview;
      }
    } catch (error) {
      console.warn('⚠️ EnhancedCrypto: CoinPaprika market overview failed:', error);
    }

    // Fallback to CoinGecko
    try {
      await this.respectCoinGeckoRateLimit();
      
      const response = await fetch(`${API_CONFIG.COINGECKO.BASE_URL}/global`);
      const data = await response.json();
      
      if (data.data) {
        console.log('✅ EnhancedCrypto: Market overview from CoinGecko');
        return {
          totalMarketCap: data.data.total_market_cap.usd || 0,
          total24hVolume: data.data.total_volume.usd || 0,
          bitcoinDominance: data.data.market_cap_percentage.btc || 0,
          activeCryptocurrencies: data.data.active_cryptocurrencies || 0,
          dataSource: 'CoinGecko (Enhanced)'
        };
      }
    } catch (error) {
      console.warn('⚠️ EnhancedCrypto: CoinGecko market overview failed:', error);
    }

    return null;
  }
}

export default EnhancedCryptoService;

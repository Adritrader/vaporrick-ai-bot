import axios from 'axios';

// CoinPaprika API Service - Alternative to CoinGecko with better rate limits
// Free plan: 25,000 calls/month (~833 calls/day) vs CoinGecko's 100-1000/day
export class CoinPaprikaService {
  private static readonly BASE_URL = 'https://api.coinpaprika.com/v1';
  private static readonly TIMEOUT = 10000;

  // Rate limiting: Max 10 requests per second for free tier
  private static lastRequestTime = 0;
  private static readonly MIN_REQUEST_INTERVAL = 100; // 100ms between requests

  private static async makeRequest(endpoint: string): Promise<any> {
    // Implement rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      await new Promise(resolve => 
        setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
      );
    }
    
    this.lastRequestTime = Date.now();

    try {
      const response = await axios.get(`${this.BASE_URL}${endpoint}`, {
        timeout: this.TIMEOUT,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'VaporRick-AI-Bot/1.0'
        }
      });
      
      return response.data;
    } catch (error) {
      console.error('CoinPaprika API Error:', error);
      throw new Error(`CoinPaprika API request failed: ${error}`);
    }
  }

  // Get current price for a cryptocurrency
  static async getCryptoPrice(coinId: string): Promise<{
    price: number;
    change24h: number;
    volume24h: number;
    marketCap: number;
    dataSource: string;
  } | null> {
    try {
      console.log(`📊 CoinPaprika: Fetching price for ${coinId}`);
      
      // Map common symbols to CoinPaprika IDs
      const symbolToId: { [key: string]: string } = {
        'BTC': 'btc-bitcoin',
        'ETH': 'eth-ethereum',
        'ADA': 'ada-cardano',
        'SOL': 'sol-solana',
        'AVAX': 'avax-avalanche',
        'LINK': 'link-chainlink',
        'DOT': 'dot-polkadot',
        'BNB': 'bnb-binance-coin',
        'MATIC': 'matic-polygon',
        'UNI': 'uni-uniswap',
        'LTC': 'ltc-litecoin',
        'XRP': 'xrp-xrp'
      };

      const paprikaId = symbolToId[coinId.toUpperCase()] || `${coinId.toLowerCase()}-${coinId.toLowerCase()}`;
      const data = await this.makeRequest(`/tickers/${paprikaId}`);

      if (!data || !data.quotes?.USD) {
        console.warn(`⚠️ CoinPaprika: No price data for ${coinId}`);
        return null;
      }

      const quote = data.quotes.USD;
      
      return {
        price: quote.price || 0,
        change24h: quote.percent_change_24h || 0,
        volume24h: quote.volume_24h || 0,
        marketCap: quote.market_cap || 0,
        dataSource: 'CoinPaprika'
      };

    } catch (error) {
      console.error(`❌ CoinPaprika: Error fetching ${coinId}:`, error);
      return null;
    }
  }

  // Get multiple cryptocurrency prices in one request
  static async getMultipleCryptoPrices(coinIds: string[]): Promise<{
    [key: string]: {
      price: number;
      change24h: number;
      volume24h: number;
      marketCap: number;
      dataSource: string;
    }
  }> {
    try {
      console.log(`📊 CoinPaprika: Fetching multiple prices for ${coinIds.length} coins`);
      
      const data = await this.makeRequest('/tickers');
      const result: any = {};

      const symbolToId: { [key: string]: string } = {
        'BTC': 'btc-bitcoin',
        'ETH': 'eth-ethereum',
        'ADA': 'ada-cardano',
        'SOL': 'sol-solana',
        'AVAX': 'avax-avalanche',
        'LINK': 'link-chainlink',
        'DOT': 'dot-polkadot',
        'BNB': 'bnb-binance-coin'
      };

      // Filter data for requested coins
      data.forEach((ticker: any) => {
        const symbol = ticker.symbol?.toUpperCase();
        if (coinIds.includes(symbol) && ticker.quotes?.USD) {
          const quote = ticker.quotes.USD;
          result[symbol] = {
            price: quote.price || 0,
            change24h: quote.percent_change_24h || 0,
            volume24h: quote.volume_24h || 0,
            marketCap: quote.market_cap || 0,
            dataSource: 'CoinPaprika'
          };
        }
      });

      console.log(`✅ CoinPaprika: Successfully fetched ${Object.keys(result).length} prices`);
      return result;

    } catch (error) {
      console.error('❌ CoinPaprika: Error fetching multiple prices:', error);
      return {};
    }
  }

  // Get historical data for technical analysis
  static async getHistoricalData(coinId: string, days: number = 30): Promise<{
    prices: Array<[number, number]>;
    volumes: Array<[number, number]>;
    dataSource: string;
  } | null> {
    try {
      console.log(`📊 CoinPaprika: Fetching ${days}d historical data for ${coinId}`);
      
      const symbolToId: { [key: string]: string } = {
        'BTC': 'btc-bitcoin',
        'ETH': 'eth-ethereum',
        'ADA': 'ada-cardano',
        'SOL': 'sol-solana',
        'AVAX': 'avax-avalanche',
        'LINK': 'link-chainlink',
        'DOT': 'dot-polkadot',
        'BNB': 'bnb-binance-coin'
      };

      const paprikaId = symbolToId[coinId.toUpperCase()] || `${coinId.toLowerCase()}-${coinId.toLowerCase()}`;
      
      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const start = startDate.toISOString().split('T')[0];
      const end = endDate.toISOString().split('T')[0];
      
      const data = await this.makeRequest(`/tickers/${paprikaId}/historical?start=${start}&end=${end}&interval=1d`);

      if (!data || !Array.isArray(data)) {
        console.warn(`⚠️ CoinPaprika: No historical data for ${coinId}`);
        return null;
      }

      const prices: Array<[number, number]> = [];
      const volumes: Array<[number, number]> = [];

      data.forEach((item: any) => {
        if (item.timestamp && item.price !== undefined) {
          const timestamp = new Date(item.timestamp).getTime();
          prices.push([timestamp, item.price]);
          volumes.push([timestamp, item.volume_24h || 0]);
        }
      });

      return {
        prices,
        volumes,
        dataSource: 'CoinPaprika'
      };

    } catch (error) {
      console.error(`❌ CoinPaprika: Error fetching historical data for ${coinId}:`, error);
      return null;
    }
  }

  // Get market overview
  static async getMarketOverview(): Promise<{
    totalMarketCap: number;
    total24hVolume: number;
    bitcoinDominance: number;
    activeCryptocurrencies: number;
    dataSource: string;
  } | null> {
    try {
      console.log('📊 CoinPaprika: Fetching market overview');
      
      const data = await this.makeRequest('/global');

      if (!data) {
        console.warn('⚠️ CoinPaprika: No market overview data');
        return null;
      }

      return {
        totalMarketCap: data.market_cap_usd || 0,
        total24hVolume: data.volume_24h_usd || 0,
        bitcoinDominance: data.bitcoin_dominance_percentage || 0,
        activeCryptocurrencies: data.cryptocurrencies_number || 0,
        dataSource: 'CoinPaprika'
      };

    } catch (error) {
      console.error('❌ CoinPaprika: Error fetching market overview:', error);
      return null;
    }
  }

  // Search for coins (useful for symbol resolution)
  static async searchCoins(query: string): Promise<Array<{
    id: string;
    name: string;
    symbol: string;
    rank: number;
    isActive: boolean;
  }>> {
    try {
      console.log(`🔍 CoinPaprika: Searching for "${query}"`);
      
      const data = await this.makeRequest('/search?q=' + encodeURIComponent(query));

      if (!data?.currencies || !Array.isArray(data.currencies)) {
        return [];
      }

      return data.currencies
        .filter((coin: any) => coin.symbol && coin.name)
        .slice(0, 10) // Limit to top 10 results
        .map((coin: any) => ({
          id: coin.id,
          name: coin.name,
          symbol: coin.symbol.toUpperCase(),
          rank: coin.rank || 999999,
          isActive: coin.is_active !== false
        }))
        .sort((a: any, b: any) => a.rank - b.rank);

    } catch (error) {
      console.error(`❌ CoinPaprika: Error searching for "${query}":`, error);
      return [];
    }
  }

  // Get top cryptocurrencies by market cap
  static async getTopCryptocurrencies(limit: number = 100): Promise<Array<{
    id: string;
    symbol: string;
    name: string;
    rank: number;
    price: number;
    change24h: number;
    marketCap: number;
    volume24h: number;
  }>> {
    try {
      console.log(`📊 CoinPaprika: Fetching top ${limit} cryptocurrencies`);
      
      const data = await this.makeRequest(`/tickers?limit=${limit}`);

      if (!data || !Array.isArray(data)) {
        return [];
      }

      return data
        .filter((ticker: any) => ticker.quotes?.USD && ticker.rank <= limit)
        .map((ticker: any) => {
          const quote = ticker.quotes.USD;
          return {
            id: ticker.id,
            symbol: ticker.symbol.toUpperCase(),
            name: ticker.name,
            rank: ticker.rank,
            price: quote.price || 0,
            change24h: quote.percent_change_24h || 0,
            marketCap: quote.market_cap || 0,
            volume24h: quote.volume_24h || 0
          };
        })
        .sort((a: any, b: any) => a.rank - b.rank);

    } catch (error) {
      console.error(`❌ CoinPaprika: Error fetching top cryptocurrencies:`, error);
      return [];
    }
  }
}

export default CoinPaprikaService;

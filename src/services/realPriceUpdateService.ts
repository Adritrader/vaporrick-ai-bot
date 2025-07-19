import { realDataService } from './realDataService';

interface PriceUpdate {
  symbol: string;
  currentPrice: number;
  change24h: number;
  changePercent: number;
  volume24h: number;
  marketCap?: number;
  lastUpdated: number;
}

// Real-time price update service using CoinGecko and CoinPaprika
class RealPriceUpdateService {
  private readonly CACHE_DURATION = 60000; // 1 minute cache
  private priceCache = new Map<string, PriceUpdate>();
  private lastUpdate = 0;

  /**
   * Get real-time price updates for a list of symbols
   */
  async getMultiplePriceUpdates(symbols: string[]): Promise<Map<string, PriceUpdate>> {
    const updates = new Map<string, PriceUpdate>();

    for (const symbol of symbols) {
      try {
        const update = await this.getSinglePriceUpdate(symbol);
        if (update) {
          updates.set(symbol, update);
        }
      } catch (error) {
        console.warn(`❌ Failed to get price update for ${symbol}:`, error);
      }
    }

    return updates;
  }

  /**
   * Get real-time price update for a single symbol
   */
  async getSinglePriceUpdate(symbol: string): Promise<PriceUpdate | null> {
    // Check cache first
    const cached = this.priceCache.get(symbol);
    if (cached && (Date.now() - cached.lastUpdated) < this.CACHE_DURATION) {
      return cached;
    }

    try {
      // Get fresh data from real data service
      const marketData = await realDataService.getMarketData(symbol);
      
      if (!marketData || marketData.price <= 0) {
        console.warn(`⚠️ Invalid market data for ${symbol}`);
        return null;
      }

      const update: PriceUpdate = {
        symbol: marketData.symbol,
        currentPrice: marketData.price,
        change24h: marketData.change || 0,
        changePercent: marketData.changePercent || 0,
        volume24h: marketData.volume || 0,
        marketCap: marketData.marketCap,
        lastUpdated: Date.now()
      };

      // Cache the update
      this.priceCache.set(symbol, update);
      
      console.log(`📈 Price update for ${symbol}: $${update.currentPrice} (${update.changePercent >= 0 ? '+' : ''}${update.changePercent.toFixed(2)}%)`);
      
      return update;

    } catch (error) {
      console.error(`❌ Error getting price update for ${symbol}:`, error);
      return null;
    }
  }

  /**
   * Update prices for crypto symbols using CoinGecko ID mapping
   */
  async updateCryptoPrices(symbols: string[]): Promise<Map<string, PriceUpdate>> {
    const updates = new Map<string, PriceUpdate>();
    
    // Map symbols to CoinGecko IDs
    const symbolMap: { [key: string]: string } = {
      'BTC': 'bitcoin',
      'ETH': 'ethereum',
      'ADA': 'cardano',
      'SOL': 'solana',
      'DOT': 'polkadot',
      'LINK': 'chainlink',
      'AVAX': 'avalanche',
      'UNI': 'uniswap',
      'MATIC': 'polygon',
      'INJ': 'injective-protocol'
    };

    // Use CoinGecko API for batch updates
    try {
      const coinGeckoIds = symbols
        .map(symbol => symbolMap[symbol.toUpperCase()] || symbol.toLowerCase())
        .filter(id => id);

      if (coinGeckoIds.length === 0) return updates;

      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinGeckoIds.join(',')}&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Process results
      for (const [coinId, priceData] of Object.entries(data)) {
        if (typeof priceData === 'object' && priceData !== null) {
          const coinPriceData = priceData as any;
          
          // Find the original symbol
          const originalSymbol = Object.entries(symbolMap)
            .find(([_, id]) => id === coinId)?.[0] || coinId.toUpperCase();

          const update: PriceUpdate = {
            symbol: originalSymbol,
            currentPrice: coinPriceData.usd || 0,
            change24h: (coinPriceData.usd || 0) * (coinPriceData.usd_24h_change || 0) / 100,
            changePercent: coinPriceData.usd_24h_change || 0,
            volume24h: coinPriceData.usd_24h_vol || 0,
            marketCap: coinPriceData.usd_market_cap,
            lastUpdated: Date.now()
          };

          updates.set(originalSymbol, update);
          this.priceCache.set(originalSymbol, update);
        }
      }

      console.log(`📊 Updated ${updates.size} crypto prices from CoinGecko`);

    } catch (error) {
      console.error('❌ Error updating crypto prices:', error);
      
      // Fallback to individual requests
      for (const symbol of symbols) {
        const update = await this.getSinglePriceUpdate(symbol);
        if (update) {
          updates.set(symbol, update);
        }
      }
    }

    return updates;
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    this.lastUpdate = 0;
    console.log('🗑️ Price cache cleared');
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    cachedSymbols: number;
    lastGlobalUpdate: number;
    cacheSize: number;
  } {
    return {
      cachedSymbols: this.priceCache.size,
      lastGlobalUpdate: this.lastUpdate,
      cacheSize: this.priceCache.size
    };
  }
}

export const realPriceUpdateService = new RealPriceUpdateService();
export type { PriceUpdate };

// Test script for Twelve Data integration
// Run this to verify Twelve Data API is working correctly

import { realMarketDataService } from '../services/realMarketDataService';
import { API_CONFIG } from '../config/apiConfig';

export const testTwelveDataIntegration = async () => {
  console.log('🧪 Testing Twelve Data API Integration...');
  
  // Test if API key is configured
  if (API_CONFIG.TWELVE_DATA.API_KEY === 'demo') {
    console.log('⚠️ Twelve Data API key not configured. Using demo mode.');
    console.log('📖 To configure: Add TWELVE_DATA_API_KEY to your .env file');
    console.log('🔗 Get free API key at: https://twelvedata.com/pricing');
    return;
  }
  
  console.log('✅ Twelve Data API key configured');
  console.log(`📊 Free tier limit: ${API_CONFIG.TWELVE_DATA.FREE_TIER_LIMIT} requests/day`);
  
  // Test stock symbols
  const testSymbols = ['AAPL', 'GOOGL', 'TSLA', 'MSFT', 'NVDA'];
  
  for (const symbol of testSymbols) {
    try {
      console.log(`\n📈 Testing ${symbol}...`);
      
      // Test current price
      const currentPrice = await realMarketDataService.getCurrentPrice(symbol);
      console.log(`💰 Current price: $${currentPrice.toFixed(2)}`);
      
      // Test historical data
      const historicalData = await realMarketDataService.fetchRealMarketData(symbol, '1d');
      console.log(`📊 Historical data points: ${historicalData.length}`);
      
      if (historicalData.length > 0) {
        const latest = historicalData[historicalData.length - 1];
        console.log(`📅 Latest data: ${new Date(latest.timestamp).toLocaleDateString()}`);
        console.log(`💹 OHLC: O:${latest.open} H:${latest.high} L:${latest.low} C:${latest.close}`);
      }
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (error) {
      console.error(`❌ Error testing ${symbol}:`, error);
    }
  }
  
  console.log('\n🎯 Twelve Data integration test completed!');
  console.log('💡 If you see real data above, Twelve Data is working correctly');
  console.log('📱 Check AlertScreen for live data from Twelve Data API');
};

// Usage instructions
export const getTwelveDataUsageInfo = () => {
  return {
    freeLimit: API_CONFIG.TWELVE_DATA.FREE_TIER_LIMIT,
    rateLimit: API_CONFIG.TWELVE_DATA.RATE_LIMIT / 1000 + ' seconds between requests',
    features: API_CONFIG.TWELVE_DATA.FEATURES,
    documentation: 'https://twelvedata.com/docs',
    pricing: 'https://twelvedata.com/pricing',
    supportedSymbols: [
      'US Stocks: AAPL, GOOGL, TSLA, MSFT, NVDA, META, AMZN, etc.',
      'Indices: SPY, QQQ, DIA, etc.',
      'ETFs: VTI, VOO, ARKK, etc.',
      'And many more...'
    ]
  };
};

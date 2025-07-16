import { API_CONFIG, checkAPIConfiguration } from '../config/apiConfig';
import { integratedDataService } from './integratedDataService';

// Test script to verify API configuration and data sources
export const testAPIConfiguration = async () => {
  console.log('\n🧪 Testing API Configuration...\n');
  
  const config = checkAPIConfiguration();
  
  // Display configuration status
  console.log('📊 Configuration Status:');
  console.log(`✅ Crypto APIs: ${config.canUseCrypto ? 'Available' : 'Not Available'}`);
  console.log(`📈 Stock APIs: ${config.canUseStocks ? 'Available' : 'Not Available'}`);
  console.log(`🔧 Fully Configured: ${config.isFullyConfigured ? 'Yes' : 'No'}`);
  
  if (config.unconfiguredAPIs.length > 0) {
    console.log('\n⚠️ Missing API Configurations:');
    config.unconfiguredAPIs.forEach(api => console.log(`   - ${api}`));
  }
  
  // Test actual data retrieval
  console.log('\n🧪 Testing Data Retrieval...\n');
  
  const testAssets = [
    { symbol: 'BTC', type: 'crypto' },
    { symbol: 'ETH', type: 'crypto' },
    { symbol: 'AAPL', type: 'stock' },
    { symbol: 'GOOGL', type: 'stock' }
  ];
  
  for (const asset of testAssets) {
    try {
      console.log(`📡 Testing ${asset.symbol} (${asset.type})...`);
      const dataArray = await integratedDataService.getMarketData([asset.symbol]);
      const data = dataArray[0]; // Get first item from array
      
      if (!data) {
        console.log(`   ❌ No data received for ${asset.symbol}`);
        continue;
      }
      
      const sourceEmoji = data.source === 'api' ? '✅' : 
                         data.source === 'firebase' ? '📦' : '📝';
      
      console.log(`   ${sourceEmoji} Source: ${data.source || 'unknown'}`);
      console.log(`   💰 Price: $${data.price?.toFixed(2) || 'N/A'}`);
      console.log(`   📈 Change: ${data.changePercent?.toFixed(2) || 'N/A'}%`);
      console.log(`   ⏰ Last Updated: ${new Date(data.lastUpdated).toLocaleTimeString()}`);
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }
  
  // Provide recommendations
  console.log('💡 Recommendations:');
  
  if (!config.canUseStocks) {
    console.log('   🔑 Get a free Alpha Vantage API key for real stock data');
    console.log('      👉 https://www.alphavantage.co/support/#api-key');
  }
  
  if (!config.isFullyConfigured) {
    console.log('   ⚠️ Configure more APIs to prevent data failures and use fallback data');
  }
  
  console.log('\n📚 Full setup guide: See API_SETUP_GUIDE.md\n');
  
  return {
    configuration: config,
    testResults: testAssets.map(asset => ({
      symbol: asset.symbol,
      type: asset.type,
      tested: true
    }))
  };
};

// Quick helper to get current data source status
export const getDataSourceStatus = () => {
  const config = checkAPIConfiguration();
  
  return {
    crypto: {
      available: config.canUseCrypto,
      provider: 'CoinGecko',
      status: 'Free (50 req/min)'
    },
    stocks: {
      available: config.canUseStocks,
      providers: config.unconfiguredAPIs.length === 3 ? 'None configured' : 
                'Alpha Vantage, Twelve Data, or FMP',
      status: config.canUseStocks ? 'Configured' : 'Needs API key'
    },
    overallStatus: config.isFullyConfigured ? 'Production Ready' : 'Needs Configuration'
  };
};

// Auto-test on import (in development)
if (__DEV__) {
  // Test configuration on app startup
  setTimeout(() => {
    console.log('\n🔍 Auto-testing API configuration in development mode...');
    testAPIConfiguration().catch(console.error);
  }, 2000);
}

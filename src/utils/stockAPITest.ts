// Simple Stock API Test Utility

import { apiKeyManager } from '../services/apiKeyRotationManager';

export const simpleStockAPITest = async () => {
  console.log('🔬 Running simple Alpha Vantage API test...');
  
  try {
    // Get current API key
    const currentKey = apiKeyManager.rotateToNextKey();
    console.log(`🔑 Testing with current API key...`);
    
    // Test with a simple stock symbol
    const testSymbol = 'AAPL';
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${testSymbol}&apikey=${currentKey}`;
    
    console.log(`🌐 Making request to: ${url.replace(currentKey, 'HIDDEN_KEY')}`);
    
    const response = await fetch(url);
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} - ${response.statusText}`);
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
        details: 'Network or HTTP error'
      };
    }
    
    const data = await response.json();
    console.log('📦 Response data:', JSON.stringify(data, null, 2));
    
    // Check for Alpha Vantage specific responses
    if (data['Error Message']) {
      console.log(`❌ API Error: ${data['Error Message']}`);
      return {
        success: false,
        error: data['Error Message'],
        details: 'Alpha Vantage API error'
      };
    }
    
    if (data['Note']) {
      console.log(`⚠️ API Note: ${data['Note']}`);
      return {
        success: false,
        error: data['Note'],
        details: 'API rate limit or other note'
      };
    }
    
    if (data['Global Quote'] && data['Global Quote']['05. price']) {
      const price = data['Global Quote']['05. price'];
      console.log(`✅ Success! ${testSymbol} price: $${price}`);
      return {
        success: true,
        price: parseFloat(price),
        symbol: testSymbol,
        details: 'Successfully retrieved stock data'
      };
    }
    
    console.log('❌ Unexpected response format - no price data found');
    return {
      success: false,
      error: 'Unexpected response format',
      details: 'No recognizable price data in response'
    };
    
  } catch (error) {
    console.error('❌ Test failed with exception:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Network or request exception'
    };
  }
};

export const testAllAPIKeys = async () => {
  console.log('🔬 Testing all available API keys...');
  
  const keyStats = apiKeyManager.getUsageStatistics();
  console.log(`📊 Total keys available: ${keyStats.totalKeys}`);
  
  const results = [];
  
  for (let i = 0; i < keyStats.totalKeys; i++) {
    console.log(`\n🔑 Testing key ${i + 1}/${keyStats.totalKeys}...`);
    
    const result = await simpleStockAPITest();
    results.push({
      keyIndex: i + 1,
      ...result
    });
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  
  console.log('\n📋 TEST SUMMARY:');
  console.log(`✅ Successful: ${successCount}/${keyStats.totalKeys}`);
  console.log(`❌ Failed: ${failureCount}/${keyStats.totalKeys}`);
  
  if (failureCount > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => !r.success).forEach(result => {
      console.log(`   Key ${result.keyIndex}: ${result.error}`);
    });
  }
  
  return {
    totalTests: keyStats.totalKeys,
    successful: successCount,
    failed: failureCount,
    results
  };
};

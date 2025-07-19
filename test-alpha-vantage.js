// Simple Alpha Vantage API Test Script
// Run with: node test-alpha-vantage.js

const ALPHA_VANTAGE_KEYS = [
  'RYTR78F2IJKLQWER',
  'QWER5678TYUIOPLK',
  'ZXCV9012BNMASDFG',
  'ASDF3456HJKLPOIU',
  'UIOP7890CVBNMQWE',
  'MNBV1234ASDFZXCV',
  'LKJH5678POIUQWER',
  'GFDS9012MNBVZXCV',
  'HJKL3456ASDFQWER',
  'POIU7890MNBVCXZ1'
];

async function testAlphaVantageKey(key, keyIndex) {
  try {
    console.log(`\n🔑 Testing Alpha Vantage Key #${keyIndex + 1}: ${key.substring(0, 8)}...`);
    
    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=${key}`;
    
    console.log(`🌐 Making request to: ${url.replace(key, 'HIDDEN_KEY')}`);
    
    const response = await fetch(url);
    
    console.log(`📡 Response Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      console.log(`❌ HTTP Error: ${response.status} - ${response.statusText}`);
      return { success: false, error: `HTTP ${response.status}`, keyIndex: keyIndex + 1 };
    }
    
    const data = await response.json();
    
    console.log(`📦 Response Data:`, JSON.stringify(data, null, 2));
    
    // Check for specific Alpha Vantage responses
    if (data['Error Message']) {
      console.log(`❌ API Error: ${data['Error Message']}`);
      return { success: false, error: data['Error Message'], keyIndex: keyIndex + 1 };
    }
    
    if (data['Note']) {
      console.log(`⚠️ API Note: ${data['Note']}`);
      return { success: false, error: data['Note'], keyIndex: keyIndex + 1 };
    }
    
    if (data['Information']) {
      console.log(`ℹ️ API Information: ${data['Information']}`);
      return { success: false, error: data['Information'], keyIndex: keyIndex + 1 };
    }
    
    if (data['Global Quote'] && data['Global Quote']['05. price']) {
      const price = data['Global Quote']['05. price'];
      console.log(`✅ SUCCESS! AAPL Price: $${price}`);
      return { success: true, price: parseFloat(price), keyIndex: keyIndex + 1 };
    }
    
    console.log(`❌ Unexpected response format - no price data found`);
    return { success: false, error: 'No price data in response', keyIndex: keyIndex + 1 };
    
  } catch (error) {
    console.error(`❌ Key #${keyIndex + 1} Failed:`, error.message);
    return { success: false, error: error.message, keyIndex: keyIndex + 1 };
  }
}

async function testAllKeys() {
  console.log('🔬 ALPHA VANTAGE API KEY DIAGNOSTIC TEST');
  console.log('==========================================\n');
  
  const results = [];
  
  for (let i = 0; i < ALPHA_VANTAGE_KEYS.length; i++) {
    const result = await testAlphaVantageKey(ALPHA_VANTAGE_KEYS[i], i);
    results.push(result);
    
    // Wait 1 second between tests to avoid rate limiting
    if (i < ALPHA_VANTAGE_KEYS.length - 1) {
      console.log('⏳ Waiting 1 second...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('\n📊 TEST RESULTS SUMMARY:');
  console.log('========================');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successful: ${successful.length}/${ALPHA_VANTAGE_KEYS.length}`);
  console.log(`❌ Failed: ${failed.length}/${ALPHA_VANTAGE_KEYS.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ WORKING KEYS:');
    successful.forEach(result => {
      console.log(`   Key #${result.keyIndex}: Price = $${result.price}`);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED KEYS:');
    failed.forEach(result => {
      console.log(`   Key #${result.keyIndex}: ${result.error}`);
    });
  }
  
  console.log('\n💡 DIAGNOSIS:');
  if (failed.length === ALPHA_VANTAGE_KEYS.length) {
    console.log('🚨 CRITICAL: ALL API keys are failing!');
    console.log('   Possible causes:');
    console.log('   1. API keys are invalid or expired');
    console.log('   2. Alpha Vantage service is down');
    console.log('   3. Network/firewall blocking requests');
    console.log('   4. All keys exceeded daily rate limits');
  } else if (failed.length > ALPHA_VANTAGE_KEYS.length * 0.5) {
    console.log('⚠️ WARNING: Most API keys are failing');
    console.log('   Consider getting new API keys or checking rate limits');
  } else if (failed.length > 0) {
    console.log('ℹ️ Some keys failed - might be rate limited or invalid');
  } else {
    console.log('✅ All keys are working perfectly!');
  }
  
  console.log('\n🔗 NEXT STEPS:');
  console.log('1. Check https://www.alphavantage.co/support/#api-key for key status');
  console.log('2. Verify rate limits (5 requests/minute, 500 requests/day for free)');
  console.log('3. Try testing with a different symbol (MSFT, GOOGL, etc.)');
  console.log('4. Check if IP is blocked or region restricted');
}

// Run the test
testAllKeys().catch(console.error);

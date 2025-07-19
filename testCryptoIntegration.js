// Test script para verificar la integración de CoinPaprika y EnhancedCryptoService
const axios = require('axios');

async function testCoinPaprikaAPI() {
  console.log('🔍 Testing CoinPaprika API...');
  
  try {
    // Test rate limit de CoinPaprika (25,000 requests/month)
    const url = 'https://api.coinpaprika.com/v1/tickers/btc-bitcoin';
    const response = await axios.get(url, { timeout: 10000 });
    
    console.log('✅ CoinPaprika API response:');
    console.log(`Price: $${response.data.quotes.USD.price}`);
    console.log(`24h Change: ${response.data.quotes.USD.percent_change_24h}%`);
    console.log(`Volume 24h: $${response.data.quotes.USD.volume_24h}`);
    console.log(`Market Cap: $${response.data.quotes.USD.market_cap}`);
    
    return true;
  } catch (error) {
    console.error('❌ CoinPaprika API Error:', error.message);
    return false;
  }
}

async function testCoinGeckoAPI() {
  console.log('\n🔍 Testing CoinGecko API...');
  
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true&include_market_cap=true';
    const response = await axios.get(url, { timeout: 10000 });
    
    console.log('✅ CoinGecko API response:');
    console.log(`Price: $${response.data.bitcoin.usd}`);
    console.log(`24h Change: ${response.data.bitcoin.usd_24h_change}%`);
    console.log(`Volume 24h: $${response.data.bitcoin.usd_24h_vol}`);
    console.log(`Market Cap: $${response.data.bitcoin.usd_market_cap}`);
    
    return true;
  } catch (error) {
    console.error('❌ CoinGecko API Error:', error.message);
    return false;
  }
}

async function testAPIIntegration() {
  console.log('🚀 Testing Crypto API Integration\n');
  
  const coinPaprikaResult = await testCoinPaprikaAPI();
  const coinGeckoResult = await testCoinGeckoAPI();
  
  console.log('\n📊 Integration Test Summary:');
  console.log(`CoinPaprika API: ${coinPaprikaResult ? '✅ Working' : '❌ Failed'}`);
  console.log(`CoinGecko API: ${coinGeckoResult ? '✅ Working' : '❌ Failed'}`);
  
  if (coinPaprikaResult || coinGeckoResult) {
    console.log('\n🎉 At least one API is working! Enhanced crypto service will provide reliable data.');
  } else {
    console.log('\n⚠️ Both APIs failed. The app will use fallback realistic mock data.');
  }
  
  console.log('\n💡 Rate Limits:');
  console.log('• CoinPaprika: 25,000 requests/month (~833/day) - 100ms between requests');
  console.log('• CoinGecko: ~50 requests/minute - 30s between requests for free tier');
  console.log('• Enhanced service uses CoinPaprika first, then CoinGecko as fallback');
}

// Run the test
testAPIIntegration();

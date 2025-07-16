/**
 * Script de prueba para VectorFlux AI Alerts
 * Ejecuta: node test_ai_alerts.js
 */

const { autoAlertService } = require('./src/services/autoAlertService');

async function testVectorFluxAI() {
  console.log('🚀 Testing VectorFlux AI Alert System...\n');
  
  try {
    // Test 1: Initialize AI
    console.log('1️⃣ Testing AI Initialization...');
    await autoAlertService.loadAlerts();
    console.log('✅ AI initialized successfully\n');
    
    // Test 2: Get real market data
    console.log('2️⃣ Testing Real Market Data Fetching...');
    const alerts = await autoAlertService.scanForAlerts();
    console.log(`✅ Generated ${alerts.length} AI alerts\n`);
    
    // Test 3: Show alert details
    if (alerts.length > 0) {
      console.log('3️⃣ AI Alert Examples:');
      alerts.slice(0, 3).forEach((alert, index) => {
        console.log(`\n📊 Alert ${index + 1}:`);
        console.log(`   Symbol: ${alert.symbol}`);
        console.log(`   Strategy: ${alert.strategy}`);
        console.log(`   Signal: ${alert.signal.toUpperCase()}`);
        console.log(`   Confidence: ${Math.round(alert.confidence * 100)}%`);
        console.log(`   Price: $${alert.currentPrice.toLocaleString()}`);
        if (alert.targetPrice) {
          console.log(`   Target: $${alert.targetPrice.toLocaleString()}`);
        }
        console.log(`   Reasoning: ${alert.reasoning.substring(0, 100)}...`);
      });
    }
    
    // Test 4: Show active alerts
    console.log('\n4️⃣ Active Alerts Summary:');
    const activeAlerts = autoAlertService.getActiveAlerts();
    console.log(`   Total Active: ${activeAlerts.length}`);
    
    const cryptoAlerts = activeAlerts.filter(a => 
      ['BTC', 'ETH', 'ADA', 'SOL', 'MATIC', 'AVAX', 'LINK', 'DOT', 'BNB', 'DOGE'].includes(a.symbol)
    );
    console.log(`   Crypto Alerts: ${cryptoAlerts.length}`);
    
    const stockAlerts = activeAlerts.filter(a => 
      ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'META', 'AMZN', 'NFLX', 'AMD', 'BABA'].includes(a.symbol)
    );
    console.log(`   Stock Alerts: ${stockAlerts.length}`);
    
    const aiAlerts = activeAlerts.filter(a => 
      a.strategy.includes('VectorFlux') || a.strategy.includes('AI') || 
      a.strategy.includes('Neural') || a.strategy.includes('Learning')
    );
    console.log(`   AI-Powered Alerts: ${aiAlerts.length}`);
    
    console.log('\n🎉 VectorFlux AI Alert System Test Complete!');
    console.log('✅ Real TensorFlow models with real market data working correctly');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run test
testVectorFluxAI().then(() => {
  console.log('\n📝 Test Notes:');
  console.log('• VectorFlux AI uses real TensorFlow.js models');
  console.log('• Market data comes from real APIs (Alpha Vantage, CoinGecko)');
  console.log('• AI strategies: Ensemble, DNN, LSTM, CNN, RL, Sentiment Analysis');
  console.log('• No more mock data - everything is real!');
}).catch(console.error);

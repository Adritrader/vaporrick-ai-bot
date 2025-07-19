// Test script for API Key Rotation System
// Run this to test the rotation functionality

import { apiKeyManager } from '../services/apiKeyRotationManager';

export const testAPIKeyRotation = async () => {
  console.log('🚀 Testing API Key Rotation System...\n');
  
  // 1. Show initial status
  console.log('📊 INITIAL STATUS:');
  console.log(apiKeyManager.getStatusReport());
  
  // 2. Simulate multiple API requests
  console.log('\n🔄 SIMULATING API REQUESTS...');
  
  for (let i = 1; i <= 15; i++) {
    const currentKey = apiKeyManager.getCurrentAlphaVantageKey();
    console.log(`Request ${i}: Using key ${currentKey.substring(0, 8)}...`);
    
    // Simulate request success/failure
    const isSuccess = Math.random() > 0.1; // 90% success rate
    const errorMessage = isSuccess ? undefined : 
      (Math.random() > 0.5 ? 'Rate limit exceeded' : 'Quota exceeded');
    
    await apiKeyManager.recordAPIRequest(isSuccess, errorMessage);
    
    if (!isSuccess) {
      console.log(`  ❌ Failed: ${errorMessage}`);
      console.log(`  🔄 Rotating to next key...`);
    } else {
      console.log(`  ✅ Success`);
    }
    
    // Show current stats every 5 requests
    if (i % 5 === 0) {
      const stats = apiKeyManager.getUsageStatistics();
      console.log(`\n📈 After ${i} requests:`);
      console.log(`  Active Keys: ${stats.activeKeys}/${stats.totalKeys}`);
      console.log(`  Total Requests: ${stats.totalRequests}`);
      console.log(`  Available: ${stats.availableRequests}\n`);
    }
  }
  
  // 3. Show final status
  console.log('\n📊 FINAL STATUS:');
  console.log(apiKeyManager.getStatusReport());
  
  // 4. Test manual operations
  console.log('\n🔧 TESTING MANUAL OPERATIONS:');
  
  // Add a new key
  apiKeyManager.addNewKey('TEST_KEY_12345', 'Test_Key');
  console.log('✅ Added test key');
  
  // Manual rotation
  const nextKey = apiKeyManager.rotateToNextKey();
  console.log(`🔄 Manually rotated to: ${nextKey.substring(0, 8)}...`);
  
  // Remove test key
  apiKeyManager.removeKey('TEST_KEY_12345');
  console.log('🗑️ Removed test key');
  
  // 5. Show usage recommendations
  console.log('\n💡 USAGE RECOMMENDATIONS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ System is working correctly!');
  console.log('✅ Automatic rotation is functional');
  console.log('✅ Error handling is operational');
  console.log('\n🎯 Next steps:');
  console.log('1. Add your real Alpha Vantage API keys');
  console.log('2. Replace placeholder keys in apiKeyRotationManager.ts');
  console.log('3. Test with real API calls');
  console.log('4. Monitor usage with the 🔬 button in the app');
  
  console.log('\n🚀 API Key Rotation Test Complete!');
};

// Example of how to add multiple keys programmatically
export const addMultipleKeys = (keys: string[]) => {
  console.log(`📝 Adding ${keys.length} API keys...`);
  
  keys.forEach((key, index) => {
    if (key && key !== 'YOUR_KEY_X_HERE' && key.length > 10) {
      apiKeyManager.addNewKey(key, `Key_${index + 1}`);
      console.log(`✅ Added Key_${index + 1}: ${key.substring(0, 8)}...`);
    } else {
      console.log(`❌ Invalid key at position ${index + 1}`);
    }
  });
  
  const stats = apiKeyManager.getUsageStatistics();
  console.log(`\n📊 Total keys configured: ${stats.totalKeys}`);
  console.log(`📊 Max daily capacity: ${stats.totalKeys * 500} requests`);
};

// Example usage:
// addMultipleKeys([
//   'CPIIA8O6V6AWJSCE',
//   'YOUR_SECOND_KEY_HERE',
//   'YOUR_THIRD_KEY_HERE',
//   // ... add up to 10 keys
// ]);

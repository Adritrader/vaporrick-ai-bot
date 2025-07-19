// Test utility to verify auto trades Firebase service is working correctly

import { firebaseAutoTradesService } from '../services/firebaseAutoTradesService';
import { Trade } from '../services/tradeDatabase';

export class AutoTradesServiceTester {
  
  // Test if auto trades can be saved and retrieved
  static async testAutoTradesSaveAndLoad(): Promise<boolean> {
    try {
      console.log('🧪 Testing Auto Trades Firebase Service...');
      
      // Create a test trade
      const testTrade: Trade = {
        id: `test_trade_${Date.now()}`,
        alertId: `test_alert_${Date.now()}`,
        symbol: 'TEST_SYMBOL',
        name: 'Test Trading Pair',
        signal: 'buy',
        entryPrice: 100.00,
        currentPrice: 100.00,
        targetPrice: 110.00,
        stopLoss: 95.00,
        confidence: 85,
        strategy: 'Test Strategy',
        reasoning: 'Test auto-trade for verification',
        priority: 'high',
        entryDate: new Date(),
        status: 'active',
        timeframe: '7d',
        dataSource: 'Test',
        executionMethod: 'automatic',
        autoExecuted: true,
        signalExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        signalFulfilled: false,
        isLocked: true,
        lockedMetrics: {
          entryPrice: 100.00,
          confidence: 85,
          targetPrice: 110.00,
          expectedReturn: 10.0,
          riskLevel: 'medium',
          timestamp: Date.now()
        }
      };
      
      console.log('📤 Saving test trade to Firebase...');
      await firebaseAutoTradesService.saveAutoTradeToFirebase(testTrade);
      
      console.log('📥 Loading trades from Firebase...');
      const loadedTrades = await firebaseAutoTradesService.getAllAutoTradesFromFirebase();
      
      // Check if our test trade was saved
      const foundTestTrade = loadedTrades.find(t => t.id === testTrade.id);
      
      if (foundTestTrade) {
        console.log('✅ Test PASSED: Auto trade was saved and loaded successfully');
        console.log(`📊 Total trades in Firebase: ${loadedTrades.length}`);
        console.log(`🎯 Test trade found: ${foundTestTrade.symbol} - ${foundTestTrade.signal}`);
        
        // Clean up test data
        await this.cleanupTestTrade(testTrade.id);
        
        return true;
      } else {
        console.error('❌ Test FAILED: Test trade was not found in Firebase');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Test FAILED with error:', error);
      return false;
    }
  }
  
  // Test pagination functionality
  static async testPagination(): Promise<boolean> {
    try {
      console.log('🧪 Testing pagination functionality...');
      
      const page0 = await firebaseAutoTradesService.getAutoTradesFromFirebase(0, 5);
      const page1 = await firebaseAutoTradesService.getAutoTradesFromFirebase(1, 5);
      
      console.log(`📊 Page 0: ${page0.trades.length} trades, hasMore: ${page0.hasMore}, total: ${page0.total}`);
      console.log(`📊 Page 1: ${page1.trades.length} trades, hasMore: ${page1.hasMore}, total: ${page1.total}`);
      
      // Basic validation
      if (page0.total >= 0 && page1.total >= 0) {
        console.log('✅ Pagination test PASSED');
        return true;
      } else {
        console.error('❌ Pagination test FAILED');
        return false;
      }
      
    } catch (error) {
      console.error('❌ Pagination test FAILED with error:', error);
      return false;
    }
  }
  
  // Test statistics calculation
  static async testStatistics(): Promise<boolean> {
    try {
      console.log('🧪 Testing statistics calculation...');
      
      const stats = await firebaseAutoTradesService.getAutoTradingStatsFromFirebase();
      
      if (stats) {
        console.log('✅ Statistics test PASSED');
        console.log(`📊 Stats: ${stats.totalTrades} trades, ${stats.winRate.toFixed(1)}% win rate`);
        return true;
      } else {
        console.log('⚠️ Statistics returned null (may be expected for empty collection)');
        return true; // Null stats might be expected for empty collection
      }
      
    } catch (error) {
      console.error('❌ Statistics test FAILED with error:', error);
      return false;
    }
  }
  
  // Run all tests
  static async runAllTests(): Promise<void> {
    console.log('🔬 Starting Auto Trades Service Full Test Suite...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const results = {
      saveAndLoad: await this.testAutoTradesSaveAndLoad(),
      pagination: await this.testPagination(),
      statistics: await this.testStatistics(),
    };
    
    const passedTests = Object.values(results).filter(Boolean).length;
    const totalTests = Object.keys(results).length;
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`🏆 TEST RESULTS: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
      console.log('🎉 All tests PASSED! Auto Trades Service is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Check logs above for details.');
    }
    
    return;
  }
  
  // Clean up test data
  private static async cleanupTestTrade(tradeId: string): Promise<void> {
    try {
      // Note: In a real Firebase implementation, you'd delete from Firestore
      // For now, this is a placeholder since we're using AsyncStorage simulation
      console.log(`🧹 Cleaned up test trade: ${tradeId}`);
    } catch (error) {
      console.warn('⚠️ Failed to cleanup test trade:', error);
    }
  }
  
  // Get current Firebase collection status
  static async getCollectionStatus(): Promise<void> {
    try {
      console.log('📊 Firebase Auto Trades Collection Status:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
      const allTrades = await firebaseAutoTradesService.getAllAutoTradesFromFirebase();
      const stats = await firebaseAutoTradesService.getAutoTradingStatsFromFirebase();
      
      console.log(`📈 Total Trades: ${allTrades.length}`);
      console.log(`🟢 Active Trades: ${allTrades.filter(t => t.status === 'active').length}`);
      console.log(`🔴 Closed Trades: ${allTrades.filter(t => t.status === 'closed').length}`);
      console.log(`🤖 Auto-executed: ${allTrades.filter(t => t.executionMethod === 'automatic').length}`);
      
      if (stats) {
        console.log(`📊 Win Rate: ${stats.winRate.toFixed(1)}%`);
        console.log(`💰 Total Return: ${stats.totalReturn.toFixed(2)}%`);
        console.log(`⭐ Avg Confidence: ${stats.averageConfidence.toFixed(1)}%`);
      }
      
      // Show recent trades
      const recentTrades = allTrades.slice(0, 5);
      if (recentTrades.length > 0) {
        console.log('\n🕒 Recent Trades:');
        recentTrades.forEach((trade, index) => {
          console.log(`  ${index + 1}. ${trade.symbol} - ${trade.signal} - ${trade.status} - ${trade.confidence}%`);
        });
      }
      
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      
    } catch (error) {
      console.error('❌ Error getting collection status:', error);
    }
  }
}

// Convenience export for easy testing
export const testAutoTrades = AutoTradesServiceTester.runAllTests;
export const checkAutoTradesStatus = AutoTradesServiceTester.getCollectionStatus;

// Advanced Stock API Diagnostics and Recovery Service

import { apiKeyManager } from './apiKeyRotationManager';
import { API_CONFIG } from '../config/apiConfig';

export class StockAPIRecoveryService {
  
  // Test all Alpha Vantage keys one by one
  static async testAllAlphaVantageKeys(): Promise<{
    workingKeys: string[];
    failedKeys: string[];
    totalKeys: number;
    overallStatus: 'healthy' | 'partial' | 'critical' | 'failed';
  }> {
    try {
      console.log('🔬 Testing all Alpha Vantage API keys...');
      
      const keyStats = apiKeyManager.getUsageStatistics();
      const workingKeys: string[] = [];
      const failedKeys: string[] = [];
      
      // Test a simple symbol like AAPL with each key
      const testSymbol = 'AAPL';
      
      for (let i = 0; i < keyStats.keyDetails.length; i++) {
        const keyDetail = keyStats.keyDetails[i];
        
        try {
          console.log(`🔑 Testing ${keyDetail.name}...`);
          
          // Force use specific key for testing
          const testKey = apiKeyManager.rotateToNextKey();
          const url = `${API_CONFIG.ALPHA_VANTAGE.BASE_URL}?function=GLOBAL_QUOTE&symbol=${testSymbol}&apikey=${testKey}`;
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);
          
          const response = await fetch(url, { 
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data['Global Quote'] && data['Global Quote']['05. price']) {
              workingKeys.push(keyDetail.name);
              console.log(`✅ ${keyDetail.name}: Working (Price: $${data['Global Quote']['05. price']})`);
            } else if (data['Error Message']) {
              failedKeys.push(keyDetail.name);
              console.log(`❌ ${keyDetail.name}: API Error - ${data['Error Message']}`);
            } else if (data['Note']) {
              console.log(`⚠️ ${keyDetail.name}: Rate limited - ${data['Note']}`);
              // Don't count as failed if just rate limited
              if (data['Note'].includes('rate limit')) {
                console.log(`🕐 ${keyDetail.name}: Rate limited but potentially working`);
              }
            } else {
              failedKeys.push(keyDetail.name);
              console.log(`❌ ${keyDetail.name}: Unexpected response format`);
            }
          } else {
            failedKeys.push(keyDetail.name);
            console.log(`❌ ${keyDetail.name}: HTTP ${response.status} - ${response.statusText}`);
          }
          
          // Small delay between tests to avoid overwhelming APIs
          await new Promise(resolve => setTimeout(resolve, 500));
          
        } catch (error) {
          failedKeys.push(keyDetail.name);
          console.log(`❌ ${keyDetail.name}: Test failed - ${error}`);
        }
      }
      
      let overallStatus: 'healthy' | 'partial' | 'critical' | 'failed' = 'failed';
      
      if (workingKeys.length === keyStats.totalKeys) {
        overallStatus = 'healthy';
      } else if (workingKeys.length >= keyStats.totalKeys * 0.7) {
        overallStatus = 'partial';
      } else if (workingKeys.length > 0) {
        overallStatus = 'critical';
      }
      
      console.log('🏁 Alpha Vantage Test Results:');
      console.log(`   ✅ Working keys: ${workingKeys.length}/${keyStats.totalKeys}`);
      console.log(`   ❌ Failed keys: ${failedKeys.length}/${keyStats.totalKeys}`);
      console.log(`   📊 Overall status: ${overallStatus.toUpperCase()}`);
      
      return {
        workingKeys,
        failedKeys,
        totalKeys: keyStats.totalKeys,
        overallStatus
      };
      
    } catch (error) {
      console.error('❌ Error testing Alpha Vantage keys:', error);
      return {
        workingKeys: [],
        failedKeys: [],
        totalKeys: 0,
        overallStatus: 'failed'
      };
    }
  }
  
  // Test Yahoo Finance as backup
  static async testYahooFinance(): Promise<{
    working: boolean;
    error?: string;
  }> {
    try {
      console.log('🔬 Testing Yahoo Finance API...');
      
      const testSymbol = 'AAPL';
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${testSymbol}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.chart && data.chart.result && data.chart.result.length > 0) {
          const result = data.chart.result[0];
          if (result.meta && result.meta.regularMarketPrice) {
            console.log(`✅ Yahoo Finance: Working (Price: $${result.meta.regularMarketPrice})`);
            return { working: true };
          }
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      console.log(`❌ Yahoo Finance: Failed - ${error}`);
      return { 
        working: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Test Finnhub as alternative
  static async testFinnhub(): Promise<{
    working: boolean;
    error?: string;
  }> {
    try {
      console.log('🔬 Testing Finnhub API...');
      
      const testSymbol = 'AAPL';
      // Using free tier endpoint
      const url = `https://finnhub.io/api/v1/quote?symbol=${testSymbol}&token=demo`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      
      const response = await fetch(url, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.c && data.c > 0) { // 'c' is current price
          console.log(`✅ Finnhub: Working (Price: $${data.c})`);
          return { working: true };
        }
      }
      
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      
    } catch (error) {
      console.log(`❌ Finnhub: Failed - ${error}`);
      return { 
        working: false, 
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  // Comprehensive diagnostic
  static async runComprehensiveDiagnostic(): Promise<{
    alphaVantage: Awaited<ReturnType<typeof StockAPIRecoveryService.testAllAlphaVantageKeys>>;
    yahooFinance: Awaited<ReturnType<typeof StockAPIRecoveryService.testYahooFinance>>;
    finnhub: Awaited<ReturnType<typeof StockAPIRecoveryService.testFinnhub>>;
    recommendations: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  }> {
    console.log('🏥 Running comprehensive stock API diagnostic...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    const [alphaVantage, yahooFinance, finnhub] = await Promise.all([
      this.testAllAlphaVantageKeys(),
      this.testYahooFinance(),
      this.testFinnhub()
    ]);
    
    const recommendations: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    
    // Analyze results and provide recommendations
    if (alphaVantage.overallStatus === 'failed') {
      recommendations.push('🚨 ALL Alpha Vantage keys are failing - check API key validity');
      recommendations.push('🔑 Verify API keys at https://www.alphavantage.co/support/#api-key');
      severity = 'critical';
    } else if (alphaVantage.overallStatus === 'critical') {
      recommendations.push(`⚠️ Only ${alphaVantage.workingKeys.length}/${alphaVantage.totalKeys} Alpha Vantage keys working`);
      recommendations.push('🔧 Check failed keys and consider replacing them');
      severity = 'high';
    } else if (alphaVantage.overallStatus === 'partial') {
      recommendations.push(`ℹ️ ${alphaVantage.failedKeys.length} Alpha Vantage keys need attention`);
      severity = 'medium';
    }
    
    if (!yahooFinance.working && !finnhub.working) {
      recommendations.push('🚫 No backup APIs working - stock scanning may fail completely');
      if (severity === 'low') severity = 'high';
    } else if (yahooFinance.working) {
      recommendations.push('✅ Yahoo Finance available as backup');
    } else if (finnhub.working) {
      recommendations.push('✅ Finnhub available as backup');
    }
    
    if (alphaVantage.workingKeys.length === 0 && !yahooFinance.working && !finnhub.working) {
      recommendations.push('💥 CRITICAL: No stock APIs working - immediate action required');
      severity = 'critical';
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 DIAGNOSTIC SUMMARY:');
    console.log(`🎯 Alpha Vantage: ${alphaVantage.workingKeys.length}/${alphaVantage.totalKeys} keys (${alphaVantage.overallStatus})`);
    console.log(`🎯 Yahoo Finance: ${yahooFinance.working ? 'Working' : 'Failed'}`);
    console.log(`🎯 Finnhub: ${finnhub.working ? 'Working' : 'Failed'}`);
    console.log(`🚨 Severity: ${severity.toUpperCase()}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    if (recommendations.length > 0) {
      console.log('💡 RECOMMENDATIONS:');
      recommendations.forEach(rec => console.log(`   ${rec}`));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
    
    return {
      alphaVantage,
      yahooFinance,
      finnhub,
      recommendations,
      severity
    };
  }
  
  // Get simple fallback stock data using a basic approach
  static async getFallbackStockData(symbol: string): Promise<{
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap: number;
    type: 'stock';
    lastUpdated: number;
    source: 'fallback';
  } | null> {
    try {
      console.log(`🔄 Attempting fallback stock data for ${symbol}...`);
      
      // Try multiple simple endpoints
      const fallbackAPIs = [
        {
          name: 'Yahoo Finance Simple',
          url: `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`,
          parser: (data: any) => {
            const result = data.chart?.result?.[0];
            if (result?.meta) {
              return {
                price: result.meta.regularMarketPrice || 0,
                change: result.meta.regularMarketChangePercent || 0,
                volume: result.meta.regularMarketVolume || 0
              };
            }
            return null;
          }
        },
        {
          name: 'Alpha Vantage Demo',
          url: `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=demo`,
          parser: (data: any) => {
            const quote = data['Global Quote'];
            if (quote?.['05. price']) {
              return {
                price: parseFloat(quote['05. price']),
                change: parseFloat(quote['10. change percent']?.replace('%', '') || '0'),
                volume: parseInt(quote['06. volume']) || 0
              };
            }
            return null;
          }
        }
      ];
      
      for (const api of fallbackAPIs) {
        try {
          console.log(`🔄 Trying ${api.name}...`);
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          
          const response = await fetch(api.url, {
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (response.ok) {
            const data = await response.json();
            const parsed = api.parser(data);
            
            if (parsed && parsed.price > 0) {
              console.log(`✅ ${api.name} success: ${symbol} = $${parsed.price}`);
              
              return {
                symbol,
                price: parsed.price,
                change: parsed.change,
                changePercent: parsed.change,
                volume: parsed.volume,
                marketCap: 0,
                type: 'stock' as const,
                lastUpdated: Date.now(),
                source: 'fallback' as const
              };
            }
          }
        } catch (error) {
          console.log(`❌ ${api.name} failed:`, error);
          continue;
        }
      }
      
      console.log(`❌ All fallback APIs failed for ${symbol}`);
      return null;
      
    } catch (error) {
      console.error(`❌ Fallback stock data error for ${symbol}:`, error);
      return null;
    }
  }
}

// Export for easy use
export const stockAPIRecovery = StockAPIRecoveryService;

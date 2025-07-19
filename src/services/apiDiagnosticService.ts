// API Diagnostics Service - Test API connections and keys
import { API_CONFIG } from '../config/apiConfig';

export class APIDiagnosticService {
  
  /**
   * Test Alpha Vantage API connection and key validity
   */
  static async testAlphaVantageAPI(): Promise<{
    success: boolean;
    message: string;
    requestsRemaining?: number;
    keyStatus: 'valid' | 'invalid' | 'demo' | 'rate_limited';
  }> {
    try {
      console.log('🔍 Testing Alpha Vantage API with key:', API_CONFIG.ALPHA_VANTAGE.API_KEY);
      
      // Test with a simple symbol
      const testSymbol = 'AAPL';
      const url = `${API_CONFIG.ALPHA_VANTAGE.BASE_URL}?function=GLOBAL_QUOTE&symbol=${testSymbol}&apikey=${API_CONFIG.ALPHA_VANTAGE.API_KEY}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 Alpha Vantage Response:', data);
      
      // Check for various error conditions
      if (data['Error Message']) {
        return {
          success: false,
          message: `API Error: ${data['Error Message']}`,
          keyStatus: 'invalid'
        };
      }
      
      if (data['Note'] && data['Note'].includes('rate limit')) {
        return {
          success: false,
          message: 'Rate limit exceeded. Try again in a minute.',
          keyStatus: 'rate_limited'
        };
      }
      
      if (data['Information'] && data['Information'].includes('demo')) {
        return {
          success: false,
          message: 'Using demo key with limited functionality',
          keyStatus: 'demo'
        };
      }
      
      // Check for successful response
      if (data['Global Quote'] && data['Global Quote']['01. symbol']) {
        const quote = data['Global Quote'];
        return {
          success: true,
          message: `✅ Alpha Vantage API working! Test symbol ${quote['01. symbol']} price: $${quote['05. price']}`,
          keyStatus: 'valid'
        };
      }
      
      return {
        success: false,
        message: 'Unexpected response format from Alpha Vantage',
        keyStatus: 'invalid'
      };
      
    } catch (error) {
      console.error('❌ Alpha Vantage API test failed:', error);
      return {
        success: false,
        message: `Network error: ${error.message}`,
        keyStatus: 'invalid'
      };
    }
  }
  
  /**
   * Test CoinGecko API connection
   */
  static async testCoinGeckoAPI(): Promise<{
    success: boolean;
    message: string;
    requestsRemaining?: number;
  }> {
    try {
      console.log('🔍 Testing CoinGecko API...');
      
      const url = `${API_CONFIG.COINGECKO.BASE_URL}/simple/price?ids=bitcoin&vs_currencies=usd`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      console.log('📊 CoinGecko Response:', data);
      
      if (data.bitcoin && data.bitcoin.usd) {
        return {
          success: true,
          message: `✅ CoinGecko API working! Bitcoin price: $${data.bitcoin.usd.toLocaleString()}`
        };
      }
      
      return {
        success: false,
        message: 'Unexpected response from CoinGecko API'
      };
      
    } catch (error) {
      console.error('❌ CoinGecko API test failed:', error);
      return {
        success: false,
        message: `Network error: ${error.message}`
      };
    }
  }
  
  /**
   * Run comprehensive API diagnostics
   */
  static async runFullDiagnostics(): Promise<{
    alphaVantage: any;
    coinGecko: any;
    overall: {
      score: number;
      canUseStocks: boolean;
      canUseCrypto: boolean;
      recommendations: string[];
    };
  }> {
    console.log('🔬 Running comprehensive API diagnostics...');
    
    const alphaVantageResult = await this.testAlphaVantageAPI();
    const coinGeckoResult = await this.testCoinGeckoAPI();
    
    // Calculate overall score
    let score = 0;
    const recommendations: string[] = [];
    
    if (alphaVantageResult.success) {
      score += 50;
    } else {
      if (alphaVantageResult.keyStatus === 'rate_limited') {
        recommendations.push('⏰ Alpha Vantage rate limited - wait before next request');
      } else if (alphaVantageResult.keyStatus === 'demo') {
        recommendations.push('🔑 Consider getting a real Alpha Vantage API key for better limits');
      } else {
        recommendations.push('❌ Alpha Vantage API issues - check your API key');
      }
    }
    
    if (coinGeckoResult.success) {
      score += 50;
    } else {
      recommendations.push('❌ CoinGecko API issues - check your internet connection');
    }
    
    // Add performance recommendations
    if (score === 100) {
      recommendations.push('🎉 All APIs working perfectly!');
      recommendations.push('💡 Consider getting CoinGecko Pro for even better crypto data');
    }
    
    return {
      alphaVantage: alphaVantageResult,
      coinGecko: coinGeckoResult,
      overall: {
        score,
        canUseStocks: alphaVantageResult.success,
        canUseCrypto: coinGeckoResult.success,
        recommendations
      }
    };
  }
  
  /**
   * Get API usage recommendations based on current setup
   */
  static getUsageRecommendations(): string[] {
    const recommendations: string[] = [];
    
    // Check API key configuration
    if (API_CONFIG.ALPHA_VANTAGE.API_KEY === 'demo' || API_CONFIG.ALPHA_VANTAGE.API_KEY === 'YOUR_ALPHA_VANTAGE_API_KEY') {
      recommendations.push('🔑 Get a real Alpha Vantage API key for 500 requests/day instead of 25');
    } else {
      recommendations.push('✅ Alpha Vantage API key configured (500 requests/day)');
    }
    
    if (!API_CONFIG.COINGECKO.PRO_API_KEY) {
      recommendations.push('💎 Consider CoinGecko Pro for higher crypto data limits');
    }
    
    // Usage patterns
    recommendations.push('📊 Best practices:');
    recommendations.push('  • Use stock scanning during market hours for fresh data');
    recommendations.push('  • Crypto data is available 24/7');
    recommendations.push('  • Cache data when possible to save API calls');
    recommendations.push('  • Monitor your daily usage to avoid hitting limits');
    
    return recommendations;
  }
}

// Export a simple test function for immediate use
export const testAPIConnections = async (): Promise<void> => {
  console.log('🚀 Starting API Connection Tests...');
  
  const results = await APIDiagnosticService.runFullDiagnostics();
  
  console.log('\n📊 === API DIAGNOSTIC RESULTS ===');
  console.log(`Overall Score: ${results.overall.score}/100`);
  console.log(`Can Use Stocks: ${results.overall.canUseStocks ? '✅' : '❌'}`);
  console.log(`Can Use Crypto: ${results.overall.canUseCrypto ? '✅' : '❌'}`);
  
  console.log('\n🔍 Alpha Vantage:', results.alphaVantage.message);
  console.log('🔍 CoinGecko:', results.coinGecko.message);
  
  console.log('\n💡 Recommendations:');
  results.overall.recommendations.forEach(rec => console.log(rec));
  
  console.log('\n📈 Usage Tips:');
  APIDiagnosticService.getUsageRecommendations().forEach(tip => console.log(tip));
};

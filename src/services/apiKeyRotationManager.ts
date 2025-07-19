// API Key Rotation Manager - Automatically rotate between multiple API keys

interface APIKeyInfo {
  key: string;
  name: string;
  dailyUsage: number;
  lastResetDate: string;
  isBlocked: boolean;
  blockedUntil?: Date;
  maxDailyRequests: number;
}

export class APIKeyRotationManager {
  private static instance: APIKeyRotationManager;
  private alphaVantageKeys: APIKeyInfo[] = [];
  private currentKeyIndex = 0;
  private storageKey = 'api_key_usage_data';

  // Multiple Alpha Vantage API Keys - Add your 10 keys here
  private readonly ALPHA_VANTAGE_KEYS = [
    { key: 'CPIIA8O6V6AWJSCE', name: 'Key_1' }, // Tu key actual
    { key: 'QSMJ47Q85W678SA6', name: 'Key_2' },
    { key: '67H6Y8K1FS7DA70O', name: 'Key_3' },
    { key: '1G2HAQMJ9UXBJCAZ', name: 'Key_4' },
    { key: 'N6UH8MHQ0EYEJMMN', name: 'Key_5' },
    { key: 'C4CVSPST8150RY04', name: 'Key_6' },
    { key: 'N2G6QGNMK7EMJDQY', name: 'Key_7' },
    { key: 'R3PZ4CFCVOE21FJ0', name: 'Key_8' },
    { key: 'MO1IJ6FSS0TTWZWJ', name: 'Key_9' },
    { key: 'QYVF9G3QB2D7PB45', name: 'Key_10' },
  ];

  constructor() {
    this.initializeKeys();
    this.loadUsageData();
  }

  static getInstance(): APIKeyRotationManager {
    if (!APIKeyRotationManager.instance) {
      APIKeyRotationManager.instance = new APIKeyRotationManager();
    }
    return APIKeyRotationManager.instance;
  }

  private initializeKeys() {
    this.alphaVantageKeys = this.ALPHA_VANTAGE_KEYS.map(keyInfo => ({
      key: keyInfo.key,
      name: keyInfo.name,
      dailyUsage: 0,
      lastResetDate: new Date().toDateString(),
      isBlocked: false,
      maxDailyRequests: 500, // Standard Alpha Vantage limit
    }));
  }

  private async loadUsageData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        
        // Merge stored data with current keys
        this.alphaVantageKeys = this.alphaVantageKeys.map(key => {
          const storedKey = data.find((k: APIKeyInfo) => k.key === key.key);
          if (storedKey) {
            // Reset daily usage if it's a new day
            const today = new Date().toDateString();
            if (storedKey.lastResetDate !== today) {
              return {
                ...key,
                dailyUsage: 0,
                lastResetDate: today,
                isBlocked: false,
                blockedUntil: undefined,
              };
            }
            return { ...key, ...storedKey };
          }
          return key;
        });
      }
    } catch (error) {
      console.warn('Failed to load API key usage data:', error);
    }
  }

  private async saveUsageData() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.alphaVantageKeys));
    } catch (error) {
      console.warn('Failed to save API key usage data:', error);
    }
  }

  /**
   * Get the current active API key
   */
  getCurrentAlphaVantageKey(): string {
    const availableKey = this.findNextAvailableKey();
    if (!availableKey) {
      console.warn('⚠️ All API keys exhausted for today!');
      return this.alphaVantageKeys[0].key; // Return first key as fallback
    }
    return availableKey.key;
  }

  /**
   * Find the next available API key that hasn't hit its daily limit
   */
  private findNextAvailableKey(): APIKeyInfo | null {
    const today = new Date().toDateString();
    
    // Reset daily usage for keys from previous days
    this.alphaVantageKeys.forEach(key => {
      if (key.lastResetDate !== today) {
        key.dailyUsage = 0;
        key.lastResetDate = today;
        key.isBlocked = false;
        key.blockedUntil = undefined;
      }
    });

    // Find available keys (not blocked and under daily limit)
    const availableKeys = this.alphaVantageKeys.filter(key => 
      !key.isBlocked && 
      key.dailyUsage < key.maxDailyRequests &&
      key.key !== 'YOUR_KEY_X_HERE' // Exclude placeholder keys
    );

    if (availableKeys.length === 0) {
      return null;
    }

    // Sort by usage (least used first)
    availableKeys.sort((a, b) => a.dailyUsage - b.dailyUsage);
    
    return availableKeys[0];
  }

  /**
   * Record an API request and automatically rotate if needed
   */
  async recordAPIRequest(success: boolean, errorMessage?: string): Promise<void> {
    const currentKey = this.alphaVantageKeys.find(k => k.key === this.getCurrentAlphaVantageKey());
    
    if (!currentKey) return;

    currentKey.dailyUsage++;

    // Check if we hit rate limit or daily limit
    if (errorMessage?.includes('rate limit') || errorMessage?.includes('limit exceeded')) {
      currentKey.isBlocked = true;
      currentKey.blockedUntil = new Date(Date.now() + 60 * 1000); // Block for 1 minute
      console.log(`🔄 API Key ${currentKey.name} hit rate limit, rotating to next key...`);
    }

    // Check if we're close to daily limit
    if (currentKey.dailyUsage >= currentKey.maxDailyRequests * 0.95) { // 95% of limit
      currentKey.isBlocked = true;
      console.log(`⚠️ API Key ${currentKey.name} approaching daily limit (${currentKey.dailyUsage}/${currentKey.maxDailyRequests}), marking as blocked`);
    }

    await this.saveUsageData();
  }

  /**
   * Get usage statistics for all keys
   */
  getUsageStatistics(): {
    totalKeys: number;
    activeKeys: number;
    totalRequests: number;
    availableRequests: number;
    keyDetails: Array<{
      name: string;
      usage: number;
      limit: number;
      available: number;
      isActive: boolean;
    }>;
  } {
    const today = new Date().toDateString();
    
    const activeKeys = this.alphaVantageKeys.filter(key => 
      !key.isBlocked && 
      key.dailyUsage < key.maxDailyRequests &&
      key.key !== 'YOUR_KEY_X_HERE'
    );

    const totalRequests = this.alphaVantageKeys.reduce((sum, key) => sum + key.dailyUsage, 0);
    const availableRequests = this.alphaVantageKeys.reduce((sum, key) => 
      sum + Math.max(0, key.maxDailyRequests - key.dailyUsage), 0);

    return {
      totalKeys: this.alphaVantageKeys.length,
      activeKeys: activeKeys.length,
      totalRequests,
      availableRequests,
      keyDetails: this.alphaVantageKeys.map(key => ({
        name: key.name,
        usage: key.dailyUsage,
        limit: key.maxDailyRequests,
        available: Math.max(0, key.maxDailyRequests - key.dailyUsage),
        isActive: !key.isBlocked && key.dailyUsage < key.maxDailyRequests
      }))
    };
  }

  /**
   * Manually rotate to next available key
   */
  rotateToNextKey(): string {
    const nextKey = this.findNextAvailableKey();
    if (nextKey) {
      console.log(`🔄 Manually rotating to API Key: ${nextKey.name}`);
      return nextKey.key;
    }
    
    console.warn('⚠️ No available keys to rotate to');
    return this.alphaVantageKeys[0].key;
  }

  /**
   * Reset all keys (for testing or new day)
   */
  resetAllKeys(): void {
    const today = new Date().toDateString();
    this.alphaVantageKeys.forEach(key => {
      key.dailyUsage = 0;
      key.lastResetDate = today;
      key.isBlocked = false;
      key.blockedUntil = undefined;
    });
    this.saveUsageData();
    console.log('🔄 All API keys reset');
  }

  /**
   * Add a new API key to the rotation
   */
  addNewKey(apiKey: string, name: string): void {
    const newKey: APIKeyInfo = {
      key: apiKey,
      name: name || `Key_${this.alphaVantageKeys.length + 1}`,
      dailyUsage: 0,
      lastResetDate: new Date().toDateString(),
      isBlocked: false,
      maxDailyRequests: 500,
    };

    this.alphaVantageKeys.push(newKey);
    this.saveUsageData();
    console.log(`✅ Added new API key: ${newKey.name}`);
  }

  /**
   * Remove an API key from rotation
   */
  removeKey(keyToRemove: string): boolean {
    const index = this.alphaVantageKeys.findIndex(key => key.key === keyToRemove);
    if (index > -1) {
      const removed = this.alphaVantageKeys.splice(index, 1)[0];
      this.saveUsageData();
      console.log(`🗑️ Removed API key: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * Get a formatted report of current status
   */
  getStatusReport(): string {
    const stats = this.getUsageStatistics();
    const currentKey = this.getCurrentAlphaVantageKey();
    const currentKeyInfo = this.alphaVantageKeys.find(k => k.key === currentKey);

    return `
📊 API Key Rotation Status:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔑 Currently Using: ${currentKeyInfo?.name || 'Unknown'}
📈 Total Keys: ${stats.totalKeys}
✅ Active Keys: ${stats.activeKeys}
📊 Total Requests Today: ${stats.totalRequests}
🎯 Available Requests: ${stats.availableRequests}

📋 Key Details:
${stats.keyDetails.map(key => 
  `${key.isActive ? '✅' : '❌'} ${key.name}: ${key.usage}/${key.limit} (${key.available} left)`
).join('\n')}

💡 Max Daily Capacity: ${stats.totalKeys * 500} requests
📱 Current Utilization: ${((stats.totalRequests / (stats.totalKeys * 500)) * 100).toFixed(1)}%
`;
  }
}

// Export singleton instance
export const apiKeyManager = APIKeyRotationManager.getInstance();

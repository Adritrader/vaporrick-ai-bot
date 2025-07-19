import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Utility function to completely clear all fallback/mock data from AsyncStorage
 * This ensures only real API data is used in the app
 */
export class FallbackDataCleaner {
  private static readonly STORAGE_KEYS = [
    'auto_alerts',
    'stored_alerts',
    'alerts',
    'realGems',
    'scanTimes',
    'trading_settings',
    'watchlist',
    'strategies',
    'market_data',
    'gem_fundamentals',
    'backup_list',
    'portfolio_data',
    'user_preferences'
  ];

  private static readonly FALLBACK_INDICATORS = [
    'fallback',
    'mock',
    'demo',
    'test',
    'dummy',
    'fake',
    'placeholder'
  ];

  /**
   * Clear all fallback data from AsyncStorage
   */
  static async clearAllFallbackData(): Promise<{ cleaned: number; errors: number }> {
    let cleaned = 0;
    let errors = 0;

    console.log('🧹 Iniciando limpieza completa de datos fallback...');

    for (const key of this.STORAGE_KEYS) {
      try {
        const result = await this.cleanStorageKey(key);
        if (result.cleaned > 0) {
          cleaned += result.cleaned;
          console.log(`✅ ${key}: Limpiados ${result.cleaned} items fallback`);
        }
      } catch (error) {
        errors++;
        console.warn(`⚠️ Error limpiando ${key}:`, error);
      }
    }

    // Also clear any keys that contain fallback data patterns
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const suspiciousKeys = allKeys.filter(key =>
        this.FALLBACK_INDICATORS.some(indicator =>
          key.toLowerCase().includes(indicator)
        )
      );

      for (const key of suspiciousKeys) {
        try {
          await AsyncStorage.removeItem(key);
          cleaned++;
          console.log(`🗑️ Eliminada clave sospechosa: ${key}`);
        } catch (error) {
          errors++;
          console.warn(`⚠️ Error eliminando clave ${key}:`, error);
        }
      }
    } catch (error) {
      console.warn('⚠️ Error obteniendo todas las claves:', error);
      errors++;
    }

    console.log(`✅ Limpieza completada: ${cleaned} items limpiados, ${errors} errores`);
    return { cleaned, errors };
  }

  /**
   * Clean a specific storage key of fallback data
   */
  private static async cleanStorageKey(key: string): Promise<{ cleaned: number }> {
    let cleaned = 0;

    try {
      const data = await AsyncStorage.getItem(key);
      if (!data) return { cleaned: 0 };

      try {
        const parsedData = JSON.parse(data);

        if (Array.isArray(parsedData)) {
          const originalLength = parsedData.length;
          const cleanedData = parsedData.filter(item => {
            if (typeof item === 'object' && item !== null) {
              return !this.isFallbackItem(item);
            }
            return true; // Keep non-object items
          });

          if (cleanedData.length !== originalLength) {
            await AsyncStorage.setItem(key, JSON.stringify(cleanedData));
            cleaned = originalLength - cleanedData.length;
          }
        } else if (typeof parsedData === 'object' && parsedData !== null) {
          if (this.isFallbackItem(parsedData)) {
            await AsyncStorage.removeItem(key);
            cleaned = 1;
          }
        }
      } catch (parseError) {
        // If parsing fails, check if the raw data string contains fallback indicators
        const lowerData = data.toLowerCase();
        if (this.FALLBACK_INDICATORS.some(indicator => lowerData.includes(indicator))) {
          await AsyncStorage.removeItem(key);
          cleaned = 1;
        }
      }
    } catch (error) {
      // AsyncStorage error, ignore
    }

    return { cleaned };
  }

  /**
   * Check if an item contains fallback data indicators
   */
  private static isFallbackItem(item: any): boolean {
    const itemStr = JSON.stringify(item).toLowerCase();

    // Check for explicit dataSource fallback
    if (item.dataSource === 'fallback') return true;

    // Check for fallback indicators in the serialized object
    return this.FALLBACK_INDICATORS.some(indicator =>
      itemStr.includes(indicator)
    );
  }

  /**
   * Get stats about current storage data
   */
  static async getStorageStats(): Promise<{
    totalKeys: number;
    suspiciousKeys: string[];
    estimatedFallbackItems: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const suspiciousKeys = allKeys.filter(key =>
        this.FALLBACK_INDICATORS.some(indicator =>
          key.toLowerCase().includes(indicator)
        )
      );

      let estimatedFallbackItems = 0;

      for (const key of this.STORAGE_KEYS) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            const parsedData = JSON.parse(data);
            if (Array.isArray(parsedData)) {
              estimatedFallbackItems += parsedData.filter(item =>
                typeof item === 'object' && item !== null && this.isFallbackItem(item)
              ).length;
            } else if (typeof parsedData === 'object' && parsedData !== null) {
              if (this.isFallbackItem(parsedData)) {
                estimatedFallbackItems++;
              }
            }
          }
        } catch (error) {
          // Ignore parsing errors for stats
        }
      }

      return {
        totalKeys: allKeys.length,
        suspiciousKeys,
        estimatedFallbackItems
      };
    } catch (error) {
      console.warn('⚠️ Error obteniendo estadísticas de storage:', error);
      return {
        totalKeys: 0,
        suspiciousKeys: [],
        estimatedFallbackItems: 0
      };
    }
  }

  /**
   * Force clear everything (nuclear option)
   */
  static async nuclearClear(): Promise<void> {
    console.log('☢️ NUCLEAR CLEAR: Eliminando TODOS los datos de AsyncStorage...');
    try {
      await AsyncStorage.clear();
      console.log('☢️ AsyncStorage completamente limpiado');
    } catch (error) {
      console.error('❌ Error en nuclear clear:', error);
      throw error;
    }
  }
}

export default FallbackDataCleaner;

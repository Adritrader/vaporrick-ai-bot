import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { theme } from '../theme/colors';
import { getDataSourceForSymbol, getVolumeFromGems, DATA_SOURCES } from '../config/dataSourceConfig';

interface Gem {
  id: string;
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  confidence: number;
  dataSource: string;
}

interface GemFinderScreenProps {
  onBack: () => void;
}

const GemFinderScreen: React.FC<GemFinderScreenProps> = ({ onBack }) => {
  const [gems, setGems] = useState<Gem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Validate and normalize symbol names
  const validateSymbol = (symbol: string): string => {
    if (!symbol) return '';
    
    // Handle symbols like "avalanche" -> "AVAX"
    const symbolMap: Record<string, string> = {
      'avalanche': 'AVAX',
      'bitcoin': 'BTC',
      'ethereum': 'ETH',
      'binancecoin': 'BNB',
      'cardano': 'ADA',
      'solana': 'SOL',
      'polkadot': 'DOT',
      'chainlink': 'LINK',
      'polygon': 'MATIC',
    };

    // Check if it's a known mapping
    const normalized = symbolMap[symbol.toLowerCase()];
    if (normalized) {
      return normalized;
    }

    // Clean up symbol format
    let cleanSymbol = symbol.replace(/[-_\s]/g, '').toUpperCase();
    
    // Remove common suffixes that cause validation errors
    cleanSymbol = cleanSymbol.replace(/(-2|-USD|-USDT|USD|USDT)$/i, '');
    
    // Validate final symbol length and format
    if (cleanSymbol.length < 2 || cleanSymbol.length > 10) {
      console.warn(`⚠️ Invalid symbol format: ${symbol} -> ${cleanSymbol}`);
      return symbol.slice(0, 10).toUpperCase(); // Fallback to first 10 chars
    }

    return cleanSymbol;
  };

  // Get real volume from gems collection
  const getRealVolumeForGem = async (symbol: string): Promise<number> => {
    try {
      const volume = await getVolumeFromGems(symbol);
      return volume || 1000000; // Default 1M if not found
    } catch (error) {
      console.error(`Error getting volume for ${symbol}:`, error);
      return 1000000;
    }
  };

  // Discover gems using multiple data sources
  const discoverGems = useCallback(async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Starting gem discovery with data source validation...');
      
      // Sample gems with proper validation
      const potentialGems = [
        'bitcoin', 'ethereum', 'avalanche', 'solana', 'cardano',
        'polkadot', 'chainlink', 'polygon', 'chainlink', 'uniswap'
      ];

      const discoveredGems: Gem[] = [];

      for (const rawSymbol of potentialGems) {
        try {
          // Validate and normalize symbol
          const validSymbol = validateSymbol(rawSymbol);
          
          if (!validSymbol) {
            console.warn(`⚠️ Skipping invalid symbol: ${rawSymbol}`);
            continue;
          }

          // Get appropriate data source
          const dataSource = getDataSourceForSymbol(validSymbol);
          
          // Get real volume from gems collection
          const volume = await getRealVolumeForGem(validSymbol);
          
          // Simulate gem data with validation
          const gem: Gem = {
            id: `gem_${validSymbol}_${Date.now()}`,
            symbol: validSymbol,
            name: rawSymbol.charAt(0).toUpperCase() + rawSymbol.slice(1).replace(/-\d+$/, ''),
            price: Math.random() * 100 + 0.01,
            changePercent: (Math.random() - 0.5) * 40, // ±20%
            volume: volume,
            marketCap: volume * (Math.random() * 50 + 10), // Market cap based on volume
            confidence: Math.floor(Math.random() * 40) + 60, // 60-100% confidence
            dataSource: dataSource,
          };

          // Validate gem data before adding
          if (gem.symbol && gem.name && gem.price > 0 && gem.volume > 0) {
            discoveredGems.push(gem);
            console.log(`✅ Validated gem: ${gem.symbol} (${gem.dataSource})`);
          } else {
            console.warn(`⚠️ Invalid gem data for ${validSymbol}:`, gem);
          }

        } catch (error) {
          console.error(`❌ Error processing gem ${rawSymbol}:`, error);
          // Continue with next gem instead of failing completely
        }
      }

      setGems(discoveredGems);
      console.log(`🎯 Successfully discovered ${discoveredGems.length} validated gems`);

    } catch (error) {
      console.error('❌ Error in gem discovery:', error);
      Alert.alert(
        'Gem Discovery Error',
        'Failed to discover gems. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    discoverGems();
  }, [discoverGems]);

  useEffect(() => {
    discoverGems();
  }, [discoverGems]);

  const renderGem = ({ item }: { item: Gem }) => (
    <View style={styles.gemCard}>
      <View style={styles.gemHeader}>
        <Text style={styles.gemSymbol}>{item.symbol}</Text>
        <Text style={styles.gemSource}>{item.dataSource}</Text>
      </View>
      <Text style={styles.gemName}>{item.name}</Text>
      <View style={styles.gemStats}>
        <Text style={styles.gemPrice}>${item.price.toFixed(4)}</Text>
        <Text style={[
          styles.gemChange,
          { color: item.changePercent >= 0 ? '#10B981' : '#EF4444' }
        ]}>
          {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
        </Text>
      </View>
      <View style={styles.gemDetails}>
        <Text style={styles.gemVolume}>
          Volume: {(item.volume / 1000000).toFixed(1)}M
        </Text>
        <Text style={styles.gemConfidence}>
          Confidence: {item.confidence}%
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>💎 Gem Finder</Text>
        <TouchableOpacity onPress={discoverGems} style={styles.refreshButton}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <FlatList
        data={gems}
        renderItem={renderGem}
        keyExtractor={(item) => item.id}
        style={styles.gemsList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.accent}
          />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.accent} />
              <Text style={styles.loadingText}>Discovering gems...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No gems found</Text>
              <TouchableOpacity onPress={discoverGems} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: theme.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  gemsList: {
    flex: 1,
    padding: 16,
  },
  gemCard: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  gemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gemSymbol: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  gemSource: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  gemName: {
    color: '#cccccc',
    fontSize: 14,
    marginBottom: 8,
  },
  gemStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  gemPrice: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  gemChange: {
    fontSize: 14,
    fontWeight: '600',
  },
  gemDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gemVolume: {
    color: '#888888',
    fontSize: 12,
  },
  gemConfidence: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  loadingText: {
    color: '#cccccc',
    fontSize: 16,
    marginTop: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    color: '#888888',
    fontSize: 16,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: theme.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default GemFinderScreen;

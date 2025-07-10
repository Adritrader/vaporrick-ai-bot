import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTrading } from '../context/TradingContext';
import { integratedDataService } from '../services/integratedDataService';
import { createConservativeAI, createBalancedAI, createAggressiveAI } from '../ai/strategyGenerator';
import { FirebaseStatusIndicator } from '../components/FirebaseStatusIndicator';
import { Asset } from '../context/TradingContext';
import { theme } from '../theme/colors';

const AssetListScreen: React.FC = () => {
  const { state, dispatch } = useTrading();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [aiAnalysisVisible, setAiAnalysisVisible] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));

  useEffect(() => {
    // Animate component entrance
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();

    if (state.assets.length === 0) {
      loadInitialAssets();
    }
  }, []);

  const loadInitialAssets = async () => {
    setLoading(true);
    try {
      const symbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN', 'bitcoin', 'ethereum'];
      console.log('📈 Loading initial portfolio assets...');
      
      const marketData = await integratedDataService.getMarketData(symbols, {
        useFirebase: true,
        maxCacheAgeMinutes: 15,
        fallbackToAPI: true,
        batchSize: 10
      });

      // Convert to Asset format
      const assets: Asset[] = marketData.map(data => ({
        symbol: data.symbol,
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        type: data.type,
        lastUpdate: data.lastUpdated
      }));

      dispatch({ type: 'SET_ASSETS', payload: assets });
      console.log(`✅ Loaded ${assets.length} assets successfully`);
    } catch (error) {
      console.error('❌ Error loading assets:', error);
      Alert.alert(
        'Error',
        'Failed to load market data. Using cached data if available.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  const refreshAssets = useCallback(async () => {
    setRefreshing(true);
    try {
      const symbols = state.assets.map(asset => asset.symbol);
      console.log('🔄 Refreshing portfolio data...');
      
      const marketData = await integratedDataService.getMarketData(symbols, {
        useFirebase: false, // Force fresh data
        maxCacheAgeMinutes: 0,
        fallbackToAPI: true,
        batchSize: 15
      });

      const assets: Asset[] = marketData.map(data => ({
        symbol: data.symbol,
        name: data.name,
        price: data.price,
        change: data.change,
        changePercent: data.changePercent,
        type: data.type,
        lastUpdate: data.lastUpdated
      }));

      dispatch({ type: 'SET_ASSETS', payload: assets });
      console.log(`✅ Refreshed ${assets.length} assets`);
    } catch (error) {
      console.error('❌ Error refreshing assets:', error);
      Alert.alert('Error', 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [state.assets, dispatch]);

  const addAsset = async () => {
    if (!newSymbol.trim()) {
      Alert.alert('Error', 'Please enter a valid symbol');
      return;
    }

    setLoading(true);
    try {
      console.log(`➕ Adding new asset: ${newSymbol.trim()}`);
      
      const marketData = await integratedDataService.getMarketData([newSymbol.trim()], {
        useFirebase: true,
        maxCacheAgeMinutes: 5,
        fallbackToAPI: true,
        batchSize: 1
      });

      if (marketData.length > 0) {
        const asset: Asset = {
          symbol: marketData[0].symbol,
          name: marketData[0].name,
          price: marketData[0].price,
          change: marketData[0].change,
          changePercent: marketData[0].changePercent,
          type: marketData[0].type,
          lastUpdate: marketData[0].lastUpdated
        };

        dispatch({ type: 'ADD_ASSET', payload: asset });
        setNewSymbol('');
        setModalVisible(false);
        console.log(`✅ Added ${asset.symbol} to portfolio`);
      } else {
        Alert.alert('Error', 'Asset not found');
      }
    } catch (error) {
      console.error('❌ Error adding asset:', error);
      Alert.alert('Error', 'Failed to add asset. Please check the symbol and try again.');
    } finally {
      setLoading(false);
    }
  };

  const removeAsset = (symbol: string) => {
    Alert.alert(
      'Remove Asset',
      `Are you sure you want to remove ${symbol}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => dispatch({ type: 'REMOVE_ASSET', payload: symbol }) },
      ]
    );
  };

  const analyzeWithAI = async (asset: Asset) => {
    setSelectedAsset(asset);
    setAiAnalysisVisible(true);
    
    try {
      const aiGenerator = createBalancedAI();
      // Mock historical data - in real app, fetch from API
      const mockHistoricalData = Array.from({ length: 50 }, (_, i) => ({
        date: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
        open: asset.price + Math.random() * 10 - 5,
        high: asset.price + Math.random() * 15,
        low: asset.price - Math.random() * 10,
        close: asset.price + Math.random() * 10 - 5,
        volume: Math.random() * 1000000 + 100000,
      }));
      
      const analysis = await aiGenerator.analyzeMarketCondition(mockHistoricalData);
      setAiAnalysis(analysis);
    } catch (error) {
      console.error('AI analysis error:', error);
      Alert.alert('Error', 'Failed to analyze asset');
    }
  };

  const filteredAssets = state.assets.filter(asset =>
    asset.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    asset.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const renderAsset = ({ item }: { item: Asset }) => (
    <TouchableOpacity
      style={styles.assetCard}
      onPress={() => analyzeWithAI(item)}
      activeOpacity={0.8}
    >
      <View style={styles.assetHeader}>
        <View style={styles.assetInfo}>
          <Text style={styles.assetSymbol}>{item.symbol}</Text>
          <Text style={styles.assetName}>{item.name}</Text>
        </View>
        <View style={styles.assetPrice}>
          <Text style={styles.price}>${item.price.toFixed(2)}</Text>
          <Text style={[
            styles.change,
            { color: item.change >= 0 ? theme.primary : theme.secondary }
          ]}>
            {item.change >= 0 ? '+' : ''}${item.change.toFixed(2)} ({item.changePercent.toFixed(2)}%)
          </Text>
        </View>
      </View>
      
      <View style={styles.assetFooter}>
        <Text style={styles.assetType}>{item.type.toUpperCase()}</Text>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={(e) => {
            e.stopPropagation();
            removeAsset(item.symbol);
          }}
        >
          <Text style={styles.removeButtonText}>Remove</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderAIAnalysis = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={aiAnalysisVisible}
      onRequestClose={() => setAiAnalysisVisible(false)}
    >
      <View style={styles.modalContainer}>
        <LinearGradient
          colors={theme.gradients.card as any}
          style={styles.analysisModal}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Analysis - {selectedAsset?.symbol}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setAiAnalysisVisible(false)}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
          
          {aiAnalysis && (
            <View style={styles.analysisContent}>
              <View style={styles.predictionSection}>
                <Text style={styles.sectionTitle}>Market Prediction</Text>
                <Text style={styles.predictionDirection}>
                  Direction: {aiAnalysis.prediction.direction.toUpperCase()}
                </Text>
                <Text style={styles.predictionConfidence}>
                  Confidence: {(aiAnalysis.prediction.confidence * 100).toFixed(1)}%
                </Text>
                <Text style={styles.expectedReturn}>
                  Expected Return: {aiAnalysis.prediction.expectedReturn.toFixed(2)}%
                </Text>
              </View>
              
              <View style={styles.recommendationSection}>
                <Text style={styles.sectionTitle}>Recommendation</Text>
                <Text style={[
                  styles.action,
                  { color: aiAnalysis.recommendations.action === 'buy' ? theme.primary : 
                           aiAnalysis.recommendations.action === 'sell' ? theme.secondary : theme.warning }
                ]}>
                  {aiAnalysis.recommendations.action.toUpperCase()}
                </Text>
                <Text style={styles.riskLevel}>
                  Risk Level: {(aiAnalysis.recommendations.riskLevel * 100).toFixed(0)}%
                </Text>
                
                <View style={styles.reasoningSection}>
                  <Text style={styles.reasoningTitle}>Reasoning:</Text>
                  {aiAnalysis.recommendations.reasoning.map((reason: string, index: number) => (
                    <Text key={`reason-${index}`} style={styles.reasoningItem}>
                      • {reason}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          )}
        </LinearGradient>
      </View>
    </Modal>
  );

  if (loading && state.assets.length === 0) {
    return (
      <LinearGradient colors={theme.gradients.background as any} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={styles.loadingText}>Loading portfolio...</Text>
          <Text style={styles.loadingSubtext}>Fetching latest market data</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={theme.gradients.background as any} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      
      <Animated.View 
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }]
          }
        ]}
      >
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.title}>Portfolio</Text>
            <Text style={styles.subtitle}>
              {state.assets.length} asset{state.assets.length !== 1 ? 's' : ''} tracked
            </Text>
          </View>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setModalVisible(true)}
          >
            <LinearGradient
              colors={theme.gradients.primary as any}
              style={styles.addButtonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.addButtonText}>+ Add</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <FirebaseStatusIndicator />

        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search assets..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <FlatList
          data={filteredAssets}
          renderItem={renderAsset}
          keyExtractor={(item) => `asset-${item.symbol}`}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refreshAssets}
              colors={[theme.accent]}
              tintColor={theme.accent}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={theme.gradients.card as any}
            style={styles.modalContent}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Asset</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <Text style={styles.inputLabel}>Symbol</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., AAPL, BTC"
                placeholderTextColor={theme.textSecondary}
                value={newSymbol}
                onChangeText={setNewSymbol}
                autoCapitalize="characters"
              />

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.createButton]}
                  onPress={addAsset}
                  disabled={loading}
                >
                  <LinearGradient
                    colors={theme.gradients.primary as any}
                    style={styles.createButtonGradient}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.createButtonText}>Add Asset</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </LinearGradient>
        </View>
      </Modal>

      {renderAIAnalysis()}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 50, // Account for status bar
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  loadingSubtext: {
    marginTop: 8,
    fontSize: 14,
    color: theme.textSecondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    marginBottom: 8,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  addButton: {
    borderRadius: 25,
    overflow: 'hidden',
  },
  addButtonGradient: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: theme.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  assetCard: {
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.shadows.medium,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  assetInfo: {
    flex: 1,
  },
  assetSymbol: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  assetName: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  assetPrice: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  change: {
    fontSize: 14,
    fontWeight: '600',
  },
  assetFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  assetType: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    backgroundColor: theme.surfaceVariant,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    textTransform: 'uppercase',
  },
  removeButton: {
    backgroundColor: theme.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  analysisModal: {
    borderRadius: 20,
    padding: 24,
    width: '95%',
    maxWidth: 500,
    maxHeight: '80%',
    backgroundColor: theme.surface,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: theme.textSecondary,
    fontWeight: '300',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.textPrimary,
    backgroundColor: theme.surface,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.surfaceVariant,
  },
  cancelButtonText: {
    color: theme.textSecondary,
    fontSize: 16,
    fontWeight: '600',
  },
  createButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  createButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  analysisContent: {
    flex: 1,
  },
  predictionSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  predictionDirection: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.accent,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  predictionConfidence: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  expectedReturn: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  recommendationSection: {
    marginBottom: 24,
  },
  action: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  riskLevel: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  reasoningSection: {
    marginTop: 12,
  },
  reasoningTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 12,
  },
  reasoningItem: {
    fontSize: 15,
    color: theme.textSecondary,
    marginBottom: 8,
    lineHeight: 22,
    paddingLeft: 8,
  },
});

export default AssetListScreen;

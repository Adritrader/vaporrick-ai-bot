import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';
import { enhancedAIService, EnhancedPortfolio } from '../services/enhancedAIService';
import { realDataService } from '../services/realDataService';

interface EnhancedPortfolioModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (portfolio: EnhancedPortfolio) => void;
  isGenerating: boolean;
  existingPortfolio?: EnhancedPortfolio;
}

const { width, height } = Dimensions.get('window');

export const EnhancedPortfolioModal: React.FC<EnhancedPortfolioModalProps> = ({
  visible,
  onClose,
  onGenerate,
  isGenerating,
  existingPortfolio,
}) => {
  const [riskProfile, setRiskProfile] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [budget, setBudget] = useState<string>('10000');
  const [portfolio, setPortfolio] = useState<EnhancedPortfolio | null>(existingPortfolio || null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savedPortfolios, setSavedPortfolios] = useState<EnhancedPortfolio[]>([]);
  const [showSavedPortfolios, setShowSavedPortfolios] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSavedPortfolios();
    }
  }, [visible]);

  const loadSavedPortfolios = async () => {
    try {
      const portfolios = await enhancedAIService.getSavedPortfolios();
      setSavedPortfolios(portfolios);
    } catch (error) {
      console.error('Error loading saved portfolios:', error);
    }
  };

  const handleGenerate = async () => {
    const budgetNumber = parseFloat(budget);
    if (isNaN(budgetNumber) || budgetNumber <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }

    setLoading(true);
    try {
      const newPortfolio = await enhancedAIService.generateEnhancedPortfolio(riskProfile, budgetNumber);
      setPortfolio(newPortfolio);
      onGenerate(newPortfolio);
      
      // Refresh saved portfolios
      loadSavedPortfolios();
    } catch (error) {
      Alert.alert('Error', 'Failed to generate portfolio. Please try again.');
      console.error('Portfolio generation error:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadSavedPortfolios();
    setRefreshing(false);
  };

  const handleSavePortfolio = async () => {
    if (!portfolio) return;

    try {
      Alert.alert(
        'Save Portfolio',
        'This portfolio will be saved to your collection.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Save',
            onPress: async () => {
              // Portfolio is already saved when generated
              Alert.alert('Success', 'Portfolio saved successfully!');
              loadSavedPortfolios();
            }
          }
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save portfolio');
    }
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    Alert.alert(
      'Delete Portfolio',
      'Are you sure you want to delete this portfolio?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await enhancedAIService.deletePortfolio(portfolioId);
              loadSavedPortfolios();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete portfolio');
            }
          }
        }
      ]
    );
  };

  const handleLoadPortfolio = (savedPortfolio: EnhancedPortfolio) => {
    setPortfolio(savedPortfolio);
    setBudget(savedPortfolio.budget.toString());
    setRiskProfile(savedPortfolio.riskProfile);
    setShowSavedPortfolios(false);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getRiskColor = (riskScore: number) => {
    if (riskScore < 0.4) return theme.success;
    if (riskScore < 0.7) return theme.warning;
    return theme.error;
  };

  const renderSavedPortfolios = () => (
    <ScrollView style={styles.savedPortfoliosContainer}>
      <Text style={styles.savedPortfoliosTitle}>Saved Portfolios</Text>
      {savedPortfolios.length === 0 ? (
        <Text style={styles.noPortfoliosText}>No saved portfolios yet</Text>
      ) : (
        savedPortfolios.map((savedPortfolio) => (
          <View key={savedPortfolio.id} style={styles.savedPortfolioItem}>
            <TouchableOpacity
              style={styles.savedPortfolioContent}
              onPress={() => handleLoadPortfolio(savedPortfolio)}
            >
              <Text style={styles.savedPortfolioName}>{savedPortfolio.name}</Text>
              <Text style={styles.savedPortfolioDetails}>
                Budget: {formatCurrency(savedPortfolio.budget)} | Risk: {savedPortfolio.riskProfile}
              </Text>
              <Text style={styles.savedPortfolioDate}>
                Created: {new Date(savedPortfolio.createdAt).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDeletePortfolio(savedPortfolio.id)}
            >
              <Text style={styles.deleteButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderPortfolioContent = () => {
    if (!portfolio) return null;

    return (
      <ScrollView 
        style={styles.portfolioContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.primary]} />
        }
      >
        {/* Portfolio Header */}
        <View style={styles.portfolioHeader}>
          <Text style={styles.portfolioName}>{portfolio.name}</Text>
          <Text style={styles.portfolioDescription}>{portfolio.description}</Text>
        </View>

        {/* Portfolio Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Portfolio Metrics</Text>
          <View style={styles.metricsContainer}>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Expected Return</Text>
              <Text style={[styles.metricValue, { color: theme.success }]}>
                {formatPercent(portfolio.metrics.expectedReturn)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Risk Score</Text>
              <Text style={[styles.metricValue, { color: getRiskColor(portfolio.metrics.riskScore) }]}>
                {formatPercent(portfolio.metrics.riskScore)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Sharpe Ratio</Text>
              <Text style={styles.metricValue}>
                {portfolio.metrics.sharpeRatio.toFixed(2)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Max Drawdown</Text>
              <Text style={[styles.metricValue, { color: theme.error }]}>
                {formatPercent(portfolio.metrics.maxDrawdown)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Diversification</Text>
              <Text style={styles.metricValue}>
                {formatPercent(portfolio.metrics.diversificationScore)}
              </Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricLabel}>Volatility</Text>
              <Text style={styles.metricValue}>
                {formatPercent(portfolio.metrics.volatility)}
              </Text>
            </View>
          </View>
        </View>

        {/* Current Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Current Performance</Text>
          <View style={styles.performanceContainer}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Current Value</Text>
              <Text style={styles.performanceValue}>
                {formatCurrency(portfolio.performance.currentValue)}
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Total Return</Text>
              <Text style={[
                styles.performanceValue,
                { color: portfolio.performance.totalReturn >= 0 ? theme.success : theme.error }
              ]}>
                {formatCurrency(portfolio.performance.totalReturn)}
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Return %</Text>
              <Text style={[
                styles.performanceValue,
                { color: portfolio.performance.totalReturnPercent >= 0 ? theme.success : theme.error }
              ]}>
                {formatPercent(portfolio.performance.totalReturnPercent / 100)}
              </Text>
            </View>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceLabel}>Best Performer</Text>
              <Text style={[styles.performanceValue, { color: theme.success }]}>
                {portfolio.performance.bestPerformer}
              </Text>
            </View>
          </View>
        </View>

        {/* Asset Allocation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 Asset Allocation</Text>
          {portfolio.allocation.map((asset, index) => (
            <View key={index} style={styles.assetItem}>
              <View style={styles.assetHeader}>
                <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                <Text style={styles.assetAllocation}>
                  {formatPercent(asset.allocation)}
                </Text>
              </View>
              <View style={styles.assetDetails}>
                <Text style={styles.assetName}>{asset.name}</Text>
                <Text style={styles.assetSector}>{asset.sector}</Text>
              </View>
              <View style={styles.assetMetrics}>
                <View style={styles.assetMetric}>
                  <Text style={styles.assetMetricLabel}>Quantity</Text>
                  <Text style={styles.assetMetricValue}>{asset.quantity.toFixed(4)}</Text>
                </View>
                <View style={styles.assetMetric}>
                  <Text style={styles.assetMetricLabel}>Current Price</Text>
                  <Text style={styles.assetMetricValue}>{formatCurrency(asset.currentPrice)}</Text>
                </View>
                <View style={styles.assetMetric}>
                  <Text style={styles.assetMetricLabel}>Target Price</Text>
                  <Text style={styles.assetMetricValue}>{formatCurrency(asset.targetPrice)}</Text>
                </View>
                <View style={styles.assetMetric}>
                  <Text style={styles.assetMetricLabel}>Expected Return</Text>
                  <Text style={[
                    styles.assetMetricValue,
                    { color: asset.expectedReturn >= 0 ? theme.success : theme.error }
                  ]}>
                    {formatPercent(asset.expectedReturn)}
                  </Text>
                </View>
              </View>
              <View style={styles.allocationBar}>
                <View style={[styles.allocationFill, { width: `${asset.allocation * 100}%` }]} />
              </View>
              <Text style={styles.assetRationale}>{asset.rationale}</Text>
            </View>
          ))}
        </View>

        {/* Rebalancing Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚖️ Rebalancing</Text>
          <View style={styles.rebalancingContainer}>
            <View style={styles.rebalancingItem}>
              <Text style={styles.rebalancingLabel}>Auto Rebalance</Text>
              <Switch
                value={portfolio.rebalancing.autoRebalance}
                onValueChange={async (value) => {
                  const updatedPortfolio = {
                    ...portfolio,
                    rebalancing: {
                      ...portfolio.rebalancing,
                      autoRebalance: value
                    }
                  };
                  setPortfolio(updatedPortfolio);
                  await enhancedAIService.updatePortfolio(portfolio.id, { rebalancing: updatedPortfolio.rebalancing });
                }}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={portfolio.rebalancing.autoRebalance ? theme.primary : theme.textSecondary}
              />
            </View>
            <View style={styles.rebalancingItem}>
              <Text style={styles.rebalancingLabel}>Threshold</Text>
              <Text style={styles.rebalancingValue}>
                {formatPercent(portfolio.rebalancing.threshold)}
              </Text>
            </View>
            <View style={styles.rebalancingItem}>
              <Text style={styles.rebalancingLabel}>Last Rebalance</Text>
              <Text style={styles.rebalancingValue}>
                {new Date(portfolio.rebalancing.lastRebalance).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.rebalancingItem}>
              <Text style={styles.rebalancingLabel}>Next Rebalance</Text>
              <Text style={styles.rebalancingValue}>
                {new Date(portfolio.rebalancing.nextRebalance).toLocaleDateString()}
              </Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSavePortfolio}>
            <Text style={styles.actionButtonText}>💾 Save Portfolio</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleGenerate}>
            <Text style={styles.actionButtonText}>🔄 Regenerate</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>AI Portfolio Generator</Text>
            <View style={styles.headerButtons}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setShowSavedPortfolios(!showSavedPortfolios)}
              >
                <Text style={styles.headerButtonText}>📁</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>

          {showSavedPortfolios ? (
            renderSavedPortfolios()
          ) : (
            <ScrollView style={styles.modalContent}>
              {/* Configuration Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>⚙️ Portfolio Configuration</Text>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Budget ($)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={budget}
                    onChangeText={setBudget}
                    keyboardType="numeric"
                    placeholder="Enter your budget"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Risk Profile</Text>
                  <View style={styles.riskButtons}>
                    {['conservative', 'moderate', 'aggressive'].map((risk) => (
                      <TouchableOpacity
                        key={risk}
                        style={[
                          styles.riskButton,
                          riskProfile === risk && styles.riskButtonActive,
                        ]}
                        onPress={() => setRiskProfile(risk as any)}
                      >
                        <Text style={[
                          styles.riskButtonText,
                          riskProfile === risk && styles.riskButtonTextActive
                        ]}>
                          {risk.charAt(0).toUpperCase() + risk.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.generateButton, (loading || isGenerating) && styles.generateButtonDisabled]}
                  onPress={handleGenerate}
                  disabled={loading || isGenerating}
                >
                  {loading || isGenerating ? (
                    <ActivityIndicator size="small" color={theme.textPrimary} />
                  ) : (
                    <Text style={styles.generateButtonText}>🚀 Generate Portfolio</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Portfolio Content */}
              {portfolio && renderPortfolioContent()}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: width * 0.95,
    maxHeight: height * 0.9,
    backgroundColor: theme.surface,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    marginRight: 10,
  },
  headerButtonText: {
    fontSize: 18,
    color: theme.textPrimary,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
  },
  closeButtonText: {
    fontSize: 24,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 15,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: theme.textPrimary,
    borderWidth: 1,
    borderColor: theme.border,
  },
  riskButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  riskButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: theme.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  riskButtonActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  riskButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  riskButtonTextActive: {
    color: theme.textPrimary,
  },
  generateButton: {
    backgroundColor: theme.primary,
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  generateButtonDisabled: {
    backgroundColor: theme.textSecondary,
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  savedPortfoliosContainer: {
    flex: 1,
    padding: 20,
  },
  savedPortfoliosTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 20,
  },
  noPortfoliosText: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 50,
  },
  savedPortfolioItem: {
    flexDirection: 'row',
    backgroundColor: theme.background,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
  },
  savedPortfolioContent: {
    flex: 1,
    padding: 15,
  },
  savedPortfolioName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 5,
  },
  savedPortfolioDetails: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  savedPortfolioDate: {
    fontSize: 12,
    color: theme.textMuted,
  },
  deleteButton: {
    width: 50,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.error,
  },
  deleteButtonText: {
    fontSize: 24,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  portfolioContent: {
    flex: 1,
  },
  portfolioHeader: {
    marginBottom: 20,
  },
  portfolioName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 5,
  },
  portfolioDescription: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 22,
  },
  metricsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  metricItem: {
    width: '48%',
    marginBottom: 15,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  performanceContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  performanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  performanceLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  performanceValue: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  assetItem: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
  },
  assetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  assetAllocation: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.primary,
  },
  assetDetails: {
    marginBottom: 10,
  },
  assetName: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 2,
  },
  assetSector: {
    fontSize: 12,
    color: theme.textMuted,
  },
  assetMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  assetMetric: {
    width: '48%',
    marginBottom: 5,
  },
  assetMetricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  assetMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  allocationBar: {
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    marginBottom: 10,
    overflow: 'hidden',
  },
  allocationFill: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 2,
  },
  assetRationale: {
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  rebalancingContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  rebalancingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  rebalancingLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  rebalancingValue: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: theme.accent,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';

interface PortfolioModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (riskProfile: string, budget: number) => void;
  isGenerating: boolean;
  generatedPortfolio?: {
    allocation: Array<{
      symbol: string;
      allocation: number;
      rationale: string;
    }>;
    expectedReturn: number;
    riskScore: number;
    sharpeRatio: number;
  };
}

const { width, height } = Dimensions.get('window');

export const PortfolioModal: React.FC<PortfolioModalProps> = ({
  visible,
  onClose,
  onGenerate,
  isGenerating,
  generatedPortfolio,
}) => {
  const [riskProfile, setRiskProfile] = useState<string>('moderate');
  const [budget, setBudget] = useState<string>('10000');

  const handleGenerate = () => {
    const budgetNumber = parseFloat(budget);
    if (isNaN(budgetNumber) || budgetNumber <= 0) {
      Alert.alert('Error', 'Please enter a valid budget amount');
      return;
    }
    onGenerate(riskProfile, budgetNumber);
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

  const getRiskLabel = (riskScore: number) => {
    if (riskScore < 0.4) return 'Low Risk';
    if (riskScore < 0.7) return 'Medium Risk';
    return 'High Risk';
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
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalContent}>
            {/* Configuration Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Portfolio Configuration</Text>
              
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
                  <TouchableOpacity
                    style={[
                      styles.riskButton,
                      riskProfile === 'conservative' && styles.riskButtonActive,
                    ]}
                    onPress={() => setRiskProfile('conservative')}
                  >
                    <Text
                      style={[
                        styles.riskButtonText,
                        riskProfile === 'conservative' && styles.riskButtonTextActive,
                      ]}
                    >
                      Conservative
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.riskButton,
                      riskProfile === 'moderate' && styles.riskButtonActive,
                    ]}
                    onPress={() => setRiskProfile('moderate')}
                  >
                    <Text
                      style={[
                        styles.riskButtonText,
                        riskProfile === 'moderate' && styles.riskButtonTextActive,
                      ]}
                    >
                      Moderate
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.riskButton,
                      riskProfile === 'aggressive' && styles.riskButtonActive,
                    ]}
                    onPress={() => setRiskProfile('aggressive')}
                  >
                    <Text
                      style={[
                        styles.riskButtonText,
                        riskProfile === 'aggressive' && styles.riskButtonTextActive,
                      ]}
                    >
                      Aggressive
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity
                style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
                onPress={handleGenerate}
                disabled={isGenerating}
              >
                <Text style={styles.generateButtonText}>
                  {isGenerating ? 'Generating...' : 'Generate Portfolio'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Generated Portfolio Section */}
            {generatedPortfolio && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Generated Portfolio</Text>
                
                {/* Portfolio Metrics */}
                <View style={styles.metricsContainer}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Expected Return</Text>
                    <Text style={styles.metricValue}>
                      {formatPercent(generatedPortfolio.expectedReturn)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Risk Level</Text>
                    <Text
                      style={[
                        styles.metricValue,
                        { color: getRiskColor(generatedPortfolio.riskScore) },
                      ]}
                    >
                      {getRiskLabel(generatedPortfolio.riskScore)}
                    </Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricLabel}>Sharpe Ratio</Text>
                    <Text style={styles.metricValue}>
                      {generatedPortfolio.sharpeRatio.toFixed(2)}
                    </Text>
                  </View>
                </View>

                {/* Asset Allocation */}
                <Text style={styles.subSectionTitle}>Asset Allocation</Text>
                {generatedPortfolio.allocation.map((asset, index) => (
                  <View key={index} style={styles.assetItem}>
                    <View style={styles.assetHeader}>
                      <Text style={styles.assetSymbol}>{asset.symbol}</Text>
                      <Text style={styles.assetAllocation}>
                        {formatPercent(asset.allocation)}
                      </Text>
                    </View>
                    <View style={styles.assetDetails}>
                      <Text style={styles.assetAmount}>
                        {formatCurrency(parseFloat(budget) * asset.allocation)}
                      </Text>
                      <View style={styles.allocationBar}>
                        <View
                          style={[
                            styles.allocationFill,
                            { width: `${asset.allocation * 100}%` },
                          ]}
                        />
                      </View>
                    </View>
                    <Text style={styles.assetRationale}>{asset.rationale}</Text>
                  </View>
                ))}

                {/* Risk Breakdown */}
                <Text style={styles.subSectionTitle}>Risk Analysis</Text>
                <View style={styles.riskAnalysis}>
                  <View style={styles.riskItem}>
                    <Text style={styles.riskItemLabel}>Overall Risk Score</Text>
                    <View style={styles.riskBar}>
                      <View
                        style={[
                          styles.riskBarFill,
                          {
                            width: `${generatedPortfolio.riskScore * 100}%`,
                            backgroundColor: getRiskColor(generatedPortfolio.riskScore),
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.riskItemValue}>
                      {formatPercent(generatedPortfolio.riskScore)}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Save Portfolio</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionButton}>
                    <Text style={styles.actionButtonText}>Start Trading</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
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
  subSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: 10,
    marginTop: 15,
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
  metricsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  metricLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  assetItem: {
    backgroundColor: theme.background,
    borderRadius: 8,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  assetAllocation: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
  },
  assetDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  allocationBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    marginLeft: 10,
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
  },
  riskAnalysis: {
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  riskItemLabel: {
    fontSize: 14,
    color: theme.textPrimary,
    width: 120,
  },
  riskBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  riskBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  riskItemValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    width: 50,
    textAlign: 'right',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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

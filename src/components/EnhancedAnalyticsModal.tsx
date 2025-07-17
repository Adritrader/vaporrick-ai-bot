import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';
import { enhancedAIService, AIAnalysisResult } from '../services/enhancedAIService';
import { realDataService } from '../services/realDataService';

interface EnhancedAnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  symbol: string;
}

const { width, height } = Dimensions.get('window');

export const EnhancedAnalyticsModal: React.FC<EnhancedAnalyticsModalProps> = ({
  visible,
  onClose,
  symbol,
}) => {
  const [analysis, setAnalysis] = useState<AIAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalysis = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError(null);
    
    try {
      const result = await enhancedAIService.generateAIAnalysis(symbol);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analysis');
      Alert.alert('Error', 'Failed to load AI analysis. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalysis(false);
  };

  useEffect(() => {
    if (visible && symbol) {
      loadAnalysis();
    }
  }, [visible, symbol]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(2)}%`;
  };

  const getRecommendationColor = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy': return theme.success;
      case 'buy': return theme.success;
      case 'hold': return theme.warning;
      case 'sell': return theme.error;
      case 'strong_sell': return theme.error;
      default: return theme.textSecondary;
    }
  };

  const getRecommendationText = (recommendation: string) => {
    switch (recommendation) {
      case 'strong_buy': return 'STRONG BUY';
      case 'buy': return 'BUY';
      case 'hold': return 'HOLD';
      case 'sell': return 'SELL';
      case 'strong_sell': return 'STRONG SELL';
      default: return 'ANALYZING';
    }
  };

  const renderLoadingState = () => (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={styles.loadingText}>Analyzing with AI...</Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={styles.errorContainer}>
      <Text style={styles.errorText}>❌ {error}</Text>
      <TouchableOpacity style={styles.retryButton} onPress={() => loadAnalysis()}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </View>
  );

  const renderAnalysisContent = () => {
    if (!analysis) return null;

    return (
      <ScrollView 
        style={styles.modalContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
          />
        }
      >
        {/* Header with Symbol and Score */}
        <View style={styles.headerSection}>
          <View style={styles.symbolContainer}>
            <Text style={styles.symbol}>{symbol}</Text>
            <Text style={styles.analysisScore}>{analysis.analysis.score.toFixed(1)}/100</Text>
          </View>
          <View style={styles.recommendationContainer}>
            <Text 
              style={[
                styles.recommendation,
                { color: getRecommendationColor(analysis.analysis.recommendation) }
              ]}
            >
              {getRecommendationText(analysis.analysis.recommendation)}
            </Text>
            <Text style={styles.confidence}>
              Confidence: {formatPercent(analysis.analysis.confidence)}
            </Text>
          </View>
        </View>

        {/* Price Prediction */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎯 AI Price Prediction</Text>
          <View style={styles.predictionContainer}>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Target Price</Text>
              <Text style={styles.predictionValue}>
                {formatCurrency(analysis.predictions.prediction.price)}
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Direction</Text>
              <Text 
                style={[
                  styles.predictionValue,
                  { color: analysis.predictions.prediction.direction === 'up' ? theme.success : theme.error }
                ]}
              >
                {analysis.predictions.prediction.direction.toUpperCase()}
              </Text>
            </View>
            <View style={styles.predictionItem}>
              <Text style={styles.predictionLabel}>Timeframe</Text>
              <Text style={styles.predictionValue}>
                {analysis.predictions.prediction.timeframe}
              </Text>
            </View>
          </View>
        </View>

        {/* Technical Indicators */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📊 Technical Indicators</Text>
          <View style={styles.indicatorsGrid}>
            <View style={styles.indicatorItem}>
              <Text style={styles.indicatorLabel}>RSI</Text>
              <Text style={styles.indicatorValue}>
                {analysis.predictions.technicalIndicators.rsi.toFixed(2)}
              </Text>
            </View>
            <View style={styles.indicatorItem}>
              <Text style={styles.indicatorLabel}>MACD</Text>
              <Text style={styles.indicatorValue}>
                {analysis.predictions.technicalIndicators.macd.toFixed(4)}
              </Text>
            </View>
            <View style={styles.indicatorItem}>
              <Text style={styles.indicatorLabel}>Stochastic</Text>
              <Text style={styles.indicatorValue}>
                {analysis.predictions.technicalIndicators.stochastic.toFixed(2)}
              </Text>
            </View>
            <View style={styles.indicatorItem}>
              <Text style={styles.indicatorLabel}>ADX</Text>
              <Text style={styles.indicatorValue}>
                {analysis.predictions.technicalIndicators.adx.toFixed(2)}
              </Text>
            </View>
          </View>
        </View>

        {/* AI Models Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🤖 AI Models Performance</Text>
          <View style={styles.aiModelsContainer}>
            <View style={styles.aiModelItem}>
              <Text style={styles.aiModelLabel}>LSTM</Text>
              <Text style={styles.aiModelValue}>
                {formatPercent(analysis.predictions.aiModels.lstm)}
              </Text>
            </View>
            <View style={styles.aiModelItem}>
              <Text style={styles.aiModelLabel}>Transformer</Text>
              <Text style={styles.aiModelValue}>
                {formatPercent(analysis.predictions.aiModels.transformer)}
              </Text>
            </View>
            <View style={styles.aiModelItem}>
              <Text style={styles.aiModelLabel}>CNN</Text>
              <Text style={styles.aiModelValue}>
                {formatPercent(analysis.predictions.aiModels.cnn)}
              </Text>
            </View>
            <View style={styles.aiModelItem}>
              <Text style={styles.aiModelLabel}>Ensemble</Text>
              <Text style={styles.aiModelValue}>
                {formatPercent(analysis.predictions.aiModels.ensemble)}
              </Text>
            </View>
          </View>
        </View>

        {/* Market Sentiment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>💭 Market Sentiment</Text>
          <View style={styles.sentimentContainer}>
            {Object.entries(analysis.predictions.marketSentiment).map(([key, value]) => (
              <View key={key} style={styles.sentimentItem}>
                <Text style={styles.sentimentLabel}>{key.charAt(0).toUpperCase() + key.slice(1)}</Text>
                <View style={styles.sentimentBarContainer}>
                  <View style={styles.sentimentBar}>
                    <View 
                      style={[
                        styles.sentimentBarFill,
                        { 
                          width: `${value * 100}%`,
                          backgroundColor: value > 0.6 ? theme.success : 
                                           value > 0.4 ? theme.warning : theme.error
                        }
                      ]}
                    />
                  </View>
                  <Text style={styles.sentimentValue}>{formatPercent(value)}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Key Factors */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 Key Factors</Text>
          {analysis.analysis.keyFactors.map((factor, index) => (
            <View key={index} style={styles.factorItem}>
              <Text style={styles.factorBullet}>•</Text>
              <Text style={styles.factorText}>{factor}</Text>
            </View>
          ))}
        </View>

        {/* Risks */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Risks</Text>
          {analysis.analysis.risks.map((risk, index) => (
            <View key={index} style={styles.riskItem}>
              <Text style={styles.riskBullet}>•</Text>
              <Text style={styles.riskText}>{risk}</Text>
            </View>
          ))}
        </View>

        {/* Opportunities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚀 Opportunities</Text>
          {analysis.analysis.opportunities.map((opportunity, index) => (
            <View key={index} style={styles.opportunityItem}>
              <Text style={styles.opportunityBullet}>•</Text>
              <Text style={styles.opportunityText}>{opportunity}</Text>
            </View>
          ))}
        </View>

        {/* Trading Signals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Trading Signals</Text>
          <View style={styles.signalsContainer}>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Entry</Text>
              <Text style={styles.signalValue}>
                {formatCurrency(analysis.predictions.signals.entry)}
              </Text>
            </View>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Exit</Text>
              <Text style={styles.signalValue}>
                {formatCurrency(analysis.predictions.signals.exit)}
              </Text>
            </View>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Stop Loss</Text>
              <Text style={[styles.signalValue, { color: theme.error }]}>
                {formatCurrency(analysis.predictions.signals.stopLoss)}
              </Text>
            </View>
            <View style={styles.signalItem}>
              <Text style={styles.signalLabel}>Take Profit</Text>
              <Text style={[styles.signalValue, { color: theme.success }]}>
                {formatCurrency(analysis.predictions.signals.takeProfit)}
              </Text>
            </View>
          </View>
        </View>

        {/* Risk Assessment */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎲 Risk Assessment</Text>
          <View style={styles.riskAssessmentContainer}>
            <View style={styles.riskMetricItem}>
              <Text style={styles.riskMetricLabel}>Risk Level</Text>
              <Text 
                style={[
                  styles.riskMetricValue,
                  { color: analysis.predictions.riskAssessment.riskLevel === 'high' ? theme.error : 
                           analysis.predictions.riskAssessment.riskLevel === 'medium' ? theme.warning : theme.success }
                ]}
              >
                {analysis.predictions.riskAssessment.riskLevel.toUpperCase()}
              </Text>
            </View>
            <View style={styles.riskMetricItem}>
              <Text style={styles.riskMetricLabel}>Risk Score</Text>
              <Text style={styles.riskMetricValue}>
                {formatPercent(analysis.predictions.riskAssessment.riskScore)}
              </Text>
            </View>
            <View style={styles.riskMetricItem}>
              <Text style={styles.riskMetricLabel}>Max Drawdown</Text>
              <Text style={styles.riskMetricValue}>
                {formatPercent(analysis.predictions.riskAssessment.maxDrawdown)}
              </Text>
            </View>
            <View style={styles.riskMetricItem}>
              <Text style={styles.riskMetricLabel}>Volatility</Text>
              <Text style={styles.riskMetricValue}>
                {formatPercent(analysis.predictions.riskAssessment.volatility)}
              </Text>
            </View>
          </View>
        </View>

        {/* Analysis Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📋 Analysis Details</Text>
          <View style={styles.analysisDetailsContainer}>
            <Text style={styles.analysisDetail}>
              <Text style={styles.analysisDetailLabel}>Fundamentals:</Text> {analysis.predictions.analysis.fundamentals}
            </Text>
            <Text style={styles.analysisDetail}>
              <Text style={styles.analysisDetailLabel}>Technicals:</Text> {analysis.predictions.analysis.technicals}
            </Text>
            <Text style={styles.analysisDetail}>
              <Text style={styles.analysisDetailLabel}>Market Conditions:</Text> {analysis.predictions.analysis.marketConditions}
            </Text>
            <Text style={styles.analysisDetail}>
              <Text style={styles.analysisDetailLabel}>Volume Analysis:</Text> {analysis.predictions.analysis.volumeAnalysis}
            </Text>
          </View>
        </View>

        {/* Timestamp */}
        <View style={styles.timestampContainer}>
          <Text style={styles.timestampText}>
            Generated: {new Date(analysis.timestamp).toLocaleString()}
          </Text>
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
            <Text style={styles.modalTitle}>AI Analysis - {symbol}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </LinearGradient>

          {loading ? renderLoadingState() : error ? renderErrorState() : renderAnalysisContent()}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    color: theme.textSecondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    color: theme.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  headerSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  symbolContainer: {
    alignItems: 'flex-start',
  },
  symbol: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  analysisScore: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.primary,
  },
  recommendationContainer: {
    alignItems: 'flex-end',
  },
  recommendation: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  confidence: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
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
  predictionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  predictionItem: {
    alignItems: 'center',
    flex: 1,
  },
  predictionLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  predictionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  indicatorItem: {
    width: '48%',
    backgroundColor: theme.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  indicatorValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  aiModelsContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  aiModelItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  aiModelLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  aiModelValue: {
    fontSize: 16,
    color: theme.primary,
    fontWeight: 'bold',
  },
  sentimentContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  sentimentItem: {
    marginBottom: 15,
  },
  sentimentLabel: {
    fontSize: 14,
    color: theme.textPrimary,
    marginBottom: 5,
  },
  sentimentBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sentimentBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    marginRight: 10,
  },
  sentimentBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  sentimentValue: {
    fontSize: 12,
    color: theme.textSecondary,
    width: 50,
    textAlign: 'right',
  },
  factorItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  factorBullet: {
    fontSize: 16,
    color: theme.success,
    marginRight: 8,
    marginTop: 2,
  },
  factorText: {
    fontSize: 14,
    color: theme.textPrimary,
    flex: 1,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  riskBullet: {
    fontSize: 16,
    color: theme.error,
    marginRight: 8,
    marginTop: 2,
  },
  riskText: {
    fontSize: 14,
    color: theme.textPrimary,
    flex: 1,
  },
  opportunityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  opportunityBullet: {
    fontSize: 16,
    color: theme.primary,
    marginRight: 8,
    marginTop: 2,
  },
  opportunityText: {
    fontSize: 14,
    color: theme.textPrimary,
    flex: 1,
  },
  signalsContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  signalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  signalLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  signalValue: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  riskAssessmentContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  riskMetricItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  riskMetricLabel: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  riskMetricValue: {
    fontSize: 16,
    color: theme.textPrimary,
    fontWeight: 'bold',
  },
  analysisDetailsContainer: {
    backgroundColor: theme.background,
    borderRadius: 12,
    padding: 15,
  },
  analysisDetail: {
    fontSize: 14,
    color: theme.textPrimary,
    marginBottom: 10,
    lineHeight: 20,
  },
  analysisDetailLabel: {
    fontWeight: 'bold',
    color: theme.primary,
  },
  timestampContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    alignItems: 'center',
  },
  timestampText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
});

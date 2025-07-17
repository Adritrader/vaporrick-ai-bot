import React from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';

interface AnalyticsModalProps {
  visible: boolean;
  onClose: () => void;
  data: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap: number;
    technicalIndicators: {
      rsi: number;
      macd: number;
      stochastic: number;
      bollinger: {
        upper: number;
        middle: number;
        lower: number;
      };
    };
    predictions: {
      price: number;
      confidence: number;
      direction: 'up' | 'down' | 'sideways';
    };
    sentiment: {
      overall: number;
      social: number;
      news: number;
      analyst: number;
    };
  };
}

const { width, height } = Dimensions.get('window');

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({
  visible,
  onClose,
  data,
}) => {
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

  const getSentimentColor = (value: number) => {
    if (value > 0.6) return theme.success;
    if (value > 0.4) return theme.warning;
    return theme.error;
  };

  const getIndicatorStatus = (indicator: string, value: number) => {
    switch (indicator) {
      case 'rsi':
        if (value > 70) return { status: 'Overbought', color: theme.error };
        if (value < 30) return { status: 'Oversold', color: theme.success };
        return { status: 'Neutral', color: theme.textSecondary };
      case 'macd':
        return {
          status: value > 0 ? 'Bullish' : 'Bearish',
          color: value > 0 ? theme.success : theme.error,
        };
      case 'stochastic':
        if (value > 80) return { status: 'Overbought', color: theme.error };
        if (value < 20) return { status: 'Oversold', color: theme.success };
        return { status: 'Neutral', color: theme.textSecondary };
      default:
        return { status: 'N/A', color: theme.textSecondary };
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={[theme.primary, theme.secondary]}
            style={styles.modalHeader}
          >
            <Text style={styles.modalTitle}>Advanced Analytics</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>
          </LinearGradient>

          <ScrollView style={styles.modalContent}>
            {/* Price Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price Information</Text>
              <View style={styles.priceRow}>
                <Text style={styles.symbol}>{data.symbol}</Text>
                <Text style={styles.price}>{formatCurrency(data.price)}</Text>
              </View>
              <View style={styles.changeRow}>
                <Text
                  style={[
                    styles.change,
                    { color: data.change >= 0 ? theme.success : theme.error },
                  ]}
                >
                  {data.change >= 0 ? '+' : ''}{formatCurrency(data.change)}
                </Text>
                <Text
                  style={[
                    styles.changePercent,
                    { color: data.changePercent >= 0 ? theme.success : theme.error },
                  ]}
                >
                  ({data.changePercent >= 0 ? '+' : ''}{formatPercent(data.changePercent)})
                </Text>
              </View>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Volume</Text>
                  <Text style={styles.statValue}>{data.volume.toLocaleString()}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Market Cap</Text>
                  <Text style={styles.statValue}>{formatCurrency(data.marketCap)}</Text>
                </View>
              </View>
            </View>

            {/* Technical Indicators */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Technical Indicators</Text>
              
              <View style={styles.indicatorRow}>
                <Text style={styles.indicatorLabel}>RSI</Text>
                <View style={styles.indicatorValue}>
                  <Text style={styles.indicatorNumber}>{data.technicalIndicators.rsi.toFixed(2)}</Text>
                  <Text
                    style={[
                      styles.indicatorStatus,
                      { color: getIndicatorStatus('rsi', data.technicalIndicators.rsi).color },
                    ]}
                  >
                    {getIndicatorStatus('rsi', data.technicalIndicators.rsi).status}
                  </Text>
                </View>
              </View>

              <View style={styles.indicatorRow}>
                <Text style={styles.indicatorLabel}>MACD</Text>
                <View style={styles.indicatorValue}>
                  <Text style={styles.indicatorNumber}>{data.technicalIndicators.macd.toFixed(4)}</Text>
                  <Text
                    style={[
                      styles.indicatorStatus,
                      { color: getIndicatorStatus('macd', data.technicalIndicators.macd).color },
                    ]}
                  >
                    {getIndicatorStatus('macd', data.technicalIndicators.macd).status}
                  </Text>
                </View>
              </View>

              <View style={styles.indicatorRow}>
                <Text style={styles.indicatorLabel}>Stochastic</Text>
                <View style={styles.indicatorValue}>
                  <Text style={styles.indicatorNumber}>{data.technicalIndicators.stochastic.toFixed(2)}</Text>
                  <Text
                    style={[
                      styles.indicatorStatus,
                      { color: getIndicatorStatus('stochastic', data.technicalIndicators.stochastic).color },
                    ]}
                  >
                    {getIndicatorStatus('stochastic', data.technicalIndicators.stochastic).status}
                  </Text>
                </View>
              </View>

              <View style={styles.bollingerSection}>
                <Text style={styles.indicatorLabel}>Bollinger Bands</Text>
                <View style={styles.bollingerBands}>
                  <View style={styles.bandRow}>
                    <Text style={styles.bandLabel}>Upper:</Text>
                    <Text style={styles.bandValue}>{formatCurrency(data.technicalIndicators.bollinger.upper)}</Text>
                  </View>
                  <View style={styles.bandRow}>
                    <Text style={styles.bandLabel}>Middle:</Text>
                    <Text style={styles.bandValue}>{formatCurrency(data.technicalIndicators.bollinger.middle)}</Text>
                  </View>
                  <View style={styles.bandRow}>
                    <Text style={styles.bandLabel}>Lower:</Text>
                    <Text style={styles.bandValue}>{formatCurrency(data.technicalIndicators.bollinger.lower)}</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* AI Predictions */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>AI Predictions</Text>
              <View style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>Predicted Price</Text>
                <Text style={styles.predictionValue}>{formatCurrency(data.predictions.price)}</Text>
              </View>
              <View style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>Confidence</Text>
                <Text style={styles.predictionValue}>{formatPercent(data.predictions.confidence)}</Text>
              </View>
              <View style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>Direction</Text>
                <Text
                  style={[
                    styles.predictionValue,
                    {
                      color:
                        data.predictions.direction === 'up'
                          ? theme.success
                          : data.predictions.direction === 'down'
                          ? theme.error
                          : theme.warning,
                    },
                  ]}
                >
                  {data.predictions.direction.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Sentiment Analysis */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Sentiment Analysis</Text>
              
              <View style={styles.sentimentRow}>
                <Text style={styles.sentimentLabel}>Overall</Text>
                <View style={styles.sentimentBar}>
                  <View
                    style={[
                      styles.sentimentFill,
                      {
                        width: `${data.sentiment.overall * 100}%`,
                        backgroundColor: getSentimentColor(data.sentiment.overall),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sentimentValue}>{formatPercent(data.sentiment.overall)}</Text>
              </View>

              <View style={styles.sentimentRow}>
                <Text style={styles.sentimentLabel}>Social</Text>
                <View style={styles.sentimentBar}>
                  <View
                    style={[
                      styles.sentimentFill,
                      {
                        width: `${data.sentiment.social * 100}%`,
                        backgroundColor: getSentimentColor(data.sentiment.social),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sentimentValue}>{formatPercent(data.sentiment.social)}</Text>
              </View>

              <View style={styles.sentimentRow}>
                <Text style={styles.sentimentLabel}>News</Text>
                <View style={styles.sentimentBar}>
                  <View
                    style={[
                      styles.sentimentFill,
                      {
                        width: `${data.sentiment.news * 100}%`,
                        backgroundColor: getSentimentColor(data.sentiment.news),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sentimentValue}>{formatPercent(data.sentiment.news)}</Text>
              </View>

              <View style={styles.sentimentRow}>
                <Text style={styles.sentimentLabel}>Analyst</Text>
                <View style={styles.sentimentBar}>
                  <View
                    style={[
                      styles.sentimentFill,
                      {
                        width: `${data.sentiment.analyst * 100}%`,
                        backgroundColor: getSentimentColor(data.sentiment.analyst),
                      },
                    ]}
                  />
                </View>
                <Text style={styles.sentimentValue}>{formatPercent(data.sentiment.analyst)}</Text>
              </View>
            </View>
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
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  symbol: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  price: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  changeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 15,
  },
  change: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 10,
  },
  changePercent: {
    fontSize: 16,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 5,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  indicatorLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
  },
  indicatorValue: {
    alignItems: 'flex-end',
  },
  indicatorNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  indicatorStatus: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  bollingerSection: {
    marginTop: 10,
  },
  bollingerBands: {
    backgroundColor: theme.background,
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  bandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bandLabel: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  bandValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
  },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  predictionLabel: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  predictionValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  sentimentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  sentimentLabel: {
    fontSize: 14,
    color: theme.textPrimary,
    width: 80,
  },
  sentimentBar: {
    flex: 1,
    height: 8,
    backgroundColor: theme.border,
    borderRadius: 4,
    marginHorizontal: 15,
    overflow: 'hidden',
  },
  sentimentFill: {
    height: '100%',
    borderRadius: 4,
  },
  sentimentValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    width: 60,
    textAlign: 'right',
  },
});

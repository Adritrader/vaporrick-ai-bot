import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  TextInput,
  Switch,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useTrading } from '../context/TradingContext';
import { Alert as AlertType } from '../context/TradingContext';
import { marketAnalyzer, MarketOpportunity, MarketScanResults } from '../ai/marketAnalyzer';
import * as Notifications from 'expo-notifications';

const AlertsScreen: React.FC = () => {
  const { state, dispatch } = useTrading();
  const [modalVisible, setModalVisible] = useState(false);
  const [newAlert, setNewAlert] = useState({
    assetSymbol: '',
    condition: 'price_above',
    value: '',
  });
  const [scanResults, setScanResults] = useState<MarketScanResults | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'opportunities' | 'alerts'>('opportunities');

  useEffect(() => {
    setupNotifications();
    performInitialScan();
  }, []);

  const performInitialScan = async () => {
    setIsScanning(true);
    try {
      const results = await marketAnalyzer.scanMarket();
      setScanResults(results);
    } catch (error) {
      console.error('Error in initial market scan:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const results = await marketAnalyzer.scanMarket();
      setScanResults(results);
    } catch (error) {
      console.error('Error refreshing market data:', error);
      Alert.alert('Error', 'Failed to refresh market data');
    } finally {
      setRefreshing(false);
    }
  };

  const setupNotifications = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please enable notifications for price alerts');
      return;
    }

    // Configure notification handler
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  };

  const createAlert = () => {
    if (!newAlert.assetSymbol.trim() || !newAlert.value.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    const alert: AlertType = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // More unique ID
      assetSymbol: newAlert.assetSymbol.toUpperCase(),
      condition: newAlert.condition,
      value: parseFloat(newAlert.value),
      isActive: true,
      createdAt: new Date(),
    };

    dispatch({ type: 'ADD_ALERT', payload: alert });
    setModalVisible(false);
    setNewAlert({ assetSymbol: '', condition: 'price_above', value: '' });
  };

  const toggleAlert = (alert: AlertType) => {
    const updatedAlert = { ...alert, isActive: !alert.isActive };
    dispatch({ type: 'UPDATE_ALERT', payload: updatedAlert });
  };

  const deleteAlert = (alertId: string) => {
    Alert.alert(
      'Delete Alert',
      'Are you sure you want to delete this alert?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => dispatch({ type: 'DELETE_ALERT', payload: alertId }) },
      ]
    );
  };

  const getConditionText = (condition: string) => {
    switch (condition) {
      case 'price_above': return 'Price Above';
      case 'price_below': return 'Price Below';
      case 'change_above': return 'Change Above';
      case 'change_below': return 'Change Below';
      case 'volume_above': return 'Volume Above';
      default: return condition;
    }
  };

  const getConditionColor = (condition: string) => {
    switch (condition) {
      case 'price_above':
      case 'change_above':
      case 'volume_above':
        return '#4caf50';
      case 'price_below':
      case 'change_below':
        return '#f44336';
      default:
        return '#666';
    }
  };

  const getOpportunityColor = (opportunity: string) => {
    switch (opportunity) {
      case 'bullish':
      case 'breakout':
        return '#4CAF50';
      case 'bearish':
        return '#F44336';
      case 'reversal':
        return '#FF9800';
      default:
        return '#757575';
    }
  };

  const getOpportunityIcon = (opportunity: string) => {
    switch (opportunity) {
      case 'bullish':
        return '📈';
      case 'bearish':
        return '📉';
      case 'breakout':
        return '🚀';
      case 'reversal':
        return '🔄';
      default:
        return '📊';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return '#4CAF50';
      case 'bearish':
        return '#F44336';
      default:
        return '#FF9800';
    }
  };

  const renderAlert = ({ item }: { item: AlertType }) => (
    <View style={[styles.alertCard, !item.isActive && styles.inactiveAlert]}>
      <View style={styles.alertHeader}>
        <View style={styles.alertInfo}>
          <Text style={styles.alertSymbol}>{item.assetSymbol}</Text>
          <Text style={[styles.alertCondition, { color: getConditionColor(item.condition) }]}>
            {getConditionText(item.condition)} {item.value}
            {item.condition.includes('change') ? '%' : ''}
          </Text>
        </View>
        <Switch
          value={item.isActive}
          onValueChange={() => toggleAlert(item)}
          trackColor={{ false: '#767577', true: '#81b0ff' }}
          thumbColor={item.isActive ? '#007AFF' : '#f4f3f4'}
        />
      </View>
      
      <View style={styles.alertFooter}>
        <Text style={styles.alertDate}>
          Created: {item.createdAt.toLocaleDateString()}
        </Text>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => deleteAlert(item.id)}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAlertsTab = () => (
    <View style={styles.tabContent}>
      <FlatList
        data={state.alerts}
        keyExtractor={(item) => item.id}
        renderItem={renderAlert}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No alerts created yet</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
              <Text style={styles.addButtonText}>Create First Alert</Text>
            </TouchableOpacity>
          </View>
        }
        style={styles.alertsList}
        contentContainerStyle={styles.listContainer}
      />
    </View>
  );

  const renderOpportunityCard = ({ item }: { item: MarketOpportunity }) => (
    <TouchableOpacity style={styles.opportunityCard}>
      <View style={styles.opportunityHeader}>
        <View style={styles.symbolContainer}>
          <Text style={styles.symbolText}>{item.symbol}</Text>
          <Text style={styles.assetType}>{item.assetType.toUpperCase()}</Text>
        </View>
        <View style={styles.confidenceContainer}>
          <Text style={styles.confidenceText}>{item.confidence}%</Text>
          <Text style={styles.confidenceLabel}>Confidence</Text>
        </View>
      </View>

      <View style={styles.opportunityBody}>
        <View style={styles.predictionContainer}>
          <Text style={styles.opportunityIcon}>{getOpportunityIcon(item.opportunity)}</Text>
          <Text style={[styles.opportunityType, { color: getOpportunityColor(item.opportunity) }]}>
            {item.opportunity.toUpperCase()}
          </Text>
          <Text style={[styles.predictedChange, { color: getOpportunityColor(item.opportunity) }]}>
            {item.predictedChange > 0 ? '+' : ''}{item.predictedChange}%
          </Text>
        </View>
        
        <Text style={styles.timeframe}>Expected in {item.timeframe}</Text>
        <Text style={styles.analysis}>{item.analysis}</Text>
      </View>

      <View style={styles.indicatorsContainer}>
        <Text style={styles.indicatorsTitle}>Technical Indicators:</Text>
        <View style={styles.indicatorsGrid}>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>RSI</Text>
            <Text style={[styles.indicatorValue, { 
              color: item.indicators.rsi > 70 ? '#F44336' : item.indicators.rsi < 30 ? '#4CAF50' : '#666' 
            }]}
            >
              {item.indicators.rsi.toFixed(1)}
            </Text>
          </View>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>MACD</Text>
            <Text style={[styles.indicatorValue, { color: item.indicators.macd > 0 ? '#4CAF50' : '#F44336' }]}>
              {item.indicators.macd.toFixed(3)}
            </Text>
          </View>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>Support</Text>
            <Text style={styles.indicatorValue}>${item.indicators.support.toFixed(2)}</Text>
          </View>
          <View style={styles.indicatorItem}>
            <Text style={styles.indicatorLabel}>Resistance</Text>
            <Text style={styles.indicatorValue}>${item.indicators.resistance.toFixed(2)}</Text>
          </View>
        </View>
      </View>

      <View style={styles.reasoningContainer}>
        <Text style={styles.reasoningTitle}>AI Analysis:</Text>
        {item.reasoning.slice(0, 3).map((reason, index) => (
          <Text key={index} style={styles.reasoningText}>• {reason}</Text>
        ))}
      </View>

      <View style={styles.expirationContainer}>
        <Text style={styles.expirationText}>
          Expires: {item.expiresAt.toLocaleDateString()}
        </Text>
        <TouchableOpacity
          style={styles.createAlertButton}
          onPress={() => createAlertFromOpportunity(item)}
        >
          <Text style={styles.createAlertButtonText}>Create Alert</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderTopMover = ({ item }: { item: { symbol: string; change: number; analysis: string } }) => (
    <View style={styles.topMoverCard}>
      <View style={styles.topMoverHeader}>
        <Text style={styles.topMoverSymbol}>{item.symbol}</Text>
        <Text style={[styles.topMoverChange, { color: item.change > 0 ? '#4CAF50' : '#F44336' }]}>
          {item.change > 0 ? '+' : ''}{item.change.toFixed(2)}%
        </Text>
      </View>
      <Text style={styles.topMoverAnalysis}>{item.analysis}</Text>
    </View>
  );

  const createAlertFromOpportunity = (opportunity: MarketOpportunity) => {
    const alertValue = opportunity.opportunity === 'bearish' 
      ? opportunity.indicators.support 
      : opportunity.indicators.resistance;
    
    const alertCondition = opportunity.opportunity === 'bearish' ? 'price_below' : 'price_above';
    
    const alert: AlertType = {
      id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      assetSymbol: opportunity.symbol,
      condition: alertCondition,
      value: alertValue,
      isActive: true,
      createdAt: new Date(),
    };

    dispatch({ type: 'ADD_ALERT', payload: alert });
    Alert.alert(
      'Alert Created',
      `Created ${alertCondition.replace('_', ' ')} alert for ${opportunity.symbol} at $${alertValue.toFixed(2)}`
    );
  };

  const renderMarketOverview = () => {
    if (!scanResults) return null;

    return (
      <View style={styles.marketOverview}>
        <View style={styles.overviewHeader}>
          <Text style={styles.overviewTitle}>Market Overview</Text>
          <Text style={styles.scanTime}>
            Last scan: {scanResults.scanTime.toLocaleTimeString()}
          </Text>
        </View>
        
        <View style={styles.sentimentContainer}>
          <Text style={styles.sentimentLabel}>Market Sentiment:</Text>
          <View style={[styles.sentimentBadge, { backgroundColor: getSentimentColor(scanResults.marketSentiment) }]}>
            <Text style={styles.sentimentText}>
              {scanResults.marketSentiment.toUpperCase()}
            </Text>
          </View>
        </View>

        {scanResults.topMovers.length > 0 && (
          <View style={styles.topMoversSection}>
            <Text style={styles.sectionTitle}>Top Movers</Text>
            <FlatList
              data={scanResults.topMovers}
              renderItem={renderTopMover}
              keyExtractor={(item, index) => `${item.symbol}-${index}`}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.topMoversList}
            />
          </View>
        )}
      </View>
    );
  };

  const renderOpportunitiesTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          colors={['#007AFF']}
        />
      }
    >
      {renderMarketOverview()}
      
      <View style={styles.opportunitiesSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>AI-Detected Opportunities</Text>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.scanButtonText}>🔍 Scan</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {isScanning ? (
          <View style={styles.scanningContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.scanningText}>Scanning market for opportunities...</Text>
          </View>
        ) : scanResults && scanResults.opportunities.length > 0 ? (
          <FlatList
            data={scanResults.opportunities}
            renderItem={renderOpportunityCard}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
          />
        ) : (
          <View style={styles.noOpportunitiesContainer}>
            <Text style={styles.noOpportunitiesText}>
              No high-confidence opportunities found at the moment.
            </Text>
            <Text style={styles.noOpportunitiesSubtext}>
              Pull down to refresh or wait for next automatic scan.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Smart Alerts</Text>
        <Text style={styles.subtitle}>AI-powered market opportunities and alerts</Text>
        
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'opportunities' && styles.activeTab]}
            onPress={() => setSelectedTab('opportunities')}
          >
            <Text style={[styles.tabText, selectedTab === 'opportunities' && styles.activeTabText]}>
              🔍 Opportunities
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'alerts' && styles.activeTab]}
            onPress={() => setSelectedTab('alerts')}
          >
            <Text style={[styles.tabText, selectedTab === 'alerts' && styles.activeTabText]}>
              🔔 My Alerts
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {selectedTab === 'opportunities' ? renderOpportunitiesTab() : (
        <ScrollView style={styles.tabContent}>
          {state.alerts.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No alerts created yet</Text>
              <Text style={styles.emptySubtext}>Create alerts to get notified about price changes</Text>
              <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.addButtonText}>Create First Alert</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={state.alerts}
              renderItem={renderAlert}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContainer}
              showsVerticalScrollIndicator={false}
              scrollEnabled={false}
            />
          )}
        </ScrollView>
      )}

      {selectedTab === 'alerts' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setModalVisible(true)}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Alert</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContainer}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Asset Symbol</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., AAPL, BTC"
                  value={newAlert.assetSymbol}
                  onChangeText={(text) => setNewAlert({ ...newAlert, assetSymbol: text })}
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Condition</Text>
                <View style={styles.conditionContainer}>
                  {[
                    { key: 'price_above', label: 'Price Above' },
                    { key: 'price_below', label: 'Price Below' },
                    { key: 'change_above', label: 'Change Above %' },
                    { key: 'change_below', label: 'Change Below %' },
                  ].map((condition) => (
                    <TouchableOpacity
                      key={condition.key}
                      style={[
                        styles.conditionOption,
                        newAlert.condition === condition.key && styles.selectedCondition
                      ]}
                      onPress={() => setNewAlert({ ...newAlert, condition: condition.key })}
                    >
                      <Text style={[
                        styles.conditionOptionText,
                        newAlert.condition === condition.key && styles.selectedConditionText
                      ]}>
                        {condition.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Value</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter value"
                  value={newAlert.value}
                  onChangeText={(text) => setNewAlert({ ...newAlert, value: text })}
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.createButton]}
                  onPress={createAlert}
                >
                  <Text style={styles.createButtonText}>Create Alert</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#007AFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
  },
  alertCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inactiveAlert: {
    opacity: 0.6,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertInfo: {
    flex: 1,
  },
  alertSymbol: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  alertCondition: {
    fontSize: 14,
    fontWeight: '600',
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertDate: {
    fontSize: 12,
    color: '#666',
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  deleteButtonText: {
    color: '#f44336',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: '#666',
  },
  formContainer: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  conditionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  selectedCondition: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  conditionOptionText: {
    fontSize: 14,
    color: '#666',
  },
  selectedConditionText: {
    color: '#fff',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f5f5f5',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#007AFF',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  marketOverview: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  overviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  overviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  scanTime: {
    fontSize: 14,
    color: '#666',
  },
  sentimentContainer: {
    marginBottom: 16,
  },
  sentimentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sentimentBadge: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  sentimentText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#fff',
  },
  topMoversSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  topMoversList: {
    paddingVertical: 8,
  },
  scanningContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  scanningText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  noOpportunitiesContainer: {
    padding: 40,
    alignItems: 'center',
  },
  noOpportunitiesText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  noOpportunitiesSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  opportunityCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  opportunityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  symbolContainer: {
    flex: 1,
  },
  symbolText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  assetType: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  confidenceContainer: {
    alignItems: 'flex-end',
  },
  confidenceText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  confidenceLabel: {
    fontSize: 12,
    color: '#666',
  },
  opportunityBody: {
    marginBottom: 12,
  },
  predictionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  opportunityIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  opportunityType: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  predictedChange: {
    fontSize: 16,
    fontWeight: '600',
  },
  timeframe: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  analysis: {
    fontSize: 14,
    color: '#333',
  },
  indicatorsContainer: {
    marginBottom: 12,
  },
  indicatorsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  indicatorsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  indicatorItem: {
    flex: 1,
    minWidth: 80,
    alignItems: 'center',
  },
  indicatorLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  indicatorValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  reasoningContainer: {
    marginBottom: 12,
  },
  reasoningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reasoningText: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  expirationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 12,
  },
  expirationText: {
    fontSize: 12,
    color: '#666',
  },
  createAlertButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  createAlertButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
  },
  opportunitiesSection: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  scanButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  scanButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  topMoverCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
    minWidth: 150,
  },
  topMoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  topMoverSymbol: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  topMoverChange: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  topMoverAnalysis: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  alertsList: {
    flex: 1,
  },
});

export default AlertsScreen;

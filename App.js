import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  Modal,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { TradingProvider } from './src/context/TradingContext';
import { testAPIConfiguration, getDataSourceStatus } from './src/services/apiTestService';
import ErrorBoundary from './src/components/ErrorBoundary';
import HomeScreen from './src/screens/HomeScreen';
import GemFinderScreen from './src/screens/GemFinderScreenNew';
import StrategyScreenNewEnhanced from './src/screens/StrategyScreenNewEnhanced_Simple';
import TradingScreenNew from './src/screens/TradingScreenNew';
import PortfolioScreen from './src/screens/DashboardScreen';
import DocumentationScreen from './src/screens/DocumentationScreen';
import BacktestScreen from './src/screens/BacktestScreen';
import AlertScreen from './src/screens/AlertScreen';
// import { AlertService } from './src/services/alertService';
import { theme } from './src/theme/colors';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('home');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [dataSourceStatus, setDataSourceStatus] = useState(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    // Initialize notification and background services
    const initializeServices = async () => {
      try {
        // Test API configuration and data sources
        console.log('🚀 Testing API configuration...');
        const status = getDataSourceStatus();
        setDataSourceStatus(status);
        
        if (status.overallStatus === 'Production Ready') {
          console.log('✅ Using real market data!');
        } else {
          console.log('⚠️ Some APIs need configuration');
        }
        
        // Temporarily disabled for Expo Go compatibility
        // await AlertService.setupNotifications();
        // await AlertService.registerBackgroundFetch();
        console.log('App initialized');
      } catch (error) {
        console.error('Failed to initialize services:', error);
      }
    };

    // Animate app entrance
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

    initializeServices();
  }, []);

  // Error handler for error boundary
  const handleGlobalError = (error, errorInfo) => {
    console.error('Global error caught:', error);
    console.error('Error info:', errorInfo);
    
    // In production, send to crash reporting service
    if (!__DEV__) {
      // TODO: Send to Sentry/Crashlytics
      // Sentry.captureException(error, { extra: errorInfo });
    }
  };

  const navigateToScreen = (screen) => {
    setCurrentScreen(screen);
  };

  const goBack = () => {
    setCurrentScreen('home');
  };

  const getScreenTitle = (screen) => {
    const titles = {
      'gemfinder': '💎 Gem Finder',
      'strategies': '🧠 AI Strategies',
      'trading': '⚡ Live Trading',
      'portfolio': '📊 Portfolio',
      'backtest': '📈 Backtesting',
      'alerts': '🔔 Smart Alerts',
      'analysis': '🔍 Market Analysis',
      'documentation': '📚 Documentation',
    };
    return titles[screen] || 'VaporRick AI Bot';
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'home':
        return <HomeScreen onNavigate={navigateToScreen} onShowSettings={() => setShowSettingsMenu(true)} />;
      case 'gemfinder':
        return <GemFinderScreen />;
      case 'strategies':
        return <StrategyScreenNewEnhanced />;
      case 'trading':
        return <TradingScreenNew />;
      case 'portfolio':
        return <PortfolioScreen />;
      case 'backtesting':
        return <BacktestScreen />;
      case 'alerts':
        return <AlertScreen />;
      case 'documentation':
        return <DocumentationScreen />;
      default:
        return <HomeScreen onNavigate={navigateToScreen} onShowSettings={() => setShowSettingsMenu(true)} />;
    }
  };

  const handleSettingsOption = (option) => {
    setShowSettingsMenu(false);
    
    switch (option) {
      case 'exchanges':
        // Open exchange integrations
        Alert.alert(
          '🏦 Exchange Integrations',
          'Connect your trading accounts:\n\n• Binance\n• Coinbase Pro\n• Kraken\n• Bybit\n\nFeature coming soon!',
          [{ text: 'OK' }]
        );
        break;
      case 'metamask':
        // Connect MetaMask
        Alert.alert(
          '🦊 MetaMask Integration',
          'Connect your MetaMask wallet for DeFi trading and portfolio tracking.\n\nFeature coming soon!',
          [{ text: 'OK' }]
        );
        break;
      case 'walletconnect':
        // Connect WalletConnect
        Alert.alert(
          '📱 WalletConnect',
          'Connect any compatible wallet:\n\n• Trust Wallet\n• Rainbow\n• Argent\n• And more...\n\nFeature coming soon!',
          [{ text: 'OK' }]
        );
        break;
      case 'notifications':
        // Notification settings
        Alert.alert(
          '🔔 Notification Settings',
          'Configure alerts for:\n\n• Trade executions\n• Price alerts\n• Strategy signals\n• Portfolio changes',
          [{ text: 'OK' }]
        );
        break;
      case 'api':
        // API settings
        Alert.alert(
          '🔑 API Configuration',
          'Configure external APIs:\n\n• Alpha Vantage\n• CoinGecko\n• Yahoo Finance\n• Custom endpoints',
          [{ text: 'OK' }]
        );
        break;
      case 'documentation':
        // Open documentation
        setShowSettingsMenu(false);
        setCurrentScreen('documentation');
        break;
      case 'support':
        // Open support
        Linking.openURL('mailto:support@yourapp.com');
        break;
      case 'about':
        // Show about
        Alert.alert(
          'ℹ️ VectorFlux AI Bot v1.0',
          '🤖 Ecosistema de IA para predicción de mercados financieros\n\n' +
          '🔬 TECNOLOGÍAS IMPLEMENTADAS:\n' +
          '• Redes Neuronales Profundas (DNNs)\n' +
          '• LSTM para series temporales\n' +
          '• Análisis de sentimiento NLP\n' +
          '• Modelos ensemble avanzados\n' +
          '• 20+ indicadores técnicos\n' +
          '• Evaluación de riesgo en tiempo real\n\n' +
          '🎯 CAPACIDADES:\n' +
          '• Predicción de precios con IA\n' +
          '• Auto-trading inteligente\n' +
          '• Análisis técnico avanzado\n' +
          '• Detección de patrones\n' +
          '• Gestión de riesgo automática\n\n' +
          '💰 100% GRATUITO usando TensorFlow.js\n' +
          'by VectorFlux AI Team',
          [{ text: 'Impresionante!' }]
        );
        break;
      default:
        break;
    }
  };

  const renderSettingsMenu = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showSettingsMenu}
      onRequestClose={() => setShowSettingsMenu(false)}
    >
      <TouchableOpacity 
        style={styles.settingsOverlay}
        activeOpacity={1}
        onPress={() => setShowSettingsMenu(false)}
      >
        <View style={styles.settingsMenu}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.settingsGradient}
          >
            <Text style={styles.settingsTitle}>⚙️ Settings & Connectivity</Text>
            
            <ScrollView showsVerticalScrollIndicator={false}>
              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('exchanges')}
              >
                <Text style={styles.settingsIcon}>🏦</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>Exchange Integrations</Text>
                  <Text style={styles.settingsOptionSubtitle}>Connect Binance, Coinbase, Kraken, etc.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('metamask')}
              >
                <Text style={styles.settingsIcon}>🦊</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>MetaMask Integration</Text>
                  <Text style={styles.settingsOptionSubtitle}>Connect your MetaMask wallet</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('walletconnect')}
              >
                <Text style={styles.settingsIcon}>📱</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>WalletConnect</Text>
                  <Text style={styles.settingsOptionSubtitle}>Connect any compatible wallet</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('notifications')}
              >
                <Text style={styles.settingsIcon}>🔔</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>Notifications</Text>
                  <Text style={styles.settingsOptionSubtitle}>Configure alerts & notifications</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('api')}
              >
                <Text style={styles.settingsIcon}>🔑</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>API Configuration</Text>
                  <Text style={styles.settingsOptionSubtitle}>External data sources & APIs</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('documentation')}
              >
                <Text style={styles.settingsIcon}>📚</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>Documentation</Text>
                  <Text style={styles.settingsOptionSubtitle}>User guide & API docs</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('support')}
              >
                <Text style={styles.settingsIcon}>💬</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>Support</Text>
                  <Text style={styles.settingsOptionSubtitle}>Get help & feedback</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.settingsOption}
                onPress={() => handleSettingsOption('about')}
              >
                <Text style={styles.settingsIcon}>ℹ️</Text>
                <View style={styles.settingsTextContainer}>
                  <Text style={styles.settingsOptionTitle}>About</Text>
                  <Text style={styles.settingsOptionSubtitle}>VaporRick AI Bot v1.0</Text>
                </View>
              </TouchableOpacity>
            </ScrollView>
          </LinearGradient>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <ErrorBoundary onError={handleGlobalError}>
      <TradingProvider>
        <LinearGradient
          colors={theme.gradients.background}
          style={styles.container}
        >
          <StatusBar 
            barStyle="light-content" 
            backgroundColor={theme.background} 
            translucent={false}
          />
          
          {/* Compact Global Header */}
          {currentScreen !== 'home' && (
            <ErrorBoundary fallback={
              <View style={styles.headerError}>
                <Text style={styles.headerErrorText}>Header Error</Text>
              </View>
            }>
              <View style={styles.globalHeader}>
                <LinearGradient
                  colors={[theme.surface, theme.surfaceVariant]}
                  style={styles.headerGradient}
                >
                  <View style={styles.headerContent}>
                    <TouchableOpacity
                      style={styles.backButton}
                      onPress={goBack}
                    >
                      <Text style={styles.backButtonText}>← Home</Text>
                    </TouchableOpacity>
                    <View style={styles.headerCenterContainer}>
                      <Text style={styles.headerTitle}>
                        {getScreenTitle(currentScreen)}
                      </Text>
                      {dataSourceStatus && (
                        <View style={styles.dataStatusIndicator}>
                          <Text style={[
                            styles.dataStatusText,
                            { color: dataSourceStatus.overallStatus === 'Production Ready' ? theme.success : theme.warning }
                          ]}>
                            {dataSourceStatus.overallStatus === 'Production Ready' ? '🔴 REAL' : '⚠️ CONFIG'}
                          </Text>
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.headerSettingsButton}
                      onPress={() => setShowSettingsMenu(true)}
                    >
                      <LinearGradient
                        colors={['rgba(0, 230, 118, 0.2)', 'rgba(33, 150, 243, 0.2)']}
                        style={styles.headerSettingsGradient}
                      >
                        <Text style={styles.headerSettingsIcon}>⚙️</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              </View>
            </ErrorBoundary>
          )}

          <Animated.View 
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            <ErrorBoundary 
              fallback={
                <View style={styles.screenError}>
                  <Text style={styles.screenErrorText}>Screen Error</Text>
                  <TouchableOpacity onPress={goBack} style={styles.goBackButton}>
                    <Text style={styles.goBackText}>← Go Back</Text>
                  </TouchableOpacity>
                </View>
              }
            >
              {renderScreen()}
            </ErrorBoundary>
          </Animated.View>

          {renderSettingsMenu()}
        </LinearGradient>
      </TradingProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  globalHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xs,
  },
  headerGradient: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    ...theme.shadows.small,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: 'rgba(0, 230, 118, 0.2)',
  },
  backButtonText: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  headerCenterContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dataStatusIndicator: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    backgroundColor: theme.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  dataStatusText: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSettingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    ...theme.shadows.small,
  },
  headerSettingsGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSettingsIcon: {
    fontSize: 18,
    color: theme.textPrimary,
  },
  content: {
    flex: 1,
    marginTop: theme.spacing.xs,
  },
  settingsOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  settingsMenu: {
    width: '90%',
    maxWidth: 400,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.large,
  },
  settingsGradient: {
    padding: theme.spacing.lg,
  },
  settingsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  settingsOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
    backgroundColor: theme.surface,
    ...theme.shadows.small,
  },
  settingsIcon: {
    fontSize: 18,
    marginRight: theme.spacing.sm,
    color: theme.primary,
  },
  settingsTextContainer: {
    flex: 1,
  },
  settingsOptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  settingsOptionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
  },
  // Error boundary styles
  headerError: {
    backgroundColor: theme.error,
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  headerErrorText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  screenError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  screenErrorText: {
    fontSize: 18,
    color: theme.textSecondary,
    marginBottom: theme.spacing.lg,
    textAlign: 'center',
  },
  goBackButton: {
    backgroundColor: theme.primary,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  goBackText: {
    color: theme.background,
    fontSize: 16,
    fontWeight: '600',
  },
});

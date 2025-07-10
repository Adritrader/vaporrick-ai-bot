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
import GemFinderScreen from './src/screens/GemFinderScreenNew';
import StrategyScreen from './src/screens/StrategyScreenNewEnhanced';
import TradingScreen from './src/screens/TradingScreenNew';
import DashboardScreen from './src/screens/DashboardScreen';
import DocumentationScreen from './src/screens/DocumentationScreen';
// import { AlertService } from './src/services/alertService';
import { theme } from './src/theme/colors';

export default function App() {
  const [activeTab, setActiveTab] = useState('trading');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showDocumentation, setShowDocumentation] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(50))[0];

  useEffect(() => {
    // Initialize notification and background services
    const initializeServices = async () => {
      try {
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

  const renderScreen = () => {
    if (showDocumentation) {
      return <DocumentationScreen />;
    }
    
    switch (activeTab) {
      case 'gemfinder':
        return <GemFinderScreen />;
      case 'strategies':
        return <StrategyScreen />;
      case 'portfolio':
        return <DashboardScreen />;
      case 'trading':
        return <TradingScreen />;
      default:
        return <TradingScreen />;
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
        setShowDocumentation(true);
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

  const TabButton = ({ title, tabKey, icon, gradient, activeIcon }) => {
    const isActive = activeTab === tabKey;
    
    return (
      <TouchableOpacity
        style={[styles.tabButton, isActive && styles.activeTabButton]}
        onPress={() => setActiveTab(tabKey)}
        activeOpacity={0.8}
      >
        {isActive && (
          <LinearGradient
            colors={gradient}
            style={styles.activeTabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          />
        )}
        <Text style={[styles.tabIcon, isActive && styles.activeTabIcon]}>
          {isActive ? activeIcon : icon}
        </Text>
        <Text style={[styles.tabTitle, isActive && styles.activeTabTitle]}>
          {title}
        </Text>
        {isActive && <View style={styles.activeIndicator} />}
      </TouchableOpacity>
    );
  };

  return (
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
        
        {/* Global Header with Settings Button */}
        <View style={styles.globalHeader}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              {showDocumentation && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => setShowDocumentation(false)}
                >
                  <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
              )}
              <Text style={styles.headerTitle}>VaporRick AI Bot</Text>
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

        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {renderScreen()}
        </Animated.View>

        {!showDocumentation && (
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.tabBar}
          >
            <TabButton 
              title="Gems" 
              tabKey="gemfinder" 
              icon="💎" 
              activeIcon="🔍"
              gradient={theme.gradients.primary}
            />
            <TabButton 
              title="Info" 
              tabKey="portfolio" 
              icon="📊" 
              activeIcon="📈"
              gradient={theme.gradients.primary}
            />
            <TabButton 
              title="AI" 
              tabKey="strategies" 
              icon="🤖" 
              activeIcon="🧠"
              gradient={theme.gradients.primary}
            />
            <TabButton 
              title="Trading" 
              tabKey="trading" 
              icon="⚡" 
              activeIcon="🚀"
              gradient={theme.gradients.success}
            />
          </LinearGradient>
        )}

        {renderSettingsMenu()}
      </LinearGradient>
    </TradingProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  globalHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
  },
  headerGradient: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
  },
  backButton: {
    position: 'absolute',
    left: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'rgba(0, 230, 118, 0.2)',
  },
  backButtonText: {
    color: theme.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSettingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    ...theme.shadows.small,
  },
  headerSettingsGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerSettingsIcon: {
    fontSize: 16,
    color: theme.textPrimary,
  },
  content: {
    flex: 1,
    marginTop: theme.spacing.sm,
  },
  tabBar: {
    flexDirection: 'row',
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm,
    borderTopLeftRadius: theme.borderRadius.xl,
    borderTopRightRadius: theme.borderRadius.xl,
    ...theme.shadows.large,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    marginHorizontal: theme.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
  },
  activeTabButton: {
    transform: [{ scale: 1.02 }],
  },
  activeTabGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: theme.borderRadius.lg,
    opacity: 0.15,
  },
  tabIcon: {
    fontSize: 14,
    marginBottom: 1,
    color: theme.textMuted,
  },
  activeTabIcon: {
    color: theme.primary,
    textShadowColor: 'rgba(0, 230, 118, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tabTitle: {
    fontSize: 9,
    fontWeight: '500',
    color: theme.textMuted,
    textAlign: 'center',
    lineHeight: 12,
  },
  activeTabTitle: {
    color: theme.textPrimary,
    fontWeight: '600',
  },
  activeIndicator: {
    position: 'absolute',
    top: 4,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    backgroundColor: theme.primary,
    borderRadius: 2,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
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
});

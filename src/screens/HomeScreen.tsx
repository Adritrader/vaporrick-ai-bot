import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';

const { width, height } = Dimensions.get('window');

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
  onShowSettings?: () => void;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate, onShowSettings }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scaleAnim] = useState(new Animated.Value(0.8));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const menuItems = [
    {
      id: 'gemfinder',
      title: 'Gem Finder',
      subtitle: 'Descubre gemas cripto',
      icon: '💎',
      gradient: ['#FF6B6B', '#FF8E8E'],
      description: 'IA para encontrar criptomonedas con alto potencial'
    },
    {
      id: 'strategies',
      title: 'AI Strategies',
      subtitle: 'Estrategias inteligentes',
      icon: '🧠',
      gradient: ['#4ECDC4', '#44A08D'],
      description: 'Estrategias de trading potenciadas por IA'
    },
    {
      id: 'trading',
      title: 'Live Trading',
      subtitle: 'Trading en vivo',
      icon: '⚡',
      gradient: ['#FFD93D', '#FF6B6B'],
      description: 'Ejecuta trades con señales en tiempo real'
    },
    {
      id: 'portfolio',
      title: 'Portfolio',
      subtitle: 'Dashboard & Analytics',
      icon: '📊',
      gradient: ['#A8E6CF', '#7FCDCD'],
      description: 'Analiza tu portfolio y rendimiento'
    },
    {
      id: 'backtest',
      title: 'Backtesting',
      subtitle: 'Prueba estrategias',
      icon: '📈',
      gradient: ['#B8A9C9', '#622569'],
      description: 'Simula estrategias con datos históricos'
    },
    {
      id: 'alerts',
      title: 'Smart Alerts',
      subtitle: 'Alertas inteligentes',
      icon: '🔔',
      gradient: ['#F093FB', '#F5576C'],
      description: 'Notificaciones personalizadas con IA'
    },
    {
      id: 'analysis',
      title: 'Market Analysis',
      subtitle: 'Análisis de mercado',
      icon: '🔍',
      gradient: ['#4FACFE', '#00F2FE'],
      description: 'Análisis profundo del mercado con IA'
    },
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'Configuración',
      icon: '⚙️',
      gradient: ['#667eea', '#764ba2'],
      description: 'Configuración y conectividad'
    },
  ];

  const MenuCard = ({ item, index }: { item: any; index: number }) => {
    const [cardScale] = useState(new Animated.Value(1));

    const handlePressIn = () => {
      Animated.spring(cardScale, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(cardScale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View
        style={[
          styles.menuCard,
          {
            transform: [{ scale: cardScale }],
            opacity: fadeAnim,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.menuCardTouch}
          onPress={() => onNavigate(item.id)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
        >
          <LinearGradient
            colors={item.gradient}
            style={styles.menuCardGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.menuCardContent}>
              <Text style={styles.menuCardIcon}>{item.icon}</Text>
              <Text style={styles.menuCardTitle}>{item.title}</Text>
              <Text style={styles.menuCardSubtitle}>{item.subtitle}</Text>
              <Text style={styles.menuCardDescription}>{item.description}</Text>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const getCurrentTime = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Buenos días';
    if (hour < 18) return '☀️ Buenas tardes';
    return '🌙 Buenas noches';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.gradient}
      >
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        
        {/* Compact Header with Settings */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={[theme.surface + 'DD', theme.surfaceVariant + 'AA']}
            style={styles.headerGradient}
          >
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={styles.greeting}>{getGreeting()}</Text>
                <Text style={styles.tagline}>🤖 Tu asistente de trading inteligente</Text>
              </View>
              <TouchableOpacity 
                style={styles.settingsButton}
                onPress={() => onShowSettings?.()}
              >
                <View style={styles.headerRight}>
                  <Text style={styles.timeText}>{getCurrentTime()}</Text>
                  <View style={styles.statusIndicator}>
                    <View style={styles.statusDot} />
                    <Text style={styles.statusText}>⚙️ Settings</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Menu Grid */}
        <ScrollView 
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.menuGrid}>
            {menuItems.map((item, index) => (
              <MenuCard key={item.id} item={item} index={index} />
            ))}
          </View>

          {/* Quick Stats */}
          <Animated.View 
            style={[
              styles.quickStats,
              {
                opacity: fadeAnim,
                transform: [{ translateY: Animated.multiply(scaleAnim, 50) }],
              },
            ]}
          >
            <LinearGradient
              colors={[theme.surface + 'DD', theme.surfaceVariant + 'AA']}
              style={styles.statsGradient}
            >
              <Text style={styles.statsTitle}>📊 Estado del Sistema</Text>
              <View style={styles.statsGrid}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>🟢</Text>
                  <Text style={styles.statLabel}>AI Models</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>🟢</Text>
                  <Text style={styles.statLabel}>Market Data</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>🟢</Text>
                  <Text style={styles.statLabel}>Strategies</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>🟡</Text>
                  <Text style={styles.statLabel}>Exchanges</Text>
                </View>
              </View>
            </LinearGradient>
          </Animated.View>
        </ScrollView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.md,
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
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  settingsButton: {
    // TouchableOpacity wrapper for settings
  },
  greeting: {
    fontSize: 16,
    color: theme.textSecondary,
    marginBottom: 2,
    fontWeight: '600',
  },
  tagline: {
    fontSize: 12,
    color: theme.textSecondary,
    opacity: 0.8,
  },
  timeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 4,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.1)',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.success,
    marginRight: 4,
  },
  statusText: {
    fontSize: 13,
    color: theme.success,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing.xl,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: theme.spacing.md,
    gap: theme.spacing.md,
  },
  menuCard: {
    width: (width - theme.spacing.md * 3) / 2,
    height: 140, // Fixed height for all cards
    marginBottom: theme.spacing.xs,
  },
  menuCardTouch: {
    flex: 1,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    ...theme.shadows.medium,
  },
  menuCardGradient: {
    flex: 1,
    padding: theme.spacing.md,
    justifyContent: 'center',
  },
  menuCardContent: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  menuCardIcon: {
    fontSize: 28,
    marginBottom: theme.spacing.xs,
  },
  menuCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 2,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  menuCardSubtitle: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  menuCardDescription: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 12,
    textShadowColor: 'rgba(0,0,0,0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  quickStats: {
    marginHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  statsGradient: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    ...theme.shadows.medium,
  },
  statsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
});

export default HomeScreen;

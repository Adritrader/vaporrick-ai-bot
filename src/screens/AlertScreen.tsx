import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Switch,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';
import { autoAlertService, AutoAlert } from '../services/autoAlertService';

interface AlertScreenProps {
  onBack: () => void;
}

const AlertScreen: React.FC<AlertScreenProps> = ({ onBack }) => {
  const [alerts, setAlerts] = useState<AutoAlert[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'critical' | 'high' | 'medium' | 'low'>('all');
  const [scanProgress, setScanProgress] = useState(0);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanTime, setLastScanTime] = useState<Date | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [scanCooldown, setScanCooldown] = useState(0);
  const progressAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    initializeAlertService();
    
    // Cooldown timer
    const cooldownInterval = setInterval(() => {
      setScanCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => {
      clearInterval(cooldownInterval);
    };
  }, []);

  const initializeAlertService = async () => {
    setIsLoading(true);
    try {
      console.log('🧠 Inicializando VectorFlux AI Alert Service...');
      
      // Solo cargar alertas existentes (NO hacer escaneo automático)
      await autoAlertService.loadAlerts();
      
      // Obtener alertas actuales
      const currentAlerts = autoAlertService.getActiveAlerts();
      setAlerts(currentAlerts);
      setLastSyncTime(new Date());
      
      // Configurar auto-scan si está habilitado (pero NO ejecutar inmediatamente)
      if (autoScanEnabled) {
        autoAlertService.startAutoScan(30);
        console.log('⏰ Auto-scan configurado cada 30 minutos (no ejecutándose inmediatamente)');
      }
      
      console.log(`📱 Servicio iniciado con ${currentAlerts.length} alertas existentes`);
      
    } catch (error) {
      console.error('❌ Error inicializando VectorFlux AI:', error);
      Alert.alert('Error AI', 'No se pudo inicializar VectorFlux AI. Verifica tu configuración.');
    } finally {
      setIsLoading(false);
    }
  };

  const performScan = async () => {
    if (isScanning || scanCooldown > 0) {
      Alert.alert(
        '⏰ Espera un momento', 
        scanCooldown > 0 
          ? `Puedes escanear nuevamente en ${scanCooldown} segundos`
          : 'Ya hay un escaneo en progreso'
      );
      return;
    }

    try {
      setIsScanning(true);
      setIsLoading(true);
      setScanProgress(0);
      
      console.log('� Iniciando VectorFlux AI scan con datos reales...');
      
      // Simular progreso del escaneo
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          const newProgress = prev + Math.random() * 10; // Progreso más lento para AI
          return newProgress > 85 ? 85 : newProgress;
        });
      }, 500); // Intervalo más lento para AI processing
      
      // Animar barra de progreso
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 4000, // Más tiempo para AI processing
        useNativeDriver: false,
      }).start();
      
      // Use scanForAlerts which now uses VectorFlux AI with real data
      const newAlerts = await autoAlertService.scanForAlerts();
      
      // Completar progreso
      clearInterval(progressInterval);
      setScanProgress(100);
      
      const allAlerts = autoAlertService.getActiveAlerts();
      setAlerts(allAlerts);
      setLastScanTime(new Date());
      
      if (newAlerts.length > 0) {
        const aiAlerts = newAlerts.filter(a => a.strategy.includes('VectorFlux') || a.strategy.includes('AI') || a.strategy.includes('Neural') || a.strategy.includes('Learning'));
        const cryptoAlerts = newAlerts.filter(a => ['BTC', 'ETH', 'ADA', 'SOL', 'AVAX', 'LINK', 'DOT', 'BNB', 'bitcoin', 'ethereum'].includes(a.symbol));
        const stockAlerts = newAlerts.filter(a => ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'NVDA', 'META', 'AMZN', 'NFLX', 'AMD', 'BABA'].includes(a.symbol));
        
        Alert.alert(
          '🧠 VectorFlux AI - Nuevas Señales!', 
          `${newAlerts.length} nuevas alertas AI encontradas:\n• ${cryptoAlerts.length} Crypto\n• ${stockAlerts.length} Stocks\n• ${aiAlerts.length} AI Models`,
          [{ text: 'Ver Alertas' }]
        );
      } else {
        Alert.alert(
          '🤖 VectorFlux AI - Escaneo Completo', 
          'No se encontraron oportunidades de alta confianza en este momento. Los modelos AI seguirán monitoreando.',
          [{ text: 'OK' }]
        );
      }
      
      // Cooldown más largo para AI (60 segundos)
      setScanCooldown(60);
      
    } catch (error) {
      console.error('❌ Error en VectorFlux AI scan:', error);
      Alert.alert('Error AI', 'Error en el análisis de VectorFlux AI. Verifica tu conexión y tokens de API.');
    } finally {
      setIsScanning(false);
      setIsLoading(false);
      setScanProgress(0);
      progressAnim.setValue(0);
    }
  };

  const reloadAlertsFromFirebase = async () => {
    try {
      console.log('📥 Recargando alertas desde Firebase...');
      await autoAlertService.loadAlerts();
      const updatedAlerts = autoAlertService.getActiveAlerts();
      setAlerts(updatedAlerts);
      setLastSyncTime(new Date());
      console.log(`✅ ${updatedAlerts.length} alertas cargadas y sincronizadas`);
    } catch (error) {
      console.error('❌ Error recargando alertas:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Primero intentar recargar desde Firebase
    await reloadAlertsFromFirebase();
    
    // Luego hacer un nuevo escaneo si es necesario
    if (scanCooldown === 0) {
      await performScan();
    }
    
    setRefreshing(false);
  };

  const toggleAutoScan = (enabled: boolean) => {
    setAutoScanEnabled(enabled);
    if (enabled) {
      autoAlertService.startAutoScan(30); // 30 minutos para AI scanning
      Alert.alert('🧠 VectorFlux AI Auto-Scan Activado', 'Los modelos AI escanearan el mercado cada 30 minutos con datos reales');
    } else {
      autoAlertService.stopAutoScan();
      Alert.alert('⏸️ VectorFlux AI Pausado', 'El escaneo automático de AI se ha pausado');
    }
  };

  const dismissAlert = (alertId: string) => {
    Alert.alert(
      'Descartar Alerta',
      '¿Marcar esta alerta como vista?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Descartar', 
          onPress: () => {
            autoAlertService.deactivateAlert(alertId);
            setAlerts(autoAlertService.getActiveAlerts());
          }
        }
      ]
    );
  };

  // Filtro por prioridad y por tipo de señal (buy/sell/watch)
  const [signalFilter, setSignalFilter] = useState<'all' | 'buy' | 'sell' | 'watch'>('all');
  const getFilteredAlerts = (): AutoAlert[] => {
    let filtered = selectedFilter === 'all'
      ? alerts
      : autoAlertService.getAlertsByPriority(selectedFilter);
    // Filtrar señales donde targetPrice == currentPrice
    filtered = filtered.filter(a => a.targetPrice == null || a.targetPrice !== a.currentPrice);
    // Filtro por tipo de señal
    if (signalFilter !== 'all') {
      filtered = filtered.filter(a => a.signal === signalFilter);
    }
    return filtered;
  } 

  const getAlertTypeIcon = (type: AutoAlert['type']) => {
    switch (type) {
      case 'breakout': return '🚀';
      case 'reversal': return '🔄';
      case 'momentum': return '📈';
      case 'volume_spike': return '📊';
      case 'ai_signal': return '🤖';
      case 'gem_discovery': return '💎';
      default: return '🔔';
    }
  };

  const getSignalColor = (signal: AutoAlert['signal']) => {
    switch (signal) {
      case 'buy': return theme.success;
      case 'sell': return theme.error;
      case 'watch': return theme.warning;
      default: return theme.textSecondary;
    }
  };

  const getPriorityColor = (priority: AutoAlert['priority']) => {
    switch (priority) {
      case 'critical': return theme.error;
      case 'high': return '#FF6B35';
      case 'medium': return theme.warning;
      case 'low': return theme.textMuted;
      default: return theme.textSecondary;
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  // Badge visual para dataSource mejorado
  const getDataSourceBadge = (source: string) => {
    let color = theme.textMuted;
    let label = source;
    let icon = '�';
    if (source === 'coingecko') { color = '#5c9e31'; label = 'CoinGecko'; icon = '🦎'; }
    else if (source === 'alphavantage') { color = '#2e86de'; label = 'AlphaVantage'; icon = '📊'; }
    else if (source === 'yahoo') { color = '#6001d2'; label = 'Yahoo'; icon = '🟣'; }
    else if (source === 'fallback') { color = theme.textMuted; label = 'Desconocido'; icon = '❔'; }
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color + '22', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8, borderWidth: 1, borderColor: color }}>
        <Text style={{ fontSize: 14, marginRight: 4 }}>{icon}</Text>
        <Text style={{ fontSize: 11, color, fontWeight: 'bold' }}>{label}</Text>
      </View>
    );
  };

  // Cálculo mejorado del plazo (timeframe) en la UI
  const getTimeframe = (item: AutoAlert) => {
    // Si el alert tiene timeframe explícito, úsalo
    if (item.timeframe && typeof item.timeframe === 'string') return item.timeframe;
    // Si hay targetPrice, calcula días estimados según diferencia porcentual
    if (item.targetPrice && item.currentPrice) {
      const diff = Math.abs(item.targetPrice - item.currentPrice);
      const pct = diff / item.currentPrice;
      if (pct > 0.2) return '2-4 semanas';
      if (pct > 0.1) return '1-2 semanas';
      if (pct > 0.05) return '3-7 días';
      if (pct > 0.02) return '1-3 días';
      return 'Intradiario';
    }
    return 'N/A';
  };

  const renderAlert = ({ item }: { item: AutoAlert }) => (
    <View style={[styles.alertCard, { borderWidth: 1, borderColor: getSignalColor(item.signal) + '55', backgroundColor: theme.surface + 'cc' }]}> 
      <LinearGradient
        colors={[theme.surface, theme.surfaceVariant]}
        style={styles.alertGradient}
      >
        <View style={styles.alertHeader}>
          <View style={styles.alertMainInfo}>
            <View style={styles.alertTitle}>
              <Text style={styles.alertTypeIcon}>{getAlertTypeIcon(item.type)}</Text>
              <Text style={styles.alertSymbol}>{item.symbol}</Text>
              <View style={[styles.signalBadge, { backgroundColor: getSignalColor(item.signal) + '20' }]}> 
                <Text style={[styles.signalText, { color: getSignalColor(item.signal) }]}> 
                  {item.signal.toUpperCase()}
                </Text>
              </View>
              {getDataSourceBadge(item.dataSource)}
            </View>
            <Text style={styles.alertName}>{item.name}</Text>
          </View>
          <View style={styles.alertMeta}>
            <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(item.priority) + '20' }]}> 
              <Text style={[styles.priorityText, { color: getPriorityColor(item.priority) }]}> 
                {item.priority.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.timeAgo}>{formatTimeAgo(item.createdAt)}</Text>
          </View>
        </View>

        <View style={styles.strategyInfo}>
          <Text style={styles.strategyLabel}>Estrategia:</Text>
          <Text style={styles.strategyName}>{item.strategy}</Text>
          <View style={styles.confidenceContainer}>
            <Text style={styles.confidenceLabel}>Confianza:</Text>
            <Text style={[
              styles.confidenceValue,
              { color: item.confidence > 80 ? theme.success : item.confidence > 60 ? theme.warning : theme.textSecondary }
            ]}>
              {item.confidence}%
            </Text>
          </View>
        </View>

        <View style={styles.priceInfo}>
          <View style={styles.priceItem}>
            <Text style={styles.priceLabel}>Precio:</Text>
            <Text style={styles.priceValue}>${item.currentPrice.toLocaleString()}</Text>
          </View>
          {item.targetPrice && (
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Objetivo:</Text>
              <Text style={[styles.priceValue, { color: theme.success }]}> 
                ${item.targetPrice.toLocaleString()}
              </Text>
            </View>
          )}
          {item.stopLoss && (
            <View style={styles.priceItem}>
              <Text style={styles.priceLabel}>Stop Loss:</Text>
              <Text style={[styles.priceValue, { color: theme.error }]}> 
                ${item.stopLoss.toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.reasoningContainer}>
          <Text style={styles.reasoningText}>{item.reasoning}</Text>
        </View>

        <View style={styles.alertFooter}>
          <View style={styles.timeframeContainer}>
            <Text style={styles.timeframeLabel}>Plazo:</Text>
            <Text style={styles.timeframeValue}>{getTimeframe(item)}</Text>
          </View>
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={() => dismissAlert(item.id)}
          >
            <Text style={styles.dismissButtonText}>Descartar</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );

  // Filtros visuales por prioridad y tipo de señal
  const renderFilterButtons = () => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterContainer}>
        {(['all', 'critical', 'high', 'medium', 'low'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              selectedFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setSelectedFilter(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              selectedFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter === 'all' ? 'Todas' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterContainer, { marginTop: 4 }]}> 
        {(['all', 'buy', 'sell', 'watch'] as const).map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterButton,
              signalFilter === filter && styles.filterButtonActive
            ]}
            onPress={() => setSignalFilter(filter)}
          >
            <Text style={[
              styles.filterButtonText,
              signalFilter === filter && styles.filterButtonTextActive
            ]}>
              {filter === 'all' ? 'Todas' : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const filteredAlerts = getFilteredAlerts();
  const strategyStats = autoAlertService.getStrategyStats();

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.gradient}
      >
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {/* Progress Bar para Escaneo */}
          {(isScanning || scanProgress > 0) && (
            <View style={styles.progressSection}>
              <LinearGradient
                colors={[theme.surface, theme.surfaceVariant]}
                style={styles.progressCard}
              >
                <View style={styles.progressHeader}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <Text style={styles.progressTitle}>
                    🧠 VectorFlux AI analizando... {Math.round(scanProgress)}%
                  </Text>
                </View>
                
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <Animated.View 
                      style={[
                        styles.progressBar,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', `${scanProgress}%`]
                          })
                        }
                      ]}
                    />
                  </View>
                </View>
                
                <Text style={styles.progressSubtext}>
                  VectorFlux AI usando TensorFlow para analizar precios reales de stocks y crypto...
                </Text>
              </LinearGradient>
            </View>
          )}

          {/* Control de Auto-Scan */}
          <View style={styles.controlSection}>
            <LinearGradient
              colors={[theme.surface, theme.surfaceVariant]}
              style={styles.controlCard}
            >
              <View style={styles.controlHeader}>
                <View style={styles.controlInfo}>
                  <Text style={styles.controlTitle}>🧠 VectorFlux AI Auto-Scan</Text>
                  <Text style={styles.controlSubtitle}>
                    {autoScanEnabled ? 'Activo - cada 30 minutos con IA real' : 'Pausado'}
                    {lastScanTime && (
                      <Text style={styles.lastScanText}>
                        {'\n'}Último escaneo AI: {formatTimeAgo(lastScanTime)}
                      </Text>
                    )}
                    {lastSyncTime && (
                      <Text style={styles.syncText}>
                        {'\n'}📱 Sincronizado: {formatTimeAgo(lastSyncTime)}
                      </Text>
                    )}
                  </Text>
                </View>
                <Switch
                  value={autoScanEnabled}
                  onValueChange={toggleAutoScan}
                  trackColor={{ false: theme.border, true: theme.primary + '40' }}
                  thumbColor={autoScanEnabled ? theme.primary : theme.textMuted}
                />
              </View>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[
                    styles.scanButton,
                    (isScanning || scanCooldown > 0) && styles.scanButtonDisabled
                  ]}
                  onPress={performScan}
                  disabled={isScanning || scanCooldown > 0}
                >
                  <LinearGradient
                    colors={isScanning || scanCooldown > 0 
                      ? [theme.textMuted, theme.border] 
                      : [theme.primary, theme.primaryDark]
                    }
                    style={styles.scanButtonGradient}
                  >
                    <Text style={styles.scanButtonText}>
                      {isScanning 
                        ? '🧠 AI Analizando...' 
                        : scanCooldown > 0 
                          ? `⏰ Esperar ${scanCooldown}s`
                          : '🚀 Escanear AI'
                      }
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.syncButton, refreshing && styles.syncButtonDisabled]}
                  onPress={reloadAlertsFromFirebase}
                  disabled={refreshing}
                >
                  <LinearGradient
                    colors={refreshing 
                      ? [theme.textMuted, theme.border] 
                      : [theme.success, '#22c55e']
                    }
                    style={styles.syncButtonGradient}
                  >
                    <Text style={styles.syncButtonText}>
                      {refreshing ? '📥 Sincronizando...' : '📱 Sincronizar'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Estadísticas de Estrategias */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>🧠 Rendimiento VectorFlux AI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.statsContainer}>
            {strategyStats.map((stat, index) => (
              <View key={index} style={styles.statCard}>
                <LinearGradient
                  colors={[theme.surface, theme.surfaceVariant]}
                  style={styles.statGradient}
                >
                  <Text style={[styles.statName, { fontSize: 9 }]}>{stat.name}</Text>
                  <Text style={[styles.statValue, { fontSize: 14 }]}>{stat.totalAlerts}</Text>
                  <Text style={[styles.statLabel, { fontSize: 8 }]}>Alertas</Text>
                  <Text style={[styles.statConfidence, { fontSize: 8 }]}>{stat.avgConfidence}% conf.</Text>
                </LinearGradient>
              </View>
            ))}
          </View>
            </ScrollView>
          </View>

          {/* Filtros */}
          {renderFilterButtons()}

          {/* Lista de Alertas */}
          <View style={styles.alertsSection}>
            <Text style={styles.sectionTitle}>
              🎯 Alertas AI Activas ({filteredAlerts.length})
            </Text>
            
            {filteredAlerts.length > 0 ? (
              <FlatList
                data={filteredAlerts}
                renderItem={renderAlert}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                scrollEnabled={false}
              />
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>🔍</Text>
                <Text style={styles.emptyStateTitle}>No hay alertas AI activas</Text>
                <Text style={styles.emptyStateText}>
                  {isLoading 
                    ? 'VectorFlux AI escaneando mercados...' 
                    : 'Los modelos AI monitorean constantemente precios reales. Las nuevas oportunidades aparecerán aquí.'
                  }
                </Text>
                <TouchableOpacity style={styles.emptyStateButton} onPress={performScan}>
                  <Text style={styles.emptyStateButtonText}>Escanear con AI</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
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
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
  },
  progressSection: {
    marginBottom: theme.spacing.lg,
  },
  progressCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    marginLeft: theme.spacing.sm,
  },
  progressBarContainer: {
    marginBottom: theme.spacing.sm,
  },
  progressBarBackground: {
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: theme.primary,
    borderRadius: 3,
  },
  progressSubtext: {
    fontSize: 12,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  controlSection: {
    marginBottom: theme.spacing.lg,
  },
  controlCard: {
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    ...theme.shadows.small,
  },
  controlHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  controlInfo: {
    flex: 1,
  },
  controlTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  controlSubtitle: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  lastScanText: {
    fontSize: 10,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  syncText: {
    fontSize: 10,
    color: theme.success,
    fontStyle: 'italic',
  },
  scanButton: {
    flex: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonGradient: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  scanButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  syncButton: {
    flex: 1,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  syncButtonDisabled: {
    opacity: 0.6,
  },
  syncButtonGradient: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  syncButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  statsSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    width: 120,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
  },
  statGradient: {
    padding: theme.spacing.sm,
    alignItems: 'center',
  },
  statName: {
    fontSize: 11,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: theme.textMuted,
  },
  statConfidence: {
    fontSize: 10,
    color: theme.success,
    marginTop: 2,
  },
  filterContainer: {
    marginBottom: theme.spacing.md,
  },
  filterButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.surface,
    marginRight: theme.spacing.xs,
    borderWidth: 1,
    borderColor: theme.border,
  },
  filterButtonActive: {
    backgroundColor: theme.primary + '20',
    borderColor: theme.primary,
  },
  filterButtonText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: theme.primary,
  },
  alertsSection: {
    marginBottom: theme.spacing.xxl,
  },
  alertCard: {
    marginBottom: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    ...theme.shadows.small,
  },
  alertGradient: {
    padding: theme.spacing.md,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  alertMainInfo: {
    flex: 1,
  },
  alertTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  alertTypeIcon: {
    fontSize: 16,
    marginRight: theme.spacing.xs,
  },
  alertSymbol: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginRight: theme.spacing.xs,
  },
  signalBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
  },
  signalText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  alertName: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  alertMeta: {
    alignItems: 'flex-end',
  },
  priorityBadge: {
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    borderRadius: theme.borderRadius.sm,
    marginBottom: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  timeAgo: {
    fontSize: 10,
    color: theme.textMuted,
  },
  strategyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
    flexWrap: 'wrap',
  },
  strategyLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginRight: theme.spacing.xs,
  },
  strategyName: {
    fontSize: 12,
    color: theme.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  confidenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  confidenceLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginRight: theme.spacing.xs,
  },
  confidenceValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  priceInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  priceItem: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 10,
    color: theme.textMuted,
    marginBottom: 2,
  },
  priceValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  reasoningContainer: {
    backgroundColor: theme.background + '50',
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  reasoningText: {
    fontSize: 12,
    color: theme.textSecondary,
    lineHeight: 16,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeframeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeframeLabel: {
    fontSize: 12,
    color: theme.textMuted,
    marginRight: theme.spacing.xs,
  },
  timeframeValue: {
    fontSize: 12,
    color: theme.textPrimary,
    fontWeight: '600',
  },
  dismissButton: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.error + '20',
  },
  dismissButtonText: {
    fontSize: 11,
    color: theme.error,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xxl,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: theme.spacing.md,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  emptyStateText: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
  },
  emptyStateButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.sm,
  },
  emptyStateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AlertScreen;
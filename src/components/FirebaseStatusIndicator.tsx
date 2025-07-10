import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { integratedDataService } from '../services/integratedDataService';
import { theme } from '../theme/colors';

interface FirebaseStatsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const FirebaseStatsModal: React.FC<FirebaseStatsModalProps> = ({ visible, onClose }) => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible) {
      loadStats();
    }
  }, [visible]);

  const loadStats = async () => {
    setLoading(true);
    try {
      const performanceStats = await integratedDataService.getPerformanceStats();
      setStats(performanceStats);
    } catch (error) {
      console.error('Error loading Firebase stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!stats && !loading) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.modalGradient}
          >
            <View style={styles.header}>
              <Text style={styles.title}>📊 Firebase Performance</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>
              {loading ? (
                <Text style={styles.loadingText}>Loading stats...</Text>
              ) : (
                <>
                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{stats?.totalGems || 0}</Text>
                      <Text style={styles.statLabel}>Total Gems</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{stats?.activeTrades || 0}</Text>
                      <Text style={styles.statLabel}>Active Trades</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{stats?.totalTrades || 0}</Text>
                      <Text style={styles.statLabel}>Total Trades</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Text style={[styles.statValue, { 
                        color: (stats?.totalPnL || 0) >= 0 ? theme.primary : theme.secondary 
                      }]}>
                        ${(stats?.totalPnL || 0).toFixed(2)}
                      </Text>
                      <Text style={styles.statLabel}>Total P&L</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{(stats?.winRate || 0).toFixed(1)}%</Text>
                      <Text style={styles.statLabel}>Win Rate</Text>
                    </View>
                    
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{stats?.totalStrategies || 0}</Text>
                      <Text style={styles.statLabel}>Strategies</Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>🔥 Firebase Performance</Text>
                    
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceLabel}>Cache Hit Rate</Text>
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { 
                          width: `${stats?.cacheHitRate || 0}%`,
                          backgroundColor: theme.primary 
                        }]} />
                      </View>
                      <Text style={styles.performanceValue}>{stats?.cacheHitRate || 0}%</Text>
                    </View>
                    
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceLabel}>Active Strategies</Text>
                      <Text style={styles.performanceValue}>
                        {stats?.activeStrategies || 0}/{stats?.totalStrategies || 0}
                      </Text>
                    </View>
                    
                    <View style={styles.performanceItem}>
                      <Text style={styles.performanceLabel}>Last Updated</Text>
                      <Text style={styles.performanceValue}>
                        {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleTimeString() : 'Never'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💡 Performance Tips</Text>
                    <Text style={styles.tipText}>
                      • Firebase automatically caches data for 15 minutes{'\n'}
                      • Pull to refresh forces fresh data from APIs{'\n'}
                      • All trades and strategies are synced in real-time{'\n'}
                      • Offline support with local fallback data
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.refreshButton} onPress={loadStats}>
              <Text style={styles.refreshButtonText}>🔄 Refresh Stats</Text>
            </TouchableOpacity>
          </LinearGradient>
        </View>
      </View>
    </Modal>
  );
};

export const FirebaseStatusIndicator: React.FC = () => {
  const [modalVisible, setModalVisible] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  return (
    <>
      <TouchableOpacity 
        style={styles.statusIndicator}
        onPress={() => setModalVisible(true)}
      >
        <View style={[styles.statusDot, { 
          backgroundColor: isOnline ? theme.primary : theme.secondary 
        }]} />
        <Text style={styles.statusText}>
          🔥 Firebase {isOnline ? 'Connected' : 'Offline'}
        </Text>
      </TouchableOpacity>

      <FirebaseStatsModal 
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.md,
    marginVertical: theme.spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: theme.spacing.sm,
  },
  statusText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxHeight: '80%',
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  modalGradient: {
    padding: theme.spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: theme.textMuted,
  },
  content: {
    maxHeight: 400,
  },
  loadingText: {
    textAlign: 'center',
    color: theme.textSecondary,
    fontSize: 16,
    marginVertical: theme.spacing.xl,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    width: '48%',
    backgroundColor: theme.borderLight,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.textMuted,
    textAlign: 'center',
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  performanceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  performanceLabel: {
    flex: 1,
    fontSize: 14,
    color: theme.textSecondary,
  },
  performanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.textPrimary,
    minWidth: 50,
    textAlign: 'right',
  },
  progressBar: {
    flex: 2,
    height: 6,
    backgroundColor: theme.border,
    borderRadius: 3,
    marginHorizontal: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tipText: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 20,
    backgroundColor: theme.borderLight,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  refreshButton: {
    backgroundColor: theme.accent,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  refreshButtonText: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});

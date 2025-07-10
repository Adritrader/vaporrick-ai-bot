import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { realDataService } from '../services/realDataService';
import { theme } from '../theme/colors';

export const ServiceStatusIndicator: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [batchStats, setBatchStats] = useState<any>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateStats = async () => {
      const serviceStats = realDataService.getServiceStats();
      const batchCacheStats = await realDataService.getBatchCacheStats();
      setStats(serviceStats);
      setBatchStats(batchCacheStats);
    };

    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  const handleReset = () => {
    realDataService.resetRateLimit();
    setStats(realDataService.getServiceStats());
  };

  const handleForceRefresh = async () => {
    await realDataService.forceBatchRefresh();
    const batchCacheStats = await realDataService.getBatchCacheStats();
    setBatchStats(batchCacheStats);
  };

  if (!stats || !batchStats) return null;

  const isRateLimited = stats.rateLimitActive;
  const timeUntilReset = Math.max(0, Math.ceil((stats.rateLimitUntil - Date.now()) / 1000));
  const cacheIsValid = batchStats.isValid;

  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={[styles.indicator, isRateLimited ? styles.rateLimited : cacheIsValid ? styles.cached : styles.normal]}
        onPress={() => setVisible(!visible)}
      >
        <Text style={styles.indicatorText}>
          {isRateLimited ? `RL ${timeUntilReset}s` : cacheIsValid ? `📦 ${batchStats.nextRefreshIn}s` : '●'}
        </Text>
      </TouchableOpacity>

      {visible && (
        <View style={styles.statusPanel}>
          <Text style={styles.statusTitle}>Data Service Status</Text>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Rate Limited:</Text>
            <Text style={[styles.statusValue, isRateLimited ? styles.error : styles.success]}>
              {isRateLimited ? `Yes (${timeUntilReset}s)` : 'No'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Batch Cache:</Text>
            <Text style={[styles.statusValue, cacheIsValid ? styles.success : styles.error]}>
              {cacheIsValid ? `Valid (${batchStats.symbolCount} symbols)` : 'Expired'}
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Cache Age:</Text>
            <Text style={styles.statusValue}>
              {batchStats.ageMinutes}m {batchStats.ageSeconds % 60}s
            </Text>
          </View>

          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Next Refresh:</Text>
            <Text style={styles.statusValue}>
              {batchStats.nextRefreshIn > 0 ? `${batchStats.nextRefreshIn}s` : 'Now'}
            </Text>
          </View>
          
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Cache Expiry:</Text>
            <Text style={styles.statusValue}>{stats.cacheExpiryMinutes} min</Text>
          </View>

          <View style={styles.buttonRow}>
            {isRateLimited && (
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <Text style={styles.resetButtonText}>Reset Rate Limit</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity style={styles.refreshButton} onPress={handleForceRefresh}>
              <Text style={styles.refreshButtonText}>Force Refresh</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}>
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
  },
  indicator: {
    width: 60,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  normal: {
    backgroundColor: theme.success,
  },
  cached: {
    backgroundColor: theme.accent,
  },
  rateLimited: {
    backgroundColor: theme.secondary,
  },
  indicatorText: {
    color: theme.textPrimary,
    fontSize: 10,
    fontWeight: 'bold',
  },
  statusPanel: {
    position: 'absolute',
    top: 25,
    right: 0,
    backgroundColor: theme.surface,
    borderRadius: 8,
    padding: 12,
    minWidth: 250,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusTitle: {
    color: theme.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  statusLabel: {
    color: theme.textSecondary,
    fontSize: 12,
  },
  statusValue: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  success: {
    color: theme.success,
  },
  error: {
    color: theme.secondary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  resetButton: {
    backgroundColor: theme.primary,
    padding: 8,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  resetButtonText: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: theme.accent,
    padding: 8,
    borderRadius: 4,
    flex: 1,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: theme.textPrimary,
    fontSize: 12,
    fontWeight: '500',
  },
  closeButton: {
    backgroundColor: theme.surfaceVariant,
    padding: 8,
    borderRadius: 4,
    marginTop: 4,
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.textSecondary,
    fontSize: 12,
  },
});

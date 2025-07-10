import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFirebaseInit } from '../hooks/useFirebaseInit';
import { FirebaseIndexError } from './FirebaseIndexError';
import { theme } from '../theme/colors';

interface FirebaseInitIndicatorProps {
  showDetails?: boolean;
  onPress?: () => void;
  style?: any;
}

/**
 * Componente visual para mostrar el estado de inicialización de Firebase
 * y permitir re-inicializar manualmente si es necesario
 */
export const FirebaseInitIndicator: React.FC<FirebaseInitIndicatorProps> = ({
  showDetails = false,
  onPress,
  style
}) => {
  const {
    isInitializing,
    isInitialized,
    initError,
    initStats,
    reinitializeFirebase,
    refreshStats
  } = useFirebaseInit();

  const [showIndexError, setShowIndexError] = React.useState(false);

  // Check if error is related to missing indexes
  const isIndexError = initError?.includes('requires an index') || 
                       initError?.includes('composite index');

  const getStatusColor = () => {
    if (initError) return theme.secondary;
    if (isInitializing) return theme.accent;
    if (isInitialized) return theme.primary;
    return theme.textSecondary;
  };

  const getStatusText = () => {
    if (initError) return 'Error';
    if (isInitializing) return 'Initializing...';
    if (isInitialized) return 'Ready';
    return 'Checking...';
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else if (isIndexError) {
      // Show index error modal for index-related errors
      setShowIndexError(true);
    } else if (initError) {
      // Si hay error, intentar re-inicializar
      reinitializeFirebase();
    } else if (!isInitializing) {
      // Si no hay error, refrescar estadísticas
      refreshStats();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handlePress}
      disabled={isInitializing}
    >
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        
        {isInitializing && (
          <ActivityIndicator 
            size="small" 
            color={theme.accent} 
            style={styles.loader}
          />
        )}
        
        <Text style={[styles.statusText, { color: getStatusColor() }]}>
          Firebase {getStatusText()}
        </Text>
      </View>

      {showDetails && initStats && (
        <View style={styles.detailsContainer}>
          <Text style={styles.detailsTitle}>Database Status:</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{initStats.gems}</Text>
              <Text style={styles.statLabel}>Gems</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{initStats.strategies}</Text>
              <Text style={styles.statLabel}>Strategies</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{initStats.autoTrades}</Text>
              <Text style={styles.statLabel}>Trades</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{initStats.opportunities}</Text>
              <Text style={styles.statLabel}>Opportunities</Text>
            </View>
          </View>
        </View>
      )}

      {initError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            {initError}
          </Text>
          <Text style={styles.errorHint}>
            {isIndexError ? 'Tap to see setup instructions' : 'Tap to retry initialization'}
          </Text>
        </View>
      )}

      <FirebaseIndexError
        visible={showIndexError}
        onClose={() => setShowIndexError(false)}
        errorMessage={initError || undefined}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.surface,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  loader: {
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  detailsTitle: {
    fontSize: 11,
    color: theme.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: theme.textSecondary,
    marginTop: 2,
  },
  errorContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: theme.secondary + '20',
    borderRadius: 4,
  },
  errorText: {
    fontSize: 11,
    color: theme.secondary,
    marginBottom: 4,
  },
  errorHint: {
    fontSize: 10,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});

export default FirebaseInitIndicator;

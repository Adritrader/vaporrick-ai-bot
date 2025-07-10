import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Linking } from 'react-native';
import { theme } from '../theme/colors';

interface FirebaseIndexErrorProps {
  visible: boolean;
  onClose: () => void;
  errorMessage?: string;
}

/**
 * Componente que muestra instrucciones para resolver errores de índices de Firebase
 */
export const FirebaseIndexError: React.FC<FirebaseIndexErrorProps> = ({
  visible,
  onClose,
  errorMessage
}) => {
  const [step, setStep] = useState(0);

  // Extract index creation URL from error message
  const getIndexUrl = (message: string | undefined): string | null => {
    if (!message) return null;
    
    const match = message.match(/https:\/\/console\.firebase\.google\.com[^\]]+/);
    return match ? match[0] : null;
  };

  const indexUrl = getIndexUrl(errorMessage);

  const steps = [
    {
      title: '🔧 Problema Detectado',
      content: 'Firebase necesita índices para realizar consultas eficientes. Esto es normal y se soluciona fácilmente.',
      action: null
    },
    {
      title: '🌐 Abrir Firebase Console',
      content: 'Haz clic en el enlace que aparece en el error para ir directamente a la configuración de índices.',
      action: indexUrl ? () => Linking.openURL(indexUrl) : null
    },
    {
      title: '⚙️ Crear Índice',
      content: 'En Firebase Console:\n\n1. Haz clic en "Crear índice"\n2. Espera a que se complete (1-2 minutos)\n3. Regresa a la app',
      action: null
    },
    {
      title: '🔄 Automático',
      content: 'También puedes ejecutar nuestro script automático que configura todos los índices necesarios.',
      action: null
    }
  ];

  const nextStep = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    }
  };

  const prevStep = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Firebase Setup Required</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.stepContainer}>
            <Text style={styles.stepTitle}>{steps[step].title}</Text>
            <Text style={styles.stepContent}>{steps[step].content}</Text>

            {steps[step].action && (
              <TouchableOpacity style={styles.actionButton} onPress={steps[step].action!}>
                <Text style={styles.actionButtonText}>
                  {step === 1 ? '🔗 Abrir Firebase Console' : 'Ejecutar Acción'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {errorMessage && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorTitle}>📋 Detalles del Error:</Text>
              <ScrollView style={styles.errorScroll} horizontal showsHorizontalScrollIndicator={false}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </ScrollView>
            </View>
          )}

          <View style={styles.automaticSection}>
            <Text style={styles.automaticTitle}>🤖 Configuración Automática</Text>
            <Text style={styles.automaticContent}>
              Para configurar todos los índices automáticamente, ejecuta en tu terminal:
            </Text>
            <View style={styles.codeContainer}>
              <Text style={styles.codeText}>npm run setup-firebase-indexes</Text>
            </View>
            <Text style={styles.automaticNote}>
              O ejecuta directamente: node scripts/setupFirebaseIndexes.js
            </Text>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>💡 ¿Por qué pasa esto?</Text>
            <Text style={styles.infoContent}>
              Firebase Firestore requiere índices para consultas complejas por razones de rendimiento. 
              Esto es completamente normal y se configura una sola vez por proyecto.
            </Text>
          </View>
        </ScrollView>

        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.navButton, step === 0 && styles.navButtonDisabled]}
            onPress={prevStep}
            disabled={step === 0}
          >
            <Text style={[styles.navButtonText, step === 0 && styles.navButtonTextDisabled]}>
              ← Anterior
            </Text>
          </TouchableOpacity>

          <View style={styles.stepIndicator}>
            <Text style={styles.stepText}>{step + 1} de {steps.length}</Text>
          </View>

          <TouchableOpacity
            style={[styles.navButton, step === steps.length - 1 && styles.navButtonDisabled]}
            onPress={nextStep}
            disabled={step === steps.length - 1}
          >
            <Text style={[styles.navButtonText, step === steps.length - 1 && styles.navButtonTextDisabled]}>
              Siguiente →
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.doneButton} onPress={onClose}>
          <Text style={styles.doneButtonText}>Entendido</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 16,
    color: theme.textSecondary,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  stepContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  stepContent: {
    fontSize: 16,
    color: theme.textSecondary,
    lineHeight: 24,
    marginBottom: theme.spacing.md,
  },
  actionButton: {
    backgroundColor: theme.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  actionButtonText: {
    color: theme.textPrimary,
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.secondary,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  errorScroll: {
    maxHeight: 100,
  },
  errorText: {
    fontSize: 12,
    color: theme.textSecondary,
    fontFamily: 'monospace',
  },
  automaticSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.accent,
  },
  automaticTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  automaticContent: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: theme.spacing.md,
  },
  codeContainer: {
    backgroundColor: theme.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  codeText: {
    fontSize: 14,
    color: theme.primary,
    fontFamily: 'monospace',
  },
  automaticNote: {
    fontSize: 12,
    color: theme.textMuted,
    fontStyle: 'italic',
  },
  infoSection: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.sm,
  },
  infoContent: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  navButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.surface,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.textPrimary,
  },
  navButtonTextDisabled: {
    color: theme.textMuted,
  },
  stepIndicator: {
    paddingHorizontal: theme.spacing.md,
  },
  stepText: {
    fontSize: 12,
    color: theme.textSecondary,
  },
  doneButton: {
    backgroundColor: theme.primary,
    margin: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.background,
  },
});

export default FirebaseIndexError;

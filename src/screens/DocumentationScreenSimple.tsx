import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
} from 'react-native';

const DocumentationScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>📖 Documentación</Text>
          <Text style={styles.subtitle}>VaporFLUX AI Trading Bot</Text>
          
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🎯 Visión General</Text>
            <Text style={styles.text}>
              VaporFLUX es una aplicación de trading AI que te ayuda a:
            </Text>
            <Text style={styles.bulletPoint}>• Analizar mercados en tiempo real</Text>
            <Text style={styles.bulletPoint}>• Generar señales de trading automáticas</Text>
            <Text style={styles.bulletPoint}>• Hacer backtest de estrategias</Text>
            <Text style={styles.bulletPoint}>• Gestionar tu portfolio</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚀 Características</Text>
            <Text style={styles.bulletPoint}>• AI para análisis técnico</Text>
            <Text style={styles.bulletPoint}>• Datos en tiempo real</Text>
            <Text style={styles.bulletPoint}>• Alertas personalizadas</Text>
            <Text style={styles.bulletPoint}>• Métricas de rendimiento</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>⚙️ Configuración</Text>
            <Text style={styles.text}>
              La app viene pre-configurada para usar las mejores APIs del mercado:
            </Text>
            <Text style={styles.bulletPoint}>• CoinPaprika para crypto</Text>
            <Text style={styles.bulletPoint}>• Alpha Vantage para stocks</Text>
            <Text style={styles.bulletPoint}>• TensorFlow.js para AI</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#2c5aa0',
    textAlign: 'center',
    marginBottom: 30,
  },
  section: {
    marginBottom: 25,
    padding: 15,
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c5aa0',
    marginBottom: 10,
  },
  text: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    marginBottom: 10,
  },
  bulletPoint: {
    fontSize: 14,
    color: '#cccccc',
    lineHeight: 20,
    marginBottom: 5,
    paddingLeft: 10,
  },
});

export default DocumentationScreen;

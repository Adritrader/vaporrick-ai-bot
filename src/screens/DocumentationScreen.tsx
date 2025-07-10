import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../theme/colors';

const { width } = Dimensions.get('window');

interface Section {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
}

export default function DocumentationScreen() {
  const [activeSection, setActiveSection] = useState('overview');

  const sections: Section[] = [
    {
      id: 'overview',
      title: 'Visión General',
      icon: '🏠',
      content: <OverviewSection />,
    },
    {
      id: 'architecture',
      title: 'Arquitectura',
      icon: '🏗️',
      content: <ArchitectureSection />,
    },
    {
      id: 'ai-system',
      title: 'Sistema de IA',
      icon: '🧠',
      content: <AISystemSection />,
    },
    {
      id: 'trading',
      title: 'Trading',
      icon: '📈',
      content: <TradingSection />,
    },
    {
      id: 'screens',
      title: 'Pantallas',
      icon: '📱',
      content: <ScreensSection />,
    },
    {
      id: 'api-services',
      title: 'APIs y Servicios',
      icon: '🔌',
      content: <APIServicesSection />,
    },
    {
      id: 'user-guide',
      title: 'Guía de Usuario',
      icon: '📚',
      content: <UserGuideSection />,
    },
    {
      id: 'troubleshooting',
      title: 'Solución de Problemas',
      icon: '🔧',
      content: <TroubleshootingSection />,
    },
    {
      id: 'roadmap',
      title: 'Roadmap',
      icon: '🗺️',
      content: <RoadmapSection />,
    },
  ];

  const activeContent = sections.find(section => section.id === activeSection)?.content;

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={theme.gradients.background as any}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <LinearGradient
            colors={[theme.surface, theme.surfaceVariant]}
            style={styles.headerGradient}
          >
            <Text style={styles.headerTitle}>📚 Documentación Completa</Text>
            <Text style={styles.headerSubtitle}>VaporRick AI Trading Bot v1.0</Text>
          </LinearGradient>
        </View>

        <View style={styles.content}>
          {/* Navigation Sidebar */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {sections.map((section) => (
                <TouchableOpacity
                  key={section.id}
                  style={[
                    styles.navItem,
                    activeSection === section.id && styles.activeNavItem,
                  ]}
                  onPress={() => setActiveSection(section.id)}
                >
                  <Text style={styles.navIcon}>{section.icon}</Text>
                  <Text style={[
                    styles.navTitle,
                    activeSection === section.id && styles.activeNavTitle,
                  ]}>
                    {section.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Main Content */}
          <View style={styles.mainContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {activeContent}
            </ScrollView>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// Section Components
function OverviewSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🏠 Visión General del Sistema</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 ¿Qué es VaporRick AI Bot?</Text>
        <Text style={styles.text}>
          VaporRick AI Bot es una aplicación React Native con Expo que combina inteligencia artificial, 
          análisis técnico y trading automatizado para ofrecer predicciones de mercado y estrategias 
          de inversión inteligentes.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Características Principales</Text>
        <Text style={styles.bulletPoint}>• 🧠 Inteligencia Artificial con TensorFlow.js</Text>
        <Text style={styles.bulletPoint}>• 📈 Análisis técnico en tiempo real</Text>
        <Text style={styles.bulletPoint}>• 💎 Detector de gemas cripto</Text>
        <Text style={styles.bulletPoint}>• ⚡ Trading automatizado</Text>
        <Text style={styles.bulletPoint}>• 📊 Dashboard de performance</Text>
        <Text style={styles.bulletPoint}>• 🔔 Sistema de alertas</Text>
        <Text style={styles.bulletPoint}>• 📱 Interfaz móvil optimizada</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔬 Tecnologías Implementadas</Text>
        <Text style={styles.bulletPoint}>• React Native + Expo</Text>
        <Text style={styles.bulletPoint}>• TensorFlow.js para modelos de IA</Text>
        <Text style={styles.bulletPoint}>• Context API para gestión de estado</Text>
        <Text style={styles.bulletPoint}>• Victory Native para gráficos</Text>
        <Text style={styles.bulletPoint}>• Firebase para datos en tiempo real</Text>
        <Text style={styles.bulletPoint}>• APIs: Alpha Vantage, CoinGecko, Yahoo Finance</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💰 Modelo de Negocio</Text>
        <Text style={styles.text}>
          La aplicación es completamente gratuita, utilizando TensorFlow.js localmente 
          para evitar costos de servidores de IA. Se monetiza a través de:
        </Text>
        <Text style={styles.bulletPoint}>• Versión premium con funciones avanzadas</Text>
        <Text style={styles.bulletPoint}>• Integración con exchanges (comisiones)</Text>
        <Text style={styles.bulletPoint}>• API para desarrolladores</Text>
        <Text style={styles.bulletPoint}>• Consultoría y servicios personalizados</Text>
      </View>
    </View>
  );
}

function ArchitectureSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🏗️ Arquitectura del Sistema</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📁 Estructura de Directorios</Text>
        <Text style={styles.codeBlock}>
{`/src/
├── screens/          # Pantallas principales
├── components/       # Componentes reutilizables
├── services/         # Servicios de datos y APIs
├── ai/              # Lógica de inteligencia artificial
├── context/         # Context API y gestión de estado
├── utils/           # Utilidades y helpers
├── theme/           # Temas y estilos
├── hooks/           # Custom hooks
├── data/            # Datos estáticos
├── workers/         # Web Workers para cálculos pesados
└── backtesting/     # Motor de backtesting`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Flujo de Datos</Text>
        <Text style={styles.text}>
          1. 📡 APIs obtienen datos de mercado en tiempo real
        </Text>
        <Text style={styles.text}>
          2. 🧠 Sistema de IA procesa y analiza los datos
        </Text>
        <Text style={styles.text}>
          3. 📊 Indicadores técnicos se calculan
        </Text>
        <Text style={styles.text}>
          4. ⚡ Señales de trading se generan
        </Text>
        <Text style={styles.text}>
          5. 📱 UI se actualiza en tiempo real
        </Text>
        <Text style={styles.text}>
          6. 🔔 Alertas se envían cuando es necesario
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎛️ Gestión de Estado</Text>
        <Text style={styles.text}>
          Utilizamos Context API con useReducer para un estado global eficiente:
        </Text>
        <Text style={styles.bulletPoint}>• TradingContext: Estado de trading y datos de mercado</Text>
        <Text style={styles.bulletPoint}>• Reducers: Acciones puras para modificar estado</Text>
        <Text style={styles.bulletPoint}>• Providers: Envuelven la app con contexto global</Text>
        <Text style={styles.bulletPoint}>• Custom hooks: Abstraen lógica de estado</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔌 Integración de Servicios</Text>
        <Text style={styles.bulletPoint}>• marketDataService: Gestión unificada de datos</Text>
        <Text style={styles.bulletPoint}>• firebaseService: Persistencia y sincronización</Text>
        <Text style={styles.bulletPoint}>• alertService: Notificaciones y alertas</Text>
        <Text style={styles.bulletPoint}>• realDataService: APIs de datos en tiempo real</Text>
      </View>
    </View>
  );
}

function AISystemSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🧠 Sistema de Inteligencia Artificial</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔮 VectorFlux Core Engine</Text>
        <Text style={styles.text}>
          El corazón del sistema de IA que combina múltiples modelos para predicciones precisas:
        </Text>
        <Text style={styles.bulletPoint}>• 🌊 Redes Neuronales Profundas (DNN)</Text>
        <Text style={styles.bulletPoint}>• 🔄 LSTM para series temporales</Text>
        <Text style={styles.bulletPoint}>• 📊 Modelos ensemble</Text>
        <Text style={styles.bulletPoint}>• 🎯 Análisis de patrones</Text>
        <Text style={styles.bulletPoint}>• ⚖️ Evaluación de riesgo</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Modelos Implementados</Text>
        <Text style={styles.subTitle}>1. Price Prediction Model</Text>
        <Text style={styles.text}>Predice movimientos de precios a corto y medio plazo.</Text>
        
        <Text style={styles.subTitle}>2. Sentiment Analysis Model</Text>
        <Text style={styles.text}>Analiza sentimiento de mercado desde múltiples fuentes.</Text>
        
        <Text style={styles.subTitle}>3. Pattern Recognition Model</Text>
        <Text style={styles.text}>Detecta patrones técnicos y formaciones chartistas.</Text>
        
        <Text style={styles.subTitle}>4. Risk Assessment Model</Text>
        <Text style={styles.text}>Evalúa y cuantifica riesgos de trading.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Configuración de Modelos</Text>
        <Text style={styles.codeBlock}>
{`// Arquitectura típica del modelo
const model = tf.sequential({
  layers: [
    tf.layers.dense({ 
      units: 128, 
      activation: 'relu',
      inputShape: [featureCount] 
    }),
    tf.layers.dropout({ rate: 0.3 }),
    tf.layers.dense({ 
      units: 64, 
      activation: 'relu' 
    }),
    tf.layers.dense({ 
      units: 1, 
      activation: 'sigmoid' 
    })
  ]
});`}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Indicadores Técnicos Integrados</Text>
        <Text style={styles.bulletPoint}>• SMA/EMA (Medias móviles)</Text>
        <Text style={styles.bulletPoint}>• RSI (Índice de Fuerza Relativa)</Text>
        <Text style={styles.bulletPoint}>• MACD (Convergencia/Divergencia)</Text>
        <Text style={styles.bulletPoint}>• Bollinger Bands</Text>
        <Text style={styles.bulletPoint}>• Stochastic Oscillator</Text>
        <Text style={styles.bulletPoint}>• Williams %R</Text>
        <Text style={styles.bulletPoint}>• Ichimoku Cloud</Text>
        <Text style={styles.bulletPoint}>• Fibonacci Retracements</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Generación de Estrategias</Text>
        <Text style={styles.text}>
          El sistema genera estrategias personalizadas basadas en:
        </Text>
        <Text style={styles.bulletPoint}>• Perfil de riesgo del usuario</Text>
        <Text style={styles.bulletPoint}>• Condiciones actuales del mercado</Text>
        <Text style={styles.bulletPoint}>• Análisis histórico de performance</Text>
        <Text style={styles.bulletPoint}>• Correlaciones entre activos</Text>
        <Text style={styles.bulletPoint}>• Volatilidad y momentum</Text>
      </View>
    </View>
  );
}

function TradingSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📈 Sistema de Trading</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Trading Automatizado</Text>
        <Text style={styles.text}>
          El sistema ejecuta trades automáticamente basado en señales de IA:
        </Text>
        <Text style={styles.bulletPoint}>• Análisis continuo del mercado 24/7</Text>
        <Text style={styles.bulletPoint}>• Ejecución instantánea de órdenes</Text>
        <Text style={styles.bulletPoint}>• Gestión automática de stop-loss</Text>
        <Text style={styles.bulletPoint}>• Take-profit dinámico</Text>
        <Text style={styles.bulletPoint}>• Rebalanceo de portfolio</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Tipos de Estrategias</Text>
        <Text style={styles.subTitle}>1. Scalping (Ultra rápido)</Text>
        <Text style={styles.text}>• Operaciones de segundos a minutos</Text>
        <Text style={styles.text}>• Alto volumen, pequeñas ganancias</Text>
        
        <Text style={styles.subTitle}>2. Day Trading (Intradiario)</Text>
        <Text style={styles.text}>• Operaciones dentro del mismo día</Text>
        <Text style={styles.text}>• Aprovecha volatilidad diaria</Text>
        
        <Text style={styles.subTitle}>3. Swing Trading (Medio plazo)</Text>
        <Text style={styles.text}>• Mantiene posiciones días/semanas</Text>
        <Text style={styles.text}>• Sigue tendencias principales</Text>
        
        <Text style={styles.subTitle}>4. Position Trading (Largo plazo)</Text>
        <Text style={styles.text}>• Inversiones de meses a años</Text>
        <Text style={styles.text}>• Basado en análisis fundamental</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛡️ Gestión de Riesgo</Text>
        <Text style={styles.bulletPoint}>• Stop-loss automático configurable</Text>
        <Text style={styles.bulletPoint}>• Diversificación de portfolio</Text>
        <Text style={styles.bulletPoint}>• Límites de exposición por activo</Text>
        <Text style={styles.bulletPoint}>• Análisis de correlaciones</Text>
        <Text style={styles.bulletPoint}>• Evaluación de volatilidad</Text>
        <Text style={styles.bulletPoint}>• Alertas de riesgo en tiempo real</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Métricas de Performance</Text>
        <Text style={styles.bulletPoint}>• ROI (Return on Investment)</Text>
        <Text style={styles.bulletPoint}>• Sharpe Ratio</Text>
        <Text style={styles.bulletPoint}>• Maximum Drawdown</Text>
        <Text style={styles.bulletPoint}>• Win Rate</Text>
        <Text style={styles.bulletPoint}>• Profit Factor</Text>
        <Text style={styles.bulletPoint}>• Average Trade Duration</Text>
        <Text style={styles.bulletPoint}>• Risk-Adjusted Returns</Text>
      </View>
    </View>
  );
}

function ScreensSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📱 Guía de Pantallas</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏠 Dashboard (Info)</Text>
        <Text style={styles.text}>
          Pantalla principal que muestra una visión general del sistema:
        </Text>
        <Text style={styles.bulletPoint}>• Resumen de portfolio</Text>
        <Text style={styles.bulletPoint}>• Performance reciente</Text>
        <Text style={styles.bulletPoint}>• Alertas activas</Text>
        <Text style={styles.bulletPoint}>• Estado de servicios</Text>
        <Text style={styles.bulletPoint}>• Noticias del mercado</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚡ Trading Screen</Text>
        <Text style={styles.text}>
          Pantalla principal de trading con todas las herramientas:
        </Text>
        <Text style={styles.bulletPoint}>• Gráficos en tiempo real</Text>
        <Text style={styles.bulletPoint}>• Indicadores técnicos</Text>
        <Text style={styles.bulletPoint}>• Panel de órdenes</Text>
        <Text style={styles.bulletPoint}>• Historial de trades</Text>
        <Text style={styles.bulletPoint}>• Métricas de performance</Text>
        <Text style={styles.bulletPoint}>• Configuración de estrategias</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🤖 AI Strategy Lab</Text>
        <Text style={styles.text}>
          Laboratorio de inteligencia artificial para estrategias:
        </Text>
        <Text style={styles.bulletPoint}>• Generador de estrategias</Text>
        <Text style={styles.bulletPoint}>• Análisis de mercado con IA</Text>
        <Text style={styles.bulletPoint}>• Predicciones de precios</Text>
        <Text style={styles.bulletPoint}>• Backtesting de estrategias</Text>
        <Text style={styles.bulletPoint}>• Optimización de parámetros</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💎 Gem Finder</Text>
        <Text style={styles.text}>
          Detector inteligente de oportunidades de inversión:
        </Text>
        <Text style={styles.bulletPoint}>• Análisis de criptomonedas emergentes</Text>
        <Text style={styles.bulletPoint}>• Scoring basado en IA</Text>
        <Text style={styles.bulletPoint}>• Filtros personalizables</Text>
        <Text style={styles.bulletPoint}>• Alertas de nuevas gemas</Text>
        <Text style={styles.bulletPoint}>• Análisis fundamental automático</Text>
      </View>
    </View>
  );
}

function APIServicesSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔌 APIs y Servicios Externos</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📊 Fuentes de Datos</Text>
        <Text style={styles.subTitle}>Alpha Vantage</Text>
        <Text style={styles.text}>• Datos de stocks en tiempo real</Text>
        <Text style={styles.text}>• Datos históricos</Text>
        <Text style={styles.text}>• Indicadores técnicos</Text>
        
        <Text style={styles.subTitle}>CoinGecko</Text>
        <Text style={styles.text}>• Precios de criptomonedas</Text>
        <Text style={styles.text}>• Información de mercado</Text>
        <Text style={styles.text}>• Métricas de DeFi</Text>
        
        <Text style={styles.subTitle}>Yahoo Finance</Text>
        <Text style={styles.text}>• Datos históricos complementarios</Text>
        <Text style={styles.text}>• Noticias financieras</Text>
        <Text style={styles.text}>• Información fundamental</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔥 Firebase Integration</Text>
        <Text style={styles.bulletPoint}>• Autenticación de usuarios</Text>
        <Text style={styles.bulletPoint}>• Base de datos en tiempo real</Text>
        <Text style={styles.bulletPoint}>• Sincronización de datos</Text>
        <Text style={styles.bulletPoint}>• Notificaciones push</Text>
        <Text style={styles.bulletPoint}>• Analytics y crashlytics</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Gestión de APIs</Text>
        <Text style={styles.text}>
          El sistema incluye un gestor inteligente de APIs que:
        </Text>
        <Text style={styles.bulletPoint}>• Balancea carga entre múltiples fuentes</Text>
        <Text style={styles.bulletPoint}>• Implementa fallbacks automáticos</Text>
        <Text style={styles.bulletPoint}>• Cache inteligente para optimizar requests</Text>
        <Text style={styles.bulletPoint}>• Rate limiting y control de errores</Text>
        <Text style={styles.bulletPoint}>• Retry logic con backoff exponencial</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Configuración de APIs</Text>
        <Text style={styles.text}>
          Para configurar las APIs, necesitas obtener keys de:
        </Text>
        <Text style={styles.bulletPoint}>• Alpha Vantage: alphavantage.co</Text>
        <Text style={styles.bulletPoint}>• CoinGecko: Pro API (opcional)</Text>
        <Text style={styles.bulletPoint}>• Firebase: console.firebase.google.com</Text>
        <Text style={styles.text}>
          Las keys se configuran en el archivo firebaseConfig.js
        </Text>
      </View>
    </View>
  );
}

function UserGuideSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>📚 Guía Completa de Usuario</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚀 Primeros Pasos</Text>
        <Text style={styles.subTitle}>1. Instalación</Text>
        <Text style={styles.text}>• Descarga desde App Store/Google Play</Text>
        <Text style={styles.text}>• O instala desde código fuente con Expo</Text>
        
        <Text style={styles.subTitle}>2. Configuración Inicial</Text>
        <Text style={styles.text}>• Configura tu perfil de riesgo</Text>
        <Text style={styles.text}>• Selecciona tus activos favoritos</Text>
        <Text style={styles.text}>• Establece límites de trading</Text>
        
        <Text style={styles.subTitle}>3. Primeras Operaciones</Text>
        <Text style={styles.text}>• Comienza con modo simulación</Text>
        <Text style={styles.text}>• Observa las señales de IA</Text>
        <Text style={styles.text}>• Activa trading automático gradualmente</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Cómo Usar Trading Screen</Text>
        <Text style={styles.subTitle}>Panel Principal</Text>
        <Text style={styles.bulletPoint}>• Gráfico: Visualiza precios y indicadores</Text>
        <Text style={styles.bulletPoint}>• Órdenes: Ve trades activos y pendientes</Text>
        <Text style={styles.bulletPoint}>• Performance: Métricas de rendimiento</Text>
        
        <Text style={styles.subTitle}>Configuración de Trading</Text>
        <Text style={styles.bulletPoint}>• Selecciona par de trading (BTC/USDT, etc.)</Text>
        <Text style={styles.bulletPoint}>• Ajusta parámetros de estrategia</Text>
        <Text style={styles.bulletPoint}>• Configura stop-loss y take-profit</Text>
        <Text style={styles.bulletPoint}>• Establece tamaño de posición</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🧠 Usando AI Strategy Lab</Text>
        <Text style={styles.subTitle}>Generación de Estrategias</Text>
        <Text style={styles.text}>1. Selecciona tipo de estrategia deseada</Text>
        <Text style={styles.text}>2. Define tu perfil de riesgo</Text>
        <Text style={styles.text}>3. La IA genera estrategia personalizada</Text>
        <Text style={styles.text}>4. Revisa backtesting y métricas</Text>
        <Text style={styles.text}>5. Activa la estrategia si estás satisfecho</Text>
        
        <Text style={styles.subTitle}>Análisis de Mercado</Text>
        <Text style={styles.bulletPoint}>• Predicciones de precios a corto plazo</Text>
        <Text style={styles.bulletPoint}>• Análisis de sentimiento</Text>
        <Text style={styles.bulletPoint}>• Detección de patrones técnicos</Text>
        <Text style={styles.bulletPoint}>• Evaluación de riesgo actual</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💎 Gem Finder: Encuentra Oportunidades</Text>
        <Text style={styles.subTitle}>Cómo Funciona</Text>
        <Text style={styles.text}>
          El Gem Finder analiza cientos de criptomonedas usando IA para 
          identificar las mejores oportunidades de inversión.
        </Text>
        
        <Text style={styles.subTitle}>Interpretación de Scores</Text>
        <Text style={styles.bulletPoint}>• 🟢 85-100: Excelente oportunidad</Text>
        <Text style={styles.bulletPoint}>• 🟡 70-84: Buena oportunidad</Text>
        <Text style={styles.bulletPoint}>• 🟠 50-69: Oportunidad moderada</Text>
        <Text style={styles.bulletPoint}>• 🔴 0-49: Alto riesgo</Text>
        
        <Text style={styles.subTitle}>Factores Considerados</Text>
        <Text style={styles.bulletPoint}>• Momentum de precio</Text>
        <Text style={styles.bulletPoint}>• Volumen de trading</Text>
        <Text style={styles.bulletPoint}>• Sentimiento de la comunidad</Text>
        <Text style={styles.bulletPoint}>• Desarrollo técnico</Text>
        <Text style={styles.bulletPoint}>• Adopción y partnerships</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚙️ Configuración Avanzada</Text>
        <Text style={styles.subTitle}>Perfiles de Riesgo</Text>
        <Text style={styles.bulletPoint}>• Conservador: 1-3% riesgo por trade</Text>
        <Text style={styles.bulletPoint}>• Moderado: 3-5% riesgo por trade</Text>
        <Text style={styles.bulletPoint}>• Agresivo: 5-10% riesgo por trade</Text>
        
        <Text style={styles.subTitle}>Alertas Personalizadas</Text>
        <Text style={styles.bulletPoint}>• Alertas de precio</Text>
        <Text style={styles.bulletPoint}>• Señales de trading</Text>
        <Text style={styles.bulletPoint}>• Cambios en portfolio</Text>
        <Text style={styles.bulletPoint}>• Noticias importantes</Text>
      </View>
    </View>
  );
}

function TroubleshootingSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🔧 Solución de Problemas</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⚠️ Problemas Comunes</Text>
        
        <Text style={styles.subTitle}>La app no se conecta a internet</Text>
        <Text style={styles.bulletPoint}>• Verifica tu conexión WiFi/datos</Text>
        <Text style={styles.bulletPoint}>• Reinicia la aplicación</Text>
        <Text style={styles.bulletPoint}>• Verifica permisos de red</Text>
        
        <Text style={styles.subTitle}>Datos no se actualizan</Text>
        <Text style={styles.bulletPoint}>• Pull to refresh en las pantallas</Text>
        <Text style={styles.bulletPoint}>• Verifica estado de APIs en Settings</Text>
        <Text style={styles.bulletPoint}>• Reinicia servicios de background</Text>
        
        <Text style={styles.subTitle}>Trading automático no funciona</Text>
        <Text style={styles.bulletPoint}>• Verifica que esté activado en configuración</Text>
        <Text style={styles.bulletPoint}>• Revisa límites de riesgo</Text>
        <Text style={styles.bulletPoint}>• Confirma que hay fondos suficientes</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛠️ Diagnóstico de Problemas</Text>
        
        <Text style={styles.subTitle}>Indicadores de Estado</Text>
        <Text style={styles.text}>
          En la pantalla principal, revisa los indicadores de estado:
        </Text>
        <Text style={styles.bulletPoint}>• 🟢 Verde: Servicio funcionando correctamente</Text>
        <Text style={styles.bulletPoint}>• 🟡 Amarillo: Servicio con advertencias</Text>
        <Text style={styles.bulletPoint}>• 🔴 Rojo: Servicio con errores</Text>
        
        <Text style={styles.subTitle}>Logs de Error</Text>
        <Text style={styles.text}>
          Accede a los logs desde Settings {'>'}  Diagnosis para ver 
          errores detallados y reportarlos al soporte.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔄 Resetear Configuración</Text>
        <Text style={styles.text}>
          Si experimentas problemas persistentes:
        </Text>
        <Text style={styles.bulletPoint}>• Ve a Settings {'>'}  Advanced</Text>
        <Text style={styles.bulletPoint}>• Selecciona "Reset App Data"</Text>
        <Text style={styles.bulletPoint}>• Confirma la acción</Text>
        <Text style={styles.bulletPoint}>• Reconfigura tus preferencias</Text>
        
        <Text style={styles.warning}>
          ⚠️ Esto borrará todas las configuraciones locales pero 
          mantendrá tu historial de trading en la nube.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📞 Soporte Técnico</Text>
        <Text style={styles.text}>
          Si necesitas ayuda adicional:
        </Text>
        <Text style={styles.bulletPoint}>• Email: support@vaporrickai.com</Text>
        <Text style={styles.bulletPoint}>• Discord: VaporRick AI Community</Text>
        <Text style={styles.bulletPoint}>• GitHub: Reporta bugs en el repo</Text>
        <Text style={styles.bulletPoint}>• Documentación: docs.vaporrickai.com</Text>
        
        <Text style={styles.text}>
          Incluye siempre:
        </Text>
        <Text style={styles.bulletPoint}>• Versión de la app</Text>
        <Text style={styles.bulletPoint}>• Modelo de dispositivo</Text>
        <Text style={styles.bulletPoint}>• Logs de error</Text>
        <Text style={styles.bulletPoint}>• Pasos para reproducir el problema</Text>
      </View>
    </View>
  );
}

function RoadmapSection() {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>🗺️ Roadmap y Futuras Funcionalidades</Text>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🚀 Q1 2025 - Fundación Sólida</Text>
        <Text style={styles.bulletPoint}>✅ Core AI engine con TensorFlow.js</Text>
        <Text style={styles.bulletPoint}>✅ Trading automatizado básico</Text>
        <Text style={styles.bulletPoint}>✅ Gem Finder con scoring IA</Text>
        <Text style={styles.bulletPoint}>✅ Dashboard y métricas básicas</Text>
        <Text style={styles.bulletPoint}>🔄 Integración con exchanges principales</Text>
        <Text style={styles.bulletPoint}>🔄 Sistema de alertas avanzado</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>📈 Q2 2025 - Escalabilidad</Text>
        <Text style={styles.bulletPoint}>🔮 Modelos de IA más sofisticados</Text>
        <Text style={styles.bulletPoint}>🔮 Social trading y copy trading</Text>
        <Text style={styles.bulletPoint}>🔮 Portfolio management avanzado</Text>
        <Text style={styles.bulletPoint}>🔮 DeFi integration (DEXs, yield farming)</Text>
        <Text style={styles.bulletPoint}>🔮 NFT analytics y trading</Text>
        <Text style={styles.bulletPoint}>🔮 Web app complementaria</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🌟 Q3 2025 - Innovación</Text>
        <Text style={styles.bulletPoint}>🔮 Quantum-inspired algorithms</Text>
        <Text style={styles.bulletPoint}>🔮 Cross-chain arbitrage</Text>
        <Text style={styles.bulletPoint}>🔮 AI-powered news analysis</Text>
        <Text style={styles.bulletPoint}>🔮 Sentiment analysis from social media</Text>
        <Text style={styles.bulletPoint}>🔮 Advanced risk management</Text>
        <Text style={styles.bulletPoint}>🔮 Institutional features</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Q4 2025 - Liderazgo</Text>
        <Text style={styles.bulletPoint}>🔮 API pública para desarrolladores</Text>
        <Text style={styles.bulletPoint}>🔮 Marketplace de estrategias</Text>
        <Text style={styles.bulletPoint}>🔮 White-label solutions</Text>
        <Text style={styles.bulletPoint}>🔮 Enterprise dashboard</Text>
        <Text style={styles.bulletPoint}>🔮 Multi-language support</Text>
        <Text style={styles.bulletPoint}>🔮 Global expansion</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>💡 Funcionalidades Propuestas</Text>
        <Text style={styles.subTitle}>Por la Comunidad</Text>
        <Text style={styles.bulletPoint}>• Paper trading mode</Text>
        <Text style={styles.bulletPoint}>• Strategy backtesting con datos reales</Text>
        <Text style={styles.bulletPoint}>• Options trading support</Text>
        <Text style={styles.bulletPoint}>• Forex integration</Text>
        <Text style={styles.bulletPoint}>• Advanced charting tools</Text>
        <Text style={styles.bulletPoint}>• Custom indicators builder</Text>
        
        <Text style={styles.text}>
          💬 ¿Tienes ideas? Únete a nuestra comunidad en Discord 
          para proponer nuevas funcionalidades.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎯 Objetivos a Largo Plazo</Text>
        <Text style={styles.bulletPoint}>🚀 Convertirse en el líder de AI trading</Text>
        <Text style={styles.bulletPoint}>🌍 Democratizar el acceso a trading inteligente</Text>
        <Text style={styles.bulletPoint}>🤝 Construir la mayor comunidad de traders AI</Text>
        <Text style={styles.bulletPoint}>📊 Mantener transparencia total en algoritmos</Text>
        <Text style={styles.bulletPoint}>💚 Promover trading responsable y sostenible</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    padding: theme.spacing.md,
  },
  headerGradient: {
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    ...theme.shadows.medium,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    padding: theme.spacing.md,
  },
  sidebar: {
    width: width * 0.25,
    marginRight: theme.spacing.md,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  activeNavItem: {
    backgroundColor: theme.primary + '20',
  },
  navIcon: {
    fontSize: 16,
    marginRight: theme.spacing.sm,
  },
  navTitle: {
    fontSize: 14,
    color: theme.textSecondary,
    flex: 1,
  },
  activeNavTitle: {
    color: theme.primary,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
  },
  section: {
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    ...theme.shadows.small,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.textPrimary,
    marginBottom: theme.spacing.md,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  text: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.sm,
  },
  bulletPoint: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
    marginBottom: theme.spacing.xs,
  },
  codeBlock: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: theme.success,
    backgroundColor: theme.background,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    marginTop: theme.spacing.sm,
  },
  warning: {
    fontSize: 14,
    color: theme.warning,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.warning + '10',
    borderRadius: theme.borderRadius.md,
  },
});

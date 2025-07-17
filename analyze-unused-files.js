const fs = require('fs');
const path = require('path');

// Archivos que definitivamente están siendo utilizados (desde App.js)
const usedFiles = new Set([
  // Main screens
  'src/screens/HomeScreen.tsx',
  'src/screens/GemFinderScreenNew.tsx',
  'src/screens/StrategyScreenEnhanced.tsx',
  'src/screens/TradingScreenNew.tsx',
  'src/screens/DashboardScreen.tsx',
  'src/screens/DocumentationScreen.tsx',
  'src/screens/BacktestScreen.tsx',
  'src/screens/AlertScreen.tsx',
  'src/screens/GemDetailScreenNew.tsx',
  
  // Context and theme
  'src/context/TradingContext.tsx',
  'src/theme/colors.ts',
  
  // Core services
  'src/services/apiTestService.ts',
  'src/services/firebaseInitService.ts',
  'src/services/realGemSearchService.ts',
  'src/services/autoAlertService.ts',
  'src/services/realDataService.ts',
  'src/services/enhancedAIService.ts',
  'src/services/vectorFluxAIService.ts',
  'src/services/firebaseService.ts',
  'src/services/integratedDataService.ts',
  
  // AI services
  'src/ai/vectorFluxService.js',
  'src/ai/advancedAIService.js',
  'src/ai/marketDataProcessor.js',
  
  // Utils
  'src/utils/logger.ts',
  'src/utils/inputValidator.ts',
  'src/utils/mutex.ts',
  'src/utils/circuitBreaker.ts',
  
  // Components
  'src/components/ErrorBoundary.tsx',
  
  // Styles
  'src/screens/StrategyScreenNewEnhanced_Simple.styles.ts',
]);

// Archivos que probablemente NO se están utilizando
const suspectedUnusedFiles = [
  // Duplicate/backup screens
  'src/screens/GemFinderScreen.tsx', // Reemplazado por GemFinderScreenNew.tsx
  'src/screens/GemFinderScreenNew.backup.tsx', // Backup file
  'src/screens/GemFinderScreenNew_Fixed.tsx', // Versión anterior
  'src/screens/GemFinderScreenNewReal.tsx', // Versión anterior
  'src/screens/AlertScreen_new.tsx', // Probablemente reemplazado
  'src/screens/AlertsScreen.tsx', // Versión duplicada
  'src/screens/AssetListScreen_new.tsx', // No referenciado
  'src/screens/TradingScreenFixed.tsx', // Reemplazado por TradingScreenNew.tsx
  'src/screens/TestScreen.tsx', // Screen de testing
  'src/screens/EnhancedStrategyScreen.tsx', // Reemplazado por StrategyScreenEnhanced.tsx
  'src/screens/EnhancedStrategyScreen.styles.ts', // Relacionado con el anterior
  
  // Services no utilizados
  'src/services/mockDataService.ts', // Posiblemente no usado con datos reales
  'src/services/MarketDataProcessor.ts', // Duplicado con src/ai/marketDataProcessor.js
  'src/services/aiModelService.ts', // Posiblemente no usado
  'src/services/alertFirebaseService.ts', // Posiblemente reemplazado
  'src/services/alertService.ts', // Comentado en App.js
  'src/services/marketDataService.ts', // Posiblemente reemplazado
  'src/services/realGemAnalyzer.ts', // Posiblemente integrado en otros servicios
  'src/services/historicalBacktestService.ts', // Posiblemente no usado
  
  // Utils posiblemente no usados
  'src/utils/backupManager.ts',
  'src/utils/performanceMonitor.ts',
  'src/utils/notificationManager.ts',
  'src/utils/networkManager.ts',
  'src/utils/persistenceManager.ts',
  
  // AI services posiblemente no usados
  'src/ai/marketAnalyzer.ts',
  'src/ai/strategyGenerator.ts',
  'src/ai/sentimentAnalysisService.js',
  'src/ai/useVectorFluxAI.ts',
  'src/ai/vectorFluxCore.js',
  
  // Workers
  'src/workers/BacktestWorker.ts',
  
  // Styles
  'src/styles/styles.js',
];

// Scripts de configuración y archivos de desarrollo
const developmentFiles = [
  'fix-compilation-errors.js',
  'add-technical-functions.js',
  'fix-jsx-errors.js',
  'fix-duplicates.js',
  'fix-styles.js',
  'test_ai_alerts.js',
  'firebaseConfig.js', // Reemplazado por firebaseInitService
];

// Archivos de documentación que podrían limpiarse
const documentationFiles = [
  'API_SETUP_GUIDE.md',
  'AI_IMPLEMENTATION_COMPLETE.md',
  'BUGS_AND_IMPROVEMENTS_CHECKLIST.md',
  'BUGS_AND_IMPROVEMENTS_COMPREHENSIVE.md',
  'CACHE_SYSTEM_IMPROVEMENTS.md',
  'DATA_FALLBACK_SYSTEM.md',
  'ENHANCED_FEATURES.md',
  'FIREBASE_AUTO_INIT.md',
  'FIREBASE_COLLECTIONS_SETUP.md',
  'FIREBASE_INTEGRATION.md',
  'FIREBASE_TROUBLESHOOTING.md',
  'IMPROVEMENTS.md',
  'IMPLEMENTACION_DOCUMENTACION.md',
  'LATEST_UPDATES.md',
  'REAL_GEMS_IMPROVEMENTS.md',
  'README_improved.md', // Si README.md es el principal
  'STYLE_IMPROVEMENTS.md',
  'TABS_CONTENT_OPTIMIZATION.md',
  'TABS_GRID_IMPLEMENTATION.md',
  'TECHNICAL_ROADMAP.md',
  'TRADING_IMPROVEMENTS.md',
  'VECTORFLUX_AI.md',
  'checklist_vaporrickai_bugs_mejoras.md',
];

console.log('\n🔍 ANÁLISIS DE ARCHIVOS NO UTILIZADOS\n');

console.log('📱 PANTALLAS DUPLICADAS/NO UTILIZADAS:');
console.log('=====================================');
suspectedUnusedFiles.filter(f => f.includes('src/screens')).forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n⚙️ SERVICIOS POSIBLEMENTE NO UTILIZADOS:');
console.log('=======================================');
suspectedUnusedFiles.filter(f => f.includes('src/services')).forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n🤖 SERVICIOS AI POSIBLEMENTE NO UTILIZADOS:');
console.log('=========================================');
suspectedUnusedFiles.filter(f => f.includes('src/ai')).forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n🛠️ UTILIDADES POSIBLEMENTE NO UTILIZADAS:');
console.log('=======================================');
suspectedUnusedFiles.filter(f => f.includes('src/utils')).forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n🔧 SCRIPTS DE DESARROLLO:');
console.log('========================');
developmentFiles.forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n📚 DOCUMENTACIÓN EXCESIVA:');
console.log('=========================');
documentationFiles.forEach(file => {
  console.log(`❌ ${file}`);
});

console.log('\n💾 RESUMEN DE LIMPIEZA RECOMENDADA:');
console.log('==================================');
const totalFiles = suspectedUnusedFiles.length + developmentFiles.length + documentationFiles.length;
console.log(`📊 Total de archivos que pueden eliminarse: ${totalFiles}`);
console.log(`📱 Pantallas duplicadas: ${suspectedUnusedFiles.filter(f => f.includes('src/screens')).length}`);
console.log(`⚙️ Servicios: ${suspectedUnusedFiles.filter(f => f.includes('src/services')).length}`);
console.log(`🤖 IA: ${suspectedUnusedFiles.filter(f => f.includes('src/ai')).length}`);
console.log(`🛠️ Utilidades: ${suspectedUnusedFiles.filter(f => f.includes('src/utils')).length}`);
console.log(`🔧 Scripts: ${developmentFiles.length}`);
console.log(`📚 Documentación: ${documentationFiles.length}`);

console.log('\n⚠️ ADVERTENCIAS:');
console.log('===============');
console.log('1. Revisar cada archivo antes de eliminar');
console.log('2. Hacer backup del proyecto antes de la limpieza');
console.log('3. Algunos archivos pueden tener dependencias ocultas');
console.log('4. La documentación principal debe mantenerse');

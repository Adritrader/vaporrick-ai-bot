// 🚀 OPTIMIZACIONES APLICADAS A GemFinderScreenNew.tsx

export const PERFORMANCE_CONFIG = {
  // Límites de memoria
  MAX_GEMS_IN_MEMORY: 50,
  MAX_GEMS_PER_SCAN: 4,
  
  // FlatList optimizations
  INITIAL_NUM_TO_RENDER: 10,
  MAX_TO_RENDER_PER_BATCH: 5,
  WINDOW_SIZE: 10,
  
  // Cache optimizations
  CACHE_EXPIRY_TIME: 5 * 60 * 1000, // 5 minutos
  MAX_CACHE_SIZE: 100,
  
  // Animation optimizations
  ANIMATION_DURATION: 300, // Reducido de 800ms
  USE_NATIVE_DRIVER: true
};

// Función para limpiar memoria excesiva
export const cleanupMemory = (gems: any[], maxItems: number = PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY) => {
  if (gems.length > maxItems) {
    // Mantener los más recientes basados en lastUpdated
    return gems
      .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
      .slice(0, maxItems);
  }
  return gems;
};

// Memoización para operaciones costosas
export const memoizedFilter = (gems: any[], filter: string) => {
  // Esta función debería ser memoizada con useMemo en el componente
  switch(filter) {
    case 'crypto': return gems.filter(gem => gem.type === 'crypto');
    case 'stocks': return gems.filter(gem => gem.type === 'stock'); 
    case 'high': return gems.filter(gem => gem.potential === 'high' || gem.potential === 'very_high');
    case 'medium': return gems.filter(gem => gem.potential === 'medium');
    case 'low': return gems.filter(gem => gem.riskLevel === 'low');
    default: return gems;
  }
};

console.log('📊 Configuración de optimización cargada:');
console.log(`- Máximo gems en memoria: ${PERFORMANCE_CONFIG.MAX_GEMS_IN_MEMORY}`);
console.log(`- Render inicial: ${PERFORMANCE_CONFIG.INITIAL_NUM_TO_RENDER}`);
console.log(`- Batch size: ${PERFORMANCE_CONFIG.MAX_TO_RENDER_PER_BATCH}`);

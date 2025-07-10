# Sistema de Fallback Inteligente para Datos de Mercado

## Problema Solucionado
La aplicación experimentaba rate limiting (error 429) con las APIs de datos de mercado, causando interrupciones en el servicio y mensajes de error repetitivos.

## Solución Implementada

### 1. **Sistema de Rate Limiting Inteligente**
- **Detección automática**: El servicio detecta cuando se activa el rate limiting
- **Período de espera**: Se activa un período de espera de 60 segundos cuando se detecta rate limiting
- **Indicador visual**: Se muestra un indicador en la UI para informar al usuario

### 2. **Múltiples Estrategias de Fallback**

#### Jerarquía de Fallback:
1. **Cache normal** (45 segundos)
2. **Cache extendido** (5 minutos en caso de emergencia)
3. **Mock Service** (datos realistas simulados)
4. **Datos generados** (último recurso)

#### Fuentes de Datos Alternativas:
- **Stocks**: Alpha Vantage (principal), Yahoo Finance, Financial Modeling Prep
- **Crypto**: CoinGecko (principal), Coinbase, Binance

### 3. **Mejoras en el Manejo de Errores**
- **Timeouts más largos**: 8 segundos en lugar de 5
- **Reintentos limitados**: Máximo 2 intentos antes de usar fallback
- **Abort controllers**: Para cancelar requests que tarden demasiado

### 4. **Cache Inteligente**
- **Cache persistente**: Los datos se guardan en AsyncStorage
- **Cache extendido**: En caso de rate limiting, se usa cache de hasta 5 minutos
- **Limpieza automática**: Se eliminan datos de cache antiguos

### 5. **Integración con Mock Service**
- **Datos realistas**: El mock service genera datos consistentes y realistas
- **Batch processing**: Para múltiples símbolos cuando hay rate limiting
- **Preservación de tipos**: Mantiene la diferenciación entre stocks y crypto

## Características Añadidas

### ServiceStatusIndicator Component
- **Indicador visual**: Muestra el estado del servicio en tiempo real
- **Panel de información**: Detalles sobre rate limiting, cache, etc.
- **Reset manual**: Permite resetear el rate limiting manualmente
- **Estadísticas**: Muestra métricas del servicio

### Nuevos Métodos en realDataService
- `getServiceStats()`: Obtiene estadísticas del servicio
- `resetRateLimit()`: Resetea el rate limiting manualmente
- `clearAllCache()`: Limpia todo el cache
- `isRateLimited()`: Verifica si está activo el rate limiting

## Beneficios

### Para el Usuario
- **Experiencia sin interrupciones**: Los datos siempre están disponibles
- **Transparencia**: Indicador visual del estado del servicio
- **Rendimiento mejorado**: Cache inteligente reduce requests

### Para el Desarrollo
- **Robustez**: Múltiples estrategias de fallback
- **Debugging**: Herramientas para monitorear el estado del servicio
- **Flexibilidad**: Fácil agregar nuevas fuentes de datos

## Configuración

### Parámetros Ajustables
```typescript
private requestDelay = 3000;           // Delay entre requests
private cacheExpiry = 45000;           // Cache normal (45s)
private extendedCacheExpiry = 300000;  // Cache extendido (5m)
private maxRetries = 2;                // Máximo reintentos
```

### URLs Alternativas Configuradas
```typescript
private readonly alternativeAPIs = {
  stocks: [
    'https://query1.finance.yahoo.com/v8/finance/chart/',
    'https://financialmodelingprep.com/api/v3/quote/',
    'https://api.twelvedata.com/api/v3/price?'
  ],
  crypto: [
    'https://api.coingecko.com/api/v3/simple/price',
    'https://api.coinbase.com/v2/exchange-rates',
    'https://api.binance.com/api/v3/ticker/price'
  ]
};
```

## Uso

### Indicador de Estado
- **Verde (●)**: Servicio funcionando normalmente
- **Rojo (RL XXs)**: Rate limiting activo, mostrando segundos restantes
- **Click**: Abre panel con detalles del servicio

### Fuentes de Datos
Cada MarketData incluye un campo `source`:
- `'real'`: Datos obtenidos de APIs reales
- `'cache'`: Datos del cache persistente
- `'mock'`: Datos del mock service
- `'fallback'`: Datos generados como último recurso

## Casos de Uso

### Rate Limiting Detectado
1. Se activa el período de espera
2. Se usa cache extendido si está disponible
3. Se switch automáticamente al mock service
4. Se muestra indicador visual al usuario

### API No Disponible
1. Se intenta con timeout extendido
2. Se realizan hasta 2 reintentos
3. Se usa fallback al mock service
4. Se mantiene funcionalidad completa

### Cache Agotado
1. Se intenta refresh de datos reales
2. Si falla, se usa mock service
3. Se genera datos como último recurso
4. Se mantiene experiencia de usuario

## Monitoreo

### Logs de Consola
- Rate limiting detection y activación
- Fallback usage y razones
- Cache hits y misses
- Error tracking con contexto

### Métricas del Servicio
- Estado del rate limiting
- Tamaño del cache
- Contador de reintentos
- Timestamp del último request

Esta implementación asegura que la aplicación mantenga funcionalidad completa incluso cuando las APIs externas fallan o imponen rate limiting, proporcionando una experiencia de usuario fluida y consistente.

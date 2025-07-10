# Firebase Firestore Setup Guide

## Colecciones Necesarias

### 1. `gems` Collection
Almacena las gemas/oportunidades de trading encontradas por el AI.

```javascript
{
  symbol: "BTC",                    // string
  name: "Bitcoin",                  // string
  price: 45000.50,                  // number
  marketCap: 850000000000,          // number
  volume24h: 25000000000,           // number
  change24h: 2.5,                   // number
  description: "Leading cryptocurrency", // string
  aiScore: 85.5,                    // number (0-100)
  risk: "medium",                   // string: "low", "medium", "high"
  category: "crypto",               // string
  launchDate: "2009-01-03",         // string (ISO date)
  type: "crypto",                   // string: "crypto" | "stock"
  social: {
    twitter: "@bitcoin",
    reddit: "r/bitcoin",
    telegram: "@bitcoinofficial"
  },
  fundamentals: {
    marketCapRank: 1,
    circulatingSupply: 19500000,
    totalSupply: 21000000,
    maxSupply: 21000000
  },
  aiAnalysis: {
    sentimentScore: 0.75,
    technicalScore: 0.80,
    fundamentalScore: 0.85,
    prediction: "bullish",
    confidence: 0.78
  },
  potential: "high",               // string: "low", "medium", "high", "extreme"
  timeframe: "short-term",         // string: "short-term", "medium-term", "long-term"
  lastUpdated: timestamp,          // Firestore timestamp
  createdAt: timestamp             // Firestore timestamp
}
```

### 2. `strategies` Collection
Almacena las estrategias de trading generadas por AI.

```javascript
{
  id: "strategy_001",              // string
  name: "Aggressive Growth Strategy", // string
  description: "High-risk, high-reward strategy", // string
  type: "aggressive",              // string: "conservative", "balanced", "aggressive"
  symbols: ["BTC", "ETH", "AAPL"], // array of strings
  conditions: [                    // array of objects
    {
      indicator: "RSI",
      operator: "<",
      value: 30,
      timeframe: "1h"
    }
  ],
  riskLevel: 0.8,                  // number (0-1)
  expectedReturn: 0.15,            // number (percentage as decimal)
  maxDrawdown: 0.25,               // number (percentage as decimal)
  confidence: 0.75,                // number (0-1)
  backtestResults: {
    totalReturn: 0.23,
    sharpeRatio: 1.45,
    winRate: 0.65,
    maxDrawdown: 0.18
  },
  isActive: true,                  // boolean
  createdAt: timestamp,            // Firestore timestamp
  lastModified: timestamp          // Firestore timestamp
}
```

### 3. `autoTrades` Collection
Almacena las operaciones automáticas ejecutadas.

```javascript
{
  id: "trade_001",                 // string
  symbol: "BTC",                   // string
  type: "buy",                     // string: "buy", "sell"
  strategy: "strategy_001",        // string (reference to strategy)
  amount: 1000,                    // number (USD amount)
  price: 45000.50,                 // number (execution price)
  quantity: 0.0222,                // number (asset quantity)
  status: "executed",              // string: "pending", "executed", "failed", "cancelled"
  executedAt: timestamp,           // Firestore timestamp
  aiScore: 85.5,                   // number (AI confidence at execution)
  riskScore: 0.6,                  // number (0-1)
  autoExecuted: true,              // boolean
  createdAt: timestamp,            // Firestore timestamp
  expiresAt: timestamp             // Firestore timestamp
}
```

### 4. `backtestResults` Collection
Almacena los resultados de backtesting.

```javascript
{
  id: "backtest_001",              // string
  symbol: "BTC",                   // string
  strategy: "Momentum Strategy",    // string
  period: "90d",                   // string
  startDate: "2024-01-01",         // string (ISO date)
  endDate: "2024-04-01",           // string (ISO date)
  initialCapital: 10000,           // number
  finalCapital: 12500,             // number
  totalReturn: 2500,               // number
  totalReturnPercent: 25.0,        // number
  maxDrawdown: 15.5,               // number
  sharpeRatio: 1.45,               // number
  winRate: 0.65,                   // number (0-1)
  totalTrades: 45,                 // number
  winningTrades: 29,               // number
  losingTrades: 16,                // number
  averageWin: 150.25,              // number
  averageLoss: 85.50,              // number
  profitFactor: 1.75,              // number
  equityCurve: [                   // array of objects
    {
      date: "2024-01-01",
      value: 10000
    },
    {
      date: "2024-01-02", 
      value: 10150
    }
  ],
  createdAt: timestamp             // Firestore timestamp
}
```

### 5. `marketData` Collection
Cache de datos de mercado para optimizar las consultas.

```javascript
{
  symbol: "BTC",                   // string
  name: "Bitcoin",                 // string
  price: 45000.50,                 // number
  change: 1125.25,                 // number
  changePercent: 2.56,             // number
  marketCap: 850000000000,         // number
  volume24h: 25000000000,          // number
  high24h: 46000,                  // number
  low24h: 44500,                   // number
  type: "crypto",                  // string: "crypto" | "stock"
  exchange: "binance",             // string
  lastUpdated: timestamp,          // Firestore timestamp
  source: "api"                    // string: "api", "cache", "fallback"
}
```

### 6. `opportunities` Collection
Oportunidades de trading identificadas por el AI.

```javascript
{
  symbol: "ETH",                   // string
  type: "breakout",                // string: "breakout", "reversal", "momentum", "arbitrage"
  confidence: 0.85,                // number (0-1)
  expectedReturn: 0.12,            // number (percentage as decimal)
  riskLevel: 0.4,                  // number (0-1)
  timeframe: "1-3 days",           // string
  reasoning: [                     // array of strings
    "RSI oversold condition",
    "Volume spike detected",
    "Support level bounce"
  ],
  indicators: {                    // object
    rsi: 28.5,
    macd: 0.025,
    volume: 150.5,
    support: 3250.0,
    resistance: 3650.0
  },
  status: "active",                // string: "active", "expired", "triggered"
  alertSent: false,                // boolean
  createdAt: timestamp,            // Firestore timestamp
  expiresAt: timestamp             // Firestore timestamp
}
```

### 7. `settings` Collection
Configuraciones de usuario y sistema.

```javascript
{
  userId: "user_001",              // string
  tradingAmount: 1000,             // number (default trading amount)
  maxTrades: 10,                   // number (max concurrent trades)
  riskTolerance: "medium",         // string: "low", "medium", "high"
  autoTradingEnabled: true,        // boolean
  notifications: {
    email: true,
    push: true,
    sms: false
  },
  themePreference: "dark",         // string: "light", "dark", "auto"
  language: "en",                  // string
  timezone: "America/New_York",    // string
  lastLogin: timestamp,            // Firestore timestamp
  createdAt: timestamp,            // Firestore timestamp
  updatedAt: timestamp             // Firestore timestamp
}
```

## Firestore Security Rules

**IMPORTANTE: Estas reglas son para desarrollo. En producción, implementa autenticación adecuada.**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // REGLAS PARA DESARROLLO - Acceso completo
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### Reglas Alternativas para Producción (usar cuando se implemente autenticación):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Colecciones públicas de solo lectura
    match /gems/{gemId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /marketData/{dataId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    match /opportunities/{oppId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Colecciones privadas por usuario
    match /strategies/{strategyId} {
      allow read, write: if request.auth != null && 
        (resource == null || request.auth.uid == resource.data.userId);
    }
    
    match /autoTrades/{tradeId} {
      allow read, write: if request.auth != null && 
        (resource == null || request.auth.uid == resource.data.userId);
    }
    
    match /backtestResults/{resultId} {
      allow read, write: if request.auth != null && 
        (resource == null || request.auth.uid == resource.data.userId);
    }
    
    match /settings/{settingId} {
      allow read, write: if request.auth != null && 
        (resource == null || request.auth.uid == resource.data.userId);
    }
  }
}
```

## Pasos para Configurar Firebase

### ⚠️ SOLUCIÓN PARA ERROR DE PERMISOS ⚠️

Si recibes el error `Missing or insufficient permissions`, sigue estos pasos:

1. **Ve a Firebase Console > Firestore Database > Reglas**
2. **Reemplaza las reglas actuales con estas (para desarrollo):**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
3. **Haz clic en "Publicar" para aplicar las reglas**
4. **Espera 1-2 minutos para que se propaguen los cambios**
5. **Reinicia la aplicación**

### Configuración Inicial:

1. **Crear las colecciones manualmente en Firestore Console:**
   - Ve a Firebase Console > Firestore Database
   - Si no hay colecciones, la app las creará automáticamente
   - Usa los esquemas de arriba como referencia

2. **Configurar índices compuestos (opcional para desarrollo):**
   ```javascript
   // Gems collection indexes
   - symbol ASC, lastUpdated DESC
   - category ASC, aiScore DESC
   - type ASC, potential DESC
   
   // Market data indexes  
   - symbol ASC, lastUpdated DESC
   - type ASC, lastUpdated DESC
   
   // Opportunities indexes
   - status ASC, createdAt DESC
   - confidence DESC, createdAt DESC
   ```

3. **Verificar configuración:**
   - Ejecuta la app y verifica que no haya errores de permisos
   - Comprueba que los datos se guardan correctamente en cada colección
   - El indicador Firebase debe mostrar "Ready" en verde

### Solución de Problemas:

**Error: "Missing or insufficient permissions"**
- Verifica que las reglas de Firestore permitan acceso completo
- Asegúrate de que el proyecto Firebase esté activo
- Comprueba que la configuración en `firebaseConfig.js` sea correcta

**Error: "Network request failed"**
- Verifica tu conexión a internet
- Comprueba que Firebase esté habilitado en tu proyecto
- Asegúrate de que Firestore esté inicializado

**La app funciona pero no guarda datos**
- Verifica que las reglas de Firestore permitan escritura
- Comprueba los logs de la consola para errores específicos
- Asegúrate de que el proyecto Firebase tenga cuota disponible

La aplicación ahora debería funcionar correctamente con Firebase configurado!

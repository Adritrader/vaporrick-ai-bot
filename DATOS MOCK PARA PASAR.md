📊 ANÁLISIS DE DATOS: MOCK vs REALES
🔴 DATOS COMPLETAMENTE MOCK (Simulados):
1. Trading Screen (TradingScreenFixed.tsx)
✅ Market Opportunities: Hardcodeadas (BTC, ETH, TSLA)
✅ Auto Trades: Demo trades con datos simulados
✅ Price Updates: Simulación matemática con volatilidad
✅ Trading Performance: Métricas calculadas artificialmente
2. Strategy Screen (StrategyScreenNewEnhanced.tsx)
✅ AI Models: Completamente simulados (accuracy, status)
✅ Market Analysis: Generación algorítmica de análisis
✅ Strategy Performance: Backtests con datos mock
✅ Technical Signals: RSI, MACD, volume simulados
✅ Sentiment Analysis: Datos de redes sociales simulados
3. Backtest Service (historicalBacktestService.ts)
✅ Historical Prices: Generación matemática con volatilidad
✅ Backtest Results: Simulación completa de trades
✅ Performance Metrics: Sharpe ratio, drawdown calculados
✅ Trade Execution: Lógica simulada de entry/exit
4. Dashboard Screen (DashboardScreen.tsx)
✅ Portfolio Stats: Mock de ganancias/pérdidas
✅ Today/Weekly Gains: Multiplicadores artificiales
✅ Alerts: Array hardcodeado de notificaciones
✅ Position Data: Trades simulados
5. Alert Screen (AlertScreen.tsx)
✅ Price Alerts: Generación de precios aleatorios
✅ Smart Alerts: Datos mock de condiciones
🟢 DATOS REALES (o INTENTAN serlo):
1. Gem Finder Screen (GemFinderScreenNew.tsx)
🔄 Usa integratedDataService que intenta APIs reales
🔄 Firebase caching para persistencia
🔄 Alpha Vantage, CoinGecko como fuentes
2. Real Data Service (realDataService.ts)
🔄 APIs configuradas: CoinGecko, Yahoo Finance, Alpha Vantage
🔄 Cache strategy: AsyncStorage con 2min expiry
🔄 Rate limiting: Control de requests
⚠️ PERO: Fallback inmediato a mockDataService en errores
3. Integrated Data Service (integratedDataService.ts)
🔄 Firebase integration para cache
🔄 Real API calls con fallback strategy
🔄 Batch processing de símbolos
🔄 Cache management inteligente
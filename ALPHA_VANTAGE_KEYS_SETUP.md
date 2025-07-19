# CONFIGURACIÓN DE MÚLTIPLES API KEYS PARA ALPHA VANTAGE
# ================================================================

## ¿Cómo conseguir más API Keys?

1. **Visita Alpha Vantage**: https://www.alphavantage.co/support/#api-key
2. **Registra múltiples cuentas** (puedes usar emails diferentes)
3. **Copia cada API key** y añádela abajo
4. **¡Tendrás 5,000 requests/día!** (10 keys × 500 requests cada una)

## ¿Cómo añadir las keys al código?

### Opción 1: Editar el archivo apiKeyRotationManager.ts

Abre el archivo: `src/services/apiKeyRotationManager.ts`

Busca esta sección (línea ~18):
```typescript
private readonly ALPHA_VANTAGE_KEYS = [
  { key: 'CPIIA8O6V6AWJSCE', name: 'Key_1' }, // Tu key actual
  { key: 'YOUR_KEY_2_HERE', name: 'Key_2' },
  { key: 'YOUR_KEY_3_HERE', name: 'Key_3' },
  // ... etc
];
```

Y reemplaza `YOUR_KEY_X_HERE` con tus keys reales.

### Opción 2: Usar el archivo .env (Recomendado)

Añade estas líneas a tu archivo `.env`:
```
ALPHA_VANTAGE_KEY_1=CPIIA8O6V6AWJSCE
ALPHA_VANTAGE_KEY_2=TU_SEGUNDA_KEY_AQUI
ALPHA_VANTAGE_KEY_3=TU_TERCERA_KEY_AQUI
ALPHA_VANTAGE_KEY_4=TU_CUARTA_KEY_AQUI
ALPHA_VANTAGE_KEY_5=TU_QUINTA_KEY_AQUI
ALPHA_VANTAGE_KEY_6=TU_SEXTA_KEY_AQUI
ALPHA_VANTAGE_KEY_7=TU_SEPTIMA_KEY_AQUI
ALPHA_VANTAGE_KEY_8=TU_OCTAVA_KEY_AQUI
ALPHA_VANTAGE_KEY_9=TU_NOVENA_KEY_AQUI
ALPHA_VANTAGE_KEY_10=TU_DECIMA_KEY_AQUI
```

## ¿Cómo funciona la rotación automática?

1. **Inicio del día**: Todas las keys tienen 500 requests disponibles
2. **Uso automático**: El sistema usa la key con menos requests usados
3. **Rotación inteligente**: Cuando una key se agota, pasa automáticamente a la siguiente
4. **Monitoreo**: Puedes ver el estado de todas las keys con el botón 🔬
5. **Reset automático**: Cada día a las 00:00 UTC, todas las keys se resetean

## ¿Qué beneficios obtienes?

### Con 1 key (actual):
- ❌ 500 requests/día
- ❌ Si se agota, tienes que esperar hasta mañana
- ❌ Errores frecuentes de rate limit

### Con 10 keys (recomendado):
- ✅ 5,000 requests/día (10x más)
- ✅ Rotación automática sin interrupciones
- ✅ Scanning de stocks mucho más confiable
- ✅ Prácticamente nunca te quedarás sin requests

## Ejemplos de Keys válidas de Alpha Vantage:
```
CPIIA8O6V6AWJSCE (tu key actual)
8J7X2K9P4M6N1Q3R
F5G8H2J4K7L9M1N6
P3Q7R8S2T5U9V1W4
A6B9C1D4E7F0G3H8
```

## Comandos útiles:

### Ver estado de todas las keys:
Presiona el botón 🔬 en la app y selecciona "View Full Report"

### Reset manual de todas las keys (para testing):
En el código puedes llamar: `apiKeyManager.resetAllKeys()`

### Añadir una nueva key manualmente:
En el código puedes llamar: `apiKeyManager.addNewKey('TU_NUEVA_KEY', 'Key_11')`

## ¡IMPORTANTE!

- 🔒 **NUNCA** compartas tus API keys públicamente
- 📝 **GUARDA** una copia de backup de tus keys
- 🔄 **ROTA** las keys si sospechas que fueron comprometidas
- 📊 **MONITOREA** el uso diario para optimizar tu consumo

## ¿Problemas?

Si tienes problemas:
1. Verifica que las keys sean válidas en: https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=TU_KEY_AQUI
2. Revisa los logs de la app para ver qué key está fallando
3. Usa el botón 🔬 para diagnosticar el estado de las APIs

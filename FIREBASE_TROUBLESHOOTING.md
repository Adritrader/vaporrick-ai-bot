# Solución Completa para Errores de Firebase

Esta guía resuelve los errores más comunes de Firebase en la aplicación VaporrICK AI Bot.

## 🚨 Errores Comunes y Soluciones

### Error 1: "Missing or insufficient permissions"

**Causa**: Las reglas de seguridad de Firestore no permiten acceso completo.

**Solución**:
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Selecciona tu proyecto `vaporrick-ai-bot`
3. Ve a **Firestore Database** > **Reglas**
4. Reemplaza el contenido actual con:

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

5. Haz clic en **"Publicar"**
6. Espera 1-2 minutos para que se propaguen los cambios
7. Reinicia la aplicación

---

### Error 2: "The query requires an index"

**Causa**: Firebase necesita índices para consultas complejas.

**Soluciones (elige una)**:

#### Opción A: Usar el enlace automático
1. Haz clic en el enlace que aparece en el error
2. En Firebase Console, haz clic en **"Crear índice"**
3. Espera 1-2 minutos a que se complete
4. Reinicia la aplicación

#### Opción B: Usar nuestro script automático
```bash
npm run setup-firebase-indexes
```

#### Opción C: Configuración manual
Ve a [Firebase Console](https://console.firebase.google.com/) > Firestore > Índices y crea estos índices:

1. **Collection**: `opportunities`
   - **Fields**: 
     - `expiresAt` (Ascending)
     - `confidence` (Descending)

2. **Collection**: `gems`
   - **Fields**:
     - `type` (Ascending)
     - `aiScore` (Descending)

3. **Collection**: `autoTrades`
   - **Fields**:
     - `status` (Ascending)  
     - `timestamp` (Descending)

---

## 🔄 Reinicialización Completa

Si tienes múltiples errores, sigue estos pasos en orden:

### Paso 1: Configurar Reglas de Firestore
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

### Paso 2: Configurar Índices
```bash
npm run setup-firebase-indexes
```

### Paso 3: Inicializar Datos
```bash
npm run init-firebase
```

### Paso 4: Verificar la App
```bash
npm start
```

---

## 🛠️ Scripts Disponibles

### `npm run setup-firebase-indexes`
Configura automáticamente todos los índices necesarios para las consultas de la app.

### `npm run init-firebase`  
Inicializa Firebase con datos de ejemplo (gemas, estrategias, trades, etc.).

### `npm start`
Inicia la aplicación en modo desarrollo.

---

## 🔍 Verificación de Estado

La aplicación incluye indicadores visuales para verificar el estado de Firebase:

### FirebaseInitIndicator
- 🟢 **Verde**: Firebase configurado correctamente
- 🟡 **Amarillo**: Inicializando datos
- 🔴 **Rojo**: Error detectado (toca para ver solución)

### En caso de error
- Toca el indicador rojo para ver instrucciones específicas
- Se abrirá un modal con pasos detallados para resolver el problema
- Incluye enlaces directos a Firebase Console

---

## 📱 Testing en Diferentes Plataformas

### Web
```bash
npm run web
```

### Android
```bash
npm run android
```

### iOS
```bash
npm run ios
```

---

## 🚀 Configuración para Producción

**Importante**: Las reglas actuales son para desarrollo. En producción:

1. Implementa autenticación de usuarios
2. Usa reglas más restrictivas:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Datos públicos
    match /gems/{gemId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // Datos privados por usuario
    match /strategies/{strategyId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
    
    match /autoTrades/{tradeId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
    }
  }
}
```

---

## 🆘 Solución de Problemas Avanzados

### La app no conecta a Firebase
1. Verifica tu conexión a internet
2. Comprueba que el proyecto Firebase esté activo
3. Revisa la configuración en `src/services/firebaseService.ts`

### Los datos no se guardan
1. Verifica las reglas de Firestore
2. Comprueba los logs de la consola del navegador
3. Asegúrate de que no hayas excedido las cuotas gratuitas

### Errores de red intermitentes
1. La app tiene modo offline automático
2. Los datos se cachean localmente
3. Se sincroniza cuando vuelve la conexión

---

## 📞 Soporte

Si sigues teniendo problemas después de seguir esta guía:

1. Revisa los logs de la consola del navegador/simulador
2. Comprueba el estado en Firebase Console
3. Verifica que todos los scripts se ejecutaron correctamente

La aplicación está diseñada para ser resiliente y funcionar incluso con problemas de conexión a Firebase, usando fallbacks locales cuando es necesario.

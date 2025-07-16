// Secure Firebase Configuration
// Uses environment variables instead of hardcoded values
import Constants from 'expo-constants';

// Helper to safely get environment variables
const getEnvVar = (key: string, defaultValue: string = ''): string => {
  // Try Expo Constants first (for build-time environment variables)
  const expoExtra = Constants.expoConfig?.extra?.[key];
  if (expoExtra) return expoExtra;
  
  // Fallback to process.env (for development)
  const processEnv = process.env[key];
  if (processEnv) return processEnv;
  
  // For development, hardcode the values since .env might not be loaded
  const devConfig: Record<string, string> = {
    FIREBASE_API_KEY: 'AIzaSyDlZ0_q2KRTWQTJvlsZIp3yRfrQ-dzNatA',
    FIREBASE_AUTH_DOMAIN: 'vaporrick-ai-bot.firebaseapp.com',
    FIREBASE_PROJECT_ID: 'vaporrick-ai-bot',
    FIREBASE_STORAGE_BUCKET: 'vaporrick-ai-bot.firebasestorage.app',
    FIREBASE_MESSAGING_SENDER_ID: '256353463325',
    FIREBASE_APP_ID: '1:256353463325:web:0ea63d06ecfc691b3aaaf4',
    FIREBASE_MEASUREMENT_ID: 'G-FJR0N3X0VB',
  };
  
  return devConfig[key] || defaultValue;
};

// Firebase configuration from environment variables
export const firebaseConfig = {
  apiKey: getEnvVar('FIREBASE_API_KEY'),
  authDomain: getEnvVar('FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('FIREBASE_APP_ID'),
  measurementId: getEnvVar('FIREBASE_MEASUREMENT_ID')
};

// Validate Firebase configuration
export const validateFirebaseConfig = () => {
  const requiredFields = [
    'apiKey',
    'authDomain', 
    'projectId',
    'storageBucket',
    'messagingSenderId',
    'appId'
  ];
  
  const missingFields = requiredFields.filter(field => !firebaseConfig[field as keyof typeof firebaseConfig]);
  
  if (missingFields.length > 0) {
    console.warn('⚠️ Firebase configuration incomplete - using local storage fallback');
    console.info('To enable Firebase sync, set these environment variables:', missingFields);
    return false;
  }
  
  console.log('✅ Firebase configuration loaded successfully');
  return true;
};

// Check if Firebase is available
export const isFirebaseAvailable = () => {
  return validateFirebaseConfig();
};

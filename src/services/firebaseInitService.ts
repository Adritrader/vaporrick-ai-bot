import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// Import Firebase config from the main config file
const firebaseConfig = {
  apiKey: "AIzaSyDlZ0_q2KRTWQTJvlsZIp3yRfrQ-dzNatA",
  authDomain: "vaporrick-ai-bot.firebaseapp.com",
  projectId: "vaporrick-ai-bot",
  storageBucket: "vaporrick-ai-bot.firebasestorage.app",
  messagingSenderId: "256353463325",
  appId: "1:256353463325:web:0ea63d06ecfc691b3aaaf4",
  measurementId: "G-FJR0N3X0VB"
};

// Initialize Firebase app
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Simple export for compatibility
export default {
  db,
  auth,
  storage,
  app
};

#!/usr/bin/env node

/**
 * Script para inicializar Firebase Firestore con datos de ejemplo
 * Uso: node scripts/initFirebase.js
 */

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  serverTimestamp 
} = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDlZ0_q2KRTWQTJvlsZIp3yRfrQ-dzNatA",
  authDomain: "vaporrick-ai-bot.firebaseapp.com",
  projectId: "vaporrick-ai-bot",
  storageBucket: "vaporrick-ai-bot.firebasestorage.app",
  messagingSenderId: "256353463325",
  appId: "1:256353463325:web:0ea63d06ecfc691b3aaaf4",
  measurementId: "G-FJR0N3X0VB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sample data
const COLLECTIONS_DATA = {
  gems: [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 43250.00,
      marketCap: 845000000000,
      volume24h: 23450000000,
      change24h: 2.35,
      description: 'The original cryptocurrency and digital store of value',
      aiScore: 8.7,
      risk: 'Medium',
      category: 'Layer 1',
      launchDate: '2009-01-03',
      type: 'crypto',
      social: { twitter: true, telegram: true, discord: true },
      fundamentals: { team: 9, tech: 10, tokenomics: 9, community: 10 },
      aiAnalysis: 'Strong institutional adoption and store of value narrative.',
      potential: 'High',
      timeframe: '3-6 months',
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      price: 2650.00,
      marketCap: 318000000000,
      volume24h: 15200000000,
      change24h: 3.12,
      description: 'Leading smart contract platform with extensive DeFi ecosystem',
      aiScore: 9.1,
      risk: 'Medium',
      category: 'Layer 1',
      launchDate: '2015-07-30',
      type: 'crypto',
      social: { twitter: true, telegram: true, discord: true },
      fundamentals: { team: 10, tech: 9, tokenomics: 8, community: 9 },
      aiAnalysis: 'Ethereum continues to dominate smart contract space.',
      potential: 'Very High',
      timeframe: '2-4 months',
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }
  ],
  
  strategies: [
    {
      name: 'AI Momentum Pro',
      type: 'momentum',
      parameters: {
        confidence_threshold: 0.75,
        risk_threshold: 0.25,
        position_size: 0.1,
        stop_loss: 0.08,
        take_profit: 0.15,
        holding_period_max: 30
      },
      isActive: true,
      performance: {
        totalReturn: 23.5,
        sharpeRatio: 1.8,
        maxDrawdown: -12.3,
        winRate: 67.5,
        totalTrades: 45
      },
      createdAt: serverTimestamp()
    }
  ],

  marketData: [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: 43250.00,
      change: 987.50,
      changePercent: 2.35,
      marketCap: 845000000000,
      volume24h: 23450000000,
      type: 'crypto',
      createdAt: serverTimestamp(),
      lastUpdated: serverTimestamp()
    }
  ],

  opportunities: [
    {
      symbol: 'SOL',
      name: 'Solana',
      currentPrice: 98.45,
      predictedPrice: 125.60,
      confidence: 0.84,
      timeframe: '2-4 weeks',
      analysis: 'Strong ecosystem growth with increasing DeFi activity.',
      type: 'breakout',
      expectedReturn: 27.6,
      riskScore: 6.2,
      autoExecuted: false,
      expiresAt: new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)), // 2 weeks from now
      createdAt: serverTimestamp()
    }
  ],

  settings: {
    app: {
      version: '1.0.0',
      theme: 'dark',
      notifications: true,
      autoRefresh: true,
      refreshInterval: 30000
    },
    trading: {
      defaultPositionSize: 0.1,
      maxPositions: 10,
      riskTolerance: 'medium',
      autoTradeEnabled: true
    },
    ai: {
      confidenceThreshold: 0.75,
      riskThreshold: 0.25,
      modelVersion: 'v2.1',
      lastTrainingDate: new Date().toISOString()
    },
    firebase: {
      syncEnabled: true,
      cacheSize: 1000,
      offlineMode: true,
      lastSync: serverTimestamp()
    },
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp()
  }
};

async function initializeFirestore() {
  try {
    console.log('🔥 Starting Firebase Firestore initialization...');

    // Check if collections already exist
    const gemsSnapshot = await getDocs(collection(db, 'gems'));
    if (!gemsSnapshot.empty) {
      console.log('✅ Firestore already initialized with', gemsSnapshot.size, 'gems');
      return;
    }

    // Initialize each collection
    for (const [collectionName, data] of Object.entries(COLLECTIONS_DATA)) {
      console.log(`📊 Initializing ${collectionName} collection...`);

      if (collectionName === 'settings') {
        // Settings is a single document
        await setDoc(doc(db, collectionName, 'app_settings'), data);
        console.log(`✅ Added app settings`);
      } else {
        // Other collections have multiple documents
        for (let i = 0; i < data.length; i++) {
          const docRef = doc(collection(db, collectionName));
          await setDoc(docRef, data[i]);
        }
        console.log(`✅ Added ${data.length} documents to ${collectionName}`);
      }
    }

    console.log('🎉 Firebase Firestore initialization completed successfully!');
    console.log('');
    console.log('📱 Your app now has sample data for:');
    console.log('   • Cryptocurrency and stock gems');
    console.log('   • Trading strategies');
    console.log('   • Market data cache');
    console.log('   • Investment opportunities');
    console.log('   • App settings');
    console.log('');
    console.log('🚀 You can now run your React Native app!');
    
  } catch (error) {
    console.error('❌ Error initializing Firestore:', error);
    
    if (error.code === 'permission-denied') {
      console.log('');
      console.log('🔒 Permission denied. Please check:');
      console.log('   1. Firebase project is set up correctly');
      console.log('   2. Firestore rules allow write access');
      console.log('   3. API key is valid');
      console.log('');
      console.log('💡 You can update Firestore rules to allow writes:');
      console.log('   rules_version = "2";');
      console.log('   service cloud.firestore {');
      console.log('     match /databases/{database}/documents {');
      console.log('       match /{document=**} {');
      console.log('         allow read, write: if true;');
      console.log('       }');
      console.log('     }');
      console.log('   }');
    }
    
    process.exit(1);
  }
}

// Run the initialization
if (require.main === module) {
  initializeFirestore()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { initializeFirestore };

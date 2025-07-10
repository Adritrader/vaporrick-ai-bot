#!/usr/bin/env node

/**
 * Firebase Debug and Setup Tool
 * Helps diagnose and fix common Firebase configuration issues
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Debug and Setup Tool');
console.log('================================');

// Check if we're in the right directory
const packageJsonPath = path.join(process.cwd(), 'package.json');
if (!fs.existsSync(packageJsonPath)) {
  console.error('❌ Error: package.json not found. Please run this from the project root.');
  process.exit(1);
}

// Check if Firebase is installed
console.log('\n📦 Checking Firebase installation...');
try {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const hasFirebase = packageJson.dependencies?.firebase || packageJson.devDependencies?.firebase;
  
  if (hasFirebase) {
    console.log('✅ Firebase is installed');
  } else {
    console.log('❌ Firebase not found in dependencies');
    console.log('Installing Firebase...');
    execSync('npm install firebase', { stdio: 'inherit' });
  }
} catch (error) {
  console.error('❌ Error checking Firebase installation:', error.message);
}

// Check Firebase config file
console.log('\n🔧 Checking Firebase configuration...');
const firebaseConfigPath = path.join(process.cwd(), 'firebaseConfig.js');
const firebaseConfigSrcPath = path.join(process.cwd(), 'src', 'services', 'firebaseService.ts');

if (fs.existsSync(firebaseConfigPath)) {
  console.log('✅ Firebase config found at root');
} else if (fs.existsSync(firebaseConfigSrcPath)) {
  console.log('✅ Firebase config found in services');
} else {
  console.log('❌ Firebase config not found');
  console.log('Please make sure firebaseConfig.js exists with your Firebase project settings');
}

// Generate Firebase rules for development
console.log('\n📋 Generating development Firebase rules...');
const firebaseRules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // DEVELOPMENT RULES - Allow all access
    // ⚠️ Change these for production!
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;

const rulesPath = path.join(process.cwd(), 'firestore.rules');
fs.writeFileSync(rulesPath, firebaseRules);
console.log('✅ Generated firestore.rules for development');

// Create Firebase init script
console.log('\n🚀 Creating Firebase initialization script...');
const initScript = `
// Firebase Initialization Test Script
// Run this in your browser console or as a Node.js script

import { firebaseInitService } from './src/services/firebaseInitService';
import { firebaseService } from './src/services/firebaseService';

async function testFirebase() {
  console.log('🔥 Testing Firebase connection...');
  
  // Test connection
  const connectionTest = await firebaseService.testConnection();
  if (!connectionTest.success) {
    console.error('❌ Connection failed:', connectionTest.error);
    return;
  }
  
  console.log('✅ Connection successful!');
  
  // Test initialization
  console.log('📦 Testing initialization...');
  const initSuccess = await firebaseInitService.initializeCollections();
  
  if (initSuccess) {
    console.log('✅ Initialization successful!');
    
    // Get stats
    const stats = await firebaseInitService.getInitStats();
    console.log('📊 Database stats:', stats);
  } else {
    console.error('❌ Initialization failed');
  }
}

// Run the test
testFirebase().catch(console.error);
`;

const testScriptPath = path.join(process.cwd(), 'firebase-test.js');
fs.writeFileSync(testScriptPath, initScript);
console.log('✅ Created firebase-test.js');

// Print instructions
console.log('\n📖 Setup Instructions:');
console.log('======================');
console.log('1. Go to Firebase Console: https://console.firebase.google.com');
console.log('2. Select your project: vaporrick-ai-bot');
console.log('3. Go to Firestore Database > Rules');
console.log('4. Replace the rules with the content from firestore.rules');
console.log('5. Click "Publish" and wait 1-2 minutes');
console.log('6. Restart your app');

console.log('\n🔧 Common Issues and Solutions:');
console.log('===============================');
console.log('❌ "Missing or insufficient permissions"');
console.log('   → Apply the rules from firestore.rules in Firebase Console');
console.log('');
console.log('❌ "Network request failed"');
console.log('   → Check internet connection and Firebase project status');
console.log('');
console.log('❌ "Firebase not initialized"');
console.log('   → Check firebaseConfig.js has correct project settings');
console.log('');
console.log('❌ App works but data not saved');
console.log('   → Verify Firestore rules allow write operations');

console.log('\n✅ Setup complete! Follow the instructions above to fix Firebase permissions.');

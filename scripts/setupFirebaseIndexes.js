#!/usr/bin/env node

/**
 * Script para configurar automáticamente los índices de Firestore
 * Este script configura los índices necesarios para las consultas de la app
 */

const { execSync } = require('child_process');
const path = require('path');

// Firebase project configuration
const PROJECT_ID = 'vaporrick-ai-bot';

// Required indexes for the app
const INDEXES = [
  {
    collection: 'opportunities',
    fields: [
      { field: 'expiresAt', mode: 'ASCENDING' },
      { field: 'confidence', mode: 'DESCENDING' }
    ],
    description: 'For ordering opportunities by expiration and confidence'
  },
  {
    collection: 'gems',
    fields: [
      { field: 'type', mode: 'ASCENDING' },
      { field: 'aiScore', mode: 'DESCENDING' }
    ],
    description: 'For filtering gems by type and ordering by AI score'
  },
  {
    collection: 'gems',
    fields: [
      { field: 'category', mode: 'ASCENDING' },
      { field: 'lastUpdated', mode: 'DESCENDING' }
    ],
    description: 'For filtering gems by category and ordering by update time'
  },
  {
    collection: 'marketData',
    fields: [
      { field: 'type', mode: 'ASCENDING' },
      { field: 'lastUpdated', mode: 'DESCENDING' }
    ],
    description: 'For filtering market data by type and ordering by update time'
  },
  {
    collection: 'autoTrades',
    fields: [
      { field: 'status', mode: 'ASCENDING' },
      { field: 'timestamp', mode: 'DESCENDING' }
    ],
    description: 'For filtering auto trades by status and ordering by timestamp'
  },
  {
    collection: 'strategies',
    fields: [
      { field: 'isActive', mode: 'ASCENDING' },
      { field: 'createdAt', mode: 'DESCENDING' }
    ],
    description: 'For filtering strategies by active status and ordering by creation time'
  }
];

/**
 * Generate Firebase CLI command for creating an index
 */
function generateIndexCommand(index) {
  const fieldsStr = index.fields.map(field => 
    `${field.field}:${field.mode.toLowerCase()}`
  ).join(',');
  
  return `firebase firestore:indexes:create --project=${PROJECT_ID} --collection-group=${index.collection} --field-config="${fieldsStr}"`;
}

/**
 * Create Firebase indexes configuration file
 */
function createIndexesConfig() {
  const config = {
    indexes: INDEXES.map(index => ({
      collectionGroup: index.collection,
      queryScope: 'COLLECTION',
      fields: index.fields.map(field => ({
        fieldPath: field.field,
        order: field.mode
      }))
    }))
  };

  const configPath = path.join(__dirname, '..', 'firestore.indexes.json');
  require('fs').writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Created indexes configuration: ${configPath}`);
  return configPath;
}

/**
 * Generate manual index creation URLs
 */
function generateIndexUrls() {
  console.log('\n📝 Manual Index Creation URLs:');
  console.log('If Firebase CLI is not available, create these indexes manually:\n');
  
  INDEXES.forEach((index, i) => {
    console.log(`${i + 1}. ${index.description}`);
    console.log(`   Collection: ${index.collection}`);
    console.log(`   Fields: ${index.fields.map(f => `${f.field} (${f.mode})`).join(', ')}`);
    console.log(`   URL: https://console.firebase.google.com/project/${PROJECT_ID}/firestore/indexes`);
    console.log('');
  });
}

/**
 * Main function to setup indexes
 */
async function setupIndexes() {
  try {
    console.log('🔥 Setting up Firebase Firestore indexes...');
    console.log(`Project: ${PROJECT_ID}\n`);

    // Create indexes configuration file
    const configPath = createIndexesConfig();

    // Try to use Firebase CLI if available
    try {
      console.log('🔧 Checking Firebase CLI...');
      execSync('firebase --version', { stdio: 'pipe' });
      console.log('✅ Firebase CLI found');

      // Deploy indexes
      console.log('📊 Deploying indexes...');
      execSync(`firebase deploy --only firestore:indexes --project=${PROJECT_ID}`, { 
        stdio: 'inherit',
        cwd: path.dirname(configPath)
      });
      
      console.log('\n🎉 Indexes deployed successfully!');
      console.log('⏳ Indexes may take a few minutes to build.');
      
    } catch (cliError) {
      console.log('⚠️ Firebase CLI not available or not logged in');
      console.log('📝 Creating manual setup instructions...');
      generateIndexUrls();
    }

  } catch (error) {
    console.error('❌ Error setting up indexes:', error.message);
    console.log('\n🔧 Alternative solutions:');
    console.log('1. Install Firebase CLI: npm install -g firebase-tools');
    console.log('2. Login to Firebase: firebase login');
    console.log('3. Run this script again');
    console.log('4. Or create indexes manually using the URLs above');
  }
}

// Run the setup
if (require.main === module) {
  setupIndexes()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { setupIndexes, createIndexesConfig };

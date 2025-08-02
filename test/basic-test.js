#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Basic test runner for the Paprika MCP Extension
console.log('🧪 Running basic tests for Paprika MCP Extension...\n');

// Test 1: Check if database file exists
console.log('1. Testing database file existence...');
const dbPath = path.join(__dirname, '../data/Paprika.sqlite');
if (fs.existsSync(dbPath)) {
  console.log('✅ Database file found at:', dbPath);
} else {
  console.log('❌ Database file not found at:', dbPath);
  console.log('   Please ensure Paprika.sqlite is in the data/ directory');
}

// Test 2: Check if required dependencies are installed
console.log('\n2. Testing dependencies...');
try {
  require('@modelcontextprotocol/sdk/server/index.js');
  console.log('✅ @modelcontextprotocol/sdk found');
} catch (error) {
  console.log('❌ @modelcontextprotocol/sdk not found - run npm install');
}

try {
  require('sqlite3');
  console.log('✅ sqlite3 found');
} catch (error) {
  console.log('❌ sqlite3 not found - run npm install');
}

// Test 3: Test database connection
console.log('\n3. Testing database connection...');
if (fs.existsSync(dbPath)) {
  try {
    const PaprikaDatabase = require('../server/database.js');
    const db = new PaprikaDatabase(dbPath, false);
    
    db.connect().then(async () => {
      console.log('✅ Database connection successful');
      
      // Test a simple query
      try {
        const categories = await db.listCategories();
        console.log(`✅ Database query successful - found ${categories.length} categories`);
        
        const recentRecipes = await db.getRecentRecipes(365, 5);
        console.log(`✅ Recipe query successful - found ${recentRecipes.length} recent recipes`);
        
        await db.close();
        console.log('✅ Database connection closed successfully');
      } catch (queryError) {
        console.log('❌ Database query failed:', queryError.message);
        await db.close();
      }
    }).catch(error => {
      console.log('❌ Database connection failed:', error.message);
    });
  } catch (error) {
    console.log('❌ Database module error:', error.message);
  }
} else {
  console.log('⏭️  Skipping database test - file not found');
}

// Test 4: Test tool definitions
console.log('\n4. Testing tool definitions...');
try {
  const { TOOLS } = require('../server/tools.js');
  console.log(`✅ Tools loaded - found ${TOOLS.length} tools:`);
  TOOLS.forEach(tool => {
    console.log(`   - ${tool.name}: ${tool.description.substring(0, 60)}...`);
  });
} catch (error) {
  console.log('❌ Tools loading failed:', error.message);
}

// Test 5: Test server module loading
console.log('\n5. Testing server module...');
try {
  const PaprikaRecipeServer = require('../server/index.js');
  console.log('✅ Server module loaded successfully');
  
  // Test configuration loading
  const server = new PaprikaRecipeServer();
  console.log('✅ Server instance created successfully');
} catch (error) {
  console.log('❌ Server module failed:', error.message);
}

// Test 6: Test manifest validity
console.log('\n6. Testing manifest file...');
try {
  const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, '../manifest.json'), 'utf8'));
  
  // Check required fields
  const requiredFields = ['dxt_version', 'name', 'version', 'description', 'author', 'server'];
  const missingFields = requiredFields.filter(field => !manifest[field]);
  
  if (missingFields.length === 0) {
    console.log('✅ Manifest has all required fields');
    console.log(`   Extension: ${manifest.display_name || manifest.name} v${manifest.version}`);
    console.log(`   Tools: ${manifest.tools ? manifest.tools.length : 'Not specified'}`);
  } else {
    console.log('❌ Manifest missing required fields:', missingFields.join(', '));
  }
} catch (error) {
  console.log('❌ Manifest file error:', error.message);
}

// Test 7: Test utilities
console.log('\n7. Testing utility functions...');
try {
  const utils = require('../server/utils.js');
  
  // Test date formatting
  const testDate = new Date('2024-01-15');
  const formattedDate = utils.formatDate(testDate);
  console.log(`✅ Date formatting: ${formattedDate}`);
  
  // Test cooking time formatting
  const cookingTime = utils.formatCookingTime(90);
  console.log(`✅ Cooking time formatting: ${cookingTime}`);
  
  // Test input validation
  const validation = utils.validateSearchParams({ min_rating: 3, limit: 25 });
  if (validation.isValid) {
    console.log('✅ Input validation working');
  } else {
    console.log('❌ Input validation failed:', validation.errors);
  }
  
} catch (error) {
  console.log('❌ Utilities test failed:', error.message);
}

console.log('\n🏁 Basic tests completed!');
console.log('\nTo run the server:');
console.log('  npm start');
console.log('\nTo enable debug mode:');
console.log('  PAPRIKA_DEBUG=true npm start');
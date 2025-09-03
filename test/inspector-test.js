#!/usr/bin/env node

/**
 * MCP Inspector Test Script
 * 
 * This script demonstrates how to test the Paprika MCP server using the MCP Inspector.
 * The Inspector provides an interactive interface for testing MCP tools directly.
 * 
 * Usage:
 * 1. Install MCP Inspector: npm install -g @modelcontextprotocol/inspector
 * 2. Run this script: node test/inspector-test.js
 * 3. The Inspector will open in your browser for interactive testing
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔍 MCP Inspector Test Setup');
console.log('==========================\n');

// Check if Inspector is installed
function checkInspectorInstalled() {
  return new Promise((resolve) => {
    const check = spawn('npx', ['@modelcontextprotocol/inspector', '--version'], { stdio: 'pipe' });
    
    check.on('close', (code) => {
      resolve(code === 0);
    });
    
    check.on('error', () => {
      resolve(false);
    });
  });
}

// Install Inspector if needed
function installInspector() {
  return new Promise((resolve, reject) => {
    console.log('📦 Installing MCP Inspector...');
    
    const install = spawn('npm', ['install', '-g', '@modelcontextprotocol/inspector'], {
      stdio: 'inherit'
    });
    
    install.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Inspector installed successfully');
        resolve();
      } else {
        reject(new Error('Failed to install Inspector'));
      }
    });
  });
}

// Start the Inspector with our server
function startInspector() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting MCP Inspector...');
    console.log('This will open your browser for interactive testing\n');
    
    const serverPath = path.join(__dirname, '..', 'server', 'index.js');
    const configPath = path.join(__dirname, '..', 'claude_desktop_config.json');
    
    // Check if server file exists
    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server file not found: ${serverPath}`));
      return;
    }
    
    console.log('Inspector Configuration:');
    console.log(`  Server: ${serverPath}`);
    console.log(`  Config: ${configPath}`);
    console.log('  Transport: stdio');
    console.log('  Database: data/Paprika.sqlite\n');
    
    console.log('📋 Test Scenarios to Try in Inspector:');
    console.log('=====================================');
    console.log('1. list_categories - List all recipe categories');
    console.log('2. search_recipes - Search for recipes by name');
    console.log('   Example: {"name": "chicken", "limit": 5}');
    console.log('3. get_recent_recipes - Get recently added recipes');
    console.log('   Example: {"days": 30, "limit": 10}');
    console.log('4. search_by_ingredients - Find recipes with specific ingredients');
    console.log('   Example: {"ingredients": ["chicken", "garlic"]}');
    console.log('5. get_favorites - Get highly rated recipes');
    console.log('   Example: {"limit": 10}');
    console.log('6. get_recipe - Get full recipe details');
    console.log('   Example: {"recipe_id": 1} (use ID from search results)');
    console.log('7. get_meal_plan - Get planned meals');
    console.log('   Example: {"start_date": "2024-01-01", "end_date": "2024-01-31"}');
    console.log('8. get_grocery_lists - Get shopping lists');
    console.log('9. get_pantry_inventory - Get pantry items');
    console.log('10. get_recipe_photos - Get recipe photos\n');
    
    console.log('🔧 Debugging Tips:');
    console.log('==================');
    console.log('- Check the Inspector console for detailed error messages');
    console.log('- Use the "Test Connection" button to verify server connectivity');
    console.log('- Enable debug mode by setting PAPRIKA_DEBUG=true in environment');
    console.log('- Check that data/Paprika.sqlite exists and is readable');
    console.log('- Verify all npm dependencies are installed\n');
    
    // Start Inspector with our server
    const inspector = spawn('npx', [
      '@modelcontextprotocol/inspector',
      'node',
      serverPath
    ], {
      stdio: 'inherit',
      env: {
        ...process.env,
        PAPRIKA_DEBUG: 'true' // Enable debug mode for testing
      }
    });
    
    inspector.on('close', (code) => {
      console.log(`\n🔍 Inspector closed with code ${code}`);
      resolve(code);
    });
    
    inspector.on('error', (error) => {
      console.error('❌ Inspector error:', error.message);
      reject(error);
    });
    
    // Handle Ctrl+C gracefully
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down Inspector...');
      inspector.kill('SIGTERM');
    });
  });
}

// Validate server setup
function validateSetup() {
  const serverPath = path.join(__dirname, '..', 'server', 'index.js');
  const dbPath = path.join(__dirname, '..', 'data', 'Paprika.sqlite');
  const packagePath = path.join(__dirname, '..', 'package.json');
  
  console.log('🔍 Validating server setup...');
  
  const checks = [
    { file: serverPath, name: 'Server file' },
    { file: dbPath, name: 'Database file' },
    { file: packagePath, name: 'Package file' }
  ];
  
  let allValid = true;
  
  checks.forEach(check => {
    if (fs.existsSync(check.file)) {
      console.log(`✅ ${check.name}: Found`);
    } else {
      console.log(`❌ ${check.name}: Missing (${check.file})`);
      allValid = false;
    }
  });
  
  // Check dependencies
  try {
    require('@modelcontextprotocol/sdk');
    console.log('✅ MCP SDK: Installed');
  } catch (error) {
    console.log('❌ MCP SDK: Not found - run npm install');
    allValid = false;
  }
  
  try {
    require('sqlite3');
    console.log('✅ SQLite3: Installed');
  } catch (error) {
    console.log('❌ SQLite3: Not found - run npm install');
    allValid = false;
  }
  
  console.log();
  return allValid;
}

// Main execution
async function main() {
  try {
    // Validate setup first
    if (!validateSetup()) {
      console.log('❌ Setup validation failed. Please fix the issues above.\n');
      console.log('Common fixes:');
      console.log('  - Run "npm install" to install dependencies');
      console.log('  - Ensure data/Paprika.sqlite exists');
      console.log('  - Check that server/index.js exists');
      process.exit(1);
    }
    
    // Check if Inspector is installed
    const inspectorInstalled = await checkInspectorInstalled();
    
    if (!inspectorInstalled) {
      console.log('📦 MCP Inspector not found, installing...');
      await installInspector();
    } else {
      console.log('✅ MCP Inspector is installed');
    }
    
    console.log();
    
    // Start Inspector
    await startInspector();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Ensure Node.js 16+ is installed');
    console.log('- Run "npm install" in the project directory');
    console.log('- Check that data/Paprika.sqlite exists');
    console.log('- Verify internet connection for Inspector installation');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  checkInspectorInstalled,
  installInspector,
  startInspector,
  validateSetup
};
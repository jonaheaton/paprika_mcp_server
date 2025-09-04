#!/usr/bin/env node

/**
 * Write Operations Test Suite
 * Tests the recipe rating update functionality with comprehensive safety checks
 */

const path = require('path');
const fs = require('fs');
const PaprikaDatabase = require('../server/database.js');
const { TOOLS, handleToolCall } = require('../server/tools.js');

// Test configuration
const TEST_CONFIG = {
  enableWriteOperations: true,
  autoBackupEnabled: true,
  requireConfirmation: false, // Disable for automated tests
  maxDailyWrites: 100,
  debugMode: true
};

// Test data
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'Paprika.sqlite');
const BACKUP_DIR = path.join(__dirname, '..', 'data', 'backups');

let database = null;
let testRecipeId = null;
let originalRating = null;

console.log('🧪 Paprika Write Operations Test Suite');
console.log('=====================================\n');

async function runTests() {
  try {
    // Pre-test setup
    await setupTests();
    
    // Test 1: Database write configuration
    await testWriteConfiguration();
    
    // Test 2: Backup system
    await testBackupSystem();
    
    // Test 3: Validation system
    await testValidationSystem();
    
    // Test 4: Find test recipe
    await testFindTestRecipe();
    
    // Test 5: Update recipe rating - success case
    await testUpdateRatingSuccess();
    
    // Test 6: Update recipe rating - validation failures
    await testUpdateRatingValidation();
    
    // Test 7: MCP tool integration
    await testMCPToolIntegration();
    
    // Test 8: Category operations
    await testCategoryOperations();
    
    // Test 9: Transaction rollback
    await testTransactionRollback();
    
    // Test 10: Backup restoration
    await testBackupRestoration();
    
    // Cleanup
    await cleanupTests();
    
    console.log('\n🎉 All write operation tests completed successfully!');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    if (database) {
      await database.close();
    }
    process.exit(1);
  }
}

async function setupTests() {
  console.log('1. Setting up test environment...');
  
  // Check if database exists
  if (!fs.existsSync(TEST_DB_PATH)) {
    throw new Error(`Test database not found: ${TEST_DB_PATH}`);
  }
  
  // Initialize database with write operations enabled
  database = new PaprikaDatabase(TEST_DB_PATH, true, TEST_CONFIG);
  await database.connect();
  
  console.log('✅ Test environment setup complete');
}

async function testWriteConfiguration() {
  console.log('\n2. Testing write operation configuration...');
  
  if (!database.config.enableWriteOperations) {
    throw new Error('Write operations not enabled');
  }
  
  console.log('✅ Write operations enabled');
  console.log(`✅ Auto-backup: ${database.config.autoBackupEnabled}`);
  console.log(`✅ Daily write limit: ${database.config.maxDailyWrites}`);
}

async function testBackupSystem() {
  console.log('\n3. Testing backup system...');
  
  try {
    const backupInfo = await database.backup.createBackup();
    
    if (!fs.existsSync(backupInfo.backupPath)) {
      throw new Error('Backup file not created');
    }
    
    console.log('✅ Backup creation successful');
    console.log(`   Backup path: ${backupInfo.backupPath}`);
    console.log(`   Backup size: ${backupInfo.size} bytes`);
    console.log(`   Checksum: ${backupInfo.checksum.substring(0, 16)}...`);
    
  } catch (error) {
    throw new Error(`Backup test failed: ${error.message}`);
  }
}

async function testValidationSystem() {
  console.log('\n4. Testing validation system...');
  
  // Test valid inputs
  const validRatingError = database.validator.validateRecipeRating(4.5);
  const validIdError = database.validator.validateRecipeId(123);
  
  if (validRatingError) {
    throw new Error(`Valid rating rejected: ${validRatingError.message}`);
  }
  
  if (validIdError) {
    throw new Error(`Valid recipe ID rejected: ${validIdError.message}`);
  }
  
  // Test invalid inputs
  const invalidRatingError = database.validator.validateRecipeRating(6);
  const invalidIdError = database.validator.validateRecipeId(-1);
  
  if (!invalidRatingError) {
    throw new Error('Invalid rating (6) was accepted');
  }
  
  if (!invalidIdError) {
    throw new Error('Invalid recipe ID (-1) was accepted');
  }
  
  console.log('✅ Input validation working correctly');
  console.log(`   Invalid rating error: ${invalidRatingError.message}`);
  console.log(`   Invalid ID error: ${invalidIdError.message}`);
}

async function testFindTestRecipe() {
  console.log('\n5. Finding test recipe...');
  
  // Find a recipe to use for testing
  const recipes = await database.searchRecipes('', { limit: 5 });
  
  if (recipes.length === 0) {
    throw new Error('No recipes found for testing');
  }
  
  testRecipeId = recipes[0].id;
  originalRating = recipes[0].rating;
  
  console.log('✅ Test recipe found');
  console.log(`   Recipe ID: ${testRecipeId}`);
  console.log(`   Recipe name: ${recipes[0].name}`);
  console.log(`   Original rating: ${originalRating}`);
}

async function testUpdateRatingSuccess() {
  console.log('\n6. Testing successful rating update...');
  
  const newRating = originalRating === 5 ? 4 : 5; // Choose different rating
  
  try {
    const result = await database.updateRecipeRating(testRecipeId, newRating);
    
    if (!result.success) {
      throw new Error('Update reported as failed');
    }
    
    if (result.newRating !== newRating) {
      throw new Error(`Rating not updated correctly: expected ${newRating}, got ${result.newRating}`);
    }
    
    // Verify in database
    const updatedRecipe = await database.getRecipe(testRecipeId);
    if (updatedRecipe.rating !== newRating) {
      throw new Error(`Database verification failed: expected ${newRating}, got ${updatedRecipe.rating}`);
    }
    
    console.log('✅ Rating update successful');
    console.log(`   Updated from ${result.oldRating} to ${result.newRating}`);
    console.log(`   Recipe: ${result.recipeName}`);
    
    // Restore original rating
    await database.updateRecipeRating(testRecipeId, originalRating);
    console.log('✅ Original rating restored');
    
  } catch (error) {
    throw new Error(`Rating update test failed: ${error.message}`);
  }
}

async function testUpdateRatingValidation() {
  console.log('\n7. Testing rating update validation...');
  
  // Test invalid recipe ID
  try {
    await database.updateRecipeRating(999999, 5);
    throw new Error('Should have failed with invalid recipe ID');
  } catch (error) {
    if (!error.message.includes('not found')) {
      throw new Error(`Wrong error for invalid recipe ID: ${error.message}`);
    }
    console.log('✅ Invalid recipe ID properly rejected');
  }
  
  // Test invalid rating
  try {
    await database.updateRecipeRating(testRecipeId, 10);
    throw new Error('Should have failed with invalid rating');
  } catch (error) {
    if (!error.message.includes('Invalid rating')) {
      throw new Error(`Wrong error for invalid rating: ${error.message}`);
    }
    console.log('✅ Invalid rating properly rejected');
  }
  
  // Test negative rating
  try {
    await database.updateRecipeRating(testRecipeId, -1);
    throw new Error('Should have failed with negative rating');
  } catch (error) {
    if (!error.message.includes('Invalid rating')) {
      throw new Error(`Wrong error for negative rating: ${error.message}`);
    }
    console.log('✅ Negative rating properly rejected');
  }
}

async function testMCPToolIntegration() {
  console.log('\n8. Testing MCP tool integration...');
  
  // Test the MCP tool directly
  const newRating = originalRating === 4 ? 5 : 4; // Different rating
  
  try {
    const response = await handleToolCall('update_recipe_rating', {
      recipe_id: testRecipeId,
      rating: newRating
    }, database);
    
    if (response.isError) {
      throw new Error(`MCP tool returned error: ${response.content[0].text}`);
    }
    
    const result = JSON.parse(response.content[0].text);
    
    if (!result.success) {
      throw new Error(`MCP tool operation failed: ${result.message || 'Unknown error'}`);
    }
    
    console.log('✅ MCP tool integration successful');
    console.log(`   Operation: ${result.operation}`);
    console.log(`   Updated: ${result.recipe.name} to ${result.recipe.new_rating} stars`);
    
    // Restore original rating
    await database.updateRecipeRating(testRecipeId, originalRating);
    
  } catch (error) {
    throw new Error(`MCP tool test failed: ${error.message}`);
  }
}

async function testCategoryOperations() {
  console.log('\n8. Testing category operations...');
  
  try {
    // Test 8a: Add categories by ID
    console.log('   Testing add categories by ID...');
    
    // Get available categories first
    const categories = await database.listCategories();
    if (categories.length < 2) {
      throw new Error('Not enough categories for testing');
    }
    
    const testCategoryIds = [categories[0].id, categories[1].id];
    const testCategoryNames = [categories[0].name, categories[1].name];
    
    // Test add categories by ID
    const addResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipeId,
      category_ids: testCategoryIds
    }, database);
    
    if (addResponse.isError) {
      throw new Error(`Add categories failed: ${addResponse.content[0].text}`);
    }
    
    const addResult = JSON.parse(addResponse.content[0].text);
    if (!addResult.success) {
      throw new Error(`Add categories operation failed: ${addResult.message}`);
    }
    
    console.log('   ✅ Add categories by ID successful');
    console.log(`      Added ${addResult.categories_added.length} categories`);
    
    // Test 8b: Add categories by name (should fail - already assigned)
    console.log('   Testing add duplicate categories...');
    
    const duplicateResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipeId,
      category_names: testCategoryNames
    }, database);
    
    if (!duplicateResponse.isError) {
      console.log('   ⚠️  Expected duplicate category assignment to fail');
    } else {
      console.log('   ✅ Duplicate category assignment properly rejected');
    }
    
    // Test 8c: Remove categories by name
    console.log('   Testing remove categories by name...');
    
    const removeResponse = await handleToolCall('remove_recipe_categories', {
      recipe_id: testRecipeId,
      category_names: [testCategoryNames[0]]
    }, database);
    
    if (removeResponse.isError) {
      throw new Error(`Remove categories failed: ${removeResponse.content[0].text}`);
    }
    
    const removeResult = JSON.parse(removeResponse.content[0].text);
    if (!removeResult.success) {
      throw new Error(`Remove categories operation failed: ${removeResult.message}`);
    }
    
    console.log('   ✅ Remove categories by name successful');
    console.log(`      Removed ${removeResult.categories_removed.length} categories`);
    
    // Test 8d: Update categories (replace all)
    console.log('   Testing update categories (replace all)...');
    
    const newCategoryIds = categories.length > 2 ? [categories[2].id] : [];
    
    const updateResponse = await handleToolCall('update_recipe_categories', {
      recipe_id: testRecipeId,
      category_ids: newCategoryIds
    }, database);
    
    if (updateResponse.isError) {
      throw new Error(`Update categories failed: ${updateResponse.content[0].text}`);
    }
    
    const updateResult = JSON.parse(updateResponse.content[0].text);
    if (!updateResult.success) {
      throw new Error(`Update categories operation failed: ${updateResult.message}`);
    }
    
    console.log('   ✅ Update categories successful');
    console.log(`      Updated categories: ${updateResult.old_categories.length} -> ${updateResult.new_categories.length}`);
    
    // Test 8e: Remove all categories
    console.log('   Testing remove all categories...');
    
    const removeAllResponse = await handleToolCall('remove_recipe_categories', {
      recipe_id: testRecipeId,
      remove_all: true
    }, database);
    
    if (removeAllResponse.isError) {
      throw new Error(`Remove all categories failed: ${removeAllResponse.content[0].text}`);
    }
    
    const removeAllResult = JSON.parse(removeAllResponse.content[0].text);
    if (!removeAllResult.success) {
      throw new Error(`Remove all categories operation failed: ${removeAllResult.message}`);
    }
    
    console.log('   ✅ Remove all categories successful');
    console.log(`      Removed ${removeAllResult.categories_removed.length} categories`);
    
    // Test 8f: Invalid category operations
    console.log('   Testing invalid category operations...');
    
    const invalidResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipeId,
      category_names: ['NonExistentCategory12345']
    }, database);
    
    if (!invalidResponse.isError) {
      throw new Error('Expected invalid category name to fail');
    }
    
    console.log('   ✅ Invalid category name properly rejected');
    
  } catch (error) {
    throw new Error(`Category operations test failed: ${error.message}`);
  }
}

async function testTransactionRollback() {
  console.log('\n9. Testing transaction rollback...');
  
  try {
    // This should trigger a rollback by causing an error after starting transaction
    await database.executeInTransaction(async () => {
      // First update the rating
      await database.runSQL(
        'UPDATE ZRECIPE SET ZRATING = ? WHERE Z_PK = ?', 
        [4.5, testRecipeId]
      );
      
      // Then cause an error to trigger rollback
      throw new Error('Intentional test error');
    }, 'test_rollback');
    
    throw new Error('Transaction should have rolled back');
    
  } catch (error) {
    if (!error.message.includes('Intentional test error')) {
      throw new Error(`Unexpected rollback error: ${error.message}`);
    }
    
    // Verify rating wasn't changed
    const recipe = await database.getRecipe(testRecipeId);
    if (recipe.rating !== originalRating) {
      throw new Error(`Transaction rollback failed: rating was changed from ${originalRating} to ${recipe.rating}`);
    }
    
    console.log('✅ Transaction rollback working correctly');
  }
}

async function testBackupRestoration() {
  console.log('\n10. Testing backup restoration...');
  
  try {
    // Create a backup
    const backupInfo = await database.backup.createBackup();
    
    // Modify something
    await database.updateRecipeRating(testRecipeId, 2.5);
    
    // Verify change
    let recipe = await database.getRecipe(testRecipeId);
    if (recipe.rating !== 2.5) {
      throw new Error('Test rating change failed');
    }
    
    // Close database connection
    await database.close();
    
    // Restore from backup
    await database.backup.restoreFromBackup(backupInfo.backupPath);
    
    // Reconnect
    await database.connect();
    
    // Verify restoration
    recipe = await database.getRecipe(testRecipeId);
    if (recipe.rating !== originalRating) {
      throw new Error(`Backup restoration failed: expected ${originalRating}, got ${recipe.rating}`);
    }
    
    console.log('✅ Backup restoration successful');
    console.log(`   Restored rating: ${recipe.rating}`);
    
  } catch (error) {
    throw new Error(`Backup restoration test failed: ${error.message}`);
  }
}

async function cleanupTests() {
  console.log('\n11. Cleaning up test environment...');
  
  if (database) {
    await database.close();
  }
  
  // Clean up old test backups (keep only recent ones)
  try {
    if (fs.existsSync(BACKUP_DIR)) {
      await database.backup.cleanupOldBackups(1); // Keep 1 day
    }
    console.log('✅ Test cleanup complete');
  } catch (error) {
    console.log('⚠️  Cleanup warning:', error.message);
  }
}

// Run the tests
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { runTests };
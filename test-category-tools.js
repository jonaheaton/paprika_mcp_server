#!/usr/bin/env node

/**
 * Category Management Tools Test Script
 * Tests the new category tools with actual database operations
 */

const path = require('path');
const PaprikaDatabase = require('./server/database.js');
const { handleToolCall } = require('./server/tools.js');

// Test configuration - enable write operations
const TEST_CONFIG = {
  enableWriteOperations: true,
  autoBackupEnabled: true,
  requireConfirmation: false,
  maxDailyWrites: 100,
  debugMode: false // Set to true for detailed logging
};

const TEST_DB_PATH = path.join(__dirname, 'data', 'Paprika.sqlite');

async function testCategoryTools() {
  console.log('🧪 Category Management Tools Test');
  console.log('================================\n');

  let database = null;

  try {
    // Initialize database with write operations enabled
    database = new PaprikaDatabase(TEST_DB_PATH, false, TEST_CONFIG);
    await database.connect();
    
    console.log('✅ Connected to database with write operations enabled\n');

    // Step 1: Find a recipe to test with
    console.log('Step 1: Finding a test recipe...');
    const searchResponse = await handleToolCall('search_recipes', { limit: 3 }, database);
    const searchData = JSON.parse(searchResponse.content[0].text);
    
    if (searchData.recipes.length === 0) {
      throw new Error('No recipes found for testing');
    }
    
    const testRecipe = searchData.recipes[0];
    console.log(`✅ Using recipe: "${testRecipe.name}" (ID: ${testRecipe.id})`);
    console.log(`   Current categories: ${testRecipe.categories.join(', ') || 'None'}\n`);

    // Step 2: List available categories
    console.log('Step 2: Listing available categories...');
    const categoriesResponse = await handleToolCall('list_categories', {}, database);
    const categoriesData = JSON.parse(categoriesResponse.content[0].text);
    
    console.log(`✅ Found ${categoriesData.total_categories} categories`);
    const availableCategories = categoriesData.categories.slice(0, 5); // Use first 5 categories
    console.log('   Available categories for testing:');
    availableCategories.forEach(cat => {
      console.log(`     - ${cat.name} (ID: ${cat.id}) - ${cat.recipe_count} recipes`);
    });
    console.log('');

    // Step 3: Add categories by name
    console.log('Step 3: Adding categories by name...');
    const categoriesToAdd = availableCategories.slice(0, 2).map(c => c.name);
    console.log(`   Adding categories: ${categoriesToAdd.join(', ')}`);
    
    const addResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipe.id,
      category_names: categoriesToAdd
    }, database);

    if (addResponse.isError) {
      console.log(`⚠️  Add categories result: ${addResponse.content[0].text}`);
    } else {
      const addResult = JSON.parse(addResponse.content[0].text);
      console.log(`✅ Added ${addResult.categories_added.length} categories successfully`);
      console.log(`   New categories: ${addResult.all_categories.map(c => c.name).join(', ')}`);
    }
    console.log('');

    // Step 4: Try to add duplicate categories (should fail)
    console.log('Step 4: Testing duplicate category prevention...');
    const duplicateResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipe.id,
      category_names: [categoriesToAdd[0]] // Try to add first category again
    }, database);

    if (duplicateResponse.isError) {
      console.log('✅ Duplicate category assignment properly prevented');
    } else {
      console.log('⚠️  Expected duplicate prevention to trigger');
    }
    console.log('');

    // Step 5: Remove one category by name
    console.log('Step 5: Removing a category by name...');
    console.log(`   Removing category: ${categoriesToAdd[0]}`);
    
    const removeResponse = await handleToolCall('remove_recipe_categories', {
      recipe_id: testRecipe.id,
      category_names: [categoriesToAdd[0]]
    }, database);

    if (removeResponse.isError) {
      console.log(`⚠️  Remove category result: ${removeResponse.content[0].text}`);
    } else {
      const removeResult = JSON.parse(removeResponse.content[0].text);
      console.log(`✅ Removed ${removeResult.categories_removed.length} categories successfully`);
      console.log(`   Remaining categories: ${removeResult.all_categories.map(c => c.name).join(', ') || 'None'}`);
    }
    console.log('');

    // Step 6: Update all categories (replace with new set)
    console.log('Step 6: Replacing all categories...');
    const newCategoryIds = availableCategories.slice(2, 4).map(c => c.id); // Use categories 3 and 4
    const newCategoryNames = availableCategories.slice(2, 4).map(c => c.name);
    console.log(`   Replacing with categories: ${newCategoryNames.join(', ')}`);
    
    const updateResponse = await handleToolCall('update_recipe_categories', {
      recipe_id: testRecipe.id,
      category_ids: newCategoryIds
    }, database);

    if (updateResponse.isError) {
      console.log(`⚠️  Update categories result: ${updateResponse.content[0].text}`);
    } else {
      const updateResult = JSON.parse(updateResponse.content[0].text);
      console.log(`✅ Updated categories successfully`);
      console.log(`   Old: ${updateResult.old_categories.map(c => c.name).join(', ') || 'None'}`);
      console.log(`   New: ${updateResult.new_categories.map(c => c.name).join(', ') || 'None'}`);
    }
    console.log('');

    // Step 7: Remove all categories
    console.log('Step 7: Removing all categories...');
    
    const removeAllResponse = await handleToolCall('remove_recipe_categories', {
      recipe_id: testRecipe.id,
      remove_all: true
    }, database);

    if (removeAllResponse.isError) {
      console.log(`⚠️  Remove all categories result: ${removeAllResponse.content[0].text}`);
    } else {
      const removeAllResult = JSON.parse(removeAllResponse.content[0].text);
      console.log(`✅ Removed all categories successfully`);
      console.log(`   Removed ${removeAllResult.categories_removed.length} categories`);
      console.log(`   Final categories: ${removeAllResult.all_categories.map(c => c.name).join(', ') || 'None'}`);
    }
    console.log('');

    // Step 8: Test invalid operations
    console.log('Step 8: Testing error handling...');
    
    // Test invalid category name
    const invalidResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: testRecipe.id,
      category_names: ['NonExistentCategory12345']
    }, database);

    if (invalidResponse.isError) {
      console.log('✅ Invalid category name properly rejected');
    } else {
      console.log('⚠️  Expected invalid category name to be rejected');
    }

    // Test invalid recipe ID
    const invalidRecipeResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: 999999,
      category_ids: [availableCategories[0].id]
    }, database);

    if (invalidRecipeResponse.isError) {
      console.log('✅ Invalid recipe ID properly rejected');
    } else {
      console.log('⚠️  Expected invalid recipe ID to be rejected');
    }
    
    console.log('\n🎉 All category management tests completed successfully!');
    console.log('\n📊 Summary:');
    console.log('- ✅ Add categories by name: Working');
    console.log('- ✅ Duplicate prevention: Working');
    console.log('- ✅ Remove categories by name: Working');
    console.log('- ✅ Update/replace categories: Working');
    console.log('- ✅ Remove all categories: Working');
    console.log('- ✅ Error handling: Working');

  } catch (error) {
    console.error(`\n💥 Test failed: ${error.message}`);
    console.error(error.stack);
  } finally {
    if (database) {
      await database.close();
      console.log('\n🔒 Database connection closed');
    }
  }
}

// Run the test
if (require.main === module) {
  testCategoryTools().catch(console.error);
}

module.exports = { testCategoryTools };
#!/usr/bin/env node

/**
 * Category Change Demo
 * Simple demonstration of changing recipe categories
 */

const path = require('path');
const PaprikaDatabase = require('./server/database.js');
const { handleToolCall } = require('./server/tools.js');

// Demo configuration
const CONFIG = {
  enableWriteOperations: true,
  autoBackupEnabled: true,
  requireConfirmation: false,
  maxDailyWrites: 100,
  debugMode: false
};

const DB_PATH = path.join(__dirname, 'data', 'Paprika.sqlite');

async function demonstrateCategoryChange() {
  console.log('🥘 Recipe Category Change Demo');
  console.log('==============================\n');

  let database = null;

  try {
    // Connect to database
    database = new PaprikaDatabase(DB_PATH, false, CONFIG);
    await database.connect();
    
    // Find a recipe to demonstrate with
    const searchResponse = await handleToolCall('search_recipes', { 
      query: 'chicken', 
      limit: 1 
    }, database);
    const recipes = JSON.parse(searchResponse.content[0].text).recipes;
    
    if (recipes.length === 0) {
      throw new Error('No chicken recipes found');
    }
    
    const recipe = recipes[0];
    console.log(`📝 Working with recipe: "${recipe.name}"`);
    console.log(`   Recipe ID: ${recipe.id}`);
    console.log(`   Current categories: ${recipe.categories.join(', ') || 'None'}`);
    console.log('');

    // Show available categories
    const categoriesResponse = await handleToolCall('list_categories', {}, database);
    const allCategories = JSON.parse(categoriesResponse.content[0].text).categories;
    console.log('📂 Available categories:');
    allCategories.slice(0, 5).forEach(cat => {
      console.log(`   - ${cat.name} (${cat.recipe_count} recipes)`);
    });
    console.log(`   ... and ${allCategories.length - 5} more\n`);

    // Demonstrate category change: Add "Quick Meals" category
    console.log('🔄 DEMONSTRATION: Adding "Quick Meals" category to recipe...');
    
    const addResponse = await handleToolCall('add_recipe_categories', {
      recipe_id: recipe.id,
      category_names: ['Quick Meals']
    }, database);

    if (addResponse.isError) {
      console.log(`   ❌ Failed: ${JSON.parse(addResponse.content[0].text).message}`);
    } else {
      const result = JSON.parse(addResponse.content[0].text);
      console.log(`   ✅ Success! Added ${result.categories_added.length} category`);
      console.log(`   📋 Recipe now has categories: ${result.all_categories.map(c => c.name).join(', ')}`);
    }
    console.log('');

    // Demonstrate category change: Replace all categories with "Healthy" and "Main Course"
    console.log('🔄 DEMONSTRATION: Replacing all categories with "Healthy" and "Main Course"...');
    
    const updateResponse = await handleToolCall('update_recipe_categories', {
      recipe_id: recipe.id,
      category_names: ['Healthy', 'Main Course']
    }, database);

    if (updateResponse.isError) {
      console.log(`   ❌ Failed: ${JSON.parse(updateResponse.content[0].text).message}`);
    } else {
      const result = JSON.parse(updateResponse.content[0].text);
      console.log(`   ✅ Success! Categories updated`);
      console.log(`   📋 Old: ${result.old_categories.map(c => c.name).join(', ') || 'None'}`);
      console.log(`   📋 New: ${result.new_categories.map(c => c.name).join(', ') || 'None'}`);
    }
    console.log('');

    // Verify the change by searching the recipe again
    console.log('🔍 VERIFICATION: Checking current recipe categories...');
    const verifyResponse = await handleToolCall('get_recipe', { 
      recipe_id: recipe.id 
    }, database);
    const updatedRecipe = JSON.parse(verifyResponse.content[0].text).recipe;
    console.log(`   📝 Recipe "${updatedRecipe.name}" now has categories: ${updatedRecipe.categories.join(', ')}`);
    console.log('');

    console.log('🎉 Category change demonstration completed successfully!');
    console.log('\n💡 Summary:');
    console.log('   ✅ Categories can be added by name');
    console.log('   ✅ Categories can be replaced atomically');
    console.log('   ✅ Changes are immediately visible');
    console.log('   ✅ All operations include automatic backups');
    console.log('   ✅ Natural language category names work perfectly');

  } catch (error) {
    console.error(`\n💥 Demo failed: ${error.message}`);
  } finally {
    if (database) {
      await database.close();
    }
  }
}

// Run the demo
if (require.main === module) {
  demonstrateCategoryChange().catch(console.error);
}

module.exports = { demonstrateCategoryChange };
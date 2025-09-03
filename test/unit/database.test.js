const { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach } = require('@jest/globals');
const path = require('path');
const PaprikaDatabase = require('../../server/database.js');

describe('PaprikaDatabase Unit Tests', () => {
  let db;

  beforeAll(async () => {
    db = await createTestDatabase();
  });

  afterAll(async () => {
    await cleanupDatabase(db);
  });

  // Skip all tests if database is not available
  beforeEach(() => {
    if (!db) {
      pending('Database not available for testing');
    }
  });

  describe('Connection Management', () => {
    test('should connect to database successfully', async () => {
      const testDb = new PaprikaDatabase(global.TEST_DB_PATH, false);
      await expect(testDb.connect()).resolves.not.toThrow();
      await testDb.close();
    });

    test('should handle invalid database path', async () => {
      const testDb = new PaprikaDatabase('/nonexistent/path.sqlite', false);
      // Disable backup system for this test
      testDb.backup = null;
      await expect(testDb.connect()).rejects.toThrow();
    });

    test('should close connection properly', async () => {
      const testDb = new PaprikaDatabase(global.TEST_DB_PATH, false);
      await testDb.connect();
      await expect(testDb.close()).resolves.not.toThrow();
    });
  });

  describe('Recipe Queries', () => {
    test('should list all categories', async () => {
      const categories = await db.listCategories();
      
      expect(Array.isArray(categories)).toBe(true);
      expect(categories.length).toBeGreaterThan(0);
      
      // Check category structure
      const category = categories[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('recipe_count');
      expect(typeof category.recipe_count).toBe('number');
    });

    test('should get recent recipes with limit', async () => {
      const recentRecipes = await db.getRecentRecipes(30, 5);
      
      expect(Array.isArray(recentRecipes)).toBe(true);
      expect(recentRecipes.length).toBeLessThanOrEqual(5);
      
      if (recentRecipes.length > 0) {
        const recipe = recentRecipes[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('created');
        expect(recipe).toHaveProperty('modified');
      }
    });

    test('should search recipes by name', async () => {
      const searchResults = await db.searchRecipes({ name: 'chicken' });
      
      expect(Array.isArray(searchResults)).toBe(true);
      
      if (searchResults.length > 0) {
        const recipe = searchResults[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe.name.toLowerCase()).toContain('chicken');
      }
    });

    test('should get recipe by ID', async () => {
      // First get a recipe ID from recent recipes
      const recentRecipes = await db.getRecentRecipes(365, 1);
      
      if (recentRecipes.length > 0) {
        const recipeId = recentRecipes[0].id;
        const recipe = await db.getRecipe(recipeId);
        
        expect(recipe).toBeTruthy();
        expect(recipe.id).toBe(recipeId);
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('ingredients');
        expect(recipe).toHaveProperty('directions');
      }
    });

    test('should handle non-existent recipe ID', async () => {
      const recipe = await db.getRecipe(99999);
      expect(recipe).toBeNull();
    });
  });

  describe('Advanced Queries', () => {
    test('should search by ingredients', async () => {
      const ingredients = ['chicken', 'salt'];
      const recipes = await db.searchByIngredients(ingredients, 10);
      
      expect(Array.isArray(recipes)).toBe(true);
      
      if (recipes.length > 0) {
        const recipe = recipes[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('matching_ingredients');
        expect(typeof recipe.matched_count).toBe('number');
      }
    });

    test('should get favorite recipes', async () => {
      const favorites = await db.getFavorites(10);
      
      expect(Array.isArray(favorites)).toBe(true);
      
      if (favorites.length > 0) {
        const recipe = favorites[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('rating');
        expect(recipe.rating).toBeGreaterThan(0);
      }
    });

    test('should get meal plan within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const mealPlan = await db.getMealPlan(startDate, endDate);
      
      expect(Array.isArray(mealPlan)).toBe(true);
      
      if (mealPlan.length > 0) {
        const meal = mealPlan[0];
        expect(meal).toHaveProperty('id');
        expect(meal).toHaveProperty('date');
        expect(meal).toHaveProperty('meal_type');
        expect(meal).toHaveProperty('recipe_name');
      }
    });
  });

  describe('Data Validation', () => {
    test('should validate search parameters', async () => {
      // Test invalid rating range
      await expect(
        db.searchRecipes({ min_rating: 6 })
      ).rejects.toThrow();

      // Test invalid prep time
      await expect(
        db.searchRecipes({ max_prep_time: -1 })
      ).rejects.toThrow();
    });

    test('should handle empty search results gracefully', async () => {
      const results = await db.searchRecipes({ name: 'nonexistentrecipe12345' });
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should limit results properly', async () => {
      const results = await db.searchRecipes({ name: 'a' }, 3);
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Utility Functions', () => {
    test('should convert Core Data timestamps correctly', async () => {
      // Get a recipe with timestamps
      const recentRecipes = await db.getRecentRecipes(365, 1);
      
      if (recentRecipes.length > 0) {
        const recipe = recentRecipes[0];
        
        // Timestamps should be converted to JavaScript Date objects
        expect(recipe.created).toBeInstanceOf(Date);
        expect(recipe.modified).toBeInstanceOf(Date);
        
        // Should be reasonable dates (not in 2001)
        expect(recipe.created.getFullYear()).toBeGreaterThan(2010);
        expect(recipe.modified.getFullYear()).toBeGreaterThan(2010);
      }
    });
  });
});
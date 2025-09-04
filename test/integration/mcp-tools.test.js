const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { TOOLS, handleToolCall } = require('../../server/tools.js');

describe('MCP Tools Integration Tests', () => {
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

  describe('Tool Definitions', () => {
    test('should have all expected tools defined', () => {
      const expectedTools = [
        'search_recipes',
        'get_recipe', 
        'list_categories',
        'get_meal_plan',
        'search_by_ingredients',
        'get_grocery_lists',
        'get_pantry_inventory',
        'get_recipe_photos',
        'get_recent_recipes',
        'get_favorites',
        'update_recipe_rating',
        'add_recipe_categories',
        'remove_recipe_categories',
        'update_recipe_categories'
      ];

      const toolNames = TOOLS.map(tool => tool.name);
      
      expectedTools.forEach(expectedTool => {
        expect(toolNames).toContain(expectedTool);
      });
      
      expect(TOOLS.length).toBe(expectedTools.length);
    });

    test('should have valid JSON schema for all tools', () => {
      TOOLS.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        
        // Check schema structure
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema).toHaveProperty('properties');
      });
    });
  });

  describe('search_recipes Tool', () => {
    test('should search recipes by name', async () => {
      const result = await handleToolCall(
        'search_recipes',
        { query: 'chicken' },
        db
      );

      expect(result).toHaveProperty('content');
      expect(Array.isArray(result.content)).toBe(true);
      expect(result.content[0]).toHaveProperty('type');
      expect(result.content[0].type).toBe('text');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('recipes');
        expect(Array.isArray(data.recipes)).toBe(true);
      }
    });

    test('should search recipes by rating', async () => {
      const result = await handleToolCall(
        'search_recipes',
        { min_rating: 4 },
        db
      );

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('recipes');
      }
    });

    test('should handle empty search results', async () => {
      const result = await handleToolCall(
        'search_recipes',
        { query: 'nonexistentrecipe12345' },
        db
      );

      expect(result).toHaveProperty('content');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('recipes');
        expect(Array.isArray(data.recipes)).toBe(true);
      }
    });

    test('should handle invalid parameters gracefully', async () => {
      const result = await handleToolCall('search_recipes', { min_rating: 6 }, db);
      
      // Should return error response instead of throwing
      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
    });
  });

  describe('get_recipe Tool', () => {
    test('should get recipe by ID', async () => {
      // First get a recipe ID
      const searchResult = await handleToolCall(
        'search_recipes',
        { limit: 1 },
        db
      );

      expect(searchResult).toHaveProperty('content');
      
      if (!searchResult.isError) {
        const searchData = JSON.parse(searchResult.content[0].text);
        
        if (searchData.recipes && searchData.recipes.length > 0) {
          const recipeId = searchData.recipes[0].id;
          
          const result = await handleToolCall(
            'get_recipe',
            { recipe_id: recipeId },
            db
          );

          expect(result).toHaveProperty('content');
          expect(result.content[0]).toHaveProperty('type', 'text');
          
          if (!result.isError) {
            const data = JSON.parse(result.content[0].text);
            expect(data).toHaveProperty('id', recipeId);
            expect(data).toHaveProperty('name');
          }
        }
      }
    });

    test('should handle non-existent recipe ID', async () => {
      const result = await handleToolCall(
        'get_recipe',
        { recipe_id: 99999 },
        db
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError');
      
      if (result.isError) {
        expect(result.content[0].text).toContain('not found');
      }
    });

    test('should handle missing recipe_id parameter', async () => {
      const result = await handleToolCall('get_recipe', {}, db);
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('recipe_id is required');
    });
  });

  describe('list_categories Tool', () => {
    test('should list all categories', async () => {
      const result = await handleToolCall(
        'list_categories',
        {},
        db
      );

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('categories');
        expect(Array.isArray(data.categories)).toBe(true);
        expect(data).toHaveProperty('total_categories');
      }
    });

    test('should show hierarchical structure', async () => {
      const result = await handleToolCall(
        'list_categories',
        { show_hierarchy: true },
        db
      );

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('categories');
        expect(Array.isArray(data.categories)).toBe(true);
      }
    });
  });

  describe('get_meal_plan Tool', () => {
    test('should get meal plan for date range', async () => {
      const result = await handleToolCall(
        'get_meal_plan',
        {
          start_date: '2024-01-01',
          end_date: '2024-01-31'
        },
        db
      );

      expect(result).toHaveProperty('meals');
      expect(Array.isArray(result.meals)).toBe(true);
      expect(result).toHaveProperty('total_meals');
      
      if (result.meals.length > 0) {
        const meal = result.meals[0];
        expect(meal).toHaveProperty('id');
        expect(meal).toHaveProperty('date');
        expect(meal).toHaveProperty('meal_type');
        expect(meal).toHaveProperty('recipe_name');
      }
    });

    test('should validate date format', async () => {
      await expect(
        handleToolCall('get_meal_plan', {
          start_date: 'invalid-date',
          end_date: '2024-01-31'
        }, db)
      ).rejects.toThrow();
    });
  });

  describe('search_by_ingredients Tool', () => {
    test('should find recipes by ingredients', async () => {
      const result = await handleToolCall(
        'search_by_ingredients',
        { ingredients: ['chicken', 'salt'] },
        db
      );

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
      
      if (!result.isError) {
        const data = JSON.parse(result.content[0].text);
        expect(data).toHaveProperty('recipes');
        expect(Array.isArray(data.recipes)).toBe(true);
      }
    });

    test('should handle missing ingredients parameter', async () => {
      const result = await handleToolCall('search_by_ingredients', {}, db);
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('ingredients');
    });

    test('should handle empty ingredients array', async () => {
      const result = await handleToolCall(
        'search_by_ingredients',
        { ingredients: [] },
        db
      );

      expect(result).toHaveProperty('content');
      expect(result.content[0]).toHaveProperty('type', 'text');
    });
  });

  describe('get_recent_recipes Tool', () => {
    test('should get recent recipes', async () => {
      const result = await handleToolCall(
        'get_recent_recipes',
        { days: 365, limit: 10 },
        db
      );

      expect(result).toHaveProperty('recipes');
      expect(Array.isArray(result.recipes)).toBe(true);
      expect(result.recipes.length).toBeLessThanOrEqual(10);
      
      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('created');
        expect(recipe).toHaveProperty('modified');
      }
    });

    test('should use default parameters', async () => {
      const result = await handleToolCall(
        'get_recent_recipes',
        {},
        db
      );

      expect(result).toHaveProperty('recipes');
      expect(result.recipes.length).toBeLessThanOrEqual(20); // default limit
    });
  });

  describe('get_favorites Tool', () => {
    test('should get favorite recipes', async () => {
      const result = await handleToolCall(
        'get_favorites',
        { limit: 10 },
        db
      );

      expect(result).toHaveProperty('recipes');
      expect(Array.isArray(result.recipes)).toBe(true);
      
      if (result.recipes.length > 0) {
        const recipe = result.recipes[0];
        expect(recipe).toHaveProperty('id');
        expect(recipe).toHaveProperty('name');
        expect(recipe).toHaveProperty('rating');
        expect(recipe.rating).toBeGreaterThan(0);
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle database connection errors gracefully', async () => {
      const disconnectedDb = null;
      
      const result = await handleToolCall(
        'search_recipes',
        { query: 'chicken' },
        disconnectedDb
      );

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('Cannot read properties of null');
    });

    test('should handle invalid tool names', async () => {
      const result = await handleToolCall('invalid_tool', {}, db);
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('Unknown tool: invalid_tool');
    });

    test('should validate required parameters', async () => {
      const result = await handleToolCall('get_recipe', { wrong_param: 123 }, db);
      
      expect(result).toHaveProperty('isError', true);
      expect(result.content[0].text).toContain('recipe_id is required');
    });
  });

  describe('Response Format Consistency', () => {
    test('all tools should return consistent MCP response structure', async () => {
      const toolTests = [
        { name: 'search_recipes', params: { limit: 1 } },
        { name: 'list_categories', params: {} },
        { name: 'get_recent_recipes', params: { limit: 1 } },
        { name: 'get_favorites', params: { limit: 1 } },
        { name: 'search_by_ingredients', params: { ingredients: ['salt'] } }
      ];

      for (const toolTest of toolTests) {
        const result = await handleToolCall(toolTest.name, toolTest.params, db);
        
        // All responses should have MCP format
        expect(result).toHaveProperty('content');
        expect(Array.isArray(result.content)).toBe(true);
        expect(result.content[0]).toHaveProperty('type', 'text');
        expect(result.content[0]).toHaveProperty('text');
        
        // Should have isError property
        expect(result).toHaveProperty('isError');
        expect(typeof result.isError).toBe('boolean');
      }
    });
  });
});
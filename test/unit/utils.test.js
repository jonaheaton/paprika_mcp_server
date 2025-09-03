const { describe, test, expect } = require('@jest/globals');
const utils = require('../../server/utils.js');

describe('Utils Unit Tests', () => {
  describe('Date Formatting', () => {
    test('should format dates correctly', () => {
      const testDate = new Date('2024-01-15T10:30:00Z');
      const formatted = utils.formatDate(testDate);
      
      expect(formatted).toBe('Jan 15, 2024');
    });

    test('should handle invalid dates', () => {
      const invalidDate = new Date('invalid');
      const formatted = utils.formatDate(invalidDate);
      
      expect(formatted).toBe('Unknown');
    });

    test('should handle null dates', () => {
      const formatted = utils.formatDate(null);
      
      expect(formatted).toBe('Unknown');
    });
  });

  describe('Cooking Time Formatting', () => {
    test('should format minutes correctly', () => {
      expect(utils.formatCookingTime(30)).toBe('30 min');
      expect(utils.formatCookingTime(1)).toBe('1 min');
    });

    test('should format hours correctly', () => {
      expect(utils.formatCookingTime(60)).toBe('1 hr');
      expect(utils.formatCookingTime(120)).toBe('2 hr');
    });

    test('should format hours and minutes correctly', () => {
      expect(utils.formatCookingTime(90)).toBe('1 hr 30 min');
      expect(utils.formatCookingTime(125)).toBe('2 hr 5 min');
    });

    test('should handle zero and negative values', () => {
      expect(utils.formatCookingTime(0)).toBe('0 min');
      expect(utils.formatCookingTime(-5)).toBe('0 min');
    });
  });

  describe('Input Validation', () => {
    test('should validate search parameters correctly', () => {
      const validParams = {
        name: 'chicken',
        min_rating: 3,
        max_prep_time: 60,
        limit: 25
      };

      const result = utils.validateSearchParams(validParams);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized).toEqual(validParams);
    });

    test('should reject invalid rating values', () => {
      const invalidParams = { min_rating: 6 };
      const result = utils.validateSearchParams(invalidParams);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('min_rating must be between 0 and 5');
    });

    test('should reject negative prep times', () => {
      const invalidParams = { max_prep_time: -10 };
      const result = utils.validateSearchParams(invalidParams);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('max_prep_time must be positive');
    });

    test('should sanitize string inputs', () => {
      const params = { name: '  Chicken Recipe  ' };
      const result = utils.validateSearchParams(params);
      
      expect(result.isValid).toBe(true);
      expect(result.sanitized.name).toBe('Chicken Recipe');
    });

    test('should handle limit validation', () => {
      const validLimit = utils.validateSearchParams({ limit: 50 });
      expect(validLimit.isValid).toBe(true);
      
      const invalidLimit = utils.validateSearchParams({ limit: 1000 });
      expect(invalidLimit.isValid).toBe(false);
      expect(invalidLimit.errors).toContain('limit must not exceed 500');
    });
  });

  describe('Ingredient Parsing', () => {
    test('should parse ingredient list correctly', () => {
      const ingredientText = '2 cups flour\n1 tsp salt\n3 eggs, beaten';
      const parsed = utils.parseIngredients(ingredientText);
      
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(3);
      
      expect(parsed[0]).toEqual({
        quantity: '2',
        unit: 'cups',
        ingredient: 'flour',
        original: '2 cups flour'
      });
      
      expect(parsed[1]).toEqual({
        quantity: '1',
        unit: 'tsp',
        ingredient: 'salt',
        original: '1 tsp salt'
      });
    });

    test('should handle ingredients without quantities', () => {
      const ingredientText = 'Salt and pepper to taste';
      const parsed = utils.parseIngredients(ingredientText);
      
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toEqual({
        quantity: null,
        unit: null,
        ingredient: 'Salt and pepper to taste',
        original: 'Salt and pepper to taste'
      });
    });

    test('should handle empty ingredient list', () => {
      const parsed = utils.parseIngredients('');
      expect(parsed).toHaveLength(0);
      
      const parsedNull = utils.parseIngredients(null);
      expect(parsedNull).toHaveLength(0);
    });
  });

  describe('Error Formatting', () => {
    test('should create error responses correctly', () => {
      const formatted = utils.createErrorResponse('Database connection failed', 'search_recipes');
      
      expect(formatted).toHaveProperty('content');
      expect(formatted).toHaveProperty('isError');
      expect(formatted.isError).toBe(true);
      expect(formatted.content[0].text).toContain('Database connection failed');
    });

    test('should create success responses correctly', () => {
      const data = { recipes: [] };
      const formatted = utils.createSuccessResponse(data, { count: 0 });
      
      expect(formatted).toHaveProperty('content');
      expect(formatted).toHaveProperty('isError');
      expect(formatted.isError).toBe(false);
    });
  });

  describe('Text Processing', () => {
    test('should truncate long text', () => {
      const longText = 'a'.repeat(300);
      const truncated = utils.truncateText(longText, 100);
      
      expect(truncated.length).toBe(103); // 100 + '...'
      expect(truncated.endsWith('...')).toBe(true);
    });

    test('should not truncate short text', () => {
      const shortText = 'Short text';
      const result = utils.truncateText(shortText, 100);
      
      expect(result).toBe(shortText);
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize string inputs', () => {
      const input = '  Test String  ';
      const sanitized = utils.sanitizeInput(input);
      
      expect(sanitized).toBe('Test String');
    });

    test('should handle null and undefined inputs', () => {
      expect(utils.sanitizeInput(null)).toBe('');
      expect(utils.sanitizeInput(undefined)).toBe('');
    });
  });
});
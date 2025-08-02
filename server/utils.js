const fs = require('fs');
const path = require('path');

/**
 * Utility functions for the Paprika Recipe MCP Server
 */

/**
 * Validates that a file exists and is readable
 * @param {string} filePath - Path to the file to validate
 * @returns {boolean} - True if file exists and is readable
 */
function validateFileExists(filePath) {
  try {
    fs.accessSync(filePath, fs.constants.F_OK | fs.constants.R_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Safely parses a JSON string, returning null if invalid
 * @param {string} jsonString - JSON string to parse
 * @returns {object|null} - Parsed object or null if invalid
 */
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return null;
  }
}

/**
 * Formats a date for display in recipe results
 * @param {Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date || !(date instanceof Date)) {
    return 'Unknown';
  }
  
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Formats cooking time from minutes to human-readable format
 * @param {number} minutes - Time in minutes
 * @returns {string} - Formatted time string
 */
function formatCookingTime(minutes) {
  if (!minutes || minutes <= 0) {
    return 'Not specified';
  }
  
  if (minutes < 60) {
    return `${minutes} min`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  
  if (remainingMinutes === 0) {
    return `${hours} hr${hours > 1 ? 's' : ''}`;
  }
  
  return `${hours} hr${hours > 1 ? 's' : ''} ${remainingMinutes} min`;
}

/**
 * Sanitizes a string for safe database queries (additional layer of protection)
 * @param {string} input - Input string to sanitize
 * @returns {string} - Sanitized string
 */
function sanitizeInput(input) {
  if (typeof input !== 'string') {
    return String(input);
  }
  
  // Remove or escape potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/['"]/g, '') // Remove quotes (we use parameterized queries anyway)
    .trim()
    .substring(0, 500); // Limit length
}

/**
 * Validates recipe search parameters
 * @param {object} params - Search parameters to validate
 * @returns {object} - Validation result with isValid and errors
 */
function validateSearchParams(params) {
  const errors = [];
  
  if (params.min_rating !== undefined) {
    if (typeof params.min_rating !== 'number' || params.min_rating < 0 || params.min_rating > 5) {
      errors.push('min_rating must be a number between 0 and 5');
    }
  }
  
  if (params.max_prep_time !== undefined) {
    if (typeof params.max_prep_time !== 'number' || params.max_prep_time < 0) {
      errors.push('max_prep_time must be a positive number');
    }
  }
  
  if (params.max_cook_time !== undefined) {
    if (typeof params.max_cook_time !== 'number' || params.max_cook_time < 0) {
      errors.push('max_cook_time must be a positive number');
    }
  }
  
  if (params.limit !== undefined) {
    if (typeof params.limit !== 'number' || params.limit < 1 || params.limit > 500) {
      errors.push('limit must be a number between 1 and 500');
    }
  }
  
  if (params.offset !== undefined) {
    if (typeof params.offset !== 'number' || params.offset < 0) {
      errors.push('offset must be a non-negative number');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

/**
 * Validates date string in YYYY-MM-DD format
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - True if valid date format
 */
function validateDateString(dateString) {
  if (typeof dateString !== 'string') {
    return false;
  }
  
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return false;
  }
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

/**
 * Creates a safe error response object
 * @param {string} message - Error message
 * @param {string} toolName - Name of the tool that errored
 * @param {object} context - Additional context information
 * @returns {object} - Formatted error response
 */
function createErrorResponse(message, toolName, context = {}) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        error: message,
        tool: toolName,
        timestamp: new Date().toISOString(),
        context: context
      }, null, 2)
    }],
    isError: true
  };
}

/**
 * Creates a success response object
 * @param {object} data - Response data
 * @param {object} metadata - Additional metadata
 * @returns {object} - Formatted success response
 */
function createSuccessResponse(data, metadata = {}) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        ...data,
        metadata: {
          timestamp: new Date().toISOString(),
          ...metadata
        }
      }, null, 2)
    }]
  };
}

/**
 * Truncates text to specified length with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated text
 */
function truncateText(text, maxLength = 200) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  if (text.length <= maxLength) {
    return text;
  }
  
  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Extracts ingredients list from Paprika's text format
 * @param {string} ingredientsText - Raw ingredients text from database
 * @returns {Array} - Array of ingredient objects
 */
function parseIngredients(ingredientsText) {
  if (!ingredientsText || typeof ingredientsText !== 'string') {
    return [];
  }
  
  // Split by lines and filter out empty lines
  const lines = ingredientsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  
  return lines.map((line, index) => ({
    index: index + 1,
    text: line,
    // Try to extract quantity and ingredient name (basic parsing)
    quantity: extractQuantity(line),
    ingredient: extractIngredientName(line)
  }));
}

/**
 * Basic quantity extraction from ingredient line
 * @param {string} line - Ingredient line
 * @returns {string|null} - Extracted quantity or null
 */
function extractQuantity(line) {
  const quantityMatch = line.match(/^[\d\s\/-]+(?:\s+(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l))?/i);
  return quantityMatch ? quantityMatch[0].trim() : null;
}

/**
 * Basic ingredient name extraction from ingredient line
 * @param {string} line - Ingredient line
 * @returns {string} - Extracted ingredient name
 */
function extractIngredientName(line) {
  // Remove quantity and common measurement words from the beginning
  const cleaned = line.replace(/^[\d\s\/-]+(?:\s+(?:cups?|tbsp|tsp|oz|lbs?|g|kg|ml|l))?\s*/i, '');
  return cleaned.trim();
}

/**
 * Formats nutritional information for display
 * @param {string} nutritionText - Raw nutrition text from database
 * @returns {object|null} - Parsed nutrition object or null
 */
function parseNutrition(nutritionText) {
  if (!nutritionText || typeof nutritionText !== 'string') {
    return null;
  }
  
  try {
    // Try to parse as JSON first (some Paprika exports use JSON)
    return JSON.parse(nutritionText);
  } catch (error) {
    // If not JSON, try to parse as text
    const nutrition = {};
    const lines = nutritionText.split('\n');
    
    lines.forEach(line => {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim().toLowerCase();
        const value = line.substring(colonIndex + 1).trim();
        nutrition[key] = value;
      }
    });
    
    return Object.keys(nutrition).length > 0 ? nutrition : null;
  }
}

module.exports = {
  validateFileExists,
  safeJsonParse,
  formatDate,
  formatCookingTime,
  sanitizeInput,
  validateSearchParams,
  validateDateString,
  createErrorResponse,
  createSuccessResponse,
  truncateText,
  parseIngredients,
  parseNutrition
};
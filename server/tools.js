const { Tool } = require('@modelcontextprotocol/sdk/types.js');

const TOOLS = [
  {
    name: "search_recipes",
    description: "Search recipes by name, ingredients, categories, or ratings with flexible filtering options",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for recipe name, ingredients, or directions"
        },
        category: {
          type: "string",
          description: "Filter by recipe category (e.g., 'Italian', 'Desserts', 'Vegetarian')"
        },
        min_rating: {
          type: "number",
          minimum: 0,
          maximum: 5,
          description: "Minimum recipe rating (0-5 stars)"
        },
        max_prep_time: {
          type: "number",
          minimum: 0,
          description: "Maximum preparation time in minutes"
        },
        max_cook_time: {
          type: "number",
          minimum: 0,
          description: "Maximum cooking time in minutes"
        },
        favorites_only: {
          type: "boolean",
          description: "Show only favorite recipes"
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 500,
          default: 50,
          description: "Maximum number of results to return"
        },
        offset: {
          type: "number",
          minimum: 0,
          default: 0,
          description: "Number of results to skip (for pagination)"
        }
      },
      additionalProperties: false
    }
  },

  {
    name: "get_recipe",
    description: "Retrieve complete recipe details including ingredients, directions, timing, and nutritional information",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          description: "Unique recipe ID from search results"
        }
      },
      required: ["recipe_id"],
      additionalProperties: false
    }
  },

  {
    name: "list_categories",
    description: "Get all recipe categories with hierarchical structure and recipe counts",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: "get_meal_plan",
    description: "Retrieve planned meals for specified date ranges with associated recipes",
    inputSchema: {
      type: "object",
      properties: {
        start_date: {
          type: "string",
          format: "date",
          description: "Start date for meal plan (YYYY-MM-DD format)"
        },
        end_date: {
          type: "string",
          format: "date",
          description: "End date for meal plan (YYYY-MM-DD format)"
        }
      },
      required: ["start_date", "end_date"],
      additionalProperties: false
    }
  },

  {
    name: "search_by_ingredients",
    description: "Find recipes that contain specific ingredients - perfect for 'what can I make with...' queries",
    inputSchema: {
      type: "object",
      properties: {
        ingredients: {
          type: "array",
          items: {
            type: "string"
          },
          minItems: 1,
          description: "List of ingredients to search for in recipes"
        },
        exact_match: {
          type: "boolean",
          default: false,
          description: "Require all ingredients to be present (true) or any ingredients (false)"
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          default: 50,
          description: "Maximum number of results to return"
        }
      },
      required: ["ingredients"],
      additionalProperties: false
    }
  },

  {
    name: "get_grocery_lists",
    description: "Access grocery lists with items, quantities, and associated recipes",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: "get_pantry_inventory",
    description: "Check pantry stock levels and find recipes using available pantry ingredients",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false
    }
  },

  {
    name: "get_recipe_photos",
    description: "Retrieve photo information and metadata for recipe images",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          description: "Recipe ID to get photos for"
        }
      },
      required: ["recipe_id"],
      additionalProperties: false
    }
  },

  {
    name: "get_recent_recipes",
    description: "Get recently added or modified recipes with configurable time ranges",
    inputSchema: {
      type: "object",
      properties: {
        days_back: {
          type: "number",
          minimum: 1,
          maximum: 365,
          default: 30,
          description: "Number of days back to search for recent recipes"
        },
        limit: {
          type: "number",
          minimum: 1,
          maximum: 200,
          default: 20,
          description: "Maximum number of results to return"
        }
      },
      additionalProperties: false
    }
  },

  {
    name: "get_favorites",
    description: "Retrieve user's favorite recipes with ratings and quick access",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          minimum: 1,
          maximum: 500,
          default: 50,
          description: "Maximum number of favorite recipes to return"
        }
      },
      additionalProperties: false
    }
  },

  {
    name: "update_recipe_rating",
    description: "Update the star rating (0-5) for a specific recipe - requires write mode enabled",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          minimum: 1,
          description: "Unique recipe ID to update rating for"
        },
        rating: {
          type: "number",
          minimum: 0,
          maximum: 5,
          description: "New rating value (0-5 stars, decimals allowed)"
        }
      },
      required: ["recipe_id", "rating"],
      additionalProperties: false
    }
  },

  {
    name: "add_recipe_categories",
    description: "Add one or more categories to a recipe - requires write mode enabled",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          minimum: 1,
          description: "The ID of the recipe to add categories to"
        },
        category_ids: {
          type: "array",
          items: { 
            type: "integer", 
            minimum: 1 
          },
          description: "Array of category IDs to add to the recipe",
          minItems: 1,
          maxItems: 10
        },
        category_names: {
          type: "array",
          items: { 
            type: "string", 
            minLength: 1 
          },
          description: "Alternative: Array of category names to add (will be resolved to IDs)",
          minItems: 1,
          maxItems: 10
        }
      },
      required: ["recipe_id"],
      oneOf: [
        { required: ["category_ids"] },
        { required: ["category_names"] }
      ],
      additionalProperties: false
    }
  },

  {
    name: "remove_recipe_categories",
    description: "Remove one or more categories from a recipe - requires write mode enabled",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          minimum: 1,
          description: "The ID of the recipe to remove categories from"
        },
        category_ids: {
          type: "array",
          items: { 
            type: "integer", 
            minimum: 1 
          },
          description: "Array of category IDs to remove from the recipe",
          minItems: 1
        },
        category_names: {
          type: "array",
          items: { 
            type: "string", 
            minLength: 1 
          },
          description: "Alternative: Array of category names to remove",
          minItems: 1
        },
        remove_all: {
          type: "boolean",
          description: "Remove all categories from the recipe",
          default: false
        }
      },
      required: ["recipe_id"],
      additionalProperties: false
    }
  },

  {
    name: "update_recipe_categories",
    description: "Replace all categories for a recipe with a new set (atomic operation) - requires write mode enabled",
    inputSchema: {
      type: "object",
      properties: {
        recipe_id: {
          type: "integer",
          minimum: 1,
          description: "The ID of the recipe to update categories for"
        },
        category_ids: {
          type: "array",
          items: { 
            type: "integer", 
            minimum: 1 
          },
          description: "New complete set of category IDs for the recipe",
          maxItems: 10
        },
        category_names: {
          type: "array",
          items: { 
            type: "string", 
            minLength: 1 
          },
          description: "Alternative: New complete set of category names",
          maxItems: 10
        }
      },
      required: ["recipe_id"],
      oneOf: [
        { required: ["category_ids"] },
        { required: ["category_names"] }
      ],
      additionalProperties: false
    }
  }
];

async function handleToolCall(name, args, database) {
  try {
    switch (name) {
      case 'search_recipes':
        return await handleSearchRecipes(args, database);
      
      case 'get_recipe':
        return await handleGetRecipe(args, database);
      
      case 'list_categories':
        return await handleListCategories(args, database);
      
      case 'get_meal_plan':
        return await handleGetMealPlan(args, database);
      
      case 'search_by_ingredients':
        return await handleSearchByIngredients(args, database);
      
      case 'get_grocery_lists':
        return await handleGetGroceryLists(args, database);
      
      case 'get_pantry_inventory':
        return await handleGetPantryInventory(args, database);
      
      case 'get_recipe_photos':
        return await handleGetRecipePhotos(args, database);
      
      case 'get_recent_recipes':
        return await handleGetRecentRecipes(args, database);
      
      case 'get_favorites':
        return await handleGetFavorites(args, database);
      
      case 'update_recipe_rating':
        return await handleUpdateRecipeRating(args, database);
      
      case 'add_recipe_categories':
        return await handleAddRecipeCategories(args, database);
      
      case 'remove_recipe_categories':
        return await handleRemoveRecipeCategories(args, database);
      
      case 'update_recipe_categories':
        return await handleUpdateRecipeCategories(args, database);
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: `Error executing ${name}: ${error.message}`
      }],
      isError: true
    };
  }
}

async function handleSearchRecipes(args, database) {
  const options = {
    category: args.category,
    minRating: args.min_rating,
    maxPrepTime: args.max_prep_time,
    maxCookTime: args.max_cook_time,
    favorites: args.favorites_only,
    limit: args.limit || 50,
    offset: args.offset || 0
  };

  const recipes = await database.searchRecipes(args.query || '', options);
  
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        total_results: recipes.length,
        recipes: recipes,
        query_info: {
          search_query: args.query || '',
          filters_applied: Object.keys(options).filter(key => options[key] !== null && options[key] !== undefined),
          limit: options.limit,
          offset: options.offset
        }
      }, null, 2)
    }]
  };
}

async function handleGetRecipe(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }

  const recipe = await database.getRecipe(args.recipe_id);
  
  if (!recipe) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Recipe not found",
          recipe_id: args.recipe_id
        }, null, 2)
      }]
    };
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        recipe: recipe
      }, null, 2)
    }]
  };
}

async function handleListCategories(args, database) {
  const categories = await database.listCategories();
  
  const categorizedList = categories.map(cat => ({
    id: cat.id,
    name: cat.name,
    recipe_count: cat.recipe_count,
    is_subcategory: cat.parent_id !== null
  }));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        total_categories: categories.length,
        categories: categorizedList
      }, null, 2)
    }]
  };
}

async function handleGetMealPlan(args, database) {
  if (!args.start_date || !args.end_date) {
    throw new Error('start_date and end_date are required (YYYY-MM-DD format)');
  }

  const startDate = new Date(args.start_date);
  const endDate = new Date(args.end_date);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD');
  }

  if (startDate > endDate) {
    throw new Error('start_date must be before or equal to end_date');
  }

  const meals = await database.getMealPlan(startDate, endDate);

  const mealsByDate = {};
  meals.forEach(meal => {
    const dateKey = meal.meal_date.toISOString().split('T')[0];
    if (!mealsByDate[dateKey]) {
      mealsByDate[dateKey] = [];
    }
    mealsByDate[dateKey].push(meal);
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        date_range: {
          start_date: args.start_date,
          end_date: args.end_date
        },
        total_meals: meals.length,
        meals_by_date: mealsByDate
      }, null, 2)
    }]
  };
}

async function handleSearchByIngredients(args, database) {
  if (!args.ingredients || args.ingredients.length === 0) {
    throw new Error('At least one ingredient is required');
  }

  const options = {
    limit: args.limit || 50,
    exactMatch: args.exact_match || false
  };

  const recipes = await database.searchByIngredients(args.ingredients, options);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        search_ingredients: args.ingredients,
        exact_match: options.exactMatch,
        total_results: recipes.length,
        recipes: recipes
      }, null, 2)
    }]
  };
}

async function handleGetGroceryLists(args, database) {
  const groceryLists = await database.getGroceryLists();
  
  const summary = {
    total_lists: groceryLists.length,
    total_items: groceryLists.reduce((sum, list) => sum + list.items.length, 0),
    lists: groceryLists
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify(summary, null, 2)
    }]
  };
}

async function handleGetPantryInventory(args, database) {
  const inventory = await database.getPantryInventory();
  
  const now = new Date();
  const expiringSoon = inventory.filter(item => {
    if (!item.expiration_date) return false;
    const daysUntilExpiry = (item.expiration_date - now) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry <= 7 && daysUntilExpiry > 0;
  });

  const expired = inventory.filter(item => {
    if (!item.expiration_date) return false;
    return item.expiration_date < now;
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        total_items: inventory.length,
        in_stock_items: inventory.filter(item => item.in_stock).length,
        expiring_soon: expiringSoon.length,
        expired_items: expired.length,
        inventory: inventory,
        alerts: {
          expiring_soon: expiringSoon,
          expired: expired
        }
      }, null, 2)
    }]
  };
}

async function handleGetRecipePhotos(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }

  const photos = await database.getRecipePhotos(args.recipe_id);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        recipe_id: args.recipe_id,
        total_photos: photos.length,
        photos: photos
      }, null, 2)
    }]
  };
}

async function handleGetRecentRecipes(args, database) {
  const daysBack = args.days_back || 30;
  const limit = args.limit || 20;

  const recipes = await database.getRecentRecipes(daysBack, limit);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        search_period: `${daysBack} days`,
        total_results: recipes.length,
        recipes: recipes
      }, null, 2)
    }]
  };
}

async function handleGetFavorites(args, database) {
  const limit = args.limit || 50;
  const favorites = await database.getFavorites(limit);

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        total_favorites: favorites.length,
        favorites: favorites
      }, null, 2)
    }]
  };
}

async function handleUpdateRecipeRating(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }
  
  if (args.rating === undefined || args.rating === null) {
    throw new Error('rating is required');
  }

  try {
    const result = await database.updateRecipeRating(args.recipe_id, args.rating);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: "update_recipe_rating",
          success: result.success,
          recipe: {
            id: result.recipeId,
            name: result.recipeName,
            old_rating: result.oldRating,
            new_rating: result.newRating,
            updated_at: result.updatedAt
          },
          message: `Successfully updated rating for "${result.recipeName}" from ${result.oldRating} to ${result.newRating} stars`
        }, null, 2)
      }]
    };
  } catch (error) {
    // Handle specific write operation errors with helpful messages
    if (error.message.includes('Write operations are disabled')) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            operation: "update_recipe_rating",
            success: false,
            error: "write_operations_disabled",
            message: "Recipe rating updates require write mode to be enabled. Please enable write operations in the configuration.",
            recipe_id: args.recipe_id,
            rating: args.rating,
            help: "To enable write operations, set 'enableWriteOperations: true' in the MCP server configuration"
          }, null, 2)
        }]
      };
    }
    
    if (error.message.includes('Daily write limit reached')) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            operation: "update_recipe_rating",
            success: false,
            error: "daily_limit_reached",
            message: error.message,
            recipe_id: args.recipe_id,
            rating: args.rating
          }, null, 2)
        }]
      };
    }
    
    // Re-throw other errors to be handled by the general error handler
    throw error;
  }
}

async function handleAddRecipeCategories(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }

  let categoryIds;
  
  // Resolve category names to IDs if provided
  if (args.category_names) {
    if (!args.category_names || args.category_names.length === 0) {
      throw new Error('category_names cannot be empty');
    }
    
    try {
      const resolvedCategories = await database.resolveCategoryNames(args.category_names);
      categoryIds = resolvedCategories.map(cat => cat.id);
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            operation: "add_recipe_categories",
            success: false,
            error: "category_resolution_failed",
            message: error.message,
            recipe_id: args.recipe_id,
            requested_categories: args.category_names
          }, null, 2)
        }],
        isError: true
      };
    }
  } else {
    categoryIds = args.category_ids;
  }

  if (!categoryIds || categoryIds.length === 0) {
    throw new Error('Either category_ids or category_names is required');
  }

  try {
    const result = await database.addRecipeCategories(args.recipe_id, categoryIds);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: "add_recipe_categories",
          success: result.success,
          recipe: {
            id: result.recipeId,
            name: result.recipeName
          },
          categories_added: result.categoriesAdded,
          all_categories: result.allCategories,
          updated_at: result.updatedAt,
          message: `Successfully added ${result.categoriesAdded.length} categories to "${result.recipeName}"`
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleWriteOperationError('add_recipe_categories', error, args.recipe_id);
  }
}

async function handleRemoveRecipeCategories(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }

  let categoryIds;
  
  if (args.remove_all) {
    // Get all current categories for this recipe
    const currentCategories = await database.getRecipeCategories(args.recipe_id);
    categoryIds = currentCategories.map(cat => cat.id);
    
    if (categoryIds.length === 0) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            operation: "remove_recipe_categories",
            success: true,
            message: "Recipe has no categories to remove",
            recipe_id: args.recipe_id,
            categories_removed: [],
            all_categories: []
          }, null, 2)
        }]
      };
    }
  } else {
    // Resolve category names to IDs if provided
    if (args.category_names) {
      if (!args.category_names || args.category_names.length === 0) {
        throw new Error('category_names cannot be empty');
      }
      
      try {
        const resolvedCategories = await database.resolveCategoryNames(args.category_names);
        categoryIds = resolvedCategories.map(cat => cat.id);
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              operation: "remove_recipe_categories",
              success: false,
              error: "category_resolution_failed",
              message: error.message,
              recipe_id: args.recipe_id,
              requested_categories: args.category_names
            }, null, 2)
          }],
          isError: true
        };
      }
    } else {
      categoryIds = args.category_ids;
    }

    if (!categoryIds || categoryIds.length === 0) {
      throw new Error('Either category_ids, category_names, or remove_all is required');
    }
  }

  try {
    const result = await database.removeRecipeCategories(args.recipe_id, categoryIds);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: "remove_recipe_categories",
          success: result.success,
          recipe: {
            id: result.recipeId,
            name: result.recipeName
          },
          categories_removed: result.categoriesRemoved,
          all_categories: result.allCategories,
          updated_at: result.updatedAt,
          message: `Successfully removed ${result.categoriesRemoved.length} categories from "${result.recipeName}"`
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleWriteOperationError('remove_recipe_categories', error, args.recipe_id);
  }
}

async function handleUpdateRecipeCategories(args, database) {
  if (!args.recipe_id) {
    throw new Error('recipe_id is required');
  }

  let categoryIds = [];
  
  // Resolve category names to IDs if provided
  if (args.category_names) {
    if (args.category_names.length > 0) {
      try {
        const resolvedCategories = await database.resolveCategoryNames(args.category_names);
        categoryIds = resolvedCategories.map(cat => cat.id);
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              operation: "update_recipe_categories",
              success: false,
              error: "category_resolution_failed",
              message: error.message,
              recipe_id: args.recipe_id,
              requested_categories: args.category_names
            }, null, 2)
          }],
          isError: true
        };
      }
    }
  } else if (args.category_ids) {
    categoryIds = args.category_ids;
  }

  try {
    const result = await database.updateRecipeCategories(args.recipe_id, categoryIds);
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: "update_recipe_categories",
          success: result.success,
          recipe: {
            id: result.recipeId,
            name: result.recipeName
          },
          old_categories: result.oldCategories,
          new_categories: result.newCategories,
          updated_at: result.updatedAt,
          message: `Successfully updated categories for "${result.recipeName}": ${result.oldCategories.length} -> ${result.newCategories.length} categories`
        }, null, 2)
      }]
    };
  } catch (error) {
    return handleWriteOperationError('update_recipe_categories', error, args.recipe_id);
  }
}

function handleWriteOperationError(operation, error, recipeId) {
  // Handle specific write operation errors with helpful messages
  if (error.message.includes('Write operations are disabled')) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: operation,
          success: false,
          error: "write_operations_disabled",
          message: "Category operations require write mode to be enabled. Please enable write operations in the configuration.",
          recipe_id: recipeId,
          help: "To enable write operations, set 'enableWriteOperations: true' in the MCP server configuration"
        }, null, 2)
      }],
      isError: true
    };
  }
  
  if (error.message.includes('Daily write limit reached')) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          operation: operation,
          success: false,
          error: "daily_limit_reached",
          message: error.message,
          recipe_id: recipeId
        }, null, 2)
      }],
      isError: true
    };
  }
  
  // General error response
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        operation: operation,
        success: false,
        error: "operation_failed",
        message: error.message,
        recipe_id: recipeId
      }, null, 2)
    }],
    isError: true
  };
}

module.exports = {
  TOOLS,
  handleToolCall
};
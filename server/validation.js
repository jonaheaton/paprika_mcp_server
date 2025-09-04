class DatabaseValidator {
  constructor(debugMode = false) {
    this.debugMode = debugMode;
  }

  log(level, message) {
    if (this.debugMode || level === 'ERROR' || level === 'WARN') {
      const timestamp = new Date().toISOString();
      console.error(`[VALIDATOR-${level}] ${timestamp}: ${message}`);
    }
  }

  createValidationError(field, message, value = null) {
    return {
      field,
      message,
      value,
      timestamp: new Date().toISOString()
    };
  }

  validateRequired(value, fieldName) {
    if (value === null || value === undefined || value === '') {
      return this.createValidationError(fieldName, `${fieldName} is required`, value);
    }
    return null;
  }

  validateString(value, fieldName, options = {}) {
    const { minLength = 0, maxLength = null, required = true } = options;
    
    if (required) {
      const requiredError = this.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value !== null && value !== undefined) {
      if (typeof value !== 'string') {
        return this.createValidationError(fieldName, `${fieldName} must be a string`, value);
      }

      if (value.length < minLength) {
        return this.createValidationError(fieldName, `${fieldName} must be at least ${minLength} characters`, value);
      }

      if (maxLength && value.length > maxLength) {
        return this.createValidationError(fieldName, `${fieldName} must be no more than ${maxLength} characters`, value);
      }
    }

    return null;
  }

  validateNumber(value, fieldName, options = {}) {
    const { min = null, max = null, integer = false, required = true } = options;

    if (required) {
      const requiredError = this.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value !== null && value !== undefined) {
      const numValue = Number(value);
      
      if (isNaN(numValue)) {
        return this.createValidationError(fieldName, `${fieldName} must be a valid number`, value);
      }

      if (integer && !Number.isInteger(numValue)) {
        return this.createValidationError(fieldName, `${fieldName} must be an integer`, value);
      }

      if (min !== null && numValue < min) {
        return this.createValidationError(fieldName, `${fieldName} must be at least ${min}`, value);
      }

      if (max !== null && numValue > max) {
        return this.createValidationError(fieldName, `${fieldName} must be no more than ${max}`, value);
      }
    }

    return null;
  }

  validateDate(value, fieldName, options = {}) {
    const { required = true, futureOnly = false, pastOnly = false } = options;

    if (required) {
      const requiredError = this.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value !== null && value !== undefined) {
      let dateValue;
      
      if (value instanceof Date) {
        dateValue = value;
      } else if (typeof value === 'string') {
        dateValue = new Date(value);
      } else {
        return this.createValidationError(fieldName, `${fieldName} must be a valid date`, value);
      }

      if (isNaN(dateValue.getTime())) {
        return this.createValidationError(fieldName, `${fieldName} must be a valid date`, value);
      }

      const now = new Date();
      
      if (futureOnly && dateValue <= now) {
        return this.createValidationError(fieldName, `${fieldName} must be in the future`, value);
      }

      if (pastOnly && dateValue >= now) {
        return this.createValidationError(fieldName, `${fieldName} must be in the past`, value);
      }
    }

    return null;
  }

  validateArray(value, fieldName, options = {}) {
    const { minLength = 0, maxLength = null, required = true } = options;

    if (required) {
      const requiredError = this.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value !== null && value !== undefined) {
      if (!Array.isArray(value)) {
        return this.createValidationError(fieldName, `${fieldName} must be an array`, value);
      }

      if (value.length < minLength) {
        return this.createValidationError(fieldName, `${fieldName} must have at least ${minLength} items`, value);
      }

      if (maxLength && value.length > maxLength) {
        return this.createValidationError(fieldName, `${fieldName} must have no more than ${maxLength} items`, value);
      }
    }

    return null;
  }

  validateEmail(value, fieldName, options = {}) {
    const { required = true } = options;

    if (required) {
      const requiredError = this.validateRequired(value, fieldName);
      if (requiredError) return requiredError;
    }

    if (value !== null && value !== undefined && value !== '') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        return this.createValidationError(fieldName, `${fieldName} must be a valid email address`, value);
      }
    }

    return null;
  }

  // Paprika-specific validation methods

  validateRecipeRating(rating) {
    this.log('DEBUG', `Validating recipe rating: ${rating}`);
    
    const error = this.validateNumber(rating, 'rating', {
      min: 0,
      max: 5,
      integer: false,
      required: true
    });

    if (error) {
      this.log('WARN', `Invalid recipe rating: ${error.message}`);
    }

    return error;
  }

  validateRecipeId(recipeId) {
    this.log('DEBUG', `Validating recipe ID: ${recipeId}`);
    
    const error = this.validateNumber(recipeId, 'recipeId', {
      min: 1,
      integer: true,
      required: true
    });

    if (error) {
      this.log('WARN', `Invalid recipe ID: ${error.message}`);
    }

    return error;
  }

  validateCategoryId(categoryId) {
    this.log('DEBUG', `Validating category ID: ${categoryId}`);
    
    const error = this.validateNumber(categoryId, 'categoryId', {
      min: 1,
      integer: true,
      required: true
    });

    if (error) {
      this.log('WARN', `Invalid category ID: ${error.message}`);
    }

    return error;
  }

  validateCategoryIds(categoryIds) {
    this.log('DEBUG', `Validating category IDs: ${JSON.stringify(categoryIds)}`);
    
    // First validate it's an array
    const arrayError = this.validateArray(categoryIds, 'categoryIds', {
      minLength: 1,
      maxLength: 10,
      required: true
    });

    if (arrayError) {
      this.log('WARN', `Invalid category IDs array: ${arrayError.message}`);
      return arrayError;
    }

    // Validate each category ID
    for (let i = 0; i < categoryIds.length; i++) {
      const categoryId = categoryIds[i];
      const error = this.validateCategoryId(categoryId);
      
      if (error) {
        this.log('WARN', `Invalid category ID at index ${i}: ${error.message}`);
        return this.createValidationError('categoryIds', `Invalid category ID at index ${i}: ${error.message}`, categoryIds);
      }
    }

    // Check for duplicates
    const uniqueIds = [...new Set(categoryIds)];
    if (uniqueIds.length !== categoryIds.length) {
      const duplicates = categoryIds.filter((id, index) => categoryIds.indexOf(id) !== index);
      this.log('WARN', `Duplicate category IDs found: ${duplicates.join(', ')}`);
      return this.createValidationError('categoryIds', `Duplicate category IDs not allowed: ${duplicates.join(', ')}`, categoryIds);
    }

    return null;
  }

  validateRecipeData(recipeData) {
    this.log('DEBUG', 'Validating recipe data');
    
    const errors = [];

    // Required fields
    const nameError = this.validateString(recipeData.name, 'name', {
      minLength: 1,
      maxLength: 255,
      required: true
    });
    if (nameError) errors.push(nameError);

    // Optional fields
    if (recipeData.ingredients !== undefined) {
      const ingredientsError = this.validateString(recipeData.ingredients, 'ingredients', {
        maxLength: 10000,
        required: false
      });
      if (ingredientsError) errors.push(ingredientsError);
    }

    if (recipeData.directions !== undefined) {
      const directionsError = this.validateString(recipeData.directions, 'directions', {
        maxLength: 10000,
        required: false
      });
      if (directionsError) errors.push(directionsError);
    }

    if (recipeData.servings !== undefined) {
      const servingsError = this.validateString(recipeData.servings, 'servings', {
        maxLength: 100,
        required: false
      });
      if (servingsError) errors.push(servingsError);
    }

    if (recipeData.prepTime !== undefined) {
      const prepTimeError = this.validateNumber(recipeData.prepTime, 'prepTime', {
        min: 0,
        max: 10080, // 1 week in minutes
        integer: true,
        required: false
      });
      if (prepTimeError) errors.push(prepTimeError);
    }

    if (recipeData.cookTime !== undefined) {
      const cookTimeError = this.validateNumber(recipeData.cookTime, 'cookTime', {
        min: 0,
        max: 10080, // 1 week in minutes
        integer: true,
        required: false
      });
      if (cookTimeError) errors.push(cookTimeError);
    }

    if (recipeData.rating !== undefined) {
      const ratingError = this.validateRecipeRating(recipeData.rating);
      if (ratingError) errors.push(ratingError);
    }

    if (recipeData.source !== undefined) {
      const sourceError = this.validateString(recipeData.source, 'source', {
        maxLength: 255,
        required: false
      });
      if (sourceError) errors.push(sourceError);
    }

    if (recipeData.sourceUrl !== undefined) {
      const sourceUrlError = this.validateString(recipeData.sourceUrl, 'sourceUrl', {
        maxLength: 1000,
        required: false
      });
      if (sourceUrlError) errors.push(sourceUrlError);
    }

    if (recipeData.notes !== undefined) {
      const notesError = this.validateString(recipeData.notes, 'notes', {
        maxLength: 5000,
        required: false
      });
      if (notesError) errors.push(notesError);
    }

    if (errors.length > 0) {
      this.log('WARN', `Recipe validation failed with ${errors.length} errors`);
    } else {
      this.log('DEBUG', 'Recipe data validation passed');
    }

    return errors;
  }

  validateCategoryData(categoryData) {
    this.log('DEBUG', 'Validating category data');
    
    const errors = [];

    // Required fields
    const nameError = this.validateString(categoryData.name, 'name', {
      minLength: 1,
      maxLength: 100,
      required: true
    });
    if (nameError) errors.push(nameError);

    // Optional parent category
    if (categoryData.parentId !== undefined && categoryData.parentId !== null) {
      const parentIdError = this.validateCategoryId(categoryData.parentId);
      if (parentIdError) errors.push(parentIdError);
    }

    if (errors.length > 0) {
      this.log('WARN', `Category validation failed with ${errors.length} errors`);
    } else {
      this.log('DEBUG', 'Category data validation passed');
    }

    return errors;
  }

  validateMealPlanData(mealData) {
    this.log('DEBUG', 'Validating meal plan data');
    
    const errors = [];

    // Required fields
    const dateError = this.validateDate(mealData.date, 'date', {
      required: true
    });
    if (dateError) errors.push(dateError);

    const recipeIdError = this.validateRecipeId(mealData.recipeId);
    if (recipeIdError) errors.push(recipeIdError);

    // Meal type validation (if provided)
    if (mealData.mealType !== undefined) {
      const mealTypeError = this.validateNumber(mealData.mealType, 'mealType', {
        min: 1,
        integer: true,
        required: false
      });
      if (mealTypeError) errors.push(mealTypeError);
    }

    if (errors.length > 0) {
      this.log('WARN', `Meal plan validation failed with ${errors.length} errors`);
    } else {
      this.log('DEBUG', 'Meal plan data validation passed');
    }

    return errors;
  }

  validateGroceryItemData(itemData) {
    this.log('DEBUG', 'Validating grocery item data');
    
    const errors = [];

    // Required fields
    const nameError = this.validateString(itemData.name, 'name', {
      minLength: 1,
      maxLength: 255,
      required: true
    });
    if (nameError) errors.push(nameError);

    // Optional fields
    if (itemData.quantity !== undefined) {
      const quantityError = this.validateString(itemData.quantity, 'quantity', {
        maxLength: 100,
        required: false
      });
      if (quantityError) errors.push(quantityError);
    }

    if (itemData.aisle !== undefined) {
      const aisleError = this.validateString(itemData.aisle, 'aisle', {
        maxLength: 100,
        required: false
      });
      if (aisleError) errors.push(aisleError);
    }

    if (itemData.recipeName !== undefined) {
      const recipeNameError = this.validateString(itemData.recipeName, 'recipeName', {
        maxLength: 255,
        required: false
      });
      if (recipeNameError) errors.push(recipeNameError);
    }

    if (errors.length > 0) {
      this.log('WARN', `Grocery item validation failed with ${errors.length} errors`);
    } else {
      this.log('DEBUG', 'Grocery item data validation passed');
    }

    return errors;
  }

  validatePantryItemData(itemData) {
    this.log('DEBUG', 'Validating pantry item data');
    
    const errors = [];

    // Required fields
    const nameError = this.validateString(itemData.name, 'name', {
      minLength: 1,
      maxLength: 255,
      required: true
    });
    if (nameError) errors.push(nameError);

    // Optional fields
    if (itemData.expirationDate !== undefined && itemData.expirationDate !== null) {
      const expirationError = this.validateDate(itemData.expirationDate, 'expirationDate', {
        required: false
      });
      if (expirationError) errors.push(expirationError);
    }

    if (itemData.aisle !== undefined) {
      const aisleError = this.validateString(itemData.aisle, 'aisle', {
        maxLength: 100,
        required: false
      });
      if (aisleError) errors.push(aisleError);
    }

    if (errors.length > 0) {
      this.log('WARN', `Pantry item validation failed with ${errors.length} errors`);
    } else {
      this.log('DEBUG', 'Pantry item data validation passed');
    }

    return errors;
  }

  // Batch validation for multiple items
  validateBatch(items, validationFunction) {
    this.log('DEBUG', `Validating batch of ${items.length} items`);
    
    const results = {
      valid: [],
      invalid: [],
      totalErrors: 0
    };

    items.forEach((item, index) => {
      const errors = validationFunction.call(this, item);
      
      if (errors.length === 0) {
        results.valid.push({ index, item });
      } else {
        results.invalid.push({ index, item, errors });
        results.totalErrors += errors.length;
      }
    });

    this.log('DEBUG', `Batch validation: ${results.valid.length} valid, ${results.invalid.length} invalid`);
    
    return results;
  }

  // Comprehensive validation result formatter
  formatValidationResults(errors, operation = 'operation') {
    if (errors.length === 0) {
      return {
        isValid: true,
        operation,
        timestamp: new Date().toISOString()
      };
    }

    return {
      isValid: false,
      operation,
      errorCount: errors.length,
      errors: errors.map(error => ({
        field: error.field,
        message: error.message,
        value: error.value
      })),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = DatabaseValidator;
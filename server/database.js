const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const DatabaseBackup = require('./backup.js');
const DatabaseValidator = require('./validation.js');
const AuditLogger = require('./audit.js');

class PaprikaDatabase {
  constructor(dbPath, debugMode = false, config = {}) {
    this.dbPath = dbPath;
    this.debugMode = debugMode;
    this.db = null;
    
    // Write operation configuration
    this.config = {
      enableWriteOperations: config.enableWriteOperations || false,
      autoBackupEnabled: config.autoBackupEnabled !== false, // default true
      requireConfirmation: config.requireConfirmation !== false, // default true
      maxDailyWrites: config.maxDailyWrites || 1000,
      ...config
    };
    
    // Initialize supporting systems
    this.backup = new DatabaseBackup(dbPath, null, debugMode);
    this.validator = new DatabaseValidator(debugMode);
    this.audit = new AuditLogger(null, debugMode);
    
    // Transaction state
    this.inTransaction = false;
    this.transactionDepth = 0;
    
    // Write operation tracking
    this.dailyWriteCount = 0;
    this.lastWriteDate = null;
  }

  async connect() {
    const mode = this.config.enableWriteOperations 
      ? sqlite3.OPEN_READWRITE 
      : sqlite3.OPEN_READONLY;
      
    const modeStr = this.config.enableWriteOperations ? 'READ-WRITE' : 'READ-ONLY';
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, mode, (err) => {
        if (err) {
          this.log('ERROR', `Failed to connect to database: ${err.message}`);
          reject(err);
        } else {
          this.log('INFO', `Connected to Paprika database at ${this.dbPath} (${modeStr} mode)`);
          
          // Configure database for better performance and safety
          if (this.config.enableWriteOperations) {
            this.db.serialize(() => {
              // Enable foreign key constraints
              this.db.run('PRAGMA foreign_keys = ON');
              // Use WAL mode for better concurrency
              this.db.run('PRAGMA journal_mode = WAL');
              // Sync to disk more frequently for safety
              this.db.run('PRAGMA synchronous = FULL');
            });
          }
          
          resolve();
        }
      });
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.log('INFO', 'Database connection closed');
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  log(level, message) {
    if (this.debugMode || level === 'ERROR') {
      console.error(`[${level}] ${new Date().toISOString()}: ${message}`);
    }
  }

  convertCoreDataTimestamp(timestamp) {
    if (!timestamp) return null;
    const CORE_DATA_EPOCH_OFFSET = 978307200;
    return new Date((timestamp + CORE_DATA_EPOCH_OFFSET) * 1000);
  }

  convertToSQLiteTimestamp(date) {
    if (!date) return null;
    const CORE_DATA_EPOCH_OFFSET = 978307200;
    return (date.getTime() / 1000) - CORE_DATA_EPOCH_OFFSET;
  }

  // Transaction Management Methods

  async beginTransaction() {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled');
    }

    return new Promise((resolve, reject) => {
      if (this.transactionDepth === 0) {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            this.log('ERROR', `Failed to begin transaction: ${err.message}`);
            reject(err);
          } else {
            this.inTransaction = true;
            this.transactionDepth = 1;
            this.log('DEBUG', 'Transaction started');
            resolve();
          }
        });
      } else {
        // Nested transaction - use savepoints
        const savepointName = `sp_${this.transactionDepth}`;
        this.db.run(`SAVEPOINT ${savepointName}`, (err) => {
          if (err) {
            this.log('ERROR', `Failed to create savepoint: ${err.message}`);
            reject(err);
          } else {
            this.transactionDepth++;
            this.log('DEBUG', `Savepoint ${savepointName} created`);
            resolve();
          }
        });
      }
    });
  }

  async commitTransaction() {
    if (!this.inTransaction) {
      throw new Error('No active transaction to commit');
    }

    return new Promise((resolve, reject) => {
      if (this.transactionDepth === 1) {
        this.db.run('COMMIT', (err) => {
          if (err) {
            this.log('ERROR', `Failed to commit transaction: ${err.message}`);
            reject(err);
          } else {
            this.inTransaction = false;
            this.transactionDepth = 0;
            this.log('DEBUG', 'Transaction committed');
            resolve();
          }
        });
      } else {
        // Release savepoint
        const savepointName = `sp_${this.transactionDepth - 1}`;
        this.db.run(`RELEASE SAVEPOINT ${savepointName}`, (err) => {
          if (err) {
            this.log('ERROR', `Failed to release savepoint: ${err.message}`);
            reject(err);
          } else {
            this.transactionDepth--;
            this.log('DEBUG', `Savepoint ${savepointName} released`);
            resolve();
          }
        });
      }
    });
  }

  async rollbackTransaction() {
    if (!this.inTransaction) {
      throw new Error('No active transaction to rollback');
    }

    return new Promise((resolve, reject) => {
      if (this.transactionDepth === 1) {
        this.db.run('ROLLBACK', (err) => {
          if (err) {
            this.log('ERROR', `Failed to rollback transaction: ${err.message}`);
            reject(err);
          } else {
            this.inTransaction = false;
            this.transactionDepth = 0;
            this.log('DEBUG', 'Transaction rolled back');
            resolve();
          }
        });
      } else {
        // Rollback to savepoint
        const savepointName = `sp_${this.transactionDepth - 1}`;
        this.db.run(`ROLLBACK TO SAVEPOINT ${savepointName}`, (err) => {
          if (err) {
            this.log('ERROR', `Failed to rollback to savepoint: ${err.message}`);
            reject(err);
          } else {
            this.transactionDepth--;
            this.log('DEBUG', `Rolled back to savepoint ${savepointName}`);
            resolve();
          }
        });
      }
    });
  }

  async executeInTransaction(operation, operationName = 'unknown') {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled');
    }

    // Check daily write limit
    await this.checkWriteLimit();

    // Create backup if enabled
    if (this.config.autoBackupEnabled) {
      await this.createBackupBeforeWrite();
    }

    const operationId = this.audit.logOperation(operationName);
    const startTime = Date.now();

    try {
      await this.beginTransaction();
      
      const result = await operation();
      
      await this.commitTransaction();
      
      // Update write tracking
      this.incrementWriteCount();
      
      const duration = Date.now() - startTime;
      this.audit.logOperationSuccess(operationId, result, duration);
      
      this.log('DEBUG', `Write operation '${operationName}' completed successfully`);
      return result;

    } catch (error) {
      try {
        if (this.inTransaction) {
          await this.rollbackTransaction();
        }
      } catch (rollbackError) {
        this.log('ERROR', `Failed to rollback after error: ${rollbackError.message}`);
      }
      
      this.audit.logOperationFailure(operationId, error, { operationName });
      this.log('ERROR', `Write operation '${operationName}' failed: ${error.message}`);
      
      throw error;
    }
  }

  // Write Operation Safety Methods

  async checkWriteLimit() {
    const today = new Date().toDateString();
    
    if (this.lastWriteDate !== today) {
      this.dailyWriteCount = 0;
      this.lastWriteDate = today;
    }
    
    if (this.dailyWriteCount >= this.config.maxDailyWrites) {
      throw new Error(`Daily write limit reached (${this.config.maxDailyWrites}). Please try again tomorrow.`);
    }
  }

  incrementWriteCount() {
    const today = new Date().toDateString();
    
    if (this.lastWriteDate !== today) {
      this.dailyWriteCount = 0;
      this.lastWriteDate = today;
    }
    
    this.dailyWriteCount++;
  }

  async createBackupBeforeWrite() {
    try {
      const backupInfo = await this.backup.createBackup();
      this.log('INFO', `Backup created before write operation: ${backupInfo.backupPath}`);
      return backupInfo;
    } catch (error) {
      this.log('ERROR', `Failed to create backup before write: ${error.message}`);
      if (this.config.requireConfirmation) {
        throw new Error('Cannot proceed with write operation - backup failed');
      }
    }
  }

  // Helper method for safe SQL execution
  async runSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  async getSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  async allSQL(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  async searchRecipes(query = '', options = {}) {
    const {
      category = null,
      minRating = null,
      maxPrepTime = null,
      maxCookTime = null,
      favorites = null,
      limit = 50,
      offset = 0
    } = options;

    let sql = `
      SELECT DISTINCT r.Z_PK as id, r.ZNAME as name, r.ZRATING as rating,
             r.ZPREPTIME as prep_time, r.ZCOOKTIME as cook_time, r.ZTOTALTIME as total_time,
             r.ZSERVINGS as servings, r.ZSOURCE as source, r.ZSOURCEURL as source_url,
             r.ZCREATED as created_date, r.ZONFAVORITES as is_favorite,
             r.ZINGREDIENTS as ingredients_preview,
             GROUP_CONCAT(rc.ZNAME, ', ') as categories
      FROM ZRECIPE r
      LEFT JOIN Z_12CATEGORIES zc ON r.Z_PK = zc.Z_12RECIPES
      LEFT JOIN ZRECIPECATEGORY rc ON zc.Z_13CATEGORIES = rc.Z_PK
      WHERE r.ZINTRASH = 0
    `;

    const params = [];

    if (query) {
      sql += ` AND (r.ZNAME LIKE ? OR r.ZINGREDIENTS LIKE ? OR r.ZDIRECTIONS LIKE ?)`;
      const searchTerm = `%${query}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (category) {
      sql += ` AND rc.ZNAME LIKE ?`;
      params.push(`%${category}%`);
    }

    if (minRating !== null) {
      sql += ` AND r.ZRATING >= ?`;
      params.push(minRating);
    }

    if (maxPrepTime !== null) {
      sql += ` AND (r.ZPREPTIME IS NULL OR r.ZPREPTIME <= ?)`;
      params.push(maxPrepTime);
    }

    if (maxCookTime !== null) {
      sql += ` AND (r.ZCOOKTIME IS NULL OR r.ZCOOKTIME <= ?)`;
      params.push(maxCookTime);
    }

    if (favorites !== null) {
      sql += ` AND r.ZONFAVORITES = ?`;
      params.push(favorites ? 1 : 0);
    }

    sql += `
      GROUP BY r.Z_PK
      ORDER BY r.ZNAME ASC
      LIMIT ? OFFSET ?
    `;
    params.push(limit, offset);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          this.log('ERROR', `Search recipes error: ${err.message}`);
          reject(err);
        } else {
          const results = rows.map(row => ({
            id: row.id,
            name: row.name,
            rating: row.rating,
            prep_time: row.prep_time,
            cook_time: row.cook_time,
            total_time: row.total_time,
            servings: row.servings,
            source: row.source,
            source_url: row.source_url,
            created_date: this.convertCoreDataTimestamp(row.created_date),
            is_favorite: Boolean(row.is_favorite),
            categories: row.categories ? row.categories.split(', ') : [],
            ingredients_preview: row.ingredients_preview ? row.ingredients_preview.substring(0, 200) + '...' : null
          }));
          this.log('DEBUG', `Found ${results.length} recipes`);
          resolve(results);
        }
      });
    });
  }

  async getRecipe(recipeId) {
    const sql = `
      SELECT r.*, GROUP_CONCAT(rc.ZNAME, ', ') as categories
      FROM ZRECIPE r
      LEFT JOIN Z_12CATEGORIES zc ON r.Z_PK = zc.Z_12RECIPES
      LEFT JOIN ZRECIPECATEGORY rc ON zc.Z_13CATEGORIES = rc.Z_PK
      WHERE r.Z_PK = ? AND r.ZINTRASH = 0
      GROUP BY r.Z_PK
    `;

    return new Promise((resolve, reject) => {
      this.db.get(sql, [recipeId], (err, row) => {
        if (err) {
          this.log('ERROR', `Get recipe error: ${err.message}`);
          reject(err);
        } else if (!row) {
          resolve(null);
        } else {
          const recipe = {
            id: row.Z_PK,
            name: row.ZNAME,
            ingredients: row.ZINGREDIENTS,
            directions: row.ZDIRECTIONS,
            prep_time: row.ZPREPTIME,
            cook_time: row.ZCOOKTIME,
            total_time: row.ZTOTALTIME,
            servings: row.ZSERVINGS,
            rating: row.ZRATING,
            source: row.ZSOURCE,
            source_url: row.ZSOURCEURL,
            notes: row.ZNOTES,
            nutritional_info: row.ZNUTRITIONALINFO,
            created_date: this.convertCoreDataTimestamp(row.ZCREATED),
            modified_date: this.convertCoreDataTimestamp(row.ZMODIFIED),
            is_favorite: Boolean(row.ZONFAVORITES),
            categories: row.categories ? row.categories.split(', ') : [],
            photo_hash: row.ZPHOTOHASH
          };
          resolve(recipe);
        }
      });
    });
  }

  async listCategories() {
    const sql = `
      SELECT rc.Z_PK as id, rc.ZNAME as name, rc.ZPARENT as parent_id,
             COUNT(DISTINCT zc.Z_12RECIPES) as recipe_count
      FROM ZRECIPECATEGORY rc
      LEFT JOIN Z_12CATEGORIES zc ON rc.Z_PK = zc.Z_13CATEGORIES
      LEFT JOIN ZRECIPE r ON zc.Z_12RECIPES = r.Z_PK AND r.ZINTRASH = 0
      GROUP BY rc.Z_PK, rc.ZNAME, rc.ZPARENT
      ORDER BY rc.ZNAME ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          this.log('ERROR', `List categories error: ${err.message}`);
          reject(err);
        } else {
          const categories = rows.map(row => ({
            id: row.id,
            name: row.name,
            parent_id: row.parent_id,
            recipe_count: row.recipe_count || 0
          }));
          resolve(categories);
        }
      });
    });
  }

  async getMealPlan(startDate, endDate) {
    const sql = `
      SELECT m.ZDATE as meal_date, m.ZTYPE as meal_type, 
             mt.ZNAME as meal_type_name, r.Z_PK as recipe_id, r.ZNAME as recipe_name
      FROM ZMEAL m
      LEFT JOIN ZMEALTYPE mt ON m.ZTYPE = mt.Z_PK
      LEFT JOIN ZRECIPE r ON m.ZRECIPE = r.Z_PK
      WHERE m.ZDATE >= ? AND m.ZDATE <= ?
      ORDER BY m.ZDATE ASC, m.ZTYPE ASC
    `;

    const startTimestamp = (startDate.getTime() / 1000) - 978307200;
    const endTimestamp = (endDate.getTime() / 1000) - 978307200;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [startTimestamp, endTimestamp], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get meal plan error: ${err.message}`);
          reject(err);
        } else {
          const meals = rows.map(row => ({
            meal_date: this.convertCoreDataTimestamp(row.meal_date),
            meal_type: row.meal_type,
            meal_type_name: row.meal_type_name,
            recipe_id: row.recipe_id,
            recipe_name: row.recipe_name
          }));
          resolve(meals);
        }
      });
    });
  }

  async searchByIngredients(ingredients, options = {}) {
    const { limit = 50, exactMatch = false } = options;
    
    let sql = `
      SELECT DISTINCT r.Z_PK as id, r.ZNAME as name, r.ZRATING as rating,
             r.ZINGREDIENTS as ingredients,
             GROUP_CONCAT(rc.ZNAME, ', ') as categories
      FROM ZRECIPE r
      LEFT JOIN Z_12CATEGORIES zc ON r.Z_PK = zc.Z_12RECIPES
      LEFT JOIN ZRECIPECATEGORY rc ON zc.Z_13CATEGORIES = rc.Z_PK
      WHERE r.ZINTRASH = 0
    `;

    const params = [];
    const ingredientClauses = [];

    ingredients.forEach(ingredient => {
      if (exactMatch) {
        ingredientClauses.push(`r.ZINGREDIENTS LIKE ?`);
        params.push(`%${ingredient}%`);
      } else {
        ingredientClauses.push(`r.ZINGREDIENTS LIKE ?`);
        params.push(`%${ingredient}%`);
      }
    });

    if (ingredientClauses.length > 0) {
      sql += ` AND (${ingredientClauses.join(' AND ')})`;
    }

    sql += `
      GROUP BY r.Z_PK
      ORDER BY r.ZRATING DESC, r.ZNAME ASC
      LIMIT ?
    `;
    params.push(limit);

    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          this.log('ERROR', `Search by ingredients error: ${err.message}`);
          reject(err);
        } else {
          const results = rows.map(row => ({
            id: row.id,
            name: row.name,
            rating: row.rating,
            categories: row.categories ? row.categories.split(', ') : [],
            matching_ingredients: this.extractMatchingIngredients(row.ingredients, ingredients)
          }));
          resolve(results);
        }
      });
    });
  }

  extractMatchingIngredients(ingredientText, searchIngredients) {
    if (!ingredientText) return [];
    
    const matches = [];
    const lowerIngredientText = ingredientText.toLowerCase();
    
    searchIngredients.forEach(ingredient => {
      if (lowerIngredientText.includes(ingredient.toLowerCase())) {
        matches.push(ingredient);
      }
    });
    
    return matches;
  }

  async getGroceryLists() {
    const sql = `
      SELECT gl.Z_PK as list_id, gl.ZNAME as list_name,
             gi.ZNAME as item_name, gi.ZQUANTITY as quantity,
             gi.ZAISLE as aisle, gi.ZRECIPENAME as recipe_name,
             gi.ZPURCHASED as is_purchased
      FROM ZGROCERYLIST gl
      LEFT JOIN ZGROCERYITEM gi ON gl.Z_PK = gi.ZGROCERYLIST
      ORDER BY gl.ZNAME ASC, gi.ZAISLE ASC, gi.ZNAME ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get grocery lists error: ${err.message}`);
          reject(err);
        } else {
          const listsMap = new Map();
          
          rows.forEach(row => {
            if (!listsMap.has(row.list_id)) {
              listsMap.set(row.list_id, {
                id: row.list_id,
                name: row.list_name,
                items: []
              });
            }
            
            if (row.item_name) {
              listsMap.get(row.list_id).items.push({
                name: row.item_name,
                quantity: row.quantity,
                aisle: row.aisle,
                recipe_name: row.recipe_name,
                is_purchased: Boolean(row.is_purchased)
              });
            }
          });
          
          resolve(Array.from(listsMap.values()));
        }
      });
    });
  }

  async getPantryInventory() {
    const sql = `
      SELECT pi.ZNAME as item_name, pi.ZEXPIRATIONDATE as expiration_date,
             pi.ZINSTOCKSTATUS as in_stock, ga.ZNAME as aisle
      FROM ZPANTRYITEM pi
      LEFT JOIN ZGROCERYAISLE ga ON pi.ZAISLE = ga.Z_PK
      ORDER BY pi.ZEXPIRATIONDATE ASC, pi.ZNAME ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get pantry inventory error: ${err.message}`);
          reject(err);
        } else {
          const inventory = rows.map(row => ({
            item_name: row.item_name,
            expiration_date: this.convertCoreDataTimestamp(row.expiration_date),
            in_stock: Boolean(row.in_stock),
            aisle: row.aisle
          }));
          resolve(inventory);
        }
      });
    });
  }

  async getRecipePhotos(recipeId) {
    const sql = `
      SELECT rp.Z_PK as photo_id, rp.ZHASH as photo_hash,
             rp.ZNAME as photo_name, rp.ZCREATED as created_date
      FROM ZRECIPEPHOTO rp
      WHERE rp.ZRECIPE = ?
      ORDER BY rp.ZCREATED ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [recipeId], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get recipe photos error: ${err.message}`);
          reject(err);
        } else {
          const photos = rows.map(row => ({
            photo_id: row.photo_id,
            photo_hash: row.photo_hash,
            photo_name: row.photo_name,
            created_date: this.convertCoreDataTimestamp(row.created_date)
          }));
          resolve(photos);
        }
      });
    });
  }

  async getRecentRecipes(daysBack = 30, limit = 20) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const cutoffTimestamp = (cutoffDate.getTime() / 1000) - 978307200;

    const sql = `
      SELECT r.Z_PK as id, r.ZNAME as name, r.ZRATING as rating,
             r.ZCREATED as created_date,
             GROUP_CONCAT(rc.ZNAME, ', ') as categories
      FROM ZRECIPE r
      LEFT JOIN Z_12CATEGORIES zc ON r.Z_PK = zc.Z_12RECIPES
      LEFT JOIN ZRECIPECATEGORY rc ON zc.Z_13CATEGORIES = rc.Z_PK
      WHERE r.ZINTRASH = 0 AND r.ZCREATED >= ?
      GROUP BY r.Z_PK
      ORDER BY r.ZCREATED DESC
      LIMIT ?
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [cutoffTimestamp, limit], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get recent recipes error: ${err.message}`);
          reject(err);
        } else {
          const recipes = rows.map(row => ({
            id: row.id,
            name: row.name,
            rating: row.rating,
            created_date: this.convertCoreDataTimestamp(row.created_date),
            categories: row.categories ? row.categories.split(', ') : []
          }));
          resolve(recipes);
        }
      });
    });
  }

  async getFavorites(limit = 50) {
    return this.searchRecipes('', { favorites: true, limit });
  }

  // Write Operations - Recipe Management

  async updateRecipeRating(recipeId, rating) {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled. Enable write mode in configuration.');
    }

    // Validate inputs
    const recipeIdError = this.validator.validateRecipeId(recipeId);
    if (recipeIdError) {
      throw new Error(`Invalid recipe ID: ${recipeIdError.message}`);
    }

    const ratingError = this.validator.validateRecipeRating(rating);
    if (ratingError) {
      throw new Error(`Invalid rating: ${ratingError.message}`);
    }

    const operationName = `update_recipe_rating_${recipeId}_to_${rating}`;
    
    return await this.executeInTransaction(async () => {
      // First verify the recipe exists and is not deleted
      const checkRecipeSQL = `
        SELECT Z_PK, ZNAME, ZRATING 
        FROM ZRECIPE 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const existingRecipe = await this.getSQL(checkRecipeSQL, [recipeId]);
      
      if (!existingRecipe) {
        throw new Error(`Recipe with ID ${recipeId} not found or is deleted`);
      }

      const oldRating = existingRecipe.ZRATING;
      
      // Update the recipe rating
      const updateSQL = `
        UPDATE ZRECIPE 
        SET ZRATING = ? 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const result = await this.runSQL(updateSQL, [rating, recipeId]);

      if (result.changes === 0) {
        throw new Error(`Failed to update recipe rating - no rows affected`);
      }

      // Verify the update was successful
      const verifySQL = `
        SELECT ZRATING 
        FROM ZRECIPE 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const updatedRecipe = await this.getSQL(verifySQL, [recipeId]);
      
      if (!updatedRecipe || updatedRecipe.ZRATING !== rating) {
        throw new Error('Rating update verification failed');
      }

      this.log('INFO', `Recipe rating updated: ID ${recipeId} from ${oldRating} to ${rating}`);
      
      return {
        success: true,
        recipeId: recipeId,
        recipeName: existingRecipe.ZNAME,
        oldRating: oldRating,
        newRating: rating,
        updatedAt: new Date().toISOString()
      };
    }, operationName);
  }

  // Category Management Methods

  async getRecipeCategories(recipeId) {
    const sql = `
      SELECT rc.Z_PK as id, rc.ZNAME as name, rc.ZPARENT as parent_id
      FROM Z_12CATEGORIES j
      JOIN ZRECIPECATEGORY rc ON rc.Z_PK = j.Z_13CATEGORIES
      WHERE j.Z_12RECIPES = ?
      ORDER BY rc.ZNAME ASC
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, [recipeId], (err, rows) => {
        if (err) {
          this.log('ERROR', `Get recipe categories error: ${err.message}`);
          reject(err);
        } else {
          const categories = rows.map(row => ({
            id: row.id,
            name: row.name,
            parent_id: row.parent_id
          }));
          resolve(categories);
        }
      });
    });
  }

  async resolveCategoryNames(categoryNames) {
    if (!categoryNames || categoryNames.length === 0) {
      return [];
    }

    const placeholders = categoryNames.map(() => '?').join(',');
    const sql = `
      SELECT Z_PK as id, ZNAME as name
      FROM ZRECIPECATEGORY
      WHERE ZNAME IN (${placeholders})
    `;

    return new Promise((resolve, reject) => {
      this.db.all(sql, categoryNames, (err, rows) => {
        if (err) {
          this.log('ERROR', `Resolve category names error: ${err.message}`);
          reject(err);
        } else {
          const foundCategories = rows.map(row => ({
            id: row.id,
            name: row.name
          }));

          // Check for any missing categories
          const foundNames = foundCategories.map(c => c.name);
          const missingNames = categoryNames.filter(name => !foundNames.includes(name));

          if (missingNames.length > 0) {
            reject(new Error(`Categories not found: ${missingNames.join(', ')}`));
          } else {
            resolve(foundCategories);
          }
        }
      });
    });
  }

  async addRecipeCategories(recipeId, categoryIds) {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled. Enable write mode in configuration.');
    }

    // Validate inputs
    const recipeIdError = this.validator.validateRecipeId(recipeId);
    if (recipeIdError) {
      throw new Error(`Invalid recipe ID: ${recipeIdError.message}`);
    }

    const categoryError = this.validator.validateCategoryIds(categoryIds);
    if (categoryError) {
      throw new Error(`Invalid category IDs: ${categoryError.message}`);
    }

    const operationName = `add_recipe_categories_${recipeId}`;
    
    return await this.executeInTransaction(async () => {
      // Verify recipe exists
      const checkRecipeSQL = `
        SELECT Z_PK, ZNAME 
        FROM ZRECIPE 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const existingRecipe = await this.getSQL(checkRecipeSQL, [recipeId]);
      if (!existingRecipe) {
        throw new Error(`Recipe with ID ${recipeId} not found or is deleted`);
      }

      // Get current categories
      const currentCategories = await this.getRecipeCategories(recipeId);
      const currentCategoryIds = currentCategories.map(c => c.id);

      // Verify all category IDs exist
      const verifyCategoriesSQL = `
        SELECT Z_PK as id, ZNAME as name
        FROM ZRECIPECATEGORY
        WHERE Z_PK IN (${categoryIds.map(() => '?').join(',')})
      `;
      
      const verifiedCategories = await this.allSQL(verifyCategoriesSQL, categoryIds);
      if (verifiedCategories.length !== categoryIds.length) {
        const foundIds = verifiedCategories.map(c => c.id);
        const missingIds = categoryIds.filter(id => !foundIds.includes(id));
        throw new Error(`Category IDs not found: ${missingIds.join(', ')}`);
      }

      // Filter out categories that are already assigned
      const newCategoryIds = categoryIds.filter(id => !currentCategoryIds.includes(id));
      
      if (newCategoryIds.length === 0) {
        throw new Error('All specified categories are already assigned to this recipe');
      }

      // Insert new category assignments
      const insertPromises = newCategoryIds.map(categoryId => {
        const insertSQL = `
          INSERT INTO Z_12CATEGORIES (Z_12RECIPES, Z_13CATEGORIES)
          VALUES (?, ?)
        `;
        return this.runSQL(insertSQL, [recipeId, categoryId]);
      });

      await Promise.all(insertPromises);

      // Get updated categories
      const updatedCategories = await this.getRecipeCategories(recipeId);
      const addedCategories = verifiedCategories.filter(c => newCategoryIds.includes(c.id));

      this.log('INFO', `Added ${newCategoryIds.length} categories to recipe ${recipeId}`);
      
      return {
        success: true,
        recipeId: recipeId,
        recipeName: existingRecipe.ZNAME,
        categoriesAdded: addedCategories,
        allCategories: updatedCategories,
        updatedAt: new Date().toISOString()
      };
    }, operationName);
  }

  async removeRecipeCategories(recipeId, categoryIds) {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled. Enable write mode in configuration.');
    }

    // Validate inputs
    const recipeIdError = this.validator.validateRecipeId(recipeId);
    if (recipeIdError) {
      throw new Error(`Invalid recipe ID: ${recipeIdError.message}`);
    }

    const categoryError = this.validator.validateCategoryIds(categoryIds);
    if (categoryError) {
      throw new Error(`Invalid category IDs: ${categoryError.message}`);
    }

    const operationName = `remove_recipe_categories_${recipeId}`;
    
    return await this.executeInTransaction(async () => {
      // Verify recipe exists
      const checkRecipeSQL = `
        SELECT Z_PK, ZNAME 
        FROM ZRECIPE 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const existingRecipe = await this.getSQL(checkRecipeSQL, [recipeId]);
      if (!existingRecipe) {
        throw new Error(`Recipe with ID ${recipeId} not found or is deleted`);
      }

      // Get current categories
      const currentCategories = await this.getRecipeCategories(recipeId);
      const currentCategoryIds = currentCategories.map(c => c.id);

      // Check which categories are actually assigned
      const categoriesToRemove = categoryIds.filter(id => currentCategoryIds.includes(id));
      
      if (categoriesToRemove.length === 0) {
        throw new Error('None of the specified categories are assigned to this recipe');
      }

      // Get category names for the response
      const categoryNamesSQL = `
        SELECT Z_PK as id, ZNAME as name
        FROM ZRECIPECATEGORY
        WHERE Z_PK IN (${categoriesToRemove.map(() => '?').join(',')})
      `;
      
      const removedCategoryInfo = await this.allSQL(categoryNamesSQL, categoriesToRemove);

      // Remove category assignments
      const deleteSQL = `
        DELETE FROM Z_12CATEGORIES
        WHERE Z_12RECIPES = ? AND Z_13CATEGORIES IN (${categoriesToRemove.map(() => '?').join(',')})
      `;
      
      const result = await this.runSQL(deleteSQL, [recipeId, ...categoriesToRemove]);

      if (result.changes === 0) {
        throw new Error('Failed to remove categories - no rows affected');
      }

      // Get updated categories
      const updatedCategories = await this.getRecipeCategories(recipeId);

      this.log('INFO', `Removed ${categoriesToRemove.length} categories from recipe ${recipeId}`);
      
      return {
        success: true,
        recipeId: recipeId,
        recipeName: existingRecipe.ZNAME,
        categoriesRemoved: removedCategoryInfo,
        allCategories: updatedCategories,
        updatedAt: new Date().toISOString()
      };
    }, operationName);
  }

  async updateRecipeCategories(recipeId, newCategoryIds) {
    if (!this.config.enableWriteOperations) {
      throw new Error('Write operations are disabled. Enable write mode in configuration.');
    }

    // Validate inputs
    const recipeIdError = this.validator.validateRecipeId(recipeId);
    if (recipeIdError) {
      throw new Error(`Invalid recipe ID: ${recipeIdError.message}`);
    }

    const categoryError = this.validator.validateCategoryIds(newCategoryIds);
    if (categoryError) {
      throw new Error(`Invalid category IDs: ${categoryError.message}`);
    }

    const operationName = `update_recipe_categories_${recipeId}`;
    
    return await this.executeInTransaction(async () => {
      // Verify recipe exists
      const checkRecipeSQL = `
        SELECT Z_PK, ZNAME 
        FROM ZRECIPE 
        WHERE Z_PK = ? AND ZINTRASH = 0
      `;
      
      const existingRecipe = await this.getSQL(checkRecipeSQL, [recipeId]);
      if (!existingRecipe) {
        throw new Error(`Recipe with ID ${recipeId} not found or is deleted`);
      }

      // Get current categories
      const oldCategories = await this.getRecipeCategories(recipeId);

      // Verify all new category IDs exist
      if (newCategoryIds.length > 0) {
        const verifyCategoriesSQL = `
          SELECT Z_PK as id, ZNAME as name
          FROM ZRECIPECATEGORY
          WHERE Z_PK IN (${newCategoryIds.map(() => '?').join(',')})
        `;
        
        const verifiedCategories = await this.allSQL(verifyCategoriesSQL, newCategoryIds);
        if (verifiedCategories.length !== newCategoryIds.length) {
          const foundIds = verifiedCategories.map(c => c.id);
          const missingIds = newCategoryIds.filter(id => !foundIds.includes(id));
          throw new Error(`Category IDs not found: ${missingIds.join(', ')}`);
        }
      }

      // Remove all existing categories
      const deleteSQL = `DELETE FROM Z_12CATEGORIES WHERE Z_12RECIPES = ?`;
      await this.runSQL(deleteSQL, [recipeId]);

      // Add new categories
      if (newCategoryIds.length > 0) {
        const insertPromises = newCategoryIds.map(categoryId => {
          const insertSQL = `
            INSERT INTO Z_12CATEGORIES (Z_12RECIPES, Z_13CATEGORIES)
            VALUES (?, ?)
          `;
          return this.runSQL(insertSQL, [recipeId, categoryId]);
        });

        await Promise.all(insertPromises);
      }

      // Get updated categories
      const newCategories = await this.getRecipeCategories(recipeId);

      this.log('INFO', `Updated categories for recipe ${recipeId}: ${oldCategories.length} -> ${newCategories.length}`);
      
      return {
        success: true,
        recipeId: recipeId,
        recipeName: existingRecipe.ZNAME,
        oldCategories: oldCategories,
        newCategories: newCategories,
        updatedAt: new Date().toISOString()
      };
    }, operationName);
  }
}

module.exports = PaprikaDatabase;
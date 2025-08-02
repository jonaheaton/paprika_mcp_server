const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class PaprikaDatabase {
  constructor(dbPath, debugMode = false) {
    this.dbPath = dbPath;
    this.debugMode = debugMode;
    this.db = null;
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, sqlite3.OPEN_READONLY, (err) => {
        if (err) {
          this.log('ERROR', `Failed to connect to database: ${err.message}`);
          reject(err);
        } else {
          this.log('INFO', `Connected to Paprika database at ${this.dbPath}`);
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
}

module.exports = PaprikaDatabase;
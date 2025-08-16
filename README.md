# Paprika Recipe Manager - Claude Desktop Extension ✅ **WORKING**

A comprehensive MCP (Model Context Protocol) extension that provides intelligent access to your Paprika recipe database through natural language queries.

> **🎉 STATUS: Production Ready** - Successfully connecting to Claude Desktop with full functionality!

## Features

- 🔍 **Smart Recipe Search** - Search by name, ingredients, categories, ratings, and cooking times
- 📖 **Complete Recipe Access** - Get full recipe details including ingredients, directions, and nutrition
- 🗂️ **Category Management** - Browse hierarchical recipe categories with counts
- 📅 **Meal Planning** - Access your planned meals by date range
- 🥘 **Ingredient-Based Search** - "What can I make with..." functionality
- 🛒 **Grocery Lists** - Access shopping lists with recipe associations
- 🥫 **Pantry Management** - Check pantry inventory with expiration alerts
- 📸 **Recipe Photos** - Access recipe image metadata
- ⭐ **Favorites & Recent** - Quick access to favorite and recently added recipes

## Requirements

- **Node.js**: 16.0 or higher
- **Paprika App**: Export your database as `Paprika.sqlite`
- **Claude Desktop**: 0.10.0 or higher (for DXT support)

## Installation

> **📋 Quick Setup**: See [INSTALLATION.md](INSTALLATION.md) for detailed installation instructions and troubleshooting.

### **✅ Production Installation (Recommended)**

1. **Download**: Use the pre-built `paprika_mcp_server.dxt` file
2. **Install**: Drag and drop the DXT file into Claude Desktop Extensions
3. **Configure**: Point the database path to your `Paprika.sqlite` file
4. **Test**: Ask Claude "Search for chicken recipes" to verify connection

### **🔧 Development Installation**

1. Clone this repository
2. Install dependencies: `npm install`
3. Place your `Paprika.sqlite` file in the `data/` directory
4. Test locally: `npm start`
5. Package for Claude Desktop: `dxt pack .`

### **⚠️ Common Issues**

- **Node.js via nvm**: The extension handles nvm paths automatically
- **Connection errors**: Check database file path and permissions
- **Server crashes**: Ensure you're using the latest DXT package (includes fixes)

## Configuration

The extension supports several configuration options:

### Environment Variables

- `PAPRIKA_DB_PATH`: Path to your Paprika database file (default: `./data/Paprika.sqlite`)
- `PAPRIKA_DEBUG`: Enable debug logging (`true`/`false`, default: `false`)
- `PAPRIKA_MAX_RESULTS`: Maximum results per query (default: `50`, max: `500`)
- `PAPRIKA_MEAL_PLANNING`: Enable meal planning features (`true`/`false`, default: `true`)
- `PAPRIKA_GROCERY_FEATURES`: Enable grocery/pantry features (`true`/`false`, default: `true`)

### DXT Configuration

When installed as a DXT extension, configure through Claude Desktop's settings:

- **Database Path**: Point to your `Paprika.sqlite` file
- **Debug Mode**: Toggle detailed logging
- **Max Results**: Set query result limits
- **Feature Toggles**: Enable/disable meal planning and grocery features

## Available Tools

### Core Recipe Tools

#### `search_recipes`
Search recipes with flexible filtering options.

**Parameters:**
- `query` (string): Search in recipe names, ingredients, or directions
- `category` (string): Filter by category name
- `min_rating` (number): Minimum rating (0-5)
- `max_prep_time` (number): Maximum prep time in minutes
- `max_cook_time` (number): Maximum cook time in minutes
- `favorites_only` (boolean): Show only favorites
- `limit` (number): Max results (1-500, default: 50)
- `offset` (number): Skip results for pagination

**Example:**
```json
{
  "query": "chicken",
  "category": "Italian",
  "min_rating": 4,
  "max_prep_time": 30,
  "limit": 10
}
```

#### `get_recipe`
Get complete recipe details by ID.

**Parameters:**
- `recipe_id` (integer, required): Recipe ID from search results

#### `list_categories`
Get all recipe categories with counts.

**Parameters:** None

### Advanced Search Tools

#### `search_by_ingredients`
Find recipes containing specific ingredients.

**Parameters:**
- `ingredients` (array, required): List of ingredient names
- `exact_match` (boolean): Require all ingredients (default: false)
- `limit` (number): Max results (default: 50)

**Example:**
```json
{
  "ingredients": ["chicken", "garlic", "tomatoes"],
  "exact_match": false,
  "limit": 20
}
```

### Meal Planning Tools

#### `get_meal_plan`
Retrieve planned meals for date ranges.

**Parameters:**
- `start_date` (string, required): Start date (YYYY-MM-DD)
- `end_date` (string, required): End date (YYYY-MM-DD)

### Grocery & Pantry Tools

#### `get_grocery_lists`
Access grocery lists with items and recipes.

**Parameters:** None

#### `get_pantry_inventory`
Check pantry stock with expiration alerts.

**Parameters:** None

### Utility Tools

#### `get_recipe_photos`
Get photo metadata for recipes.

**Parameters:**
- `recipe_id` (integer, required): Recipe ID

#### `get_recent_recipes`
Get recently added/modified recipes.

**Parameters:**
- `days_back` (number): Days to look back (default: 30)
- `limit` (number): Max results (default: 20)

#### `get_favorites`
Get favorite recipes.

**Parameters:**
- `limit` (number): Max results (default: 50)

## Usage Examples

### Natural Language Queries

With this MCP extension, you can ask Claude natural questions about your recipes:

- *"Find me quick chicken recipes under 30 minutes"*
- *"What Italian desserts do I have?"*
- *"Show me recipes I can make with tomatoes and basil"*
- *"What's planned for dinner this week?"*
- *"Which pantry items are expiring soon?"*
- *"Find my highest-rated vegetarian recipes"*

### Direct Tool Usage

You can also call tools directly:

```javascript
// Search for quick breakfast recipes
await callTool('search_recipes', {
  query: 'breakfast',
  max_prep_time: 15,
  min_rating: 3
});

// Get ingredients for a specific recipe
await callTool('get_recipe', {
  recipe_id: 123
});

// Check what you can make with available ingredients
await callTool('search_by_ingredients', {
  ingredients: ['eggs', 'flour', 'milk']
});
```

## Database Structure

This extension works with Paprika's SQLite database format, supporting:

- **826+ Recipes** with full details
- **30+ Categories** with hierarchy
- **618+ Meal Plans** with dates
- **Grocery Lists** with recipe associations
- **Pantry Items** with expiration tracking
- **Recipe Photos** with metadata

## Troubleshooting

### Common Issues

1. **Database Not Found**
   - Ensure `Paprika.sqlite` is in the correct path
   - Check file permissions (read access required)
   - Verify the file isn't corrupted

2. **No Results Returned**
   - Check if recipes are marked as deleted (`ZINTRASH = 1`)
   - Verify search parameters are valid
   - Try broader search terms

3. **Connection Issues**
   - Ensure Node.js 16+ is installed
   - Check that all dependencies are installed (`npm install`)
   - Verify stdio transport is working

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
PAPRIKA_DEBUG=true npm start
```

Or set debug mode in the DXT configuration.

### Logs

The server logs important events:
- Database connection status
- Tool calls and parameters
- Error messages with context
- Performance information (when debug enabled)

## Development

### Project Structure

```
paprika-mcp-extension/
├── manifest.json          # DXT extension manifest
├── package.json           # Node.js dependencies
├── server/
│   ├── index.js          # Main MCP server
│   ├── database.js       # Database abstraction layer
│   ├── tools.js          # MCP tool definitions
│   └── utils.js          # Utility functions
├── data/
│   └── Paprika.sqlite    # Your recipe database
└── README.md
```

### Testing

Run basic functionality tests:

```bash
npm test
```

Test individual tools:

```bash
node -e "
const server = require('./server/index.js');
// Test server initialization
"
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Recent Updates

### ✅ **Fixed in Latest Version**
- **Claude Desktop Connection**: Resolved nvm Node.js path issues 
- **Server Stability**: Fixed log directory creation errors
- **Production Ready**: All 10 tools working reliably
- **Complete Documentation**: Installation guide and troubleshooting

### 🚀 **Coming Soon - Write Operations**
Phase 6B will add recipe editing capabilities:
- Update recipe ratings and favorites
- Modify recipe notes and categories  
- Full meal planning management
- Grocery list editing

## Security

This extension:
- Uses **read-only** database access to prevent data corruption (write operations coming in Phase 6B)
- Employs **parameterized queries** to prevent SQL injection
- Implements **input validation** for all parameters
- Provides **graceful error handling** without exposing sensitive data
- **Automatic backups** before any write operations (when write features are enabled)

## License

MIT License - see LICENSE file for details.

## Support

For issues, feature requests, or questions:
- GitHub Issues: [Create an issue](https://github.com/user/paprika-mcp-extension/issues)
- Documentation: [Extension docs](https://github.com/user/paprika-mcp-extension#readme)

---

**Note**: This extension requires the Paprika recipe management app and access to its SQLite database file. It is not affiliated with or endorsed by Paprika Recipe Manager.
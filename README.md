# Paprika MCP Server

A Model Context Protocol (MCP) desktop extension for connecting Claude to your custom SQL database. This server allows Claude to query and interact with your database in real-time during conversations.

## Overview

MCP desktop extensions enable you to create custom tools that Claude can use directly through the desktop app. This implementation provides a SQL database interface that allows Claude to execute queries, explore schema, and analyze your data.

## Project Setup

### 1. Initialize the Project

```bash
cd /Users/jonaheaton/Documents/paprika_mcp_server
npm init -y
```

### 2. Install Dependencies

```bash
npm install @modelcontextprotocol/sdk
npm install better-sqlite3  # For SQLite
# OR for other databases:
# npm install mysql2        # For MySQL
# npm install pg            # For PostgreSQL
```

### 3. Create the MCP Server

Create a file called `server.js`:

```javascript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import Database from 'better-sqlite3'; // or your preferred SQL driver

class SQLMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'paprika-sql-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize your database connection
    this.db = new Database('path/to/your/database.db'); // Update with your database path
    
    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'query_sql',
            description: 'Execute a SQL query on the database',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'SQL query to execute',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_tables',
            description: 'Get schema information for all tables',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'get_table_schema',
            description: 'Get detailed schema for a specific table',
            inputSchema: {
              type: 'object',
              properties: {
                table_name: {
                  type: 'string',
                  description: 'Name of the table to describe',
                },
              },
              required: ['table_name'],
            },
          },
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'query_sql':
            return await this.executeQuery(args.query);
          
          case 'describe_tables':
            return await this.describeTables();
          
          case 'get_table_schema':
            return await this.getTableSchema(args.table_name);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async executeQuery(query) {
    try {
      // Prevent destructive operations if needed
      const lowerQuery = query.toLowerCase().trim();
      if (lowerQuery.startsWith('drop') || lowerQuery.startsWith('delete') || lowerQuery.startsWith('truncate')) {
        throw new Error('Destructive operations are not allowed');
      }

      const result = this.db.prepare(query).all();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`SQL execution failed: ${error.message}`);
    }
  }

  async describeTables() {
    try {
      const tables = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all();
      
      return {
        content: [
          {
            type: 'text',
            text: `Available tables: ${tables.map(t => t.name).join(', ')}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to describe tables: ${error.message}`);
    }
  }

  async getTableSchema(tableName) {
    try {
      const schema = this.db.prepare(`PRAGMA table_info(${tableName})`).all();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Failed to get schema for ${tableName}: ${error.message}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }
}

const server = new SQLMCPServer();
server.run().catch(console.error);
```

### 4. Configure Package.json

Update your `package.json`:

```json
{
  "name": "paprika-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "main": "server.js",
  "bin": {
    "paprika-mcp-server": "./server.js"
  },
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.1.0",
    "better-sqlite3": "^8.7.0"
  }
}
```

## Installation

### 1. Install the Package Globally

```bash
npm install -g .
```

### 2. Configure Claude Desktop

Create or edit the Claude desktop configuration file:

**Location:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "paprika-database": {
      "command": "paprika-mcp-server",
      "args": []
    }
  }
}
```

### 3. Restart Claude Desktop

After making the configuration changes, restart the Claude Desktop application.

## Database-Specific Configurations

### SQLite (Default)
```javascript
import Database from 'better-sqlite3';
this.db = new Database('/path/to/your/database.db');
```

### PostgreSQL
```javascript
import pg from 'pg';
const { Pool } = pg;

this.db = new Pool({
  user: 'your_user',
  host: 'localhost',
  database: 'your_database',
  password: 'your_password',
  port: 5432,
});

// Update query execution method for async/await
async executeQuery(query) {
  const result = await this.db.query(query);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result.rows, null, 2),
      },
    ],
  };
}
```

### MySQL
```javascript
import mysql from 'mysql2/promise';

this.db = await mysql.createConnection({
  host: 'localhost',
  user: 'your_user',
  password: 'your_password',
  database: 'your_database'
});

// Update query execution method
async executeQuery(query) {
  const [rows] = await this.db.execute(query);
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(rows, null, 2),
      },
    ],
  };
}
```

## Usage Examples

Once configured, you can ask Claude to interact with your database:

- **"Show me all tables in the database"**
- **"Query the users table for recent entries"**
- **"What's the schema of the products table?"**
- **"Find all records where status is 'active'"**
- **"Get a count of records by category"**

## Security Considerations

### Query Restrictions
The server includes basic protection against destructive operations:
- `DROP` statements are blocked
- `DELETE` statements are blocked  
- `TRUNCATE` statements are blocked

### Additional Security Measures
- Consider implementing read-only database access
- Add input validation and sanitization
- Implement query result size limits
- Add authentication if needed
- Use environment variables for sensitive configuration

### Example Environment Configuration
```javascript
// Use environment variables for database connection
this.db = new Database(process.env.DATABASE_PATH || './default.db');
```

## Advanced Features

### 1. Query Result Formatting
Add methods to format results as tables or charts:

```javascript
formatAsTable(data) {
  // Convert JSON to formatted table
}

formatAsChart(data) {
  // Generate chart data
}
```

### 2. Query History and Caching
Implement query caching for performance:

```javascript
this.queryCache = new Map();

async executeQuery(query) {
  if (this.queryCache.has(query)) {
    return this.queryCache.get(query);
  }
  // Execute and cache result
}
```

### 3. Multiple Database Support
Extend to support multiple database connections:

```javascript
this.databases = {
  primary: new Database('./primary.db'),
  analytics: new Database('./analytics.db')
};
```

### 4. Custom Business Logic
Add domain-specific functions:

```javascript
{
  name: 'get_recipe_by_ingredient',
  description: 'Find recipes containing specific ingredients',
  // ... implementation
}
```

## Troubleshooting

### Common Issues

1. **Server not appearing in Claude**
   - Check that the configuration file path is correct
   - Verify the server is installed globally
   - Restart Claude Desktop

2. **Database connection errors**
   - Verify database file path is correct
   - Check database permissions
   - Ensure database driver is installed

3. **Query execution errors**
   - Verify SQL syntax
   - Check table and column names
   - Review error messages in Claude

### Debugging

Enable verbose logging by adding debug statements:

```javascript
console.error('Debug:', JSON.stringify(request, null, 2));
```

## Development

### Testing the Server
```bash
# Test the server directly
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}' | node server.js
```

### Making Changes
1. Edit `server.js`
2. Reinstall globally: `npm install -g .`
3. Restart Claude Desktop

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

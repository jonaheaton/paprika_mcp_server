#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const path = require('path');
const fs = require('fs');

const PaprikaDatabase = require('./database.js');
const { TOOLS, handleToolCall } = require('./tools.js');

class PaprikaRecipeServer {
  constructor() {
    this.database = null;
    this.config = this.loadConfiguration();
    
    this.server = new Server(
      {
        name: 'paprika-recipe-manager',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  loadConfiguration() {
    const config = {
      database_path: process.env.PAPRIKA_DB_PATH || path.join(__dirname, '../data/Paprika.sqlite'),
      debug_mode: process.env.PAPRIKA_DEBUG === 'true' || false,
      max_results: parseInt(process.env.PAPRIKA_MAX_RESULTS) || 50,
      enable_meal_planning: process.env.PAPRIKA_MEAL_PLANNING !== 'false',
      enable_grocery_features: process.env.PAPRIKA_GROCERY_FEATURES !== 'false',
    };

    if (config.debug_mode) {
      console.error(`[INFO] ${new Date().toISOString()}: Configuration loaded: ${JSON.stringify(config, null, 2)}`);
    }
    return config;
  }

  log(level, message) {
    if (this.config.debug_mode || level === 'ERROR' || level === 'INFO') {
      const timestamp = new Date().toISOString();
      console.error(`[${level}] ${timestamp}: ${message}`);
    }
  }

  async initializeDatabase() {
    try {
      if (!fs.existsSync(this.config.database_path)) {
        throw new Error(`Database file not found: ${this.config.database_path}`);
      }

      this.database = new PaprikaDatabase(this.config.database_path, this.config.debug_mode);
      await this.database.connect();
      this.log('INFO', 'Database initialized successfully');
    } catch (error) {
      this.log('ERROR', `Failed to initialize database: ${error.message}`);
      throw error;
    }
  }

  setupHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      this.log('DEBUG', 'Received list_tools request');
      
      let availableTools = [...TOOLS];

      // Filter tools based on configuration
      if (!this.config.enable_meal_planning) {
        availableTools = availableTools.filter(tool => tool.name !== 'get_meal_plan');
      }

      if (!this.config.enable_grocery_features) {
        availableTools = availableTools.filter(tool => 
          !['get_grocery_lists', 'get_pantry_inventory'].includes(tool.name)
        );
      }

      return {
        tools: availableTools.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      
      this.log('DEBUG', `Received tool call: ${name} with args: ${JSON.stringify(args)}`);

      try {
        if (!this.database) {
          throw new Error('Database not initialized. Please restart the server.');
        }

        // Apply global configuration to tool arguments
        if (args && typeof args === 'object') {
          if ('limit' in args && args.limit > this.config.max_results) {
            args.limit = this.config.max_results;
            this.log('DEBUG', `Limited results to configured maximum: ${this.config.max_results}`);
          }
        }

        // Check if tool is enabled based on configuration
        if (!this.config.enable_meal_planning && name === 'get_meal_plan') {
          throw new Error('Meal planning features are disabled in configuration');
        }

        if (!this.config.enable_grocery_features && 
            ['get_grocery_lists', 'get_pantry_inventory'].includes(name)) {
          throw new Error('Grocery and pantry features are disabled in configuration');
        }

        const result = await handleToolCall(name, args, this.database);
        
        this.log('DEBUG', `Tool call ${name} completed successfully`);
        return result;

      } catch (error) {
        this.log('ERROR', `Tool call ${name} failed: ${error.message}`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              error: `Tool execution failed: ${error.message}`,
              tool: name,
              timestamp: new Date().toISOString()
            }, null, 2)
          }],
          isError: true
        };
      }
    });
  }

  async start() {
    try {
      this.log('INFO', 'Starting Paprika Recipe MCP Server...');
      
      await this.initializeDatabase();
      
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      this.log('INFO', 'Server started successfully and connected via stdio transport');
      
      // Set up graceful shutdown
      const shutdown = async (signal) => {
        this.log('INFO', `Received ${signal}, shutting down gracefully...`);
        
        try {
          if (this.database) {
            await this.database.close();
            this.log('INFO', 'Database connection closed');
          }
          
          if (this.server) {
            await this.server.close();
            this.log('INFO', 'Server connection closed');
          }
          
          process.exit(0);
        } catch (error) {
          this.log('ERROR', `Error during shutdown: ${error.message}`);
          process.exit(1);
        }
      };

      process.on('SIGINT', () => shutdown('SIGINT'));
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      
      // Handle uncaught exceptions
      process.on('uncaughtException', (error) => {
        this.log('ERROR', `Uncaught exception: ${error.message}`);
        this.log('ERROR', error.stack);
        shutdown('uncaughtException');
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.log('ERROR', `Unhandled rejection at ${promise}: ${reason}`);
        shutdown('unhandledRejection');
      });

    } catch (error) {
      this.log('ERROR', `Failed to start server: ${error.message}`);
      process.exit(1);
    }
  }
}

// Start the server if this file is run directly
if (require.main === module) {
  const server = new PaprikaRecipeServer();
  server.start().catch((error) => {
    console.error('Fatal error starting server:', error);
    process.exit(1);
  });
}

module.exports = PaprikaRecipeServer;
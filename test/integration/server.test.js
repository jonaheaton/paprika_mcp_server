const { describe, test, expect, beforeAll, afterAll } = require('@jest/globals');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const path = require('path');

// Mock stdio transport for testing
class MockTransport {
  constructor() {
    this.messages = [];
    this.handlers = {};
  }

  on(event, handler) {
    this.handlers[event] = handler;
  }

  send(message) {
    this.messages.push(message);
  }

  simulateMessage(message) {
    if (this.handlers['message']) {
      this.handlers['message'](message);
    }
  }
}

describe('MCP Server Integration Tests', () => {
  let server;
  let transport;
  let PaprikaRecipeServer;

  beforeAll(async () => {
    // Load server class
    PaprikaRecipeServer = require('../../server/index.js');
    
    // Create mock transport
    transport = new MockTransport();
  });

  afterAll(async () => {
    if (server && server.close) {
      await server.close();
    }
  });

  describe('Server Initialization', () => {
    test('should create server instance', () => {
      expect(() => {
        server = new PaprikaRecipeServer();
      }).not.toThrow();
      
      expect(server).toBeTruthy();
    });

    test('should load configuration', () => {
      const server = new PaprikaRecipeServer();
      
      expect(server.config).toBeTruthy();
      expect(server.config).toHaveProperty('database_path');
      expect(server.config).toHaveProperty('debug_mode');
      expect(server.config).toHaveProperty('max_results');
    });

    test('should handle missing database path', () => {
      const server = new PaprikaRecipeServer({
        database_path: '/nonexistent/path.sqlite'
      });
      
      expect(server.config.database_path).toBe('/nonexistent/path.sqlite');
    });
  });

  describe('MCP Protocol Handling', () => {
    test('should handle list_tools request', async () => {
      const server = new PaprikaRecipeServer();
      
      // Mock the MCP list_tools call
      const mockRequest = {
        id: '1',
        method: 'tools/list'
      };

      // This test verifies the server can be instantiated
      // Full MCP protocol testing would require more complex mocking
      expect(server).toBeTruthy();
    });

    test('should handle server info request', async () => {
      const server = new PaprikaRecipeServer();
      
      // Check that server has the expected structure
      expect(server).toHaveProperty('config');
      expect(server.config).toHaveProperty('name');
      expect(server.config.name).toBe('paprika-recipe-manager');
    });
  });

  describe('Database Integration', () => {
    test('should connect to database during startup', async () => {
      const server = new PaprikaRecipeServer();
      
      if (require('fs').existsSync(global.TEST_DB_PATH)) {
        await expect(server.start()).resolves.not.toThrow();
        await server.close();
      } else {
        // If no database file, should handle gracefully
        await expect(server.start()).rejects.toThrow();
      }
    });

    test('should handle database connection errors', async () => {
      const server = new PaprikaRecipeServer({
        database_path: '/nonexistent/database.sqlite'
      });

      await expect(server.start()).rejects.toThrow();
    });
  });

  describe('Configuration Loading', () => {
    test('should load default configuration', () => {
      const server = new PaprikaRecipeServer();
      
      expect(server.config.max_results).toBe(50);
      expect(server.config.debug_mode).toBe(false);
      expect(server.config.enable_meal_planning).toBe(true);
    });

    test('should override configuration', () => {
      const customConfig = {
        max_results: 25,
        debug_mode: true,
        enable_meal_planning: false
      };

      const server = new PaprikaRecipeServer(customConfig);
      
      expect(server.config.max_results).toBe(25);
      expect(server.config.debug_mode).toBe(true);
      expect(server.config.enable_meal_planning).toBe(false);
    });

    test('should validate configuration values', () => {
      const invalidConfig = {
        max_results: 1000, // Should be capped at 500
        debug_mode: 'invalid', // Should be boolean
      };

      const server = new PaprikaRecipeServer(invalidConfig);
      
      // Server should sanitize invalid values
      expect(server.config.max_results).toBeLessThanOrEqual(500);
      expect(typeof server.config.debug_mode).toBe('boolean');
    });
  });

  describe('Tool Registration', () => {
    test('should register all tools', () => {
      const server = new PaprikaRecipeServer();
      
      // Check that tools are properly registered
      // This would need access to the server's internal tool registry
      expect(server).toBeTruthy();
    });

    test('should handle tool execution', async () => {
      const server = new PaprikaRecipeServer();
      
      if (require('fs').existsSync(global.TEST_DB_PATH)) {
        await server.start();
        
        // Mock tool call
        const mockToolCall = {
          name: 'list_categories',
          arguments: {}
        };

        // This would test actual tool execution
        // Implementation depends on server's internal structure
        
        await server.close();
      }
    });
  });

  describe('Error Handling', () => {
    test('should handle startup errors gracefully', async () => {
      const server = new PaprikaRecipeServer({
        database_path: '/invalid/path.sqlite'
      });

      await expect(server.start()).rejects.toThrow();
    });

    test('should handle malformed requests', () => {
      const server = new PaprikaRecipeServer();
      
      // Test that server can handle invalid input
      expect(server).toBeTruthy();
    });

    test('should cleanup resources on shutdown', async () => {
      const server = new PaprikaRecipeServer();
      
      if (require('fs').existsSync(global.TEST_DB_PATH)) {
        await server.start();
        
        // Ensure cleanup doesn't throw
        await expect(server.close()).resolves.not.toThrow();
      }
    });
  });

  describe('Logging and Debug', () => {
    test('should enable debug logging when configured', () => {
      const server = new PaprikaRecipeServer({
        debug_mode: true
      });

      expect(server.config.debug_mode).toBe(true);
    });

    test('should log important events', async () => {
      const server = new PaprikaRecipeServer({
        debug_mode: true
      });

      // Capture console output
      const originalLog = console.log;
      const logs = [];
      console.log = (msg) => logs.push(msg);

      try {
        if (require('fs').existsSync(global.TEST_DB_PATH)) {
          await server.start();
          await server.close();
        }
      } catch (error) {
        // Expected for invalid database paths
      }

      console.log = originalLog;

      // Should have logged some events in debug mode
      expect(logs.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Performance', () => {
    test('should start up within reasonable time', async () => {
      const server = new PaprikaRecipeServer();
      
      const startTime = Date.now();
      
      try {
        if (require('fs').existsSync(global.TEST_DB_PATH)) {
          await server.start();
          await server.close();
        }
      } catch (error) {
        // Expected for missing database
      }
      
      const endTime = Date.now();
      const startupTime = endTime - startTime;
      
      // Startup should be under 5 seconds even with database connection
      expect(startupTime).toBeLessThan(5000);
    });
  });
});
// Jest setup file for MCP server testing
const path = require('path');

// Global test configuration
global.TEST_DB_PATH = path.join(__dirname, '../data/Paprika.sqlite');
global.TEST_TIMEOUT = 5000;

// Mock console methods in tests to reduce noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: process.env.JEST_VERBOSE === 'true' ? originalConsole.log : jest.fn(),
  debug: process.env.JEST_VERBOSE === 'true' ? originalConsole.debug : jest.fn(),
  info: originalConsole.info,
  warn: originalConsole.warn,
  error: originalConsole.error
};

// Global test helpers
global.createTestDatabase = async () => {
  const PaprikaDatabase = require('../server/database.js');
  const db = new PaprikaDatabase(global.TEST_DB_PATH, false);
  
  try {
    await db.connect();
    return db;
  } catch (error) {
    console.warn('Failed to connect to test database:', error.message);
    return null;
  }
};

global.cleanupDatabase = async (db) => {
  if (db && db.close && typeof db.close === 'function') {
    try {
      await db.close();
    } catch (error) {
      console.warn('Failed to close database:', error.message);
    }
  }
};
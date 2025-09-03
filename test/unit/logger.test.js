const { describe, test, expect, beforeEach, afterEach } = require('@jest/globals');
const { Logger, createLogger } = require('../../server/logger.js');

describe('Logger Unit Tests', () => {
  let originalStderr;
  let stderrOutput;

  beforeEach(() => {
    // Capture stderr output
    originalStderr = process.stderr.write;
    stderrOutput = [];
    process.stderr.write = (chunk) => {
      stderrOutput.push(chunk);
      return true;
    };
  });

  afterEach(() => {
    // Restore stderr
    process.stderr.write = originalStderr;
    stderrOutput = [];
  });

  describe('Logger Creation', () => {
    test('should create logger with default config', () => {
      const logger = new Logger();
      
      expect(logger.config.level).toBe('info');
      expect(logger.config.prefix).toBe('paprika-mcp');
      expect(logger.config.timestamp).toBe(true);
      expect(logger.currentLevel).toBe(2); // info level
    });

    test('should create logger with custom config', () => {
      const logger = new Logger({
        level: 'debug',
        prefix: 'test-prefix',
        timestamp: false,
        colors: false
      });

      expect(logger.config.level).toBe('debug');
      expect(logger.config.prefix).toBe('test-prefix');
      expect(logger.config.timestamp).toBe(false);
      expect(logger.config.colors).toBe(false);
    });

    test('should create logger from factory function', () => {
      const logger = createLogger({ level: 'warn' });
      
      expect(logger).toBeInstanceOf(Logger);
      expect(logger.config.level).toBe('warn');
    });
  });

  describe('Log Levels', () => {
    test('should respect log levels', () => {
      const logger = new Logger({ level: 'warn' });

      logger.error('Error message');
      logger.warn('Warning message');
      logger.info('Info message'); // Should not appear
      logger.debug('Debug message'); // Should not appear

      expect(stderrOutput).toHaveLength(2);
      expect(stderrOutput[0]).toContain('Error message');
      expect(stderrOutput[1]).toContain('Warning message');
    });

    test('should change log level dynamically', () => {
      const logger = new Logger({ level: 'error' });

      logger.info('Should not appear');
      expect(stderrOutput).toHaveLength(0);

      logger.setLevel('info');
      logger.info('Should appear');
      expect(stderrOutput).toHaveLength(1);
    });

    test('should handle invalid log level', () => {
      const logger = new Logger({ level: 'info' });

      logger.setLevel('invalid');
      expect(stderrOutput[0]).toContain('Invalid log level');
    });
  });

  describe('Message Formatting', () => {
    test('should format human-readable messages', () => {
      const logger = new Logger({
        level: 'info',
        colors: false,
        timestamp: false
      });

      logger.info('Test message');

      expect(stderrOutput[0]).toBe('[INFO] [paprika-mcp] Test message\n');
    });

    test('should include timestamp when enabled', () => {
      const logger = new Logger({
        level: 'info',
        colors: false,
        timestamp: true
      });

      logger.info('Test message');

      expect(stderrOutput[0]).toMatch(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(stderrOutput[0]).toContain('[INFO]');
      expect(stderrOutput[0]).toContain('Test message');
    });

    test('should format structured JSON messages', () => {
      const logger = new Logger({
        level: 'info',
        structured: true,
        timestamp: false
      });

      logger.info('Test message', { key: 'value' });

      const parsed = JSON.parse(stderrOutput[0]);
      expect(parsed.level).toBe('info');
      expect(parsed.message).toBe('Test message');
      expect(parsed.key).toBe('value');
      expect(parsed.prefix).toBe('paprika-mcp');
    });

    test('should include context in messages', () => {
      const logger = new Logger({
        level: 'info',
        colors: false,
        timestamp: false
      });

      logger.info('Test message', { userId: 123, operation: 'search' });

      expect(stderrOutput[0]).toContain('Test message');
      expect(stderrOutput[0]).toContain('{"userId":123,"operation":"search"}');
    });
  });

  describe('Specialized Logging Methods', () => {
    let logger;

    beforeEach(() => {
      logger = new Logger({
        level: 'debug',
        colors: false,
        timestamp: false
      });
    });

    test('should log lifecycle events', () => {
      logger.lifecycle('startup', { version: '1.0.0' });

      expect(stderrOutput[0]).toContain('Server lifecycle: startup');
      expect(stderrOutput[0]).toContain('"event":"startup"');
      expect(stderrOutput[0]).toContain('"version":"1.0.0"');
    });

    test('should log database operations', () => {
      logger.database('query', { table: 'recipes', duration: 15 });

      expect(stderrOutput[0]).toContain('Database: query');
      expect(stderrOutput[0]).toContain('"operation":"query"');
      expect(stderrOutput[0]).toContain('"table":"recipes"');
    });

    test('should log tool executions', () => {
      logger.tool('search_recipes', { params: { name: 'chicken' } });

      expect(stderrOutput[0]).toContain('Tool executed: search_recipes');
      expect(stderrOutput[0]).toContain('"tool":"search_recipes"');
    });

    test('should log performance metrics', () => {
      logger.performance('query_time', 42.5, 'ms', { table: 'recipes' });

      expect(stderrOutput[0]).toContain('Performance: query_time = 42.5ms');
      expect(stderrOutput[0]).toContain('"metric":"query_time"');
      expect(stderrOutput[0]).toContain('"value":42.5');
    });

    test('should log exceptions with stack traces', () => {
      const error = new Error('Test error');
      logger.exception(error, { context: 'test' });

      expect(stderrOutput[0]).toContain('Test error');
      expect(stderrOutput[0]).toContain('"stack"');
      expect(stderrOutput[0]).toContain('"context":"test"');
    });
  });

  describe('Child Loggers', () => {
    test('should create child logger with additional context', () => {
      const parentLogger = new Logger({
        level: 'info',
        colors: false,
        timestamp: false
      });

      const childLogger = parentLogger.child({ requestId: 'abc123' });
      childLogger.info('Test message', { additional: 'data' });

      expect(stderrOutput[0]).toContain('Test message');
      expect(stderrOutput[0]).toContain('"requestId":"abc123"');
      expect(stderrOutput[0]).toContain('"additional":"data"');
    });
  });

  describe('Timer Functionality', () => {
    test('should measure execution time', (done) => {
      const logger = new Logger({
        level: 'debug',
        colors: false,
        timestamp: false
      });

      const timer = logger.timer('test_operation');

      setTimeout(() => {
        const duration = timer.end({ operation: 'test' });

        expect(duration).toBeGreaterThan(45); // At least 45ms
        expect(stderrOutput[0]).toContain('Performance: test_operation');
        expect(stderrOutput[0]).toContain('"operation":"test"');
        done();
      }, 50);
    });
  });

  describe('Configuration Changes', () => {
    test('should toggle colors', () => {
      const logger = new Logger({ level: 'info' });

      logger.setColors(false);
      expect(logger.config.colors).toBe(false);

      logger.setColors(true);
      expect(logger.config.colors).toBe(process.stderr.isTTY);
    });

    test('should toggle structured logging', () => {
      const logger = new Logger({ level: 'info' });

      logger.setStructured(true);
      expect(logger.config.structured).toBe(true);

      logger.setStructured(false);
      expect(logger.config.structured).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    test('should handle null and undefined messages', () => {
      const logger = new Logger({
        level: 'info',
        colors: false,
        timestamp: false
      });

      logger.info(null);
      logger.info(undefined);
      logger.info('');

      expect(stderrOutput).toHaveLength(3);
      expect(stderrOutput[0]).toContain('[INFO]');
      expect(stderrOutput[1]).toContain('[INFO]');
      expect(stderrOutput[2]).toContain('[INFO]');
    });

    test('should handle circular references in context', () => {
      const logger = new Logger({
        level: 'info',
        structured: true
      });

      const circular = { a: 1 };
      circular.self = circular;

      // Should not throw error
      expect(() => {
        logger.info('Test', circular);
      }).not.toThrow();
    });
  });
});
/**
 * Structured Logging System for Paprika MCP Server
 * 
 * Provides structured logging with different levels, timestamps, and contextual information.
 * Follows MCP debugging best practices with stderr output and structured formats.
 */

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || (config.debug_mode ? 'debug' : 'info'),
      prefix: config.prefix || 'paprika-mcp',
      timestamp: config.timestamp !== false,
      colors: config.colors !== false && process.stderr.isTTY,
      structured: config.structured || false,
      ...config
    };

    // Log levels (lower number = higher priority)
    this.levels = {
      error: 0,
      warn: 1, 
      info: 2,
      debug: 3,
      trace: 4
    };

    this.colors = {
      error: '\x1b[31m',   // Red
      warn: '\x1b[33m',    // Yellow
      info: '\x1b[36m',    // Cyan
      debug: '\x1b[35m',   // Magenta
      trace: '\x1b[90m',   // Bright Black
      reset: '\x1b[0m'
    };

    this.currentLevel = this.levels[this.config.level] || this.levels.info;
  }

  /**
   * Get current timestamp in ISO format
   */
  getTimestamp() {
    return new Date().toISOString();
  }

  /**
   * Format log message
   */
  formatMessage(level, message, context = {}) {
    const timestamp = this.config.timestamp ? this.getTimestamp() : null;
    const prefix = this.config.prefix;
    
    if (this.config.structured) {
      // Structured JSON logging
      return JSON.stringify({
        timestamp,
        level,
        prefix,
        message,
        ...context,
        pid: process.pid
      });
    } else {
      // Human-readable format
      let formatted = '';
      
      if (this.config.colors) {
        formatted += this.colors[level] || '';
      }
      
      if (timestamp) {
        formatted += `[${timestamp}] `;
      }
      
      formatted += `[${level.toUpperCase()}] `;
      
      if (prefix) {
        formatted += `[${prefix}] `;
      }
      
      formatted += message;
      
      // Add context if provided
      if (Object.keys(context).length > 0) {
        formatted += ` ${JSON.stringify(context)}`;
      }
      
      if (this.config.colors) {
        formatted += this.colors.reset;
      }
      
      return formatted;
    }
  }

  /**
   * Write log message to stderr
   */
  write(level, message, context = {}) {
    if (this.levels[level] <= this.currentLevel) {
      const formatted = this.formatMessage(level, message, context);
      process.stderr.write(formatted + '\n');
    }
  }

  /**
   * Log error messages
   */
  error(message, context = {}) {
    this.write('error', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message, context = {}) {
    this.write('warn', message, context);
  }

  /**
   * Log info messages
   */
  info(message, context = {}) {
    this.write('info', message, context);
  }

  /**
   * Log debug messages
   */
  debug(message, context = {}) {
    this.write('debug', message, context);
  }

  /**
   * Log trace messages
   */
  trace(message, context = {}) {
    this.write('trace', message, context);
  }

  /**
   * Log server lifecycle events
   */
  lifecycle(event, details = {}) {
    this.info(`Server lifecycle: ${event}`, {
      event,
      ...details
    });
  }

  /**
   * Log database operations
   */
  database(operation, details = {}) {
    this.debug(`Database: ${operation}`, {
      operation,
      ...details
    });
  }

  /**
   * Log tool executions
   */
  tool(toolName, details = {}) {
    this.debug(`Tool executed: ${toolName}`, {
      tool: toolName,
      ...details
    });
  }

  /**
   * Log performance metrics
   */
  performance(metric, value, unit = 'ms', context = {}) {
    this.debug(`Performance: ${metric} = ${value}${unit}`, {
      metric,
      value,
      unit,
      ...context
    });
  }

  /**
   * Log errors with stack traces
   */
  exception(error, context = {}) {
    this.error(error.message, {
      error: error.message,
      stack: error.stack,
      ...context
    });
  }

  /**
   * Create a child logger with additional context
   */
  child(context = {}) {
    const childLogger = new Logger(this.config);
    childLogger.defaultContext = { ...this.defaultContext, ...context };
    
    // Override write method to include default context
    const originalWrite = childLogger.write.bind(childLogger);
    childLogger.write = (level, message, additionalContext = {}) => {
      originalWrite(level, message, { ...childLogger.defaultContext, ...additionalContext });
    };
    
    return childLogger;
  }

  /**
   * Create a timer for performance logging
   */
  timer(name) {
    const startTime = process.hrtime.bigint();
    
    return {
      end: (context = {}) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds
        this.performance(name, Math.round(duration * 100) / 100, 'ms', context);
        return duration;
      }
    };
  }

  /**
   * Set log level
   */
  setLevel(level) {
    if (this.levels[level] !== undefined) {
      this.currentLevel = this.levels[level];
      this.config.level = level;
      this.debug(`Log level changed to: ${level}`);
    } else {
      this.warn(`Invalid log level: ${level}. Available levels: ${Object.keys(this.levels).join(', ')}`);
    }
  }

  /**
   * Enable/disable colors
   */
  setColors(enabled) {
    this.config.colors = enabled && process.stderr.isTTY;
    this.debug(`Colors ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable structured logging
   */
  setStructured(enabled) {
    this.config.structured = enabled;
    this.debug(`Structured logging ${enabled ? 'enabled' : 'disabled'}`);
  }
}

/**
 * Create default logger instance
 */
function createLogger(config = {}) {
  return new Logger(config);
}

/**
 * Export logger class and factory function
 */
module.exports = {
  Logger,
  createLogger
};
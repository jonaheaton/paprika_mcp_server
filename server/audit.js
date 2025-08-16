const fs = require('fs');
const path = require('path');

class AuditLogger {
  constructor(logDir = null, debugMode = false) {
    this.logDir = logDir || path.join(__dirname, '..', 'logs');
    this.debugMode = debugMode;
    this.currentLogFile = null;
    
    // Ensure log directory exists
    this.ensureLogDirectory();
    
    // Initialize current log file
    this.initializeLogFile();
  }

  log(level, message) {
    if (this.debugMode || level === 'ERROR' || level === 'WARN') {
      const timestamp = new Date().toISOString();
      console.error(`[AUDIT-${level}] ${timestamp}: ${message}`);
    }
  }

  ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
        this.log('INFO', `Created log directory: ${this.logDir}`);
      }
    } catch (error) {
      this.log('ERROR', `Failed to create log directory: ${error.message}`);
      throw error;
    }
  }

  initializeLogFile() {
    const today = new Date().toISOString().split('T')[0];
    const logFileName = `audit-${today}.jsonl`;
    this.currentLogFile = path.join(this.logDir, logFileName);
    
    // Create log file if it doesn't exist
    if (!fs.existsSync(this.currentLogFile)) {
      fs.writeFileSync(this.currentLogFile, '');
      this.log('INFO', `Initialized log file: ${this.currentLogFile}`);
    }
  }

  writeLogEntry(entry) {
    try {
      // Ensure we're using today's log file
      const today = new Date().toISOString().split('T')[0];
      const expectedLogFile = path.join(this.logDir, `audit-${today}.jsonl`);
      
      if (this.currentLogFile !== expectedLogFile) {
        this.currentLogFile = expectedLogFile;
        if (!fs.existsSync(this.currentLogFile)) {
          fs.writeFileSync(this.currentLogFile, '');
        }
      }

      // Write JSON line
      const logLine = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.currentLogFile, logLine);
      
    } catch (error) {
      this.log('ERROR', `Failed to write log entry: ${error.message}`);
      throw error;
    }
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  logOperation(operation, data = {}, userId = 'system', metadata = {}) {
    try {
      this.log('DEBUG', `Logging operation: ${operation}`);

      const entry = {
        id: this.generateOperationId(),
        timestamp: new Date().toISOString(),
        operation,
        userId,
        data: this.sanitizeData(data),
        metadata: {
          ...metadata,
          userAgent: process.env.USER_AGENT || 'paprika-mcp-server',
          version: process.env.npm_package_version || '1.0.0'
        },
        status: 'initiated'
      };

      this.writeLogEntry(entry);
      
      this.log('DEBUG', `Operation logged with ID: ${entry.id}`);
      return entry.id;

    } catch (error) {
      this.log('ERROR', `Failed to log operation: ${error.message}`);
      throw error;
    }
  }

  logOperationSuccess(operationId, result = {}, duration = null) {
    try {
      this.log('DEBUG', `Logging success for operation: ${operationId}`);

      const entry = {
        id: `${operationId}_success`,
        operationId,
        timestamp: new Date().toISOString(),
        status: 'success',
        result: this.sanitizeData(result),
        duration: duration ? `${duration}ms` : null
      };

      this.writeLogEntry(entry);
      
    } catch (error) {
      this.log('ERROR', `Failed to log operation success: ${error.message}`);
    }
  }

  logOperationFailure(operationId, error, context = {}) {
    try {
      this.log('DEBUG', `Logging failure for operation: ${operationId}`);

      const entry = {
        id: `${operationId}_failure`,
        operationId,
        timestamp: new Date().toISOString(),
        status: 'failure',
        error: {
          message: error.message || 'Unknown error',
          name: error.name || 'Error',
          stack: error.stack || null
        },
        context: this.sanitizeData(context)
      };

      this.writeLogEntry(entry);
      
    } catch (logError) {
      this.log('ERROR', `Failed to log operation failure: ${logError.message}`);
    }
  }

  logDatabaseChange(operation, table, recordId, changes = {}, userId = 'system') {
    try {
      this.log('DEBUG', `Logging database change: ${operation} on ${table}`);

      const operationId = this.logOperation('database_change', {
        table,
        recordId,
        changes: this.sanitizeData(changes),
        changeType: operation
      }, userId, {
        category: 'database',
        table,
        operation
      });

      return operationId;

    } catch (error) {
      this.log('ERROR', `Failed to log database change: ${error.message}`);
      throw error;
    }
  }

  sanitizeData(data) {
    try {
      // Remove sensitive information
      const sanitized = JSON.parse(JSON.stringify(data));
      
      // List of fields that should be sanitized
      const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
      
      const sanitizeObject = (obj) => {
        if (typeof obj !== 'object' || obj === null) {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.map(sanitizeObject);
        }

        const result = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          
          if (sensitiveFields.some(field => lowerKey.includes(field))) {
            result[key] = '[REDACTED]';
          } else if (typeof value === 'object') {
            result[key] = sanitizeObject(value);
          } else {
            result[key] = value;
          }
        }
        
        return result;
      };

      return sanitizeObject(sanitized);

    } catch (error) {
      this.log('WARN', `Failed to sanitize data: ${error.message}`);
      return { error: 'Failed to sanitize data' };
    }
  }

  async getAuditHistory(options = {}) {
    try {
      const {
        days = 7,
        operation = null,
        userId = null,
        status = null,
        limit = 1000
      } = options;

      this.log('DEBUG', `Retrieving audit history for ${days} days`);

      const entries = [];
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Read log files for the specified period
      for (let i = 0; i <= days; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        
        const dateStr = date.toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `audit-${dateStr}.jsonl`);

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              
              // Apply filters
              if (operation && entry.operation !== operation) continue;
              if (userId && entry.userId !== userId) continue;
              if (status && entry.status !== status) continue;

              entries.push(entry);
              
              // Apply limit
              if (entries.length >= limit) break;
              
            } catch (parseError) {
              this.log('WARN', `Failed to parse log entry: ${parseError.message}`);
            }
          }
        }

        if (entries.length >= limit) break;
      }

      // Sort by timestamp (newest first)
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      this.log('DEBUG', `Retrieved ${entries.length} audit entries`);
      return entries.slice(0, limit);

    } catch (error) {
      this.log('ERROR', `Failed to retrieve audit history: ${error.message}`);
      throw error;
    }
  }

  async getOperationStats(days = 30) {
    try {
      this.log('DEBUG', `Calculating operation stats for ${days} days`);

      const entries = await this.getAuditHistory({ days, limit: 10000 });
      
      const stats = {
        totalOperations: 0,
        successfulOperations: 0,
        failedOperations: 0,
        operationTypes: {},
        userActivity: {},
        dailyActivity: {},
        averageResponseTime: null,
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      };

      const responseTimes = [];

      for (const entry of entries) {
        if (entry.status === 'initiated') {
          stats.totalOperations++;
          
          // Count operation types
          if (entry.operation) {
            stats.operationTypes[entry.operation] = (stats.operationTypes[entry.operation] || 0) + 1;
          }
          
          // Count user activity
          if (entry.userId) {
            stats.userActivity[entry.userId] = (stats.userActivity[entry.userId] || 0) + 1;
          }
          
          // Count daily activity
          const date = entry.timestamp.split('T')[0];
          stats.dailyActivity[date] = (stats.dailyActivity[date] || 0) + 1;
          
        } else if (entry.status === 'success') {
          stats.successfulOperations++;
          
          // Calculate response times
          if (entry.duration) {
            const duration = parseInt(entry.duration.replace('ms', ''));
            if (!isNaN(duration)) {
              responseTimes.push(duration);
            }
          }
          
        } else if (entry.status === 'failure') {
          stats.failedOperations++;
        }
      }

      // Calculate average response time
      if (responseTimes.length > 0) {
        stats.averageResponseTime = Math.round(
          responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
        );
      }

      this.log('DEBUG', `Operation stats calculated: ${stats.totalOperations} total operations`);
      return stats;

    } catch (error) {
      this.log('ERROR', `Failed to calculate operation stats: ${error.message}`);
      throw error;
    }
  }

  async cleanupOldLogs(retentionDays = 90) {
    try {
      this.log('INFO', `Cleaning up audit logs older than ${retentionDays} days`);

      if (!fs.existsSync(this.logDir)) {
        return { deletedFiles: 0, retentionDays };
      }

      const files = fs.readdirSync(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedFiles = 0;

      for (const file of files) {
        if (file.startsWith('audit-') && file.endsWith('.jsonl')) {
          const dateMatch = file.match(/audit-(\d{4}-\d{2}-\d{2})\.jsonl/);
          
          if (dateMatch) {
            const fileDate = new Date(dateMatch[1]);
            
            if (fileDate < cutoffDate) {
              try {
                const filePath = path.join(this.logDir, file);
                fs.unlinkSync(filePath);
                this.log('DEBUG', `Deleted old log file: ${file}`);
                deletedFiles++;
              } catch (deleteError) {
                this.log('ERROR', `Failed to delete log file ${file}: ${deleteError.message}`);
              }
            }
          }
        }
      }

      this.log('INFO', `Log cleanup completed: ${deletedFiles} files deleted`);
      return { deletedFiles, retentionDays };

    } catch (error) {
      this.log('ERROR', `Failed to cleanup old logs: ${error.message}`);
      throw error;
    }
  }

  async exportAuditData(startDate, endDate, format = 'json') {
    try {
      this.log('INFO', `Exporting audit data from ${startDate} to ${endDate}`);

      const start = new Date(startDate);
      const end = new Date(endDate);
      const entries = [];

      // Collect entries from the date range
      const current = new Date(start);
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        const logFile = path.join(this.logDir, `audit-${dateStr}.jsonl`);

        if (fs.existsSync(logFile)) {
          const content = fs.readFileSync(logFile, 'utf8');
          const lines = content.trim().split('\n').filter(line => line.trim());

          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              const entryDate = new Date(entry.timestamp);
              
              if (entryDate >= start && entryDate <= end) {
                entries.push(entry);
              }
            } catch (parseError) {
              this.log('WARN', `Failed to parse log entry during export: ${parseError.message}`);
            }
          }
        }

        current.setDate(current.getDate() + 1);
      }

      // Sort entries by timestamp
      entries.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Format output
      let exportData;
      if (format === 'csv') {
        // Convert to CSV format
        const csvHeaders = ['timestamp', 'operation', 'userId', 'status', 'data'];
        const csvRows = entries.map(entry => [
          entry.timestamp,
          entry.operation || '',
          entry.userId || '',
          entry.status || '',
          JSON.stringify(entry.data || {})
        ]);
        
        exportData = [csvHeaders, ...csvRows]
          .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n');
      } else {
        // Default to JSON format
        exportData = JSON.stringify(entries, null, 2);
      }

      this.log('INFO', `Exported ${entries.length} audit entries`);
      return {
        data: exportData,
        format,
        entryCount: entries.length,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      };

    } catch (error) {
      this.log('ERROR', `Failed to export audit data: ${error.message}`);
      throw error;
    }
  }
}

module.exports = AuditLogger;
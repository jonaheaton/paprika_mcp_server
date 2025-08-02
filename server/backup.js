const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class DatabaseBackup {
  constructor(dbPath, backupDir = null, debugMode = false) {
    this.dbPath = dbPath;
    this.backupDir = backupDir || path.join(path.dirname(dbPath), 'backups');
    this.debugMode = debugMode;
    
    // Ensure backup directory exists
    this.ensureBackupDirectory();
  }

  log(level, message) {
    if (this.debugMode || level === 'ERROR' || level === 'INFO') {
      const timestamp = new Date().toISOString();
      console.error(`[BACKUP-${level}] ${timestamp}: ${message}`);
    }
  }

  ensureBackupDirectory() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
        this.log('INFO', `Created backup directory: ${this.backupDir}`);
      }
    } catch (error) {
      this.log('ERROR', `Failed to create backup directory: ${error.message}`);
      throw error;
    }
  }

  generateBackupPath(timestamp = null) {
    const now = timestamp || new Date();
    const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `Paprika-backup-${dateStr}.sqlite`;
    return path.join(this.backupDir, filename);
  }

  async calculateChecksum(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async createBackup(customPath = null) {
    const backupPath = customPath || this.generateBackupPath();
    
    try {
      this.log('INFO', `Creating backup: ${backupPath}`);
      
      // Check if source database exists and is readable
      if (!fs.existsSync(this.dbPath)) {
        throw new Error(`Source database not found: ${this.dbPath}`);
      }

      // Get source file stats
      const sourceStats = fs.statSync(this.dbPath);
      this.log('DEBUG', `Source database size: ${sourceStats.size} bytes`);

      // Copy the database file
      await new Promise((resolve, reject) => {
        const readStream = fs.createReadStream(this.dbPath);
        const writeStream = fs.createWriteStream(backupPath);
        
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('close', resolve);
        
        readStream.pipe(writeStream);
      });

      // Verify the backup
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        // Clean up invalid backup
        if (fs.existsSync(backupPath)) {
          fs.unlinkSync(backupPath);
        }
        throw new Error('Backup validation failed');
      }

      // Calculate and store checksum
      const checksum = await this.calculateChecksum(backupPath);
      const checksumPath = backupPath + '.checksum';
      fs.writeFileSync(checksumPath, checksum);

      this.log('INFO', `Backup created successfully: ${backupPath}`);
      this.log('DEBUG', `Backup checksum: ${checksum}`);

      return {
        backupPath,
        checksum,
        size: fs.statSync(backupPath).size,
        created: new Date().toISOString()
      };

    } catch (error) {
      this.log('ERROR', `Backup creation failed: ${error.message}`);
      
      // Clean up partial backup
      if (fs.existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath);
        } catch (cleanupError) {
          this.log('ERROR', `Failed to cleanup partial backup: ${cleanupError.message}`);
        }
      }
      
      throw error;
    }
  }

  async validateBackup(backupPath) {
    try {
      this.log('DEBUG', `Validating backup: ${backupPath}`);

      // Check if backup file exists
      if (!fs.existsSync(backupPath)) {
        this.log('ERROR', `Backup file not found: ${backupPath}`);
        return false;
      }

      // Check file size
      const backupStats = fs.statSync(backupPath);
      if (backupStats.size === 0) {
        this.log('ERROR', 'Backup file is empty');
        return false;
      }

      // Compare with source if it exists
      if (fs.existsSync(this.dbPath)) {
        const sourceStats = fs.statSync(this.dbPath);
        const sizeDifference = Math.abs(backupStats.size - sourceStats.size);
        const sizeThreshold = sourceStats.size * 0.01; // 1% threshold
        
        if (sizeDifference > sizeThreshold) {
          this.log('ERROR', `Backup size differs significantly from source (${sizeDifference} bytes)`);
          return false;
        }
      }

      // Verify checksum if available
      const checksumPath = backupPath + '.checksum';
      if (fs.existsSync(checksumPath)) {
        const expectedChecksum = fs.readFileSync(checksumPath, 'utf8').trim();
        const actualChecksum = await this.calculateChecksum(backupPath);
        
        if (expectedChecksum !== actualChecksum) {
          this.log('ERROR', `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`);
          return false;
        }
      }

      // Basic SQLite file validation (check header)
      const buffer = Buffer.alloc(16);
      const fd = fs.openSync(backupPath, 'r');
      fs.readSync(fd, buffer, 0, 16, 0);
      fs.closeSync(fd);
      
      const sqliteHeader = 'SQLite format 3\0';
      const actualHeader = buffer.toString('utf8', 0, 16);
      
      if (!actualHeader.startsWith('SQLite format 3')) {
        this.log('ERROR', `Invalid SQLite header: ${actualHeader}`);
        return false;
      }

      this.log('DEBUG', 'Backup validation successful');
      return true;

    } catch (error) {
      this.log('ERROR', `Backup validation error: ${error.message}`);
      return false;
    }
  }

  async restoreFromBackup(backupPath) {
    try {
      this.log('INFO', `Restoring database from backup: ${backupPath}`);

      // Validate backup before restore
      const isValid = await this.validateBackup(backupPath);
      if (!isValid) {
        throw new Error('Backup validation failed - cannot restore');
      }

      // Create a backup of current database before restore
      let currentBackupPath = null;
      if (fs.existsSync(this.dbPath)) {
        currentBackupPath = this.generateBackupPath(new Date()) + '.pre-restore';
        await this.createBackup(currentBackupPath);
        this.log('INFO', `Current database backed up to: ${currentBackupPath}`);
      }

      try {
        // Copy backup to database location
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(backupPath);
          const writeStream = fs.createWriteStream(this.dbPath);
          
          readStream.on('error', reject);
          writeStream.on('error', reject);
          writeStream.on('close', resolve);
          
          readStream.pipe(writeStream);
        });

        this.log('INFO', `Database restored successfully from: ${backupPath}`);
        
        return {
          restored: true,
          backupPath,
          currentBackupPath,
          restoredAt: new Date().toISOString()
        };

      } catch (restoreError) {
        // If restore failed and we have a current backup, try to restore it
        if (currentBackupPath && fs.existsSync(currentBackupPath)) {
          try {
            fs.copyFileSync(currentBackupPath, this.dbPath);
            this.log('INFO', 'Restored original database after failed restore');
          } catch (rollbackError) {
            this.log('ERROR', `Failed to rollback after restore failure: ${rollbackError.message}`);
          }
        }
        throw restoreError;
      }

    } catch (error) {
      this.log('ERROR', `Database restore failed: ${error.message}`);
      throw error;
    }
  }

  async listBackups() {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const files = fs.readdirSync(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.sqlite') && file.startsWith('Paprika-backup-')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          const checksumPath = filePath + '.checksum';
          
          const backup = {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            hasChecksum: fs.existsSync(checksumPath)
          };

          // Validate backup
          backup.isValid = await this.validateBackup(filePath);

          backups.push(backup);
        }
      }

      // Sort by creation date (newest first)
      backups.sort((a, b) => b.created - a.created);
      
      this.log('DEBUG', `Found ${backups.length} backups`);
      return backups;

    } catch (error) {
      this.log('ERROR', `Failed to list backups: ${error.message}`);
      return [];
    }
  }

  async cleanupOldBackups(retentionDays = 30) {
    try {
      this.log('INFO', `Cleaning up backups older than ${retentionDays} days`);

      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      let deletedCount = 0;

      for (const backup of backups) {
        if (backup.created < cutoffDate) {
          try {
            // Delete backup file
            fs.unlinkSync(backup.path);
            
            // Delete checksum file if it exists
            const checksumPath = backup.path + '.checksum';
            if (fs.existsSync(checksumPath)) {
              fs.unlinkSync(checksumPath);
            }

            this.log('DEBUG', `Deleted old backup: ${backup.filename}`);
            deletedCount++;

          } catch (deleteError) {
            this.log('ERROR', `Failed to delete backup ${backup.filename}: ${deleteError.message}`);
          }
        }
      }

      this.log('INFO', `Cleanup completed: ${deletedCount} backups deleted`);
      return { deletedCount, retentionDays };

    } catch (error) {
      this.log('ERROR', `Backup cleanup failed: ${error.message}`);
      throw error;
    }
  }

  async getBackupInfo() {
    const backups = await this.listBackups();
    const totalSize = backups.reduce((sum, backup) => sum + backup.size, 0);
    
    return {
      backupDirectory: this.backupDir,
      totalBackups: backups.length,
      totalSize,
      validBackups: backups.filter(b => b.isValid).length,
      newest: backups.length > 0 ? backups[0] : null,
      oldest: backups.length > 0 ? backups[backups.length - 1] : null
    };
  }
}

module.exports = DatabaseBackup;
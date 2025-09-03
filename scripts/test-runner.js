#!/usr/bin/env node

/**
 * Automated Test Runner for Paprika MCP Server
 * 
 * This script runs the complete test suite and generates reports.
 * It follows MCP debugging best practices and provides comprehensive testing.
 * 
 * Usage:
 *   node scripts/test-runner.js [options]
 * 
 * Options:
 *   --watch     Run tests in watch mode
 *   --coverage  Generate coverage report
 *   --verbose   Verbose output
 *   --ci        CI mode (non-interactive)
 *   --help      Show help
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../server/logger.js');

class TestRunner {
  constructor(options = {}) {
    this.options = {
      watch: false,
      coverage: false,
      verbose: false,
      ci: false,
      ...options
    };

    this.logger = createLogger({
      level: this.options.verbose ? 'debug' : 'info',
      prefix: 'test-runner',
      colors: !this.options.ci
    });

    this.results = {
      basic: null,
      unit: null,
      integration: null,
      coverage: null,
      inspector: null
    };

    this.startTime = Date.now();
  }

  /**
   * Run a command and capture output
   */
  async runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const timer = this.logger.timer(`${command} ${args.join(' ')}`);
      
      this.logger.debug(`Running: ${command} ${args.join(' ')}`);
      
      const proc = spawn(command, args, {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        env: {
          ...process.env,
          NODE_ENV: 'test',
          JEST_VERBOSE: this.options.verbose ? 'true' : 'false'
        },
        ...options
      });

      let stdout = '';
      let stderr = '';

      if (!this.options.verbose) {
        proc.stdout?.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on('data', (data) => {
          stderr += data.toString();
        });
      }

      proc.on('close', (code) => {
        const duration = timer.end();
        
        const result = {
          command: `${command} ${args.join(' ')}`,
          code,
          stdout,
          stderr,
          duration,
          success: code === 0
        };

        if (code === 0) {
          this.logger.info(`✅ ${command} completed successfully`, { duration });
          resolve(result);
        } else {
          this.logger.error(`❌ ${command} failed with code ${code}`, { duration });
          if (!this.options.verbose && stderr) {
            this.logger.error('Error output:', { stderr: stderr.trim() });
          }
          resolve(result); // Don't reject, let caller decide
        }
      });

      proc.on('error', (error) => {
        timer.end();
        this.logger.error(`Failed to start ${command}:`, { error: error.message });
        reject(error);
      });
    });
  }

  /**
   * Validate environment setup
   */
  async validateEnvironment() {
    this.logger.info('🔍 Validating test environment...');

    const checks = [
      { file: 'package.json', required: true },
      { file: 'server/index.js', required: true },
      { file: 'server/database.js', required: true },
      { file: 'server/tools.js', required: true },
      { file: 'server/logger.js', required: true },
      { file: 'data/Paprika.sqlite', required: false },
      { file: 'jest.config.js', required: true },
      { file: 'test/setup.js', required: true }
    ];

    let allValid = true;

    for (const check of checks) {
      const filePath = path.join(__dirname, '..', check.file);
      if (fs.existsSync(filePath)) {
        this.logger.debug(`✅ ${check.file}: Found`);
      } else if (check.required) {
        this.logger.error(`❌ ${check.file}: Missing (required)`);
        allValid = false;
      } else {
        this.logger.warn(`⚠️  ${check.file}: Missing (optional)`);
      }
    }

    // Check dependencies
    try {
      require.resolve('@modelcontextprotocol/sdk/server/index.js');
      this.logger.debug('✅ MCP SDK: Available');
    } catch (error) {
      this.logger.error('❌ MCP SDK: Missing - run npm install');
      allValid = false;
    }

    try {
      require.resolve('jest');
      this.logger.debug('✅ Jest: Available');
    } catch (error) {
      this.logger.error('❌ Jest: Missing - run npm install');
      allValid = false;
    }

    if (!allValid) {
      throw new Error('Environment validation failed');
    }

    this.logger.info('✅ Environment validation passed');
  }

  /**
   * Run basic functionality tests
   */
  async runBasicTests() {
    this.logger.info('🧪 Running basic functionality tests...');
    
    const result = await this.runCommand('node', ['test/basic-test.js']);
    this.results.basic = result;
    
    return result;
  }

  /**
   * Run unit tests
   */
  async runUnitTests() {
    this.logger.info('🧪 Running unit tests...');
    
    const args = ['--testPathPattern=unit'];
    if (this.options.watch) {
      args.push('--watch');
    }
    
    const result = await this.runCommand('npx', ['jest', ...args]);
    this.results.unit = result;
    
    return result;
  }

  /**
   * Run integration tests
   */
  async runIntegrationTests() {
    this.logger.info('🧪 Running integration tests...');
    
    const args = ['--testPathPattern=integration'];
    if (this.options.watch) {
      args.push('--watch');
    }
    
    const result = await this.runCommand('npx', ['jest', ...args]);
    this.results.integration = result;
    
    return result;
  }

  /**
   * Generate coverage report
   */
  async runCoverageTests() {
    if (!this.options.coverage) {
      return null;
    }

    this.logger.info('📊 Generating coverage report...');
    
    const result = await this.runCommand('npx', ['jest', '--coverage']);
    this.results.coverage = result;
    
    return result;
  }

  /**
   * Test MCP Inspector integration (non-interactive)
   */
  async testInspectorSetup() {
    if (this.options.ci) {
      this.logger.info('⏭️  Skipping Inspector test in CI mode');
      return null;
    }

    this.logger.info('🔍 Testing MCP Inspector setup...');
    
    const result = await this.runCommand('node', ['test/inspector-test.js'], {
      timeout: 10000 // 10 second timeout
    });
    this.results.inspector = result;
    
    return result;
  }

  /**
   * Generate test summary report
   */
  generateSummary() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;

    this.logger.info('📋 Test Summary Report');
    this.logger.info('======================');

    const tests = [
      { name: 'Basic Tests', result: this.results.basic },
      { name: 'Unit Tests', result: this.results.unit },
      { name: 'Integration Tests', result: this.results.integration },
      { name: 'Coverage Report', result: this.results.coverage },
      { name: 'Inspector Setup', result: this.results.inspector }
    ];

    let totalPassed = 0;
    let totalFailed = 0;

    tests.forEach(test => {
      if (test.result === null) {
        this.logger.info(`⏭️  ${test.name}: Skipped`);
      } else if (test.result.success) {
        this.logger.info(`✅ ${test.name}: Passed (${Math.round(test.result.duration)}ms)`);
        totalPassed++;
      } else {
        this.logger.error(`❌ ${test.name}: Failed (${Math.round(test.result.duration)}ms)`);
        totalFailed++;
      }
    });

    this.logger.info('');
    this.logger.info(`Total Duration: ${Math.round(totalDuration)}ms`);
    this.logger.info(`Passed: ${totalPassed}`);
    this.logger.info(`Failed: ${totalFailed}`);
    this.logger.info(`Success Rate: ${totalPassed > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0}%`);

    // Coverage summary if available
    if (this.results.coverage && this.results.coverage.success) {
      this.logger.info('');
      this.logger.info('📊 Coverage report generated in: coverage/');
      this.logger.info('   Open coverage/lcov-report/index.html to view');
    }

    return {
      totalPassed,
      totalFailed,
      totalDuration,
      success: totalFailed === 0
    };
  }

  /**
   * Run all tests
   */
  async runAll() {
    try {
      this.logger.lifecycle('test-start', { options: this.options });
      
      // Validate environment
      await this.validateEnvironment();

      // Run tests in sequence (parallel might cause issues with SQLite)
      await this.runBasicTests();
      
      if (!this.options.watch) {
        await this.runUnitTests();
        await this.runIntegrationTests();
        await this.runCoverageTests();
        await this.testInspectorSetup();
      } else {
        this.logger.info('🔄 Starting watch mode...');
        // In watch mode, run unit and integration tests in parallel
        await Promise.all([
          this.runUnitTests(),
          this.runIntegrationTests()
        ]);
      }

      const summary = this.generateSummary();
      this.logger.lifecycle('test-complete', summary);

      return summary;

    } catch (error) {
      this.logger.exception(error, { phase: 'test-runner' });
      this.logger.lifecycle('test-error', { error: error.message });
      throw error;
    }
  }
}

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    watch: args.includes('--watch'),
    coverage: args.includes('--coverage'),
    verbose: args.includes('--verbose'),
    ci: args.includes('--ci'),
    help: args.includes('--help')
  };

  if (options.help) {
    console.log(`
Paprika MCP Server Test Runner

Usage: node scripts/test-runner.js [options]

Options:
  --watch      Run tests in watch mode
  --coverage   Generate coverage report  
  --verbose    Verbose output
  --ci         CI mode (non-interactive)
  --help       Show this help

Examples:
  node scripts/test-runner.js                    # Run all tests
  node scripts/test-runner.js --coverage         # Run tests with coverage
  node scripts/test-runner.js --watch --verbose  # Watch mode with verbose output
  node scripts/test-runner.js --ci               # CI mode
    `);
    process.exit(0);
  }

  return options;
}

/**
 * Main execution
 */
async function main() {
  const options = parseArgs();
  const runner = new TestRunner(options);

  try {
    const summary = await runner.runAll();
    
    // Exit with appropriate code
    process.exit(summary.success ? 0 : 1);
    
  } catch (error) {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n🛑 Test runner interrupted');
    process.exit(130);
  });

  main();
}

module.exports = TestRunner;
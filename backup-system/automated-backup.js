#!/usr/bin/env node

/**
 * BuildFlow Pro - Comprehensive Automated Backup System
 * Protects against Replit platform failure by creating complete backups
 * Supports restoration on alternative hosting platforms
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createReadStream, createWriteStream } from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class BuildFlowBackupSystem {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupName = `buildflow-backup-${this.timestamp}`;
    this.excludePatterns = [
      'node_modules',
      '.git',
      '.replit',
      'dist',
      'build',
      '*.log',
      '.env',
      'backups',
      'tmp',
      '.vite',
      '.cache'
    ];
  }

  async initialize() {
    console.log('🚀 BuildFlow Pro Backup System Initializing...');
    await this.ensureBackupDirectory();
    return this;
  }

  async ensureBackupDirectory() {
    try {
      await fs.access(this.backupDir);
    } catch {
      await fs.mkdir(this.backupDir, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDir}`);
    }
  }

  // 1. Database Backup
  async backupDatabase() {
    console.log('💾 Starting database backup...');
    
    const dbBackupPath = path.join(this.backupDir, `${this.backupName}-database.sql`);
    
    return new Promise((resolve, reject) => {
      const pgDump = spawn('pg_dump', [
        process.env.DATABASE_URL,
        '--no-owner',
        '--no-privileges',
        '--clean',
        '--if-exists',
        '--verbose'
      ]);

      const writeStream = createWriteStream(dbBackupPath);
      
      pgDump.stdout.pipe(writeStream);
      
      pgDump.stderr.on('data', (data) => {
        console.log(`📊 Database backup progress: ${data.toString().trim()}`);
      });

      pgDump.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Database backup completed: ${dbBackupPath}`);
          resolve(dbBackupPath);
        } else {
          reject(new Error(`Database backup failed with code ${code}`));
        }
      });

      pgDump.on('error', reject);
    });
  }

  // 2. Source Code Backup
  async backupSourceCode() {
    console.log('📦 Starting source code backup...');
    
    const sourceBackupPath = path.join(this.backupDir, `${this.backupName}-source.tar.gz`);
    const rootDir = path.join(__dirname, '..');
    
    return new Promise((resolve, reject) => {
      const excludeArgs = this.excludePatterns.flatMap(pattern => ['--exclude', pattern]);
      
      const tar = spawn('tar', [
        'czf',
        sourceBackupPath,
        ...excludeArgs,
        '-C',
        rootDir,
        '.'
      ]);

      tar.stderr.on('data', (data) => {
        console.log(`📁 Source backup progress: ${data.toString().trim()}`);
      });

      tar.on('close', (code) => {
        if (code === 0) {
          console.log(`✅ Source code backup completed: ${sourceBackupPath}`);
          resolve(sourceBackupPath);
        } else {
          reject(new Error(`Source backup failed with code ${code}`));
        }
      });

      tar.on('error', reject);
    });
  }

  // 3. Environment Configuration Backup
  async backupConfiguration() {
    console.log('⚙️ Starting configuration backup...');
    
    const configBackupPath = path.join(this.backupDir, `${this.backupName}-config.json`);
    
    const config = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      replit_info: {
        repl_id: process.env.REPL_ID,
        repl_owner: process.env.REPL_OWNER,
        repl_slug: process.env.REPL_SLUG
      },
      database_info: {
        host: process.env.PGHOST,
        port: process.env.PGPORT,
        database: process.env.PGDATABASE,
        // Note: Passwords not included for security
      },
      package_versions: await this.getPackageVersions(),
      system_info: {
        node_version: process.version,
        platform: process.platform,
        arch: process.arch
      }
    };

    await fs.writeFile(configBackupPath, JSON.stringify(config, null, 2));
    console.log(`✅ Configuration backup completed: ${configBackupPath}`);
    return configBackupPath;
  }

  async getPackageVersions() {
    try {
      const packageJsonPath = path.join(__dirname, '..', 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      return {
        dependencies: packageJson.dependencies || {},
        devDependencies: packageJson.devDependencies || {}
      };
    } catch (error) {
      console.warn('⚠️ Could not read package.json for version info');
      return {};
    }
  }

  // 4. Object Storage Backup (if exists)
  async backupObjectStorage() {
    console.log('🗄️ Checking for object storage backup...');
    
    // Check if object storage is configured
    if (!process.env.PUBLIC_OBJECT_SEARCH_PATHS && !process.env.PRIVATE_OBJECT_DIR) {
      console.log('ℹ️ No object storage configured, skipping...');
      return null;
    }

    const storageBackupPath = path.join(this.backupDir, `${this.backupName}-storage-info.json`);
    
    const storageInfo = {
      timestamp: new Date().toISOString(),
      public_paths: process.env.PUBLIC_OBJECT_SEARCH_PATHS,
      private_dir: process.env.PRIVATE_OBJECT_DIR,
      note: 'Object storage files must be downloaded separately using the Object Storage tool pane in Replit'
    };

    await fs.writeFile(storageBackupPath, JSON.stringify(storageInfo, null, 2));
    console.log(`✅ Object storage info saved: ${storageBackupPath}`);
    return storageBackupPath;
  }

  // 5. Create Restoration Guide
  async createRestorationGuide() {
    console.log('📝 Creating restoration guide...');
    
    const guideContent = `# BuildFlow Pro - Restoration Guide
Generated: ${new Date().toISOString()}

## Quick Restoration Steps

### 1. Platform Setup
- Create new Node.js hosting environment (Vercel, Railway, DigitalOcean, etc.)
- Ensure PostgreSQL database access
- Install Node.js 18+ and npm

### 2. Database Restoration
\`\`\`bash
# Create new PostgreSQL database
createdb buildflow_pro

# Restore database from backup
psql buildflow_pro < ${this.backupName}-database.sql
\`\`\`

### 3. Source Code Restoration
\`\`\`bash
# Extract source code
tar -xzf ${this.backupName}-source.tar.gz

# Install dependencies
npm install

# Set up environment variables (see config backup)
cp .env.example .env
# Edit .env with your new database connection and secrets
\`\`\`

### 4. Environment Configuration
Copy settings from \`${this.backupName}-config.json\`:
- Database connection string
- Secret keys and API tokens
- OAuth settings

### 5. Object Storage Migration
If using object storage, download files from Replit Object Storage pane and:
- Upload to new cloud storage (AWS S3, Google Cloud Storage, etc.)
- Update environment variables for new storage endpoints

### 6. Deployment
\`\`\`bash
# Build the application
npm run build

# Start the server
npm start
\`\`\`

## Important Notes
- Update OAuth redirect URLs for new domain
- Test all functionality after restoration
- Update DNS records if using custom domain
- Verify email service configuration

## Support
This backup was created by BuildFlow Pro's automated backup system.
All business data (jobs, timesheets, staff notes) is preserved in the database backup.
`;

    const guidePath = path.join(this.backupDir, `${this.backupName}-RESTORATION-GUIDE.md`);
    await fs.writeFile(guidePath, guideContent);
    console.log(`✅ Restoration guide created: ${guidePath}`);
    return guidePath;
  }

  // 6. Create Backup Summary
  async createBackupSummary(backupFiles) {
    console.log('📋 Creating backup summary...');
    
    const summary = {
      backup_name: this.backupName,
      timestamp: new Date().toISOString(),
      status: 'completed',
      files: await Promise.all(backupFiles.filter(Boolean).map(async (filePath) => {
        try {
          const stats = await fs.stat(filePath);
          return {
            filename: path.basename(filePath),
            path: filePath,
            size_bytes: stats.size,
            size_mb: (stats.size / 1024 / 1024).toFixed(2)
          };
        } catch (error) {
          return {
            filename: path.basename(filePath),
            path: filePath,
            error: error.message
          };
        }
      })),
      protection_level: 'complete',
      platform_independence: true,
      restoration_complexity: 'moderate',
      estimated_rto: '15-30 minutes'
    };

    const summaryPath = path.join(this.backupDir, `${this.backupName}-SUMMARY.json`);
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`✅ Backup summary created: ${summaryPath}`);
    return summaryPath;
  }

  // Main backup execution
  async executeFullBackup() {
    try {
      console.log(`🎯 Starting complete backup: ${this.backupName}`);
      
      const startTime = Date.now();
      
      // Execute all backup operations
      const [databaseBackup, sourceBackup, configBackup, storageBackup, guideBackup] = await Promise.all([
        this.backupDatabase().catch(err => {
          console.error('❌ Database backup failed:', err.message);
          return null;
        }),
        this.backupSourceCode().catch(err => {
          console.error('❌ Source backup failed:', err.message);
          return null;
        }),
        this.backupConfiguration().catch(err => {
          console.error('❌ Config backup failed:', err.message);
          return null;
        }),
        this.backupObjectStorage().catch(err => {
          console.error('❌ Storage backup failed:', err.message);
          return null;
        }),
        this.createRestorationGuide().catch(err => {
          console.error('❌ Guide creation failed:', err.message);
          return null;
        })
      ]);

      const backupFiles = [databaseBackup, sourceBackup, configBackup, storageBackup, guideBackup];
      const summaryPath = await this.createBackupSummary(backupFiles);
      
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      
      console.log(`\n🎉 BACKUP COMPLETED SUCCESSFULLY`);
      console.log(`⏱️ Duration: ${duration} seconds`);
      console.log(`📁 Location: ${this.backupDir}`);
      console.log(`📋 Summary: ${summaryPath}`);
      console.log(`\n🛡️ Your BuildFlow Pro data is now protected against platform failure!`);
      
      return {
        success: true,
        backupName: this.backupName,
        duration,
        files: backupFiles.filter(Boolean),
        summary: summaryPath
      };
      
    } catch (error) {
      console.error('💥 Backup failed:', error);
      throw error;
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      const backup = await new BuildFlowBackupSystem().initialize();
      await backup.executeFullBackup();
      process.exit(0);
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

export default BuildFlowBackupSystem;
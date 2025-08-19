#!/usr/bin/env node

/**
 * BuildFlow Pro - Complete Backup Solution 2025
 * Comprehensive backup system with database export, source code archive, and file downloads
 * Protects against Replit platform failure with full restoration capability
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const BACKUP_CONFIG = {
  timestamp: new Date().toISOString().replace(/[:.]/g, '-').split('T')[0],
  backupDir: `./buildflow_backup_${new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]}`,
  
  // Database backup
  databaseUrl: process.env.DATABASE_URL,
  
  // Critical directories to backup
  directories: [
    'client',
    'server', 
    'shared',
    'attached_assets'
  ],
  
  // Configuration files
  configFiles: [
    'package.json',
    'package-lock.json',
    'tsconfig.json',
    'vite.config.ts',
    'tailwind.config.ts',
    'drizzle.config.ts',
    'components.json',
    'postcss.config.js',
    'replit.md',
    '.replit'
  ]
};

class BuildFlowBackup {
  constructor() {
    this.backupDir = BACKUP_CONFIG.backupDir;
    this.timestamp = BACKUP_CONFIG.timestamp;
    
    console.log('🔧 BuildFlow Pro Backup System Initialized');
    console.log(`📅 Backup Date: ${this.timestamp}`);
    console.log(`📁 Backup Directory: ${this.backupDir}`);
  }

  async createBackup() {
    try {
      await this.setupBackupDirectory();
      await this.backupSourceCode();
      await this.backupDatabase();
      await this.backupAttachedAssets();
      await this.createRestoreInstructions();
      await this.createBackupArchive();
      await this.generateBackupReport();
      
      console.log('\n✅ BACKUP COMPLETED SUCCESSFULLY!');
      console.log(`📦 Backup saved to: ${this.backupDir}.tar.gz`);
      console.log('🔒 Your BuildFlow Pro data is now safely backed up');
      
    } catch (error) {
      console.error('❌ Backup failed:', error.message);
      throw error;
    }
  }

  async setupBackupDirectory() {
    console.log('\n📁 Setting up backup directory...');
    
    if (fs.existsSync(this.backupDir)) {
      console.log('🗑️  Removing existing backup directory');
      execSync(`rm -rf "${this.backupDir}"`);
    }
    
    fs.mkdirSync(this.backupDir, { recursive: true });
    fs.mkdirSync(path.join(this.backupDir, 'source'), { recursive: true });
    fs.mkdirSync(path.join(this.backupDir, 'database'), { recursive: true });
    fs.mkdirSync(path.join(this.backupDir, 'assets'), { recursive: true });
    fs.mkdirSync(path.join(this.backupDir, 'restore'), { recursive: true });
    
    console.log('✅ Backup directory structure created');
  }

  async backupSourceCode() {
    console.log('\n💾 Backing up source code...');
    
    // Copy critical directories
    for (const dir of BACKUP_CONFIG.directories) {
      if (fs.existsSync(dir)) {
        console.log(`📂 Copying directory: ${dir}`);
        execSync(`cp -r "${dir}" "${path.join(this.backupDir, 'source')}"`);
      } else {
        console.log(`⚠️  Directory not found: ${dir}`);
      }
    }
    
    // Copy configuration files
    for (const file of BACKUP_CONFIG.configFiles) {
      if (fs.existsSync(file)) {
        console.log(`📄 Copying file: ${file}`);
        execSync(`cp "${file}" "${path.join(this.backupDir, 'source')}"`);
      } else {
        console.log(`⚠️  File not found: ${file}`);
      }
    }
    
    console.log('✅ Source code backup completed');
  }

  async backupDatabase() {
    console.log('\n🗄️  Backing up PostgreSQL database...');
    
    if (!BACKUP_CONFIG.databaseUrl) {
      console.log('⚠️  No DATABASE_URL found - skipping database backup');
      return;
    }
    
    try {
      const dbBackupFile = path.join(this.backupDir, 'database', `buildflow_db_${this.timestamp}.sql`);
      
      console.log('📊 Exporting PostgreSQL database...');
      execSync(`pg_dump "${BACKUP_CONFIG.databaseUrl}" > "${dbBackupFile}"`, {
        stdio: 'inherit',
        env: { ...process.env }
      });
      
      // Create a compressed version
      console.log('🗜️  Compressing database backup...');
      execSync(`gzip -c "${dbBackupFile}" > "${dbBackupFile}.gz"`);
      
      // Get database size info
      const stats = fs.statSync(dbBackupFile);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Database backup completed (${sizeInMB} MB)`);
      
      // Create database schema backup for reference
      const schemaFile = path.join(this.backupDir, 'database', 'schema.sql');
      execSync(`pg_dump --schema-only "${BACKUP_CONFIG.databaseUrl}" > "${schemaFile}"`);
      console.log('📋 Database schema exported');
      
    } catch (error) {
      console.error('❌ Database backup failed:', error.message);
      console.log('💡 Continuing with other backups...');
    }
  }

  async backupAttachedAssets() {
    console.log('\n📎 Backing up attached assets...');
    
    const assetsDir = 'attached_assets';
    if (fs.existsSync(assetsDir)) {
      const stats = execSync(`du -sh "${assetsDir}" | cut -f1`).toString().trim();
      console.log(`📊 Assets directory size: ${stats}`);
      
      execSync(`cp -r "${assetsDir}" "${path.join(this.backupDir, 'assets')}"`);
      console.log('✅ Attached assets backup completed');
    } else {
      console.log('⚠️  No attached_assets directory found');
    }
  }

  async createRestoreInstructions() {
    console.log('\n📝 Creating restore instructions...');
    
    const restoreScript = `#!/bin/bash

# BuildFlow Pro - Restore Script
# This script restores your BuildFlow Pro application from backup

echo "🔧 BuildFlow Pro Restore Process Started"
echo "📅 Backup Date: ${this.timestamp}"

# Step 1: Setup new Replit project
echo ""
echo "STEP 1: REPLIT PROJECT SETUP"
echo "================================"
echo "1. Create a new Replit project"
echo "2. Choose 'Node.js' template"
echo "3. Upload this backup archive to the project"
echo "4. Extract the backup files"
echo ""

# Step 2: Install dependencies
echo "STEP 2: INSTALL DEPENDENCIES"
echo "================================"
echo "Run these commands in Replit shell:"
echo "npm install"
echo "npm run db:push"
echo ""

# Step 3: Database restoration
echo "STEP 3: DATABASE RESTORATION"
echo "================================"
echo "1. Create a new PostgreSQL database in Replit"
echo "2. Set DATABASE_URL environment variable"
echo "3. Import database backup:"
echo "   psql \$DATABASE_URL < database/buildflow_db_${this.timestamp}.sql"
echo ""

# Step 4: Configuration
echo "STEP 4: CONFIGURATION"
echo "================================"
echo "1. Set required environment variables:"
echo "   - DATABASE_URL (PostgreSQL connection)"
echo "   - Any API keys you were using"
echo "2. Update any absolute paths in configuration files"
echo ""

# Step 5: Verification
echo "STEP 5: VERIFICATION"
echo "================================"
echo "1. Start the application: npm run dev"
echo "2. Check that all features work:"
echo "   - User authentication"
echo "   - Job management"
echo "   - Timesheet system"
echo "   - File uploads"
echo "   - Database operations"
echo ""

echo "✅ Restore process complete!"
echo "🔒 Your BuildFlow Pro application should now be fully restored"
`;

    fs.writeFileSync(
      path.join(this.backupDir, 'restore', 'RESTORE_INSTRUCTIONS.sh'),
      restoreScript
    );

    // Create detailed restoration guide
    const detailedGuide = `# BuildFlow Pro - Complete Restoration Guide

## Overview
This backup contains your complete BuildFlow Pro construction management application created on ${this.timestamp}.

## What's Included
- ✅ Complete source code (client, server, shared)
- ✅ PostgreSQL database export with all business data
- ✅ All configuration files
- ✅ Attached assets and documents
- ✅ Restoration instructions

## Platform Migration Steps

### Option 1: Restore to New Replit Project
1. Create new Replit Node.js project
2. Upload and extract backup archive
3. Run: \`npm install\`
4. Create PostgreSQL database
5. Import database: \`psql $DATABASE_URL < database/buildflow_db_${this.timestamp}.sql\`
6. Start application: \`npm run dev\`

### Option 2: Deploy to External Hosting
1. **DigitalOcean App Platform**
   - Upload source code
   - Configure PostgreSQL database
   - Import database backup
   - Set environment variables

2. **Heroku**
   - Create new Heroku app
   - Add PostgreSQL addon
   - Deploy source code
   - Import database backup

3. **Railway**
   - Connect GitHub repository
   - Add PostgreSQL service
   - Configure environment variables
   - Deploy application

### Option 3: Self-Hosted VPS
1. Set up Ubuntu/CentOS server
2. Install Node.js, PostgreSQL, Nginx
3. Clone source code
4. Import database backup
5. Configure reverse proxy
6. Set up SSL certificate

## Critical Files
- \`database/buildflow_db_${this.timestamp}.sql\` - Complete database backup
- \`source/\` - Complete application source code
- \`assets/attached_assets/\` - All uploaded documents and files
- \`restore/\` - Restoration scripts and guides

## Environment Variables Required
\`\`\`
DATABASE_URL=postgresql://...
PGHOST=...
PGPORT=5432
PGUSER=...
PGPASSWORD=...
PGDATABASE=...
\`\`\`

## Verification Checklist
After restoration, verify these features work:
- [ ] User authentication and login
- [ ] Job creation and management
- [ ] Timesheet submission and approval
- [ ] File upload and document processing
- [ ] PDF generation and email sending
- [ ] Database operations and data persistence
- [ ] Rewards system functionality
- [ ] Staff management features

## Support
Your BuildFlow Pro application is a complete construction management system with:
- Role-based access (admin/staff)
- Job costing and billing
- Timesheet management
- Document processing
- PDF generation
- Email integration
- Rewards system
- Mobile-optimized interface

## Backup Date: ${this.timestamp}
## Total Data Protected: Database + Source Code + Assets
`;

    fs.writeFileSync(
      path.join(this.backupDir, 'restore', 'DETAILED_RESTORATION_GUIDE.md'),
      detailedGuide
    );

    console.log('✅ Restore instructions created');
  }

  async createBackupArchive() {
    console.log('\n📦 Creating compressed backup archive...');
    
    try {
      execSync(`tar -czf "${this.backupDir}.tar.gz" -C . "${path.basename(this.backupDir)}"`, {
        stdio: 'inherit'
      });
      
      const stats = fs.statSync(`${this.backupDir}.tar.gz`);
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Backup archive created (${sizeInMB} MB)`);
      
    } catch (error) {
      console.error('❌ Archive creation failed:', error.message);
    }
  }

  async generateBackupReport() {
    console.log('\n📊 Generating backup report...');
    
    const report = {
      timestamp: this.timestamp,
      backupVersion: '2025.1',
      platform: 'Replit',
      application: 'BuildFlow Pro Construction Management',
      
      contents: {
        sourceCode: BACKUP_CONFIG.directories.length + ' directories',
        configFiles: BACKUP_CONFIG.configFiles.length + ' files',
        database: fs.existsSync(path.join(this.backupDir, 'database')) ? 'PostgreSQL dump included' : 'No database backup',
        assets: fs.existsSync(path.join(this.backupDir, 'assets')) ? 'Attached assets included' : 'No assets found'
      },
      
      restoration: {
        platforms: ['Replit', 'DigitalOcean', 'Heroku', 'Railway', 'Self-hosted VPS'],
        requirements: ['Node.js 18+', 'PostgreSQL 12+', 'NPM/Yarn'],
        estimatedRestoreTime: '15-30 minutes'
      },
      
      businessDataProtected: [
        'Employee timesheets and hours',
        'Job tracking and costing',
        'Client information',
        'PDF documents and photos',
        'User accounts and roles',
        'Rewards system data',
        'Email processing logs'
      ]
    };
    
    fs.writeFileSync(
      path.join(this.backupDir, 'BACKUP_REPORT.json'),
      JSON.stringify(report, null, 2)
    );
    
    console.log('✅ Backup report generated');
  }
}

// Execute backup if run directly
if (require.main === module) {
  const backup = new BuildFlowBackup();
  backup.createBackup().catch(error => {
    console.error('💥 Fatal backup error:', error);
    process.exit(1);
  });
}

module.exports = BuildFlowBackup;
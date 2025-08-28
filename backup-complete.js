#!/usr/bin/env node

/**
 * BuildFlow Pro Complete Backup Script
 * 
 * This script runs a complete backup including database,
 * codebase, and generates a restoration guide.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class CompleteBackup {
  constructor() {
    this.backupDir = './backups';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupSession = `buildflow-pro-complete-${this.timestamp}`;
  }

  async init() {
    console.log('🚀 Starting Complete BuildFlow Pro Backup');
    console.log('============================================');
    console.log(`📅 Backup Session: ${this.backupSession}`);
    console.log(`🕒 Started at: ${new Date().toLocaleString()}\n`);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async runDatabaseBackup() {
    console.log('1️⃣ Running Database Backup...');
    console.log('--------------------------------');
    
    try {
      await execAsync('node backup-database.js');
      console.log('✅ Database backup completed\n');
      return true;
    } catch (error) {
      console.error('❌ Database backup failed:', error.message);
      return false;
    }
  }

  async runCodebaseBackup() {
    console.log('2️⃣ Running Codebase Backup...');
    console.log('--------------------------------');
    
    try {
      await execAsync('node backup-codebase.js');
      console.log('✅ Codebase backup completed\n');
      return true;
    } catch (error) {
      console.error('❌ Codebase backup failed:', error.message);
      return false;
    }
  }

  async generateRestoreGuide() {
    console.log('3️⃣ Generating Restoration Guide...');
    console.log('------------------------------------');
    
    const guideContent = `# BuildFlow Pro Restoration Guide

## Backup Session: ${this.backupSession}
**Created:** ${new Date().toLocaleString()}

## Quick Restoration Steps

### 1. Database Restoration
\`\`\`bash
# Find your database backup file in the backups/ directory
# Look for: buildflow-pro-[timestamp].sql

# Restore database (replace with your actual backup file)
psql "$DATABASE_URL" < backups/buildflow-pro-[timestamp].sql
\`\`\`

### 2. Codebase Restoration
\`\`\`bash
# Extract codebase backup (replace with your actual backup file)
unzip backups/buildflow-pro-codebase-[timestamp].zip -d restored-project/

# Navigate to restored project
cd restored-project/

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env file with your actual values

# Push database schema (if needed)
npm run db:push

# Start the application
npm run dev
\`\`\`

### 3. Environment Variables Setup
Make sure to configure these essential variables in your .env file:

\`\`\`
DATABASE_URL=your_database_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
# ... other environment variables as needed
\`\`\`

## Full Recovery Checklist

- [ ] Extract codebase backup
- [ ] Install dependencies (\`npm install\`)
- [ ] Configure environment variables
- [ ] Restore database from backup
- [ ] Run database migrations (\`npm run db:push\`)
- [ ] Test application startup (\`npm run dev\`)
- [ ] Verify core functionality:
  - [ ] User authentication
  - [ ] Job management
  - [ ] Timesheet system
  - [ ] Document processing
  - [ ] Email functionality

## Backup Contents

This backup session includes:

1. **Database Backup**
   - Complete PostgreSQL database dump
   - All tables, data, and schema
   - Foreign key relationships preserved

2. **Codebase Backup**
   - All source code (client/, server/, shared/)
   - Configuration files
   - Package dependencies list
   - Project documentation

3. **Excluded from Backup**
   - node_modules/ (reinstall with \`npm install\`)
   - .env files (for security)
   - Build artifacts (dist/, .next/, etc.)
   - Cache directories

## Support and Troubleshooting

If you encounter issues during restoration:

1. **Database Connection Issues**
   - Verify DATABASE_URL is correct
   - Check database server is running
   - Confirm database exists

2. **Missing Dependencies**
   - Run \`npm install\` to reinstall packages
   - Check Node.js version compatibility

3. **Environment Variables**
   - Compare with .env.example
   - Ensure all required API keys are set

4. **Database Schema Issues**
   - Run \`npm run db:push\` to sync schema
   - Check for any migration errors

---

**Backup Created:** ${new Date().toISOString()}
**BuildFlow Pro Version:** Latest
**Node.js Version:** ${process.version}
`;

    const guidePath = path.join(this.backupDir, `restoration-guide-${this.timestamp}.md`);
    fs.writeFileSync(guidePath, guideContent);
    
    console.log(`✅ Restoration guide created: ${guidePath}\n`);
    return guidePath;
  }

  async generateBackupSummary(dbSuccess, codeSuccess, guidePath) {
    const summaryContent = {
      backupSession: this.backupSession,
      timestamp: new Date().toISOString(),
      success: dbSuccess && codeSuccess,
      components: {
        database: dbSuccess,
        codebase: codeSuccess,
        restorationGuide: !!guidePath
      },
      files: [],
      nodeVersion: process.version,
      platform: process.platform
    };

    // List backup files created
    try {
      const files = fs.readdirSync(this.backupDir);
      summaryContent.files = files.filter(file => 
        file.includes(this.timestamp) || file.includes('restoration-guide')
      );
    } catch (error) {
      // Ignore if can't read directory
    }

    const summaryPath = path.join(this.backupDir, `backup-summary-${this.timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summaryContent, null, 2));
    
    return summaryPath;
  }
}

// Main execution
async function main() {
  const backup = new CompleteBackup();
  
  try {
    await backup.init();
    
    // Run database backup
    const dbSuccess = await backup.runDatabaseBackup();
    
    // Run codebase backup  
    const codeSuccess = await backup.runCodebaseBackup();
    
    // Generate restoration guide
    const guidePath = await backup.generateRestoreGuide();
    
    // Generate backup summary
    const summaryPath = await backup.generateBackupSummary(dbSuccess, codeSuccess, guidePath);
    
    console.log('🎉 Complete Backup Process Finished!');
    console.log('=====================================');
    console.log(`✅ Database Backup: ${dbSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Codebase Backup: ${codeSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`✅ Restoration Guide: ${guidePath ? 'CREATED' : 'FAILED'}`);
    console.log(`✅ Backup Summary: ${summaryPath}`);
    
    if (dbSuccess && codeSuccess) {
      console.log('\n🏆 All backups completed successfully!');
      console.log(`📁 Check the backups/ directory for all files`);
      console.log(`📖 Read restoration-guide-${backup.timestamp}.md for recovery instructions`);
    } else {
      console.log('\n⚠️  Some backups failed. Check the logs above for details.');
    }
    
  } catch (error) {
    console.error('\n💥 Complete backup process failed:', error.message);
    process.exit(1);
  }
}

main();
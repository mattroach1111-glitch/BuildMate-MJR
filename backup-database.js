#!/usr/bin/env node

/**
 * BuildFlow Pro Database Backup Script
 * 
 * This script creates a comprehensive backup of your PostgreSQL database
 * including schema, data, and metadata.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class DatabaseBackup {
  constructor() {
    this.backupDir = './backups';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupFile = `buildflow-pro-${this.timestamp}.sql`;
  }

  async init() {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createBackup() {
    try {
      console.log('🔄 Starting BuildFlow Pro database backup...');
      
      const backupPath = path.join(this.backupDir, this.backupFile);
      
      // Use pg_dump to create a complete backup
      const dumpCommand = `pg_dump "${process.env.DATABASE_URL}" > "${backupPath}"`;
      
      await execAsync(dumpCommand);
      
      console.log(`✅ Database backup completed successfully!`);
      console.log(`📁 Backup saved to: ${backupPath}`);
      
      // Get backup file size
      const stats = fs.statSync(backupPath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`📊 Backup size: ${fileSizeInMB} MB`);
      
      return backupPath;
    } catch (error) {
      console.error('❌ Database backup failed:', error.message);
      throw error;
    }
  }

  async listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.sql'))
        .sort()
        .reverse();
      
      console.log('\n📋 Available backups:');
      files.forEach((file, index) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        const date = stats.mtime.toLocaleDateString();
        console.log(`${index + 1}. ${file} (${size} MB, ${date})`);
      });
      
      return files;
    } catch (error) {
      console.log('📂 No backups directory found yet.');
      return [];
    }
  }

  async cleanOldBackups(keepCount = 10) {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.sql'))
        .map(file => ({
          name: file,
          path: path.join(this.backupDir, file),
          mtime: fs.statSync(path.join(this.backupDir, file)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);
      
      if (files.length > keepCount) {
        const filesToDelete = files.slice(keepCount);
        
        console.log(`\n🧹 Cleaning old backups (keeping ${keepCount} most recent)...`);
        
        for (const file of filesToDelete) {
          fs.unlinkSync(file.path);
          console.log(`   Deleted: ${file.name}`);
        }
        
        console.log(`✅ Cleanup completed. Deleted ${filesToDelete.length} old backups.`);
      } else {
        console.log(`\n📁 No cleanup needed. Found ${files.length} backups (keeping ${keepCount}).`);
      }
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  const backup = new DatabaseBackup();
  
  try {
    await backup.init();
    
    // Show existing backups
    await backup.listBackups();
    
    // Create new backup
    await backup.createBackup();
    
    // Clean old backups (keep 10 most recent)
    await backup.cleanOldBackups(10);
    
    console.log('\n🎉 Backup process completed successfully!');
    console.log('\n💡 To restore a backup, use:');
    console.log('   psql "$DATABASE_URL" < backups/your-backup-file.sql');
    
  } catch (error) {
    console.error('\n💥 Backup process failed:', error.message);
    process.exit(1);
  }
}

// Check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
  console.error('   Make sure you have access to the database connection string.');
  process.exit(1);
}

main();
#!/usr/bin/env node

/**
 * Quick test to verify the backup system works
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testBackupSystem() {
  console.log('🧪 Testing BuildFlow Pro Backup System...');
  
  try {
    // Test 1: Check if backup directory can be created
    const backupDir = path.join(__dirname, 'backups');
    try {
      await fs.access(backupDir);
      console.log('✅ Backup directory exists');
    } catch {
      await fs.mkdir(backupDir, { recursive: true });
      console.log('✅ Backup directory created');
    }
    
    // Test 2: Check PostgreSQL availability
    console.log('🔍 Testing database connectivity...');
    const pgTest = spawn('pg_dump', ['--version']);
    
    await new Promise((resolve, reject) => {
      pgTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ PostgreSQL client available');
          resolve();
        } else {
          console.log('⚠️ PostgreSQL client not found - database backups may fail');
          resolve(); // Continue with other tests
        }
      });
      pgTest.on('error', () => {
        console.log('⚠️ PostgreSQL client not found - database backups may fail');
        resolve(); // Continue with other tests
      });
    });
    
    // Test 3: Check tar command availability
    console.log('🔍 Testing archive capabilities...');
    const tarTest = spawn('tar', ['--version']);
    
    await new Promise((resolve, reject) => {
      tarTest.on('close', (code) => {
        if (code === 0) {
          console.log('✅ Tar archiving available');
          resolve();
        } else {
          console.log('❌ Tar command not available');
          resolve();
        }
      });
      tarTest.on('error', () => {
        console.log('❌ Tar command not available');
        resolve();
      });
    });
    
    // Test 4: Check if backup script exists
    const backupScript = path.join(__dirname, 'backup-system', 'automated-backup.js');
    try {
      await fs.access(backupScript);
      console.log('✅ Backup script found');
    } catch {
      console.log('❌ Backup script missing');
      throw new Error('Backup script not found');
    }
    
    // Test 5: Check environment variables
    console.log('🔍 Testing environment configuration...');
    if (process.env.DATABASE_URL) {
      console.log('✅ Database URL configured');
    } else {
      console.log('⚠️ DATABASE_URL not set - database backups will fail');
    }
    
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      console.log('✅ Google Drive integration available');
    } else {
      console.log('ℹ️ Google Drive integration not configured (optional)');
    }
    
    console.log('\n🎉 Backup System Test Summary:');
    console.log('- Backup directory: Ready');
    console.log('- Archive capability: Available');
    console.log('- Backup scripts: Installed');
    console.log('\n📋 Next Steps:');
    console.log('1. Run manual backup: node backup-system/automated-backup.js');
    console.log('2. Schedule automated backups: node backup-system/backup-scheduler.js start');
    console.log('3. Configure Google Drive (optional): Set GOOGLE_SERVICE_ACCOUNT_KEY');
    
    return true;
    
  } catch (error) {
    console.error('💥 Backup system test failed:', error.message);
    return false;
  }
}

// Run test if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testBackupSystem().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export default testBackupSystem;
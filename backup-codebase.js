#!/usr/bin/env node

/**
 * BuildFlow Pro Codebase Backup Script
 * 
 * This script creates a comprehensive backup of your source code,
 * configuration files, and project structure.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { createWriteStream } from 'fs';
import archiver from 'archiver';

const execAsync = promisify(exec);

class CodebaseBackup {
  constructor() {
    this.backupDir = './backups';
    this.timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.backupFile = `buildflow-pro-codebase-${this.timestamp}.zip`;
    
    // Files and directories to include in backup
    this.includePatterns = [
      'client/',
      'server/',
      'shared/',
      'package.json',
      'package-lock.json',
      'vite.config.ts',
      'tsconfig.json',
      'tailwind.config.ts',
      'drizzle.config.ts',
      'postcss.config.js',
      '.env.example',
      'replit.md',
      'README.md'
    ];
    
    // Files and directories to exclude
    this.excludePatterns = [
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      '.cache',
      'coverage',
      '*.log',
      '.DS_Store',
      'Thumbs.db',
      '.env',
      '.env.local',
      '.env.production',
      'backups'
    ];
  }

  async init() {
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  async createCodebaseBackup() {
    return new Promise((resolve, reject) => {
      console.log('🔄 Starting BuildFlow Pro codebase backup...');
      
      const backupPath = path.join(this.backupDir, this.backupFile);
      const output = createWriteStream(backupPath);
      const archive = archiver('zip', {
        zlib: { level: 9 } // Maximum compression
      });

      output.on('close', () => {
        const fileSizeInMB = (archive.pointer() / (1024 * 1024)).toFixed(2);
        console.log(`✅ Codebase backup completed successfully!`);
        console.log(`📁 Backup saved to: ${backupPath}`);
        console.log(`📊 Archive size: ${fileSizeInMB} MB`);
        console.log(`📦 Total files archived: ${archive.pointer()} bytes`);
        resolve(backupPath);
      });

      output.on('error', (err) => {
        console.error('❌ Codebase backup failed:', err.message);
        reject(err);
      });

      archive.pipe(output);

      // Add files and directories
      for (const pattern of this.includePatterns) {
        if (fs.existsSync(pattern)) {
          const stats = fs.statSync(pattern);
          
          if (stats.isDirectory()) {
            // Add directory recursively, excluding certain patterns
            archive.directory(pattern, pattern, (entry) => {
              // Check if any exclude pattern matches the entry name
              const shouldExclude = this.excludePatterns.some(excludePattern => {
                const entryPath = entry.name || entry.prefix;
                return entryPath.includes(excludePattern);
              });
              
              if (shouldExclude) {
                console.log(`   Skipping: ${entry.name || entry.prefix}`);
                return false;
              }
              
              return entry;
            });
          } else {
            // Add individual file
            archive.file(pattern, { name: pattern });
          }
          
          console.log(`   Added: ${pattern}`);
        } else {
          console.log(`   Skipping (not found): ${pattern}`);
        }
      }

      // Add current package.json info
      if (fs.existsSync('package.json')) {
        const packageInfo = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const backupInfo = {
          timestamp: new Date().toISOString(),
          backupVersion: '1.0.0',
          projectName: packageInfo.name || 'BuildFlow Pro',
          projectVersion: packageInfo.version || '1.0.0',
          nodeVersion: process.version,
          dependencies: Object.keys(packageInfo.dependencies || {}),
          devDependencies: Object.keys(packageInfo.devDependencies || {})
        };
        
        archive.append(JSON.stringify(backupInfo, null, 2), { name: 'backup-info.json' });
      }

      archive.finalize();
    });
  }

  async createGitBundle() {
    try {
      console.log('📦 Creating Git bundle backup...');
      
      // Check if this is a git repository
      await execAsync('git status');
      
      const bundlePath = path.join(this.backupDir, `buildflow-pro-git-${this.timestamp}.bundle`);
      
      // Create git bundle with all branches
      await execAsync(`git bundle create "${bundlePath}" --all`);
      
      const stats = fs.statSync(bundlePath);
      const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      
      console.log(`✅ Git bundle created successfully!`);
      console.log(`📁 Bundle saved to: ${bundlePath}`);
      console.log(`📊 Bundle size: ${fileSizeInMB} MB`);
      
      return bundlePath;
    } catch (error) {
      console.log('⚠️  Git bundle creation skipped (not a git repository or no git available)');
      return null;
    }
  }

  async listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.includes('buildflow-pro-codebase') && file.endsWith('.zip'))
        .sort()
        .reverse();
      
      console.log('\n📋 Available codebase backups:');
      files.forEach((file, index) => {
        const filePath = path.join(this.backupDir, file);
        const stats = fs.statSync(filePath);
        const size = (stats.size / (1024 * 1024)).toFixed(2);
        const date = stats.mtime.toLocaleDateString();
        console.log(`${index + 1}. ${file} (${size} MB, ${date})`);
      });
      
      return files;
    } catch (error) {
      console.log('📂 No codebase backups found yet.');
      return [];
    }
  }
}

// Main execution
async function main() {
  const backup = new CodebaseBackup();
  
  try {
    await backup.init();
    
    // Show existing backups
    await backup.listBackups();
    
    // Create codebase backup
    await backup.createCodebaseBackup();
    
    // Create git bundle if available
    await backup.createGitBundle();
    
    console.log('\n🎉 Codebase backup process completed successfully!');
    console.log('\n💡 To restore from backup:');
    console.log('   1. Extract the .zip file to a new directory');
    console.log('   2. Run: npm install');
    console.log('   3. Configure environment variables');
    console.log('   4. Run: npm run db:push (for database schema)');
    
  } catch (error) {
    console.error('\n💥 Codebase backup process failed:', error.message);
    process.exit(1);
  }
}

main();
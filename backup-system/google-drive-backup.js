#!/usr/bin/env node

/**
 * BuildFlow Pro - Google Drive Backup Integration
 * Automatically uploads backups to Google Drive for cloud protection
 */

const fs = require('fs').promises;
const path = require('path');
const { google } = require('googleapis');

class GoogleDriveBackup {
  constructor() {
    this.backupDir = path.join(__dirname, '..', 'backups');
    this.drive = null;
    this.folderId = null;
  }

  async initialize() {
    console.log('☁️ Initializing Google Drive backup...');
    
    // Initialize Google Drive API
    const auth = new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    this.drive = google.drive({ version: 'v3', auth });
    
    // Create or find BuildFlow backup folder
    await this.ensureBackupFolder();
    
    return this;
  }

  async ensureBackupFolder() {
    try {
      // Search for existing BuildFlow backup folder
      const response = await this.drive.files.list({
        q: "name='BuildFlow Pro Backups' and mimeType='application/vnd.google-apps.folder'",
        fields: 'files(id, name)'
      });

      if (response.data.files.length > 0) {
        this.folderId = response.data.files[0].id;
        console.log(`📁 Found existing backup folder: ${this.folderId}`);
      } else {
        // Create new folder
        const folderResponse = await this.drive.files.create({
          requestBody: {
            name: 'BuildFlow Pro Backups',
            mimeType: 'application/vnd.google-apps.folder'
          }
        });
        
        this.folderId = folderResponse.data.id;
        console.log(`📁 Created new backup folder: ${this.folderId}`);
      }
    } catch (error) {
      console.error('❌ Failed to setup Google Drive folder:', error.message);
      throw error;
    }
  }

  async uploadFile(filePath, customName = null) {
    try {
      const fileName = customName || path.basename(filePath);
      const fileStats = await fs.stat(filePath);
      
      console.log(`⬆️ Uploading ${fileName} (${(fileStats.size / 1024 / 1024).toFixed(2)} MB)...`);
      
      const response = await this.drive.files.create({
        requestBody: {
          name: fileName,
          parents: [this.folderId]
        },
        media: {
          body: require('fs').createReadStream(filePath)
        }
      });

      console.log(`✅ Uploaded ${fileName} to Google Drive`);
      return response.data.id;
    } catch (error) {
      console.error(`❌ Failed to upload ${filePath}:`, error.message);
      throw error;
    }
  }

  async uploadBackupSet(backupName) {
    console.log(`☁️ Uploading backup set: ${backupName}`);
    
    const backupFiles = await fs.readdir(this.backupDir);
    const matchingFiles = backupFiles.filter(file => file.startsWith(backupName));
    
    const uploadPromises = matchingFiles.map(async (file) => {
      const filePath = path.join(this.backupDir, file);
      return await this.uploadFile(filePath);
    });

    const fileIds = await Promise.all(uploadPromises);
    
    console.log(`✅ Uploaded ${fileIds.length} files to Google Drive`);
    return fileIds;
  }

  async createBackupManifest(backupName, fileIds) {
    const manifest = {
      backup_name: backupName,
      timestamp: new Date().toISOString(),
      platform: 'Google Drive',
      files: fileIds.map((id, index) => ({
        id,
        name: `${backupName}-file-${index}`,
        download_url: `https://drive.google.com/file/d/${id}/view`
      })),
      restoration_note: 'Download all files and follow the restoration guide'
    };

    const manifestPath = path.join(this.backupDir, `${backupName}-GDRIVE-MANIFEST.json`);
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    
    // Upload manifest to Google Drive
    await this.uploadFile(manifestPath);
    
    console.log(`📋 Created and uploaded backup manifest`);
    return manifestPath;
  }

  async cleanupOldBackups(keepCount = 5) {
    try {
      console.log(`🧹 Cleaning up old backups (keeping ${keepCount} most recent)...`);
      
      const response = await this.drive.files.list({
        q: `parents='${this.folderId}'`,
        orderBy: 'createdTime desc',
        fields: 'files(id, name, createdTime)'
      });

      const files = response.data.files;
      
      // Group files by backup set
      const backupSets = {};
      files.forEach(file => {
        const match = file.name.match(/^buildflow-backup-(.+?)-/);
        if (match) {
          const backupId = match[1];
          if (!backupSets[backupId]) {
            backupSets[backupId] = [];
          }
          backupSets[backupId].push(file);
        }
      });

      // Keep only the most recent backup sets
      const backupIds = Object.keys(backupSets).sort().reverse();
      const setsToDelete = backupIds.slice(keepCount);

      for (const backupId of setsToDelete) {
        console.log(`🗑️ Deleting old backup set: ${backupId}`);
        
        for (const file of backupSets[backupId]) {
          await this.drive.files.delete({ fileId: file.id });
        }
      }

      console.log(`✅ Cleanup completed`);
    } catch (error) {
      console.warn('⚠️ Cleanup failed:', error.message);
    }
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        console.error('❌ Google Service Account key not configured');
        console.log('Set GOOGLE_SERVICE_ACCOUNT_KEY environment variable');
        process.exit(1);
      }

      const backupName = process.argv[2];
      if (!backupName) {
        console.error('❌ Backup name required');
        console.log('Usage: node google-drive-backup.js <backup-name>');
        process.exit(1);
      }

      const gdBackup = await new GoogleDriveBackup().initialize();
      const fileIds = await gdBackup.uploadBackupSet(backupName);
      await gdBackup.createBackupManifest(backupName, fileIds);
      await gdBackup.cleanupOldBackups();
      
      console.log('🎉 Google Drive backup completed successfully!');
      process.exit(0);
    } catch (error) {
      console.error('💥 Google Drive backup failed:', error);
      process.exit(1);
    }
  })();
}

module.exports = GoogleDriveBackup;
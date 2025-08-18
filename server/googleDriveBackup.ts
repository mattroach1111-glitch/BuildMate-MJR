import { google } from "googleapis";
import { readFile, createReadStream } from "fs/promises";
import { createReadStream as createFileStream } from "fs";
import path from "path";
import { backupService } from "./backupService";

export interface GoogleDriveConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  folderId?: string; // Optional backup folder ID
}

export class GoogleDriveBackupService {
  private drive: any;
  private backupFolderId: string | null = null;

  constructor(private config: GoogleDriveConfig) {
    this.initializeDrive();
  }

  private initializeDrive() {
    const oauth2Client = new google.auth.OAuth2(
      this.config.clientId,
      this.config.clientSecret,
      'urn:ietf:wg:oauth:2.0:oob'
    );

    oauth2Client.setCredentials({
      refresh_token: this.config.refreshToken
    });

    this.drive = google.drive({ version: 'v3', auth: oauth2Client });
  }

  async ensureBackupFolder(): Promise<string> {
    if (this.backupFolderId) {
      return this.backupFolderId;
    }

    try {
      // Check if folder already exists
      const response = await this.drive.files.list({
        q: "name='BuildFlow Pro Backups' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        spaces: 'drive',
      });

      if (response.data.files && response.data.files.length > 0) {
        this.backupFolderId = response.data.files[0].id;
        console.log("📁 Using existing backup folder:", this.backupFolderId);
      } else {
        // Create new folder
        const folderMetadata = {
          name: 'BuildFlow Pro Backups',
          mimeType: 'application/vnd.google-apps.folder',
        };

        const folder = await this.drive.files.create({
          resource: folderMetadata,
          fields: 'id',
        });

        this.backupFolderId = folder.data.id;
        console.log("📁 Created backup folder:", this.backupFolderId);
      }

      return this.backupFolderId;
    } catch (error) {
      console.error("❌ Failed to ensure backup folder:", error);
      throw error;
    }
  }

  async uploadBackupFile(filePath: string, fileName?: string): Promise<string> {
    try {
      const folderId = await this.ensureBackupFolder();
      
      const fileMetadata = {
        name: fileName || path.basename(filePath),
        parents: [folderId],
      };

      const media = {
        mimeType: 'application/json',
        body: createFileStream(filePath),
      };

      console.log(`☁️ Uploading ${fileMetadata.name} to Google Drive...`);

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,size,createdTime',
      });

      const file = response.data;
      console.log(`✅ Upload completed: ${file.name} (${file.size} bytes, ID: ${file.id})`);
      
      return file.id;
    } catch (error) {
      console.error("❌ Failed to upload backup file:", error);
      throw error;
    }
  }

  async createAndUploadBackup(): Promise<{fileId: string, backupData: any}> {
    console.log("🔄 Creating backup and uploading to Google Drive...");
    
    try {
      // Create local backup
      const backupData = await backupService.createFullBackup();
      
      // Upload to Google Drive
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `buildflow_backup_${timestamp}.json`;
      const filePath = path.join('./backups', fileName);
      
      const fileId = await this.uploadBackupFile(filePath, fileName);
      
      return { fileId, backupData };
    } catch (error) {
      console.error("❌ Failed to create and upload backup:", error);
      throw error;
    }
  }

  async listBackups(): Promise<any[]> {
    try {
      const folderId = await this.ensureBackupFolder();
      
      const response = await this.drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        fields: 'files(id,name,size,createdTime,modifiedTime)',
        orderBy: 'createdTime desc',
      });

      return response.data.files || [];
    } catch (error) {
      console.error("❌ Failed to list backups:", error);
      throw error;
    }
  }

  async downloadBackup(fileId: string, localPath: string): Promise<void> {
    try {
      console.log(`⬇️ Downloading backup file ${fileId}...`);
      
      const response = await this.drive.files.get({
        fileId: fileId,
        alt: 'media',
      });

      await readFile(localPath, response.data);
      
      console.log(`✅ Download completed: ${localPath}`);
    } catch (error) {
      console.error("❌ Failed to download backup:", error);
      throw error;
    }
  }

  async cleanupOldBackups(keepCount: number = 10): Promise<void> {
    try {
      const backups = await this.listBackups();
      
      if (backups.length <= keepCount) {
        console.log(`📊 Only ${backups.length} backups found, no cleanup needed`);
        return;
      }

      const toDelete = backups.slice(keepCount);
      console.log(`🗑️ Deleting ${toDelete.length} old backups...`);

      for (const backup of toDelete) {
        await this.drive.files.delete({ fileId: backup.id });
        console.log(`🗑️ Deleted: ${backup.name}`);
      }

      console.log("✅ Cleanup completed");
    } catch (error) {
      console.error("❌ Failed to cleanup old backups:", error);
      throw error;
    }
  }

  async scheduleGoogleDriveBackups() {
    console.log("📅 Setting up Google Drive backup schedule...");
    
    // Upload backup to Google Drive every 12 hours
    setInterval(async () => {
      try {
        await this.createAndUploadBackup();
        
        // Cleanup old backups (keep latest 10)
        await this.cleanupOldBackups(10);
      } catch (error) {
        console.error("❌ Scheduled Google Drive backup failed:", error);
      }
    }, 12 * 60 * 60 * 1000); // 12 hours

    console.log("✅ Google Drive backup schedule configured");
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await this.drive.files.list({
        pageSize: 1,
      });
      
      console.log("✅ Google Drive connection test successful");
      return true;
    } catch (error) {
      console.error("❌ Google Drive connection test failed:", error);
      return false;
    }
  }
}

// Helper function to create Google Drive backup service from user tokens
export async function createGoogleDriveBackupService(userTokens: any): Promise<GoogleDriveBackupService | null> {
  try {
    if (!userTokens || !userTokens.refresh_token) {
      console.log("📝 No Google Drive tokens available for backup");
      return null;
    }

    const config: GoogleDriveConfig = {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      refreshToken: userTokens.refresh_token,
    };

    const service = new GoogleDriveBackupService(config);
    
    // Test connection
    const isConnected = await service.testConnection();
    if (!isConnected) {
      console.error("❌ Failed to connect to Google Drive for backups");
      return null;
    }

    return service;
  } catch (error) {
    console.error("❌ Failed to create Google Drive backup service:", error);
    return null;
  }
}
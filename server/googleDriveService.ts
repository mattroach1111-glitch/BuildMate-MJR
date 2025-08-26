import { google } from 'googleapis';
import { Readable } from 'stream';
import { GoogleDriveAuth } from './googleAuth';

export class GoogleDriveService {
  private drive: any;
  private googleAuth: GoogleDriveAuth;
  private userId?: string;
  private onTokenRefresh?: (newTokens: any) => Promise<void>;

  constructor() {
    this.googleAuth = new GoogleDriveAuth();
  }

  // Set user tokens for authenticated requests
  setUserTokens(tokens: any, userId?: string, onTokenRefresh?: (newTokens: any) => Promise<void>) {
    this.googleAuth.setTokens(tokens);
    this.drive = this.googleAuth.getDriveClient();
    this.userId = userId;
    this.onTokenRefresh = onTokenRefresh;
  }

  // Check if service is ready to use
  isReady(): boolean {
    return this.googleAuth.isAuthenticated();
  }

  // Get auth URL for user authorization
  getAuthUrl(): string {
    return this.googleAuth.getAuthUrl();
  }

  // Exchange code for tokens
  async authorize(code: string) {
    return await this.googleAuth.getTokens(code);
  }

  // Execute an operation with automatic token refresh on auth errors
  private async executeWithTokenRefresh<T>(operation: () => Promise<T>): Promise<T | null> {
    try {
      return await operation();
    } catch (error: any) {
      // Check if it's an authentication error
      if (this.isAuthError(error)) {
        console.log('🔄 Google Drive token expired, attempting refresh...');
        
        try {
          // Attempt to refresh tokens
          const newTokens = await this.googleAuth.refreshTokens();
          console.log('✅ Google Drive tokens refreshed successfully');
          
          // Save new tokens to database if callback provided
          if (this.onTokenRefresh) {
            await this.onTokenRefresh(newTokens);
            console.log('💾 Updated tokens saved to database');
          }
          
          // Retry the original operation
          return await operation();
          
        } catch (refreshError) {
          console.error('❌ Failed to refresh Google Drive tokens:', refreshError);
          return null;
        }
      } else {
        console.error('❌ Google Drive operation failed:', error);
        return null;
      }
    }
  }

  // Check if error is related to authentication/authorization
  private isAuthError(error: any): boolean {
    const statusCode = error.response?.status || error.status || error.code;
    return statusCode === 401 || statusCode === 403 || 
           error.message?.includes('invalid_grant') ||
           error.message?.includes('unauthorized') ||
           error.message?.includes('invalid_token');
  }

  async uploadPDF(fileName: string, pdfBuffer: Buffer, folderId?: string): Promise<string | null> {
    const result = await this.uploadFile(fileName, pdfBuffer, 'application/pdf', folderId);
    return result?.webViewLink || null;
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, mimeType: string, folderId?: string): Promise<{ webViewLink: string; fileId: string } | null> {
    if (!this.isReady()) {
      console.error('Google Drive not authenticated. User needs to connect their Google Drive account.');
      return null;
    }

    return await this.executeWithTokenRefresh(async () => {
      // Create a readable stream from the buffer
      const stream = new Readable();
      stream.push(fileBuffer);
      stream.push(null);

      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      };

      const media = {
        mimeType: mimeType,
        body: stream,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink',
      });

      const fileId = response.data.id;
      console.log(`File uploaded to Google Drive: ${response.data.name} (ID: ${fileId})`);
      
      // Make the file publicly readable so others can view the job sheet PDFs and attachments
      await this.makeFilePublic(fileId);
      
      return {
        webViewLink: response.data.webViewLink,
        fileId: fileId
      };
    });
  }

  async makeFilePublic(fileId: string): Promise<boolean> {
    if (!this.isReady()) {
      return false;
    }

    try {
      await this.drive.permissions.create({
        fileId: fileId,
        resource: {
          role: 'reader',
          type: 'anyone',
        },
      });
      console.log(`File ${fileId} made publicly readable`);
      return true;
    } catch (error) {
      console.error('Error making file public:', error);
      return false;
    }
  }

  async createFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.isReady()) {
      console.error('Google Drive not authenticated. User needs to connect their Google Drive account.');
      return null;
    }

    return await this.executeWithTokenRefresh(async () => {
      const fileMetadata = {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
        parents: parentFolderId ? [parentFolderId] : undefined,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        fields: 'id,name',
      });

      const folderId = response.data.id;
      console.log(`Folder created: ${response.data.name} (ID: ${folderId})`);
      
      // Make the folder publicly readable so others can access job documents
      await this.makeFilePublic(folderId);
      
      return folderId;
    });
  }

  async findOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.isReady()) {
      return null;
    }

    try {
      // Search for existing folder
      const query = parentFolderId 
        ? `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`
        : `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        return response.data.files[0].id;
      }

      // Folder doesn't exist, create it
      return await this.createFolder(folderName, parentFolderId);
    } catch (error) {
      console.error('Error finding/creating folder:', error);
      return null;
    }
  }

  // Upload file attachment to Google Drive in job folder
  async uploadJobAttachment(fileName: string, fileBuffer: Buffer, mimeType: string, jobAddress: string): Promise<{ webViewLink: string; fileId: string } | null> {
    if (!this.isReady()) {
      console.error('Google Drive not authenticated for job attachment upload');
      return null;
    }

    try {
      // Create the folder structure: BuildFlow Pro -> Job - [Address] -> Attachments
      const mainFolderId = await this.findOrCreateFolder('BuildFlow Pro');
      if (!mainFolderId) {
        console.error('Failed to create main BuildFlow Pro folder');
        return null;
      }

      const jobFolderId = await this.findOrCreateFolder(`Job - ${jobAddress}`, mainFolderId);
      if (!jobFolderId) {
        console.error('Failed to create job folder');
        return null;
      }

      const attachmentsFolderId = await this.findOrCreateFolder('Attachments', jobFolderId);
      if (!attachmentsFolderId) {
        console.error('Failed to create attachments folder');
        return null;
      }

      // Upload file to the attachments folder
      const result = await this.uploadFile(fileName, fileBuffer, mimeType, attachmentsFolderId);
      
      if (result) {
        console.log(`✅ Job attachment uploaded to Google Drive: ${fileName} (${jobAddress})`);
      }

      return result;
    } catch (error) {
      console.error('Error uploading job attachment to Google Drive:', error);
      return null;
    }
  }
}
import { google } from 'googleapis';
import { Readable } from 'stream';
import { GoogleDriveAuth } from './googleAuth';

export class GoogleDriveService {
  private drive: any;
  private googleAuth: GoogleDriveAuth;

  constructor() {
    this.googleAuth = new GoogleDriveAuth();
  }

  // Set user tokens for authenticated requests
  async setUserTokens(tokens: any) {
    try {
      this.googleAuth.setTokens(tokens);
      this.drive = this.googleAuth.getDriveClient();
      
      // Check if tokens are expired and refresh if needed
      const credentials = this.googleAuth.isAuthenticated();
      if (!credentials && tokens.refresh_token) {
        console.log('🔄 Access token expired, attempting refresh...');
        try {
          const refreshedTokens = await this.googleAuth.refreshTokens();
          console.log('✅ Tokens refreshed successfully');
          return refreshedTokens;
        } catch (refreshError) {
          console.error('❌ Failed to refresh tokens:', refreshError);
          throw new Error('Google Drive authentication expired. Please reconnect your Google Drive account.');
        }
      }
      return tokens;
    } catch (error) {
      console.error('❌ Error setting Google Drive tokens:', error);
      throw error;
    }
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

  async uploadPDF(fileName: string, pdfBuffer: Buffer, folderId?: string): Promise<string | null> {
    const result = await this.uploadFile(fileName, pdfBuffer, 'application/pdf', folderId);
    return result?.webViewLink || null;
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, mimeType: string, folderId?: string): Promise<{ webViewLink: string; fileId: string } | null> {
    if (!this.isReady()) {
      console.error('Google Drive not authenticated. User needs to connect their Google Drive account.');
      throw new Error('Google Drive not connected. Please connect your Google Drive account first.');
    }

    try {
      console.log(`📤 Uploading file to Google Drive: ${fileName} (${mimeType})`);
      
      // Verify authentication before upload
      if (!this.isReady()) {
        throw new Error('Google Drive not authenticated. Please reconnect your Google Drive account.');
      }
      
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

      console.log(`📁 Uploading to folder: ${folderId || 'root'}`);
      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink',
      });

      const fileId = response.data.id;
      console.log(`✅ File uploaded to Google Drive: ${response.data.name} (ID: ${fileId})`);
      
      // Make the file publicly readable so others can view the job sheet PDFs and attachments
      try {
        await this.makeFilePublic(fileId);
        console.log(`✅ File ${fileName} made publicly accessible`);
      } catch (permError) {
        console.warn(`⚠️ Could not make file ${fileName} public (but upload successful):`, permError);
        // Don't fail the whole operation if we can't make it public
      }
      
      return {
        webViewLink: response.data.webViewLink,
        fileId: fileId
      };
    } catch (error: any) {
      console.error('❌ Error uploading to Google Drive:', error);
      
      // Check if it's an authentication error
      if (error.code === 401 || error.status === 401) {
        throw new Error('Google Drive authentication expired. Please reconnect your Google Drive account.');
      }
      
      // Check if it's a permission error
      if (error.code === 403 || error.status === 403) {
        throw new Error('Google Drive permission denied. Please check your Google Drive connection.');
      }
      
      // Check for quota errors
      if (error.code === 429 || error.status === 429) {
        throw new Error('Google Drive upload quota exceeded. Please try again later.');
      }
      
      throw new Error(`Google Drive upload failed: ${error.message}`);
    }
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

    try {
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
      try {
        await this.makeFilePublic(folderId);
        console.log(`✅ Folder ${folderName} made publicly accessible`);
      } catch (permError) {
        console.warn(`⚠️ Could not make folder ${folderName} public (but folder created successfully):`, permError);
        // Don't fail the whole operation if we can't make it public
      }
      
      return folderId;
    } catch (error: any) {
      console.error('Error creating folder in Google Drive:', error);
      
      // Check if it's an authentication error
      if (error.code === 401 || error.status === 401) {
        throw new Error('Google Drive authentication expired. Please reconnect your Google Drive account.');
      }
      
      // Check if it's a permission error
      if (error.code === 403 || error.status === 403) {
        throw new Error('Google Drive permission denied. Please check your Google Drive connection.');
      }
      
      return null;
    }
  }

  async findOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.isReady()) {
      console.error('Google Drive not authenticated for folder operations');
      throw new Error('Google Drive not connected. Please connect your Google Drive account first.');
    }

    try {
      console.log(`🗂️ Finding or creating folder: ${folderName} ${parentFolderId ? `in parent ${parentFolderId}` : ''}`);
      
      // Search for existing folder - escape single quotes in folder names
      const escapedFolderName = folderName.replace(/'/g, "\\'");
      const query = parentFolderId 
        ? `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed=false`
        : `name='${escapedFolderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;

      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id, name)',
      });

      if (response.data.files && response.data.files.length > 0) {
        const foundFolder = response.data.files[0];
        console.log(`✅ Found existing folder: ${foundFolder.name} (ID: ${foundFolder.id})`);
        return foundFolder.id;
      }

      // Folder doesn't exist, create it
      console.log(`📁 Creating new folder: ${folderName}`);
      const newFolderId = await this.createFolder(folderName, parentFolderId);
      if (newFolderId) {
        console.log(`✅ Created folder: ${folderName} (ID: ${newFolderId})`);
      } else {
        console.error(`❌ Failed to create folder: ${folderName}`);
      }
      return newFolderId;
    } catch (error: any) {
      console.error('Error finding/creating folder:', error);
      
      // Check if it's an authentication error
      if (error.code === 401 || error.status === 401) {
        throw new Error('Google Drive authentication expired. Please reconnect your Google Drive account.');
      }
      
      // Check if it's a permission error
      if (error.code === 403 || error.status === 403) {
        throw new Error('Google Drive permission denied. Please check your Google Drive connection.');
      }
      
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
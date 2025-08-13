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
  setUserTokens(tokens: any) {
    this.googleAuth.setTokens(tokens);
    this.drive = this.googleAuth.getDriveClient();
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
      return null;
    }

    try {
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

      console.log(`File uploaded to Google Drive: ${response.data.name} (ID: ${response.data.id})`);
      return {
        webViewLink: response.data.webViewLink,
        fileId: response.data.id
      };
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      return null;
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

      console.log(`Folder created: ${response.data.name} (ID: ${response.data.id})`);
      return response.data.id;
    } catch (error) {
      console.error('Error creating folder in Google Drive:', error);
      return null;
    }
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
}
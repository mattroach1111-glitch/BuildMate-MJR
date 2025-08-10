import { google } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDriveService {
  private drive: any;

  constructor() {
    // Initialize Google Drive with service account credentials
    // The user needs to provide these as environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
      console.warn('Google Drive service not configured. Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY');
      return;
    }

    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });

    this.drive = google.drive({ version: 'v3', auth });
  }

  async uploadPDF(fileName: string, pdfBuffer: Buffer, folderId?: string): Promise<string | null> {
    if (!this.drive) {
      console.error('Google Drive service not initialized');
      return null;
    }

    try {
      // Create a readable stream from the buffer
      const stream = new Readable();
      stream.push(pdfBuffer);
      stream.push(null);

      const fileMetadata = {
        name: fileName,
        parents: folderId ? [folderId] : undefined,
      };

      const media = {
        mimeType: 'application/pdf',
        body: stream,
      };

      const response = await this.drive.files.create({
        resource: fileMetadata,
        media: media,
        fields: 'id,name,webViewLink',
      });

      console.log(`PDF uploaded to Google Drive: ${response.data.name} (ID: ${response.data.id})`);
      return response.data.webViewLink;
    } catch (error) {
      console.error('Error uploading to Google Drive:', error);
      return null;
    }
  }

  async createFolder(folderName: string, parentFolderId?: string): Promise<string | null> {
    if (!this.drive) {
      console.error('Google Drive service not initialized');
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
    if (!this.drive) {
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
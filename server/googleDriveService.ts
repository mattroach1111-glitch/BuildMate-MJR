import { google } from 'googleapis';
import { Readable } from 'stream';
import { GoogleDriveAuth } from './googleAuth';

// Custom error types for better error handling
export class GoogleDriveError extends Error {
  constructor(
    message: string,
    public readonly code: 'AUTH_REQUIRED' | 'RATE_LIMITED' | 'SERVER_ERROR' | 'NETWORK_ERROR' | 'UNKNOWN_ERROR',
    public readonly retryable: boolean = false,
    public readonly originalError?: any
  ) {
    super(message);
    this.name = 'GoogleDriveError';
  }
}

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

  // Execute an operation with automatic token refresh and retry logic
  private async executeWithTokenRefresh<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: any;
    
    // First attempt - try the operation
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
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
          
          // Retry the original operation after token refresh
          return await operation();
          
        } catch (refreshError) {
          console.error('❌ Failed to refresh Google Drive tokens:', refreshError);
          throw new GoogleDriveError(
            'Google Drive connection expired. Please reconnect your Google Drive account.',
            'AUTH_REQUIRED',
            false,
            refreshError
          );
        }
      }
      
      // Check if it's a retryable error (rate limits, server errors)
      if (this.isRetryableError(error)) {
        console.log('🔄 Retryable Google Drive error detected, attempting with exponential backoff...');
        return await this.executeWithRetry(operation, 3);
      }
      
      // Non-retryable error - throw appropriate GoogleDriveError
      throw this.classifyError(error);
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

  // Check if error is retryable (rate limits, server errors)
  private isRetryableError(error: any): boolean {
    const statusCode = error.response?.status || error.status || error.code;
    return statusCode === 429 || // Too Many Requests
           statusCode === 500 || // Internal Server Error
           statusCode === 502 || // Bad Gateway
           statusCode === 503 || // Service Unavailable
           statusCode === 504 || // Gateway Timeout
           error.code === 'ENOTFOUND' || // DNS issues
           error.code === 'ECONNRESET' || // Connection reset
           error.code === 'ETIMEDOUT'; // Timeout
  }

  // Execute operation with exponential backoff retry
  private async executeWithRetry<T>(operation: () => Promise<T>, maxRetries: number): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error: any) {
        lastError = error;
        
        // Don't retry on the last attempt
        if (attempt === maxRetries - 1) {
          break;
        }
        
        // Only retry if it's still a retryable error
        if (!this.isRetryableError(error)) {
          throw this.classifyError(error);
        }
        
        // Calculate wait time with exponential backoff + jitter
        const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        const jitter = Math.random() * 1000; // 0-1s random jitter
        const waitTime = baseDelay + jitter;
        
        console.log(`🔄 Google Drive retry attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // All retries exhausted
    throw this.classifyError(lastError);
  }

  // Classify errors into appropriate GoogleDriveError types
  private classifyError(error: any): GoogleDriveError {
    const statusCode = error.response?.status || error.status || error.code;
    
    if (this.isAuthError(error)) {
      return new GoogleDriveError(
        'Google Drive connection expired. Please reconnect your Google Drive account.',
        'AUTH_REQUIRED',
        false,
        error
      );
    }
    
    if (statusCode === 429) {
      return new GoogleDriveError(
        'Google Drive rate limit exceeded. Please try again later.',
        'RATE_LIMITED',
        true,
        error
      );
    }
    
    if (statusCode >= 500 && statusCode <= 504) {
      return new GoogleDriveError(
        'Google Drive server error. Please try again later.',
        'SERVER_ERROR',
        true,
        error
      );
    }
    
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return new GoogleDriveError(
        'Network connection issue. Please check your internet connection and try again.',
        'NETWORK_ERROR',
        true,
        error
      );
    }
    
    return new GoogleDriveError(
      error.message || 'Unknown Google Drive error occurred',
      'UNKNOWN_ERROR',
      false,
      error
    );
  }

  async uploadPDF(fileName: string, pdfBuffer: Buffer, folderId?: string): Promise<string> {
    const result = await this.uploadFile(fileName, pdfBuffer, 'application/pdf', folderId);
    return result.webViewLink;
  }

  async uploadFile(fileName: string, fileBuffer: Buffer, mimeType: string, folderId?: string): Promise<{ webViewLink: string; fileId: string }> {
    if (!this.isReady()) {
      throw new GoogleDriveError(
        'Google Drive not connected. Please connect your Google Drive account.',
        'AUTH_REQUIRED',
        false
      );
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
      try {
        await this.makeFilePublic(fileId);
      } catch (publicError) {
        console.warn('Warning: Could not make file public, but upload succeeded:', publicError);
        // Don't fail the upload if we can't make it public
      }
      
      return {
        webViewLink: response.data.webViewLink,
        fileId: fileId
      };
    });
  }

  async makeFilePublic(fileId: string): Promise<boolean> {
    if (!this.isReady()) {
      throw new GoogleDriveError(
        'Google Drive not connected. Please connect your Google Drive account.',
        'AUTH_REQUIRED',
        false
      );
    }

    try {
      await this.executeWithTokenRefresh(async () => {
        return await this.drive.permissions.create({
          fileId: fileId,
          resource: {
            role: 'reader',
            type: 'anyone',
          },
        });
      });
      console.log(`File ${fileId} made publicly readable`);
      return true;
    } catch (error) {
      // For making files public, we'll be more lenient and just log the error
      console.error('Error making file public:', error);
      return false;
    }
  }

  async createFolder(folderName: string, parentFolderId?: string): Promise<string> {
    if (!this.isReady()) {
      throw new GoogleDriveError(
        'Google Drive not connected. Please connect your Google Drive account.',
        'AUTH_REQUIRED',
        false
      );
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
      try {
        await this.makeFilePublic(folderId);
      } catch (publicError) {
        console.warn('Warning: Could not make folder public, but creation succeeded:', publicError);
        // Don't fail the folder creation if we can't make it public
      }
      
      return folderId;
    });
  }

  async findOrCreateFolder(folderName: string, parentFolderId?: string): Promise<string> {
    if (!this.isReady()) {
      throw new GoogleDriveError(
        'Google Drive not connected. Please connect your Google Drive account.',
        'AUTH_REQUIRED',
        false
      );
    }

    return await this.executeWithTokenRefresh(async () => {
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
    });
  }

  // Upload file attachment to Google Drive in job folder
  async uploadJobAttachment(fileName: string, fileBuffer: Buffer, mimeType: string, jobAddress: string): Promise<{ webViewLink: string; fileId: string }> {
    if (!this.isReady()) {
      throw new GoogleDriveError(
        'Google Drive not connected. Please connect your Google Drive account.',
        'AUTH_REQUIRED',
        false
      );
    }

    // Create the folder structure: BuildFlow Pro -> Job - [Address] -> Attachments
    const mainFolderId = await this.findOrCreateFolder('BuildFlow Pro');
    const jobFolderId = await this.findOrCreateFolder(`Job - ${jobAddress}`, mainFolderId);
    const attachmentsFolderId = await this.findOrCreateFolder('Attachments', jobFolderId);

    // Upload file to the attachments folder
    const result = await this.uploadFile(fileName, fileBuffer, mimeType, attachmentsFolderId);
    
    console.log(`✅ Job attachment uploaded to Google Drive: ${fileName} (${jobAddress})`);
    return result;
  }
}
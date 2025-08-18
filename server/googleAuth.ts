import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

export class GoogleDriveAuth {
  private oauth2Client: OAuth2Client;

  constructor() {
    // We'll need to set up OAuth2 credentials for Google Drive
    // Users will need to provide their own OAuth2 client ID and secret
    let redirectUri: string;
    
    if (process.env.GOOGLE_REDIRECT_URI) {
      redirectUri = process.env.GOOGLE_REDIRECT_URI;
    } else if (process.env.REPLIT_DOMAINS) {
      // Use the first domain from REPLIT_DOMAINS
      const domain = process.env.REPLIT_DOMAINS.split(',')[0];
      redirectUri = `https://${domain}/api/google-drive/callback`;
    } else if (process.env.REPLIT_DEPLOYMENT) {
      // Production deployment on Replit
      redirectUri = `https://${process.env.REPLIT_DEPLOYMENT}/api/google-drive/callback`;
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      // Development environment on Replit
      redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN}/api/google-drive/callback`;
    } else {
      // Local development fallback
      redirectUri = 'http://localhost:5000/api/google-drive/callback';
    }
    
    console.log(`🔵 Google Drive redirect URI: ${redirectUri}`);
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
  }

  // Generate the URL for users to authorize the app
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange authorization code for tokens
  async getTokens(code: string) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // Set tokens for an authenticated session
  setTokens(tokens: any) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Get the authenticated Drive client
  getDriveClient() {
    return google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  // Check if the client is authenticated
  isAuthenticated(): boolean {
    const credentials = this.oauth2Client.credentials;
    return !!(credentials && credentials.access_token);
  }

  // Refresh tokens if needed
  async refreshTokens() {
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    this.oauth2Client.setCredentials(credentials);
    return credentials;
  }
}
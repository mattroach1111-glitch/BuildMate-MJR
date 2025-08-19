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
    } else {
      // Detect deployment environment and construct proper URL
      if (process.env.REPLIT_DEPLOYMENT) {
        // Production deployment
        redirectUri = `https://${process.env.REPLIT_DEPLOYMENT}.replit.app/api/google-drive/callback`;
      } else if (process.env.REPLIT_DEV_DOMAIN) {
        // Development environment
        redirectUri = `https://${process.env.REPLIT_DEV_DOMAIN}/api/google-drive/callback`;
      } else {
        // Fallback - you're using the deployed app build-mate-mattroach1111.replit.app
        redirectUri = 'https://build-mate-mattroach1111.replit.app/api/google-drive/callback';
      }
    }
    
    console.log(`🔵 Google Drive redirect URI: ${redirectUri}`);
    console.log(`🔵 Environment debug - REPLIT_DEPLOYMENT: '${process.env.REPLIT_DEPLOYMENT}'`);
    console.log(`🔵 Environment debug - REPLIT_DEV_DOMAIN: '${process.env.REPLIT_DEV_DOMAIN}'`);
    console.log(`🔵 Environment debug - deploymentUrl: '${process.env.REPLIT_DEPLOYMENT ? `https://${process.env.REPLIT_DEPLOYMENT}.replit.app` : process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : 'http://localhost:5000'}'`);
    
    console.log(`🔵 Final OAuth2 config - ClientID: ${process.env.GOOGLE_CLIENT_ID?.substring(0, 10)}..., RedirectURI: ${redirectUri}`);
    
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );
    
    console.log(`🔵 OAuth2 client created, checking configured redirect URI...`);
    console.log(`🔵 OAuth2 client internal redirect URI: ${(this.oauth2Client as any)._redirectUri || 'unknown'}`);
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
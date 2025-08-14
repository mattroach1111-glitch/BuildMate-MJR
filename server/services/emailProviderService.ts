import { google } from 'googleapis';
import { storage } from '../storage';

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments: EmailAttachment[];
  date: Date;
  processed: boolean;
}

export class EmailProviderService {
  private gmail: any;

  constructor(private accessToken: string, private refreshToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    this.gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  }

  // Get unread emails from the inbox
  async getUnreadEmails(userId: string): Promise<EmailMessage[]> {
    try {
      console.log('📧 Fetching unread emails...');

      // Get list of unread messages
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: 'is:unread has:attachment', // Only unread emails with attachments
        maxResults: 10,
      });

      if (!response.data.messages) {
        console.log('📧 No unread emails found');
        return [];
      }

      const emails: EmailMessage[] = [];

      // Process each message
      for (const message of response.data.messages) {
        try {
          const fullMessage = await this.gmail.users.messages.get({
            userId: 'me',
            id: message.id,
            format: 'full',
          });

          const emailMessage = await this.parseGmailMessage(fullMessage.data);
          if (emailMessage) {
            emails.push(emailMessage);
          }
        } catch (error) {
          console.error(`Error processing message ${message.id}:`, error);
        }
      }

      console.log(`📧 Found ${emails.length} unread emails with attachments`);
      return emails;

    } catch (error) {
      console.error('Error fetching emails:', error);
      return [];
    }
  }

  // Parse Gmail API message format into our EmailMessage format
  private async parseGmailMessage(message: any): Promise<EmailMessage | null> {
    try {
      const headers = message.payload.headers;
      const from = headers.find((h: any) => h.name === 'From')?.value || '';
      const to = headers.find((h: any) => h.name === 'To')?.value || '';
      const subject = headers.find((h: any) => h.name === 'Subject')?.value || '';
      const date = headers.find((h: any) => h.name === 'Date')?.value || '';

      // Extract text content
      let text = '';
      let html = '';

      if (message.payload.body?.data) {
        text = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
      }

      // Parse attachments
      const attachments: EmailAttachment[] = [];

      if (message.payload.parts) {
        for (const part of message.payload.parts) {
          if (part.filename && part.body?.attachmentId) {
            try {
              const attachment = await this.gmail.users.messages.attachments.get({
                userId: 'me',
                messageId: message.id,
                id: part.body.attachmentId,
              });

              // Only process PDF and image files
              const contentType = part.mimeType || '';
              if (this.isProcessableDocument(contentType)) {
                attachments.push({
                  filename: part.filename,
                  contentType,
                  content: Buffer.from(attachment.data.data, 'base64'),
                  size: part.body.size || 0,
                });
              }
            } catch (error) {
              console.error(`Error downloading attachment: ${part.filename}`, error);
            }
          }
        }
      }

      // Only return emails with processable attachments
      if (attachments.length === 0) {
        return null;
      }

      return {
        id: message.id,
        from,
        to,
        subject,
        text,
        html,
        attachments,
        date: new Date(date),
        processed: false,
      };

    } catch (error) {
      console.error('Error parsing Gmail message:', error);
      return null;
    }
  }

  // Check if document type can be processed
  private isProcessableDocument(contentType: string): boolean {
    const processableTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
    ];
    return processableTypes.includes(contentType.toLowerCase());
  }

  // Mark email as read after processing
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: 'me',
        id: messageId,
        requestBody: {
          removeLabelIds: ['UNREAD'],
        },
      });
      console.log(`📧 Marked email ${messageId} as read`);
    } catch (error) {
      console.error(`Error marking email as read: ${messageId}`, error);
    }
  }

  // Check if user has valid email credentials
  static async hasValidCredentials(userId: string): Promise<boolean> {
    try {
      const user = await storage.getUser(userId);
      if (!user?.googleDriveTokens) {
        return false;
      }

      const tokens = JSON.parse(user.googleDriveTokens);
      return !!(tokens.access_token && tokens.refresh_token);
    } catch (error) {
      console.error('Error checking email credentials:', error);
      return false;
    }
  }

  // Create service instance for user
  static async createForUser(userId: string): Promise<EmailProviderService | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user?.googleDriveTokens) {
        return null;
      }

      const tokens = JSON.parse(user.googleDriveTokens);
      if (!tokens.access_token || !tokens.refresh_token) {
        return null;
      }

      return new EmailProviderService(tokens.access_token, tokens.refresh_token);
    } catch (error) {
      console.error('Error creating email service for user:', error);
      return null;
    }
  }
}
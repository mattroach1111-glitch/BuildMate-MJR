import Imap from 'node-imap';
import { simpleParser } from 'mailparser';
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

export class ImapEmailService {
  private imap: any;

  constructor(
    private host: string,
    private port: number,
    private username: string,
    private password: string,
    private tls: boolean = true
  ) {
    this.imap = new Imap({
      host,
      port,
      tls,
      user: username,
      password,
      tlsOptions: { rejectUnauthorized: false }
    });
  }

  // Connect to email server and fetch unread emails
  async getUnreadEmails(): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      const emails: EmailMessage[] = [];

      this.imap.once('ready', () => {
        console.log('📧 Connected to email server:', this.host);
        
        this.imap.openBox('INBOX', false, (err: any, box: any) => {
          if (err) {
            console.error('Error opening inbox:', err);
            reject(err);
            return;
          }

          console.log(`📧 Inbox opened. Total messages: ${box.messages.total}, New: ${box.messages.new}`);

          // Search only for UNSEEN (unread) emails — no full-mailbox scan needed
          this.imap.search(['UNSEEN'], (err: any, results: any) => {
              if (err) {
                console.error('Error searching unread emails:', err);
                reject(err);
                return;
              }

              console.log(`📧 Unread emails found: ${results ? results.length : 0} (total in inbox: ${box.messages.total})`);

              if (!results || results.length === 0) {
                console.log('📧 No unread emails found');
                this.imap.end();
                resolve([]);
                return;
              }

              console.log(`📧 Processing ${results.length} unread emails`);

            const fetch = this.imap.fetch(results, {
              bodies: '',
              markSeen: true,  // Mark as read on the server when fetched so they don't reappear
              struct: true
            });

            fetch.on('message', (msg: any, seqno: number) => {
              let buffer = '';
              
              msg.on('body', (stream: any) => {
                stream.on('data', (chunk: any) => {
                  buffer += chunk.toString('utf8');
                });
              });

              msg.once('end', async () => {
                try {
                  const parsed = await simpleParser(buffer);
                  
                  // Only process emails with attachments
                  if (!parsed.attachments || parsed.attachments.length === 0) {
                    return;
                  }

                  // Filter for processable attachments
                  const processableAttachments = parsed.attachments.filter(att => 
                    this.isProcessableDocument(att.contentType)
                  );

                  if (processableAttachments.length === 0) {
                    return;
                  }

                  const emailMessage: EmailMessage = {
                    id: parsed.messageId || `seq-${seqno}`,
                    from: parsed.from?.text || '',
                    to: parsed.to?.text || '',
                    subject: parsed.subject || '',
                    text: parsed.text || '',
                    html: parsed.html || '',
                    attachments: processableAttachments.map(att => ({
                      filename: att.filename || 'attachment',
                      contentType: att.contentType,
                      content: att.content,
                      size: att.size || att.content.length
                    })),
                    date: parsed.date || new Date(),
                    processed: false
                  };

                  emails.push(emailMessage);
                  console.log(`📧 Processed email: ${emailMessage.subject}`);

                } catch (parseError) {
                  console.error('Error parsing email:', parseError);
                }
              });
            });

            fetch.once('error', (err: any) => {
              console.error('Fetch error:', err);
              reject(err);
            });

            fetch.once('end', () => {
              console.log(`📧 Finished processing ${emails.length} emails with attachments`);
              this.imap.end();
              resolve(emails);
              });
            });
          });
        });
      });

      this.imap.once('error', (err: any) => {
        console.error('📧 IMAP connection error details:');
        console.error('📧 Error message:', err.message);
        console.error('📧 Error code:', err.code);
        console.error('📧 Error textCode:', err.textCode);
        console.error('📧 Error source:', err.source);
        console.error('📧 Full error:', JSON.stringify(err, null, 2));
        console.error('📧 Connection details: host=' + this.host + ', port=' + this.port + ', tls=' + this.tls + ', user=' + this.username);
        reject(err);
      });

      // Log IMAP alerts from server
      this.imap.on('alert', (message: string) => {
        console.log('📧 IMAP server alert:', message);
      });

      console.log('📧 Attempting IMAP connection to:', this.host, 'port:', this.port, 'user:', this.username);
      this.imap.connect();
    });
  }

  // Mark email as read — now handled automatically via markSeen: true in fetch
  async markAsRead(messageId: string): Promise<void> {
    console.log(`📧 Email ${messageId} was marked as read during fetch`);
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

  // Create service instance with email credentials
  static async createWithCredentials(
    host: string,
    port: number,
    username: string,
    password: string,
    tls: boolean = true
  ): Promise<ImapEmailService> {
    return new ImapEmailService(host, port, username, password, tls);
  }
}
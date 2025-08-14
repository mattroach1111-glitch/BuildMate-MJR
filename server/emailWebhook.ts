import type { Express } from 'express';
import { EmailInboxService } from './services/emailInboxService';

interface WebhookEmailData {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: Array<{
    filename: string;
    contentType: string;
    content: string; // base64 encoded
    size: number;
  }>;
  messageId: string;
  date: string;
}

export function setupEmailWebhook(app: Express) {
  // Webhook endpoint for receiving emails from email service
  app.post('/webhook/email', async (req, res) => {
    try {
      console.log('📧 Received email webhook');
      
      const emailData: WebhookEmailData = req.body;
      
      // Validate webhook data
      if (!emailData.from || !emailData.to || !emailData.subject) {
        console.error('❌ Invalid email webhook data');
        return res.status(400).json({ error: 'Invalid email data' });
      }
      
      // Check if this is for a documents-* email address
      if (!emailData.to.includes('documents-') || !emailData.to.includes('@mjrbuilders.com.au')) {
        console.log('⏭️  Email not for document processing:', emailData.to);
        return res.status(200).json({ message: 'Email ignored - not for document processing' });
      }
      
      console.log(`📧 Processing email from ${emailData.from} to ${emailData.to}`);
      console.log(`📧 Subject: ${emailData.subject}`);
      console.log(`📧 Attachments: ${emailData.attachments?.length || 0}`);
      
      // Convert webhook data to EmailMessage format
      const emailMessage = {
        id: emailData.messageId,
        from: emailData.from,
        to: emailData.to,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
        attachments: (emailData.attachments || []).map(att => ({
          filename: att.filename,
          contentType: att.contentType,
          content: Buffer.from(att.content, 'base64'),
          size: att.size
        })),
        date: new Date(emailData.date),
        processed: false
      };
      
      // Process the email
      const emailService = new EmailInboxService();
      const success = await emailService.processEmail(emailMessage);
      
      if (success) {
        console.log('✅ Email processed successfully');
        res.status(200).json({ message: 'Email processed successfully' });
      } else {
        console.log('❌ Email processing failed');
        res.status(500).json({ error: 'Email processing failed' });
      }
      
    } catch (error) {
      console.error('❌ Error in email webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });
  
  // Health check endpoint for email webhook
  app.get('/webhook/email/health', (req, res) => {
    res.status(200).json({ 
      status: 'healthy',
      service: 'email-webhook',
      timestamp: new Date().toISOString()
    });
  });
  
  console.log('📧 Email webhook endpoints registered');
}
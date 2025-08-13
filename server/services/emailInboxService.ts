import { storage } from '../storage';

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

interface EmailAttachment {
  filename: string;
  contentType: string;
  content: Buffer;
  size: number;
}

interface ProcessedDocument {
  filename: string;
  vendor: string;
  amount: number;
  description: string;
  date: string;
  category: 'materials' | 'subtrades' | 'other_costs' | 'tip_fees';
  confidence: number;
  extractedJobName?: string;
}

export class EmailInboxService {
  constructor() {}

  // Parse user ID from email address
  private getUserIdFromEmailAddress(emailAddress: string): string | null {
    const match = emailAddress.match(/documents-([a-f0-9]{8})@mjrbuilders\.com\.au/);
    if (!match) return null;
    
    // Find user by the last 8 characters of their ID
    return match[1];
  }

  // Extract job name from email subject
  private extractJobNameFromSubject(subject: string): string | null {
    // Common patterns:
    // "Invoice for 21 Greenhill Dr"
    // "Materials for Hernan Project"
    // "Expenses - Smith Renovation"
    
    const patterns = [
      /(?:for|project|job|site)\s+([^-,\n]+)/i,
      /^([^-:]+)\s*[-:]/,
      /([a-zA-Z\s]+(?:street|st|road|rd|drive|dr|avenue|ave|court|ct|place|pl))/i
    ];
    
    for (const pattern of patterns) {
      const match = subject.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }
    
    return null;
  }

  // Process document using AI (similar to existing document processor)
  private async processDocumentWithAI(attachment: EmailAttachment): Promise<ProcessedDocument | null> {
    try {
      console.log(`📄 Processing document: ${attachment.filename}`);
      
      // Convert to base64 for AI processing
      const base64Content = attachment.content.toString('base64');
      
      const response = await fetch('http://localhost:5000/api/documents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileData: base64Content,
          fileName: attachment.filename,
          mimeType: attachment.contentType
        })
      });
      
      if (!response.ok) {
        console.error(`Failed to process document: ${response.statusText}`);
        return null;
      }
      
      const result = await response.json();
      return {
        filename: attachment.filename,
        vendor: result.vendor || 'Unknown Vendor',
        amount: result.amount || 0,
        description: result.description || attachment.filename,
        date: result.date || new Date().toISOString().split('T')[0],
        category: result.category || 'other_costs',
        confidence: result.confidence || 0.5
      };
    } catch (error) {
      console.error('Error processing document with AI:', error);
      return null;
    }
  }

  // Find best matching job
  private async findMatchingJob(jobName: string, userId: string): Promise<any | null> {
    try {
      // Get all jobs for user
      const allJobs = await storage.getJobs();
      if (!allJobs || allJobs.length === 0) return null;

      // Use fuzzy matching similar to existing system
      const fuzz = await import('fuzzball');
      let bestMatch = null;
      let bestScore = 0;
      const threshold = 70; // Lower threshold for email job matching

      for (const job of allJobs) {
        const jobIdentifiers = [
          job.jobAddress,
          job.clientName,
          job.projectName,
          `${job.clientName} ${job.jobAddress}`,
          `${job.projectName} ${job.jobAddress}`
        ].filter(Boolean);
        
        for (const identifier of jobIdentifiers) {
          const score = fuzz.ratio(jobName.toLowerCase(), identifier.toLowerCase());
          if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = job;
          }
        }
      }
      
      if (bestMatch) {
        console.log(`🎯 Found job match: "${jobName}" -> "${bestMatch.jobAddress}" (${bestScore}%)`);
      }
      
      return bestMatch;
    } catch (error) {
      console.error('Error finding matching job:', error);
      return null;
    }
  }

  // Add expense to job sheet
  private async addExpenseToJob(jobId: string, expense: ProcessedDocument, userId: string): Promise<boolean> {
    try {
      const expenseData = {
        vendor: expense.vendor,
        description: expense.description,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        jobId: jobId
      };

      // Add to appropriate category based on expense type
      let endpoint = '';
      switch (expense.category) {
        case 'materials':
          endpoint = '/api/materials';
          break;
        case 'subtrades':
          endpoint = '/api/subtrades';
          break;
        case 'tip_fees':
          endpoint = '/api/tip-fees';
          break;
        default:
          endpoint = '/api/other-costs';
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(expenseData)
      });

      return response.ok;
    } catch (error) {
      console.error('Error adding expense to job:', error);
      return false;
    }
  }

  // Send confirmation email
  private async sendConfirmationEmail(
    userEmail: string, 
    processedDocuments: ProcessedDocument[], 
    jobAddress?: string
  ): Promise<void> {
    try {
      const { sendEmail } = await import('./emailService');
      
      let subject = `Document Processing Complete`;
      if (jobAddress) {
        subject += ` - ${jobAddress}`;
      }
      
      let emailContent = `Your documents have been processed successfully!\n\n`;
      emailContent += `Processed Documents:\n`;
      
      for (const doc of processedDocuments) {
        emailContent += `\n• ${doc.filename}\n`;
        emailContent += `  Vendor: ${doc.vendor}\n`;
        emailContent += `  Amount: $${doc.amount.toFixed(2)}\n`;
        emailContent += `  Category: ${doc.category.replace('_', ' ')}\n`;
      }
      
      if (jobAddress) {
        emailContent += `\nAdded to job: ${jobAddress}\n`;
      } else {
        emailContent += `\nPlease manually assign these expenses to the appropriate job sheet.\n`;
      }
      
      emailContent += `\nLogin to BuildFlow Pro to review and edit if needed.`;
      
      await sendEmail({
        to: userEmail,
        from: process.env.SMTP_FROM_EMAIL || 'noreply@mjrbuilders.com.au',
        subject,
        text: emailContent
      });
      
      console.log(`✅ Confirmation email sent to ${userEmail}`);
    } catch (error) {
      console.error('Error sending confirmation email:', error);
    }
  }

  // Main email processing function
  async processEmail(emailMessage: EmailMessage): Promise<boolean> {
    let logId: string | null = null;
    
    try {
      console.log(`📧 Processing email from ${emailMessage.from} with ${emailMessage.attachments.length} attachments`);
      
      // Create processing log entry
      const logEntry = await storage.createEmailProcessingLog({
        messageId: emailMessage.id,
        fromEmail: emailMessage.from,
        toEmail: emailMessage.to,
        subject: emailMessage.subject,
        attachmentCount: emailMessage.attachments.length,
        processedCount: 0,
        status: "processing"
      });
      logId = logEntry.id;
      
      // For direct email integration, we'll use the admin user who's processing
      // In the future, this could be made configurable per email address
      const allUsers = await storage.getAllUsers();
      const targetUser = allUsers.find((user: any) => user.role === 'admin');
      
      if (!targetUser) {
        console.log(`❌ Could not find admin user for email processing`);
        await storage.updateEmailProcessingLogStatus(logId, "failed", "Admin user not found");
        return false;
      }
      
      console.log(`👤 Processing email for admin user: ${targetUser.email}`);
      
      // Extract job name from subject
      const extractedJobName = this.extractJobNameFromSubject(emailMessage.subject);
      let targetJob = null;
      
      console.log(`🔍 Extracted job name from subject "${emailMessage.subject}": ${extractedJobName || 'none'}`);
      
      if (extractedJobName) {
        targetJob = await this.findMatchingJob(extractedJobName, targetUser.id);
        if (targetJob) {
          console.log(`🎯 Matched job: ${targetJob.jobAddress}`);
        } else {
          console.log(`❌ No matching job found for: ${extractedJobName}`);
        }
      }
      
      // Process attachments
      const processedDocuments: ProcessedDocument[] = [];
      
      for (const attachment of emailMessage.attachments) {
        // Only process document types
        if (!this.isProcessableDocument(attachment.contentType)) {
          console.log(`⏭️  Skipping non-document attachment: ${attachment.filename}`);
          continue;
        }
        
        const processed = await this.processDocumentWithAI(attachment);
        if (processed) {
          processedDocuments.push(processed);
          
          console.log(`📄 Document processed: ${processed.filename}`);
          console.log(`💰 Extracted amount: $${processed.amount}`);
          console.log(`🏢 Vendor: ${processed.vendor}`);
          console.log(`📁 Category: ${processed.category}`);
          
          // Save to database for review workflow
          await storage.createEmailProcessedDocument({
            filename: processed.filename,
            vendor: processed.vendor,
            amount: processed.amount,
            category: processed.category,
            status: 'pending',
            emailSubject: emailMessage.subject,
            emailFrom: emailMessage.from,
            extractedData: JSON.stringify(processed),
            userId: targetUser.id
          });
          
          console.log(`📋 Document saved for review approval`);
        }
      }
      
      // Update processing log
      await storage.updateEmailProcessingLogStatus(logId, "completed");
      
      // Update processed count
      await storage.createEmailProcessingLog({
        messageId: emailMessage.id,
        fromEmail: emailMessage.from,
        toEmail: emailMessage.to,
        subject: emailMessage.subject,
        attachmentCount: emailMessage.attachments.length,
        processedCount: processedDocuments.length,
        status: "completed",
        jobMatched: targetJob?.id
      });
      
      // Send confirmation email
      if (processedDocuments.length > 0) {
        await this.sendConfirmationEmail(
          emailMessage.from,
          processedDocuments,
          targetJob?.jobAddress
        );
      }
      
      console.log(`✅ Processed ${processedDocuments.length} documents from email`);
      return true;
      
    } catch (error) {
      console.error('Error processing email:', error);
      if (logId) {
        await storage.updateEmailProcessingLogStatus(logId, "failed", error.message);
      }
      return false;
    }
  }

  // Check if file type is processable
  private isProcessableDocument(contentType: string): boolean {
    const processableTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif'
    ];
    
    return processableTypes.includes(contentType.toLowerCase());
  }

  // Manual processing trigger (checks actual email inbox)
  async processInbox(userId: string): Promise<{ processed: number; errors: string[] }> {
    try {
      console.log('📧 Email processing system initialized');
      console.log('📧 Connecting to:', process.env.EMAIL_HOST, 'as', process.env.EMAIL_USER);
      
      // Check for email credentials in environment
      const emailHost = process.env.EMAIL_HOST;
      const emailPort = parseInt(process.env.EMAIL_PORT || '993');
      const emailUser = process.env.EMAIL_USER;
      const emailPass = process.env.EMAIL_PASS;
      
      if (!emailHost || !emailUser || !emailPass) {
        console.log('❌ Email credentials not configured');
        return {
          processed: 0,
          errors: ['Email credentials not configured. Please add EMAIL_HOST, EMAIL_USER, and EMAIL_PASS environment variables.']
        };
      }
      
      // Import and create IMAP email service
      const { ImapEmailService } = await import('./imapEmailService');
      const emailService = await ImapEmailService.createWithCredentials(
        emailHost,
        emailPort,
        emailUser,
        emailPass,
        true // Use TLS
      );
      
      // Fetch unread emails with attachments
      const unreadEmails = await emailService.getUnreadEmails();
      console.log(`📧 Found ${unreadEmails.length} unread emails with attachments`);
      
      let processed = 0;
      const errors: string[] = [];
      
      // Process each email
      for (const email of unreadEmails) {
        try {
          console.log(`📧 Processing email: ${email.subject}`);
          const success = await this.processEmail(email);
          
          if (success) {
            // Mark email as read after successful processing
            await emailService.markAsRead(email.id);
            processed++;
            console.log(`✅ Successfully processed email: ${email.subject}`);
          } else {
            errors.push(`Failed to process email: ${email.subject}`);
            console.log(`❌ Failed to process email: ${email.subject}`);
          }
        } catch (error) {
          console.error(`Error processing email ${email.id}:`, error);
          errors.push(`Error processing email: ${error.message}`);
        }
      }
      
      console.log(`✅ Processed ${processed} emails successfully`);
      return {
        processed,
        errors
      };
      
    } catch (error) {
      console.error('Error processing inbox:', error);
      return {
        processed: 0,
        errors: [error.message]
      };
    }
  }

  // Simulate email polling (in production this would connect to email server)
  async pollForNewEmails(): Promise<EmailMessage[]> {
    // This is a placeholder - in production you would:
    // 1. Connect to IMAP server
    // 2. Check for new emails to documents-* addresses
    // 3. Parse email content and attachments
    // 4. Return EmailMessage objects
    
    console.log('📬 Checking for new emails...');
    return [];
  }
}
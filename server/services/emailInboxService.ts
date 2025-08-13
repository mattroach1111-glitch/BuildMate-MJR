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
      
      const response = await fetch('/api/documents/process', {
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
      
      // Extract user ID from email address
      const userIdSuffix = this.getUserIdFromEmailAddress(emailMessage.to);
      if (!userIdSuffix) {
        console.log(`❌ Could not extract user ID from email address: ${emailMessage.to}`);
        await storage.updateEmailProcessingLogStatus(logId, "failed", "Invalid email address format");
        return false;
      }
      
      // Find user by ID suffix
      const allUsers = await storage.getAllUsers();
      const targetUser = allUsers.find((user: any) => user.id.slice(-8) === userIdSuffix);
      
      if (!targetUser) {
        console.log(`❌ Could not find user with ID ending in: ${userIdSuffix}`);
        await storage.updateEmailProcessingLogStatus(logId, "failed", `User not found for ID suffix: ${userIdSuffix}`);
        return false;
      }
      
      console.log(`👤 Processing email for user: ${targetUser.email}`);
      
      // Extract job name from subject
      const extractedJobName = this.extractJobNameFromSubject(emailMessage.subject);
      let targetJob = null;
      
      if (extractedJobName) {
        targetJob = await this.findMatchingJob(extractedJobName, targetUser.id);
        if (targetJob) {
          console.log(`🎯 Matched job: ${targetJob.jobAddress}`);
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
          
          // Add to job if found
          if (targetJob) {
            const added = await this.addExpenseToJob(targetJob.id, processed, targetUser.id);
            if (added) {
              console.log(`✅ Added ${processed.filename} to job ${targetJob.jobAddress}`);
            }
          }
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
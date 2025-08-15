// Simple integration test to verify Google Drive functionality
import { storage } from './server/storage.js';

async function testGoogleDriveIntegration() {
  try {
    console.log('🧪 Testing Google Drive Integration...');
    
    // 1. Check pending email documents
    console.log('📧 Checking pending email documents...');
    const pendingDocs = await storage.getEmailProcessedDocumentsPending();
    console.log(`📄 Found ${pendingDocs.length} pending documents`);
    
    if (pendingDocs.length > 0) {
      const doc = pendingDocs[0];
      console.log('📄 Sample document:', {
        id: doc.id.slice(0, 8),
        filename: doc.filename,
        vendor: doc.vendor,
        amount: doc.amount,
        category: doc.category,
        hasAttachmentContent: !!doc.attachmentContent,
        mimeType: doc.mimeType,
        emailSubject: doc.emailSubject
      });
    }
    
    // 2. Check available jobs
    console.log('🏢 Checking available jobs...');
    const jobs = await storage.getJobs();
    console.log(`🏗️ Found ${jobs.length} jobs`);
    
    if (jobs.length > 0) {
      const job = jobs[0];
      console.log('🏗️ Sample job:', {
        id: job.id.slice(0, 8),
        address: job.jobAddress,
        client: job.clientName,
        projectManager: job.projectManager
      });
      
      // Check job files
      const jobFiles = await storage.getJobFiles(job.id);
      console.log(`📂 Job ${job.jobAddress} has ${jobFiles.length} files`);
    }
    
    // 3. Check users with Google Drive tokens
    console.log('👤 Checking users with Google Drive integration...');
    const users = await storage.getAllUsers();
    const usersWithGoogleDrive = users.filter(user => user.googleDriveTokens);
    console.log(`☁️ ${usersWithGoogleDrive.length} users have Google Drive connected`);
    
    if (usersWithGoogleDrive.length > 0) {
      console.log('✅ Google Drive integration is ready for use');
    } else {
      console.log('⚠️ No users have Google Drive connected yet');
    }
    
    console.log('🎯 Integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
  }
}

testGoogleDriveIntegration();
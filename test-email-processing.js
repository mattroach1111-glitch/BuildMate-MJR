// Test script for email processing with Google Drive integration
import fetch from 'node-fetch';

async function testEmailProcessing() {
  console.log('🧪 Testing Email Processing with Google Drive Integration');
  
  // Test data - simulating an email with PDF attachment
  const testEmailData = {
    from: 'supplier@example.com',
    to: 'documents@mjrbuilders.com.au',
    subject: 'Invoice for 21 Greenhill Dr',
    text: 'Please find attached invoice for materials delivered to 21 Greenhill Dr.',
    attachments: [{
      filename: 'invoice-test.pdf',
      contentType: 'application/pdf',
      // Create a simple test PDF content (base64 encoded)
      content: Buffer.from('Test PDF content for invoice processing'),
      size: 1024
    }]
  };

  try {
    // 1. Test email processing endpoint
    console.log('📧 Step 1: Processing email with attachment...');
    const processResponse = await fetch('http://localhost:5000/api/email-processing/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testEmailData)
    });
    
    if (!processResponse.ok) {
      throw new Error(`Email processing failed: ${processResponse.status}`);
    }
    
    const processResult = await processResponse.json();
    console.log('✅ Email processed:', processResult);

    // 2. Check pending documents
    console.log('📋 Step 2: Checking pending documents...');
    const pendingResponse = await fetch('http://localhost:5000/api/email-processing/pending', {
      credentials: 'include'
    });
    
    if (!pendingResponse.ok) {
      throw new Error(`Failed to fetch pending documents: ${pendingResponse.status}`);
    }
    
    const pendingDocs = await pendingResponse.json();
    console.log('📄 Pending documents:', pendingDocs.length);
    
    if (pendingDocs.length === 0) {
      console.log('❌ No pending documents found');
      return;
    }

    const testDoc = pendingDocs[0];
    console.log('📄 Test document:', {
      id: testDoc.id,
      filename: testDoc.filename,
      vendor: testDoc.vendor,
      amount: testDoc.amount,
      hasAttachmentContent: !!testDoc.attachmentContent,
      mimeType: testDoc.mimeType
    });

    // 3. Get available jobs
    console.log('🏢 Step 3: Getting available jobs...');
    const jobsResponse = await fetch('http://localhost:5000/api/jobs', {
      credentials: 'include'
    });
    
    if (!jobsResponse.ok) {
      throw new Error(`Failed to fetch jobs: ${jobsResponse.status}`);
    }
    
    const jobs = await jobsResponse.json();
    console.log('🏗️ Available jobs:', jobs.length);
    
    if (jobs.length === 0) {
      console.log('❌ No jobs available for testing');
      return;
    }

    // Find a job that matches our test (21 Greenhill Dr)
    const targetJob = jobs.find(job => 
      job.jobAddress && job.jobAddress.toLowerCase().includes('greenhill')
    ) || jobs[0]; // Fallback to first job

    console.log('🎯 Target job for approval:', {
      id: targetJob.id,
      address: targetJob.jobAddress,
      client: targetJob.clientName
    });

    // 4. Test approval with Google Drive integration
    console.log('✅ Step 4: Approving document with Google Drive integration...');
    const approveResponse = await fetch(`http://localhost:5000/api/email-processing/approve/${testDoc.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ 
        jobId: targetJob.id,
        categoryOverride: 'materials'
      })
    });
    
    if (!approveResponse.ok) {
      const errorText = await approveResponse.text();
      throw new Error(`Approval failed: ${approveResponse.status} - ${errorText}`);
    }
    
    const approveResult = await approveResponse.json();
    console.log('🎉 Approval result:', approveResult);
    
    // Log the important integration results
    console.log('\n📊 INTEGRATION TEST RESULTS:');
    console.log('🔗 Document approved:', approveResult.success);
    console.log('📎 File attached to job:', approveResult.fileAttached);
    console.log('☁️ Google Drive uploaded:', approveResult.googleDriveUploaded);
    console.log('🔗 Google Drive link:', approveResult.googleDriveLink || 'N/A');
    console.log('📁 Category:', approveResult.category);
    console.log('💬 Message:', approveResult.message);

    // 5. Verify job files were created
    console.log('\n📁 Step 5: Verifying job files...');
    const jobFilesResponse = await fetch(`http://localhost:5000/api/jobs/${targetJob.id}/files`, {
      credentials: 'include'
    });
    
    if (jobFilesResponse.ok) {
      const jobFiles = await jobFilesResponse.json();
      console.log('📂 Job files created:', jobFiles.length);
      if (jobFiles.length > 0) {
        const latestFile = jobFiles[0];
        console.log('📄 Latest file:', {
          filename: latestFile.fileName,
          size: latestFile.fileSize,
          mimeType: latestFile.mimeType,
          googleDriveLink: latestFile.googleDriveLink || 'N/A'
        });
      }
    }

    console.log('\n🎯 EMAIL PROCESSING TEST COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testEmailProcessing().then(() => {
  console.log('🏁 Test execution finished');
}).catch(error => {
  console.error('💥 Test execution error:', error);
});
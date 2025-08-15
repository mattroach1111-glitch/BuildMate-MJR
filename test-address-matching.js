// Test script to verify the new address matching logic
const testCases = [
  {
    subject: "18 Haig St",
    expectedMatch: "18 Haig St", // Should match exactly, not "21 Stone Dr"
    shouldMatch: true
  },
  {
    subject: "21 Stone Dr", 
    expectedMatch: "21 Stone Dr",
    shouldMatch: true
  },
  {
    subject: "Invoice for 21 Stone Dr work",
    expectedMatch: "21 Stone Dr",
    shouldMatch: true
  },
  {
    subject: "18 Haig St materials",
    expectedMatch: "18 Haig St", 
    shouldMatch: true
  },
  {
    subject: "16 eve", // Partial address - should match "16 eve st"
    expectedMatch: "16 eve st",
    shouldMatch: true
  },
  {
    subject: "16 eve materials", // Partial address with extra text
    expectedMatch: "16 eve st",
    shouldMatch: true
  },
  {
    subject: "Random invoice text",
    expectedMatch: null,
    shouldMatch: false
  }
];

// Simulate the new address matching logic
function testAddressMatching(subject, availableJobs) {
  const subjectLower = subject.toLowerCase();
  
  for (const job of availableJobs) {
    const jobLower = job.toLowerCase().trim();
    
    // Extract street number and name from job address (must have street type)
    const jobMatch = jobLower.match(/(\d+)\s+([A-Za-z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
    
    if (jobMatch) {
      const jobNumber = jobMatch[1];
      const jobStreet = jobMatch[2].toLowerCase().trim();
      
      // Try full address match first
      const subjectFullMatch = subjectLower.match(/(\d+)\s+([A-Za-z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
      
      if (subjectFullMatch) {
        const subjectNumber = subjectFullMatch[1];
        const subjectStreet = subjectFullMatch[2].toLowerCase().trim();
        
        if (subjectNumber === jobNumber && subjectStreet === jobStreet) {
          console.log(`✅ FULL address match: "${subject}" -> "${job}"`);
          return job;
        }
      } else {
        // Try partial address match (number + street name without type)
        const subjectPartialMatch = subjectLower.match(/(\d+)\s+([A-Za-z]+(?:\s+[A-Za-z]+)*)/i);
        
        if (subjectPartialMatch) {
          const subjectNumber = subjectPartialMatch[1];
          const subjectStreet = subjectPartialMatch[2].toLowerCase().trim();
          
          console.log(`🔍 Partial check: "${subjectNumber} ${subjectStreet}" vs "${jobNumber} ${jobStreet}"`);
          
          if (subjectNumber === jobNumber && subjectStreet === jobStreet) {
            console.log(`✅ PARTIAL address match: "${subject}" -> "${job}"`);
            return job;
          }
        }
      }
    }
  }
  
  console.log(`❌ No match for: "${subject}"`);
  return null;
}

// Test with sample job addresses
const sampleJobs = [
  "18 Haig St",
  "21 Stone Dr", 
  "123 Main St",
  "45 Oak Avenue",
  "16 eve st"
];

console.log('🧪 Testing Improved Address Matching Logic\n');

for (const testCase of testCases) {
  console.log(`\n📧 Testing: "${testCase.subject}"`);
  const result = testAddressMatching(testCase.subject, sampleJobs);
  
  if (testCase.shouldMatch) {
    if (result === testCase.expectedMatch) {
      console.log(`✅ PASS: Correctly matched "${testCase.expectedMatch}"`);
    } else {
      console.log(`❌ FAIL: Expected "${testCase.expectedMatch}", got "${result}"`);
    }
  } else {
    if (result === null) {
      console.log(`✅ PASS: Correctly found no match`);
    } else {
      console.log(`❌ FAIL: Expected no match, got "${result}"`);
    }
  }
}

console.log('\n🎯 Test completed');
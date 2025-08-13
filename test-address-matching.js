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
    subject: "Random invoice text",
    expectedMatch: null,
    shouldMatch: false
  }
];

// Simulate the new address matching logic
function testAddressMatching(subject, availableJobs) {
  const addressPattern = /(\d+)\s+([A-Za-z\s]+(?:st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court))/i;
  const subjectMatch = subject.toLowerCase().match(addressPattern);
  
  if (!subjectMatch) {
    return null;
  }
  
  const subjectNumber = subjectMatch[1];
  const subjectStreet = subjectMatch[2].toLowerCase().trim();
  
  console.log(`🔍 Extracted from "${subject}": number="${subjectNumber}", street="${subjectStreet}"`);
  
  for (const job of availableJobs) {
    const jobMatch = job.toLowerCase().match(addressPattern);
    if (jobMatch) {
      const jobNumber = jobMatch[1];
      const jobStreet = jobMatch[2].toLowerCase().trim();
      
      // Require exact street number AND street name match
      if (subjectNumber === jobNumber && subjectStreet === jobStreet) {
        console.log(`✅ EXACT match: "${subject}" -> "${job}"`);
        return job;
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
  "45 Oak Avenue"
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
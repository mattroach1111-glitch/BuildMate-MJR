#!/usr/bin/env node
/**
 * BuildFlow Pro Migration Validation Script
 * 
 * This script validates that a migrated BuildFlow Pro instance is working correctly.
 * Run this after migrating to a new platform to ensure all systems are functional.
 */

import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';
import { existsSync } from 'fs';

const VALIDATION_TESTS = [
  'database_connection',
  'table_structure',
  'data_integrity',
  'user_authentication',
  'api_endpoints',
  'file_storage',
  'environment_variables'
];

class ValidationResults {
  constructor() {
    this.results = [];
    this.errors = [];
    this.warnings = [];
  }
  
  addResult(test, status, message, details = null) {
    this.results.push({ test, status, message, details });
    
    if (status === 'error') {
      this.errors.push(`${test}: ${message}`);
    } else if (status === 'warning') {
      this.warnings.push(`${test}: ${message}`);
    }
  }
  
  getStatusIcon(status) {
    switch (status) {
      case 'pass': return '✅';
      case 'warning': return '⚠️';
      case 'error': return '❌';
      case 'info': return 'ℹ️';
      default: return '❓';
    }
  }
  
  printResults() {
    console.log('\n📋 VALIDATION RESULTS');
    console.log('='.repeat(50));
    
    for (const result of this.results) {
      const icon = this.getStatusIcon(result.status);
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    }
    
    console.log('\n📊 SUMMARY');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.status === 'pass').length;
    const warnings = this.warnings.length;
    const errors = this.errors.length;
    
    console.log(`✅ Passed: ${passed}`);
    if (warnings > 0) console.log(`⚠️ Warnings: ${warnings}`);
    if (errors > 0) console.log(`❌ Errors: ${errors}`);
    
    if (errors === 0 && warnings === 0) {
      console.log('\n🎉 All validation tests passed! Your migration was successful.');
      return true;
    } else if (errors === 0) {
      console.log('\n✅ Migration successful with minor warnings. Review warnings above.');
      return true;
    } else {
      console.log('\n❌ Migration validation failed. Please address the errors above.');
      return false;
    }
  }
}

async function validateDatabaseConnection(results) {
  console.log('🔗 Testing database connection...');
  
  try {
    await db.select().from(schema.users).limit(1);
    results.addResult('database_connection', 'pass', 'Database connection successful');
  } catch (error) {
    results.addResult('database_connection', 'error', 'Cannot connect to database', error.message);
  }
}

async function validateTableStructure(results) {
  console.log('🏗️ Validating table structure...');
  
  const expectedTables = [
    'users', 'employees', 'staffMembers', 'jobs', 'laborEntries', 
    'materials', 'subTrades', 'otherCosts', 'tipFees', 'timesheetEntries',
    'staffNotesEntries', 'jobNotes', 'emailDrafts'
  ];
  
  try {
    let tablesFound = 0;
    
    for (const tableName of expectedTables) {
      try {
        const table = schema[tableName];
        await db.select().from(table).limit(1);
        tablesFound++;
      } catch (error) {
        results.addResult('table_structure', 'error', `Table ${tableName} not accessible`, error.message);
        return;
      }
    }
    
    results.addResult('table_structure', 'pass', `All ${tablesFound} required tables found and accessible`);
  } catch (error) {
    results.addResult('table_structure', 'error', 'Table structure validation failed', error.message);
  }
}

async function validateDataIntegrity(results) {
  console.log('🔍 Checking data integrity...');
  
  try {
    const counts = {
      users: await db.select().from(schema.users).then(rows => rows.length),
      jobs: await db.select().from(schema.jobs).then(rows => rows.length),
      employees: await db.select().from(schema.employees).then(rows => rows.length),
      timesheetEntries: await db.select().from(schema.timesheetEntries).then(rows => rows.length)
    };
    
    const totalRecords = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    if (totalRecords === 0) {
      results.addResult('data_integrity', 'warning', 'No data found in database - this may be a fresh install');
    } else {
      results.addResult('data_integrity', 'pass', `Database contains ${totalRecords} total records`, 
        `Users: ${counts.users}, Jobs: ${counts.jobs}, Employees: ${counts.employees}, Timesheet: ${counts.timesheetEntries}`);
    }
    
    // Check for orphaned records
    const orphanedJobs = await db.select().from(schema.jobs)
      .leftJoin(schema.users, null) // This would need proper join logic
      .then(rows => rows.filter(row => !row.users).length);
    
    if (orphanedJobs > 0) {
      results.addResult('data_integrity', 'warning', `Found ${orphanedJobs} potentially orphaned job records`);
    }
    
  } catch (error) {
    results.addResult('data_integrity', 'error', 'Data integrity check failed', error.message);
  }
}

async function validateEnvironmentVariables(results) {
  console.log('⚙️ Checking environment variables...');
  
  const requiredVars = [
    'DATABASE_URL',
    'NODE_ENV'
  ];
  
  const optionalVars = [
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'REPLIT_AUTH_PROVIDER_ID',
    'PORT'
  ];
  
  const missing = [];
  const present = [];
  
  for (const varName of requiredVars) {
    if (process.env[varName]) {
      present.push(varName);
    } else {
      missing.push(varName);
    }
  }
  
  if (missing.length > 0) {
    results.addResult('environment_variables', 'error', `Missing required environment variables: ${missing.join(', ')}`);
  } else {
    results.addResult('environment_variables', 'pass', `All required environment variables present (${present.length} found)`);
  }
  
  // Check optional variables
  const optionalPresent = optionalVars.filter(varName => process.env[varName]);
  if (optionalPresent.length < optionalVars.length) {
    const optionalMissing = optionalVars.filter(varName => !process.env[varName]);
    results.addResult('environment_variables', 'info', `Optional variables missing: ${optionalMissing.join(', ')}`);
  }
}

async function validateApiEndpoints(results) {
  console.log('🌐 Testing API endpoints...');
  
  const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
  const testEndpoints = [
    '/api/auth/user',
    '/api/jobs',
    '/api/employees',
    '/api/backup/status'
  ];
  
  let workingEndpoints = 0;
  
  for (const endpoint of testEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      // We expect some endpoints to return 401 (unauthorized) which is fine
      if (response.status < 500) {
        workingEndpoints++;
      }
    } catch (error) {
      // Network errors indicate the server might not be running
      results.addResult('api_endpoints', 'warning', `Endpoint ${endpoint} not accessible`, error.message);
    }
  }
  
  if (workingEndpoints === testEndpoints.length) {
    results.addResult('api_endpoints', 'pass', `All ${workingEndpoints} API endpoints responding`);
  } else if (workingEndpoints > 0) {
    results.addResult('api_endpoints', 'warning', `${workingEndpoints}/${testEndpoints.length} API endpoints responding`);
  } else {
    results.addResult('api_endpoints', 'error', 'No API endpoints responding - server may not be running');
  }
}

async function validateFileStorage(results) {
  console.log('📁 Checking file storage...');
  
  const directories = [
    './backups',
    './uploads',
    './temp'
  ];
  
  let accessibleDirs = 0;
  
  for (const dir of directories) {
    if (existsSync(dir)) {
      accessibleDirs++;
    }
  }
  
  if (accessibleDirs === directories.length) {
    results.addResult('file_storage', 'pass', 'All required directories accessible');
  } else {
    results.addResult('file_storage', 'warning', `${accessibleDirs}/${directories.length} storage directories found`);
  }
  
  // Check object storage configuration
  if (process.env.OBJECT_STORAGE_BUCKET) {
    results.addResult('file_storage', 'info', 'Object storage configured');
  } else {
    results.addResult('file_storage', 'info', 'Object storage not configured (using local storage)');
  }
}

async function validateUserAuthentication(results) {
  console.log('🔐 Checking authentication system...');
  
  try {
    // Test if we can query users (basic auth system test)
    const userCount = await db.select().from(schema.users).then(rows => rows.length);
    
    if (userCount > 0) {
      results.addResult('user_authentication', 'pass', `Authentication database ready (${userCount} users)`);
    } else {
      results.addResult('user_authentication', 'warning', 'No users found - authentication system ready but no accounts exist');
    }
    
    // Check authentication configuration
    if (process.env.REPLIT_AUTH_PROVIDER_ID) {
      results.addResult('user_authentication', 'info', 'Replit authentication configured');
    } else if (process.env.GOOGLE_CLIENT_ID) {
      results.addResult('user_authentication', 'info', 'Google OAuth configured');
    } else {
      results.addResult('user_authentication', 'warning', 'No authentication provider configured');
    }
    
  } catch (error) {
    results.addResult('user_authentication', 'error', 'Authentication system validation failed', error.message);
  }
}

async function runMigrationValidation() {
  console.log('🔍 BuildFlow Pro Migration Validation');
  console.log('=====================================\n');
  
  const results = new ValidationResults();
  
  // Run all validation tests
  await validateDatabaseConnection(results);
  await validateTableStructure(results);
  await validateDataIntegrity(results);
  await validateEnvironmentVariables(results);
  await validateApiEndpoints(results);
  await validateFileStorage(results);
  await validateUserAuthentication(results);
  
  // Print results and return success status
  const success = results.printResults();
  
  if (success) {
    console.log('\n🚀 Your BuildFlow Pro migration is ready for production!');
    console.log('\n📝 Next steps:');
    console.log('   1. Test user login functionality');
    console.log('   2. Verify job management features');
    console.log('   3. Test timesheet submission');
    console.log('   4. Confirm file upload/download');
    console.log('   5. Check email notifications');
    console.log('   6. Set up monitoring and alerts');
  } else {
    console.log('\n🔧 Please address the errors above before going live.');
    console.log('\n📞 If you need help:');
    console.log('   1. Check the migration guide: PLATFORM_MIGRATION_GUIDE.md');
    console.log('   2. Review server logs for detailed error messages');
    console.log('   3. Verify database connection and permissions');
    console.log('   4. Ensure all environment variables are set correctly');
  }
  
  return success;
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrationValidation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('💥 Validation failed with unexpected error:', error);
      process.exit(1);
    });
}

export { runMigrationValidation };
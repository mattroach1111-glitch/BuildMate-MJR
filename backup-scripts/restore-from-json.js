#!/usr/bin/env node
/**
 * BuildFlow Pro JSON Backup Restoration Script
 * 
 * This script restores a BuildFlow Pro database from a JSON backup file.
 * Use this during emergency migrations or when SQL restoration is not available.
 */

import { readFile } from 'fs/promises';
import { db } from '../server/db.js';
import * as schema from '../shared/schema.js';

const BATCH_SIZE = 100; // Process records in batches to avoid memory issues

async function validateBackupFile(filePath) {
  console.log('📋 Validating backup file...');
  
  try {
    const backupData = JSON.parse(await readFile(filePath, 'utf-8'));
    
    if (!backupData.timestamp || !backupData.tables) {
      throw new Error('Invalid backup file format');
    }
    
    console.log(`✅ Backup file valid`);
    console.log(`📅 Created: ${backupData.timestamp}`);
    console.log(`📊 Total records: ${backupData.metadata.totalRecords}`);
    console.log(`💾 Size: ${backupData.metadata.backupSize}`);
    
    return backupData;
  } catch (error) {
    console.error('❌ Backup file validation failed:', error.message);
    process.exit(1);
  }
}

async function clearExistingData() {
  console.log('🧹 Clearing existing data...');
  
  try {
    // Delete in correct order to respect foreign key constraints
    await db.delete(schema.emailDrafts);
    await db.delete(schema.jobNotes);
    await db.delete(schema.staffNotesEntries);
    await db.delete(schema.timesheetEntries);
    await db.delete(schema.tipFees);
    await db.delete(schema.otherCosts);
    await db.delete(schema.subTrades);
    await db.delete(schema.materials);
    await db.delete(schema.laborEntries);
    await db.delete(schema.jobs);
    await db.delete(schema.staffMembers);
    await db.delete(schema.employees);
    await db.delete(schema.users);
    
    console.log('✅ Existing data cleared');
  } catch (error) {
    console.error('❌ Failed to clear existing data:', error);
    throw error;
  }
}

async function restoreTableData(tableName, records, table) {
  if (records.length === 0) {
    console.log(`⏭️ Skipping ${tableName} (no records)`);
    return;
  }
  
  console.log(`📥 Restoring ${tableName} (${records.length} records)...`);
  
  try {
    // Process in batches to avoid memory/query size issues
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      // Convert string dates back to Date objects
      const processedBatch = batch.map(record => {
        const processed = { ...record };
        
        // Convert known date fields
        if (processed.createdAt && typeof processed.createdAt === 'string') {
          processed.createdAt = new Date(processed.createdAt);
        }
        if (processed.updatedAt && typeof processed.updatedAt === 'string') {
          processed.updatedAt = new Date(processed.updatedAt);
        }
        if (processed.entryDate && typeof processed.entryDate === 'string') {
          processed.entryDate = new Date(processed.entryDate);
        }
        if (processed.noteDate && typeof processed.noteDate === 'string') {
          processed.noteDate = new Date(processed.noteDate);
        }
        
        // Convert JSON string fields back to objects
        if (processed.googleDriveTokens && typeof processed.googleDriveTokens === 'string') {
          try {
            processed.googleDriveTokens = JSON.parse(processed.googleDriveTokens);
          } catch (e) {
            processed.googleDriveTokens = null;
          }
        }
        
        if (processed.updates && typeof processed.updates === 'string') {
          try {
            processed.updates = JSON.parse(processed.updates);
          } catch (e) {
            processed.updates = [];
          }
        }
        
        return processed;
      });
      
      await db.insert(table).values(processedBatch);
      
      if (batch.length === BATCH_SIZE) {
        console.log(`   📊 Processed ${i + BATCH_SIZE}/${records.length} records`);
      }
    }
    
    console.log(`✅ ${tableName} restored successfully`);
  } catch (error) {
    console.error(`❌ Failed to restore ${tableName}:`, error);
    throw error;
  }
}

async function restoreDatabase(backupData) {
  console.log('🔄 Starting database restoration...');
  
  try {
    // Restore tables in dependency order
    await restoreTableData('users', backupData.tables.users, schema.users);
    await restoreTableData('employees', backupData.tables.employees, schema.employees);
    await restoreTableData('staffMembers', backupData.tables.staffMembers, schema.staffMembers);
    await restoreTableData('jobs', backupData.tables.jobs, schema.jobs);
    await restoreTableData('laborEntries', backupData.tables.laborEntries, schema.laborEntries);
    await restoreTableData('materials', backupData.tables.materials, schema.materials);
    await restoreTableData('subTrades', backupData.tables.subTrades, schema.subTrades);
    await restoreTableData('otherCosts', backupData.tables.otherCosts, schema.otherCosts);
    await restoreTableData('tipFees', backupData.tables.tipFees, schema.tipFees);
    await restoreTableData('timesheetEntries', backupData.tables.timesheetEntries, schema.timesheetEntries);
    await restoreTableData('staffNotesEntries', backupData.tables.staffNotesEntries, schema.staffNotesEntries);
    await restoreTableData('jobNotes', backupData.tables.jobNotes, schema.jobNotes);
    await restoreTableData('emailDrafts', backupData.tables.emailDrafts, schema.emailDrafts);
    
    console.log('✅ Database restoration completed successfully!');
  } catch (error) {
    console.error('❌ Database restoration failed:', error);
    throw error;
  }
}

async function validateRestoredData(originalData) {
  console.log('🔍 Validating restored data...');
  
  try {
    // Count records in each table
    const counts = {
      users: await db.select().from(schema.users).then(rows => rows.length),
      employees: await db.select().from(schema.employees).then(rows => rows.length),
      staffMembers: await db.select().from(schema.staffMembers).then(rows => rows.length),
      jobs: await db.select().from(schema.jobs).then(rows => rows.length),
      laborEntries: await db.select().from(schema.laborEntries).then(rows => rows.length),
      materials: await db.select().from(schema.materials).then(rows => rows.length),
      subTrades: await db.select().from(schema.subTrades).then(rows => rows.length),
      otherCosts: await db.select().from(schema.otherCosts).then(rows => rows.length),
      tipFees: await db.select().from(schema.tipFees).then(rows => rows.length),
      timesheetEntries: await db.select().from(schema.timesheetEntries).then(rows => rows.length),
      staffNotesEntries: await db.select().from(schema.staffNotesEntries).then(rows => rows.length),
      jobNotes: await db.select().from(schema.jobNotes).then(rows => rows.length),
      emailDrafts: await db.select().from(schema.emailDrafts).then(rows => rows.length),
    };
    
    console.log('📊 Record counts validation:');
    let totalRestoredRecords = 0;
    let validationErrors = 0;
    
    for (const [tableName, restoredCount] of Object.entries(counts)) {
      const originalCount = originalData.tables[tableName]?.length || 0;
      const status = restoredCount === originalCount ? '✅' : '❌';
      
      console.log(`   ${status} ${tableName}: ${restoredCount}/${originalCount}`);
      totalRestoredRecords += restoredCount;
      
      if (restoredCount !== originalCount) {
        validationErrors++;
      }
    }
    
    console.log(`📈 Total records restored: ${totalRestoredRecords}/${originalData.metadata.totalRecords}`);
    
    if (validationErrors === 0) {
      console.log('✅ Data validation passed - all records restored correctly!');
    } else {
      console.log(`⚠️ Data validation completed with ${validationErrors} discrepancies`);
    }
    
  } catch (error) {
    console.error('❌ Data validation failed:', error);
  }
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
🔄 BuildFlow Pro JSON Backup Restoration

Usage: node restore-from-json.js <backup-file.json> [--force]

Examples:
  node restore-from-json.js buildflow_backup_2025-08-18.json
  node restore-from-json.js backup.json --force

Options:
  --force    Skip confirmation prompt and clear existing data
    `);
    process.exit(1);
  }
  
  const backupFile = args[0];
  const force = args.includes('--force');
  
  console.log(`🚀 BuildFlow Pro Database Restoration`);
  console.log(`📄 Backup file: ${backupFile}`);
  console.log(`⚠️ This will replace ALL existing data in the database!`);
  
  if (!force) {
    console.log('\n❓ Are you sure you want to continue? (y/N)');
    process.stdout.write('> ');
    
    const response = await new Promise(resolve => {
      process.stdin.once('data', data => resolve(data.toString().trim()));
    });
    
    if (response.toLowerCase() !== 'y' && response.toLowerCase() !== 'yes') {
      console.log('❌ Restoration cancelled');
      process.exit(0);
    }
  }
  
  try {
    const backupData = await validateBackupFile(backupFile);
    await clearExistingData();
    await restoreDatabase(backupData);
    await validateRestoredData(backupData);
    
    console.log('\n🎉 Restoration completed successfully!');
    console.log('✅ Your BuildFlow Pro database has been restored from backup');
    
  } catch (error) {
    console.error('\n💥 Restoration failed:', error.message);
    console.error('\n🔧 Troubleshooting steps:');
    console.error('   1. Check database connection');
    console.error('   2. Verify backup file integrity');
    console.error('   3. Ensure sufficient disk space');
    console.error('   4. Check database user permissions');
    process.exit(1);
  }
  
  process.exit(0);
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️ Restoration interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⚠️ Restoration terminated');
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
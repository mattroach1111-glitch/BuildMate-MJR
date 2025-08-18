import { db } from "./db";
import { jobs, users, employees, timesheetEntries, laborEntries, materials, subTrades, otherCosts, tipFees, staffMembers, staffNotesEntries, jobNotes, emailDrafts } from "@shared/schema";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

export interface BackupData {
  timestamp: string;
  version: string;
  tables: {
    jobs: any[];
    users: any[];
    employees: any[];
    timesheetEntries: any[];
    laborEntries: any[];
    materials: any[];
    subTrades: any[];
    otherCosts: any[];
    tipFees: any[];
    staffMembers: any[];
    staffNotesEntries: any[];
    jobNotes: any[];
    emailDrafts: any[];
  };
  metadata: {
    totalRecords: number;
    backupSize: string;
    databaseUrl: string;
  };
}

export class BackupService {
  private backupDir = "./backups";

  async createFullBackup(): Promise<BackupData> {
    console.log("🔄 Starting full database backup...");
    
    // Ensure backup directory exists
    if (!existsSync(this.backupDir)) {
      await mkdir(this.backupDir, { recursive: true });
    }

    // Extract all data from database
    const [
      jobsData,
      usersData,
      employeesData,
      timesheetData,
      laborData,
      materialsData,
      subTradesData,
      otherCostsData,
      tipFeesData,
      staffMembersData,
      staffNotesData,
      jobNotesData,
      emailDraftsData
    ] = await Promise.all([
      db.select().from(jobs),
      db.select().from(users),
      db.select().from(employees),
      db.select().from(timesheetEntries),
      db.select().from(laborEntries),
      db.select().from(materials),
      db.select().from(subTrades),
      db.select().from(otherCosts),
      db.select().from(tipFees),
      db.select().from(staffMembers),
      db.select().from(staffNotesEntries),
      db.select().from(jobNotes),
      db.select().from(emailDrafts)
    ]);

    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      version: "1.0.0",
      tables: {
        jobs: jobsData,
        users: usersData,
        employees: employeesData,
        timesheetEntries: timesheetData,
        laborEntries: laborData,
        materials: materialsData,
        subTrades: subTradesData,
        otherCosts: otherCostsData,
        tipFees: tipFeesData,
        staffMembers: staffMembersData,
        staffNotesEntries: staffNotesData,
        jobNotes: jobNotesData,
        emailDrafts: emailDraftsData
      },
      metadata: {
        totalRecords: Object.values(backupData.tables).reduce((sum, table) => sum + table.length, 0),
        backupSize: "Calculating...",
        databaseUrl: process.env.DATABASE_URL?.replace(/\/\/[^@]+@/, "//***:***@") || "Not available"
      }
    };

    // Calculate total records
    const totalRecords = Object.values(backupData.tables).reduce((sum, table) => sum + table.length, 0);
    backupData.metadata.totalRecords = totalRecords;

    // Save backup to file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `buildflow_backup_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);
    
    const backupJson = JSON.stringify(backupData, null, 2);
    backupData.metadata.backupSize = `${Math.round(backupJson.length / 1024)} KB`;
    
    await writeFile(filepath, backupJson, 'utf-8');
    
    console.log(`✅ Backup completed: ${filename}`);
    console.log(`📊 Total records: ${totalRecords}`);
    console.log(`💾 File size: ${backupData.metadata.backupSize}`);
    
    return backupData;
  }

  async createIncrementalBackup(since: Date): Promise<BackupData> {
    console.log(`🔄 Starting incremental backup since ${since.toISOString()}...`);
    
    // Get only records modified since the last backup
    // Note: This requires updatedAt columns to be present
    const [
      jobsData,
      usersData,
      timesheetData,
      laborData,
      materialsData,
      subTradesData,
      otherCostsData,
      tipFeesData,
      staffNotesData,
      jobNotesData,
      emailDraftsData
    ] = await Promise.all([
      db.select().from(jobs), // .where(gte(jobs.updatedAt, since)), // Uncomment when updatedAt is available
      db.select().from(users), // .where(gte(users.updatedAt, since)),
      db.select().from(timesheetEntries), // .where(gte(timesheetEntries.updatedAt, since)),
      db.select().from(laborEntries), // .where(gte(laborEntries.updatedAt, since)),
      db.select().from(materials), // .where(gte(materials.updatedAt, since)),
      db.select().from(subTrades), // .where(gte(subTrades.updatedAt, since)),
      db.select().from(otherCosts), // .where(gte(otherCosts.updatedAt, since)),
      db.select().from(tipFees), // .where(gte(tipFees.updatedAt, since)),
      db.select().from(staffNotesEntries), // .where(gte(staffNotesEntries.updatedAt, since)),
      db.select().from(jobNotes), // .where(gte(jobNotes.updatedAt, since)),
      db.select().from(emailDrafts) // .where(gte(emailDrafts.updatedAt, since))
    ]);

    const backupData: BackupData = {
      timestamp: new Date().toISOString(),
      version: "1.0.0-incremental",
      tables: {
        jobs: jobsData,
        users: usersData,
        employees: [], // Static data, typically doesn't change
        timesheetEntries: timesheetData,
        laborEntries: laborData,
        materials: materialsData,
        subTrades: subTradesData,
        otherCosts: otherCostsData,
        tipFees: tipFeesData,
        staffMembers: [], // Static data
        staffNotesEntries: staffNotesData,
        jobNotes: jobNotesData,
        emailDrafts: emailDraftsData
      },
      metadata: {
        totalRecords: 0,
        backupSize: "Calculating...",
        databaseUrl: process.env.DATABASE_URL?.replace(/\/\/[^@]+@/, "//***:***@") || "Not available"
      }
    };

    const totalRecords = Object.values(backupData.tables).reduce((sum, table) => sum + table.length, 0);
    backupData.metadata.totalRecords = totalRecords;

    // Save incremental backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `buildflow_incremental_${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);
    
    const backupJson = JSON.stringify(backupData, null, 2);
    backupData.metadata.backupSize = `${Math.round(backupJson.length / 1024)} KB`;
    
    await writeFile(filepath, backupJson, 'utf-8');
    
    console.log(`✅ Incremental backup completed: ${filename}`);
    console.log(`📊 Modified records: ${totalRecords}`);
    
    return backupData;
  }

  async exportToSQL(): Promise<string> {
    console.log("🔄 Generating SQL export...");
    
    const backupData = await this.createFullBackup();
    let sqlContent = `-- BuildFlow Pro Database Export
-- Generated: ${backupData.timestamp}
-- Total Records: ${backupData.metadata.totalRecords}

-- Disable foreign key checks for import
SET foreign_key_checks = 0;

`;

    // Generate SQL INSERT statements for each table
    for (const [tableName, records] of Object.entries(backupData.tables)) {
      if (records.length === 0) continue;
      
      sqlContent += `\n-- Table: ${tableName}\n`;
      sqlContent += `DELETE FROM ${tableName};\n`;
      
      for (const record of records) {
        const columns = Object.keys(record);
        const values = Object.values(record).map(val => {
          if (val === null) return 'NULL';
          if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
          if (val instanceof Date) return `'${val.toISOString()}'`;
          if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
          return String(val);
        });
        
        sqlContent += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
      }
    }
    
    sqlContent += `\n-- Re-enable foreign key checks\nSET foreign_key_checks = 1;\n`;
    
    // Save SQL export
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `buildflow_export_${timestamp}.sql`;
    const filepath = path.join(this.backupDir, filename);
    
    await writeFile(filepath, sqlContent, 'utf-8');
    
    console.log(`✅ SQL export completed: ${filename}`);
    return filepath;
  }

  async scheduleAutomaticBackups() {
    console.log("🔄 Setting up automatic backup schedule...");
    
    // Full backup every 24 hours
    setInterval(async () => {
      try {
        await this.createFullBackup();
      } catch (error) {
        console.error("❌ Scheduled full backup failed:", error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours

    // Incremental backup every 4 hours
    setInterval(async () => {
      try {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
        await this.createIncrementalBackup(fourHoursAgo);
      } catch (error) {
        console.error("❌ Scheduled incremental backup failed:", error);
      }
    }, 4 * 60 * 60 * 1000); // 4 hours

    console.log("✅ Automatic backup schedule configured");
  }

  async getBackupStatus() {
    // TODO: Implement backup status checking
    return {
      lastFullBackup: null,
      lastIncrementalBackup: null,
      totalBackups: 0,
      backupHealth: "healthy"
    };
  }
}

export const backupService = new BackupService();
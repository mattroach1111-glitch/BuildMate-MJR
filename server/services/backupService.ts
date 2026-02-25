import { storage } from '../storage';
import { db } from '../db';
import { jobs, employees, users, timesheetEntries, laborEntries, materials, subTrades, otherCosts, tipFees, jobFiles } from '@shared/schema';

const BACKUP_FILE_NAME = 'MJR-BuildFlow-Live-Backup.json';
const BACKUP_FILE_ID_KEY = 'mjr_live_backup_file_id';
const DEBOUNCE_MS = 3 * 60 * 1000; // 3 minutes after last change

export class BackupService {
  private static instance: BackupService;
  private debounceTimer: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  scheduleBackup() {
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.runBackup().catch(err => console.error('Scheduled backup failed:', err));
    }, DEBOUNCE_MS);
  }

  async runBackup() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const systemTokens = await storage.getSystemGoogleDriveTokens();
      if (!systemTokens) return;

      const now = new Date();
      const jobsData = await db.select().from(jobs);
      const employeesData = await db.select().from(employees);
      const usersData = await db.select().from(users);
      const timesheetEntriesData = await db.select().from(timesheetEntries);
      const laborEntriesData = await db.select().from(laborEntries);
      const materialsData = await db.select().from(materials);
      const subTradesData = await db.select().from(subTrades);
      const otherCostsData = await db.select().from(otherCosts);
      const tipFeesData = await db.select().from(tipFees);
      const jobFilesData = await db.select().from(jobFiles);

      const exportData = {
        exportDate: now.toISOString(),
        exportType: 'MJR BuildFlow Live Backup',
        version: '1.0',
        summary: {
          jobs: jobsData.length,
          employees: employeesData.length,
          timesheetEntries: timesheetEntriesData.length,
          laborEntries: laborEntriesData.length,
          materials: materialsData.length,
          subTrades: subTradesData.length,
          otherCosts: otherCostsData.length,
          tipFees: tipFeesData.length,
        },
        data: {
          jobs: jobsData,
          employees: employeesData,
          users: usersData.map((u: any) => ({
            id: u.id, email: u.email, firstName: u.firstName,
            lastName: u.lastName, role: u.role, employeeId: u.employeeId,
          })),
          timesheetEntries: timesheetEntriesData,
          laborEntries: laborEntriesData,
          materials: materialsData,
          subTrades: subTradesData,
          otherCosts: otherCostsData,
          tipFees: tipFeesData,
          jobFiles: jobFilesData,
        }
      };

      const fileBuffer = Buffer.from(JSON.stringify(exportData, null, 2), 'utf-8');

      const { GoogleDriveService } = await import('../googleDriveService');
      const driveService = new GoogleDriveService();
      const tokens = JSON.parse(systemTokens);
      const tokenRefreshCallback = async (newTokens: any) => {
        await storage.setSystemGoogleDriveTokens(JSON.stringify(newTokens));
      };
      driveService.setUserTokens(tokens, 'system', tokenRefreshCallback);

      if (!driveService.isReady()) return;

      const existingFileId = await storage.getSystemSetting(BACKUP_FILE_ID_KEY);

      if (existingFileId?.settingValue) {
        try {
          await driveService.updateFileContent(existingFileId.settingValue, fileBuffer, 'application/json');
          console.log(`✅ MJR live backup updated in Google Drive`);
          return;
        } catch {
          console.warn('Could not update existing backup file, creating new one');
        }
      }

      const mainFolderId = await driveService.findOrCreateFolder('BuildFlow Pro');
      const backupsFolderId = await driveService.findOrCreateFolder('MJR Backups', mainFolderId);
      const result = await driveService.uploadFile(BACKUP_FILE_NAME, fileBuffer, 'application/json', backupsFolderId || undefined);
      await storage.setSystemSetting(BACKUP_FILE_ID_KEY, result.fileId);
      console.log(`✅ MJR live backup created in Google Drive: ${BACKUP_FILE_NAME}`);
    } catch (err) {
      console.error('MJR backup error:', err);
    } finally {
      this.isRunning = false;
    }
  }
}

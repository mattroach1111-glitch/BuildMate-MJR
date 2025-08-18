#!/usr/bin/env node

/**
 * BuildFlow Pro - Automated Backup Scheduler
 * Runs regular backups to protect against data loss
 */

const cron = require('node-cron');
const BuildFlowBackupSystem = require('./automated-backup');
const GoogleDriveBackup = require('./google-drive-backup');

class BackupScheduler {
  constructor() {
    this.isRunning = false;
    this.lastBackup = null;
    this.backupCount = 0;
  }

  async initialize() {
    console.log('⏰ BuildFlow Pro Backup Scheduler Starting...');
    
    // Schedule daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.executeScheduledBackup();
    });

    // Schedule weekly Google Drive backup on Sundays at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      await this.executeGoogleDriveBackup();
    });

    // Health check every hour
    cron.schedule('0 * * * *', () => {
      this.logHealthStatus();
    });

    console.log('✅ Backup scheduler initialized');
    console.log('📅 Daily backups: 2:00 AM');
    console.log('☁️ Google Drive sync: Sundays 3:00 AM');
    
    return this;
  }

  async executeScheduledBackup() {
    if (this.isRunning) {
      console.log('⚠️ Backup already in progress, skipping...');
      return;
    }

    try {
      this.isRunning = true;
      console.log('\n🚀 Starting scheduled backup...');
      
      const backup = await new BuildFlowBackupSystem().initialize();
      const result = await backup.executeFullBackup();
      
      this.lastBackup = {
        timestamp: new Date(),
        success: true,
        backupName: result.backupName,
        duration: result.duration
      };
      
      this.backupCount++;
      
      console.log(`✅ Scheduled backup #${this.backupCount} completed successfully`);
      
    } catch (error) {
      console.error('❌ Scheduled backup failed:', error);
      
      this.lastBackup = {
        timestamp: new Date(),
        success: false,
        error: error.message
      };
      
      // Send alert (implement notification system)
      await this.sendBackupAlert(error);
      
    } finally {
      this.isRunning = false;
    }
  }

  async executeGoogleDriveBackup() {
    if (!this.lastBackup || !this.lastBackup.success) {
      console.log('⚠️ No recent successful backup for Google Drive sync');
      return;
    }

    try {
      console.log('\n☁️ Starting Google Drive backup sync...');
      
      const gdBackup = await new GoogleDriveBackup().initialize();
      await gdBackup.uploadBackupSet(this.lastBackup.backupName);
      
      console.log('✅ Google Drive backup sync completed');
      
    } catch (error) {
      console.error('❌ Google Drive backup failed:', error);
      await this.sendBackupAlert(error, 'Google Drive');
    }
  }

  async sendBackupAlert(error, service = 'Local Backup') {
    // Implementation for sending alerts (email, webhook, etc.)
    console.error(`🚨 BACKUP ALERT - ${service} Failed:`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`Error: ${error.message}`);
    
    // TODO: Implement actual notification system
    // - Email notifications
    // - Webhook to monitoring service
    // - SMS alerts for critical failures
  }

  logHealthStatus() {
    console.log('\n💓 Backup System Health Check');
    console.log(`Status: ${this.isRunning ? 'RUNNING' : 'IDLE'}`);
    console.log(`Total Backups: ${this.backupCount}`);
    
    if (this.lastBackup) {
      console.log(`Last Backup: ${this.lastBackup.timestamp.toISOString()}`);
      console.log(`Last Status: ${this.lastBackup.success ? 'SUCCESS' : 'FAILED'}`);
      
      if (this.lastBackup.success) {
        console.log(`Duration: ${this.lastBackup.duration}s`);
      } else {
        console.log(`Error: ${this.lastBackup.error}`);
      }
    } else {
      console.log('No backups completed yet');
    }
    
    // Check if last backup is too old
    if (this.lastBackup) {
      const hoursSinceLastBackup = (Date.now() - this.lastBackup.timestamp) / (1000 * 60 * 60);
      if (hoursSinceLastBackup > 25) { // More than 25 hours
        console.warn(`⚠️ WARNING: Last backup was ${hoursSinceLastBackup.toFixed(1)} hours ago`);
      }
    }
  }

  // Manual backup trigger
  async triggerManualBackup() {
    console.log('🔧 Manual backup triggered');
    await this.executeScheduledBackup();
  }

  // Emergency backup (for platform migration)
  async emergencyBackup() {
    console.log('🚨 EMERGENCY BACKUP INITIATED');
    console.log('This will create an immediate backup for platform migration');
    
    try {
      const backup = await new BuildFlowBackupSystem().initialize();
      const result = await backup.executeFullBackup();
      
      // Also try to upload to Google Drive immediately
      if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
        const gdBackup = await new GoogleDriveBackup().initialize();
        await gdBackup.uploadBackupSet(result.backupName);
        console.log('☁️ Emergency backup also uploaded to Google Drive');
      }
      
      console.log('🎉 EMERGENCY BACKUP COMPLETED');
      console.log('Your data is safe and ready for migration');
      
      return result;
      
    } catch (error) {
      console.error('💥 EMERGENCY BACKUP FAILED:', error);
      throw error;
    }
  }
}

// CLI execution
if (require.main === module) {
  (async () => {
    try {
      const command = process.argv[2];
      const scheduler = new BackupScheduler();
      
      switch (command) {
        case 'start':
          await scheduler.initialize();
          console.log('🔄 Backup scheduler running... Press Ctrl+C to stop');
          // Keep process alive
          setInterval(() => {}, 1000);
          break;
          
        case 'manual':
          await scheduler.triggerManualBackup();
          break;
          
        case 'emergency':
          await scheduler.emergencyBackup();
          break;
          
        case 'health':
          scheduler.logHealthStatus();
          break;
          
        default:
          console.log('BuildFlow Pro Backup Scheduler');
          console.log('Commands:');
          console.log('  start     - Start the backup scheduler');
          console.log('  manual    - Trigger manual backup');
          console.log('  emergency - Emergency backup for migration');
          console.log('  health    - Check system health');
          break;
      }
      
      if (command !== 'start') {
        process.exit(0);
      }
      
    } catch (error) {
      console.error('Fatal error:', error);
      process.exit(1);
    }
  })();
}

module.exports = BackupScheduler;
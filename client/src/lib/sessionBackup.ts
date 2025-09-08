/**
 * Client-side session backup system
 * Provides authentication persistence when database sessions fail due to suspension
 */

export interface BackupSession {
  user: any;
  timestamp: number;
  expiresAt: number;
}

const SESSION_KEY = 'buildflow_session_backup';
const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days to match server

export class SessionBackup {
  
  /**
   * Store user session as backup in localStorage
   */
  static store(user: any): void {
    try {
      const backup: BackupSession = {
        user,
        timestamp: Date.now(),
        expiresAt: Date.now() + SESSION_DURATION
      };
      
      localStorage.setItem(SESSION_KEY, JSON.stringify(backup));
      console.log('🔄 Session backup stored successfully');
    } catch (error) {
      console.warn('⚠️ Failed to store session backup:', error);
    }
  }

  /**
   * Retrieve session backup from localStorage
   */
  static retrieve(): BackupSession | null {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (!stored) return null;

      const backup: BackupSession = JSON.parse(stored);
      
      // Check if backup has expired
      if (Date.now() > backup.expiresAt) {
        console.log('🔄 Session backup expired, removing');
        this.clear();
        return null;
      }

      console.log('🔄 Session backup retrieved successfully');
      return backup;
    } catch (error) {
      console.warn('⚠️ Failed to retrieve session backup:', error);
      this.clear(); // Clear corrupted backup
      return null;
    }
  }

  /**
   * Clear session backup from localStorage
   */
  static clear(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
      console.log('🔄 Session backup cleared');
    } catch (error) {
      console.warn('⚠️ Failed to clear session backup:', error);
    }
  }

  /**
   * Check if a backup session exists and is valid
   */
  static hasValidBackup(): boolean {
    const backup = this.retrieve();
    return backup !== null;
  }

  /**
   * Attempt to restore server session using backup data
   */
  static async attemptRestore(): Promise<boolean> {
    const backup = this.retrieve();
    if (!backup) return false;

    try {
      // Try to refresh the server session
      const response = await fetch('/api/auth/restore-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
      });

      if (response.ok) {
        console.log('🔄 Server session restored successfully');
        return true;
      } else {
        console.log('🔄 Server session restore failed, using backup');
        return false;
      }
    } catch (error) {
      console.warn('⚠️ Session restore failed:', error);
      return false;
    }
  }
}
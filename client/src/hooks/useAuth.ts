import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SessionBackup } from "@/lib/sessionBackup";

export function useAuth() {
  const [backupUser, setBackupUser] = useState<any>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);
  const [initialBackupCheck, setInitialBackupCheck] = useState(false);

  // Check for backup session immediately on mount
  useEffect(() => {
    if (!initialBackupCheck) {
      const backup = SessionBackup.retrieve();
      if (backup && backup.user) {
        console.log('🔄 Initial backup check - using backup session immediately');
        setBackupUser(backup.user);
      }
      setInitialBackupCheck(true);
    }
  }, [initialBackupCheck]);

  const { data: user, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Reduce stale time to refresh user role changes more quickly
    staleTime: 30000, // 30 seconds instead of Infinity
    // Handle errors gracefully
    throwOnError: false,
    // Don't make the query if we're already using backup
    enabled: !backupUser,
  });

  // Handle successful authentication - store backup
  useEffect(() => {
    if (user && !error) {
      SessionBackup.store(user);
      setBackupUser(null); // Clear backup since we have server session
    }
  }, [user, error]);

  // Handle authentication failure - check for backup
  useEffect(() => {
    if (error && !user && !isLoading && !isRestoringSession && !backupUser) {
      const backup = SessionBackup.retrieve();
      if (backup) {
        console.log('🔄 Server auth failed, using backup session immediately');
        setBackupUser(backup.user);
        
        // Still attempt restore in background, but don't block user experience
        setIsRestoringSession(true);
        SessionBackup.attemptRestore().then((restored) => {
          if (restored) {
            console.log('🔄 Server session restored, switching back to server auth');
            setBackupUser(null); // Clear backup, server session is working
            refetch();
          } else {
            console.log('🔄 Server restore failed, continuing with backup');
          }
          setIsRestoringSession(false);
        }).catch((err) => {
          console.warn('🔄 Session restore error:', err);
          setIsRestoringSession(false);
        });
      }
    }
  }, [error, user, isLoading, isRestoringSession, refetch, backupUser]);

  // Determine current user (server or backup)
  const currentUser = user || backupUser;
  // If we have backup user, we're authenticated regardless of server error
  const currentIsAuthenticated = !!backupUser || (!!user && !error);
  
  // Log current authentication state for debugging
  if (backupUser && !user) {
    console.log('🔄 Using backup authentication for user:', backupUser.firstName || backupUser.email);
  }
  
  return {
    user: currentUser,
    isLoading: isLoading && !backupUser, // Don't show loading if backup is available
    isAuthenticated: currentIsAuthenticated,
    refetch, // Expose refetch for manual role updates
    isUsingBackup: !!backupUser && !user, // Indicates fallback mode
  };
}

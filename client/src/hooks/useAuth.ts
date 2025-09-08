import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SessionBackup } from "@/lib/sessionBackup";

export function useAuth() {
  const [backupUser, setBackupUser] = useState<any>(null);
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  const { data: user, isLoading, refetch, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    // Reduce stale time to refresh user role changes more quickly
    staleTime: 30000, // 30 seconds instead of Infinity
    // Handle errors gracefully
    throwOnError: false,
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
    if (error && !user && !isLoading && !isRestoringSession) {
      const backup = SessionBackup.retrieve();
      if (backup) {
        console.log('🔄 Server auth failed, attempting session restore...');
        setIsRestoringSession(true);
        
        SessionBackup.attemptRestore().then((restored) => {
          if (restored) {
            // Server session restored, refetch user data
            refetch();
          } else {
            // Use backup session as fallback
            console.log('🔄 Using backup session');
            setBackupUser(backup.user);
          }
          setIsRestoringSession(false);
        }).catch(() => {
          // Restore failed, use backup
          setBackupUser(backup.user);
          setIsRestoringSession(false);
        });
      }
    }
  }, [error, user, isLoading, isRestoringSession, refetch]);

  // Determine current user (server or backup)
  const currentUser = user || backupUser;
  const currentIsAuthenticated = !!currentUser && (!error || !!backupUser);
  
  return {
    user: currentUser,
    isLoading: isLoading || isRestoringSession,
    isAuthenticated: currentIsAuthenticated,
    refetch, // Expose refetch for manual role updates
    isUsingBackup: !!backupUser && !user, // Indicates fallback mode
  };
}

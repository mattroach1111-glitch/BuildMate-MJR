import { useEffect, useRef } from 'react';

export function useSessionKeepalive() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const keepalive = async () => {
      try {
        const response = await fetch('/api/auth/keepalive', {
          method: 'POST',
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.refreshed) {
            console.log('💓 Session keepalive - token refreshed successfully');
          } else {
            console.log('💓 Session keepalive successful');
          }
        } else {
          const data = await response.json().catch(() => ({}));
          
          if (data.requiresLogin) {
            console.log('💓 Session expired - redirecting to login');
            // Clear any session backup
            localStorage.removeItem('session_backup');
            // Redirect to login
            window.location.href = '/api/login';
          } else {
            console.log('💓 Session keepalive failed:', data.reason || 'unknown');
          }
        }
      } catch (error) {
        console.error('💓 Session keepalive error:', error);
      }
    };

    // Call keepalive immediately on mount
    keepalive();

    // Then call every 10 minutes (600000 ms)
    intervalRef.current = setInterval(keepalive, 10 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

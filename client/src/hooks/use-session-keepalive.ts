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
          // Keepalive returned non-200 — but the session (90-day DB cookie) may
          // still be valid.  Only redirect if the server says it has NO session at
          // all (401 with reason 'not_authenticated'), meaning the cookie itself
          // is gone (e.g. user cleared cookies, or 90-day TTL actually expired).
          // A failed token refresh is NOT a reason to boot the user out.
          const data = await response.json().catch(() => ({}));
          if (response.status === 401 && data.reason === 'not_authenticated') {
            console.log('💓 No active session found - redirecting to login');
            localStorage.removeItem('session_backup');
            window.location.href = '/api/login';
          } else {
            console.log('💓 Session keepalive non-critical issue:', data.reason || response.status);
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

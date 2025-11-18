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
          console.log('💓 Session keepalive successful');
        } else {
          console.log('💓 Session keepalive failed - user may need to re-login');
        }
      } catch (error) {
        console.error('💓 Session keepalive error:', error);
      }
    };

    // Call keepalive immediately on mount
    keepalive();

    // Then call every 30 minutes (1800000 ms)
    intervalRef.current = setInterval(keepalive, 30 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);
}

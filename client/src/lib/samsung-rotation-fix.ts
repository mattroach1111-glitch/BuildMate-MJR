// Samsung Internet PWA Rotation Fix
export function initSamsungRotationFix() {
  // Only run on Samsung Internet
  const isSamsungInternet = /SamsungBrowser/.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  if (!isSamsungInternet || !isStandalone) {
    return;
  }

  console.log('Initializing Samsung Internet rotation fix');

  // Force enable screen orientation
  const screen = window.screen as any;
  
  // Try to unlock orientation if available
  if (screen.orientation && screen.orientation.unlock) {
    screen.orientation.unlock().catch(() => {
      console.log('Could not unlock screen orientation');
    });
  }

  // Handle orientation change events
  const handleOrientationChange = () => {
    // Force a layout recalculation
    const body = document.body;
    body.style.display = 'none';
    body.offsetHeight; // Trigger reflow
    body.style.display = '';
    
    // Dispatch resize event to ensure components update
    window.dispatchEvent(new Event('resize'));
  };

  // Listen for orientation changes
  if (screen.orientation) {
    screen.orientation.addEventListener('change', handleOrientationChange);
  } else {
    // Fallback for older devices
    window.addEventListener('orientationchange', handleOrientationChange);
  }

  // Also handle window resize as a fallback
  let resizeTimeout: NodeJS.Timeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(handleOrientationChange, 100);
  });

  // Initial setup
  setTimeout(handleOrientationChange, 1000);
}

// Auto-initialize when module is imported
if (typeof window !== 'undefined') {
  document.addEventListener('DOMContentLoaded', initSamsungRotationFix);
}
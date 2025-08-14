import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, X, Smartphone } from 'lucide-react';
import { pwaService } from '@/lib/pwa';

export function InstallPWABanner() {
  const [canInstall, setCanInstall] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app can be installed
    const checkInstall = () => {
      const canInstallApp = pwaService.canInstall();
      const isAppInstalled = pwaService.isAppInstalled();
      
      setCanInstall(canInstallApp);
      setIsInstalled(isAppInstalled);
      setIsVisible(canInstallApp && !isAppInstalled);
    };

    checkInstall();

    // Re-check periodically
    const interval = setInterval(checkInstall, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleInstall = async () => {
    setIsInstalling(true);
    try {
      const installed = await pwaService.showInstallPrompt();
      if (installed) {
        setIsVisible(false);
        setIsInstalled(true);
      }
    } catch (error) {
      console.error('Error installing PWA:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    // Hide for this session
    sessionStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Don't show if already dismissed this session
  if (sessionStorage.getItem('pwa-banner-dismissed') || !isVisible || isInstalled) {
    return null;
  }

  return (
    <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
      <Smartphone className="h-4 w-4 text-green-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <strong className="text-green-800 dark:text-green-200">Install BuildFlow Pro</strong>
          <p className="text-sm text-green-700 dark:text-green-300 mt-1">
            Install the app on your phone for easier access. Works offline and gets better notifications.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="button-install-pwa"
          >
            <Download className="h-4 w-4 mr-1" />
            {isInstalling ? 'Installing...' : 'Install'}
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="text-green-600 hover:text-green-800"
            data-testid="button-dismiss-pwa"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bell, X } from 'lucide-react';
// import { pushNotificationService } from '@/lib/pushNotifications';

export function NotificationPermissionBanner() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isVisible, setIsVisible] = useState(false);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    // const currentPermission = pushNotificationService.getPermission();
    const currentPermission = Notification.permission;
    setPermission(currentPermission);
    
    // Show banner if notifications are supported but not granted
    setIsVisible(
      'Notification' in window && 
      currentPermission === 'default'
    );
  }, []);

  const handleEnableNotifications = async () => {
    setIsRequesting(true);
    try {
      // const result = await pushNotificationService.requestPermission();
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setIsVisible(false);
        // Show a test notification
        new Notification('Notifications Enabled!', {
          body: 'You will now receive timesheet reminders and important messages.',
        });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsRequesting(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible || permission === 'granted') {
    return null;
  }

  return (
    <Alert className="mb-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <Bell className="h-4 w-4 text-blue-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex-1">
          <strong className="text-blue-800 dark:text-blue-200">Enable Push Notifications</strong>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Get timesheet reminders and important messages directly in your browser, even when you're on other tabs.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <Button
            onClick={handleEnableNotifications}
            disabled={isRequesting}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isRequesting ? 'Enabling...' : 'Enable'}
          </Button>
          <Button
            onClick={handleDismiss}
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
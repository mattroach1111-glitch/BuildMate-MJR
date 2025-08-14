import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Monitor, Bell, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { notificationService } from '@/lib/notifications';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
}

export function DesktopNotificationTest() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const runDesktopTest = async () => {
    setTesting(true);
    setResults([]);
    
    const testResults: TestResult[] = [];
    
    // Test 1: Browser Support
    try {
      const isSupported = notificationService.isSupported();
      testResults.push({
        step: 'Browser Support Check',
        success: isSupported,
        message: isSupported 
          ? 'Browser supports notifications and service workers' 
          : 'Browser missing Notification API, Service Worker, or Push Manager'
      });
    } catch (error) {
      testResults.push({
        step: 'Browser Support Check',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    // Test 2: Permission Request
    try {
      const permission = await notificationService.requestPermission();
      testResults.push({
        step: 'Permission Request',
        success: permission === 'granted',
        message: `Permission: ${permission}`
      });
    } catch (error) {
      testResults.push({
        step: 'Permission Request',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    // Test 3: Basic Notification
    try {
      if (notificationService.getPermission() === 'granted') {
        notificationService.showNotification('Desktop Test', {
          body: 'This is a test notification for desktop browsers',
          tag: 'desktop-test'
        });
        testResults.push({
          step: 'Basic Notification',
          success: true,
          message: 'Test notification sent (should appear now)'
        });
      } else {
        testResults.push({
          step: 'Basic Notification',
          success: false,
          message: 'Skipped - no permission granted'
        });
      }
    } catch (error) {
      testResults.push({
        step: 'Basic Notification',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    // Test 4: Push Registration
    try {
      const pushSuccess = await notificationService.registerForPush();
      testResults.push({
        step: 'Push Registration',
        success: pushSuccess,
        message: pushSuccess 
          ? 'Successfully registered for push notifications' 
          : 'Failed to register for push notifications (check console for details)'
      });
      
      // Test 5: Check if subscription was saved to server
      if (pushSuccess) {
        try {
          const response = await fetch('/api/push-subscription-test');
          const result = await response.json();
          testResults.push({
            step: 'Server Subscription Check',
            success: result.hasSubscription,
            message: result.hasSubscription 
              ? `Found ${result.count} push subscription(s) in database`
              : 'No push subscriptions found in database'
          });
        } catch (error) {
          testResults.push({
            step: 'Server Subscription Check',
            success: false,
            message: `Error checking server: ${error.message}`
          });
        }
      }
    } catch (error) {
      testResults.push({
        step: 'Push Registration',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    setResults(testResults);
    setTesting(false);
  };

  const getIcon = (success: boolean) => {
    return success ? (
      <CheckCircle className="h-4 w-4 text-green-600" />
    ) : (
      <XCircle className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Desktop Notification Test</h3>
      </div>
      
      <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <AlertTriangle className="h-4 w-4 text-blue-600" />
        <AlertDescription>
          This test helps diagnose notification issues on desktop browsers. 
          Desktop browsers often have stricter notification policies than mobile.
        </AlertDescription>
      </Alert>

      <Button 
        onClick={runDesktopTest} 
        disabled={testing}
        className="w-full"
        data-testid="button-run-desktop-test"
      >
        <Bell className="h-4 w-4 mr-2" />
        {testing ? 'Running Tests...' : 'Run Desktop Notification Test'}
      </Button>

      {results.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium">Test Results:</h4>
          {results.map((result, index) => (
            <div 
              key={index} 
              className="flex items-start gap-2 p-2 border rounded-md"
              data-testid={`test-result-${index}`}
            >
              {getIcon(result.success)}
              <div className="flex-1">
                <div className="font-medium text-sm">{result.step}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  {result.message}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Alert className="border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950">
        <AlertTriangle className="h-4 w-4 text-gray-600" />
        <AlertDescription className="text-sm">
          <strong>Desktop Tips:</strong>
          <ul className="mt-1 ml-4 list-disc space-y-1">
            <li>Chrome/Edge: Notifications work best when site is "installed" as PWA</li>
            <li>Firefox: May require manual permission via address bar icon</li>
            <li>Safari: Limited push notification support on macOS</li>
            <li>Some corporate networks block push notification servers</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
}
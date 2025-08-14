import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { notificationService } from '@/lib/notifications';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
}

export function MobileNotificationTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  const runMobileTest = async () => {
    setIsRunning(true);
    setTestResults([]);
    const testResults: TestResult[] = [];

    // Test 1: Browser Detection
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    testResults.push({
      step: 'Mobile Browser Detection',
      success: isMobile,
      message: isMobile 
        ? `Mobile browser detected: ${navigator.userAgent.substring(0, 50)}...`
        : `Desktop browser detected: ${navigator.userAgent.substring(0, 50)}...`
    });

    // Test 2: Service Worker Support
    const hasServiceWorker = 'serviceWorker' in navigator;
    testResults.push({
      step: 'Service Worker Support',
      success: hasServiceWorker,
      message: hasServiceWorker 
        ? 'Service Worker API is supported'
        : 'Service Worker API is not supported'
    });

    // Test 3: Push Manager Support
    const hasPushManager = hasServiceWorker && 'PushManager' in window;
    testResults.push({
      step: 'Push Manager Support',
      success: hasPushManager,
      message: hasPushManager 
        ? 'Push Manager API is supported'
        : 'Push Manager API is not supported'
    });

    // Test 4: Service Worker Registration
    if (hasServiceWorker) {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        testResults.push({
          step: 'Service Worker Registration',
          success: !!registration,
          message: registration 
            ? `Service Worker registered: ${registration.scope}`
            : 'No active Service Worker registration found'
        });
      } catch (error) {
        testResults.push({
          step: 'Service Worker Registration',
          success: false,
          message: `Error: ${error.message}`
        });
      }
    }

    // Test 5: Notification Permission
    try {
      const permission = await notificationService.requestPermission();
      testResults.push({
        step: 'Notification Permission',
        success: permission === 'granted',
        message: `Permission status: ${permission}`
      });
    } catch (error) {
      testResults.push({
        step: 'Notification Permission',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    // Test 6: Mobile Push Registration
    try {
      console.log('Starting mobile push registration...');
      const pushSuccess = await notificationService.registerForPush();
      testResults.push({
        step: 'Mobile Push Registration',
        success: pushSuccess,
        message: pushSuccess 
          ? 'Successfully registered for push notifications on mobile' 
          : 'Failed to register for push notifications on mobile'
      });
      
      // Test 7: Server Subscription Check
      if (pushSuccess) {
        try {
          const response = await fetch('/api/push-subscription-test');
          const result = await response.json();
          testResults.push({
            step: 'Server Subscription Check',
            success: result.hasSubscription,
            message: result.hasSubscription 
              ? `Found ${result.count} push subscription(s) in database`
              : 'No push subscriptions found in database - registration may have failed'
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
        step: 'Mobile Push Registration',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    // Test 8: Mobile Test Notification
    try {
      const testSuccess = await notificationService.sendTestNotification();
      testResults.push({
        step: 'Mobile Test Notification',
        success: testSuccess,
        message: testSuccess 
          ? 'Test notification sent successfully'
          : 'Failed to send test notification'
      });
    } catch (error) {
      testResults.push({
        step: 'Mobile Test Notification',
        success: false,
        message: `Error: ${error.message}`
      });
    }

    setTestResults(testResults);
    setIsRunning(false);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Mobile Push Notification Test</CardTitle>
        <CardDescription>
          Comprehensive test for mobile push notification functionality
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runMobileTest} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? 'Running Mobile Test...' : 'Run Mobile Notification Test'}
        </Button>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-semibold">Test Results:</h4>
            {testResults.map((result, index) => (
              <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                <Badge variant={result.success ? "default" : "destructive"}>
                  {result.success ? "✓" : "✗"}
                </Badge>
                <div className="flex-1">
                  <div className="font-medium">{result.step}</div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {result.message}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
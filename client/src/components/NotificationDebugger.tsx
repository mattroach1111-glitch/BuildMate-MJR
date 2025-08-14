import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, XCircle, AlertTriangle, TestTube, Smartphone } from 'lucide-react';
import { notificationService } from '@/lib/notifications';

export function NotificationDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);

  const runDiagnostics = async () => {
    setIsRunning(true);
    const info: any = {
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
      serviceWorkerSupport: 'serviceWorker' in navigator,
      notificationSupport: 'Notification' in window,
      pushSupport: 'PushManager' in window,
      currentPermission: Notification.permission,
      serviceWorkerRegistration: null,
      serviceWorkerState: null,
      registrationError: null,
      permissionError: null,
      testNotificationResult: null
    };

    // Check service worker
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        if (registration) {
          info.serviceWorkerRegistration = 'found';
          info.serviceWorkerState = registration.active?.state || 'not-active';
        } else {
          info.serviceWorkerRegistration = 'not-found';
          // Try to register
          try {
            const newReg = await navigator.serviceWorker.register('/sw.js');
            info.serviceWorkerRegistration = 'newly-registered';
            info.serviceWorkerState = newReg.installing?.state || 'installing';
          } catch (regError: any) {
            info.registrationError = regError?.message || String(regError);
          }
        }
      } catch (error: any) {
        info.registrationError = error?.message || String(error);
      }
    }

    // Test permission request
    if ('Notification' in window) {
      try {
        const permission = await notificationService.requestPermission();
        info.permissionRequestResult = permission;
      } catch (error: any) {
        info.permissionError = error?.message || String(error);
      }
    }

    // Test notification
    try {
      const testResult = await notificationService.sendTestNotification();
      info.testNotificationResult = testResult ? 'success' : 'failed';
    } catch (error: any) {
      info.testNotificationResult = `error: ${error?.message || String(error)}`;
    }

    setDebugInfo(info);
    setIsRunning(false);
  };

  const getStatusIcon = (condition: boolean) => {
    return condition ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  const getPermissionBadge = (permission: string) => {
    const colors = {
      granted: 'bg-green-100 text-green-800',
      denied: 'bg-red-100 text-red-800',
      default: 'bg-yellow-100 text-yellow-800'
    };
    return (
      <Badge className={colors[permission as keyof typeof colors] || colors.default}>
        {permission}
      </Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Notification System Diagnostics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics}
          disabled={isRunning}
          className="w-full"
          data-testid="button-run-diagnostics"
        >
          <TestTube className="h-4 w-4 mr-2" />
          {isRunning ? 'Running Diagnostics...' : 'Run Full Diagnostics'}
        </Button>

        {debugInfo && (
          <div className="space-y-4">
            <Separator />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Browser Support</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Service Worker</span>
                    {getStatusIcon(debugInfo.serviceWorkerSupport)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Notifications</span>
                    {getStatusIcon(debugInfo.notificationSupport)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Push Manager</span>
                    {getStatusIcon(debugInfo.pushSupport)}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Current Status</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span>Permission</span>
                    {getPermissionBadge(debugInfo.currentPermission)}
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Service Worker</span>
                    <Badge variant="outline">{debugInfo.serviceWorkerRegistration}</Badge>
                  </div>
                  {debugInfo.serviceWorkerState && (
                    <div className="flex items-center justify-between">
                      <span>SW State</span>
                      <Badge variant="outline">{debugInfo.serviceWorkerState}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {debugInfo.testNotificationResult && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Test Notification Result</span>
                </div>
                <div className="mt-2 text-sm text-blue-700">
                  Result: <Badge className="bg-blue-100 text-blue-800">{debugInfo.testNotificationResult}</Badge>
                </div>
              </div>
            )}

            {(debugInfo.registrationError || debugInfo.permissionError) && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-800">Errors Detected</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-red-700">
                  {debugInfo.registrationError && (
                    <div>Registration: {debugInfo.registrationError}</div>
                  )}
                  {debugInfo.permissionError && (
                    <div>Permission: {debugInfo.permissionError}</div>
                  )}
                </div>
              </div>
            )}

            <details className="text-xs text-gray-500">
              <summary className="cursor-pointer font-medium">Raw Debug Data</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {JSON.stringify(debugInfo, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
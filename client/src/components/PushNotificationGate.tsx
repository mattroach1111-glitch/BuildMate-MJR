import { ReactNode } from 'react';
import { Bell, BellOff, Smartphone, Share, Plus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface PushNotificationGateProps {
  children: ReactNode;
}

/**
 * Hard-block wrapper for the staff timesheet page. Children only render once
 * the user has enabled push notifications. iOS users must install the PWA first
 * because Safari only allows web push from installed PWAs.
 */
export function PushNotificationGate({ children }: PushNotificationGateProps) {
  const {
    permission,
    isSubscribed,
    isWorking,
    subscribe,
    iosNeedsInstall,
    isIOS,
  } = usePushNotifications();

  // Still detecting subscription state
  if (isSubscribed === null && permission !== 'unsupported' && !iosNeedsInstall) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Already subscribed → let them through
  if (isSubscribed) {
    return <>{children}</>;
  }

  // iOS but not installed as PWA - show install instructions
  if (iosNeedsInstall) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full" data-testid="push-gate-ios-install">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-blue-600" />
              <CardTitle>Install BuildFlow Pro</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Install required</AlertTitle>
              <AlertDescription>
                To use the timesheet on iPhone or iPad, you must add BuildFlow Pro
                to your home screen. This lets you receive timesheet reminders.
              </AlertDescription>
            </Alert>

            <div className="space-y-3 pt-2">
              <p className="font-semibold">How to install:</p>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">1</div>
                <p className="text-sm">
                  Tap the <Share className="inline h-4 w-4 mx-1" /> Share button at the bottom of Safari.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">2</div>
                <p className="text-sm">
                  Scroll and tap <Plus className="inline h-4 w-4 mx-1" /> <strong>Add to Home Screen</strong>.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold">3</div>
                <p className="text-sm">
                  Open BuildFlow Pro from your home screen and come back to this page.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Browser doesn't support push at all
  if (permission === 'unsupported') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full" data-testid="push-gate-unsupported">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BellOff className="h-8 w-8 text-red-600" />
              <CardTitle>Browser not supported</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your browser doesn't support notifications. Please open BuildFlow Pro
                in Chrome, Edge, Safari (16.4+) or Firefox to use the timesheet.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Permission denied - user blocked it in browser
  if (permission === 'denied') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full" data-testid="push-gate-denied">
          <CardHeader>
            <div className="flex items-center gap-3">
              <BellOff className="h-8 w-8 text-red-600" />
              <CardTitle>Notifications are blocked</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Action needed</AlertTitle>
              <AlertDescription>
                You previously blocked notifications for BuildFlow Pro. To use the
                timesheet, you need to allow notifications in your browser settings.
              </AlertDescription>
            </Alert>

            <div className="space-y-2 text-sm">
              <p className="font-semibold">How to enable on {isIOS ? 'iPhone/iPad' : 'desktop'}:</p>
              {isIOS ? (
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Open Settings on your device</li>
                  <li>Scroll down and tap Notifications</li>
                  <li>Find BuildFlow Pro and tap it</li>
                  <li>Turn on Allow Notifications, then come back</li>
                </ol>
              ) : (
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Click the lock icon in the address bar</li>
                  <li>Find Notifications and change it to "Allow"</li>
                  <li>Reload this page</li>
                </ol>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => window.location.reload()}
              data-testid="button-push-reload"
            >
              I've enabled notifications - reload
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Default state - prompt the user to enable
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full" data-testid="push-gate-prompt">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Bell className="h-8 w-8 text-blue-600" />
            <CardTitle>Enable Timesheet Reminders</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Required to use timesheets</AlertTitle>
            <AlertDescription>
              Before you can fill out your timesheet, you need to enable notifications
              so the office can remind you on Friday afternoons. This is required for all
              staff.
            </AlertDescription>
          </Alert>

          <div className="text-sm text-gray-600 space-y-1">
            <p>You'll receive a notification:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Every Friday at 4pm to remind you to submit your timesheet</li>
              <li>Occasionally from admin when something needs your attention</li>
            </ul>
          </div>

          <Button
            className="w-full"
            size="lg"
            onClick={subscribe}
            disabled={isWorking}
            data-testid="button-enable-push"
          >
            {isWorking ? 'Enabling...' : 'Enable Notifications'}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Your browser will ask for permission. Tap "Allow" to continue.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

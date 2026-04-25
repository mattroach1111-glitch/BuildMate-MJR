import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Bell, BellRing, Send, BellOff, Smartphone, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

/**
 * Bell icon for the header. Opens a popover showing push notification status
 * with quick actions to enable, disable, or send a test notification.
 */
export function NotificationsBell() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const {
    permission,
    isSubscribed,
    isWorking,
    subscribe,
    unsubscribe,
    iosNeedsInstall,
    isIOS,
  } = usePushNotifications();

  const testMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/push/test', {}),
    onSuccess: async (res: any) => {
      const json = await res.json();
      if (json.sent > 0) {
        toast({
          title: 'Test notification sent',
          description: 'Check your notification tray on this device.',
        });
      } else {
        toast({
          title: 'No active subscriptions',
          description: 'Enable notifications on this device first.',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({
        title: 'Test failed',
        description: 'Could not send test notification.',
        variant: 'destructive',
      });
    },
  });

  // Choose bell icon variant based on state
  const BellIcon = isSubscribed ? BellRing : Bell;
  const iconColor = isSubscribed ? 'text-blue-600' : 'text-gray-500';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 rounded-full p-0"
          aria-label="Notifications"
          data-testid="button-notifications-bell"
        >
          <BellIcon className={`h-5 w-5 ${iconColor}`} />
          {isSubscribed && (
            <span
              className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white"
              aria-label="Notifications enabled"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="popover-notifications">
        <div className="p-4">
          <h3 className="font-semibold text-base">Notifications</h3>
          <p className="text-sm text-muted-foreground">
            {isSubscribed ? "You're all set" : 'Get reminders on this device'}
          </p>
        </div>

        <Separator />

        <div className="p-4 space-y-3">
          {/* Status indicator */}
          {iosNeedsInstall ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-amber-900">Install required on iPhone/iPad</p>
                <p className="text-xs text-amber-800 mt-1">
                  Tap the Share button in Safari, then "Add to Home Screen". Open BuildFlow Pro
                  from the home screen and come back here.
                </p>
              </div>
            </div>
          ) : permission === 'unsupported' ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-red-700">
                This browser doesn't support notifications. Try Chrome, Edge, Safari (16.4+) or Firefox.
              </p>
            </div>
          ) : permission === 'denied' ? (
            <div className="flex items-start gap-2 text-sm">
              <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-700">Notifications blocked</p>
                <p className="text-xs text-red-600 mt-1">
                  {isIOS
                    ? 'Open Settings → Notifications → BuildFlow Pro and turn on Allow Notifications.'
                    : 'Click the lock icon in the address bar and set Notifications to "Allow".'}
                </p>
              </div>
            </div>
          ) : isSubscribed ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <span className="text-gray-700">Push notifications are on for this device.</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
              <span className="text-gray-700">Push notifications are off for this device.</span>
            </div>
          )}

          {/* Action buttons */}
          {isSubscribed && (
            <>
              <Button
                className="w-full"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                data-testid="button-send-test-push"
              >
                <Send className="h-4 w-4 mr-2" />
                {testMutation.isPending ? 'Sending...' : 'Send me a test reminder now'}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={async () => {
                  await unsubscribe();
                  toast({ title: 'Notifications turned off on this device' });
                }}
                disabled={isWorking}
                data-testid="button-turn-off-push"
              >
                <BellOff className="h-4 w-4 mr-2" />
                {isWorking ? 'Working...' : 'Turn off push notifications'}
              </Button>
            </>
          )}

          {!isSubscribed && permission !== 'denied' && permission !== 'unsupported' && !iosNeedsInstall && (
            <Button
              className="w-full"
              onClick={async () => {
                const ok = await subscribe();
                if (ok) toast({ title: 'Notifications enabled on this device' });
              }}
              disabled={isWorking}
              data-testid="button-turn-on-push"
            >
              <Bell className="h-4 w-4 mr-2" />
              {isWorking ? 'Working...' : 'Turn on push notifications'}
            </Button>
          )}

          {(permission === 'denied') && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.location.reload()}
              data-testid="button-reload-after-permission"
            >
              I've enabled it - reload
            </Button>
          )}
        </div>

        <Separator />

        <div className="p-3 bg-gray-50 rounded-b-md">
          <div className="flex items-start gap-2 text-xs text-gray-600">
            <Smartphone className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
            <p>
              You'll need to enable this on each device you use (phone, laptop, etc.). Friday
              4pm timesheet reminders are automatic.
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

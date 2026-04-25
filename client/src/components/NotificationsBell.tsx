import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Bell, BellRing, Send, BellOff, Smartphone, AlertCircle, Trash2, CheckCheck, Inbox } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  scheduledFor: string;
  createdAt: string;
  dismissedAt: string | null;
}

/**
 * Bell icon for the header. Opens a popover showing:
 * 1. A feed of recent notifications (mark read / dismiss)
 * 2. Push notification status with quick controls (enable/disable/test)
 */
export function NotificationsBell() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const {
    permission,
    isSubscribed,
    isWorking,
    subscribe,
    unsubscribe,
    iosNeedsInstall,
    isIOS,
  } = usePushNotifications();

  // Fetch notification feed (refresh every 30 seconds while popover is open)
  const { data: notifications = [] } = useQuery<NotificationItem[]>({
    queryKey: ['/api/notifications'],
    refetchInterval: open ? 30000 : 60000 * 2,
  });

  // Filter out dismissed notifications and take the most recent 20
  const visibleNotifications = notifications
    .filter(n => !n.dismissedAt)
    .slice(0, 20);
  const unreadCount = visibleNotifications.filter(n => !n.read).length;

  const markReadMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('PATCH', `/api/notifications/${id}/read`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('PATCH', `/api/notifications/${id}/dismiss`, {}),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = visibleNotifications.filter(n => !n.read);
      await Promise.all(unread.map(n => apiRequest('PATCH', `/api/notifications/${n.id}/read`, {})));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/notifications'] }),
  });

  const testMutation = useMutation({
    mutationFn: async () => apiRequest('POST', '/api/push/test', {}),
    onSuccess: async (res: any) => {
      const json = await res.json();
      if (json.sent > 0) {
        toast({ title: 'Test sent', description: 'Check your notification tray.' });
      } else {
        toast({
          title: 'No active subscriptions',
          description: 'Enable notifications on this device first.',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({ title: 'Test failed', variant: 'destructive' });
    },
  });

  const formatTime = (iso: string) => {
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return '';
    }
  };

  const BellIcon = unreadCount > 0 || isSubscribed ? BellRing : Bell;
  const iconColor = unreadCount > 0 ? 'text-blue-600' : isSubscribed ? 'text-blue-600' : 'text-gray-500';

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setShowSettings(false); }}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-10 w-10 rounded-full p-0"
          aria-label="Notifications"
          data-testid="button-notifications-bell"
        >
          <BellIcon className={`h-5 w-5 ${iconColor}`} />
          {unreadCount > 0 ? (
            <span
              className="absolute -top-0.5 -right-0.5 h-5 min-w-[20px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white"
              data-testid="badge-unread-count"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : isSubscribed ? (
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-green-500 ring-2 ring-white" />
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0" data-testid="popover-notifications">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-base">Notifications</h3>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : visibleNotifications.length === 0
                  ? "You're all caught up"
                  : 'All caught up'}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Notification feed */}
        {visibleNotifications.length === 0 ? (
          <div className="px-4 py-10 flex flex-col items-center justify-center text-center">
            <Inbox className="h-10 w-10 text-gray-300 mb-2" />
            <p className="text-sm font-medium text-gray-700">No notifications yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-[240px]">
              Reminders and admin messages will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[320px]">
            <div className="divide-y">
              {visibleNotifications.map(n => (
                <div
                  key={n.id}
                  className={`p-3 flex gap-3 group hover:bg-gray-50 ${
                    !n.read ? 'bg-blue-50/40' : ''
                  }`}
                  data-testid={`notification-item-${n.id}`}
                >
                  <div className="flex-shrink-0 pt-1">
                    {!n.read ? (
                      <span className="block h-2 w-2 rounded-full bg-blue-600" />
                    ) : (
                      <span className="block h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </div>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!n.read) markReadMutation.mutate(n.id);
                    }}
                  >
                    <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 break-words">
                      {n.message}
                    </p>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {formatTime(n.createdAt || n.scheduledFor)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={(e) => { e.stopPropagation(); dismissMutation.mutate(n.id); }}
                    aria-label="Dismiss"
                    data-testid={`button-dismiss-${n.id}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-gray-400" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <Separator />

        {/* Settings toggle */}
        <button
          className="w-full px-4 py-2.5 text-sm text-left hover:bg-gray-50 flex items-center justify-between"
          onClick={() => setShowSettings(!showSettings)}
          data-testid="button-toggle-push-settings"
        >
          <span className="flex items-center gap-2">
            <Smartphone className="h-4 w-4 text-gray-500" />
            <span className="font-medium">Notification settings</span>
          </span>
          <span className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                isSubscribed ? 'bg-green-500' : 'bg-gray-300'
              }`}
            />
            <span className="text-xs text-gray-500">
              {isSubscribed ? 'On' : 'Off'}
            </span>
          </span>
        </button>

        {/* Push settings panel */}
        {showSettings && (
          <>
            <Separator />
            <div className="p-4 space-y-3 bg-gray-50">
              {iosNeedsInstall ? (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-amber-900">Install required on iPhone/iPad</p>
                    <p className="text-xs text-amber-800 mt-1">
                      Tap the Share button in Safari, then "Add to Home Screen", then come back.
                    </p>
                  </div>
                </div>
              ) : permission === 'unsupported' ? (
                <div className="flex items-start gap-2 text-sm">
                  <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                  <p className="text-red-700 text-xs">
                    This browser doesn't support notifications.
                  </p>
                </div>
              ) : permission === 'denied' ? (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-red-700">Blocked</p>
                      <p className="text-xs text-red-600 mt-1">
                        {isIOS
                          ? 'Settings → Notifications → BuildFlow Pro → Allow.'
                          : 'Click the lock icon in the address bar and set Notifications to Allow.'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => window.location.reload()}
                    data-testid="button-reload-after-permission"
                  >
                    Reload after enabling
                  </Button>
                </div>
              ) : isSubscribed ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    <span className="text-gray-700">Push notifications are on for this device</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                    data-testid="button-send-test-push"
                  >
                    <Send className="h-3.5 w-3.5 mr-2" />
                    {testMutation.isPending ? 'Sending...' : 'Send test reminder'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      await unsubscribe();
                      toast({ title: 'Notifications turned off on this device' });
                    }}
                    disabled={isWorking}
                    data-testid="button-turn-off-push"
                  >
                    <BellOff className="h-3.5 w-3.5 mr-2" />
                    {isWorking ? 'Working...' : 'Turn off push notifications'}
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                    <span className="text-gray-700">Push notifications are off for this device</span>
                  </div>
                  <Button
                    size="sm"
                    className="w-full"
                    onClick={async () => {
                      const ok = await subscribe();
                      if (ok) toast({ title: 'Notifications enabled on this device' });
                    }}
                    disabled={isWorking}
                    data-testid="button-turn-on-push"
                  >
                    <Bell className="h-3.5 w-3.5 mr-2" />
                    {isWorking ? 'Working...' : 'Turn on push notifications'}
                  </Button>
                </>
              )}
              <p className="text-[11px] text-gray-500 pt-1">
                Enable on each device you use. Friday 4pm timesheet reminders are automatic.
              </p>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

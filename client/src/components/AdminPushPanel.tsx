import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bell, BellOff, BellRing, Users, CheckCircle2, XCircle, Smartphone, AlertCircle } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { usePushNotifications } from '@/hooks/use-push-notifications';

interface Subscriber {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  subscriptionCount: number;
}

export function AdminPushPanel() {
  const { toast } = useToast();
  const {
    permission,
    isSubscribed,
    isWorking,
    subscribe,
    unsubscribe,
    iosNeedsInstall,
    isIOS,
  } = usePushNotifications();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('/');
  const [requireInteraction, setRequireInteraction] = useState(false);
  const [sendToAll, setSendToAll] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: subscribers, isLoading } = useQuery<Subscriber[]>({
    queryKey: ['/api/push/admin/subscribers'],
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/push/admin/send', {
        title,
        body,
        url: url || '/',
        requireInteraction,
        sendToAll,
        userIds: sendToAll ? undefined : Array.from(selectedIds),
      });
    },
    onSuccess: async (res: any) => {
      const json = await res.json();
      toast({
        title: 'Push sent',
        description: `Delivered: ${json.sent}, Failed: ${json.failed}`,
      });
      setTitle('');
      setBody('');
      queryClient.invalidateQueries({ queryKey: ['/api/push/admin/subscribers'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to send push',
        description: err?.message || 'Unknown error',
        variant: 'destructive',
      });
    },
  });

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const subscribed = (subscribers || []).filter(s => s.subscriptionCount > 0);
  const unsubscribed = (subscribers || []).filter(s => s.subscriptionCount === 0);

  const canSend = title.trim() && body.trim() && (sendToAll || selectedIds.size > 0) && !sendMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Self-subscription card - lets admin enable notifications on this device */}
      <Card data-testid="card-admin-self-subscribe">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <CardTitle>Notifications on This Device</CardTitle>
          </div>
          <CardDescription>
            Enable push notifications on this phone or computer so you receive timesheet
            reminders and admin broadcasts. Repeat on every device you use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {iosNeedsInstall ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Install required on iPhone/iPad.</strong> Tap the Share button in
                Safari, then "Add to Home Screen". Open BuildFlow Pro from your home
                screen and come back here to enable notifications.
              </AlertDescription>
            </Alert>
          ) : permission === 'unsupported' ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This browser doesn't support push notifications. Try Chrome, Edge, Safari
                (16.4+), or Firefox.
              </AlertDescription>
            </Alert>
          ) : permission === 'denied' ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Notifications are blocked for BuildFlow Pro. {isIOS
                  ? 'Open Settings → Notifications → BuildFlow Pro and turn on Allow Notifications, then reload this page.'
                  : 'Click the lock icon in the address bar, set Notifications to "Allow", then reload this page.'}
              </AlertDescription>
            </Alert>
          ) : isSubscribed ? (
            <div className="flex items-center justify-between gap-3 p-4 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center gap-3">
                <BellRing className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Notifications enabled on this device</p>
                  <p className="text-sm text-green-700">You'll receive timesheet reminders and admin broadcasts here.</p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={unsubscribe}
                disabled={isWorking}
                data-testid="button-admin-unsubscribe"
              >
                <BellOff className="h-4 w-4 mr-2" />
                {isWorking ? 'Working...' : 'Disable'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-center gap-3">
                <Bell className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-900">Notifications are off on this device</p>
                  <p className="text-sm text-blue-700">Enable them to receive reminders and test broadcasts.</p>
                </div>
              </div>
              <Button
                onClick={subscribe}
                disabled={isWorking}
                data-testid="button-admin-subscribe"
              >
                <Bell className="h-4 w-4 mr-2" />
                {isWorking ? 'Working...' : 'Enable'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            <CardTitle>Send Push Notification</CardTitle>
          </div>
          <CardDescription>
            Send a notification to all staff or selected employees. Notifications appear
            on phones and computers that have signed in and enabled notifications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="push-title">Title</Label>
            <Input
              id="push-title"
              placeholder="e.g., Timesheet reminder"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              data-testid="input-push-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-body">Message</Label>
            <Textarea
              id="push-body"
              placeholder="e.g., Please submit your timesheet by 5pm today."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={300}
              rows={3}
              data-testid="input-push-body"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="push-url">Open page when tapped</Label>
            <Input
              id="push-url"
              placeholder="/timesheet"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="input-push-url"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              id="push-require-interaction"
              checked={requireInteraction}
              onCheckedChange={setRequireInteraction}
              data-testid="switch-push-require-interaction"
            />
            <Label htmlFor="push-require-interaction">
              Keep notification visible until tapped (desktop only)
            </Label>
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <Switch
              id="push-send-all"
              checked={sendToAll}
              onCheckedChange={setSendToAll}
              data-testid="switch-push-send-all"
            />
            <Label htmlFor="push-send-all" className="font-semibold">
              Send to all staff with notifications enabled
            </Label>
          </div>

          {!sendToAll && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Select recipients</Label>
                <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
              </div>
              {isLoading ? (
                <div className="py-4 text-center text-sm text-gray-500">Loading...</div>
              ) : (
                <div className="border rounded-md max-h-64 overflow-y-auto divide-y">
                  {subscribed.length === 0 ? (
                    <div className="p-4 text-center text-sm text-gray-500">
                      No staff have enabled notifications yet
                    </div>
                  ) : (
                    subscribed.map(user => (
                      <label
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer"
                        data-testid={`row-push-user-${user.id}`}
                      >
                        <Checkbox
                          checked={selectedIds.has(user.id)}
                          onCheckedChange={() => toggleId(user.id)}
                        />
                        <div className="flex-1">
                          <div className="font-medium text-sm">
                            {user.firstName || ''} {user.lastName || ''}
                            {!user.firstName && !user.lastName && (user.email || user.id)}
                          </div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {user.subscriptionCount} {user.subscriptionCount === 1 ? 'device' : 'devices'}
                        </Badge>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={() => sendMutation.mutate()}
            disabled={!canSend}
            data-testid="button-send-push"
          >
            <Send className="h-4 w-4 mr-2" />
            {sendMutation.isPending ? 'Sending...' : 'Send Notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-gray-600" />
            <CardTitle>Subscriber Status</CardTitle>
          </div>
          <CardDescription>
            Who currently has notifications enabled.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-4 text-center text-sm text-gray-500">Loading...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  Enabled ({subscribed.length})
                </h4>
                <div className="space-y-1 text-sm">
                  {subscribed.length === 0 && <p className="text-gray-500">None yet</p>}
                  {subscribed.map(u => (
                    <div key={u.id} className="flex items-center justify-between py-1" data-testid={`subscriber-${u.id}`}>
                      <span>{u.firstName} {u.lastName} {!u.firstName && (u.email || u.id)}</span>
                      <Badge variant="outline" className="text-xs">{u.subscriptionCount}</Badge>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  Not enabled ({unsubscribed.length})
                </h4>
                <div className="space-y-1 text-sm">
                  {unsubscribed.length === 0 && <p className="text-gray-500">Everyone is subscribed</p>}
                  {unsubscribed.map(u => (
                    <div key={u.id} className="py-1 text-gray-600" data-testid={`unsubscriber-${u.id}`}>
                      {u.firstName} {u.lastName} {!u.firstName && (u.email || u.id)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Send, Bell, Users, CheckCircle2, XCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

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

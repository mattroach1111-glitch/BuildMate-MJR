import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Send,
  Bell,
  Users,
  CheckCircle2,
  Search,
  Smartphone,
  AlertCircle,
} from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';

interface Subscriber {
  id: string;
  email: string | null;
  displayName: string;
  employeeName: string | null;
  employeeActive: boolean | null;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  subscriptionCount: number;
}

type Audience = 'all' | 'selected';

export function AdminPushPanel() {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ['/api/push/admin/subscribers'],
  });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return subscribers;
    return subscribers.filter(s =>
      s.displayName.toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term)
    );
  }, [subscribers, search]);

  const enabledCount = subscribers.filter(s => s.subscriptionCount > 0).length;
  const totalCount = subscribers.length;

  const sendMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('POST', '/api/push/admin/send', {
        title: title.trim(),
        body: body.trim(),
        url: '/',
        sendToAll: audience === 'all',
        userIds: audience === 'selected' ? Array.from(selectedIds) : undefined,
      });
    },
    onSuccess: async (res: any) => {
      const json = await res.json();
      const recipientLabel = audience === 'all'
        ? 'all active staff'
        : `${selectedIds.size} ${selectedIds.size === 1 ? 'person' : 'people'}`;
      if (json.sent > 0) {
        toast({
          title: 'Notification sent',
          description: `Delivered to ${json.sent} ${json.sent === 1 ? 'device' : 'devices'} (${recipientLabel}).`,
        });
      } else {
        toast({
          title: 'Sent, but no devices reached',
          description: 'Recipients haven\'t enabled notifications yet.',
          variant: 'destructive',
        });
      }
      setTitle('');
      setBody('');
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['/api/push/admin/subscribers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
    },
    onError: (err: any) => {
      toast({
        title: 'Failed to send',
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

  const selectAllVisible = () => {
    setSelectedIds(new Set(filtered.map(s => s.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (audience === 'all' || selectedIds.size > 0) &&
    !sendMutation.isPending;

  return (
    <Card data-testid="card-push-composer">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-blue-600" />
              Send a notification
            </CardTitle>
            <CardDescription className="mt-1">
              Push a message to staff phones and computers. Friday timesheet reminders go out
              automatically at 4pm — this panel is for everything else.
            </CardDescription>
          </div>
          <Badge variant="secondary" className="flex-shrink-0 gap-1">
            <Smartphone className="h-3 w-3" />
            {enabledCount}/{totalCount} reachable
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Composer */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="push-title" className="text-sm">Title</Label>
            <Input
              id="push-title"
              placeholder="e.g. Site meeting moved to 9am"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              data-testid="input-push-title"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="push-body" className="text-sm">Message</Label>
            <Textarea
              id="push-body"
              placeholder="Keep it short — this shows on a phone lock screen."
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={300}
              rows={3}
              data-testid="input-push-body"
            />
            <p className="text-[11px] text-gray-500 text-right">{body.length}/300</p>
          </div>
        </div>

        <Separator />

        {/* Audience picker */}
        <div className="space-y-3">
          <Label className="text-sm">Who should receive this?</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAudience('all')}
              className={`p-3 rounded-md border-2 text-left transition-all ${
                audience === 'all'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid="button-audience-all"
            >
              <div className="flex items-center gap-2">
                <Users className={`h-4 w-4 ${audience === 'all' ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="font-semibold text-sm">Everyone</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">All active staff</p>
            </button>
            <button
              type="button"
              onClick={() => setAudience('selected')}
              className={`p-3 rounded-md border-2 text-left transition-all ${
                audience === 'selected'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              data-testid="button-audience-selected"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className={`h-4 w-4 ${audience === 'selected' ? 'text-blue-600' : 'text-gray-500'}`} />
                <span className="font-semibold text-sm">Pick people</span>
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Choose recipients'}
              </p>
            </button>
          </div>

          {audience === 'selected' && (
            <div className="border rounded-md overflow-hidden bg-white">
              <div className="p-2 border-b bg-gray-50 flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    placeholder="Search staff..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                    data-testid="input-recipient-search"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={selectAllVisible}
                  data-testid="button-select-all-visible"
                >
                  Select all
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={clearSelection}
                    data-testid="button-clear-selection"
                  >
                    Clear
                  </Button>
                )}
              </div>

              <ScrollArea className="h-72">
                {isLoading ? (
                  <div className="py-8 text-center text-sm text-gray-500">Loading staff...</div>
                ) : filtered.length === 0 ? (
                  <div className="py-8 text-center text-sm text-gray-500">
                    {search ? 'No matches' : 'No active staff'}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filtered.map(user => {
                      const enabled = user.subscriptionCount > 0;
                      const checked = selectedIds.has(user.id);
                      return (
                        <label
                          key={user.id}
                          className={`flex items-center gap-3 p-2.5 cursor-pointer hover:bg-gray-50 ${
                            checked ? 'bg-blue-50/50' : ''
                          }`}
                          data-testid={`row-recipient-${user.id}`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => toggleId(user.id)}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-gray-900 truncate">
                                {user.displayName}
                              </span>
                              {user.role === 'admin' && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                  admin
                                </Badge>
                              )}
                            </div>
                            {user.email && user.email !== user.displayName && (
                              <p className="text-[11px] text-gray-500 truncate">{user.email}</p>
                            )}
                          </div>
                          {enabled ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-1 border-green-300 bg-green-50 text-green-700"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                              {user.subscriptionCount} {user.subscriptionCount === 1 ? 'device' : 'devices'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-gray-500">
                              Off
                            </Badge>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}

          {audience === 'all' && enabledCount === 0 && !isLoading && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                No staff have enabled notifications yet. They need to allow notifications on their device first.
              </p>
            </div>
          )}
        </div>

        <Separator />

        <Button
          className="w-full"
          size="lg"
          onClick={() => sendMutation.mutate()}
          disabled={!canSend}
          data-testid="button-send-push"
        >
          <Send className="h-4 w-4 mr-2" />
          {sendMutation.isPending
            ? 'Sending...'
            : audience === 'all'
              ? `Send to all active staff`
              : selectedIds.size > 0
                ? `Send to ${selectedIds.size} ${selectedIds.size === 1 ? 'person' : 'people'}`
                : 'Send notification'}
        </Button>
      </CardContent>
    </Card>
  );
}

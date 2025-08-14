import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Bell, Calendar, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'reminder' | 'alert' | 'info' | 'success';
  isRead: boolean;
  isDismissed: boolean;
  scheduledFor: string;
  triggerDay: string;
  createdAt: string;
}

interface NotificationPopupProps {
  userEmail?: string;
}

export function NotificationPopup({ userEmail }: NotificationPopupProps) {
  const [showPopup, setShowPopup] = useState(false);
  const queryClient = useQueryClient();

  // Check if current user is Mark or Will and if it's Monday
  const shouldShowNotifications = () => {
    if (!userEmail) return false;
    
    const targetUsers = ['mark', 'will'];
    const isTargetUser = targetUsers.some(user => 
      userEmail.toLowerCase().includes(user)
    );
    
    const today = new Date();
    const isMonday = today.getDay() === 1; // Monday is day 1
    
    return isTargetUser && isMonday;
  };

  // Fetch active notifications
  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: ['/api/notifications/active'],
    enabled: shouldShowNotifications(),
    refetchInterval: 1000 * 60 * 5, // Check every 5 minutes
    retry: false,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to mark notification as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/active'] });
    },
  });

  // Dismiss notification
  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const response = await fetch(`/api/notifications/${notificationId}/dismiss`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to dismiss notification');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/active'] });
      // If no more notifications, hide popup
      if (notifications.length <= 1) {
        setShowPopup(false);
      }
    },
  });

  // Show popup when notifications are available
  useEffect(() => {
    if (notifications.length > 0 && shouldShowNotifications()) {
      setShowPopup(true);
    }
  }, [notifications.length, userEmail]);

  // Don't render if conditions not met
  if (!shouldShowNotifications() || isLoading || notifications.length === 0) {
    return null;
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'reminder':
        return <Calendar className="h-5 w-5 text-blue-500" />;
      case 'alert':
        return <Bell className="h-5 w-5 text-orange-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'reminder':
        return 'bg-blue-50 border-blue-200';
      case 'alert':
        return 'bg-orange-50 border-orange-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  if (!showPopup) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md mx-auto shadow-xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Bell className="h-5 w-5 text-blue-500" />
              Monday Reminder
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={() => setShowPopup(false)}
              data-testid="close-notification-popup"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {notifications.map((notification: Notification) => (
            <Alert 
              key={notification.id}
              className={`${getNotificationColor(notification.type)} relative`}
            >
              <div className="flex items-start gap-3">
                {getNotificationIcon(notification.type)}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">{notification.title}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {notification.type}
                    </Badge>
                  </div>
                  <AlertDescription className="text-sm text-gray-700">
                    {notification.message}
                  </AlertDescription>
                  
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markAsReadMutation.mutate(notification.id)}
                      disabled={markAsReadMutation.isPending}
                      className="text-xs h-7"
                      data-testid={`mark-read-${notification.id}`}
                    >
                      Mark as Read
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissMutation.mutate(notification.id)}
                      disabled={dismissMutation.isPending}
                      className="text-xs h-7"
                      data-testid={`dismiss-${notification.id}`}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </div>
            </Alert>
          ))}
          
          <div className="text-xs text-gray-500 text-center pt-2 border-t">
            This reminder appears every Monday for job update submissions
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
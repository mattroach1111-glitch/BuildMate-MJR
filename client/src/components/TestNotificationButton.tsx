import { Button } from '@/components/ui/button';
import { TestTube } from 'lucide-react';
import { pushNotificationService } from '@/lib/pushNotifications';
import { useToast } from '@/hooks/use-toast';

export function TestNotificationButton() {
  const { toast } = useToast();

  const handleTestNotification = async () => {
    try {
      console.log('Testing push notification...');
      const success = await pushNotificationService.sendTestNotification();
      if (success) {
        toast({
          title: "Test Notification Sent",
          description: "Check if the notification appeared!",
        });
      } else {
        toast({
          title: "Test Failed",
          description: "Could not send test notification. Check browser permissions.",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Test Error",
        description: "Failed to send test notification.",
        variant: "destructive"
      });
    }
  };

  return (
    <Button 
      onClick={handleTestNotification}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
      data-testid="button-test-notification"
    >
      <TestTube className="h-4 w-4" />
      Test Push Notification
    </Button>
  );
}
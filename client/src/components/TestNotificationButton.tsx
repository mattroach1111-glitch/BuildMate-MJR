import { Button } from '@/components/ui/button';
import { TestTube } from 'lucide-react';
// import { pushNotificationService } from '@/lib/pushNotifications';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

export function TestNotificationButton() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleTestNotification = async () => {
    setIsLoading(true);
    try {
      console.log('Testing real push notification...');
      
      // Register for push notifications first
      // const registered = await pushNotificationService.registerForPush();
      const registered = false; // Temporarily disabled
      
      if (!registered) {
        toast({
          title: "Registration Failed",
          description: "Could not register for push notifications. Check browser permissions.",
          variant: "destructive"
        });
        return;
      }

      // Send real push notification via server
      const response = await fetch('/api/push/send-to-all', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: "Test Push Notification",
          body: "This is a real push notification from BuildFlow Pro! It should reach all your devices."
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Real Push Notification Sent!",
          description: `Delivered to ${data.success} device(s), failed: ${data.failed}`,
        });
      } else {
        toast({
          title: "Server Error",
          description: data.message || "Failed to send push notification",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Test Error",
        description: "Failed to send real push notification.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleTestNotification}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
      disabled={isLoading}
      data-testid="button-test-notification"
    >
      <TestTube className="h-4 w-4" />
      {isLoading ? "Testing Real Push..." : "Test Real Push Notification"}
    </Button>
  );
}
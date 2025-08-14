import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, Mail, MessageSquare, Bell, ExternalLink, CheckCircle } from 'lucide-react';

export function AlternativeNotificationMethods() {
  const [emailSent, setEmailSent] = useState(false);

  const sendEmailNotification = async () => {
    try {
      const response = await fetch('/api/admin/send-email-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: 'BuildFlow Pro - Mobile Notification Test',
          message: 'This is a test email notification from BuildFlow Pro. You can receive important updates via email when push notifications are not supported on your device.'
        })
      });
      
      if (response.ok) {
        setEmailSent(true);
      }
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Alternative Notification Methods
        </CardTitle>
        <CardDescription>
          Alternative ways to receive notifications when push notifications aren't supported
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Browser Limitation Alert */}
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>Mobile Browser Limitation Detected:</strong> Your browser doesn't support Web Push notifications. 
            This is common on Samsung Internet and some mobile browsers. Here are reliable alternatives:
          </AlertDescription>
        </Alert>

        {/* Email Notifications */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <h4 className="font-medium">Email Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Receive notifications directly in your email inbox. Most reliable method for all devices.
              </p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Recommended
            </Badge>
          </div>
          
          <div className="ml-8 space-y-2">
            <Button 
              onClick={sendEmailNotification}
              variant="outline" 
              size="sm"
              className="w-full sm:w-auto"
            >
              {emailSent ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Email Test Sent
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Test Email Notification
                </>
              )}
            </Button>
            {emailSent && (
              <p className="text-xs text-green-600">
                Check your email inbox for the test notification
              </p>
            )}
          </div>
        </div>

        {/* SMS/Text Alternative */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-green-500" />
            <div className="flex-1">
              <h4 className="font-medium">SMS/Text Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Set up SMS notifications through your mobile carrier or messaging apps.
              </p>
            </div>
            <Badge variant="outline">Future Feature</Badge>
          </div>
        </div>

        {/* Native App Alternative */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Smartphone className="h-5 w-5 text-purple-500" />
            <div className="flex-1">
              <h4 className="font-medium">Progressive Web App (PWA)</h4>
              <p className="text-sm text-muted-foreground">
                Install BuildFlow Pro as an app on your phone for better notification support.
              </p>
            </div>
            <Badge variant="outline">Available</Badge>
          </div>
          
          <div className="ml-8 space-y-2">
            <p className="text-xs text-muted-foreground">
              Tap the browser menu → "Add to Home Screen" or "Install App"
            </p>
          </div>
        </div>

        {/* Browser Recommendations */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <ExternalLink className="h-5 w-5 text-orange-500" />
            <div className="flex-1">
              <h4 className="font-medium">Browser Alternatives</h4>
              <p className="text-sm text-muted-foreground">
                Try Chrome or Firefox mobile browsers for better push notification support.
              </p>
            </div>
            <Badge variant="outline">Recommended</Badge>
          </div>
        </div>

        {/* In-App Notifications */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-blue-500" />
            <div className="flex-1">
              <h4 className="font-medium">In-App Notifications</h4>
              <p className="text-sm text-muted-foreground">
                Check the dashboard regularly for notification badges and alerts.
              </p>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Always Available
            </Badge>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
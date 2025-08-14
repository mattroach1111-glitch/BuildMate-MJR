import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Bell, Mail, FileText, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface NotificationPreferences {
  documentProcessing: boolean;
  jobUpdates: boolean;
  timesheetReminders: boolean;
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    documentProcessing: true,
    jobUpdates: true,
    timesheetReminders: true,
  });

  // Get current user and notification preferences
  const { data: user } = useQuery({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user');
      }
      return response.json();
    },
  });

  // Load preferences when user data is available
  React.useEffect(() => {
    if (user?.emailNotificationPreferences) {
      try {
        const prefs = JSON.parse(user.emailNotificationPreferences);
        setPreferences(prefs);
      } catch (error) {
        console.error('Error parsing notification preferences:', error);
      }
    }
  }, [user]);

  const updatePreferencesMutation = useMutation({
    mutationFn: async (newPrefs: NotificationPreferences) => {
      return apiRequest('PUT', '/api/user/notification-preferences', { preferences: newPrefs });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Settings Updated",
        description: "Your notification preferences have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update notification preferences. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating preferences:', error);
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    updatePreferencesMutation.mutate(newPrefs);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Email Notification Settings
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Control which email notifications you receive from BuildFlow Pro.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Document Processing Notifications */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <Label className="text-base font-medium">Document Processing</Label>
                <p className="text-sm text-muted-foreground">
                  Get confirmation emails when PDFs and invoices are processed from email attachments
                </p>
              </div>
            </div>
            <Switch
              data-testid="switch-document-processing"
              checked={preferences.documentProcessing}
              onCheckedChange={(checked) => handlePreferenceChange('documentProcessing', checked)}
              disabled={updatePreferencesMutation.isPending}
            />
          </div>
          
          {preferences.documentProcessing && (
            <div className="ml-8 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border-l-4 border-blue-500">
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    Email Confirmation Example:
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-300 mt-1">
                    "Your documents have been processed successfully! • Invoice_1836_from_Eds_Painting_Service.pdf"
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Job Updates Notifications */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-5 w-5 text-green-500" />
            <div>
              <Label className="text-base font-medium">Job Updates</Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications when job sheets are updated or completed
              </p>
            </div>
          </div>
          <Switch
            data-testid="switch-job-updates"
            checked={preferences.jobUpdates}
            onCheckedChange={(checked) => handlePreferenceChange('jobUpdates', checked)}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>

        <Separator />

        {/* Timesheet Reminders */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Clock className="h-5 w-5 text-orange-500" />
            <div>
              <Label className="text-base font-medium">Timesheet Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminder emails for incomplete or pending timesheet submissions
              </p>
            </div>
          </div>
          <Switch
            data-testid="switch-timesheet-reminders"
            checked={preferences.timesheetReminders}
            onCheckedChange={(checked) => handlePreferenceChange('timesheetReminders', checked)}
            disabled={updatePreferencesMutation.isPending}
          />
        </div>

        <Separator />

        {/* Alternative Methods */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-amber-500" />
            <Label className="text-base font-medium">Alternative Notification Methods</Label>
          </div>
          
          <div className="ml-7 space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>In-App Notifications:</strong> Check the Email Processing Review section in your admin dashboard 
              for real-time document processing status.
            </p>
            <p>
              <strong>Dashboard Indicators:</strong> The main dashboard shows pending documents that need review 
              with orange notification badges.
            </p>
            <p>
              <strong>Job Sheet Integration:</strong> Processed expenses automatically appear in job sheets 
              with file attachments and Google Drive links.
            </p>
          </div>
        </div>

        {/* Save Status */}
        {updatePreferencesMutation.isPending && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            Saving preferences...
          </div>
        )}
      </CardContent>
    </Card>
  );
}
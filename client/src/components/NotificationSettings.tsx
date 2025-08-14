import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Bell, Mail, FileText, Clock, CheckCircle, AlertCircle, Smartphone, Users, Send, MessageSquare, TestTube } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { pushNotificationService } from '@/lib/pushNotifications';

interface NotificationPreferences {
  documentProcessing: boolean;
  jobUpdates: boolean;
  timesheetReminders: boolean;
}

interface PushNotificationSettings {
  timesheetReminders: {
    enabled: boolean;
    time: string;
    days: string[];
    timezone: string;
    targetStaff: 'all' | 'selected';
    selectedStaff?: string[];
  };
}

export function NotificationSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    documentProcessing: true,
    jobUpdates: true,
    timesheetReminders: true,
  });

  // Check browser notification permission on mount
  React.useEffect(() => {
    setBrowserPermission(pushNotificationService.getPermission());
  }, []);

  // Instant notification states
  const [instantNotification, setInstantNotification] = useState({
    message: '',
    targetStaff: 'all' as 'all' | 'selected',
    selectedStaff: [] as string[]
  });
  const [pushSettings, setPushSettings] = useState<PushNotificationSettings>({
    timesheetReminders: {
      enabled: true,
      time: "17:00",
      days: ["monday", "tuesday", "wednesday", "thursday", "friday"],
      timezone: "Australia/Sydney",
      targetStaff: "all",
      selectedStaff: []
    }
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

  // Get staff list for push notification targeting
  const { data: staffList } = useQuery({
    queryKey: ['/api/staff'],
    queryFn: async () => {
      const response = await fetch('/api/staff', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch staff');
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
    if (user?.pushNotificationSettings) {
      try {
        const pushSettings = JSON.parse(user.pushNotificationSettings);
        console.log('Loaded push notification settings:', pushSettings);
        console.log('Target staff setting:', pushSettings?.timesheetReminders?.targetStaff);
        setPushSettings(pushSettings);
      } catch (error) {
        console.error('Error parsing push notification settings:', error);
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

  const updatePushSettingsMutation = useMutation({
    mutationFn: async (newSettings: PushNotificationSettings) => {
      return apiRequest('PUT', '/api/user/push-notification-settings', { settings: newSettings });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      toast({
        title: "Settings Updated",
        description: "Your push notification settings have been saved.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update push notification settings. Please try again.",
        variant: "destructive",
      });
      console.error('Error updating push settings:', error);
    },
  });

  // Send instant push notification
  const sendInstantNotificationMutation = useMutation({
    mutationFn: async (data: {
      message: string;
      targetStaff: 'all' | 'selected';
      selectedStaff?: string[];
    }) => {
      return apiRequest('POST', '/api/admin/send-instant-notification', data);
    },
    onSuccess: () => {
      toast({
        title: "Notification Sent!",
        description: "Push notification has been sent to selected staff members.",
      });
      setInstantNotification({
        message: '',
        targetStaff: 'all',
        selectedStaff: []
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Notification",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const handlePreferenceChange = (key: keyof NotificationPreferences, value: boolean) => {
    const newPrefs = { ...preferences, [key]: value };
    setPreferences(newPrefs);
    updatePreferencesMutation.mutate(newPrefs);
  };

  const handlePushSettingChange = (key: string, value: any) => {
    const newSettings = { ...pushSettings };
    if (key.includes('.')) {
      const [parentKey, childKey] = key.split('.');
      newSettings[parentKey as keyof PushNotificationSettings] = {
        ...newSettings[parentKey as keyof PushNotificationSettings],
        [childKey]: value
      } as any;
    } else {
      (newSettings as any)[key] = value;
    }
    setPushSettings(newSettings);
    updatePushSettingsMutation.mutate(newSettings);
  };

  const handleDayToggle = (day: string) => {
    const currentDays = pushSettings.timesheetReminders.days;
    const newDays = currentDays.includes(day) 
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day];
    
    handlePushSettingChange('timesheetReminders.days', newDays);
  };

  const handleStaffToggle = (staffId: string) => {
    console.log('Staff toggle clicked:', staffId);
    const currentStaff = pushSettings.timesheetReminders.selectedStaff || [];
    const newStaff = currentStaff.includes(staffId)
      ? currentStaff.filter(id => id !== staffId)
      : [...currentStaff, staffId];
    
    console.log('Current staff:', currentStaff, 'New staff:', newStaff);
    handlePushSettingChange('timesheetReminders.selectedStaff', newStaff);
  };

  // Instant notification handlers
  const handleInstantStaffToggle = (staffId: string) => {
    const currentStaff = instantNotification.selectedStaff;
    const newStaff = currentStaff.includes(staffId)
      ? currentStaff.filter(id => id !== staffId)
      : [...currentStaff, staffId];
    setInstantNotification(prev => ({
      ...prev,
      selectedStaff: newStaff
    }));
  };

  const handleSendInstantNotification = () => {
    if (!instantNotification.message.trim()) {
      toast({
        title: "Message Required",
        description: "Please enter a message to send.",
        variant: "destructive",
      });
      return;
    }

    if (instantNotification.targetStaff === 'selected' && instantNotification.selectedStaff.length === 0) {
      toast({
        title: "Staff Selection Required",
        description: "Please select at least one staff member to send the notification to.",
        variant: "destructive",
      });
      return;
    }

    sendInstantNotificationMutation.mutate({
      message: instantNotification.message,
      targetStaff: instantNotification.targetStaff,
      selectedStaff: instantNotification.targetStaff === 'selected' ? instantNotification.selectedStaff : undefined
    });
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

        {/* Push Notification Settings */}
        <Card className="border-purple-200 bg-purple-50/30 dark:bg-purple-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
              <Smartphone className="h-5 w-5" />
              Push Notification Settings
            </CardTitle>
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Configure mobile push notifications for timesheet reminders
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Timesheet Push Reminders */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Clock className="h-5 w-5 text-purple-500" />
                  <div>
                    <Label className="text-base font-medium">Daily Timesheet Reminders</Label>
                    <p className="text-sm text-muted-foreground">
                      Send push notifications to remind staff to complete timesheets
                    </p>
                  </div>
                </div>
                <Switch
                  data-testid="switch-push-timesheet-reminders"
                  checked={pushSettings.timesheetReminders.enabled}
                  onCheckedChange={(checked) => handlePushSettingChange('timesheetReminders.enabled', checked)}
                  disabled={updatePushSettingsMutation.isPending}
                />
              </div>

              {pushSettings.timesheetReminders.enabled && (
                <div className="ml-8 space-y-4 p-4 bg-white dark:bg-gray-900 rounded-lg border">
                  {/* Time Setting */}
                  <div className="space-y-2">
                    <Label htmlFor="reminder-time" className="text-sm font-medium">
                      Reminder Time
                    </Label>
                    <Input
                      id="reminder-time"
                      type="time"
                      value={pushSettings.timesheetReminders.time}
                      onChange={(e) => handlePushSettingChange('timesheetReminders.time', e.target.value)}
                      className="w-32"
                      data-testid="input-reminder-time"
                    />
                    <p className="text-xs text-muted-foreground">
                      Time is in {pushSettings.timesheetReminders.timezone} timezone
                    </p>
                  </div>

                  {/* Days Selection */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Reminder Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                        <Button
                          key={day}
                          size="sm"
                          variant={pushSettings.timesheetReminders.days.includes(day) ? "default" : "outline"}
                          onClick={() => handleDayToggle(day)}
                          data-testid={`button-day-${day}`}
                          className="capitalize"
                        >
                          {day.substring(0, 3)}
                        </Button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Select which days to send timesheet reminders
                    </p>
                  </div>

                  {/* Timezone Setting */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Timezone</Label>
                    <Select
                      value={pushSettings.timesheetReminders.timezone}
                      onValueChange={(value) => handlePushSettingChange('timesheetReminders.timezone', value)}
                    >
                      <SelectTrigger className="w-48" data-testid="select-timezone">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Australia/Sydney">Australia/Sydney</SelectItem>
                        <SelectItem value="Australia/Melbourne">Australia/Melbourne</SelectItem>
                        <SelectItem value="Australia/Brisbane">Australia/Brisbane</SelectItem>
                        <SelectItem value="Australia/Perth">Australia/Perth</SelectItem>
                        <SelectItem value="Australia/Adelaide">Australia/Adelaide</SelectItem>
                        <SelectItem value="Australia/Darwin">Australia/Darwin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Staff Selection */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Who should receive reminders?</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="target-all"
                          name="staff-target"
                          checked={pushSettings.timesheetReminders.targetStaff === 'all'}
                          onChange={() => handlePushSettingChange('timesheetReminders.targetStaff', 'all')}
                          className="rounded border-gray-300"
                          data-testid="radio-target-all"
                        />
                        <Label htmlFor="target-all" className="text-sm cursor-pointer">
                          Send to all staff members
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="target-selected"
                          name="staff-target"
                          checked={pushSettings.timesheetReminders.targetStaff === 'selected'}
                          onChange={() => handlePushSettingChange('timesheetReminders.targetStaff', 'selected')}
                          className="rounded border-gray-300"
                          data-testid="radio-target-selected"
                        />
                        <Label htmlFor="target-selected" className="text-sm cursor-pointer">
                          Send to selected staff only
                        </Label>
                      </div>
                    </div>



                    {pushSettings.timesheetReminders.targetStaff === 'selected' && (
                      <div className="ml-6 p-3 bg-gray-50 dark:bg-gray-800 rounded-md border">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="h-4 w-4 text-gray-600" />
                          <Label className="text-sm font-medium">Select Staff Members</Label>
                        </div>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {staffList && staffList.length > 0 ? (
                            staffList.map((staff: any) => {
                              const isChecked = (pushSettings.timesheetReminders.selectedStaff || []).includes(staff.id);
                              return (
                                <div key={staff.id} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`staff-${staff.id}`}
                                    checked={isChecked}
                                    onCheckedChange={() => handleStaffToggle(staff.id)}
                                    data-testid={`checkbox-staff-${staff.id}`}
                                  />
                                  <Label htmlFor={`staff-${staff.id}`} className="text-sm cursor-pointer">
                                    {staff.name}
                                  </Label>
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-muted-foreground">No staff members found</p>
                          )}
                          {pushSettings.timesheetReminders.selectedStaff?.length === 0 && pushSettings.timesheetReminders.targetStaff === 'selected' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                              ⚠️ No staff selected - reminders will not be sent to anyone
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Push Notification Status */}
            {updatePushSettingsMutation.isPending && (
              <div className="flex items-center gap-2 text-sm text-purple-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                Saving push notification settings...
              </div>
            )}
          </CardContent>
        </Card>

        <Separator />

        {/* Instant Push Notification */}
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
              <Send className="h-5 w-5" />
              Send Instant Push Notification
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Send an immediate push notification to staff members for urgent messages or announcements.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Message Input */}
            <div className="space-y-2">
              <Label htmlFor="instant-message" className="text-sm font-medium">Message</Label>
              <Textarea
                id="instant-message"
                placeholder="Enter your message to send to staff members..."
                value={instantNotification.message}
                onChange={(e) => setInstantNotification(prev => ({ ...prev, message: e.target.value }))}
                className="min-h-[80px]"
                data-testid="textarea-instant-message"
              />
            </div>

            {/* Target Staff Selection */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Send To</Label>
              <RadioGroup
                value={instantNotification.targetStaff}
                onValueChange={(value: 'all' | 'selected') => setInstantNotification(prev => ({ 
                  ...prev, 
                  targetStaff: value,
                  selectedStaff: value === 'all' ? [] : prev.selectedStaff
                }))}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="instant-all" />
                  <Label htmlFor="instant-all" className="text-sm cursor-pointer">
                    Send to all staff
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="instant-selected" />
                  <Label htmlFor="instant-selected" className="text-sm cursor-pointer">
                    Send to selected staff only
                  </Label>
                </div>
              </RadioGroup>

              {/* Staff Selection */}
              {instantNotification.targetStaff === 'selected' && (
                <div className="ml-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="h-4 w-4 text-green-600" />
                    <Label className="text-sm font-medium">Select Staff Members</Label>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {staffList && staffList.length > 0 ? (
                      staffList.map((staff: any) => {
                        const isChecked = instantNotification.selectedStaff.includes(staff.id);
                        return (
                          <div key={staff.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`instant-staff-${staff.id}`}
                              checked={isChecked}
                              onCheckedChange={() => handleInstantStaffToggle(staff.id)}
                              data-testid={`checkbox-instant-staff-${staff.id}`}
                            />
                            <Label htmlFor={`instant-staff-${staff.id}`} className="text-sm cursor-pointer">
                              {staff.name}
                            </Label>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">No staff members found</p>
                    )}
                    {instantNotification.selectedStaff.length === 0 && instantNotification.targetStaff === 'selected' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        ⚠️ No staff selected - notification will not be sent to anyone
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Send Button */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSendInstantNotification}
                disabled={sendInstantNotificationMutation.isPending || !instantNotification.message.trim()}
                className="bg-green-600 hover:bg-green-700 text-white"
                data-testid="button-send-instant-notification"
              >
                {sendInstantNotificationMutation.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Notification
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

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
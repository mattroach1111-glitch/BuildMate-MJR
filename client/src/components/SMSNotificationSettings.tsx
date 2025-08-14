import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Smartphone, MessageSquare, CheckCircle, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface UserSMSSettings {
  mobilePhone: string | null;
  smsNotificationsEnabled: boolean;
}

export function SMSNotificationSettings() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [carrier, setCarrier] = useState('auto');
  const [isEnabled, setIsEnabled] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch current user settings
  const { data: userSettings } = useQuery<UserSMSSettings>({
    queryKey: ['/api/user/sms-settings'],
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: (data: { mobilePhone: string; smsNotificationsEnabled: boolean }) =>
      apiRequest('/api/user/sms-settings', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/sms-settings'] });
      toast({
        title: "SMS settings updated",
        description: "Your SMS notification preferences have been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Failed to update settings",
        description: "There was an error saving your SMS preferences.",
        variant: "destructive",
      });
    },
  });

  // Test SMS mutation
  const testSMSMutation = useMutation({
    mutationFn: (phoneNum: string) =>
      apiRequest('/api/user/test-sms', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phoneNum }),
      }),
    onSuccess: () => {
      setTestResult('success');
      toast({
        title: "SMS test sent",
        description: "Check your phone for the test message.",
      });
    },
    onError: () => {
      setTestResult('error');
      toast({
        title: "SMS test failed",
        description: "Unable to send test SMS. Check your phone number and try again.",
        variant: "destructive",
      });
    },
  });

  // Load settings when data arrives
  useEffect(() => {
    if (userSettings) {
      setPhoneNumber(userSettings.mobilePhone || '');
      setIsEnabled(userSettings.smsNotificationsEnabled);
    }
  }, [userSettings]);

  const handleSaveSettings = () => {
    // Validate phone number format
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    if (isEnabled && (!cleanPhone || cleanPhone.length < 10)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Australian mobile number.",
        variant: "destructive",
      });
      return;
    }

    console.log('📱 Saving SMS settings:', {
      mobilePhone: cleanPhone,
      smsNotificationsEnabled: isEnabled,
      rawPhone: phoneNumber
    });

    updateSettingsMutation.mutate({
      mobilePhone: cleanPhone,
      smsNotificationsEnabled: isEnabled,
    });
  };

  const handleTestSMS = () => {
    if (!phoneNumber) {
      toast({
        title: "Enter phone number",
        description: "Please enter your phone number first.",
        variant: "destructive",
      });
      return;
    }
    setTestResult(null);
    testSMSMutation.mutate(phoneNumber);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          SMS Notifications
        </CardTitle>
        <CardDescription>
          Get reliable notifications via SMS when your browser doesn't support push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Why SMS Section */}
        <Alert>
          <Smartphone className="h-4 w-4" />
          <AlertDescription>
            <strong>Perfect for mobile browsers:</strong> Samsung Internet and other mobile browsers 
            often don't support push notifications. SMS notifications provide a reliable backup 
            to ensure you never miss important alerts. Uses email-to-SMS gateways for instant delivery.
          </AlertDescription>
        </Alert>

        {/* Enable SMS Toggle */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Enable SMS Notifications</Label>
            <div className="text-sm text-muted-foreground">
              Receive notifications via text message as a fallback
            </div>
          </div>
          <Switch
            checked={isEnabled}
            onCheckedChange={setIsEnabled}
            data-testid="switch-sms-enabled"
          />
        </div>

        {/* Phone Number Input */}
        {isEnabled && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Mobile Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="0412 345 678"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                data-testid="input-phone-number"
              />
              <div className="text-xs text-muted-foreground">
                Enter your Australian mobile number (format: 04xx xxx xxx)
              </div>
            </div>

            {/* Carrier Selection */}
            <div className="space-y-2">
              <Label htmlFor="carrier">Mobile Carrier (Optional)</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger data-testid="select-carrier">
                  <SelectValue placeholder="Select your carrier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto-detect</SelectItem>
                  <SelectItem value="telstra">Telstra</SelectItem>
                  <SelectItem value="optus">Optus</SelectItem>
                  <SelectItem value="vodafone">Vodafone</SelectItem>
                  <SelectItem value="tpg">TPG</SelectItem>
                  <SelectItem value="boost">Boost Mobile</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-xs text-muted-foreground">
                Selecting your carrier may improve delivery reliability
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button 
            onClick={handleSaveSettings}
            disabled={updateSettingsMutation.isPending}
            data-testid="button-save-sms-settings"
          >
            {updateSettingsMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>

          {isEnabled && phoneNumber && (
            <Button 
              variant="outline"
              onClick={handleTestSMS}
              disabled={testSMSMutation.isPending}
              data-testid="button-test-sms"
            >
              {testSMSMutation.isPending ? "Sending..." : "Test SMS"}
            </Button>
          )}
        </div>

        {/* Test Result */}
        {testResult && (
          <Alert className={testResult === 'success' ? 'border-green-200' : 'border-red-200'}>
            {testResult === 'success' ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription>
              {testResult === 'success' 
                ? "SMS test successful! Check your phone for the message."
                : "SMS test failed. Please check your phone number and try again."
              }
            </AlertDescription>
          </Alert>
        )}

        {/* Info about SMS notifications */}
        {isEnabled && (
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">How SMS notifications work:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• SMS is sent automatically when push notifications fail</li>
              <li>• You'll receive timesheet reminders and urgent alerts</li>
              <li>• Messages are limited to 160 characters</li>
              <li>• Standard SMS rates may apply from your carrier</li>
            </ul>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
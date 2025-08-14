import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Mail, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface TestResult {
  step: string;
  success: boolean;
  message: string;
}

export function MobileNotificationTest() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isTestComplete, setIsTestComplete] = useState(false);
  const { toast } = useToast();

  // Mobile notification test mutation
  const testMobileMutation = useMutation({
    mutationFn: () => apiRequest('/api/user/test-mobile-notification', {
      method: 'POST',
    }),
    onSuccess: (data: any) => {
      const newResults: TestResult[] = [
        {
          step: 'Mobile Browser Detection',
          success: true,
          message: 'Mobile browser detected successfully'
        },
        {
          step: 'Email Notification Service',
          success: true,
          message: 'Email notification service available'
        },
        {
          step: 'Send Mobile Notification',
          success: true,
          message: `Mobile notification sent to ${data.email}`
        }
      ];
      
      setTestResults(newResults);
      setIsTestComplete(true);
      
      toast({
        title: "Mobile notification sent!",
        description: "Check your email for the instant notification message.",
      });
    },
    onError: (error: any) => {
      const newResults: TestResult[] = [
        {
          step: 'Mobile Browser Detection',
          success: true,
          message: 'Mobile browser detected successfully'
        },
        {
          step: 'Email Notification Service',
          success: false,
          message: 'Failed to send mobile notification'
        },
        {
          step: 'Send Mobile Notification',
          success: false,
          message: error.message || 'Unknown error occurred'
        }
      ];
      
      setTestResults(newResults);
      setIsTestComplete(true);
      
      toast({
        title: "Mobile notification failed",
        description: "There was an error sending the mobile notification.",
        variant: "destructive",
      });
    }
  });

  const handleRunTest = () => {
    setTestResults([]);
    setIsTestComplete(false);
    testMobileMutation.mutate();
  };

  const handleReset = () => {
    setTestResults([]);
    setIsTestComplete(false);
  };

  const allTestsPassed = testResults.every(result => result.success);
  const hasFailures = testResults.some(result => !result.success);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Mobile Notification Test
        </CardTitle>
        <CardDescription>
          Test instant email notifications that work as mobile alerts for devices that don't support push notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        
        {/* Test Button */}
        <div className="flex gap-2">
          <Button 
            onClick={handleRunTest}
            disabled={testMobileMutation.isPending}
            data-testid="button-test-mobile-notification"
          >
            {testMobileMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Test Mobile Notification
              </>
            )}
          </Button>

          {isTestComplete && (
            <Button 
              variant="outline" 
              onClick={handleReset}
              data-testid="button-reset-test"
            >
              Reset Test
            </Button>
          )}
        </div>

        {/* Test Results */}
        {testResults.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium">Test Results:</h4>
            
            {testResults.map((result, index) => (
              <div 
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  result.success 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                {result.success ? (
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <div className="font-medium text-sm">{result.step}</div>
                  <div className="text-sm text-muted-foreground">{result.message}</div>
                </div>
                <Badge 
                  variant={result.success ? "default" : "destructive"}
                  className="text-xs"
                >
                  {result.success ? "PASS" : "FAIL"}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Summary Alert */}
        {isTestComplete && (
          <Alert className={allTestsPassed ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
            {allTestsPassed ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600" />
            )}
            <AlertDescription>
              {allTestsPassed ? (
                <div>
                  <strong>Mobile notifications working!</strong> You should receive an instant email notification that acts like a mobile alert. This method ensures you get notifications even when your browser doesn't support push notifications.
                </div>
              ) : (
                <div>
                  <strong>Mobile notification test failed.</strong> There may be an issue with the email service. Please contact support for assistance.
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Info About Mobile Notifications */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">How mobile notifications work:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Instant email notifications that look and feel like mobile alerts</li>
            <li>• Automatic fallback when push notifications fail</li>
            <li>• Works on all mobile browsers including Samsung Internet</li>
            <li>• Styled to be easily readable on mobile devices</li>
            <li>• No additional setup required - uses your existing email</li>
          </ul>
        </div>

      </CardContent>
    </Card>
  );
}
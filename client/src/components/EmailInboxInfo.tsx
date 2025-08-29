import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, CheckCircle, Info, Zap, PlayCircle, RefreshCw, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface EmailInboxData {
  emailAddress: string;
  instructions: string;
  features: string[];
}

interface EmailInboxStatus {
  status: string;
  emailAddress: string;
  lastChecked: string;
  recentProcessed: any[];
  totalProcessed: number;
}

export function EmailInboxInfo() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: inboxData, isLoading } = useQuery<EmailInboxData>({
    queryKey: ["/api/email-inbox/address"],
  });

  const { data: statusData, isLoading: statusLoading } = useQuery<EmailInboxStatus>({
    queryKey: ["/api/email-inbox/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Manual email processing trigger
  const processEmailsMutation = useMutation({
    mutationFn: async () => {
      console.log('🔵 Frontend: Starting email processing request...');
      try {
        const response = await apiRequest("POST", "/api/email-inbox/process", {});
        console.log('🔵 Frontend: API response received:', response.status);
        const data = await response.json();
        console.log('🔵 Frontend: Response data:', data);
        return data;
      } catch (error) {
        console.error('🔴 Frontend: API request failed:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('🟢 Frontend: Email processing succeeded:', data);
      
      // Log error information if any occur
      if (data.errors && data.errors.length > 0) {
        console.log('⚠️ Email processing had errors:', data.errors);
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/email-inbox/status"] });
      
      if (data.errors && data.errors.length > 0) {
        toast({
          title: "Email Processing Complete",
          description: `Processed ${data.processed} emails. ${data.errors.length} errors (check console for details)`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email Processing Complete",
          description: `Successfully processed ${data.processed} emails`,
        });
      }
    },
    onError: (error) => {
      console.error('🔴 Frontend: Email processing failed:', error);
      toast({
        title: "Error",
        description: "Failed to start email processing",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = async () => {
    if (inboxData?.emailAddress) {
      try {
        await navigator.clipboard.writeText(inboxData.emailAddress);
        setCopied(true);
        toast({
          title: "Email address copied!",
          description: "You can now paste it in your email client",
        });
        setTimeout(() => setCopied(false), 2000);
      } catch (error) {
        toast({
          title: "Failed to copy",
          description: "Please manually copy the email address",
          variant: "destructive",
        });
      }
    }
  };

  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Inbox Setup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!inboxData) {
    return (
      <Card className="w-full border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <Info className="h-4 w-4" />
            <span>Unable to load email inbox information</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full border-blue-200 bg-blue-50/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Mail className="h-5 w-5" />
          Email Document Processing
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            <Zap className="h-3 w-3 mr-1" />
            Auto-Process
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Address Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">
            Your Document Processing Email:
          </label>
          <div className="flex items-center gap-2 p-3 bg-white border rounded-lg">
            <code className="flex-1 text-sm font-mono text-blue-600">
              {inboxData.emailAddress}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyToClipboard}
              className="h-8"
              data-testid="button-copy-email"
            >
              {copied ? (
                <>
                  <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">How it works:</h4>
          <p className="text-sm text-gray-600 leading-relaxed">
            {inboxData.instructions}
          </p>
        </div>

        {/* Features List */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Features:</h4>
          <ul className="space-y-1">
            {inboxData.features.map((feature, index) => (
              <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                <CheckCircle className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Email Processing Status */}
        {statusData && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-700">Processing Status:</h4>
              <Badge 
                variant={statusData.status === "active" ? "default" : "secondary"}
                className={statusData.status === "active" ? "bg-green-100 text-green-800" : ""}
              >
                <Activity className="h-3 w-3 mr-1" />
                {statusData.status === "active" ? "Active" : "Inactive"}
              </Badge>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">Last Checked:</span>
                <p className="font-mono text-gray-700">
                  {new Date(statusData.lastChecked).toLocaleTimeString()}
                </p>
              </div>
              <div>
                <span className="text-gray-500">Total Processed:</span>
                <p className="font-mono text-gray-700">{statusData.totalProcessed}</p>
              </div>
            </div>

            {/* Manual Processing Button */}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                console.log('🔵 Frontend: Check for new emails button clicked');
                processEmailsMutation.mutate();
              }}
              disabled={processEmailsMutation.isPending}
              className="w-full"
              data-testid="button-process-emails"
            >
              {processEmailsMutation.isPending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <PlayCircle className="h-3 w-3 mr-2" />
                  Check for New Emails
                </>
              )}
            </Button>
          </div>
        )}

        {/* Email Integration Setup */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-blue-800 mb-2">📧 Email Integration Setup:</h4>
          <div className="space-y-2 text-xs text-blue-700">
            <p><strong>Using Your @mjrbuilders.com.au Email:</strong></p>
            <ul className="space-y-1 ml-2">
              <li>• Create the email account shown above in OnlyDomains</li>
              <li>• Configure IMAP access in your email hosting panel</li>
              <li>• Email credentials are configured ✅</li>
              <li>• Email address: {inboxData.emailAddress}</li>
              <li>• Forward invoices to your document processing email</li>
              <li>• Click "Check for New Emails" for automatic processing</li>
            </ul>
            <p className="text-blue-600 font-medium mt-2">✅ Email credentials configured! Ready to test connection.</p>
          </div>
        </div>

        {/* Usage Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-amber-800 mb-2">💡 Once Active:</h4>
          <ul className="space-y-1 text-xs text-amber-700">
            <li>• Include the job name in your email subject for automatic assignment</li>
            <li>• Attach multiple invoices in one email to process them all at once</li>
            <li>• You'll receive notifications when documents are processed successfully</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
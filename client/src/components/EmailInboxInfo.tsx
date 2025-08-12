import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Mail, CheckCircle, Info, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface EmailInboxData {
  emailAddress: string;
  instructions: string;
  features: string[];
}

export function EmailInboxInfo() {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const { data: inboxData, isLoading } = useQuery<EmailInboxData>({
    queryKey: ["/api/email-inbox/address"],
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

        {/* Usage Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <h4 className="text-sm font-medium text-amber-800 mb-2">💡 Pro Tips:</h4>
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
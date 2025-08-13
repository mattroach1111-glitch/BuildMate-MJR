import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Cloud, CloudOff, ExternalLink, Unlink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GoogleDriveStatus {
  connected: boolean;
}

export function GoogleDriveIntegration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConnecting, setIsConnecting] = useState(false);

  // Check Google Drive connection status
  const { data: status, isLoading } = useQuery<GoogleDriveStatus>({
    queryKey: ["/api/google-drive/status"],
  });

  // Get auth URL mutation
  const getAuthUrlMutation = useMutation({
    mutationFn: async (): Promise<{ authUrl: string }> => {
      const response = await fetch("/api/google-drive/auth-url");
      const data = await response.json();
      console.log("🔵 Google Drive auth URL response:", data);
      return data;
    },
    onSuccess: (data) => {
      console.log("🔵 Opening Google OAuth window with URL:", data.authUrl);
      // Open Google OAuth in new window
      const authWindow = window.open(
        data.authUrl,
        "google-auth",
        "width=500,height=600,scrollbars=yes,resizable=yes"
      );

      setIsConnecting(true);

      // Listen for the auth completion
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          setIsConnecting(false);
          console.log("🔵 Google OAuth window closed, refreshing status...");
          // Refresh status after a delay to allow for callback processing
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
          }, 3000); // Increased delay
        }
      }, 1000);
    },
    onError: (error) => {
      console.error("🔴 Error initiating Google Drive connection:", error);
      toast({
        title: "Error",
        description: "Failed to initiate Google Drive connection",
        variant: "destructive",
      });
      setIsConnecting(false);
    },
  });

  // Disconnect mutation
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/google-drive/disconnect", {
        method: "DELETE",
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-drive/status"] });
      toast({
        title: "Success",
        description: "Google Drive disconnected successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to disconnect Google Drive",
        variant: "destructive",
      });
    },
  });

  const handleConnect = () => {
    getAuthUrlMutation.mutate();
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Drive Integration
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {status?.connected ? (
            <Cloud className="h-5 w-5 text-green-600" />
          ) : (
            <CloudOff className="h-5 w-5 text-gray-400" />
          )}
          Google Drive Integration
        </CardTitle>
        <CardDescription>
          Connect your Google Drive to automatically save timesheet PDFs
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge variant={status?.connected ? "default" : "secondary"}>
              {status?.connected ? "Connected" : "Not Connected"}
            </Badge>
          </div>
        </div>

        {status?.connected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your Google Drive is connected. Timesheet PDFs will be automatically saved to the
              "BuildFlow Pro Timesheets" folder in your Google Drive.
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open("https://drive.google.com", "_blank")}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Google Drive
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-2"
              >
                <Unlink className="h-4 w-4" />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect your Google Drive account to automatically save generated timesheet PDFs.
              This allows you to access your timesheets from anywhere and share them easily.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting || getAuthUrlMutation.isPending}
              className="flex items-center gap-2"
              data-testid="button-connect-google-drive"
            >
              <Cloud className="h-4 w-4" />
              {isConnecting ? "Connecting..." : "Connect Google Drive"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { RefreshCw, ExternalLink } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface GoogleDriveReconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReconnectSuccess?: () => void;
  title?: string;
  description?: string;
}

export function GoogleDriveReconnectDialog({
  open,
  onOpenChange,
  onReconnectSuccess,
  title = "Google Drive Connection Required",
  description = "Your Google Drive connection has expired or is not available. Would you like to reconnect now?",
}: GoogleDriveReconnectDialogProps) {
  const [isReconnecting, setIsReconnecting] = useState(false);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      // Get the Google Drive auth URL
      const response = await apiRequest("GET", "/api/google-drive/auth-url");
      const data = await response.json();

      if (data.authUrl) {
        // Open Google Drive auth in a new popup window
        const popup = window.open(
          data.authUrl, 
          "google-drive-auth", 
          "width=500,height=600,scrollbars=yes,resizable=yes"
        );
        
        if (!popup) {
          throw new Error("Popup blocked. Please allow popups and try again.");
        }

        // Poll for authentication completion
        const pollForCompletion = () => {
          return new Promise<boolean>((resolve) => {
            const pollInterval = setInterval(async () => {
              try {
                // Check if popup was closed manually
                if (popup.closed) {
                  clearInterval(pollInterval);
                  resolve(false);
                  return;
                }

                // Check if we can access the popup URL (same origin = auth completed)
                try {
                  const popupUrl = popup.location.href;
                  if (popupUrl && popupUrl.includes(window.location.origin)) {
                    // Authentication completed successfully
                    popup.close();
                    clearInterval(pollInterval);
                    resolve(true);
                    return;
                  }
                } catch (e) {
                  // Cross-origin error means still on Google auth page - continue polling
                }
              } catch (error) {
                console.log("Polling error (normal during auth):", error);
              }
            }, 1000); // Poll every second

            // Timeout after 5 minutes
            setTimeout(() => {
              clearInterval(pollInterval);
              if (!popup.closed) {
                popup.close();
              }
              resolve(false);
            }, 300000);
          });
        };

        const authCompleted = await pollForCompletion();
        
        if (authCompleted) {
          // Give a small delay for the tokens to be saved server-side
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Close the dialog and call success callback
          onOpenChange(false);
          onReconnectSuccess?.();
        }
      }
    } catch (error: any) {
      console.error("Failed to reconnect Google Drive:", error);
      // Show error in toast or alert
      alert(`Failed to reconnect Google Drive: ${error.message}`);
    } finally {
      setIsReconnecting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-600" />
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>{description}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <p className="font-medium">Why reconnect?</p>
              <ul className="mt-1 space-y-1 text-xs">
                <li>• Automatic backup of job documents</li>
                <li>• Clickable links in PDF job sheets</li>
                <li>• Easy sharing with clients and teams</li>
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Not Now</AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button 
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="gap-2"
            >
              {isReconnecting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <ExternalLink className="h-4 w-4" />
                  Reconnect Google Drive
                </>
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { RotateCcw, X } from "lucide-react";

export function SamsungRotationWarning() {
  const [showWarning, setShowWarning] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const isSamsungInternet = /SamsungBrowser/.test(navigator.userAgent);
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    const wasDismissed = localStorage.getItem('samsung-rotation-warning-dismissed') === 'true';
    
    if (isSamsungInternet && isStandalone && !wasDismissed) {
      setShowWarning(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowWarning(false);
    localStorage.setItem('samsung-rotation-warning-dismissed', 'true');
  };

  const handleOpenBrowser = () => {
    // Get current URL
    const currentUrl = window.location.href;
    // Try to open in browser (this may not work in all cases)
    window.open(currentUrl, '_blank');
  };

  if (!showWarning || dismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4">
      <Alert className="bg-amber-50 border-amber-200 text-amber-800">
        <RotateCcw className="h-4 w-4" />
        <AlertDescription className="pr-8">
          <strong>Rotation Limited:</strong> Samsung Internet PWAs can't rotate. For full rotation support, use the app in your browser instead.
          <div className="mt-2 flex gap-2">
            <Button 
              size="sm" 
              variant="outline" 
              onClick={handleOpenBrowser}
              className="text-xs"
            >
              Open in Browser
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={handleDismiss}
              className="text-xs"
            >
              Got it
            </Button>
          </div>
        </AlertDescription>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleDismiss}
          className="absolute top-1 right-1 h-6 w-6 p-0"
        >
          <X className="h-3 w-3" />
        </Button>
      </Alert>
    </div>
  );
}
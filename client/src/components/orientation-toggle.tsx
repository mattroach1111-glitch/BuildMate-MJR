import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

interface OrientationToggleProps {
  show?: boolean;
}

export function OrientationToggle({ show = false }: OrientationToggleProps) {
  const [isLandscape, setIsLandscape] = useState(false);

  // Only show toggle when explicitly requested (for job sheets and timesheets)
  if (!show) {
    return null;
  }

  const toggleOrientation = () => {
    setIsLandscape(!isLandscape);
    
    // Target the dialog content (job sheet or timesheet modal)
    const dialogContent = document.querySelector('[role="dialog"]');
    if (!dialogContent) return;

    if (!isLandscape) {
      // Switch to landscape - rotate the modal content
      dialogContent.style.transform = 'rotate(90deg)';
      dialogContent.style.transformOrigin = 'center center';
      dialogContent.style.width = '90vh';
      dialogContent.style.height = '90vw';
      dialogContent.style.maxWidth = '90vh';
      dialogContent.style.maxHeight = '90vw';
      
      // Center the rotated content
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const translateX = (viewportWidth - viewportHeight) / 2;
      const translateY = (viewportHeight - viewportWidth) / 2;
      
      dialogContent.style.transform = `translate(${translateX}px, ${translateY}px) rotate(90deg)`;
      
      // Adjust backdrop styling
      const backdrop = document.querySelector('[data-state="open"]');
      if (backdrop) {
        backdrop.style.overflow = 'hidden';
      }
    } else {
      // Switch back to portrait
      dialogContent.style.transform = '';
      dialogContent.style.transformOrigin = '';
      dialogContent.style.width = '';
      dialogContent.style.height = '';
      dialogContent.style.maxWidth = '';
      dialogContent.style.maxHeight = '';
      
      const backdrop = document.querySelector('[data-state="open"]');
      if (backdrop) {
        backdrop.style.overflow = '';
      }
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleOrientation}
      className={cn(
        "fixed top-4 right-4 z-[70] bg-white shadow-md border-2",
        isLandscape ? "border-blue-500" : "border-gray-300"
      )}
      data-testid="orientation-toggle"
    >
      {isLandscape ? (
        <Smartphone className="h-4 w-4" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
    </Button>
  );
}
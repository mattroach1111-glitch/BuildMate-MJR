import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Smartphone } from "lucide-react";
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
    
    const app = document.getElementById('app-container');
    if (!app) return;

    if (!isLandscape) {
      // Switch to landscape
      app.style.transform = 'rotate(90deg)';
      app.style.transformOrigin = 'center center';
      app.style.width = '100vh';
      app.style.height = '100vw';
      app.style.position = 'fixed';
      app.style.top = '0';
      app.style.left = '0';
      
      // Adjust body to prevent scrolling issues
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Center the rotated content
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const translateX = (viewportWidth - viewportHeight) / 2;
      const translateY = (viewportHeight - viewportWidth) / 2;
      
      app.style.transform = `translate(${translateX}px, ${translateY}px) rotate(90deg)`;
    } else {
      // Switch back to portrait
      app.style.transform = '';
      app.style.transformOrigin = '';
      app.style.width = '';
      app.style.height = '';
      app.style.position = '';
      app.style.top = '';
      app.style.left = '';
      
      document.body.style.overflow = '';
      document.documentElement.style.overflow = '';
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleOrientation}
      className={cn(
        "fixed top-4 right-4 z-50 bg-white shadow-md border-2",
        isLandscape ? "border-blue-500" : "border-gray-300"
      )}
      data-testid="orientation-toggle"
    >
      {isLandscape ? (
        <Smartphone className="h-4 w-4" />
      ) : (
        <RotateCcw className="h-4 w-4" />
      )}
    </Button>
  );
}
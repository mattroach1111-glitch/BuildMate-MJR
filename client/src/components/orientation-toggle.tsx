import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrientationToggle() {
  const [isLandscapeForced, setIsLandscapeForced] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if device is mobile or small screen
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                           window.innerHeight <= 600; // Also show on small screens
      console.log('Mobile check:', { 
        width: window.innerWidth, 
        height: window.innerHeight, 
        userAgent: navigator.userAgent,
        isMobileDevice 
      });
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isLandscapeForced) {
      // Force landscape orientation
      document.body.style.transform = 'rotate(90deg)';
      document.body.style.transformOrigin = 'center center';
      document.body.style.width = '100vh';
      document.body.style.height = '100vw';
      document.body.style.position = 'fixed';
      document.body.style.top = '0';
      document.body.style.left = '0';
      document.body.style.overflow = 'hidden';
      
      // Adjust the root container
      const root = document.getElementById('root');
      if (root) {
        root.style.width = '100vh';
        root.style.height = '100vw';
        root.style.overflow = 'auto';
        root.style.transform = 'none';
      }
    } else {
      // Reset to normal orientation
      document.body.style.transform = '';
      document.body.style.transformOrigin = '';
      document.body.style.width = '';
      document.body.style.height = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.overflow = '';
      
      const root = document.getElementById('root');
      if (root) {
        root.style.width = '';
        root.style.height = '';
        root.style.overflow = '';
        root.style.transform = '';
      }
    }
  }, [isLandscapeForced]);

  const toggleOrientation = () => {
    setIsLandscapeForced(!isLandscapeForced);
  };

  // For testing - always show the button
  // Later we can add back mobile-only detection
  console.log('Rendering orientation toggle - isMobile:', isMobile);

  return (
    <Button
      onClick={toggleOrientation}
      size="sm"
      variant={isLandscapeForced ? "default" : "outline"}
      className={cn(
        "fixed bottom-4 right-4 z-50 shadow-lg",
        "bg-white hover:bg-gray-50 border border-gray-300",
        isLandscapeForced && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
        "min-w-[100px] h-10" // Ensure button is visible
      )}
      title={isLandscapeForced ? "Switch to Portrait" : "Switch to Landscape"}
      data-testid="button-orientation-toggle"
    >
      {isLandscapeForced ? (
        <>
          <Smartphone className="h-4 w-4 mr-1" />
          <span className="text-xs">Portrait</span>
        </>
      ) : (
        <>
          <RotateCcw className="h-4 w-4 mr-1" />
          <span className="text-xs">Landscape</span>
        </>
      )}
    </Button>
  );
}
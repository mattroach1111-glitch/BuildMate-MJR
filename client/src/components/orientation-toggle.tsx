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

      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (isLandscapeForced) {
      // Force landscape orientation with better centering
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      
      // Calculate better positioning to center the rotated content
      const translateX = (vw - vh) / 2;
      const translateY = (vh - vw) / 2;
      
      document.body.style.transform = 'rotate(90deg)';
      document.body.style.transformOrigin = 'center center';
      document.body.style.width = `${vh}px`;
      document.body.style.height = `${vw}px`;
      document.body.style.position = 'fixed';
      document.body.style.top = `${(vh - vw) / 2 + 10}px`;
      document.body.style.left = `${(vw - vh) / 2}px`;
      document.body.style.overflow = 'hidden';
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      
      // Adjust the root container
      const root = document.getElementById('root');
      if (root) {
        root.style.width = `${vh}px`;
        root.style.height = `${vw}px`;
        root.style.overflow = 'auto';
        root.style.transform = 'none';
        root.style.position = 'relative';
      }
      
      // Add landscape class to html for additional styling
      document.documentElement.classList.add('landscape-mode');
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
      document.body.style.margin = '';
      document.body.style.padding = '';
      
      const root = document.getElementById('root');
      if (root) {
        root.style.width = '';
        root.style.height = '';
        root.style.overflow = '';
        root.style.transform = '';
        root.style.position = '';
      }
      
      // Remove landscape class
      document.documentElement.classList.remove('landscape-mode');
    }
  }, [isLandscapeForced]);

  const toggleOrientation = () => {
    setIsLandscapeForced(!isLandscapeForced);
  };

  // Show on mobile devices and small screens for better usability
  if (!isMobile && window.innerWidth > 768) {
    return null;
  }

  return (
    <Button
      onClick={toggleOrientation}
      size="sm"
      variant={isLandscapeForced ? "default" : "outline"}
      className={cn(
        "fixed z-50 shadow-lg transition-all duration-200",
        "bg-white hover:bg-gray-50 border border-gray-300",
        isLandscapeForced && "bg-blue-600 hover:bg-blue-700 text-white border-blue-600",
        "min-w-[100px] h-10",
        // Position based on orientation
        isLandscapeForced ? "bottom-4 left-4" : "bottom-4 right-4"
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
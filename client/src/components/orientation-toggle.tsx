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
      // Apply landscape transformation to the root element instead
      const root = document.getElementById('root');
      if (root) {
        const vh = window.innerHeight;
        const vw = window.innerWidth;
        
        // Transform the root container
        root.style.transform = 'rotate(90deg)';
        root.style.transformOrigin = 'center center';
        root.style.width = `${vh}px`;
        root.style.height = `${vw}px`;
        root.style.position = 'fixed';
        root.style.top = '50%';
        root.style.left = '50%';
        root.style.marginTop = `${-vw/2}px`;
        root.style.marginLeft = `${-vh/2}px`;
      }
      
      // Prevent scrolling on body
      document.body.style.overflow = 'hidden';
      document.documentElement.classList.add('landscape-mode');
    } else {
      // Reset everything
      const root = document.getElementById('root');
      if (root) {
        root.style.transform = '';
        root.style.transformOrigin = '';
        root.style.width = '';
        root.style.height = '';
        root.style.position = '';
        root.style.top = '';
        root.style.left = '';
        root.style.marginTop = '';
        root.style.marginLeft = '';
      }
      
      document.body.style.overflow = '';
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
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RotateCcw, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

export function OrientationToggle() {
  const [isLandscape, setIsLandscape] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [canRotate, setCanRotate] = useState(false);

  useEffect(() => {
    // Check if device is mobile and supports orientation API
    const checkMobile = () => {
      const isMobileDevice = window.innerWidth <= 768 || 
                           /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const hasOrientationAPI = 'screen' in window && 'orientation' in window.screen;
      
      setIsMobile(isMobileDevice);
      setCanRotate(hasOrientationAPI && isMobileDevice);
    };

    // Check current orientation
    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkMobile();
    checkOrientation();
    
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);
    
    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const toggleOrientation = async () => {
    if (!canRotate) return;

    try {
      const screen = window.screen as any;
      if (screen.orientation) {
        if (isLandscape) {
          // Switch to portrait
          await screen.orientation.lock('portrait-primary');
        } else {
          // Switch to landscape
          await screen.orientation.lock('landscape-primary');
        }
      }
    } catch (error) {
      console.log('Orientation lock not supported or failed:', error);
      // Fallback: just notify user to rotate manually
      alert('Please rotate your device manually to switch orientation');
    }
  };

  // Only show on mobile devices that support orientation
  if (!isMobile) {
    return null;
  }

  return (
    <Button
      onClick={toggleOrientation}
      size="sm"
      variant="outline"
      className={cn(
        "fixed bottom-4 right-4 z-50 shadow-lg transition-all duration-200",
        "bg-white hover:bg-gray-50 border border-gray-300",
        "min-w-[100px] h-10"
      )}
      title={isLandscape ? "Switch to Portrait" : "Switch to Landscape"}
      data-testid="button-orientation-toggle"
    >
      {isLandscape ? (
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
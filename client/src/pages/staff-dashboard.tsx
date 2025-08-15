import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ClipboardList, Users } from "lucide-react";
import PageLayout from "@/components/page-layout";
import { OnboardingTour, WelcomeAnimation } from "@/components/onboarding-tour";
import { useOnboarding } from "@/hooks/useOnboarding";
import { WeeklyOrganizer } from "@/components/weekly-organizer";

interface StaffDashboardProps {
  isAdminView?: boolean;
}

export default function StaffDashboard({ isAdminView = false }: StaffDashboardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { 
    showWelcome, 
    showTour, 
    isOnboardingComplete,
    startTour, 
    completeTour, 
    skipTour 
  } = useOnboarding();
  
  // Navigation state for staff dashboard
  const [currentPage, setCurrentPage] = useState<"home" | "organizer">("home");
  
  const handleViewFortnightTimesheet = () => {
    window.location.href = '/timesheet';
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <PageLayout 
      title={currentPage === "home" ? "BuildFlow Pro" : "Weekly Schedule"}
      subtitle={`Welcome back, ${(user as any)?.firstName || 'Staff'}`}
    >
      <div className="max-w-4xl mx-auto space-y-6" data-testid="container-dashboard">
        {currentPage === "home" && (
          /* Home Landing Page */
          <div className="min-h-[60vh] flex items-center justify-center">
            <div className="text-center space-y-8 max-w-md">
              <div className="space-y-4">
                <h1 className="text-3xl font-bold text-gray-900">Choose Your Task</h1>
                <p className="text-lg text-gray-600">What would you like to do today?</p>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Timesheet Button */}
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-blue-300"
                  onClick={handleViewFortnightTimesheet}
                  data-testid="card-timesheet"
                >
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center">
                      <ClipboardList className="h-8 w-8 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Timesheet</h3>
                      <p className="text-gray-600 mt-2">Log your work hours and manage entries</p>
                    </div>
                  </CardContent>
                </Card>

                {/* Organizer Button */}
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 hover:border-green-300"
                  onClick={() => setCurrentPage("organizer")}
                  data-testid="card-organizer"
                >
                  <CardContent className="p-8 text-center space-y-4">
                    <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                      <Users className="h-8 w-8 text-green-600" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Weekly Organizer</h3>
                      <p className="text-gray-600 mt-2">View weekly staff schedules</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {currentPage === "organizer" && (
          <div className="space-y-6">
            {/* Back to Home Button */}
            <div className="flex justify-start">
              <Button 
                variant="outline" 
                onClick={() => setCurrentPage("home")}
                className="flex items-center gap-2"
                data-testid="button-back-home"
              >
                <ChevronLeft className="h-4 w-4" />
                Back to Home
              </Button>
            </div>
            
            {/* Weekly Organizer */}
            <WeeklyOrganizer isAdminView={false} />
          </div>
        )}
      </div>

      {/* Onboarding Components - Only show for staff (not in admin view) */}
      {!isAdminView && showWelcome && (
        <WelcomeAnimation onComplete={startTour} />
      )}
      
      {!isAdminView && showTour && (
        <OnboardingTour 
          isOpen={showTour}
          onClose={skipTour}
          onComplete={completeTour}
        />
      )}
    </PageLayout>
  );
}
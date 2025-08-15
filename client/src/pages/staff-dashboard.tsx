import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Settings, ArrowRight } from "lucide-react";
import PageLayout from "@/components/page-layout";
import { OnboardingTour, WelcomeAnimation } from "@/components/onboarding-tour";
import { useOnboarding } from "@/hooks/useOnboarding";

interface StaffDashboardProps {
  isAdminView?: boolean;
}

export default function StaffDashboard({ isAdminView = false }: StaffDashboardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { 
    showWelcome, 
    showTour, 
    isOnboardingComplete,
    startTour, 
    completeTour, 
    skipTour 
  } = useOnboarding();

  const handleTimesheetClick = () => {
    window.location.href = '/timesheet';
  };

  const handleOrganiserClick = () => {
    // Coming soon - no action yet
  };

  if (isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600 mb-4">You need to be logged in to access this page.</p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Log In
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      {showWelcome && <WelcomeAnimation onComplete={() => {}} />}
      {showTour && (
        <OnboardingTour
          isAdmin={false}
          onComplete={completeTour}
          onSkip={skipTour}
        />
      )}

      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome
            </h1>
            <p className="text-gray-600">
              Choose what you'd like to access
            </p>
          </div>

          {/* Main Action Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Timesheets Card */}
            <Card 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-blue-200 hover:border-blue-400"
              onClick={handleTimesheetClick}
              data-testid="button-timesheets"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Timesheets
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  Track your work hours and manage timesheet entries
                </p>
                <div className="flex items-center justify-center text-blue-600 font-medium">
                  <span>Access Timesheets</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            {/* Organiser Card */}
            <Card 
              className="cursor-not-allowed opacity-75 border-2 border-gray-200 relative"
              onClick={handleOrganiserClick}
              data-testid="button-organiser"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-gray-500" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-700">
                  Organiser
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-500 mb-4">
                  Schedule management and job planning tools
                </p>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                  Coming Soon
                </Badge>
              </CardContent>
              
              {/* Coming Soon Overlay */}
              <div className="absolute inset-0 bg-white bg-opacity-50 rounded-lg pointer-events-none"></div>
            </Card>
          </div>

          {/* Quick Stats or Additional Info */}
          <div className="mt-12 text-center">
            <div className="bg-white rounded-lg shadow-sm border p-6 max-w-lg mx-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                BuildFlow Pro
              </h3>
              <p className="text-gray-600 text-sm">
                Mobile-optimized construction management system for tracking work hours and managing projects efficiently.
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
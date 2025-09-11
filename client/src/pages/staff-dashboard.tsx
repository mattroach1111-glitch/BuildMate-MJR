import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, Settings, ArrowRight, Trophy, BookOpen } from "lucide-react";
import { useLocation } from "wouter";
import PageLayout from "@/components/page-layout";


interface StaffDashboardProps {
  isAdminView?: boolean;
}

export default function StaffDashboard({ isAdminView = false }: StaffDashboardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  const handleTimesheetClick = () => {
    window.location.href = '/timesheet';
  };

  const handleOrganiserClick = () => {
    navigate('/organiser');
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
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
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
              className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-orange-200 hover:border-orange-400"
              onClick={handleOrganiserClick}
              data-testid="button-organiser"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-orange-100 rounded-full w-16 h-16 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-900">
                  Organiser
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  View your weekly schedule and job assignments
                </p>
                <div className="flex items-center justify-center text-orange-600 font-medium">
                  <span>View Schedule</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>

            {/* Rewards Card */}
            <Card 
              className="cursor-not-allowed opacity-75 border-2 border-gray-200 relative"
              data-testid="button-rewards"
            >
              <CardHeader className="text-center pb-4">
                <div className="mx-auto mb-4 p-4 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center">
                  <Trophy className="h-8 w-8 text-gray-500" />
                </div>
                <CardTitle className="text-xl font-semibold text-gray-700">
                  Rewards
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-500 mb-4">
                  Earn points and achievements for timely submissions
                </p>
                <Badge variant="secondary" className="bg-orange-100 text-orange-800 border-orange-200">
                  Coming Soon
                </Badge>
              </CardContent>
              
              {/* Coming Soon Overlay */}
              <div className="absolute inset-0 bg-white bg-opacity-50 rounded-lg pointer-events-none"></div>
            </Card>
          </div>

          {/* More Apps Section */}
          <div className="mt-12">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                More Apps
              </h2>
              <p className="text-gray-600">
                Additional tools and information
              </p>
            </div>

            <div className="flex justify-center max-w-2xl mx-auto">
              {/* Rewards Rules */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 border-2 border-blue-200 hover:border-blue-400"
                onClick={() => navigate("/rewards/rules")}
                data-testid="button-rewards-rules"
              >
                <CardHeader className="text-center pb-3">
                  <div className="mx-auto mb-3 p-3 bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    Rewards Rules
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-center">
                  <p className="text-gray-600 mb-3 text-sm">
                    Learn how to earn points and maintain streaks
                  </p>
                  <div className="flex items-center justify-center text-blue-600 font-medium text-sm">
                    <span>View Rules</span>
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>


            </div>
          </div>

          {/* BuildFlow Pro Info */}
          <div className="mt-8 text-center">
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
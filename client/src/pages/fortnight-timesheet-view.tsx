import { FortnightTimesheet } from "@/components/fortnight-timesheet";
// useAuth removed - using direct useQuery
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageLayout from "@/components/page-layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

export default function FortnightTimesheetView() {
  const { data: user } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30000,
  });
  const [, setLocation] = useLocation();
  const [employeeId, setEmployeeId] = useState<string>("");
  const [isAdminView, setIsAdminView] = useState<boolean>(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const employee = urlParams.get('employee');
    const admin = urlParams.get('admin');
    
    if (employee) {
      setEmployeeId(employee);
    }
    
    if (admin === 'true') {
      setIsAdminView(true);
    }
  }, []);

  const handleBackNavigation = () => {
    if ((user as any)?.role === "admin") {
      setLocation("/admin");
    } else {
      // For staff, this is their main page so no back navigation needed
      setLocation("/");
    }
  };

  const getTitle = () => {
    if (isAdminView && employeeId) {
      return "Staff Timesheet Management";
    }
    return "Fortnight Timesheet";
  };

  const getSubtitle = () => {
    if (isAdminView && employeeId) {
      return "Managing timesheet entries and approvals";
    }
    return "Track your hours and submit timesheet entries";
  };

  // For staff users, show only the timesheet table without any navigation
  if ((user as any)?.role !== "admin") {
    return (
      <div className="min-h-screen bg-white">
        <FortnightTimesheet 
          selectedEmployeeId=""
          isAdminView={false}
        />
      </div>
    );
  }

  return (
    <PageLayout 
      title={getTitle()}
      subtitle={getSubtitle()}
    >
      <div className="space-y-6">
        {/* Navigation Bar - Only show for admin viewing staff timesheets */}
        {isAdminView && employeeId && (
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={handleBackNavigation}
              className="flex items-center gap-2"
              data-testid="button-back-to-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Button>
          </div>
        )}

        {/* Admin users get full interface */}
        <div className="max-w-6xl mx-auto">
          <FortnightTimesheet 
            selectedEmployeeId={employeeId}
            isAdminView={isAdminView}
          />
        </div>
      </div>
    </PageLayout>
  );
}
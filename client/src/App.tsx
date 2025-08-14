import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { NotificationPopup } from "@/components/notification-popup";
import { SamsungRotationWarning } from "./components/SamsungRotationWarning";
// import { pushNotificationService } from "@/lib/pushNotifications";
import { useEffect } from "react";
import Landing from "@/pages/landing";
import AdminDashboard from "@/pages/admin-dashboard";
import { JobsList } from "@/pages/jobs-list";
import NotFound from "@/pages/not-found";
import FortnightTimesheetView from "@/pages/fortnight-timesheet-view";
import StaffTimesheet from "@/pages/staff-timesheet";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {!isAuthenticated ? (
        <Route path="/" component={Landing} />
      ) : (user as any)?.role === "admin" ? (
        <>
          <Route path="/" component={AdminDashboard} />
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/jobs" component={JobsList} />
          <Route path="/timesheet" component={FortnightTimesheetView} />
          <Route path="/staff" component={AdminDashboard} />
        </>
      ) : (
        <>
          <Route path="/" component={FortnightTimesheetView} />
          <Route path="/staff" component={FortnightTimesheetView} />
          <Route path="/timesheet" component={FortnightTimesheetView} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  
  // Auto-register for push notifications when user is authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      // Temporarily disabled push notifications while fixing import issues
      console.log('Push notifications temporarily disabled');
    }
  }, [isAuthenticated, user]);
  
  return (
    <TooltipProvider>
      <SamsungRotationWarning />
      <Toaster />
      <Router />
      <NotificationPopup userEmail={(user as any)?.email} />
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

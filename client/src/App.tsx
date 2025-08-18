import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { NotificationPopup } from "@/components/notification-popup";
import { PWAInstallPrompt } from "./components/pwa-install-prompt";
import { OrientationToggle } from "./components/orientation-toggle";
import Landing from "@/pages/landing";
import AdminDashboard from "@/pages/admin-dashboard";
import StaffDashboard from "@/pages/staff-dashboard";
import { JobsList } from "@/pages/jobs-list";
import NotFound from "@/pages/not-found";
import FortnightTimesheetView from "@/pages/fortnight-timesheet-view";
import StaffTimesheet from "@/pages/staff-timesheet";
import StaffNotes from "@/pages/staff-notes-clean";
import RewardsDashboard from "@/pages/rewards-dashboard";
import RewardsRules from "@/pages/rewards-rules";
import AdminRewards from "@/pages/admin-rewards";

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
          <Route path="/staff-notes" component={StaffNotes} />
          <Route path="/rewards" component={RewardsDashboard} />
          <Route path="/rewards/rules" component={RewardsRules} />
          <Route path="/admin/rewards" component={AdminRewards} />
        </>
      ) : (
        <>
          <Route path="/" component={() => <StaffDashboard isAdminView={false} />} />
          <Route path="/staff" component={() => <StaffDashboard isAdminView={false} />} />
          <Route path="/timesheet" component={FortnightTimesheetView} />
          <Route path="/rewards" component={RewardsDashboard} />
          <Route path="/rewards/rules" component={RewardsRules} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, isAuthenticated } = useAuth();
  
  return (
    <>
      <Router />
      <NotificationPopup userEmail={(user as any)?.email} />
      {isAuthenticated && <PWAInstallPrompt />}
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div id="app-container">
          <Toaster />
          <AppContent />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

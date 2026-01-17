import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useSessionKeepalive } from "@/hooks/use-session-keepalive";
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
import StaffOrganiser from "@/pages/staff-organiser";
import SwmsDocuments from "@/pages/swms-documents";
import AdminSwms from "@/pages/admin-swms";
import QuotesPage from "@/pages/quotes";
import PublicQuoteView from "@/pages/public-quote-view";
import CostLibraryPage from "@/pages/cost-library";

function Router() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  useSessionKeepalive();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/quote/view/:token" component={PublicQuoteView} />
      {!isAuthenticated ? (
        <>
          <Route path="/" component={Landing} />
          <Route component={Landing} />
        </>
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
          <Route path="/swms" component={SwmsDocuments} />
          <Route path="/admin/swms" component={AdminSwms} />
          <Route path="/quotes" component={QuotesPage} />
          <Route path="/cost-library" component={CostLibraryPage} />
          <Route component={NotFound} />
        </>
      ) : (
        <>
          <Route path="/" component={() => <StaffDashboard isAdminView={false} />} />
          <Route path="/staff" component={() => <StaffDashboard isAdminView={false} />} />
          <Route path="/timesheet" component={FortnightTimesheetView} />
          <Route path="/organiser" component={StaffOrganiser} />
          <Route path="/rewards" component={RewardsDashboard} />
          <Route path="/rewards/rules" component={RewardsRules} />
          <Route path="/swms" component={SwmsDocuments} />
          <Route component={NotFound} />
        </>
      )}
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <div id="app-container">
          <Router />
          <Toaster />
          <NotificationPopup />
          <PWAInstallPrompt />
          <OrientationToggle />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

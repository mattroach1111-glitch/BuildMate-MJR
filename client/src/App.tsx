import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
// NO USEAUTH IMPORTS - REMOVED TO FIX REACT HOOKS ERRORS
import Landing from "@/pages/landing";
import AdminDashboard from "@/pages/admin-dashboard";
import { JobsList } from "@/pages/jobs-list";
import NotFound from "@/pages/not-found";
import FortnightTimesheetView from "@/pages/fortnight-timesheet-view";
import StaffTimesheet from "@/pages/staff-timesheet";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(registration => {
    console.log('Service Worker registered successfully:', registration);
  }).catch(error => {
    console.log('Service Worker registration failed:', error);
  });
}

function Router() {
  console.log('Router component rendering');
  const { data: user, isLoading, error } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30000,
  });
  
  console.log('Router state:', { user, isLoading, error });
  const isAuthenticated = !!user;

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
  console.log('AppContent component rendering');
  return (
    <div>
      <Router />
    </div>
  );
}

function App() {
  console.log('App component rendering with restored QueryClient');
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

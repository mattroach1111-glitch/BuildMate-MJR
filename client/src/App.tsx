import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Router } from 'wouter'
import { queryClient } from './lib/queryClient'
import { Button } from './components/ui/button'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-background">
          <main className="container mx-auto px-4 py-8">
            <Route path="/" component={HomePage} />
            <Route path="/dashboard" component={Dashboard} />
          </main>
        </div>
      </Router>
    </QueryClientProvider>
  )
}

function HomePage() {
  return (
    <div className="text-center">
      <h1 className="text-4xl font-bold mb-4">Business Management Platform</h1>
      <p className="text-lg text-muted-foreground mb-8">
        Workforce productivity and financial tracking with advanced diagnostics
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-2">Job Tracking</h2>
          <p className="text-muted-foreground mb-4">AI-powered job cost and labor tracking</p>
          <Button size="sm">View Jobs</Button>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-2">Financial Insights</h2>
          <p className="text-muted-foreground mb-4">Real-time financial tracking and reporting</p>
          <Button size="sm" variant="secondary">View Reports</Button>
        </div>
        <div className="p-6 border rounded-lg bg-card">
          <h2 className="text-xl font-semibold mb-2">Notifications</h2>
          <p className="text-muted-foreground mb-4">Multi-service integrations and alerts</p>
          <Button size="sm" variant="outline">Settings</Button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <p>Welcome to your business management dashboard.</p>
    </div>
  )
}

export default App
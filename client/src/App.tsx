import React from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Route, Router } from 'wouter'
import { queryClient } from './lib/queryClient'
import { Button } from './components/ui/button'

export default function App() {
  console.log('App component rendering...')
  
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
    <div className="text-center" data-testid="homepage-container">
      <h1 className="text-4xl font-bold mb-4" data-testid="text-main-title">Business Management Platform</h1>
      <p className="text-lg text-muted-foreground mb-8" data-testid="text-subtitle">
        Workforce productivity and financial tracking with advanced diagnostics
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-feature-cards">
        <div className="p-6 border rounded-lg bg-card" data-testid="card-job-tracking">
          <h2 className="text-xl font-semibold mb-2" data-testid="text-job-tracking-title">Job Tracking</h2>
          <p className="text-muted-foreground mb-4" data-testid="text-job-tracking-description">AI-powered job cost and labor tracking</p>
          <Button size="sm" data-testid="button-view-jobs">View Jobs</Button>
        </div>
        <div className="p-6 border rounded-lg bg-card" data-testid="card-financial-insights">
          <h2 className="text-xl font-semibold mb-2" data-testid="text-financial-insights-title">Financial Insights</h2>
          <p className="text-muted-foreground mb-4" data-testid="text-financial-insights-description">Real-time financial tracking and reporting</p>
          <Button size="sm" variant="secondary" data-testid="button-view-reports">View Reports</Button>
        </div>
        <div className="p-6 border rounded-lg bg-card" data-testid="card-notifications">
          <h2 className="text-xl font-semibold mb-2" data-testid="text-notifications-title">Notifications</h2>
          <p className="text-muted-foreground mb-4" data-testid="text-notifications-description">Multi-service integrations and alerts</p>
          <Button size="sm" variant="outline" data-testid="button-settings">Settings</Button>
        </div>
      </div>
    </div>
  )
}

function Dashboard() {
  return (
    <div data-testid="dashboard-container">
      <h1 className="text-3xl font-bold mb-6" data-testid="text-dashboard-title">Dashboard</h1>
      <p data-testid="text-dashboard-welcome">Welcome to your business management dashboard.</p>
    </div>
  )
}


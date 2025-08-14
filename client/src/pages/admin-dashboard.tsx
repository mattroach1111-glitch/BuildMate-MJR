import { Button } from '@/components/ui/button'

export default function AdminDashboard() {
  return (
    <div className="min-h-screen bg-background p-6" data-testid="admin-dashboard-container">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2" data-testid="text-admin-title">
            Admin Dashboard
          </h1>
          <p className="text-muted-foreground" data-testid="text-admin-subtitle">
            Manage jobs, staff, and business operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="grid-admin-cards">
          <div className="bg-card p-6 rounded-lg border shadow-sm" data-testid="card-jobs">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-jobs-title">Jobs</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-jobs-description">
              Manage construction jobs and track progress
            </p>
            <Button data-testid="button-manage-jobs">Manage Jobs</Button>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm" data-testid="card-staff">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-staff-title">Staff</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-staff-description">
              View staff timesheets and manage workforce
            </p>
            <Button data-testid="button-manage-staff">Manage Staff</Button>
          </div>

          <div className="bg-card p-6 rounded-lg border shadow-sm" data-testid="card-reports">
            <h2 className="text-xl font-semibold mb-4" data-testid="text-reports-title">Reports</h2>
            <p className="text-muted-foreground mb-4" data-testid="text-reports-description">
              Financial tracking and business analytics
            </p>
            <Button data-testid="button-view-reports">View Reports</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
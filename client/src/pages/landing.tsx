import { Button } from '@/components/ui/button'

export default function Landing() {
  const handleSignIn = () => {
    window.location.href = '/api/auth/login'
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4" data-testid="landing-container">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8" data-testid="card-signin">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-app-title">
            BuildFlow Pro
          </h1>
          <p className="text-gray-600" data-testid="text-app-description">
            Construction Management System
          </p>
        </div>
        
        <div className="space-y-4">
          <Button 
            onClick={handleSignIn}
            className="w-full"
            data-testid="button-signin"
          >
            Sign In with Replit
          </Button>
        </div>
        
        <div className="mt-6 text-center text-sm text-gray-500">
          <p data-testid="text-features">Job costing • Workforce management • Financial tracking</p>
        </div>
      </div>
    </div>
  )
}
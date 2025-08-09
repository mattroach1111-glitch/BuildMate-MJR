import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Landing() {
  const handleLogin = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary to-blue-700 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center">
          <div className="bg-primary text-white rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
            <i className="fas fa-hard-hat text-2xl"></i>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2" data-testid="text-app-title">
            BuildFlow Pro
          </h1>
          <p className="text-gray-600 mb-8" data-testid="text-app-subtitle">
            Construction Management System
          </p>
          
          <div className="space-y-4">
            <Button 
              onClick={handleLogin}
              className="w-full bg-primary hover:bg-blue-700 text-white py-3"
              data-testid="button-login"
            >
              Sign In
            </Button>
            
            <div className="text-sm text-gray-600">
              <p className="mb-2">Access your:</p>
              <ul className="space-y-1">
                <li>• Job costing and billing (Admin)</li>
                <li>• Staff timesheets</li>
                <li>• Project management tools</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

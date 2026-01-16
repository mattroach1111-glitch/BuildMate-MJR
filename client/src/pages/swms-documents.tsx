import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, ExternalLink, Shield, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useLocation } from "wouter";
import PageLayout from "@/components/page-layout";
import { useAuth } from "@/hooks/useAuth";

interface SwmsTemplate {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  originalName: string;
  objectPath: string;
  mimeType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export default function SwmsDocuments() {
  const [, navigate] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const { data: templates, isLoading, error } = useQuery<SwmsTemplate[]>({
    queryKey: ["/api/swms/templates"],
    enabled: isAuthenticated,
  });

  if (authLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600 mb-4">You need to be logged in to access this page.</p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Log In
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-3xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/staff")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-green-100 rounded-lg">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                Safety Documents
              </h1>
            </div>
            <p className="text-gray-600">
              Review Safe Work Method Statements (SWMS) for all work activities. 
              You will be asked to sign these documents when you first log hours on a new job.
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-amber-800 mb-1">Important</h3>
            <p className="text-sm text-amber-700">
              These SWMS documents outline safety procedures that must be followed on all job sites. 
              Please familiarize yourself with these documents. When you start work on a new job, 
              you will be required to sign these documents confirming you understand and will follow 
              the safety procedures.
            </p>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-6 w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-4 w-full mb-2" />
                    <Skeleton className="h-10 w-32" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : error ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-red-600">Failed to load SWMS documents. Please try again later.</p>
              </CardContent>
            </Card>
          ) : templates && templates.length > 0 ? (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <FileText className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{template.title}</CardTitle>
                          <Badge variant="outline" className="mt-1">
                            PDF Document
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {template.description && (
                      <p className="text-gray-600 mb-4">{template.description}</p>
                    )}
                    <Button 
                      onClick={() => window.open(`/api/swms/templates/${template.id}/file`, "_blank")}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      View Document
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <div className="mx-auto mb-4 p-4 bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No SWMS Documents</h3>
                <p className="text-gray-600">
                  No safety documents have been uploaded yet. Contact your administrator.
                </p>
              </CardContent>
            </Card>
          )}

          <div className="mt-8 text-center text-sm text-gray-500">
            <p>
              If you have questions about these safety procedures, please speak with your supervisor.
            </p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

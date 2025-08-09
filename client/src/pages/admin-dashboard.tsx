import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertJobSchema } from "@shared/schema";
import { z } from "zod";
import JobSheetModal from "@/components/job-sheet-modal";
import { generateJobPDF } from "@/lib/pdfGenerator";
import type { Job } from "@shared/schema";

const jobFormSchema = insertJobSchema.extend({
  builderMargin: z.string().min(1, "Builder margin is required"),
});

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobFormSchema>) => {
      const response = await apiRequest("POST", "/api/jobs", {
        ...data,
        builderMargin: parseFloat(data.builderMargin),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsCreateJobOpen(false);
      toast({
        title: "Success",
        description: "Job created successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      jobNumber: "",
      clientName: "",
      projectName: "",
      status: "planning",
      builderMargin: "25",
      tipFees: "0",
      permits: "0",
      equipment: "0",
      miscellaneous: "0",
    },
  });

  const onSubmit = (data: z.infer<typeof jobFormSchema>) => {
    createJobMutation.mutate(data);
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      planning: "outline",
      in_progress: "default",
      completed: "secondary",
      billed: "destructive",
    };
    return (
      <Badge variant={variants[status] || "default"}>
        {status.replace("_", " ").toUpperCase()}
      </Badge>
    );
  };

  const calculateJobTotal = (job: Job) => {
    // This is a simplified calculation - the actual calculation would be done in the JobSheetModal
    return 0;
  };

  const handleDownloadPDF = async (job: Job) => {
    try {
      await generateJobPDF(job);
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <div className="bg-primary text-white rounded-lg w-10 h-10 flex items-center justify-center">
              <i className="fas fa-hard-hat"></i>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800" data-testid="text-app-name">
                BuildFlow Pro
              </h1>
              <p className="text-sm text-gray-600" data-testid="text-dashboard-type">
                Admin Dashboard
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600" data-testid="text-user-info">
              {(user as any)?.firstName || (user as any)?.email} (Admin)
            </span>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <i className="fas fa-sign-out-alt"></i>
            </Button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white shadow-sm h-screen sticky top-0">
          <div className="p-6">
            <Tabs defaultValue="jobs" className="space-y-4">
              <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="jobs" data-testid="tab-job-sheets">
                  <i className="fas fa-file-spreadsheet mr-2"></i>
                  Job Sheets
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          <div className="space-y-6">
            {/* Header with Actions */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">
                  Job Sheets
                </h2>
                <p className="text-gray-600" data-testid="text-page-description">
                  Manage project costs and billing
                </p>
              </div>
              <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-blue-700" data-testid="button-new-job">
                    <i className="fas fa-plus mr-2"></i>
                    New Job Sheet
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle data-testid="text-create-job-title">Create New Job</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="jobNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Job Number</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="JOB-2024-001" 
                                {...field} 
                                data-testid="input-job-number"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Client Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Smith Residence" 
                                {...field} 
                                data-testid="input-client-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="projectName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Project Name</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Kitchen Renovation" 
                                {...field} 
                                data-testid="input-project-name"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-status">
                                  <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="planning">Planning</SelectItem>
                                <SelectItem value="in_progress">In Progress</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="billed">Billed</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="builderMargin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Builder Margin (%)</FormLabel>
                            <FormControl>
                              <Input 
                                type="number" 
                                placeholder="25" 
                                {...field} 
                                data-testid="input-builder-margin"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={() => setIsCreateJobOpen(false)}
                          data-testid="button-cancel-job"
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          disabled={createJobMutation.isPending}
                          data-testid="button-create-job"
                        >
                          {createJobMutation.isPending ? "Creating..." : "Create Job"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {/* Jobs List */}
            <Card>
              <CardHeader>
                <CardTitle data-testid="text-jobs-list-title">Active Jobs</CardTitle>
              </CardHeader>
              <CardContent>
                {jobsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : !jobs || (jobs as any[]).length === 0 ? (
                  <div className="text-center py-8 text-gray-500" data-testid="text-no-jobs">
                    No jobs found. Create your first job to get started.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                            Job #
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                            Client
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                            Project
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                            Status
                          </th>
                          <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {(jobs as Job[]).map((job: Job) => (
                          <tr key={job.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm font-medium text-gray-800" data-testid={`text-job-number-${job.id}`}>
                              {job.jobNumber}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600" data-testid={`text-client-${job.id}`}>
                              {job.clientName}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600" data-testid={`text-project-${job.id}`}>
                              {job.projectName}
                            </td>
                            <td className="px-6 py-4" data-testid={`badge-status-${job.id}`}>
                              {getStatusBadge(job.status)}
                            </td>
                            <td className="px-6 py-4 space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedJob(job.id)}
                                data-testid={`button-edit-job-${job.id}`}
                              >
                                <i className="fas fa-edit text-primary"></i>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadPDF(job)}
                                data-testid={`button-download-pdf-${job.id}`}
                              >
                                <i className="fas fa-download text-secondary"></i>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>

      {/* Job Sheet Modal */}
      {selectedJob && (
        <JobSheetModal
          jobId={selectedJob}
          isOpen={!!selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}

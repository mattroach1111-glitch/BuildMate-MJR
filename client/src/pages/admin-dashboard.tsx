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
import { insertJobSchema, insertEmployeeSchema } from "@shared/schema";
import { z } from "zod";
import JobSheetModal from "@/components/job-sheet-modal";
import { Plus, Users, Briefcase, Trash2 } from "lucide-react";
import type { Job, Employee } from "@shared/schema";

const jobFormSchema = insertJobSchema.extend({
  builderMargin: z.string()
    .min(1, "Builder margin is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Builder margin must be a valid number"),
  defaultHourlyRate: z.string()
    .min(1, "Default hourly rate is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Default hourly rate must be a positive number"),
});

const employeeFormSchema = insertEmployeeSchema;

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);

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

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  const { data: employees, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    retry: false,
  });

  const createJobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobFormSchema>) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsCreateJobOpen(false);
      toast({
        title: "Success",
        description: "Job created successfully",
      });
      jobForm.reset();
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
        description: "Failed to create job",
        variant: "destructive",
      });
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof employeeFormSchema>) => {
      const response = await apiRequest("POST", "/api/employees", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setIsCreateEmployeeOpen(false);
      toast({
        title: "Success",
        description: "Employee added successfully",
      });
      employeeForm.reset();
    },
    onError: (error) => {
      console.error("Employee creation failed:", error);
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
        description: error.message || "Failed to add employee",
        variant: "destructive",
      });
    },
  });



  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      await apiRequest("DELETE", `/api/employees/${employeeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: "Employee removed successfully",
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
        description: "Failed to remove employee",
        variant: "destructive",
      });
    },
  });

  const jobForm = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      jobAddress: "",
      clientName: "",
      projectName: "",
      status: "new_job",
      builderMargin: "25",
      defaultHourlyRate: "50",
    },
  });

  const employeeForm = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const onJobSubmit = (data: z.infer<typeof jobFormSchema>) => {
    createJobMutation.mutate(data);
  };

  const onEmployeeSubmit = (data: z.infer<typeof employeeFormSchema>) => {
    createEmployeeMutation.mutate(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "new_job":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "job_in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "job_complete":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "ready_for_billing":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || (user as any)?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <h1 className="text-2xl font-bold text-destructive mb-4">Access Denied</h1>
        <p className="text-muted-foreground mb-4">You need admin access to view this page.</p>
        <Button onClick={() => window.location.href = "/api/logout"} data-testid="button-logout">
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground" data-testid="text-dashboard-title">
            BuildFlow Pro - Admin Dashboard
          </h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {(user as any)?.firstName || 'Admin'}
          </p>
        </div>
        <Button 
          onClick={() => window.location.href = "/api/logout"}
          className="w-full sm:w-auto"
          variant="outline"
          data-testid="button-logout"
        >
          Logout
        </Button>
      </div>

      {/* Mobile-First Tabs */}
      <Tabs defaultValue="jobs" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
        </TabsList>

        {/* Jobs Tab */}
        <TabsContent value="jobs" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Job Management</h2>
            <Dialog open={isCreateJobOpen} onOpenChange={setIsCreateJobOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" data-testid="button-create-job">
                  <Plus className="h-4 w-4 mr-2" />
                  New Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md mx-4 sm:max-w-lg" aria-describedby="create-job-description">
                <DialogHeader>
                  <DialogTitle>Create New Job</DialogTitle>
                  <p id="create-job-description" className="text-sm text-muted-foreground">
                    Add a new construction job with client details and project information.
                  </p>
                </DialogHeader>
                <Form {...jobForm}>
                  <form onSubmit={jobForm.handleSubmit(onJobSubmit)} className="space-y-4">
                    <FormField
                      control={jobForm.control}
                      name="jobAddress"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job Address</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter job address" {...field} data-testid="input-job-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Client Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter client name" {...field} data-testid="input-client-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="projectName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project name" {...field} data-testid="input-project-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={jobForm.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-job-status">
                                <SelectValue placeholder="Select status" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="new_job">New Job</SelectItem>
                              <SelectItem value="job_in_progress">Job In Progress</SelectItem>
                              <SelectItem value="job_complete">Job Complete</SelectItem>
                              <SelectItem value="ready_for_billing">Ready For Billing</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={jobForm.control}
                        name="builderMargin"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Builder Margin (%)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="25" {...field} data-testid="input-builder-margin" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={jobForm.control}
                        name="defaultHourlyRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Default Rate ($)</FormLabel>
                            <FormControl>
                              <Input type="number" placeholder="50" {...field} data-testid="input-default-rate" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateJobOpen(false)}
                        className="flex-1"
                        data-testid="button-cancel-job"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createJobMutation.isPending}
                        className="flex-1"
                        data-testid="button-submit-job"
                      >
                        {createJobMutation.isPending ? "Creating..." : "Create Job"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Jobs Grid */}
          {jobsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {jobs?.map((job) => (
                <Card 
                  key={job.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedJob(job.id)}
                  data-testid={`card-job-${job.id}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg leading-tight">{job.jobAddress}</CardTitle>
                      <Badge className={`${getStatusColor(job.status)} text-xs shrink-0 ml-2`}>
                        {formatStatus(job.status)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">{job.clientName}</p>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-2">{job.projectName}</p>
                    <div className="text-xs text-muted-foreground">
                      Rate: ${job.defaultHourlyRate}/hr • Margin: {job.builderMargin}%
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {jobs && jobs.length === 0 && !jobsLoading && (
            <Card className="p-8 text-center">
              <Briefcase className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No jobs yet</h3>
              <p className="text-muted-foreground mb-4">Create your first job to get started</p>
              <Button onClick={() => setIsCreateJobOpen(true)} data-testid="button-create-first-job">
                <Plus className="h-4 w-4 mr-2" />
                Create First Job
              </Button>
            </Card>
          )}
        </TabsContent>

        {/* Employees Tab */}
        <TabsContent value="employees" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Staff Management</h2>
            <Dialog open={isCreateEmployeeOpen} onOpenChange={setIsCreateEmployeeOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" data-testid="button-add-employee">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Staff
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md mx-4" aria-describedby="add-employee-description">
                <DialogHeader>
                  <DialogTitle>Add New Staff Member</DialogTitle>
                  <p id="add-employee-description" className="text-sm text-muted-foreground">
                    Add a new employee to your staff list for timesheet management.
                  </p>
                </DialogHeader>
                <Form {...employeeForm}>
                  <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
                    <FormField
                      control={employeeForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter employee name" {...field} data-testid="input-employee-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsCreateEmployeeOpen(false)}
                        className="flex-1"
                        data-testid="button-cancel-employee"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createEmployeeMutation.isPending}
                        className="flex-1"
                        data-testid="button-submit-employee"
                      >
                        {createEmployeeMutation.isPending ? "Adding..." : "Add Staff"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Employees List */}
          {employeesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {employees?.map((employee) => (
                <Card key={employee.id} data-testid={`card-employee-${employee.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{employee.name}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            Staff Member
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                        disabled={deleteEmployeeMutation.isPending}
                        data-testid={`button-delete-employee-${employee.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {employees && employees.length === 0 && !employeesLoading && (
            <Card className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No staff members yet</h3>
              <p className="text-muted-foreground mb-4">Add your first staff member to get started</p>
              <Button onClick={() => setIsCreateEmployeeOpen(true)} data-testid="button-add-first-employee">
                <Plus className="h-4 w-4 mr-2" />
                Add First Staff Member
              </Button>
            </Card>
          )}
        </TabsContent>
      </Tabs>

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
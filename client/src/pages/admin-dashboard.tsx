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
import { Plus, Users, Briefcase, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, MoreVertical, Clock, Calendar, CheckCircle, XCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Job, Employee, TimesheetEntry } from "@shared/schema";
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";

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
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'client' | 'manager' | 'none'>('client');
  const [searchQuery, setSearchQuery] = useState("");

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

  const { data: allTimesheets, isLoading: timesheetsLoading } = useQuery({
    queryKey: ["/api/admin/timesheets"],
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

  const updateJobStatusMutation = useMutation({
    mutationFn: async ({ jobId, status }: { jobId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Success",
        description: "Job status updated successfully",
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
        description: "Failed to update job status",
        variant: "destructive",
      });
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Success",
        description: "Job deleted successfully",
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
        description: "Failed to delete job",
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

  const approveTimesheetMutation = useMutation({
    mutationFn: async ({ id, approved }: { id: string; approved: boolean }) => {
      await apiRequest("PATCH", `/api/admin/timesheet/${id}/approve`, { approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      toast({
        title: "Success",
        description: "Timesheet approval updated",
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
        description: "Failed to update timesheet approval",
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
      builderMargin: "0",
      defaultHourlyRate: "0",
    },
  });

  // Status priority for sorting
  const getStatusPriority = (status: string): number => {
    const statusOrder = {
      'new_job': 1,
      'job_in_progress': 2,
      'job_complete': 3,
      'ready_for_billing': 4
    };
    return statusOrder[status as keyof typeof statusOrder] || 5;
  };

  const sortJobsByStatus = (jobs: Job[]): Job[] => {
    return [...jobs].sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
  };

  // Filter jobs based on search query
  const filteredJobs = jobs ? jobs.filter(job => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      job.jobAddress.toLowerCase().includes(query) ||
      job.clientName.toLowerCase().includes(query) ||
      job.projectName.toLowerCase().includes(query) ||
      job.status.toLowerCase().includes(query)
    );
  }) : [];

  // Group filtered jobs by client or project manager
  const groupedJobs = filteredJobs ? (() => {
    if (groupBy === 'none') return { 'All Jobs': sortJobsByStatus(filteredJobs) };
    
    // Separate ready for billing jobs
    const readyForBillingJobs = filteredJobs.filter(job => job.status === 'ready_for_billing');
    const otherJobs = filteredJobs.filter(job => job.status !== 'ready_for_billing');
    
    if (groupBy === 'client') {
      const groups: Record<string, Job[]> = {};
      
      // Add ready for billing group first if there are any
      if (readyForBillingJobs.length > 0) {
        groups['🧾 Ready for Billing'] = readyForBillingJobs;
      }
      
      // Group other jobs by client
      const clientGroups = otherJobs.reduce((groups, job) => {
        const client = job.clientName || 'Unknown Client';
        if (!groups[client]) groups[client] = [];
        groups[client].push(job);
        return groups;
      }, {} as Record<string, Job[]>);
      
      // Sort jobs within each client group by status
      Object.keys(clientGroups).forEach(client => {
        clientGroups[client] = sortJobsByStatus(clientGroups[client]);
        groups[client] = clientGroups[client];
      });
      
      return groups;
    }
    
    if (groupBy === 'manager') {
      const groups: Record<string, Job[]> = {};
      
      // Add ready for billing group first if there are any
      if (readyForBillingJobs.length > 0) {
        groups['🧾 Ready for Billing'] = readyForBillingJobs;
      }
      
      // Group other jobs by manager
      const managerGroups = otherJobs.reduce((groups, job) => {
        const manager = job.projectName || 'Unknown Manager';
        if (!groups[manager]) groups[manager] = [];
        groups[manager].push(job);
        return groups;
      }, {} as Record<string, Job[]>);
      
      // Sort jobs within each manager group by status
      Object.keys(managerGroups).forEach(manager => {
        managerGroups[manager] = sortJobsByStatus(managerGroups[manager]);
        groups[manager] = managerGroups[manager];
      });
      
      return groups;
    }
    
    return {};
  })() : {};

  const toggleClientExpanded = (client: string) => {
    const newExpanded = new Set(expandedClients);
    if (newExpanded.has(client)) {
      newExpanded.delete(client);
    } else {
      newExpanded.add(client);
    }
    setExpandedClients(newExpanded);
  };

  const toggleManagerExpanded = (manager: string) => {
    const newExpanded = new Set(expandedManagers);
    if (newExpanded.has(manager)) {
      newExpanded.delete(manager);
    } else {
      newExpanded.add(manager);
    }
    setExpandedManagers(newExpanded);
  };

  // Check if a group is the special "Ready for Billing" group
  const isReadyForBillingGroup = (groupName: string) => groupName === '🧾 Ready for Billing';

  // Special state for Ready for Billing folder
  const [readyForBillingExpanded, setReadyForBillingExpanded] = useState(true);

  const toggleReadyForBillingExpanded = () => {
    setReadyForBillingExpanded(!readyForBillingExpanded);
  };

  // Auto-expand folders when switching to a grouping mode
  useEffect(() => {
    if (groupBy === 'client' && jobs) {
      const clientGroups = jobs.reduce((groups, job) => {
        const client = job.clientName || 'Unknown Client';
        if (!groups[client]) groups[client] = [];
        groups[client].push(job);
        return groups;
      }, {} as Record<string, Job[]>);
      
      // Auto-expand clients with multiple jobs
      const autoExpand = Object.entries(clientGroups)
        .filter(([_, jobs]) => jobs.length > 1)
        .map(([client, _]) => client);
      setExpandedClients(new Set(autoExpand));
    }
    
    if (groupBy === 'manager' && jobs) {
      const managerGroups = jobs.reduce((groups, job) => {
        const manager = job.projectName || 'Unknown Manager';
        if (!groups[manager]) groups[manager] = [];
        groups[manager].push(job);
        return groups;
      }, {} as Record<string, Job[]>);
      
      // Auto-expand managers with multiple jobs
      const autoExpand = Object.entries(managerGroups)
        .filter(([_, jobs]) => jobs.length > 1)
        .map(([manager, _]) => manager);
      setExpandedManagers(new Set(autoExpand));
    }
  }, [groupBy, jobs]);

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
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timesheets</span>
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
                          <FormLabel>Project Manager</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter project manager name" {...field} data-testid="input-project-manager" />
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
                              <Input type="number" placeholder="0" {...field} data-testid="input-builder-margin" />
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
                              <Input type="number" placeholder="0" {...field} data-testid="input-default-rate" />
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

          {/* Search and Group Controls */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search jobs by address, client, manager, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                data-testid="input-search-jobs"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={groupBy === 'client' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setGroupBy('client')}
                data-testid="button-group-by-client"
              >
                <Folder className="h-4 w-4 mr-1" />
                Group by Client
              </Button>
              <Button 
                variant={groupBy === 'manager' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setGroupBy('manager')}
                data-testid="button-group-by-manager"
              >
                <Folder className="h-4 w-4 mr-1" />
                Group by Manager
              </Button>
              <Button 
                variant={groupBy === 'none' ? 'default' : 'outline'} 
                size="sm"
                onClick={() => setGroupBy('none')}
                data-testid="button-group-by-none"
              >
                No Grouping
              </Button>
            </div>

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
          ) : filteredJobs && filteredJobs.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedJobs).map(([groupName, groupJobs]) => {
                const isExpanded = isReadyForBillingGroup(groupName) ? readyForBillingExpanded :
                                 groupBy === 'client' ? expandedClients.has(groupName) : 
                                 groupBy === 'manager' ? expandedManagers.has(groupName) : true;
                const toggleExpanded = isReadyForBillingGroup(groupName) ? toggleReadyForBillingExpanded :
                                     groupBy === 'client' ? () => toggleClientExpanded(groupName) :
                                     groupBy === 'manager' ? () => toggleManagerExpanded(groupName) : () => {};
                
                // Show individual jobs if no grouping or only one group
                if (groupBy === 'none' || Object.keys(groupedJobs).length === 1) {
                  return (
                    <div key={groupName} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {groupJobs.map((job) => (
                        <Card 
                          key={job.id} 
                          className="cursor-pointer hover:shadow-md transition-shadow relative"
                          onClick={() => setSelectedJob(job.id)}
                          data-testid={`card-job-${job.id}`}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <CardTitle className="text-lg leading-tight flex-1 pr-2">{job.jobAddress}</CardTitle>
                              <div className="flex items-center gap-2 shrink-0">
                                <div onClick={(e) => e.stopPropagation()}>
                                  <Select 
                                    value={job.status} 
                                    onValueChange={(value) => updateJobStatusMutation.mutate({ jobId: job.id, status: value })}
                                  >
                                    <SelectTrigger 
                                      className="w-auto h-7 text-xs border-0 bg-transparent p-1 focus:ring-0"
                                      data-testid={`select-status-${job.id}`}
                                    >
                                      <Badge className={`${getStatusColor(job.status)} text-xs`}>
                                        {formatStatus(job.status)}
                                      </Badge>
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="new_job">New Job</SelectItem>
                                      <SelectItem value="job_in_progress">Job In Progress</SelectItem>
                                      <SelectItem value="job_complete">Job Complete</SelectItem>
                                      <SelectItem value="ready_for_billing">Ready For Billing</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {job.status === 'ready_for_billing' && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="h-7 w-7 p-0"
                                        onClick={(e) => e.stopPropagation()}
                                        data-testid={`menu-${job.id}`}
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                      <DropdownMenuItem 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                                            deleteJobMutation.mutate(job.id);
                                          }
                                        }}
                                        className="text-red-600 focus:text-red-600"
                                        data-testid={`delete-job-${job.id}`}
                                      >
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Delete Job
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            </div>
                            <p className="text-sm text-muted-foreground font-medium">{job.clientName}</p>
                          </CardHeader>
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground mb-2">PM: {job.projectName}</p>
                            <div className="text-xs text-muted-foreground">
                              Rate: ${job.defaultHourlyRate}/hr • Margin: {job.builderMargin}%
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  );
                }

                // Show grouped folders
                return (
                  <div 
                    key={groupName} 
                    className={`border rounded-lg p-4 ${
                      isReadyForBillingGroup(groupName) 
                        ? 'bg-green-50 border-green-200' 
                        : 'bg-gray-50'
                    }`}
                  >
                    <div 
                      className={`flex items-center gap-2 p-2 rounded transition-colors cursor-pointer ${
                        isReadyForBillingGroup(groupName)
                          ? 'bg-green-100 hover:bg-green-150'
                          : 'hover:bg-gray-100'
                      }`}
                      onClick={toggleExpanded}
                      data-testid={`folder-${groupName}`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {isExpanded ? (
                        <FolderOpen className={`h-5 w-5 ${
                          isReadyForBillingGroup(groupName) ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      ) : (
                        <Folder className={`h-5 w-5 ${
                          isReadyForBillingGroup(groupName) ? 'text-green-600' : 'text-blue-600'
                        }`} />
                      )}
                      <span className={`font-medium ${
                        isReadyForBillingGroup(groupName) ? 'text-green-800' : ''
                      }`}>{groupName}</span>
                      <Badge 
                        variant="secondary" 
                        className={`ml-2 ${
                          isReadyForBillingGroup(groupName) 
                            ? 'bg-green-200 text-green-800 border-green-300' 
                            : ''
                        }`}
                      >
                        {groupJobs.length} job{groupJobs.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {groupJobs.map((job) => (
                          <Card 
                            key={job.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow bg-white relative"
                            onClick={() => setSelectedJob(job.id)}
                            data-testid={`card-job-${job.id}`}
                          >
                            <CardHeader className="pb-3">
                              <div className="flex items-start justify-between">
                                <CardTitle className="text-lg leading-tight flex-1 pr-2">{job.jobAddress}</CardTitle>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div onClick={(e) => e.stopPropagation()}>
                                    <Select 
                                      value={job.status} 
                                      onValueChange={(value) => updateJobStatusMutation.mutate({ jobId: job.id, status: value })}
                                    >
                                      <SelectTrigger 
                                        className="w-auto h-7 text-xs border-0 bg-transparent p-1 focus:ring-0"
                                        data-testid={`select-status-${job.id}`}
                                      >
                                        <Badge className={`${getStatusColor(job.status)} text-xs`}>
                                          {formatStatus(job.status)}
                                        </Badge>
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="new_job">New Job</SelectItem>
                                        <SelectItem value="job_in_progress">Job In Progress</SelectItem>
                                        <SelectItem value="job_complete">Job Complete</SelectItem>
                                        <SelectItem value="ready_for_billing">Ready For Billing</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  {job.status === 'ready_for_billing' && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-7 w-7 p-0"
                                          onClick={(e) => e.stopPropagation()}
                                          data-testid={`menu-${job.id}`}
                                        >
                                          <MoreVertical className="h-3 w-3" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
                                              deleteJobMutation.mutate(job.id);
                                            }
                                          }}
                                          className="text-red-600 focus:text-red-600"
                                          data-testid={`delete-job-${job.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 mr-2" />
                                          Delete Job
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground font-medium">{job.clientName}</p>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <p className="text-sm text-muted-foreground mb-2">PM: {job.projectName}</p>
                              <div className="text-xs text-muted-foreground">
                                Rate: ${job.defaultHourlyRate}/hr • Margin: {job.builderMargin}%
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : searchQuery ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No jobs found matching "{searchQuery}"</div>
              <Button 
                variant="outline" 
                onClick={() => setSearchQuery("")}
                data-testid="button-clear-search"
              >
                Clear Search
              </Button>
            </div>
          ) : null}

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

        {/* Timesheets Tab */}
        <TabsContent value="timesheets" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h2 className="text-xl font-semibold">Timesheet Management</h2>
          </div>

          {timesheetsLoading ? (
            <div className="grid gap-4">
              {[...Array(5)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : allTimesheets && allTimesheets.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Entries</p>
                        <p className="text-2xl font-bold">{allTimesheets.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Clock className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Hours</p>
                        <p className="text-2xl font-bold">
                          {allTimesheets.reduce((total, entry) => total + entry.hours, 0).toFixed(1)}h
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-8 w-8 text-purple-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Approved</p>
                        <p className="text-2xl font-bold">
                          {allTimesheets.filter(entry => entry.approved).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Timesheet Entries */}
              <div className="space-y-3">
                {allTimesheets.map((entry) => (
                  <Card key={entry.id} data-testid={`card-timesheet-${entry.id}`}>
                    <CardContent className="p-4">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="font-medium">{entry.staffName || 'Unknown Staff'}</div>
                            <Badge variant={entry.approved ? "default" : "secondary"}>
                              {entry.approved ? "Approved" : "Pending"}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {entry.jobAddress || 'Unknown Job'} • {entry.clientName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(parseISO(entry.date), 'dd/MM/yyyy')} • {entry.hours}h
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant={entry.approved ? "outline" : "default"}
                            onClick={() => approveTimesheetMutation.mutate({ 
                              id: entry.id, 
                              approved: !entry.approved 
                            })}
                            disabled={approveTimesheetMutation.isPending}
                            data-testid={`button-approve-timesheet-${entry.id}`}
                          >
                            {entry.approved ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Unapprove
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No timesheet entries yet</h3>
              <p className="text-muted-foreground">Staff timesheet entries will appear here once submitted</p>
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
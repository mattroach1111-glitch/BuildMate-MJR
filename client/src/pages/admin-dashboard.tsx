import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertJobSchema, insertEmployeeSchema, insertTimesheetEntrySchema } from "@shared/schema";
import { z } from "zod";
import JobSheetModal from "@/components/job-sheet-modal";
import StaffDashboard from "@/pages/staff-dashboard";
import { Plus, Users, Briefcase, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, MoreVertical, Clock, Calendar, CheckCircle, XCircle, Eye, FileText, Search, Filter, Palette, RotateCcw, Grid3X3, List, Settings } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Job, Employee, TimesheetEntry } from "@shared/schema";
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import PageLayout from "@/components/page-layout";
import { GoogleDriveIntegration } from "@/components/google-drive-integration";
import { OnboardingTour, WelcomeAnimation } from "@/components/onboarding-tour";
import { useOnboarding } from "@/hooks/useOnboarding";
import { UserManagement } from "@/components/user-management";
import { PendingUsers } from "@/components/pending-users";

const jobFormSchema = insertJobSchema.extend({
  builderMargin: z.string()
    .min(1, "Builder margin is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Builder margin must be a valid number"),
  defaultHourlyRate: z.string()
    .min(1, "Default hourly rate is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Default hourly rate must be a positive number"),
});

const employeeFormSchema = insertEmployeeSchema;

const adminTimesheetFormSchema = insertTimesheetEntrySchema.extend({
  hours: z.string().min(1, "Hours is required"),
  staffId: z.string().min(1, "Staff member is required"),
  date: z.string().min(1, "Date is required"),
}).omit({
  approved: true,
});

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { 
    showWelcome, 
    showTour, 
    isOnboardingComplete,
    startTour, 
    completeTour, 
    skipTour 
  } = useOnboarding();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isCreateTimesheetOpen, setIsCreateTimesheetOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'client' | 'manager' | 'none'>('client');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  // Start with all fortnights collapsed by default for cleaner view
  const [collapsedFortnights, setCollapsedFortnights] = useState<Set<string>>(new Set());
  // Separate state for approved timesheets folder
  const [isApprovedFolderCollapsed, setIsApprovedFolderCollapsed] = useState(true);
  const [isAddingNewProjectManager, setIsAddingNewProjectManager] = useState(false);
  const [newProjectManagerName, setNewProjectManagerName] = useState("");
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [folderColors, setFolderColors] = useState<Record<string, number>>({});
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [isDeletedFolderExpanded, setIsDeletedFolderExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'address' | 'client' | 'manager' | 'status'>('address');

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

  const { data: deletedJobs, isLoading: deletedJobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/deleted-jobs"],
    retry: false,
  });

  const { data: employees, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    retry: false,
  });

  const { data: allTimesheets, isLoading: timesheetsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/timesheets"],
    retry: false,
  });

  // Get all staff (users and employees) for timesheet assignment
  const { data: staffForTimesheets, isLoading: staffUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/staff-users"],
    retry: false,
  });

  // Safely filter valid staff members
  const validStaff = staffForTimesheets?.filter(staff => 
    staff && 
    typeof staff === 'object' && 
    staff.id && 
    typeof staff.id === 'string' && 
    staff.id.trim() !== '' &&
    staff.name
  ) || [];



  // Filter timesheets based on selected employee and date range
  // Helper function to get fortnight start date (Monday)
  const getFortnightStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    
    // Find which fortnight this Monday belongs to (assuming fortnights start from Aug 11, 2025)
    const baseDate = new Date('2025-08-11'); // Base Monday for fortnight calculation
    const diffTime = d.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const fortnightNumber = Math.floor(diffDays / 14);
    const fortnightStart = new Date(baseDate);
    fortnightStart.setDate(baseDate.getDate() + (fortnightNumber * 14));
    
    return fortnightStart;
  };

  // Helper function to get fortnight end date (Sunday)
  const getFortnightEnd = (fortnightStart: Date) => {
    const end = new Date(fortnightStart);
    end.setDate(fortnightStart.getDate() + 13);
    return end;
  };

  // Group timesheets by staff and fortnight
  const groupedTimesheets = useMemo(() => {
    const filtered = allTimesheets?.filter((entry: any) => {
      const employeeMatch = selectedEmployeeFilter === "all" || entry.staffId === selectedEmployeeFilter;
      
      if (!employeeMatch) return false;
      
      if (dateRangeFilter === "all") return true;
      
      const entryDate = new Date(entry.date);
      const today = new Date();
      
      switch (dateRangeFilter) {
        case "week":
          const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
          return entryDate >= weekAgo;
        case "month":
          const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
          return entryDate >= monthAgo;
        case "quarter":
          const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
          return entryDate >= quarterAgo;
        default:
          return true;
      }
    }) || [];

    const grouped = new Map();

    filtered.forEach((entry) => {
      const entryDate = new Date(entry.date);
      const fortnightStart = getFortnightStart(entryDate);
      const fortnightEnd = getFortnightEnd(fortnightStart);
      const key = `${entry.staffId}-${fortnightStart.toISOString().split('T')[0]}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          staffId: entry.staffId,
          staffName: entry.staffName,
          fortnightStart,
          fortnightEnd,
          entries: [],
          totalHours: 0,
          approvedCount: 0,
          totalCount: 0,
          allApproved: false
        });
      }

      const group = grouped.get(key);
      group.entries.push(entry);
      group.totalHours += parseFloat(entry.hours || 0);
      group.totalCount += 1;
      if (entry.approved) group.approvedCount += 1;
      group.allApproved = group.approvedCount === group.totalCount && group.totalCount > 0;
    });

    return Array.from(grouped.values()).sort((a, b) => {
      // Sort by staff name, then by fortnight start date (newest first)
      if (a.staffName !== b.staffName) {
        return (a.staffName || 'Unknown').localeCompare(b.staffName || 'Unknown');
      }
      return b.fortnightStart.getTime() - a.fortnightStart.getTime();
    });
  }, [allTimesheets, selectedEmployeeFilter, dateRangeFilter]);

  // Split timesheets into pending and approved
  const pendingTimesheets = useMemo(() => {
    return groupedTimesheets?.filter(fortnight => !fortnight.allApproved) || [];
  }, [groupedTimesheets]);

  const approvedTimesheets = useMemo(() => {
    return groupedTimesheets?.filter(fortnight => fortnight.allApproved) || [];
  }, [groupedTimesheets]);

  // Auto-collapse all fortnights by default when groupedTimesheets changes
  useEffect(() => {
    if (groupedTimesheets && groupedTimesheets.length > 0) {
      const allFortnightKeys = groupedTimesheets.map(fortnight => 
        `${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`
      );
      setCollapsedFortnights(new Set(allFortnightKeys));
    }
  }, [groupedTimesheets]);

  // Keep filteredTimesheets for backward compatibility with existing summary cards
  const filteredTimesheets = allTimesheets?.filter((entry: any) => {
    const employeeMatch = selectedEmployeeFilter === "all" || entry.staffId === selectedEmployeeFilter;
    
    if (!employeeMatch) return false;
    
    if (dateRangeFilter === "all") return true;
    
    const entryDate = new Date(entry.date);
    const today = new Date();
    
    switch (dateRangeFilter) {
      case "week":
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        return entryDate >= weekAgo;
      case "month":
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        return entryDate >= monthAgo;
      case "quarter":
        const quarterAgo = new Date(today.getFullYear(), today.getMonth() - 3, today.getDate());
        return entryDate >= quarterAgo;
      default:
        return true;
    }
  }) || [];

  const createJobMutation = useMutation({
    mutationFn: async (data: z.infer<typeof jobFormSchema>) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setIsCreateJobOpen(false);
      jobForm.reset();
      setIsAddingNewProjectManager(false);
      setNewProjectManagerName("");
      setIsAddingNewClient(false);
      setNewClientName("");
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
      queryClient.invalidateQueries({ queryKey: ["/api/staff-users"] }); // Refresh staff list for timesheets
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
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      toast({
        title: "Success",
        description: "Job moved to deleted folder",
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

  const restoreJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/restore`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      toast({
        title: "Success",
        description: "Job restored successfully",
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
        description: "Failed to restore job",
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

  const approveFortnightMutation = useMutation({
    mutationFn: async ({ staffId, fortnightStart, fortnightEnd, approved }: { 
      staffId: string; 
      fortnightStart: string; 
      fortnightEnd: string; 
      approved: boolean; 
    }) => {
      await apiRequest("PATCH", `/api/admin/timesheet/approve-fortnight`, { 
        staffId, 
        fortnightStart, 
        fortnightEnd, 
        approved 
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      const action = variables.approved ? "approved" : "unapproved";
      toast({
        title: "Success",
        description: `Fortnight timesheet ${action} successfully`,
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
        description: "Failed to update fortnight approval",
        variant: "destructive",
      });
    },
  });

  const clearTimesheetMutation = useMutation({
    mutationFn: async ({ staffId, fortnightStart, fortnightEnd }: { 
      staffId: string; 
      fortnightStart: string; 
      fortnightEnd: string; 
    }) => {
      await apiRequest("DELETE", `/api/admin/timesheet/clear-fortnight`, { 
        staffId, 
        fortnightStart, 
        fortnightEnd
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      toast({
        title: "Success",
        description: "Timesheet cleared successfully",
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
        description: "Failed to clear timesheet",
        variant: "destructive",
      });
    },
  });

  const clearEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      console.log('Attempting to clear entry:', entryId);
      try {
        const response = await apiRequest("DELETE", `/api/admin/timesheet/entry/${entryId}`);
        console.log('Clear entry response:', response);
        return response;
      } catch (error) {
        console.error('Clear entry error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      console.log('Clear entry success');
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      toast({
        title: "Success",
        description: "Timesheet entry cleared successfully",
      });
    },
    onError: (error) => {
      console.error('Clear entry mutation error:', error);
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
        description: `Failed to clear timesheet entry: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const createTimesheetMutation = useMutation({
    mutationFn: async (data: z.infer<typeof adminTimesheetFormSchema>) => {
      const response = await apiRequest("POST", "/api/admin/timesheet", {
        ...data,
        hours: data.hours, // Keep as string for schema validation
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      setIsCreateTimesheetOpen(false);
      toast({
        title: "Success",
        description: "Timesheet entry created successfully",
      });
      timesheetForm.reset();
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
        description: "Failed to create timesheet entry",
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

  // Numerical sorting function for addresses
  const sortJobsBy = (jobs: Job[], criteria: string): Job[] => {
    return [...jobs].sort((a, b) => {
      switch (criteria) {
        case 'address':
          // Extract numbers from address for numerical sorting
          const extractNumber = (address: string): number => {
            const match = address.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          const numA = extractNumber(a.jobAddress);
          const numB = extractNumber(b.jobAddress);
          
          // If both have numbers, sort numerically
          if (numA !== 0 && numB !== 0) {
            return numA - numB;
          }
          // Otherwise, sort alphabetically
          return a.jobAddress.localeCompare(b.jobAddress);
          
        case 'client':
          return a.clientName.localeCompare(b.clientName);
          
        case 'manager':
          return a.projectName.localeCompare(b.projectName);
          
        case 'status':
          return getStatusPriority(a.status) - getStatusPriority(b.status);
          
        default:
          return 0;
      }
    });
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

  // Apply sorting to filtered jobs
  const sortedJobs = sortJobsBy(filteredJobs, sortBy);

  // Group filtered jobs by client or project manager
  const groupedJobs = sortedJobs ? (() => {
    if (groupBy === 'none') return { 'All Jobs': sortedJobs };
    
    // Separate ready for billing jobs
    const readyForBillingJobs = sortedJobs.filter(job => job.status === 'ready_for_billing');
    const otherJobs = sortedJobs.filter(job => job.status !== 'ready_for_billing');
    
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
      
      // Sort jobs within each client group by the selected criteria
      Object.keys(clientGroups).forEach(client => {
        clientGroups[client] = sortJobsBy(clientGroups[client], sortBy);
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
      
      // Sort jobs within each manager group by the selected criteria
      Object.keys(managerGroups).forEach(manager => {
        managerGroups[manager] = sortJobsBy(managerGroups[manager], sortBy);
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

  // All available color themes
  const allColorThemes = [
    // Blues
    {
      name: 'Blue',
      bg: 'bg-blue-50 border-blue-200',
      folderBg: 'bg-blue-100 hover:bg-blue-150',
      folderIcon: 'text-blue-600',
      folderText: 'text-blue-800',
      badge: 'bg-blue-200 text-blue-800 border-blue-300',
      preview: 'bg-blue-500'
    },
    // Oranges
    {
      name: 'Orange',
      bg: 'bg-orange-50 border-orange-200',
      folderBg: 'bg-orange-100 hover:bg-orange-150',
      folderIcon: 'text-orange-600',
      folderText: 'text-orange-800',
      badge: 'bg-orange-200 text-orange-800 border-orange-300',
      preview: 'bg-orange-500'
    },
    // Pinks
    {
      name: 'Pink',
      bg: 'bg-pink-50 border-pink-200',
      folderBg: 'bg-pink-100 hover:bg-pink-150',
      folderIcon: 'text-pink-600',
      folderText: 'text-pink-800',
      badge: 'bg-pink-200 text-pink-800 border-pink-300',
      preview: 'bg-pink-500'
    },
    // Cyans
    {
      name: 'Cyan',
      bg: 'bg-cyan-50 border-cyan-200',
      folderBg: 'bg-cyan-100 hover:bg-cyan-150',
      folderIcon: 'text-cyan-600',
      folderText: 'text-cyan-800',
      badge: 'bg-cyan-200 text-cyan-800 border-cyan-300',
      preview: 'bg-cyan-500'
    },
    // Teals
    {
      name: 'Teal',
      bg: 'bg-teal-50 border-teal-200',
      folderBg: 'bg-teal-100 hover:bg-teal-150',
      folderIcon: 'text-teal-600',
      folderText: 'text-teal-800',
      badge: 'bg-teal-200 text-teal-800 border-teal-300',
      preview: 'bg-teal-500'
    },
    // Indigos
    {
      name: 'Indigo',
      bg: 'bg-indigo-50 border-indigo-200',
      folderBg: 'bg-indigo-100 hover:bg-indigo-150',
      folderIcon: 'text-indigo-600',
      folderText: 'text-indigo-800',
      badge: 'bg-indigo-200 text-indigo-800 border-indigo-300',
      preview: 'bg-indigo-500'
    },
    // Purples
    {
      name: 'Purple',
      bg: 'bg-purple-50 border-purple-200',
      folderBg: 'bg-purple-100 hover:bg-purple-150',
      folderIcon: 'text-purple-600',
      folderText: 'text-purple-800',
      badge: 'bg-purple-200 text-purple-800 border-purple-300',
      preview: 'bg-purple-500'
    },
    // Reds
    {
      name: 'Red',
      bg: 'bg-red-50 border-red-200',
      folderBg: 'bg-red-100 hover:bg-red-150',
      folderIcon: 'text-red-600',
      folderText: 'text-red-800',
      badge: 'bg-red-200 text-red-800 border-red-300',
      preview: 'bg-red-500'
    },
    // Yellows
    {
      name: 'Yellow',
      bg: 'bg-yellow-50 border-yellow-200',
      folderBg: 'bg-yellow-100 hover:bg-yellow-150',
      folderIcon: 'text-yellow-600',
      folderText: 'text-yellow-800',
      badge: 'bg-yellow-200 text-yellow-800 border-yellow-300',
      preview: 'bg-yellow-500'
    },
    // Limes
    {
      name: 'Lime',
      bg: 'bg-lime-50 border-lime-200',
      folderBg: 'bg-lime-100 hover:bg-lime-150',
      folderIcon: 'text-lime-600',
      folderText: 'text-lime-800',
      badge: 'bg-lime-200 text-lime-800 border-lime-300',
      preview: 'bg-lime-500'
    },
    // Roses
    {
      name: 'Rose',
      bg: 'bg-rose-50 border-rose-200',
      folderBg: 'bg-rose-100 hover:bg-rose-150',
      folderIcon: 'text-rose-600',
      folderText: 'text-rose-800',
      badge: 'bg-rose-200 text-rose-800 border-rose-300',
      preview: 'bg-rose-500'
    },
    // Violets
    {
      name: 'Violet',
      bg: 'bg-violet-50 border-violet-200',
      folderBg: 'bg-violet-100 hover:bg-violet-150',
      folderIcon: 'text-violet-600',
      folderText: 'text-violet-800',
      badge: 'bg-violet-200 text-violet-800 border-violet-300',
      preview: 'bg-violet-500'
    },
    // Emerald (for Ready for Billing - always available)
    {
      name: 'Emerald',
      bg: 'bg-emerald-50 border-emerald-200',
      folderBg: 'bg-emerald-100 hover:bg-emerald-150',
      folderIcon: 'text-emerald-600',
      folderText: 'text-emerald-800',
      badge: 'bg-emerald-200 text-emerald-800 border-emerald-300',
      preview: 'bg-emerald-500'
    },
    // Slate (neutral)
    {
      name: 'Slate',
      bg: 'bg-slate-50 border-slate-200',
      folderBg: 'bg-slate-100 hover:bg-slate-150',
      folderIcon: 'text-slate-600',
      folderText: 'text-slate-800',
      badge: 'bg-slate-200 text-slate-800 border-slate-300',
      preview: 'bg-slate-500'
    }
  ];

  // Get folder color scheme based on user choice or defaults
  const getFolderColors = (groupName: string, groupType: string) => {
    // Check if user has selected a custom color for this folder
    const userColorIndex = folderColors[groupName];
    if (userColorIndex !== undefined && allColorThemes[userColorIndex]) {
      return allColorThemes[userColorIndex];
    }

    if (isReadyForBillingGroup(groupName)) {
      // Default green for Ready for Billing
      return allColorThemes[12]; // Emerald
    }
    
    if (groupType === 'client') {
      // Client folders - Use different vibrant colors based on client name
      const clientColors = [0, 1, 2, 3, 4, 5]; // Blue, Orange, Pink, Cyan, Teal, Indigo
      const hash = groupName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return allColorThemes[clientColors[hash % clientColors.length]];
      
    } else if (groupType === 'manager') {
      // Project manager folders - Use different warm colors
      const managerColors = [6, 7, 8, 9, 10, 11]; // Purple, Red, Yellow, Lime, Rose, Violet
      const hash = groupName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return allColorThemes[managerColors[hash % managerColors.length]];
    }
    
    // Default neutral theme
    return allColorThemes[13]; // Slate
  };

  // Handle color change for folder
  const handleColorChange = (groupName: string, colorIndex: number) => {
    setFolderColors(prev => ({
      ...prev,
      [groupName]: colorIndex
    }));
    setColorPickerOpen(null);
    
    // Store in localStorage for persistence
    const stored = JSON.parse(localStorage.getItem('buildflow-folder-colors') || '{}');
    stored[groupName] = colorIndex;
    localStorage.setItem('buildflow-folder-colors', JSON.stringify(stored));
  };

  // Load saved folder colors on component mount
  useEffect(() => {
    const stored = localStorage.getItem('buildflow-folder-colors');
    if (stored) {
      try {
        setFolderColors(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to load folder colors:', error);
      }
    }
  }, []);

  // Special state for Ready for Billing folder - start closed
  const [readyForBillingExpanded, setReadyForBillingExpanded] = useState(false);

  const toggleReadyForBillingExpanded = () => {
    setReadyForBillingExpanded(!readyForBillingExpanded);
  };

  // Keep all folders closed when switching to a grouping mode
  useEffect(() => {
    if (groupBy === 'client') {
      // Start with all client folders closed
      setExpandedClients(new Set());
    }
    
    if (groupBy === 'manager') {
      // Start with all manager folders closed
      setExpandedManagers(new Set());
    }
  }, [groupBy]);

  // Get unique project managers and clients from existing jobs
  const projectManagers = jobs ? Array.from(new Set(jobs.map(job => job.projectName).filter(Boolean))) : [];
  const clientNames = jobs ? Array.from(new Set(jobs.map(job => job.clientName).filter(Boolean))) : [];

  const handleAddProjectManager = () => {
    if (newProjectManagerName.trim()) {
      jobForm.setValue('projectName', newProjectManagerName.trim());
      setNewProjectManagerName("");
      setIsAddingNewProjectManager(false);
    }
  };

  const handleAddClient = () => {
    if (newClientName.trim()) {
      jobForm.setValue('clientName', newClientName.trim());
      setNewClientName("");
      setIsAddingNewClient(false);
    }
  };

  const employeeForm = useForm<z.infer<typeof employeeFormSchema>>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      name: "",
    },
  });

  const timesheetForm = useForm<z.infer<typeof adminTimesheetFormSchema>>({
    resolver: zodResolver(adminTimesheetFormSchema),
    defaultValues: {
      staffId: "",
      jobId: "",
      date: new Date().toISOString().split('T')[0],
      hours: "",
    },
  });

  const onJobSubmit = (data: z.infer<typeof jobFormSchema>) => {
    createJobMutation.mutate(data);
  };

  // Handle project manager selection change
  const handleProjectManagerChange = (value: string) => {
    if (value === "__add_new__") {
      setIsAddingNewProjectManager(true);
      setNewProjectManagerName("");
    } else {
      jobForm.setValue('projectName', value);
    }
  };

  // Handle client selection change
  const handleClientChange = (value: string) => {
    if (value === "__add_new__") {
      setIsAddingNewClient(true);
      setNewClientName("");
    } else {
      jobForm.setValue('clientName', value);
    }
  };

  const onEmployeeSubmit = (data: z.infer<typeof employeeFormSchema>) => {
    createEmployeeMutation.mutate(data);
  };

  const onTimesheetSubmit = (data: z.infer<typeof adminTimesheetFormSchema>) => {
    createTimesheetMutation.mutate(data);
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
    <PageLayout 
      title="Job Management" 
      subtitle={`Welcome back, ${(user as any)?.firstName || 'Admin'}`}
    >
      <div className="space-y-6">
        {/* Mobile-First Tabs */}
        <Tabs defaultValue="jobs" className="w-full">
          <TabsList className="grid w-full grid-cols-6 mb-6">
          <TabsTrigger value="jobs" className="flex items-center gap-2" data-testid="tab-jobs">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Jobs</span>
          </TabsTrigger>
          <TabsTrigger value="employees" className="flex items-center gap-2" data-testid="tab-employees">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Staff</span>
          </TabsTrigger>
          <TabsTrigger value="timesheets" className="flex items-center gap-2" data-testid="tab-timesheets">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Timesheets</span>
          </TabsTrigger>
          <TabsTrigger value="staff-view" className="flex items-center gap-2" data-testid="tab-staff-view">
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Staff View</span>
          </TabsTrigger>
          <TabsTrigger value="pending-users" className="flex items-center gap-2" data-testid="tab-pending-users">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Pending</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2" data-testid="tab-settings">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Settings</span>
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
                          <div className="space-y-2">
                            {!isAddingNewClient ? (
                              <div className="flex gap-2">
                                <FormControl className="flex-1">
                                  <Select onValueChange={handleClientChange} value={field.value}>
                                    <SelectTrigger data-testid="select-client-name">
                                      <SelectValue placeholder="Select or add client" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {clientNames.filter(client => client && client.trim() !== '').map((client) => (
                                        <SelectItem key={client} value={client}>
                                          {client}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__add_new__" className="text-primary font-medium">
                                        + Add New Client
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Enter new client name"
                                  value={newClientName}
                                  onChange={(e) => setNewClientName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddClient();
                                    } else if (e.key === 'Escape') {
                                      setIsAddingNewClient(false);
                                      setNewClientName("");
                                    }
                                  }}
                                  className="flex-1"
                                  data-testid="input-new-client-name"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleAddClient}
                                  disabled={!newClientName.trim()}
                                  data-testid="button-add-client"
                                >
                                  Add
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsAddingNewClient(false);
                                    setNewClientName("");
                                  }}
                                  data-testid="button-cancel-client"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
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
                          <div className="space-y-2">
                            {!isAddingNewProjectManager ? (
                              <div className="flex gap-2">
                                <FormControl className="flex-1">
                                  <Select onValueChange={handleProjectManagerChange} value={field.value}>
                                    <SelectTrigger data-testid="select-project-manager">
                                      <SelectValue placeholder="Select or add project manager" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {projectManagers.filter(manager => manager && manager.trim() !== '').map((manager) => (
                                        <SelectItem key={manager} value={manager}>
                                          {manager}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value="__add_new__" className="text-primary font-medium">
                                        + Add New Project Manager
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </FormControl>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <Input
                                  placeholder="Enter new project manager name"
                                  value={newProjectManagerName}
                                  onChange={(e) => setNewProjectManagerName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      handleAddProjectManager();
                                    } else if (e.key === 'Escape') {
                                      setIsAddingNewProjectManager(false);
                                      setNewProjectManagerName("");
                                    }
                                  }}
                                  className="flex-1"
                                  data-testid="input-new-project-manager"
                                  autoFocus
                                />
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={handleAddProjectManager}
                                  disabled={!newProjectManagerName.trim()}
                                  data-testid="button-add-project-manager"
                                >
                                  Add
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setIsAddingNewProjectManager(false);
                                    setNewProjectManagerName("");
                                  }}
                                  data-testid="button-cancel-project-manager"
                                >
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </div>
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
              <div className="flex items-center gap-1 border rounded-md p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="h-8 w-8 p-0"
                  data-testid="button-grid-view"
                >
                  <Grid3X3 className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="h-8 w-8 p-0"
                  data-testid="button-list-view"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger 
                  className="w-auto min-w-32"
                  data-testid="select-sort-by"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="address">Sort by Address</SelectItem>
                  <SelectItem value="client">Sort by Client</SelectItem>
                  <SelectItem value="manager">Sort by Manager</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
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
                    <div key={groupName} className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}>
                      {groupJobs.map((job) => 
                        viewMode === 'grid' ? (
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
                        ) : (
                          <Card 
                            key={job.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow relative"
                            onClick={() => setSelectedJob(job.id)}
                            data-testid={`card-job-${job.id}`}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-4">
                                    <div>
                                      <h3 className="font-semibold text-lg">{job.jobAddress}</h3>
                                      <p className="text-sm text-muted-foreground">{job.clientName} • PM: {job.projectName}</p>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <div className="text-xs text-muted-foreground text-right">
                                    <div>Rate: ${job.defaultHourlyRate}/hr</div>
                                    <div>Margin: {job.builderMargin}%</div>
                                  </div>
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
                            </CardContent>
                          </Card>
                        )
                      )}
                    </div>
                  );
                }

                // Show grouped folders
                const colors = getFolderColors(groupName, groupBy);
                return (
                  <div 
                    key={groupName} 
                    className={`border rounded-lg p-4 transition-colors ${colors.bg}`}
                  >
                    <div 
                      className={`flex items-center gap-2 p-2 rounded transition-colors ${colors.folderBg}`}
                    >
                      <div 
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                        onClick={toggleExpanded}
                        data-testid={`folder-${groupName}`}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        {isExpanded ? (
                          <FolderOpen className={`h-5 w-5 ${colors.folderIcon}`} />
                        ) : (
                          <Folder className={`h-5 w-5 ${colors.folderIcon}`} />
                        )}
                        <span className={`font-medium ${colors.folderText}`}>{groupName}</span>
                        <Badge 
                          variant="secondary" 
                          className={`ml-2 ${colors.badge}`}
                        >
                          {groupJobs.length} job{groupJobs.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      {/* Color Picker Button */}
                      <DropdownMenu 
                        open={colorPickerOpen === groupName} 
                        onOpenChange={(open) => setColorPickerOpen(open ? groupName : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              setColorPickerOpen(colorPickerOpen === groupName ? null : groupName);
                            }}
                            data-testid={`color-picker-${groupName}`}
                          >
                            <Palette className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent 
                          align="end" 
                          className="w-56 p-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="text-sm font-medium mb-2 px-2">Choose Folder Color</div>
                          <div className="grid grid-cols-4 gap-2">
                            {allColorThemes.map((theme, index) => (
                              <button
                                key={theme.name}
                                className={`w-10 h-10 rounded-lg border-2 transition-all hover:scale-110 ${theme.preview} ${
                                  folderColors[groupName] === index 
                                    ? 'ring-2 ring-offset-2 ring-blue-500' 
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                                onClick={() => handleColorChange(groupName, index)}
                                title={theme.name}
                                data-testid={`color-option-${theme.name.toLowerCase()}`}
                              />
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2 px-2">
                            Click a color to customize this folder
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {isExpanded && (
                      <div className={`mt-4 ${viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-2"}`}>
                        {groupJobs.map((job) => 
                          viewMode === 'grid' ? (
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
                          ) : (
                            <Card 
                              key={job.id} 
                              className="cursor-pointer hover:shadow-md transition-shadow bg-white relative"
                              onClick={() => setSelectedJob(job.id)}
                              data-testid={`card-job-${job.id}`}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-4">
                                      <div>
                                        <h3 className="font-semibold text-lg">{job.jobAddress}</h3>
                                        <p className="text-sm text-muted-foreground">{job.clientName} • PM: {job.projectName}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <div className="text-xs text-muted-foreground text-right">
                                      <div>Rate: ${job.defaultHourlyRate}/hr</div>
                                      <div>Margin: {job.builderMargin}%</div>
                                    </div>
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
                              </CardContent>
                            </Card>
                          )
                        )}
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

          {/* Previous Completed Job Sheets Folder - Pinned to Bottom */}
          {deletedJobs && deletedJobs.length > 0 && (
            <div className="mt-8 pt-6 border-t">
              <div 
                className="border rounded-lg p-4 transition-colors bg-red-50 border-red-200"
              >
                <div 
                  className="flex items-center gap-2 p-2 rounded transition-colors bg-red-100 hover:bg-red-150"
                >
                  <div 
                    className="flex items-center gap-2 flex-1 cursor-pointer"
                    onClick={() => setIsDeletedFolderExpanded(!isDeletedFolderExpanded)}
                    data-testid="folder-previous-completed"
                  >
                    {isDeletedFolderExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {isDeletedFolderExpanded ? (
                      <FolderOpen className="h-5 w-5 text-red-600" />
                    ) : (
                      <Folder className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-medium text-red-800">📋 Previous completed job sheets</span>
                    <Badge 
                      variant="secondary" 
                      className="ml-2 bg-red-200 text-red-800 border-red-300"
                    >
                      {deletedJobs.length} job{deletedJobs.length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </div>
                
                {isDeletedFolderExpanded && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {deletedJobs.map((job) => (
                      <Card 
                        key={job.id} 
                        className="cursor-pointer hover:shadow-md transition-shadow bg-white relative opacity-75"
                        onClick={() => setSelectedJob(job.id)}
                        data-testid={`card-deleted-job-${job.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <CardTitle className="text-lg leading-tight flex-1 pr-2">{job.jobAddress}</CardTitle>
                            <div className="flex items-center gap-2 shrink-0">
                              <Badge className="bg-red-100 text-red-800 border-red-200 text-xs">
                                Archived
                              </Badge>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-7 w-7 p-0"
                                    onClick={(e) => e.stopPropagation()}
                                    data-testid={`menu-deleted-${job.id}`}
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      restoreJobMutation.mutate(job.id);
                                    }}
                                    className="text-green-600 focus:text-green-600"
                                    data-testid={`restore-job-${job.id}`}
                                  >
                                    <RotateCcw className="h-4 w-4 mr-2" />
                                    Restore Job
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground font-medium">{job.clientName}</p>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-muted-foreground mb-2">PM: {job.projectName}</p>
                          <div className="text-xs text-muted-foreground">
                            Rate: ${job.defaultHourlyRate}/hr • Margin: {job.builderMargin}%
                          </div>
                          <div className="text-xs text-red-600 mt-1">
                            Archived: {job.deletedAt ? new Date(job.deletedAt).toLocaleDateString() : 'Unknown'}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </div>
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
            <h2 className="text-xl font-semibold">Fortnight Timesheet Management</h2>
            <Dialog open={isCreateTimesheetOpen} onOpenChange={setIsCreateTimesheetOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto" data-testid="button-create-timesheet">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Timesheet Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md mx-4 sm:max-w-lg" aria-describedby="create-timesheet-description">
                <DialogHeader>
                  <DialogTitle>Add Timesheet Entry</DialogTitle>
                  <p id="create-timesheet-description" className="text-sm text-muted-foreground">
                    Create a timesheet entry for a staff member on a specific job.
                  </p>
                </DialogHeader>
                <Form {...timesheetForm}>
                  <form onSubmit={timesheetForm.handleSubmit(onTimesheetSubmit)} className="space-y-4">
                    <FormField
                      control={timesheetForm.control}
                      name="staffId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Staff Member</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-staff-member">
                                <SelectValue placeholder="Select staff member" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {validStaff.map((staff) => (
                                <SelectItem key={`staff-${staff.id}-${staff.type}`} value={staff.id}>
                                  {staff.name} {staff.type === 'employee' ? '(Employee)' : '(User)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                            <FormControl>
                              <SelectTrigger data-testid="select-job">
                                <SelectValue placeholder="Select job" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {jobs?.filter(job => job.id && job.id.trim() !== '').map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobAddress}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} data-testid="input-timesheet-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={timesheetForm.control}
                      name="hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.25" 
                              min="0" 
                              max="24" 
                              placeholder="e.g. 8.5" 
                              {...field} 
                              data-testid="input-timesheet-hours" 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2 pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsCreateTimesheetOpen(false)}
                        data-testid="button-cancel-timesheet"
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={createTimesheetMutation.isPending}
                        data-testid="button-submit-timesheet"
                      >
                        {createTimesheetMutation.isPending ? "Creating..." : "Create Entry"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Staff Timesheet Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Timesheet Viewer
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                View and manage individual staff member timesheets
              </p>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee-filter" className="text-sm font-medium">Select Staff Member</Label>
                  <Select value={selectedEmployeeFilter} onValueChange={setSelectedEmployeeFilter}>
                    <SelectTrigger data-testid="select-employee-filter" className="mt-1">
                      <SelectValue placeholder="Choose a staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-medium text-primary">
                        📊 All Staff Members
                      </SelectItem>
                      {validStaff.length > 0 ? validStaff.map((staff) => {
                        const staffId = staff.id || `staff-${Math.random().toString(36).substr(2, 9)}`;
                        const staffEntries = allTimesheets?.filter(entry => entry.staffId === staff.id) || [];
                        const totalHours = staffEntries.reduce((total, entry) => total + parseFloat(entry.hours || 0), 0);
                        const approvedEntries = staffEntries.filter(entry => entry.approved).length;
                        
                        return (
                          <SelectItem key={`filter-${staffId}`} value={staffId}>
                            <div className="flex items-center justify-between w-full min-w-0">
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-medium truncate">{staff.name || 'Unknown Staff'}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">
                                  ({staff.type === 'employee' ? 'Employee' : 'User'})
                                </span>
                              </div>
                              <div className="text-xs text-muted-foreground flex-shrink-0 ml-3">
                                {totalHours.toFixed(1)}h • {approvedEntries}/{staffEntries.length} ✓
                              </div>
                            </div>
                          </SelectItem>
                        );
                      }) : (
                        <SelectItem value="no-staff" disabled>
                          No staff members found
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="date-range-filter" className="text-sm font-medium">Time Period</Label>
                  <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
                    <SelectTrigger data-testid="select-date-range-filter" className="mt-1">
                      <SelectValue placeholder="All time" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📅 All Time</SelectItem>
                      <SelectItem value="week">📊 Last 7 Days</SelectItem>
                      <SelectItem value="month">📈 Last 30 Days</SelectItem>
                      <SelectItem value="quarter">📉 Last 3 Months</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    setSelectedEmployeeFilter("all");
                    setDateRangeFilter("all");
                  }}
                  data-testid="button-clear-all-filters"
                >
                  Clear All Filters
                </Button>
                {selectedEmployeeFilter && selectedEmployeeFilter !== "all" && (
                  <Button 
                    size="sm"
                    onClick={() => window.location.href = `/timesheet?employee=${selectedEmployeeFilter}&admin=true`}
                    data-testid="button-view-employee-timesheet"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    View Timesheet
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

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
          ) : filteredTimesheets && filteredTimesheets.length > 0 ? (
            <div className="space-y-4">
              {/* Individual Staff Member Summary */}
              {selectedEmployeeFilter !== "all" && (
                <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 dark:from-blue-900/20 dark:to-indigo-900/20">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-full">
                          <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-blue-900 dark:text-blue-100">
                            {validStaff.find(s => s.id === selectedEmployeeFilter)?.name || 'Selected Employee'}
                          </h3>
                          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                            {validStaff.find(s => s.id === selectedEmployeeFilter)?.type === 'employee' ? 'Employee' : 'User'} • Individual Timesheet View
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {filteredTimesheets.reduce((total, entry) => total + parseFloat(entry.hours || 0), 0).toFixed(1)}h
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300">
                          {filteredTimesheets.length} entries
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-blue-500" />
                      <div>
                        <p className="text-sm text-muted-foreground">Total Entries</p>
                        <p className="text-2xl font-bold">{filteredTimesheets.length}</p>
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
                          {filteredTimesheets.reduce((total, entry) => total + parseFloat(entry.hours || 0), 0).toFixed(1)}h
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
                          {filteredTimesheets.filter(entry => entry.approved).length}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Pending Timesheets Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-orange-500" />
                  Pending Approvals ({pendingTimesheets.length})
                </h3>
                
                {pendingTimesheets.map((fortnight) => (
                  <Card key={`${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`} className="overflow-hidden">
                    <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <div className="font-semibold text-lg">{fortnight.staffName || 'Unknown Staff'}</div>
                            <Badge variant={fortnight.allApproved ? "default" : "secondary"} className="px-3 py-1">
                              {fortnight.allApproved ? "All Approved" : `${fortnight.approvedCount}/${fortnight.totalCount} Approved`}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground font-medium">
                            Fortnight: {format(fortnight.fortnightStart, 'dd/MM/yyyy')} - {format(fortnight.fortnightEnd, 'dd/MM/yyyy')}
                          </div>
                          <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                            Total Hours: {fortnight.totalHours.toFixed(1)}h • {fortnight.totalCount} entries
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Toggle Expand/Collapse Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const fortnightKey = `${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`;
                              const newCollapsed = new Set(collapsedFortnights);
                              if (newCollapsed.has(fortnightKey)) {
                                newCollapsed.delete(fortnightKey);
                              } else {
                                newCollapsed.add(fortnightKey);
                              }
                              setCollapsedFortnights(newCollapsed);
                            }}
                            data-testid={`button-toggle-entries-${fortnight.staffId}-${fortnight.fortnightStart.toISOString().split('T')[0]}`}
                            className="p-2"
                          >
                            {collapsedFortnights.has(`${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`) ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => {
                              if (confirm(`Are you sure you want to clear all timesheet entries for ${fortnight.staffName || 'this staff member'} for this fortnight? This action cannot be undone.`)) {
                                clearTimesheetMutation.mutate({
                                  staffId: fortnight.staffId,
                                  fortnightStart: fortnight.fortnightStart.toISOString().split('T')[0],
                                  fortnightEnd: fortnight.fortnightEnd.toISOString().split('T')[0]
                                });
                              }
                            }}
                            disabled={clearTimesheetMutation.isPending}
                            data-testid={`button-clear-timesheet-${fortnight.staffId}-${fortnight.fortnightStart.toISOString().split('T')[0]}`}
                            className="min-w-28"
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Clear
                          </Button>
                          <Button
                            size="default"
                            variant={fortnight.allApproved ? "outline" : "default"}
                            onClick={() => {
                              approveFortnightMutation.mutate({
                                staffId: fortnight.staffId,
                                fortnightStart: fortnight.fortnightStart.toISOString().split('T')[0],
                                fortnightEnd: fortnight.fortnightEnd.toISOString().split('T')[0],
                                approved: !fortnight.allApproved
                              });
                            }}
                            disabled={approveFortnightMutation.isPending}
                            data-testid={`button-approve-fortnight-${fortnight.staffId}-${fortnight.fortnightStart.toISOString().split('T')[0]}`}
                            className="min-w-40"
                          >
                            {fortnight.allApproved ? (
                              <>
                                <XCircle className="h-4 w-4 mr-2" />
                                Unapprove Fortnight
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-4 w-4 mr-2" />
                                Approve Fortnight
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    {!collapsedFortnights.has(`${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`) && (
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          {fortnight.entries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry: any) => (
                            <div 
                              key={entry.id} 
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
                              data-testid={`entry-${entry.id}`}
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium">
                                    {format(parseISO(entry.date), 'dd/MM/yyyy (EEEE)')}
                                  </div>
                                  <Badge variant={entry.approved ? "default" : "secondary"} className="text-xs">
                                    {entry.approved ? "✓" : "○"}
                                  </Badge>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {(() => {
                                    // Handle leave types stored in materials field
                                    if (!entry.jobAddress && entry.materials) {
                                      const leaveTypes: { [key: string]: string } = {
                                        'sick-leave': 'Sick Leave',
                                        'personal-leave': 'Personal Leave', 
                                        'annual-leave': 'Annual Leave',
                                        'rdo': 'RDO (Rest Day Off)'
                                      };
                                      return leaveTypes[entry.materials] || entry.materials;
                                    }
                                    return entry.jobAddress || 'Unknown Job';
                                  })()} • {entry.clientName} • {parseFloat(entry.hours || 0)}h
                                </div>
                              </div>
                              {!entry.approved && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to clear this timesheet entry for ${format(parseISO(entry.date), 'dd/MM/yyyy')}? This action cannot be undone.`)) {
                                      clearEntryMutation.mutate(entry.id);
                                    }
                                  }}
                                  disabled={clearEntryMutation.isPending}
                                  data-testid={`button-clear-entry-${entry.id}`}
                                  className="min-w-20"
                                >
                                  <Trash2 className="h-3 w-3 mr-1" />
                                  Clear
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
                
                {pendingTimesheets.length === 0 && (
                  <Card className="p-6 text-center">
                    <CheckCircle className="h-10 w-10 mx-auto text-green-500 mb-3" />
                    <h3 className="text-lg font-medium mb-2">All caught up!</h3>
                    <p className="text-muted-foreground">
                      No pending timesheet approvals at this time.
                    </p>
                  </Card>
                )}

                {/* Approved Timesheets Folder */}
                {approvedTimesheets.length > 0 && (
                  <div className="mt-8">
                    <Card className="overflow-hidden border-green-200 bg-green-50/50">
                      <CardHeader 
                        className="pb-3 bg-gradient-to-r from-green-50 to-emerald-50 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-colors"
                        onClick={() => setIsApprovedFolderCollapsed(!isApprovedFolderCollapsed)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <h3 className="text-lg font-semibold text-green-800">
                                Approved Timesheets ({approvedTimesheets.length})
                              </h3>
                              <p className="text-sm text-green-600">
                                {approvedTimesheets.reduce((total, ft) => total + ft.totalHours, 0).toFixed(1)} hours approved
                              </p>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-700 hover:text-green-800 hover:bg-green-100"
                            data-testid="button-toggle-approved-folder"
                          >
                            {isApprovedFolderCollapsed ? (
                              <ChevronRight className="h-4 w-4" />
                            ) : (
                              <ChevronDown className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardHeader>
                      
                      {!isApprovedFolderCollapsed && (
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            {approvedTimesheets.map((fortnight) => (
                              <Card key={`approved-${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`} className="border-green-200">
                                <CardHeader className="pb-3 bg-green-50/50">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-3">
                                        <div className="font-semibold text-lg text-green-800">{fortnight.staffName || 'Unknown Staff'}</div>
                                        <Badge variant="default" className="bg-green-600 px-3 py-1">
                                          ✓ Approved
                                        </Badge>
                                      </div>
                                      <div className="text-sm text-green-600 font-medium">
                                        Fortnight: {format(fortnight.fortnightStart, 'dd/MM/yyyy')} - {format(fortnight.fortnightEnd, 'dd/MM/yyyy')}
                                      </div>
                                      <div className="text-sm text-green-600">
                                        Total Hours: {fortnight.totalHours.toFixed(1)}h • {fortnight.totalCount} entries
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          const fortnightKey = `${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`;
                                          const newCollapsed = new Set(collapsedFortnights);
                                          if (newCollapsed.has(fortnightKey)) {
                                            newCollapsed.delete(fortnightKey);
                                          } else {
                                            newCollapsed.add(fortnightKey);
                                          }
                                          setCollapsedFortnights(newCollapsed);
                                        }}
                                        data-testid={`button-toggle-approved-entries-${fortnight.staffId}-${fortnight.fortnightStart.toISOString().split('T')[0]}`}
                                        className="text-green-700 hover:text-green-800 hover:bg-green-100 p-2"
                                      >
                                        {collapsedFortnights.has(`${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`) ? (
                                          <ChevronRight className="h-4 w-4" />
                                        ) : (
                                          <ChevronDown className="h-4 w-4" />
                                        )}
                                      </Button>
                                      <Button
                                        size="default"
                                        variant="outline"
                                        onClick={() => {
                                          approveFortnightMutation.mutate({
                                            staffId: fortnight.staffId,
                                            fortnightStart: fortnight.fortnightStart.toISOString().split('T')[0],
                                            fortnightEnd: fortnight.fortnightEnd.toISOString().split('T')[0],
                                            approved: false
                                          });
                                        }}
                                        disabled={approveFortnightMutation.isPending}
                                        data-testid={`button-unapprove-fortnight-${fortnight.staffId}-${fortnight.fortnightStart.toISOString().split('T')[0]}`}
                                        className="border-green-300 text-green-700 hover:bg-green-100 min-w-32"
                                      >
                                        <XCircle className="h-4 w-4 mr-2" />
                                        Unapprove
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                {!collapsedFortnights.has(`${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`) && (
                                  <CardContent className="p-4">
                                    <div className="space-y-2">
                                      {fortnight.entries.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((entry: any) => (
                                        <div 
                                          key={entry.id} 
                                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-green-50"
                                          data-testid={`approved-entry-${entry.id}`}
                                        >
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                              <div className="text-sm font-medium text-green-800">
                                                {format(parseISO(entry.date), 'dd/MM/yyyy (EEEE)')}
                                              </div>
                                              <Badge variant="default" className="text-xs bg-green-600">
                                                ✓
                                              </Badge>
                                            </div>
                                            <div className="text-sm text-green-600">
                                              {entry.jobAddress || 'Unknown Job'} • {entry.clientName} • {parseFloat(entry.hours || 0)}h
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </CardContent>
                                )}
                              </Card>
                            ))}
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  </div>
                )}
                
                {groupedTimesheets.length === 0 && (
                  <Card className="p-8 text-center">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">No timesheet entries found</h3>
                    <p className="text-muted-foreground">
                      {selectedEmployeeFilter === "all" 
                        ? "No timesheet entries match your current filters"
                        : "This staff member has no timesheet entries for the selected period"
                      }
                    </p>
                  </Card>
                )}
              </div>
            </div>
          ) : (
            <Card className="p-8 text-center">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {selectedEmployeeFilter === "all" ? "No timesheet entries yet" : "No entries for selected employee"}
              </h3>
              <p className="text-muted-foreground">
                {selectedEmployeeFilter === "all" 
                  ? "Staff timesheet entries will appear here once submitted" 
                  : "This employee has not submitted any timesheet entries yet"}
              </p>
            </Card>
          )}
        </TabsContent>

        {/* Staff View Tab */}
        <TabsContent value="staff-view" className="space-y-6" data-testid="content-staff-view">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold" data-testid="text-staff-preview-title">Staff Dashboard Preview</h2>
              <p className="text-sm text-muted-foreground">View the staff experience as an admin</p>
            </div>
          </div>
          <div className="border rounded-lg bg-muted/30 p-4" data-testid="container-staff-preview">
            <div className="bg-white rounded-lg p-4">
              <StaffDashboard isAdminView={false} />
            </div>
          </div>
        </TabsContent>

        {/* Pending Users Tab */}
        <TabsContent value="pending-users" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Pending User Assignments</h2>
              <p className="text-sm text-muted-foreground">Assign new users to existing employees</p>
            </div>
          </div>
          <PendingUsers />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Application Settings</h2>
              <p className="text-sm text-muted-foreground">Configure integrations and application preferences</p>
            </div>
          </div>
          
          <div className="grid gap-6 md:grid-cols-1">
            <GoogleDriveIntegration />
            <UserManagement />
            
            {/* Placeholder for future integrations */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  PDF Settings
                </CardTitle>
                <CardDescription>
                  Configure PDF generation preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  PDF customization options coming soon.
                </p>
              </CardContent>
            </Card>
          </div>
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

        {/* Onboarding Components */}
        {showWelcome && (
          <WelcomeAnimation onComplete={startTour} />
        )}
        
        {showTour && (
          <OnboardingTour 
            isOpen={showTour}
            onClose={skipTour}
            onComplete={completeTour}
          />
        )}
      </div>
    </PageLayout>
  );
}
import { useState, useEffect, useMemo } from "react";
import { useLocation } from "wouter";
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertJobSchema, insertEmployeeSchema, insertTimesheetEntrySchema } from "@shared/schema";
import { z } from "zod";
import JobSheetModal from "@/components/job-sheet-modal";

import StaffDashboard from "@/pages/staff-dashboard";
import { Plus, Users, Briefcase, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, MoreVertical, Clock, Calendar, CheckCircle, XCircle, Eye, FileText, Search, Filter, Palette, Settings, UserPlus, Download, Edit, DollarSign, TrendingUp, Building2, Bell, RotateCcw, Shield, Lock, RefreshCw, Trophy, Upload, User, Copy, Link } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import type { Job, Employee, TimesheetEntry } from "@shared/schema";
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import PageLayout from "@/components/page-layout";
import { GoogleDriveIntegration } from "@/components/google-drive-integration";
import { TimesheetSearch } from "@/components/timesheet-search";
import { OnboardingTour, WelcomeAnimation } from "@/components/onboarding-tour";
import { useOnboarding } from "@/hooks/useOnboarding";
import { UserManagement } from "@/components/user-management";

import { generateJobListPDF } from "@/lib/pdfGenerator";
import JobUpdateDialog from "@/components/job-update-form";
import { DocumentExpenseProcessor } from "@/components/DocumentExpenseProcessor";
import EmailProcessingReview from "@/components/EmailProcessingReview";
import { NotificationSettings } from "@/components/NotificationSettings";
import WeeklyOrganiser from "@/components/weekly-organiser";

// Helper function to format date as "16th Aug" format
const formatJobDate = (dateStr: string | Date) => {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : dateStr;
    const day = format(date, 'd');
    const suffix = day.endsWith('1') && day !== '11' ? 'st' :
                   day.endsWith('2') && day !== '12' ? 'nd' :
                   day.endsWith('3') && day !== '13' ? 'rd' : 'th';
    return format(date, `d'${suffix}' MMM`);
  } catch (error) {
    console.log('Date formatting error:', error, 'for date:', dateStr);
    return 'Date unknown';
  }
};

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
  const { user, isAuthenticated, isLoading, isUsingBackup } = useAuth();
  const { toast } = useToast();
  const [location] = useLocation();
  const { 
    showWelcome, 
    showTour, 
    isOnboardingComplete,
    startTour, 
    completeTour, 
    skipTour 
  } = useOnboarding();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [deleteJobDialogOpen, setDeleteJobDialogOpen] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<Job | null>(null);
  const [deletePassword, setDeletePassword] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Define the deletion password - you can change this to whatever you prefer
  const [DELETION_PASSWORD, setDELETION_PASSWORD] = useState(() => {
    return localStorage.getItem('buildflow-deletion-password') || 'Festool1!';
  });

  // Password management functions
  const handlePasswordUpdate = () => {
    if (currentPasswordForEdit !== DELETION_PASSWORD) {
      toast({
        title: "Error",
        description: "Current password is incorrect",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error", 
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 3) {
      toast({
        title: "Error",
        description: "Password must be at least 3 characters long",
        variant: "destructive",
      });
      return;
    }

    setDELETION_PASSWORD(newPassword);
    localStorage.setItem('buildflow-deletion-password', newPassword);
    
    // Reset form
    setIsEditingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPasswordForEdit('');
    
    toast({
      title: "Success",
      description: "Deletion password updated successfully",
    });
  };

  const handleCancelPasswordEdit = () => {
    setIsEditingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPasswordForEdit('');
  };

  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<string | null>(null);
  const [isCreateTimesheetOpen, setIsCreateTimesheetOpen] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Set<string>>(new Set());
  const [expandedManagers, setExpandedManagers] = useState<Set<string>>(new Set());
  const [groupBy, setGroupBy] = useState<'client' | 'manager' | 'none'>('manager');
  const [searchQuery, setSearchQuery] = useState("");
  const [archivedSearchQuery, setArchivedSearchQuery] = useState("");
  const [selectedEmployeeFilter, setSelectedEmployeeFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [selectedFortnightFilter, setSelectedFortnightFilter] = useState<string>("all");
  // Start with all fortnights collapsed by default for cleaner view
  const [collapsedFortnights, setCollapsedFortnights] = useState<Set<string>>(new Set());
  // Separate state for approved timesheets folder
  const [isApprovedFolderCollapsed, setIsApprovedFolderCollapsed] = useState(true);
  // State for individual employee folders within approved section
  const [collapsedEmployeeFolders, setCollapsedEmployeeFolders] = useState<Set<string>>(new Set());
  const [isAddingNewProjectManager, setIsAddingNewProjectManager] = useState(false);
  const [newProjectManagerName, setNewProjectManagerName] = useState("");
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [folderColors, setFolderColors] = useState<Record<string, number>>({});
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [isDeletedFolderExpanded, setIsDeletedFolderExpanded] = useState(false);
  const viewMode = 'list'; // Always use list view
  const [sortBy, setSortBy] = useState<'address' | 'client' | 'manager' | 'status'>('address');
  const [activeTab, setActiveTab] = useState("jobs");
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false);
  
  // Password management state
  const [isEditingPassword, setIsEditingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordForEdit, setCurrentPasswordForEdit] = useState('');
  const [editAddressData, setEditAddressData] = useState<{entryId: string, currentAddress: string}>({entryId: '', currentAddress: ''});
  const [showLowHoursDialog, setShowLowHoursDialog] = useState(false);
  const [lowHoursTotal, setLowHoursTotal] = useState(0);
  const [pendingApproval, setPendingApproval] = useState<{staffId: string, fortnightStart: string, fortnightEnd: string, approved: boolean} | null>(null);

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
    enabled: !isUsingBackup, // Don't query if using backup auth
  });

  const { data: totalCostsData, isLoading: totalCostsLoading } = useQuery<{
    totalCosts: number;
    jobCount: number;
    costBreakdown: {
      materials: number;
      labor: number;
      subTrades: number;
      otherCosts: number;
      tipFees: number;
    };
  }>({
    queryKey: ["/api/jobs/total-costs"],
    retry: false,
    enabled: !isUsingBackup, // Don't query if using backup auth
  });

  const { data: deletedJobs, isLoading: deletedJobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/deleted-jobs"],
    retry: false,
    enabled: !isUsingBackup, // Don't query if using backup auth
  });

  const { data: employees, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    retry: false,
    enabled: !isUsingBackup, // Don't query if using backup auth
  });

  const { data: allTimesheets, isLoading: timesheetsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/timesheets"],
    retry: false,
    enabled: !isUsingBackup, // Don't query if using backup auth
  });

  // Get all staff (users and employees) for timesheet assignment
  const { data: staffForTimesheets, isLoading: staffUsersLoading } = useQuery<any[]>({
    queryKey: ["/api/staff-users"],
    retry: false,
    enabled: !isUsingBackup, // Don't query if using backup auth
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
    // Create a local date copy to avoid timezone issues
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const day = d.getDay();
    // Adjust to Monday: if Sunday (0), go back 6 days; otherwise go back (day-1) days
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const mondayOfWeek = new Date(d);
    
    // Find which fortnight this Monday belongs to
    // Base date: August 11, 2025 (Monday) - aligned so Nov 17-30, Dec 1-14 are correct fortnights
    const baseDate = new Date(2025, 7, 11); // August 11, 2025 - Monday (month is 0-indexed)
    const diffTime = mondayOfWeek.getTime() - baseDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const fortnightNumber = Math.floor(diffDays / 14);
    
    // Calculate fortnight start by adding fortnight weeks to base date
    const fortnightStart = new Date(2025, 7, 11); // Fresh copy of base date
    fortnightStart.setDate(11 + (fortnightNumber * 14)); // Add days from the 11th
    
    return fortnightStart;
  };

  // Helper function to get fortnight end date (Sunday)
  const getFortnightEnd = (fortnightStart: Date) => {
    const end = new Date(fortnightStart.getFullYear(), fortnightStart.getMonth(), fortnightStart.getDate());
    end.setDate(fortnightStart.getDate() + 13);
    return end;
  };

  // Helper function to parse date string as local date (avoids timezone issues)
  const parseLocalDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day); // month is 0-indexed
  };

  // Get available fortnights from timesheet data
  const availableFortnights = useMemo(() => {
    if (!Array.isArray(allTimesheets) || allTimesheets.length === 0) return [];
    
    const fortnightSet = new Set<string>();
    allTimesheets.forEach((entry: any) => {
      // Parse date as local to avoid timezone issues
      const entryDate = parseLocalDate(entry.date);
      const fortnightStart = getFortnightStart(entryDate);
      const fortnightEnd = getFortnightEnd(fortnightStart);
      const fortnightKey = `${format(fortnightStart, 'yyyy-MM-dd')}_${format(fortnightEnd, 'yyyy-MM-dd')}`;
      fortnightSet.add(fortnightKey);
    });
    
    return Array.from(fortnightSet)
      .map(key => {
        const [startStr, endStr] = key.split('_');
        const start = parseLocalDate(startStr);
        const end = parseLocalDate(endStr);
        return {
          key,
          start,
          end,
          label: `${format(start, 'dd MMM')} - ${format(end, 'dd MMM yyyy')}`
        };
      })
      .sort((a, b) => b.start.getTime() - a.start.getTime()); // Most recent first
  }, [allTimesheets]);

  // Group timesheets by staff and fortnight
  const groupedTimesheets = useMemo(() => {
    // DEBUG: Log all raw entries
    console.log('📋 DEBUG: Total allTimesheets count:', Array.isArray(allTimesheets) ? allTimesheets.length : 0);
    if (Array.isArray(allTimesheets) && allTimesheets.length > 0) {
      console.log('📋 DEBUG: Sample entries (first 5):', allTimesheets.slice(0, 5).map((e: any) => ({
        date: e.date,
        staffName: e.staffName,
        staffId: e.staffId
      })));
      
      // Log all unique dates in the data
      const uniqueDates = [...new Set(allTimesheets.map((e: any) => e.date))].sort();
      console.log('📅 DEBUG: All unique dates in data:', uniqueDates);
    }
    
    const filtered = (Array.isArray(allTimesheets) ? allTimesheets : []).filter((entry: any) => {
      const employeeMatch = selectedEmployeeFilter === "all" || entry.staffId === selectedEmployeeFilter;
      
      // Fortnight filter - use parseLocalDate to avoid timezone issues
      if (selectedFortnightFilter !== "all") {
        const entryDate = parseLocalDate(entry.date);
        const fortnightStart = getFortnightStart(entryDate);
        const fortnightEnd = getFortnightEnd(fortnightStart);
        const fortnightKey = `${format(fortnightStart, 'yyyy-MM-dd')}_${format(fortnightEnd, 'yyyy-MM-dd')}`;
        
        // DEBUG: Log fortnight calculation for each entry
        if (entry.date >= '2025-11-17' && entry.date <= '2025-11-30') {
          console.log(`🔍 DEBUG: Entry ${entry.date} -> fortnightKey: ${fortnightKey}, selectedFilter: ${selectedFortnightFilter}, match: ${fortnightKey === selectedFortnightFilter}`);
        }
        
        if (fortnightKey !== selectedFortnightFilter) return false;
      }
      
      if (!employeeMatch) return false;
      
      if (dateRangeFilter === "all") return true;
      
      // Use parseLocalDate to avoid timezone issues
      const entryDate = parseLocalDate(entry.date);
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
    
    console.log('✅ DEBUG: Filtered entries count:', filtered.length);
    console.log('✅ DEBUG: Filtered entries dates:', [...new Set(filtered.map((e: any) => e.date))].sort());

    const grouped = new Map();

    filtered.forEach((entry) => {
      // Use parseLocalDate to avoid timezone issues
      const entryDate = parseLocalDate(entry.date);
      const fortnightStart = getFortnightStart(entryDate);
      const fortnightEnd = getFortnightEnd(fortnightStart);
      const key = `${entry.staffId}-${format(fortnightStart, 'yyyy-MM-dd')}`;

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

  // Group approved timesheets by employee
  const approvedByEmployee = useMemo(() => {
    const employeeGroups: { [key: string]: any } = {};
    
    approvedTimesheets.forEach(fortnight => {
      const employeeKey = fortnight.staffId;
      if (!employeeGroups[employeeKey]) {
        employeeGroups[employeeKey] = {
          staffId: fortnight.staffId,
          staffName: fortnight.staffName,
          fortnights: [],
          totalHours: 0,
          totalEntries: 0
        };
      }
      
      employeeGroups[employeeKey].fortnights.push(fortnight);
      employeeGroups[employeeKey].totalHours += fortnight.totalHours;
      employeeGroups[employeeKey].totalEntries += fortnight.totalCount;
    });
    
    return Object.values(employeeGroups).sort((a: any, b: any) => a.staffName.localeCompare(b.staffName));
  }, [approvedTimesheets]);

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

  const permanentDeleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await apiRequest("DELETE", `/api/jobs/${jobId}/permanent`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      setDeleteJobDialogOpen(false);
      setJobToDelete(null);
      setDeletePassword('');
      toast({
        title: "Success",
        description: "Job permanently deleted",
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
        description: "Failed to permanently delete job",
        variant: "destructive",
      });
    },
  });

  const handleDeleteJobClick = (job: Job) => {
    setJobToDelete(job);
    setDeleteJobDialogOpen(true);
  };

  const handleSavePDFBeforeDelete = async () => {
    if (!jobToDelete) return;
    
    setIsGeneratingPDF(true);
    try {
      const response = await fetch(`/api/jobs/${jobToDelete.id}/pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-sheet-${jobToDelete.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Saved",
        description: "Job sheet PDF has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!jobToDelete) return;
    
    if (deletePassword !== DELETION_PASSWORD) {
      toast({
        title: "Invalid Password",
        description: "Please enter the correct deletion password",
        variant: "destructive",
      });
      return;
    }

    permanentDeleteJobMutation.mutate(jobToDelete.id);
  };



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

  // Update employee mutation
  const updateEmployeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) => {
      const response = await apiRequest("PATCH", `/api/employees/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      setEditingEmployee(null);
      toast({
        title: "Success",
        description: "Employee updated successfully",
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
        description: "Failed to update employee",
        variant: "destructive",
      });
    },
  });

  // Toggle employee status mutation
  const toggleEmployeeStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest("POST", `/api/employees/${id}/toggle`, { isActive });
      return response.json();
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Success",
        description: `Employee ${isActive ? 'activated' : 'deactivated'} successfully. ${isActive ? 'They will now appear in new job sheets.' : 'They will no longer appear in new job sheets.'}`,
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
        description: "Failed to toggle employee status",
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
      console.log(`🚀 APPROVAL MUTATION STARTING:`, { staffId, fortnightStart, fortnightEnd, approved });
      console.log(`📋 APPROVAL - Sending request to update entries for staffId: ${staffId}`);
      console.log(`📅 APPROVAL - Date range: ${fortnightStart} to ${fortnightEnd}`);
      const response = await apiRequest("PATCH", `/api/admin/timesheet/approve-fortnight`, { 
        staffId, 
        fortnightStart, 
        fortnightEnd, 
        approved 
      });
      console.log(`✅ APPROVAL MUTATION RESPONSE:`, response);
      console.log(`📦 APPROVAL RESPONSE BODY:`, JSON.stringify(response));
      return response;
    },
    onSuccess: async (response, variables) => {
      console.log(`✅ APPROVAL SUCCESS - Response data:`, response);
      console.log(`✅ APPROVAL SUCCESS - Invalidating cache for ["/api/admin/timesheets"]`);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      
      // Force refetch and log result
      const refetchedData = queryClient.getQueryData(["/api/admin/timesheets"]);
      console.log(`📊 AFTER INVALIDATION - Cached data entries:`, Array.isArray(refetchedData) ? refetchedData.length : 'not an array');
      
      const action = variables.approved ? "approved" : "unapproved";
      console.log(`✅ APPROVAL SUCCESS - Showing toast: ${action}`);
      toast({
        title: "Success",
        description: `Fortnight timesheet ${action} successfully`,
      });
    },
    onError: (error) => {
      console.error(`❌ APPROVAL MUTATION FAILED:`, error);
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

  // Removed database reset functionality for production safety

  const editCustomAddressMutation = useMutation({
    mutationFn: async ({ entryId, address }: { entryId: string; address: string }) => {
      const response = await apiRequest("PATCH", `/api/admin/timesheet/${entryId}/custom-address`, { address });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      toast({
        title: "Success",
        description: "Custom address updated successfully",
      });
      setShowEditAddressDialog(false);
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
        description: "Failed to update custom address",
        variant: "destructive",
      });
    },
  });

  const editCustomAddress = (entryId: string, currentAddress: string) => {
    setEditAddressData({ entryId, currentAddress });
    setShowEditAddressDialog(true);
  };

  // Helper function to toggle employee folder collapse state
  const toggleEmployeeFolder = (employeeId: string) => {
    setCollapsedEmployeeFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  };

  const jobForm = useForm<z.infer<typeof jobFormSchema>>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      jobAddress: "",
      clientName: "",
      projectName: "",
      projectManager: "",
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
          return (a.projectManager || a.projectName).localeCompare(b.projectManager || b.projectName);
          
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
      (job.projectManager || job.projectName || '').toLowerCase().includes(query) ||
      job.status.toLowerCase().includes(query)
    );
  }) : [];

  // Apply sorting to filtered jobs
  const sortedJobs = sortJobsBy(filteredJobs, sortBy);

  // Group filtered jobs by client or project manager
  const groupedJobs = useMemo(() => {
    if (!sortedJobs) return {};
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
        const manager = job.projectManager || '📝 Unassigned Jobs';
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
  }, [sortedJobs, groupBy, sortBy]);

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
    // Pinks (Dark Pink for Will's jobs)
    {
      name: 'Dark Pink',
      bg: 'bg-pink-100 border-pink-400',
      folderBg: 'bg-pink-200 hover:bg-pink-250',
      folderIcon: 'text-pink-700',
      folderText: 'text-pink-900',
      badge: 'bg-pink-300 text-pink-900 border-pink-400',
      preview: 'bg-pink-700'
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
    // Purples (Dark Purple for Mark's jobs)
    {
      name: 'Dark Purple',
      bg: 'bg-purple-100 border-purple-400',
      folderBg: 'bg-purple-200 hover:bg-purple-250',
      folderIcon: 'text-purple-700',
      folderText: 'text-purple-900',
      badge: 'bg-purple-300 text-purple-900 border-purple-400',
      preview: 'bg-purple-700'
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
      // Special color coding for specific project managers
      const managerName = groupName.toLowerCase();
      if (managerName.includes('will')) {
        return allColorThemes[2]; // Pink for Will's jobs
      } else if (managerName.includes('mark')) {
        return allColorThemes[6]; // Purple for Mark's jobs
      }
      
      // Project manager folders - Use different warm colors
      const managerColors = [7, 8, 9, 10, 11, 1]; // Red, Yellow, Lime, Rose, Violet, Orange
      const hash = groupName.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
      return allColorThemes[managerColors[hash % managerColors.length]];
    }
    
    // Default neutral theme
    return allColorThemes[13]; // Slate
  };

  // Helper function to get job card colors based on project manager
  const getJobCardColors = (job: Job) => {
    const managerName = (job.projectManager || '').toLowerCase();
    if (managerName.includes('will')) {
      return allColorThemes[2]; // Pink for Will's jobs
    } else if (managerName.includes('mark')) {
      return allColorThemes[6]; // Purple for Mark's jobs
    }
    
    // Default white background for other jobs - matches theme structure
    return {
      name: 'Default',
      bg: 'bg-white',
      folderBg: 'bg-gray-100 hover:bg-gray-150',
      folderIcon: 'text-gray-600',
      folderText: 'text-gray-800',
      badge: 'bg-gray-200 text-gray-800 border-gray-300',
      preview: 'bg-gray-500'
    };
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
  const projectManagers = jobs ? Array.from(new Set(jobs.map(job => job.projectManager || job.projectName).filter(Boolean))) : [];
  const clientNames = jobs ? Array.from(new Set(jobs.map(job => job.clientName).filter(Boolean))) : [];

  const handleAddProjectManager = () => {
    if (newProjectManagerName.trim()) {
      jobForm.setValue('projectManager', newProjectManagerName.trim());
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

  const editEmployeeForm = useForm<z.infer<typeof employeeFormSchema>>({
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
      jobForm.setValue('projectManager', value);
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

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee.id);
    editEmployeeForm.setValue('name', employee.name);
  };

  const onEditEmployeeSubmit = (data: z.infer<typeof employeeFormSchema>) => {
    if (editingEmployee) {
      updateEmployeeMutation.mutate({ id: editingEmployee, data });
    }
  };

  const handleCancelEdit = () => {
    setEditingEmployee(null);
    editEmployeeForm.reset();
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
      case "job_on_hold":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
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
      {/* Backup Mode Notification */}
      {isUsingBackup && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600" />
            <div>
              <h4 className="font-semibold text-amber-800">
                🔄 Backup Mode Active
              </h4>
              <p className="text-sm text-amber-700 mt-1">
                You're viewing cached data while the server reconnects. Some features may be limited.
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div className="space-y-6">
        {/* Compact Navigation - Enhanced with Colors */}
        <div className="flex items-center justify-between mb-6">
          {/* Primary Navigation - Most Used */}
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "jobs" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("jobs")}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === "jobs" 
                  ? "bg-blue-600 hover:bg-blue-700 text-white shadow-lg" 
                  : "border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 hover:shadow-md"
              }`}
              data-testid="tab-jobs"
            >
              <Briefcase className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Jobs</span>
            </Button>
            <Button
              variant={activeTab === "deleted-jobs" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("deleted-jobs")}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === "deleted-jobs" 
                  ? "bg-red-600 hover:bg-red-700 text-white shadow-lg" 
                  : "border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 hover:shadow-md"
              }`}
              data-testid="tab-deleted-jobs"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Archived</span>
            </Button>
            <Button
              variant={activeTab === "timesheets" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("timesheets")}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === "timesheets" 
                  ? "bg-green-600 hover:bg-green-700 text-white shadow-lg" 
                  : "border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 hover:shadow-md"
              }`}
              data-testid="tab-timesheets"
            >
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Timesheets</span>
            </Button>
            <Button
              variant={activeTab === "search" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("search")}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === "search" 
                  ? "bg-purple-600 hover:bg-purple-700 text-white shadow-lg" 
                  : "border-purple-200 text-purple-600 hover:bg-purple-50 hover:border-purple-300 hover:shadow-md"
              }`}
              data-testid="tab-search"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Search</span>
            </Button>
            <Button
              variant={activeTab === "organiser" ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveTab("organiser")}
              className={`flex items-center gap-2 transition-all duration-200 ${
                activeTab === "organiser" 
                  ? "bg-orange-600 hover:bg-orange-700 text-white shadow-lg" 
                  : "border-orange-200 text-orange-600 hover:bg-orange-50 hover:border-orange-300 hover:shadow-md"
              }`}
              data-testid="tab-organiser"
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline font-medium">Organiser</span>
            </Button>
          </div>

          {/* More Button - Opens App Grid Page */}
          <Button 
            variant={activeTab === "more" ? "default" : "outline"} 
            size="sm" 
            onClick={() => setActiveTab("more")}
            className="flex items-center gap-2"
            data-testid="tab-more"
          >
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">More</span>
          </Button>
        </div>



        {/* Content Sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
                      name="projectManager"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Project Manager</FormLabel>
                          <div className="space-y-2">
                            {!isAddingNewProjectManager ? (
                              <div className="flex gap-2">
                                <FormControl className="flex-1">
                                  <Select onValueChange={handleProjectManagerChange} value={field.value || undefined}>
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

          {/* Total Costs Dashboard Widget */}
          {!totalCostsLoading && totalCostsData && (
            <div className="mb-6">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 via-indigo-600 to-cyan-600 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 animate-pulse"></div>
                <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 via-pink-500 to-indigo-500 rounded-2xl opacity-20 animate-pulse" style={{animationDuration: '2s'}}></div>
                <Card className="relative bg-gradient-to-br from-white via-gray-50 to-slate-100 border-0 shadow-xl rounded-2xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-purple-50/20 to-indigo-50/30"></div>
                  <CardContent className="relative py-5 px-8">
                    <div className="text-center">
                      <div className="text-4xl font-black tracking-tight bg-gradient-to-r from-blue-700 via-purple-700 to-indigo-800 bg-clip-text text-transparent drop-shadow-sm">
                        ${totalCostsData.totalCosts.toLocaleString('en-AU', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })}
                      </div>
                      <div className="text-sm font-medium text-gray-600 mt-1 tracking-wide">
                        Excluding GST
                      </div>
                    </div>
                  </CardContent>
                  <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-500 animate-pulse"></div>
                </Card>
              </div>
            </div>
          )}

          {/* Search and Group Controls - Mobile Optimized */}
          <div className="space-y-3 mb-6">
            {/* Search Bar - Full Width */}
            <div className="w-full">
              <Input
                placeholder="Search jobs by address, client, manager, or status..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
                data-testid="input-search-jobs"
              />
            </div>
            
            {/* Filter Controls - Side by Side on Mobile */}
            <div className="flex gap-2 w-full">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
                <SelectTrigger 
                  className="flex-1 min-w-0"
                  data-testid="select-sort-by"
                >
                  <Filter className="h-4 w-4 mr-2 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="address">Sort by Address</SelectItem>
                  <SelectItem value="client">Sort by Client</SelectItem>
                  <SelectItem value="manager">Sort by Manager</SelectItem>
                  <SelectItem value="status">Sort by Status</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={groupBy} onValueChange={(value) => setGroupBy(value as any)}>
                <SelectTrigger 
                  className="flex-1 min-w-0"
                  data-testid="select-group-by"
                >
                  <Folder className="h-4 w-4 mr-2 flex-shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Group by Client</SelectItem>
                  <SelectItem value="manager">Group by Manager</SelectItem>
                  <SelectItem value="none">No Grouping</SelectItem>
                </SelectContent>
              </Select>
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
              {Object.entries(groupedJobs || {}).map(([groupName, groupJobs]) => {
                const isExpanded = isReadyForBillingGroup(groupName) ? readyForBillingExpanded :
                                 groupBy === 'client' ? expandedClients.has(groupName) : 
                                 groupBy === 'manager' ? expandedManagers.has(groupName) : true;
                const toggleExpanded = isReadyForBillingGroup(groupName) ? toggleReadyForBillingExpanded :
                                     groupBy === 'client' ? () => toggleClientExpanded(groupName) :
                                     groupBy === 'manager' ? () => toggleManagerExpanded(groupName) : () => {};
                
                // Show individual jobs if no grouping or only one group
                if (groupBy === 'none' || Object.keys(groupedJobs || {}).length === 1) {
                  return (
                    <div key={groupName} className="space-y-2">
                      {(Array.isArray(groupJobs) ? groupJobs : []).map((job) => (
                        <Card 
                            key={job.id} 
                            className={`cursor-pointer transition-shadow relative ${
                              groupBy === 'none' 
                                ? `${getJobCardColors(job).bg} border-gray-200 hover:shadow-md border`
                                : 'hover:shadow-md bg-white'
                            }`}
                            onClick={() => setSelectedJob(job.id)}
                            data-testid={`card-job-${job.id}`}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <h3 className="font-medium text-sm sm:text-base truncate">{job.jobAddress}</h3>
                                  {job.clientName && (
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{job.clientName}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {job.createdAt ? `Added ${formatJobDate(job.createdAt)}` : 'Date not available'}
                                  </p>
                                  <div className="text-xs font-medium text-green-700 dark:text-green-400 mt-1" data-testid={`text-total-exgst-${job.id}`}>
                                    Total ex GST: ${((job as any).subtotalExGst || 0).toFixed(2)}
                                  </div>
                                </div>
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
                    className={`border rounded-lg p-3 sm:p-4 transition-colors ${colors.bg} mb-3 sm:mb-4`}
                  >
                    <div 
                      className={`p-2 sm:p-3 rounded transition-colors ${colors.folderBg}`}
                    >
                      {/* Top row: Folder info and action buttons */}
                      <div className="flex items-center gap-2">
                        <div 
                          className="flex items-center gap-2 flex-1 cursor-pointer"
                          onClick={toggleExpanded}
                          data-testid={`folder-${groupName}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 shrink-0" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0" />
                          )}
                          {isExpanded ? (
                            <FolderOpen className={`h-5 w-5 shrink-0 ${colors.folderIcon}`} />
                          ) : (
                            <Folder className={`h-5 w-5 shrink-0 ${colors.folderIcon}`} />
                          )}
                          <span className={`font-medium ${colors.folderText} truncate`}>{groupName}</span>
                          <Badge 
                            variant="secondary" 
                            className={`ml-2 shrink-0 ${colors.badge} text-xs px-2 py-1`}
                          >
                            {groupJobs.length}
                          </Badge>
                        </div>
                        
                        {/* PDF Download Button for Project Managers */}
                        {groupBy === 'manager' && !isReadyForBillingGroup(groupName) && (
                          <div className="flex gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 hover:bg-white/20"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await generateJobListPDF(groupJobs, groupName);
                                  toast({
                                    title: "PDF Downloaded",
                                    description: `Job list for ${groupName} has been downloaded.`,
                                  });
                                } catch (error) {
                                  toast({
                                    title: "Download Failed",
                                    description: "Failed to generate PDF. Please try again.",
                                    variant: "destructive",
                                  });
                                }
                              }}
                              title={`Download PDF job list for ${groupName}`}
                              data-testid={`download-pdf-${groupName}`}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <JobUpdateDialog projectManager={groupName} />
                          </div>
                        )}
                        
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
                      
                      {/* Folder Total Excluding GST - Below folder name */}
                      <div className="mt-2 pl-9 text-base font-semibold text-gray-800 dark:text-gray-200" data-testid={`text-folder-total-${groupName}`}>
                        {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(
                          groupJobs.reduce((sum, job) => sum + ((job as any).subtotalExGst || 0), 0)
                        )}
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="mt-3 space-y-1.5">
                        {groupJobs.map((job) => (
                            <Card 
                              key={job.id} 
                              className="cursor-pointer hover:shadow-md transition-shadow bg-white relative border-l-4 border-r-4"
                              style={{
                                borderLeftColor: job.status === 'ready_for_billing' ? '#a855f7' :
                                  job.status === 'job_complete' ? '#10b981' :
                                  job.status === 'job_in_progress' ? '#f59e0b' :
                                  job.status === 'job_on_hold' ? '#ef4444' :
                                  '#60a5fa',
                                borderRightColor: job.status === 'ready_for_billing' ? '#a855f7' :
                                  job.status === 'job_complete' ? '#10b981' :
                                  job.status === 'job_in_progress' ? '#f59e0b' :
                                  job.status === 'job_on_hold' ? '#ef4444' :
                                  '#60a5fa'
                              }}
                              onClick={() => setSelectedJob(job.id)}
                              data-testid={`card-job-${job.id}`}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3">
                                      <div className="min-w-0 flex-1">
                                        <h3 className="font-medium text-sm sm:text-base truncate">{job.jobAddress}</h3>
                                        {job.clientName && (
                                          <p className="text-xs text-muted-foreground truncate">{job.clientName}</p>
                                        )}
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {job.createdAt ? `Added ${formatJobDate(job.createdAt)}` : 'Date not available'}
                                        </p>
                                        <div className="text-xs font-medium text-green-700 dark:text-green-400 mt-1" data-testid={`text-total-exgst-${job.id}`}>
                                          Total ex GST: ${((job as any).subtotalExGst || 0).toFixed(2)}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
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
                                          <SelectItem value="job_on_hold">Job On Hold</SelectItem>
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

          {/* Deleted Jobs Tab */}
          <TabsContent value="deleted-jobs" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold">Previous Completed Job Sheets</h2>
                <p className="text-sm text-muted-foreground">Manage archived and deleted job sheets</p>
              </div>
            </div>

            {/* Search Bar for Archived Jobs */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search by job address..."
                value={archivedSearchQuery}
                onChange={(e) => setArchivedSearchQuery(e.target.value)}
                className="pl-12 h-12 border-gray-200 focus:ring-2 focus:ring-blue-500"
                data-testid="input-search-archived-jobs"
                aria-label="Search archived jobs by address"
              />
              {archivedSearchQuery && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  onClick={() => setArchivedSearchQuery("")}
                  data-testid="button-clear-archived-search"
                >
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>

            {deletedJobs && deletedJobs.length > 0 ? (
              (() => {
                // Filter deleted jobs based on search query
                const filteredJobs = deletedJobs.filter((job) => {
                  if (!archivedSearchQuery) return true;
                  const query = archivedSearchQuery.toLowerCase();
                  return (
                    job.jobAddress?.toLowerCase().includes(query) ||
                    job.clientName?.toLowerCase().includes(query) ||
                    job.projectManager?.toLowerCase().includes(query) ||
                    job.projectName?.toLowerCase().includes(query)
                  );
                });

                if (filteredJobs.length === 0) {
                  return (
                    <Card className="p-8 text-center">
                      <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">No jobs found</h3>
                      <p className="text-muted-foreground mb-4">Try adjusting your search terms</p>
                      <Button 
                        variant="outline" 
                        onClick={() => setArchivedSearchQuery("")}
                        data-testid="button-clear-archived-search-empty"
                      >
                        Clear Search
                      </Button>
                    </Card>
                  );
                }

                return (
                  <>
                    <div className="text-sm text-gray-600 mb-4">
                      {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'} found
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredJobs.map((job) => (
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
                                className="text-blue-600 focus:text-blue-600 focus:bg-blue-50 hover:bg-blue-50 font-medium"
                                data-testid={`restore-job-${job.id}`}
                              >
                                <RefreshCw className="h-4 w-4 mr-2" />
                                ↩️ Restore Job
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setJobToDelete(job);
                                  setDeleteJobDialogOpen(true);
                                }}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 hover:bg-red-50 font-medium"
                                data-testid={`permanent-delete-job-${job.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                🗑️ Permanently Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">{job.clientName}</p>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground mb-2">PM: {job.projectManager || job.projectName}</p>
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
                  </>
                );
              })()
            ) : (
              <Card className="p-8 text-center">
                <Trash2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No archived jobs</h3>
                <p className="text-muted-foreground">Deleted job sheets will appear here</p>
              </Card>
            )}
          </TabsContent>

          {/* More Apps Grid Page */}
          <TabsContent value="more" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold">More Apps</h2>
                <p className="text-sm text-muted-foreground">Access additional features and settings</p>
              </div>
            </div>

            {/* App Grid Layout - Alphabetically Sorted */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Document Processing App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200"
                onClick={() => setActiveTab("documents")}
                data-testid="app-documents"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-orange-500 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Documents</h3>
                  <p className="text-xs text-muted-foreground mt-1">Process uploads</p>
                </CardContent>
              </Card>

              {/* Notification Settings App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200"
                onClick={() => setActiveTab("notifications")}
                data-testid="app-notifications"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Bell className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Notifications</h3>
                  <p className="text-xs text-muted-foreground mt-1">Email preferences</p>
                </CardContent>
              </Card>

              {/* Rewards Dashboard App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-yellow-50 to-amber-100 border-yellow-200"
                onClick={() => window.location.href = '/rewards'}
                data-testid="app-rewards"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-yellow-500 rounded-full flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Rewards</h3>
                  <p className="text-xs text-muted-foreground mt-1">View achievements</p>
                </CardContent>
              </Card>

              {/* Rewards Config App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-emerald-50 to-teal-100 border-emerald-200"
                onClick={() => window.location.href = '/admin/rewards'}
                data-testid="app-rewards-config"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-emerald-500 rounded-full flex items-center justify-center">
                    <Settings className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Rewards Config</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage rewards</p>
                </CardContent>
              </Card>

              {/* Rewards Rules App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200"
                onClick={() => window.location.href = '/rewards/rules'}
                data-testid="app-rewards-rules"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-orange-500 rounded-full flex items-center justify-center">
                    <Trophy className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Rewards Rules</h3>
                  <p className="text-xs text-muted-foreground mt-1">View earning rules</p>
                </CardContent>
              </Card>

              {/* Settings App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200"
                onClick={() => setActiveTab("settings")}
                data-testid="app-settings"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-500 rounded-full flex items-center justify-center">
                    <Settings className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Settings</h3>
                  <p className="text-xs text-muted-foreground mt-1">App configuration</p>
                </CardContent>
              </Card>

              {/* Staff Management App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200"
                onClick={() => setActiveTab("employees")}
                data-testid="app-employees"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-blue-500 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Staff Management</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage employees</p>
                </CardContent>
              </Card>

              {/* Staff Notes App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200"
                onClick={() => window.location.href = '/staff-notes'}
                data-testid="app-staff-notes"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-purple-500 rounded-full flex items-center justify-center">
                    <FileText className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Staff Notes</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage staff records</p>
                </CardContent>
              </Card>

              {/* Staff View App */}
              <Card 
                className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-105 bg-gradient-to-br from-green-50 to-green-100 border-green-200"
                onClick={() => setActiveTab("staff-view")}
                data-testid="app-staff-view"
              >
                <CardContent className="p-6 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-green-500 rounded-full flex items-center justify-center">
                    <Eye className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-medium text-sm">Staff View</h3>
                  <p className="text-xs text-muted-foreground mt-1">Preview staff dashboard</p>
                </CardContent>
              </Card>
            </div>

            {/* Quick Access Section */}
            <div className="mt-8">
              <h3 className="text-lg font-medium mb-4">Quick Access</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card className="p-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-indigo-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-500 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">User Management</h4>
                      <p className="text-xs text-muted-foreground">Found in Settings → User Management</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 bg-gradient-to-r from-emerald-50 to-green-50 border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h4 className="font-medium text-sm">Security Settings</h4>
                      <p className="text-xs text-muted-foreground">Found in Settings → Security</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

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
                              {validStaff.sort((a, b) => a.name.localeCompare(b.name)).map((staff) => (
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
                              {/* Regular Jobs Section - Updated for consistency */}
                              {jobs?.filter(job => job.id && job.id.trim() !== '')
                                .sort((a, b) => a.jobAddress.localeCompare(b.jobAddress))
                                .map((job) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobAddress}
                                </SelectItem>
                              ))}
                              
                              {/* Visual Separator for Leave Types */}
                              <Separator className="my-2" />
                              <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">
                                Leave Types
                              </div>
                              
                              {/* Leave Types Section - Pinned at Bottom */}
                              <SelectItem value="sick-leave">Sick Leave</SelectItem>
                              <SelectItem value="personal-leave">Personal Leave</SelectItem>
                              <SelectItem value="annual-leave">Annual Leave</SelectItem>
                              <SelectItem value="public-holiday">Public Holiday</SelectItem>
                              <SelectItem value="leave-without-pay">Leave without pay</SelectItem>
                              <SelectItem value="rdo">RDO (Rest Day Off)</SelectItem>
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
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <Label htmlFor="fortnight-filter" className="text-sm font-medium">Fortnight Period</Label>
                  <Select value={selectedFortnightFilter} onValueChange={setSelectedFortnightFilter}>
                    <SelectTrigger data-testid="select-fortnight-filter" className="mt-1">
                      <SelectValue placeholder="All fortnights" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">📋 All Fortnights</SelectItem>
                      {availableFortnights.map((fortnight) => (
                        <SelectItem key={fortnight.key} value={fortnight.key}>
                          📅 {fortnight.label}
                        </SelectItem>
                      ))}
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
                    setSelectedFortnightFilter("all");
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
                            onClick={(e) => {
                              console.log('🔥 ADMIN APPROVE BUTTON CLICKED');
                              e.preventDefault();
                              e.stopPropagation();
                              
                              const totalHours = fortnight.entries.reduce((sum: number, entry: any) => {
                                return sum + parseFloat(entry.hours || '0');
                              }, 0);
                              
                              console.log('🚨 ADMIN APPROVE - totalHours:', totalHours, 'will show dialog:', totalHours < 76);
                              
                              // Only show dialog when approving (not unapproving) and hours < 76
                              if (!fortnight.allApproved && totalHours < 76) {
                                console.log('🚨 SHOWING ADMIN LOW HOURS DIALOG');
                                setLowHoursTotal(totalHours);
                                setPendingApproval({
                                  staffId: fortnight.staffId,
                                  fortnightStart: fortnight.fortnightStart.toISOString().split('T')[0],
                                  fortnightEnd: fortnight.fortnightEnd.toISOString().split('T')[0],
                                  approved: !fortnight.allApproved
                                });
                                setShowLowHoursDialog(true);
                                return;
                              }
                              
                              console.log('🚨 APPROVING DIRECTLY - NO DIALOG');
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
                                    // Handle custom addresses - display with CUSTOM_ADDRESS: prefix
                                    if (entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
                                      return entry.description.replace('CUSTOM_ADDRESS: ', 'Custom Address: ');
                                    }
                                    // Handle leave types stored in description field (uppercase format)
                                    const descriptionLeaveTypes: { [key: string]: string } = {
                                      'SICK LEAVE': 'Sick Leave',
                                      'PERSONAL LEAVE': 'Personal Leave',
                                      'ANNUAL LEAVE': 'Annual Leave',
                                      'PUBLIC HOLIDAY': 'Public Holiday',
                                      'RDO': 'RDO (Rest Day Off)',
                                      'LEAVE WITHOUT PAY': 'Leave Without Pay',
                                      'TAFE': 'Tafe'
                                    };
                                    if (!entry.jobAddress && entry.description && descriptionLeaveTypes[entry.description]) {
                                      return descriptionLeaveTypes[entry.description];
                                    }
                                    // Handle leave types stored in jobId field
                                    const leaveTypes: { [key: string]: string } = {
                                      'sick-leave': 'Sick Leave',
                                      'personal-leave': 'Personal Leave', 
                                      'annual-leave': 'Annual Leave',
                                      'public-holiday': 'Public Holiday',
                                      'rdo': 'RDO (Rest Day Off)',
                                      'leave-without-pay': 'Leave Without Pay',
                                      'tafe': 'Tafe'
                                    };
                                    if (!entry.jobAddress && entry.jobId && leaveTypes[entry.jobId]) {
                                      return leaveTypes[entry.jobId];
                                    }
                                    // Fallback: check materials field for backward compatibility
                                    if (!entry.jobAddress && entry.materials && leaveTypes[entry.materials]) {
                                      return leaveTypes[entry.materials];
                                    }
                                    return entry.jobAddress || 'Unknown Job';
                                  })()} • {entry.clientName} • {parseFloat(entry.hours || 0)}h
                                </div>
                                {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                                  <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                    Last updated: {format(parseISO(entry.updatedAt), 'dd/MM/yyyy HH:mm')}
                                  </div>
                                )}
                              </div>
                              {!entry.approved && (
                                <div className="flex gap-2">
                                  {/* Edit button for custom addresses */}
                                  {entry.description && entry.description.startsWith('CUSTOM_ADDRESS:') && (
                                    <>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const address = entry.description.replace('CUSTOM_ADDRESS: ', '');
                                          editCustomAddress(entry.id, address);
                                        }}
                                        disabled={editCustomAddressMutation.isPending}
                                        data-testid={`button-edit-address-${entry.id}`}
                                        className="min-w-20"
                                        title="Edit custom address"
                                      >
                                        <Edit className="h-3 w-3 mr-1" />
                                        Edit
                                      </Button>
                                      {/* Assign to Job button for custom addresses */}
                                      <Button
                                        size="sm"
                                        variant="default"
                                        className="bg-blue-600 hover:bg-blue-700 min-w-28"
                                        onClick={async () => {
                                          const dialog = document.createElement('div');
                                          dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4';
                                          dialog.innerHTML = `
                                            <div class="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
                                              <h3 class="text-lg font-semibold mb-2">Assign to Job</h3>
                                              <p class="text-sm text-gray-600 mb-4">Custom address: ${entry.description.replace('CUSTOM_ADDRESS: ', '')}</p>
                                              <select id="job-select-${entry.id}" class="w-full border border-gray-300 rounded-md p-2 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                                                <option value="">Select a job...</option>
                                              </select>
                                              <div class="flex gap-2 justify-end">
                                                <button id="cancel-btn-${entry.id}" class="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors">Cancel</button>
                                                <button id="assign-btn-${entry.id}" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Assign</button>
                                              </div>
                                            </div>
                                          `;
                                          document.body.appendChild(dialog);

                                          // Fetch jobs and populate dropdown
                                          try {
                                            const response = await fetch('/api/jobs');
                                            const jobs = await response.json();
                                            
                                            // Sort jobs by numeric order (extract leading number from address)
                                            jobs.sort((a: any, b: any) => {
                                              const numA = parseInt(a.jobAddress?.match(/^\d+/)?.[0] || '999999');
                                              const numB = parseInt(b.jobAddress?.match(/^\d+/)?.[0] || '999999');
                                              return numA - numB;
                                            });
                                            
                                            const select = dialog.querySelector('#job-select-' + entry.id) as HTMLSelectElement;
                                            jobs.forEach((job: any) => {
                                              const option = document.createElement('option');
                                              option.value = job.id;
                                              option.textContent = job.jobAddress;
                                              select.appendChild(option);
                                            });
                                          } catch (error) {
                                            console.error('Failed to fetch jobs:', error);
                                          }

                                          // Cancel button
                                          dialog.querySelector('#cancel-btn-' + entry.id)?.addEventListener('click', () => {
                                            dialog.remove();
                                          });

                                          // Assign button
                                          dialog.querySelector('#assign-btn-' + entry.id)?.addEventListener('click', async () => {
                                            const select = dialog.querySelector('#job-select-' + entry.id) as HTMLSelectElement;
                                            const jobId = select.value;
                                            
                                            if (!jobId) {
                                              alert('Please select a job');
                                              return;
                                            }

                                            try {
                                              const response = await fetch('/api/admin/timesheet/assign-job', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ entryId: entry.id, jobId })
                                              });

                                              if (response.ok) {
                                                const result = await response.json();
                                                queryClient.invalidateQueries({ queryKey: ['/api/admin/timesheets'] });
                                                dialog.remove();
                                                // Show success toast
                                                const toast = document.createElement('div');
                                                toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50';
                                                toast.textContent = 'Assigned to: ' + result.jobAddress;
                                                document.body.appendChild(toast);
                                                setTimeout(() => toast.remove(), 3000);
                                              } else {
                                                const error = await response.json();
                                                alert(error.message || 'Failed to assign job');
                                              }
                                            } catch (error) {
                                              alert('Failed to assign job');
                                            }
                                          });

                                          // Close on background click
                                          dialog.addEventListener('click', (e) => {
                                            if (e.target === dialog) {
                                              dialog.remove();
                                            }
                                          });
                                        }}
                                        data-testid={`button-assign-job-${entry.id}`}
                                        title="Assign to job sheet"
                                      >
                                        <Link className="h-3 w-3 mr-1" />
                                        Assign to Job
                                      </Button>
                                    </>
                                  )}
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
                                </div>
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

                {/* Approved Timesheets Folder - Grouped by Employee */}
                {approvedByEmployee.length > 0 && (
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
                                Approved Timesheets ({approvedByEmployee.length} employees)
                              </h3>
                              <p className="text-sm text-green-600">
                                {approvedByEmployee.reduce((total, emp) => total + emp.totalHours, 0).toFixed(1)} hours approved across {approvedByEmployee.reduce((total, emp) => total + emp.fortnights.length, 0)} fortnights
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
                          <div className="space-y-4">
                            {approvedByEmployee.map((employee: any) => (
                              <Card key={`employee-${employee.staffId}`} className="border-green-200">
                                <CardHeader 
                                  className="pb-3 bg-green-50/30 cursor-pointer hover:bg-green-50/50 transition-colors"
                                  onClick={() => toggleEmployeeFolder(employee.staffId)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                      <Users className="h-4 w-4 text-green-600" />
                                      <div>
                                        <h4 className="font-semibold text-green-800">{employee.staffName}</h4>
                                        <p className="text-sm text-green-600">
                                          {employee.totalHours.toFixed(1)} hours • {employee.fortnights.length} fortnights • {employee.totalEntries} entries
                                        </p>
                                      </div>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-green-700 hover:text-green-800 hover:bg-green-100"
                                      data-testid={`button-toggle-employee-${employee.staffId}`}
                                    >
                                      {collapsedEmployeeFolders.has(employee.staffId) ? (
                                        <ChevronRight className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </div>
                                </CardHeader>
                                
                                {!collapsedEmployeeFolders.has(employee.staffId) && (
                                  <CardContent className="p-4 pt-0">
                                    <div className="space-y-3">
                                      {employee.fortnights.map((fortnight: any) => (
                                        <Card key={`approved-${fortnight.staffId}-${fortnight.fortnightStart.toISOString()}`} className="border-green-100 bg-green-25">
                                          <CardHeader className="pb-3 bg-green-25/50">
                                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                              <div className="space-y-1">
                                                <div className="flex items-center gap-2">
                                                  <Calendar className="h-4 w-4 text-green-600" />
                                                  <div className="text-sm font-medium text-green-800">
                                                    Fortnight: {format(fortnight.fortnightStart, 'dd MMM')} - {format(fortnight.fortnightEnd, 'dd MMM yyyy')}
                                                  </div>
                                                  <Badge variant="default" className="bg-green-600 text-xs px-2 py-0.5">
                                                    ✓ Approved
                                                  </Badge>
                                                </div>
                                                <div className="text-sm text-green-600">
                                                  {fortnight.totalHours.toFixed(1)} hours • {fortnight.totalCount} entries
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
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => approveFortnightMutation.mutate({
                                                    staffId: fortnight.staffId,
                                                    fortnightStart: format(fortnight.fortnightStart, 'yyyy-MM-dd'),
                                                    fortnightEnd: format(fortnight.fortnightEnd, 'yyyy-MM-dd'),
                                                    approved: false
                                                  })}
                                                  disabled={approveFortnightMutation.isPending}
                                                  className="border-orange-300 text-orange-700 hover:bg-orange-50"
                                                  data-testid={`button-unapprove-fortnight-${fortnight.staffId}`}
                                                >
                                                  <XCircle className="h-3 w-3 mr-1" />
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
                                                        {(() => {
                                                          // Handle custom addresses - display with CUSTOM_ADDRESS: prefix
                                                          if (entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
                                                            return entry.description.replace('CUSTOM_ADDRESS: ', 'Custom Address: ');
                                                          }
                                                          // Handle leave types stored in description field (uppercase format)
                                                          const descriptionLeaveTypes: { [key: string]: string } = {
                                                            'SICK LEAVE': 'Sick Leave',
                                                            'PERSONAL LEAVE': 'Personal Leave',
                                                            'ANNUAL LEAVE': 'Annual Leave',
                                                            'PUBLIC HOLIDAY': 'Public Holiday',
                                                            'RDO': 'RDO (Rest Day Off)',
                                                            'LEAVE WITHOUT PAY': 'Leave Without Pay',
                                                            'TAFE': 'Tafe'
                                                          };
                                                          if (!entry.jobAddress && entry.description && descriptionLeaveTypes[entry.description]) {
                                                            return descriptionLeaveTypes[entry.description];
                                                          }
                                                          // Handle leave types stored in jobId field
                                                          const leaveTypes: { [key: string]: string } = {
                                                            'sick-leave': 'Sick Leave',
                                                            'personal-leave': 'Personal Leave', 
                                                            'annual-leave': 'Annual Leave',
                                                            'public-holiday': 'Public Holiday',
                                                            'rdo': 'RDO (Rest Day Off)',
                                                            'leave-without-pay': 'Leave Without Pay',
                                                            'tafe': 'Tafe'
                                                          };
                                                          if (!entry.jobAddress && entry.jobId && leaveTypes[entry.jobId]) {
                                                            return leaveTypes[entry.jobId];
                                                          }
                                                          // Fallback: check materials field for backward compatibility
                                                          if (!entry.jobAddress && entry.materials && leaveTypes[entry.materials]) {
                                                            return leaveTypes[entry.materials];
                                                          }
                                                          return entry.jobAddress || 'Unknown Job';
                                                        })()} • {entry.clientName} • {parseFloat(entry.hours || 0)}h
                                                      </div>
                                                      {entry.updatedAt && entry.updatedAt !== entry.createdAt && (
                                                        <div className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                                          Last updated: {format(parseISO(entry.updatedAt), 'dd/MM/yyyy HH:mm')}
                                                        </div>
                                                      )}
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

          <TabsContent value="organiser" className="space-y-6">
            <WeeklyOrganiser />
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold">Staff Management</h2>
              <Dialog open={isCreateEmployeeOpen} onOpenChange={setIsCreateEmployeeOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full sm:w-auto" data-testid="button-create-employee">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Staff Member
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md mx-4 sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Staff Member</DialogTitle>
                  </DialogHeader>
                  <Form {...employeeForm}>
                    <form onSubmit={employeeForm.handleSubmit(onEmployeeSubmit)} className="space-y-4">
                      <FormField
                        control={employeeForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter staff member name" {...field} data-testid="input-employee-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex gap-2 pt-4">
                        <Button type="submit" disabled={createEmployeeMutation.isPending} data-testid="button-save-employee">
                          {createEmployeeMutation.isPending ? "Adding..." : "Add Staff Member"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => setIsCreateEmployeeOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>

            {employeesLoading ? (
              <div className="grid gap-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="animate-pulse space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : employees && employees.length > 0 ? (
              <div className="grid gap-4">
                {employees.map((employee) => (
                  <Card key={employee.id}>
                    <CardContent className="p-4">
                      {editingEmployee === employee.id ? (
                        <Form {...editEmployeeForm}>
                          <form onSubmit={editEmployeeForm.handleSubmit(onEditEmployeeSubmit)} className="space-y-3">
                            <FormField
                              control={editEmployeeForm.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input {...field} placeholder="Employee name" data-testid={`input-edit-employee-${employee.id}`} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                size="sm"
                                disabled={updateEmployeeMutation.isPending}
                                data-testid={`button-save-employee-${employee.id}`}
                              >
                                {updateEmployeeMutation.isPending ? "Saving..." : "Save"}
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEdit}
                                data-testid={`button-cancel-edit-employee-${employee.id}`}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </Form>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div>
                              <h3 className="font-medium">{employee.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {employee.isActive ? 'Active - appears in job sheets' : 'Inactive - hidden from job sheets'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`employee-toggle-${employee.id}`} className="text-sm font-medium">
                                {employee.isActive ? 'Active' : 'Inactive'}
                              </Label>
                              <Switch
                                id={`employee-toggle-${employee.id}`}
                                checked={employee.isActive}
                                onCheckedChange={(checked) => {
                                  toggleEmployeeStatusMutation.mutate({
                                    id: employee.id,
                                    isActive: checked
                                  });
                                }}
                                disabled={toggleEmployeeStatusMutation.isPending}
                                data-testid={`toggle-employee-${employee.id}`}
                              />
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditEmployee(employee)}
                                data-testid={`button-edit-employee-${employee.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
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
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
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



        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-semibold">Timesheet Search</h2>
              <p className="text-sm text-muted-foreground">Search and analyze timesheet data across all staff and jobs</p>
            </div>
          </div>
          
          <TimesheetSearch />
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
            
            {/* Password Management Section */}
            {/* Data Export Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-muted-foreground" />
                  Data Backup & Restore
                </CardTitle>
                <CardDescription>
                  Export and import your live business data for backup and disaster recovery
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">Export Business Data</h4>
                      <p className="text-sm text-muted-foreground">
                        Download all jobs, timesheets, employees, and business records
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button 
                        variant="outline"
                        onClick={() => {
                          window.open('/api/download/migration-guide', '_blank');
                        }}
                        data-testid="button-download-migration-guide"
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Migration Guide
                      </Button>
                      <Button 
                        onClick={() => {
                          window.open('/api/export-data', '_blank');
                        }}
                        data-testid="button-export-data"
                        className="flex items-center gap-2"
                      >
                        <Download className="h-4 w-4" />
                        Export Data
                      </Button>
                      <Button 
                        variant="default"
                        onClick={async () => {
                          try {
                            const response = await fetch('/api/export-data-to-drive', {
                              method: 'POST',
                              credentials: 'include',
                              headers: {
                                'Content-Type': 'application/json',
                              },
                            });
                            
                            const data = await response.json();
                            
                            if (data.success) {
                              toast({
                                title: "Backup Successful",
                                description: `Data backed up to Google Drive: ${data.fileName}`,
                              });
                            } else {
                              throw new Error(data.message || 'Backup failed');
                            }
                          } catch (error: any) {
                            toast({
                              title: "Backup Failed",
                              description: error.message || "Failed to backup to Google Drive",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-backup-to-drive"
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                      >
                        <Download className="h-4 w-4" />
                        Auto-Backup to Drive
                      </Button>
                    </div>
                  </div>
                  
                  {/* Import Data Section */}
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Import Business Data</h4>
                        <p className="text-sm text-muted-foreground">
                          Restore data from backup file (JSON format) - Safe: Won't overwrite existing data
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="file"
                          accept=".json"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            
                            try {
                              const text = await file.text();
                              const backupData = JSON.parse(text);
                              
                              const response = await fetch('/api/import-data', {
                                method: 'POST',
                                credentials: 'include',
                                headers: {
                                  'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                  data: backupData,
                                  overwriteExisting: false
                                })
                              });
                              
                              const result = await response.json();
                              
                              if (result.success) {
                                toast({
                                  title: "Import Successful",
                                  description: `Imported ${result.totalRecordsImported} new records safely${result.results.errors.length > 0 ? ` with ${result.results.errors.length} conflicts skipped` : ''}`,
                                });
                              } else {
                                throw new Error(result.message || 'Import failed');
                              }
                            } catch (error: any) {
                              toast({
                                title: "Import Failed",
                                description: error.message || "Failed to import backup data",
                                variant: "destructive",
                              });
                            }
                            
                            // Reset file input
                            e.target.value = '';
                          }}
                          className="hidden"
                          id="import-file-input"
                        />
                        <Button
                          variant="outline"
                          onClick={() => document.getElementById('import-file-input')?.click()}
                          data-testid="button-import-data"
                          className="flex items-center gap-2"
                        >
                          <Upload className="h-4 w-4" />
                          Import Data
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        <span className="font-medium">Complete Backup Solution:</span>
                      </div>
                      <div className="ml-6 space-y-1">
                        <div>• Export: Download all business data as JSON</div>
                        <div>• Auto-Backup: Save directly to Google Drive</div>
                        <div>• Import: Restore data from backup files</div>
                        <div>• Migration: Move to other platforms if needed</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  Security Settings
                </CardTitle>
                <CardDescription>
                  Manage deletion password and security preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isEditingPassword ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Deletion Password</h4>
                        <p className="text-sm text-muted-foreground">
                          Required for permanent job sheet deletion
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setIsEditingPassword(true)}
                        data-testid="button-change-password"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Change Password
                      </Button>
                    </div>
                    <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4" />
                        Current password is set and secure
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="current-password">Current Password</Label>
                      <Input
                        id="current-password"
                        type="password"
                        value={currentPasswordForEdit}
                        onChange={(e) => setCurrentPasswordForEdit(e.target.value)}
                        placeholder="Enter current password"
                        data-testid="input-current-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">New Password</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        data-testid="input-new-password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm-password">Confirm New Password</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        data-testid="input-confirm-password"
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handlePasswordUpdate}
                        disabled={!currentPasswordForEdit || !newPassword || !confirmPassword}
                        data-testid="button-update-password"
                      >
                        Update Password
                      </Button>
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleCancelPasswordEdit}
                        data-testid="button-cancel-password"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

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

          {/* Document Processing Tab */}
          <TabsContent value="documents" className="space-y-6">
            <DocumentExpenseProcessor />
            <EmailProcessingReview />
          </TabsContent>
          
          <TabsContent value="notifications" className="space-y-6">
            <h2 className="text-xl font-semibold">Notification Settings</h2>
            <p className="text-muted-foreground">
              Control your email notification preferences and choose alternative notification methods.
            </p>
            <NotificationSettings />
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



        {/* Edit Custom Address Dialog */}
        <Dialog open={showEditAddressDialog} onOpenChange={setShowEditAddressDialog}>
          <DialogContent className="max-w-md mx-4 sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Custom Address</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editAddressData.currentAddress}
                  onChange={(e) => setEditAddressData(prev => ({ ...prev, currentAddress: e.target.value }))}
                  placeholder="Enter address"
                  data-testid="input-edit-address"
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={() => {
                    editCustomAddressMutation.mutate({
                      entryId: editAddressData.entryId,
                      address: editAddressData.currentAddress
                    });
                  }}
                  disabled={editCustomAddressMutation.isPending || !editAddressData.currentAddress.trim()}
                  data-testid="button-save-address"
                >
                  {editCustomAddressMutation.isPending ? "Saving..." : "Save"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowEditAddressDialog(false)}
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Low Hours Warning Dialog */}
        <AlertDialog open={showLowHoursDialog} onOpenChange={setShowLowHoursDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <Clock className="h-5 w-5" />
                Low Hours Warning
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700">
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-1">
                        {lowHoursTotal.toFixed(2)} hours
                      </div>
                      <div className="text-sm text-orange-700">
                        Current total for this fortnight
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-center">
                    This timesheet has hours below the expected 76 hours for a full fortnight. 
                    Are you sure you want to approve this timesheet?
                  </p>
                  
                  <div className="text-xs text-gray-500 text-center">
                    You can always unapprove and ask staff to add more hours if needed.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel 
                onClick={() => {
                  setShowLowHoursDialog(false);
                  setPendingApproval(null);
                }}
                className="flex-1"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowLowHoursDialog(false);
                  if (pendingApproval) {
                    console.log('🚨 EXECUTING PENDING APPROVAL');
                    approveFortnightMutation.mutate(pendingApproval);
                    setPendingApproval(null);
                  }
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Approve Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Password Protected Job Deletion Dialog */}
        <Dialog open={deleteJobDialogOpen} onOpenChange={setDeleteJobDialogOpen}>
          <DialogContent className="max-w-md mx-4 sm:max-w-lg" aria-describedby="delete-job-description">
            <DialogHeader>
              <DialogTitle className="text-red-600 flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                ⚠️ Permanent Job Deletion
              </DialogTitle>
              <p id="delete-job-description" className="text-sm text-muted-foreground">
                This action cannot be undone. Please save the PDF before deletion.
              </p>
            </DialogHeader>
            
            {jobToDelete && (
              <div className="space-y-4">
                {/* Job Details */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-semibold text-red-800 mb-2">Job to be deleted:</h4>
                  <p className="text-sm text-red-700">
                    <strong>Address:</strong> {jobToDelete.jobAddress}
                  </p>
                  <p className="text-sm text-red-700">
                    <strong>Client:</strong> {jobToDelete.clientName}
                  </p>
                  <p className="text-sm text-red-700">
                    <strong>PM:</strong> {jobToDelete.projectManager || 'N/A'}
                  </p>
                </div>

                {/* Warning Message */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <FileText className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-yellow-800 mb-1">
                        📄 Save PDF Before Deletion
                      </h4>
                      <p className="text-sm text-yellow-700 mb-3">
                        We recommend saving the job sheet PDF for your records before permanent deletion.
                      </p>
                      <Button
                        onClick={handleSavePDFBeforeDelete}
                        disabled={isGeneratingPDF}
                        variant="outline"
                        size="sm"
                        className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                        data-testid="button-save-pdf-before-delete"
                      >
                        {isGeneratingPDF ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full mr-2" />
                            Generating PDF...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-2" />
                            Save PDF Now
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Deletion Warning */}
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-semibold text-red-800 mb-1">
                        🗑️ This will permanently delete:
                      </h4>
                      <ul className="text-sm text-red-700 list-disc list-inside space-y-1">
                        <li>Job details and address</li>
                        <li>All labor entries</li>
                        <li>Materials and sub-trades</li>
                        <li>Other costs and expenses</li>
                        <li>Timesheet entries</li>
                        <li>Job files and documents</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Password Entry */}
                <div className="space-y-2">
                  <Label htmlFor="delete-password" className="text-sm font-semibold text-red-700">
                    🔒 Enter deletion password to confirm:
                  </Label>
                  <Input
                    id="delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter password"
                    className="border-red-200 focus:border-red-400"
                    data-testid="input-delete-password"
                  />
                  <p className="text-xs text-gray-500">
                    Contact admin for deletion password if needed
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteJobDialogOpen(false);
                      setJobToDelete(null);
                      setDeletePassword('');
                    }}
                    className="flex-1"
                    data-testid="button-cancel-delete"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    disabled={!deletePassword || permanentDeleteJobMutation.isPending}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                    data-testid="button-confirm-delete"
                  >
                    {permanentDeleteJobMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Confirm Delete
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
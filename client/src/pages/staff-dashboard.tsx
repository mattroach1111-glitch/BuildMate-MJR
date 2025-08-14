import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
// useAuth removed - using direct useQuery
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertTimesheetEntrySchema } from "@shared/schema";
import { z } from "zod";
import type { Job, TimesheetEntry } from "@shared/schema";
import { Calendar, Clock, Plus, Trash2, ChevronLeft, ChevronRight, CheckCircle, AlertCircle, Info, Target } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameWeek, parseISO } from "date-fns";
import PageLayout from "@/components/page-layout";
import { OnboardingTour, WelcomeAnimation } from "@/components/onboarding-tour";
import { useOnboarding } from "@/hooks/useOnboarding";

const timesheetFormSchema = insertTimesheetEntrySchema.extend({
  hours: z.string().min(1, "Hours is required"),
}).omit({ staffId: true });

interface StaffDashboardProps {
  isAdminView?: boolean;
}

export default function StaffDashboard({ isAdminView = false }: StaffDashboardProps) {
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30000,
  });
  const isAuthenticated = !!user;
  const { toast } = useToast();
  const { 
    showWelcome, 
    showTour, 
    isOnboardingComplete,
    startTour, 
    completeTour, 
    skipTour 
  } = useOnboarding();
  
  // Current fortnight state
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Get fortnight boundaries (2-week periods starting from Monday)
  const getFortnightBoundaries = (date: Date) => {
    const startOfCurrentWeek = startOfWeek(date, { weekStartsOn: 1 }); // Monday
    // Find which fortnight we're in (even or odd week number)
    const weeksSinceEpoch = Math.floor((startOfCurrentWeek.getTime() - new Date(2024, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const fortnightStart = weeksSinceEpoch % 2 === 0 ? startOfCurrentWeek : addDays(startOfCurrentWeek, -7);
    const fortnightEnd = addDays(fortnightStart, 13);
    
    return { start: fortnightStart, end: fortnightEnd };
  };
  
  const currentFortnight = getFortnightBoundaries(currentDate);

  const handleViewFortnightTimesheet = () => {
    window.location.href = '/timesheet';
  };

  // Clear all timesheet entries for current fortnight
  const clearCurrentFortnightEntries = useMutation({
    mutationFn: async () => {
      // Get current fortnight entries to delete
      if (Array.isArray(currentFortnightEntries) && currentFortnightEntries.length > 0) {
        for (const entry of currentFortnightEntries) {
          await apiRequest("DELETE", `/api/timesheet/${entry.id}`);
        }
      }
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      toast({
        title: "Timesheet Cleared",
        description: "All timesheet entries for the current fortnight have been deleted.",
        variant: "default",
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
        description: "Failed to clear timesheet entries. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleClearTimesheet = () => {
    if (Array.isArray(currentFortnightEntries) && currentFortnightEntries.length > 0) {
      if (window.confirm(`Are you sure you want to delete all ${currentFortnightEntries.length} timesheet entries for this fortnight? This action cannot be undone.`)) {
        clearCurrentFortnightEntries.mutate();
      }
    } else {
      toast({
        title: "No Entries",
        description: "There are no timesheet entries to clear for this fortnight.",
        variant: "default",
      });
    }
  };

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
    queryKey: ["/api/jobs-for-staff"],
    retry: false,
  });

  const { data: timesheetEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/timesheet"],
    retry: false,
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof timesheetFormSchema>) => {
      const endpoint = isAdminView ? "/api/admin/timesheet" : "/api/timesheet";
      const response = await apiRequest("POST", endpoint, {
        ...data,
        hours: parseFloat(data.hours),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      form.reset();
      
      // Use enhanced success message after cache is invalidated
      setTimeout(() => {
        toast({
          title: "Success",
          description: handleSuccessfulSave(),
        });
      }, 100);
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
        description: error.message || "Failed to add time entry",
        variant: "destructive",
      });
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("DELETE", `/api/timesheet/${entryId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      toast({
        title: "Success",
        description: "Time entry deleted successfully",
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
        description: error.message || "Failed to delete time entry",
        variant: "destructive",
      });
    },
  });

  const form = useForm<z.infer<typeof timesheetFormSchema>>({
    resolver: zodResolver(timesheetFormSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      jobId: "",
      hours: "",
    },
  });

  const onSubmit = (data: z.infer<typeof timesheetFormSchema>) => {
    createEntryMutation.mutate(data);
  };

  // Enhanced auto-save success message with smart prompts
  const handleSuccessfulSave = () => {
    const status = getCompletionStatus();
    let message = "Entry saved successfully";
    
    if (status.completedDays === 1) {
      message += ". Great start! Remember to log hours daily.";
    } else if (status.completedDays === 5) {
      message += ". Halfway through your fortnight!";
    } else if (status.completedDays === 9) {
      message += ". Almost ready for submission - just 1 more day!";
    } else if (status.completedDays >= 10) {
      message += ". Your fortnight is complete and ready for submission!";
    }
    
    return message;
  };

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteEntryMutation.mutate(entryId);
  };

  const getJobTitle = (jobId: string) => {
    const job = (jobs as Job[])?.find((j: Job) => j.id === jobId);
    return job ? job.jobAddress : "Unknown Job";
  };

  // Filter entries for current fortnight
  const currentFortnightEntries = (timesheetEntries as TimesheetEntry[] || []).filter((entry: TimesheetEntry) => {
    const entryDate = parseISO(entry.date);
    return entryDate >= currentFortnight.start && entryDate <= currentFortnight.end;
  });

  const calculateTotalHours = () => {
    return currentFortnightEntries.reduce((total: number, entry: TimesheetEntry) => {
      return total + parseFloat(entry.hours);
    }, 0);
  };

  const getJobSummary = () => {
    if (!jobs) return [];
    
    const summary: Record<string, { jobTitle: string; totalHours: number }> = {};
    
    currentFortnightEntries.forEach((entry: TimesheetEntry) => {
      const jobId = entry.jobId || '';
      if (!summary[jobId]) {
        summary[jobId] = {
          jobTitle: getJobTitle(jobId),
          totalHours: 0,
        };
      }
      summary[jobId].totalHours += parseFloat(entry.hours);
    });
    
    return Object.values(summary);
  };

  const navigateFortnight = (direction: 'prev' | 'next') => {
    const newDate = addDays(currentDate, direction === 'next' ? 14 : -14);
    setCurrentDate(newDate);
  };

  // Generate array of all days in the current fortnight
  const getFortnightDays = () => {
    const days = [];
    let currentDay = new Date(currentFortnight.start);
    
    while (currentDay <= currentFortnight.end) {
      days.push(new Date(currentDay));
      currentDay = addDays(currentDay, 1);
    }
    
    return days;
  };

  // Get entries for a specific date
  const getEntriesForDate = (date: Date) => {
    return currentFortnightEntries.filter((entry: TimesheetEntry) => {
      const entryDate = parseISO(entry.date);
      return entryDate.toDateString() === date.toDateString();
    });
  };

  // Check if a date has any entries
  const hasEntriesForDate = (date: Date) => {
    return getEntriesForDate(date).length > 0;
  };

  // Get total hours for a specific date
  const getHoursForDate = (date: Date) => {
    return getEntriesForDate(date).reduce((total, entry) => total + parseFloat(entry.hours), 0);
  };

  // Calculate completion status for the fortnight
  const getCompletionStatus = () => {
    const fortnightDays = getFortnightDays();
    const workdays = fortnightDays.filter(day => day.getDay() !== 0 && day.getDay() !== 6); // Exclude weekends
    const completedDays = workdays.filter(day => hasEntriesForDate(day));
    
    return {
      totalWorkdays: workdays.length,
      completedDays: completedDays.length,
      remainingDays: workdays.length - completedDays.length,
      isReadyForSubmission: completedDays.length >= 10, // 10 working days in a fortnight
      completionPercentage: Math.round((completedDays.length / workdays.length) * 100)
    };
  };

  // Get smart prompt messages based on completion status
  const getSmartPrompts = () => {
    const status = getCompletionStatus();
    const totalHours = calculateTotalHours();
    const hasUnsavedChanges = false; // We auto-save, but could track manual edits
    
    if (status.completedDays === 0) {
      return {
        type: 'info',
        title: 'Start Your Timesheet',
        message: 'Begin logging your hours for this fortnight. Add entries as you complete work each day.',
        action: null
      };
    }
    
    if (status.completedDays >= 1 && status.completedDays < 5) {
      return {
        type: 'reminder',
        title: 'Keep Logging Hours',
        message: `You've completed ${status.completedDays} of ${status.totalWorkdays} workdays (${status.completionPercentage}%). Remember to log hours daily to stay on track.`,
        action: null
      };
    }
    
    if (status.completedDays >= 5 && status.completedDays < 8) {
      return {
        type: 'progress',
        title: 'Great Progress!',
        message: `Halfway there! ${status.completedDays} of ${status.totalWorkdays} days completed (${status.completionPercentage}%). Keep up the good work.`,
        action: null
      };
    }
    
    if (status.completedDays >= 8 && status.completedDays < 10) {
      return {
        type: 'almost',
        title: 'Almost Ready for Submission',
        message: `${status.completedDays} of ${status.totalWorkdays} days completed (${status.completionPercentage}%). Just ${status.remainingDays} more days to complete your fortnight.`,
        action: null
      };
    }
    
    if (status.isReadyForSubmission) {
      return {
        type: 'ready',
        title: 'Ready for Submission!',
        message: `Excellent! All ${status.completedDays} workdays completed (${totalHours} total hours). Your timesheet is ready for review and submission.`,
        action: 'submit'
      };
    }
    
    return null;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <PageLayout 
      title="My Timesheet" 
      subtitle={`Welcome back, ${(user as any)?.firstName || 'Staff'}`}
    >
      <div className="max-w-4xl mx-auto space-y-6" data-testid="container-timesheet">
        {/* Quick Actions */}
        <div className="flex flex-col sm:flex-row justify-center gap-2">
          <Button 
            onClick={handleViewFortnightTimesheet}
            data-testid="button-add-hours"
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Open Full Timesheet
          </Button>
          <Button 
            onClick={handleClearTimesheet}
            variant="outline"
            disabled={clearCurrentFortnightEntries.isPending}
            data-testid="button-clear-timesheet"
            className="flex items-center gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            {clearCurrentFortnightEntries.isPending ? "Clearing..." : "Clear Timesheet"}
          </Button>
        </div>
        {/* Period Navigation */}
        <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateFortnight('prev')}
                data-testid="button-prev-fortnight"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <div className="text-center">
                <p className="font-semibold text-gray-800" data-testid="text-timesheet-period">
                  {format(currentFortnight.start, 'MMM d')} - {format(currentFortnight.end, 'MMM d, yyyy')}
                </p>
                <p className="text-xs text-gray-500">Fortnight Period</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateFortnight('next')}
                data-testid="button-next-fortnight"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Quick Hours Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary" data-testid="text-total-hours">
                  {calculateTotalHours()}h
                </p>
                <p className="text-xs text-gray-600">Total Hours</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {currentFortnightEntries.length}
                </p>
                <p className="text-xs text-gray-600">Entries</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">
                  {getJobSummary().length}
                </p>
                <p className="text-xs text-gray-600">Jobs</p>
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-center">
                <p className="text-lg font-bold text-gray-800">
                  {getCompletionStatus().completedDays}/10
                </p>
                <p className="text-xs text-gray-600">Days Complete</p>
                <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-primary h-1.5 rounded-full transition-all duration-300"
                    style={{
                      width: `${(getCompletionStatus().completedDays / 10) * 100}%`
                    }}
                  ></div>
                </div>
              </div>
            </Card>
          </div>

          {/* Smart Progress Prompts */}
          {(() => {
            const prompt = getSmartPrompts();
            if (!prompt) return null;
            
            const getPromptStyles = (type: string) => {
              switch (type) {
                case 'info':
                  return {
                    cardClass: 'bg-blue-50 border-blue-200',
                    iconColor: 'text-blue-600',
                    titleColor: 'text-blue-800',
                    messageColor: 'text-blue-700',
                    icon: Info
                  };
                case 'reminder':
                  return {
                    cardClass: 'bg-amber-50 border-amber-200',
                    iconColor: 'text-amber-600',
                    titleColor: 'text-amber-800',
                    messageColor: 'text-amber-700',
                    icon: AlertCircle
                  };
                case 'progress':
                  return {
                    cardClass: 'bg-purple-50 border-purple-200',
                    iconColor: 'text-purple-600',
                    titleColor: 'text-purple-800',
                    messageColor: 'text-purple-700',
                    icon: Target
                  };
                case 'almost':
                  return {
                    cardClass: 'bg-orange-50 border-orange-200',
                    iconColor: 'text-orange-600',
                    titleColor: 'text-orange-800',
                    messageColor: 'text-orange-700',
                    icon: Target
                  };
                case 'ready':
                  return {
                    cardClass: 'bg-green-50 border-green-200',
                    iconColor: 'text-green-600',
                    titleColor: 'text-green-800',
                    messageColor: 'text-green-700',
                    icon: CheckCircle
                  };
                default:
                  return {
                    cardClass: 'bg-gray-50 border-gray-200',
                    iconColor: 'text-gray-600',
                    titleColor: 'text-gray-800',
                    messageColor: 'text-gray-700',
                    icon: Info
                  };
              }
            };
            
            const styles = getPromptStyles(prompt.type);
            const IconComponent = styles.icon;
            
            return (
              <Card className={`${styles.cardClass} p-4`} data-testid="card-smart-prompt">
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${styles.iconColor}`}>
                    <IconComponent className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <h4 className={`font-semibold ${styles.titleColor} mb-1`}>
                      {prompt.title}
                    </h4>
                    <p className={`text-sm ${styles.messageColor} mb-3`}>
                      {prompt.message}
                    </p>
                    {prompt.action === 'submit' && (
                      <Button 
                        onClick={handleViewFortnightTimesheet}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        size="sm"
                        data-testid="button-view-timesheet"
                      >
                        View Complete Timesheet
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* Fortnight Calendar */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2" data-testid="text-calendar-title">
                <Calendar className="h-5 w-5" />
                Daily Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2 mb-4">
                {/* Day headers */}
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 py-2">
                    {day}
                  </div>
                ))}
                
                {/* Calendar days */}
                {getFortnightDays().map((day, index) => {
                  const hasEntries = hasEntriesForDate(day);
                  const totalHours = getHoursForDate(day);
                  const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                  const isToday = day.toDateString() === new Date().toDateString();
                  
                  return (
                    <div
                      key={`day-${format(day, 'yyyy-MM-dd')}`}
                      className={`
                        relative p-3 rounded-lg border text-center transition-colors
                        ${hasEntries 
                          ? 'bg-green-50 border-green-200 hover:bg-green-100' 
                          : isWeekend 
                            ? 'bg-gray-50 border-gray-200' 
                            : 'bg-red-50 border-red-200 hover:bg-red-100'
                        }
                        ${isToday ? 'ring-2 ring-blue-400' : ''}
                      `}
                      data-testid={`calendar-day-${format(day, 'yyyy-MM-dd')}`}
                    >
                      <div className={`
                        text-sm font-medium
                        ${hasEntries ? 'text-green-800' : isWeekend ? 'text-gray-600' : 'text-red-600'}
                        ${isToday ? 'text-blue-600' : ''}
                      `}>
                        {format(day, 'd')}
                      </div>
                      {hasEntries && (
                        <div className="text-xs text-green-600 font-medium mt-1">
                          {totalHours}h
                        </div>
                      )}
                      {!hasEntries && !isWeekend && (
                        <div className="text-xs text-red-500 mt-1">
                          -
                        </div>
                      )}
                      {isToday && (
                        <div className="absolute -top-1 -right-1 w-2 h-2 bg-blue-400 rounded-full"></div>
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Legend */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 border-t pt-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-50 border border-green-200 rounded"></div>
                  <span>Hours logged</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-50 border border-red-200 rounded"></div>
                  <span>Missing entry</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-gray-50 border border-gray-200 rounded"></div>
                  <span>Weekend</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span>Today</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timesheet Entry Form */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2" data-testid="text-add-entry-title">
                <Plus className="h-5 w-5" />
                Add Time Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <FormField
                      control={form.control}
                      name="date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              data-testid="input-date"
                              className="text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="jobId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Job</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl>
                              <SelectTrigger data-testid="select-job" className="text-base">
                                <SelectValue placeholder="Select Job" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {jobsLoading ? (
                                <SelectItem value="loading" disabled>Loading jobs...</SelectItem>
                              ) : !jobs || (jobs as Job[]).length === 0 ? (
                                <SelectItem value="no-jobs" disabled>No jobs available</SelectItem>
                              ) : (
                                (jobs as Job[]).map((job: Job) => (
                                  <SelectItem key={job.id} value={job.id}>
                                    {job.jobAddress}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="hours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Hours</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              step="0.5" 
                              min="0" 
                              max="12" 
                              placeholder="8.0" 
                              {...field} 
                              data-testid="input-hours"
                              className="text-base"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button 
                        type="submit" 
                        className="w-full bg-primary hover:bg-blue-700 h-10"
                        disabled={createEntryMutation.isPending}
                        data-testid="button-submit-timesheet"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {createEntryMutation.isPending ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2" data-testid="text-entries-title">
                <Calendar className="h-5 w-5" />
                Time Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : currentFortnightEntries.length === 0 ? (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-entries">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No time entries for this fortnight.</p>
                  <p className="text-sm">Add your first entry above to get started.</p>
                </div>
              ) : (
                <>
                  {/* Mobile-friendly entry cards */}
                  <div className="space-y-3 sm:hidden">
                    {currentFortnightEntries.map((entry: TimesheetEntry) => (
                      <div key={entry.id} className="bg-white border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="font-medium text-gray-800" data-testid={`text-entry-date-${entry.id}`}>
                              {format(parseISO(entry.date), 'EEE, MMM d')}
                            </p>
                            <p className="text-sm text-gray-600" data-testid={`text-entry-job-${entry.id}`}>
                              {getJobTitle(entry.jobId || '')}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="mb-2">
                              {entry.hours}h
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={deleteEntryMutation.isPending}
                              data-testid={`button-delete-entry-${entry.id}`}
                              className="p-1 h-8 w-8 text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Desktop table */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Job
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Hours
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {currentFortnightEntries.map((entry: TimesheetEntry) => (
                          <tr key={entry.id}>
                            <td className="px-4 py-3 text-sm text-gray-800" data-testid={`text-entry-date-${entry.id}`}>
                              {format(parseISO(entry.date), 'EEE, MMM d')}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600" data-testid={`text-entry-job-${entry.id}`}>
                              {getJobTitle(entry.jobId || '')}
                            </td>
                            <td className="px-4 py-3" data-testid={`text-entry-hours-${entry.id}`}>
                              <Badge variant="secondary">{entry.hours}h</Badge>
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteEntry(entry.id)}
                                disabled={deleteEntryMutation.isPending}
                                data-testid={`button-delete-entry-${entry.id}`}
                                className="p-1 h-8 w-8 text-red-500"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Job Summary */}
                  {getJobSummary().length > 0 && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-semibold text-gray-800 mb-3" data-testid="text-job-summary-title">
                        Hours by Job
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {getJobSummary().map((summary, index) => (
                          <div key={index} className="bg-white rounded-lg p-3" data-testid={`card-job-summary-${index}`}>
                            <p className="text-sm text-gray-600 truncate" data-testid={`text-job-title-${index}`}>
                              {summary.jobTitle}
                            </p>
                            <p className="text-lg font-bold text-primary" data-testid={`text-job-hours-${index}`}>
                              {summary.totalHours}h
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
      </div>

      {/* Onboarding Components - Only show for staff (not in admin view) */}
      {!isAdminView && showWelcome && (
        <WelcomeAnimation onComplete={startTour} />
      )}
      
      {!isAdminView && showTour && (
        <OnboardingTour 
          isOpen={showTour}
          onClose={skipTour}
          onComplete={completeTour}
        />
      )}
    </PageLayout>
  );
}

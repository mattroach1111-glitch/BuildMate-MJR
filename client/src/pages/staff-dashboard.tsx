import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertTimesheetEntrySchema } from "@shared/schema";
import { z } from "zod";
import type { Job, TimesheetEntry } from "@shared/schema";

const timesheetFormSchema = insertTimesheetEntrySchema.extend({
  hours: z.string().min(1, "Hours is required"),
}).omit({ staffId: true });

export default function StaffDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

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
      const response = await apiRequest("POST", "/api/timesheet", {
        ...data,
        hours: parseFloat(data.hours),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      form.reset();
      toast({
        title: "Success",
        description: "Time entry added successfully",
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

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  const handleDeleteEntry = (entryId: string) => {
    deleteEntryMutation.mutate(entryId);
  };

  const getJobTitle = (jobId: string) => {
    const job = (jobs as Job[])?.find((j: Job) => j.id === jobId);
    return job ? `${job.projectName} - ${job.clientName}` : "Unknown Job";
  };

  const calculateTotalHours = () => {
    if (!timesheetEntries) return 0;
    return (timesheetEntries as TimesheetEntry[]).reduce((total: number, entry: TimesheetEntry) => {
      return total + parseFloat(entry.hours);
    }, 0);
  };

  const getJobSummary = () => {
    if (!timesheetEntries || !jobs) return [];
    
    const summary: Record<string, { jobTitle: string; totalHours: number }> = {};
    
    (timesheetEntries as TimesheetEntry[]).forEach((entry: TimesheetEntry) => {
      if (!summary[entry.jobId]) {
        summary[entry.jobId] = {
          jobTitle: getJobTitle(entry.jobId),
          totalHours: 0,
        };
      }
      summary[entry.jobId].totalHours += parseFloat(entry.hours);
    });
    
    return Object.values(summary);
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
                Staff Portal
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600" data-testid="text-user-info">
              {(user as any)?.firstName || (user as any)?.email} (Staff)
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

      <main className="max-w-4xl mx-auto p-6">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800" data-testid="text-page-title">
              My Timesheet
            </h2>
            <p className="text-gray-600" data-testid="text-timesheet-period">
              Current Period: {new Date().toLocaleDateString()} - Ongoing
            </p>
          </div>

          {/* Timesheet Entry Form */}
          <Card>
            <CardHeader>
              <CardTitle data-testid="text-add-entry-title">Add Time Entry</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-job">
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
                                  {job.projectName} - {job.clientName}
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex items-end">
                    <Button 
                      type="submit" 
                      className="w-full bg-primary hover:bg-blue-700"
                      disabled={createEntryMutation.isPending}
                      data-testid="button-add-entry"
                    >
                      <i className="fas fa-plus mr-2"></i>
                      {createEntryMutation.isPending ? "Adding..." : "Add Entry"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Current Period Summary */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle data-testid="text-entries-title">Current Period Entries</CardTitle>
                <div className="text-right">
                  <p className="text-sm text-gray-600">Total Hours</p>
                  <p className="text-2xl font-bold text-primary" data-testid="text-total-hours">
                    {calculateTotalHours()}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {entriesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : !timesheetEntries || (timesheetEntries as TimesheetEntry[]).length === 0 ? (
                <div className="text-center py-8 text-gray-500" data-testid="text-no-entries">
                  No time entries found. Add your first entry to get started.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                          Date
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                          Job
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                          Hours
                        </th>
                        <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {(timesheetEntries as TimesheetEntry[]).map((entry: TimesheetEntry) => (
                        <tr key={entry.id}>
                          <td className="px-6 py-4 text-sm text-gray-800" data-testid={`text-entry-date-${entry.id}`}>
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600" data-testid={`text-entry-job-${entry.id}`}>
                            {getJobTitle(entry.jobId)}
                          </td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800" data-testid={`text-entry-hours-${entry.id}`}>
                            {entry.hours}
                          </td>
                          <td className="px-6 py-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEntry(entry.id)}
                              disabled={deleteEntryMutation.isPending}
                              data-testid={`button-delete-entry-${entry.id}`}
                            >
                              <i className="fas fa-trash text-error"></i>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Summary by Job */}
              {timesheetEntries && (timesheetEntries as TimesheetEntry[]).length > 0 ? (
                <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-3" data-testid="text-job-summary-title">
                    Hours by Job
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {getJobSummary().map((summary, index) => (
                      <div key={index} className="bg-white rounded-lg p-4" data-testid={`card-job-summary-${index}`}>
                        <p className="text-sm text-gray-600" data-testid={`text-job-title-${index}`}>
                          {summary.jobTitle}
                        </p>
                        <p className="text-xl font-bold text-primary" data-testid={`text-job-hours-${index}`}>
                          {summary.totalHours} hrs
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

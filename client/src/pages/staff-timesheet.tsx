import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parseISO, startOfDay, endOfDay, addDays } from "date-fns";
import { Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import PageLayout from "@/components/page-layout";
import type { TimesheetEntry, Job } from "@/../../shared/schema";

const timesheetFormSchema = z.object({
  date: z.string().min(1, "Date is required"),
  jobId: z.string().min(1, "Job is required"),
  hours: z.string().min(1, "Hours is required"),
  materials: z.string().optional(),
});

// Simple fortnight calculation
const getCurrentFortnight = (date: Date = new Date()) => {
  const startDate = new Date(2025, 7, 11); // Aug 11, 2025 (Month is 0-indexed)
  const daysSinceStart = Math.floor((date.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const fortnightNumber = Math.floor(daysSinceStart / 14);
  const fortnightStart = addDays(startDate, fortnightNumber * 14);
  const fortnightEnd = addDays(fortnightStart, 13);
  
  return {
    start: fortnightStart,
    end: fortnightEnd,
    number: fortnightNumber + 1,
  };
};

export default function StaffTimesheet() {
  const { toast } = useToast();
  const [currentDate, setCurrentDate] = useState(new Date());
  const currentFortnight = getCurrentFortnight(currentDate);

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ["/api/jobs-for-staff"],
  });

  const { data: timesheetEntries, isLoading: entriesLoading } = useQuery({
    queryKey: ["/api/timesheet"],
  });

  const createEntryMutation = useMutation({
    mutationFn: async (data: z.infer<typeof timesheetFormSchema>) => {
      await apiRequest("POST", "/api/timesheet", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      form.reset({
        date: new Date().toISOString().split('T')[0],
        jobId: "",
        hours: "",
        materials: "",
      });
      toast({
        title: "Success",
        description: "Time entry added successfully",
      });
    },
    onError: (error) => {
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
      materials: "",
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
    return job ? job.jobAddress : "Unknown Job";
  };

  const navigateFortnight = (direction: 'prev' | 'next') => {
    const newDate = addDays(currentDate, direction === 'next' ? 14 : -14);
    setCurrentDate(newDate);
  };

  // Filter entries for current fortnight
  const currentFortnightEntries = (timesheetEntries as TimesheetEntry[] || []).filter((entry: TimesheetEntry) => {
    const entryDate = parseISO(entry.date);
    return entryDate >= currentFortnight.start && entryDate <= currentFortnight.end;
  });

  // Sort entries by date (most recent first)
  const sortedEntries = [...currentFortnightEntries].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  if (entriesLoading || jobsLoading) {
    return (
      <PageLayout title="Daily Timesheet">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title="Daily Timesheet">
      <div className="max-w-4xl mx-auto space-y-6" data-testid="staff-timesheet">
        
        {/* Period Navigation */}
        <div className="text-center">
          <div className="flex items-center justify-center space-x-4 mb-4">
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

        {/* Add Time Entry Form */}
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
                            step="0.25"
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
                  <FormField
                    control={form.control}
                    name="materials"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Materials/Notes</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Optional"
                            {...field} 
                            data-testid="input-materials"
                            className="text-base"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={createEntryMutation.isPending}
                  data-testid="button-submit-entry"
                  className="w-full sm:w-auto"
                >
                  {createEntryMutation.isPending ? "Adding..." : "Add Entry"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Daily Timesheet Entries */}
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-entries-title">Daily Timesheet Entries</CardTitle>
          </CardHeader>
          <CardContent>
            {sortedEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No entries for this fortnight period</p>
                <p className="text-sm">Add your first entry above to get started</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-sm font-medium text-gray-600">
                  <div className="col-span-2">Date</div>
                  <div className="col-span-1">Hours</div>
                  <div className="col-span-3">Job</div>
                  <div className="col-span-4">Materials/Notes</div>
                  <div className="col-span-2">Actions</div>
                </div>
                
                {sortedEntries.map((entry: TimesheetEntry) => (
                  <div 
                    key={entry.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    data-testid={`entry-${entry.id}`}
                  >
                    <div className="md:col-span-2">
                      <span className="md:hidden font-medium text-gray-600">Date: </span>
                      <span className="font-medium">
                        {format(parseISO(entry.date), 'EEE, MMM d')}
                      </span>
                    </div>
                    <div className="md:col-span-1">
                      <span className="md:hidden font-medium text-gray-600">Hours: </span>
                      <span className="text-lg font-semibold text-blue-600">
                        {parseFloat(entry.hours)}h
                      </span>
                    </div>
                    <div className="md:col-span-3">
                      <span className="md:hidden font-medium text-gray-600">Job: </span>
                      <span className="text-sm text-gray-800">
                        {getJobTitle(entry.jobId || '')}
                      </span>
                    </div>
                    <div className="md:col-span-4">
                      <span className="md:hidden font-medium text-gray-600">Notes: </span>
                      <span className="text-sm text-gray-600">
                        {entry.materials || '-'}
                      </span>
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteEntry(entry.id)}
                        disabled={deleteEntryMutation.isPending}
                        data-testid={`button-delete-${entry.id}`}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {entry.approved && (
                        <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
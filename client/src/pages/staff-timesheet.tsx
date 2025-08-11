import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Trash2 } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageLayout from "@/components/page-layout";

const FORTNIGHT_START_DATE = new Date(2025, 7, 11); // August 11, 2025 (month is 0-indexed)

export default function StaffTimesheet() {
  const { toast } = useToast();
  const [selectedEmployee] = useState<string>("");
  
  // Calculate which fortnight we should start with based on current date
  const getCurrentFortnightIndex = () => {
    const today = new Date();
    const startDate = FORTNIGHT_START_DATE;
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.floor(daysDiff / 14));
  };

  const [currentFortnightIndex, setCurrentFortnightIndex] = useState(getCurrentFortnightIndex());
  const [timesheetData, setTimesheetData] = useState<any>({});
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Calculate fortnight boundaries based on August 11, 2025 start date
  const getFortnightDates = (fortnightIndex: number) => {
    const start = addDays(FORTNIGHT_START_DATE, fortnightIndex * 14);
    const end = addDays(start, 13);
    return { start, end };
  };

  const currentFortnight = getFortnightDates(currentFortnightIndex);

  // Generate 14 days for the fortnight
  const fortnightDays = Array.from({ length: 14 }, (_, i) => 
    addDays(currentFortnight.start, i)
  );

  const { data: jobs, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ["/api/jobs-for-staff"],
    retry: false,
  });

  const { data: timesheetEntries, refetch: refetchTimesheetEntries } = useQuery({
    queryKey: ["/api/timesheet"],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Filter entries for current fortnight and selected employee
  const currentFortnightEntries = Array.isArray(timesheetEntries) ? timesheetEntries.filter((entry: any) => {
    const entryDate = parseISO(entry.date);
    const isInFortnight = entryDate >= currentFortnight.start && entryDate <= currentFortnight.end;
    return isInFortnight;
  }) : [];

  // Update timesheet data mutation
  const updateTimesheetMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("PUT", "/api/timesheet/update-multiple", data);
      return response;
    },
    onSuccess: () => {
      refetchTimesheetEntries();
      toast({
        title: "Success",
        description: "Timesheet entries saved successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to save timesheet entries",
        variant: "destructive",
      });
    },
  });

  // Delete timesheet entry mutation
  const deleteTimesheetMutation = useMutation({
    mutationFn: async (entryId: string) => {
      await apiRequest("DELETE", `/api/timesheet/${entryId}`);
    },
    onSuccess: () => {
      refetchTimesheetEntries();
      toast({
        title: "Success",
        description: "Entry deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: error.message || "Failed to delete entry",
        variant: "destructive",
      });
    },
  });

  const handleCellChange = (day: Date, entryIndex: number, field: string, value: string) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    setTimesheetData((prev: any) => {
      const dayEntries = prev[dateKey] || [{}];
      const updatedEntries = [...dayEntries];
      
      if (!updatedEntries[entryIndex]) {
        updatedEntries[entryIndex] = {};
      }
      
      updatedEntries[entryIndex] = {
        ...updatedEntries[entryIndex],
        [field]: value,
        date: dateKey,
      };
      
      return {
        ...prev,
        [dateKey]: updatedEntries,
      };
    });

    // Auto-save with debounce
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    
    autoSaveTimeout.current = setTimeout(() => {
      saveAllEntries();
    }, 1000);
  };

  const editSavedEntry = (entryId: string, field: string, value: string) => {
    const entry = currentFortnightEntries.find((e: any) => e.id === entryId);
    if (!entry) return;

    const updateData = {
      entries: [{
        id: entryId,
        [field]: value,
        date: entry.date,
        staffId: entry.staffId,
        jobId: field === 'jobId' ? value : entry.jobId,
        hours: field === 'hours' ? value : entry.hours,
        materials: field === 'materials' ? value : entry.materials,
      }]
    };

    updateTimesheetMutation.mutate(updateData);
  };

  const saveAllEntries = () => {
    const entriesToSave: any[] = [];
    
    Object.keys(timesheetData).forEach(dateKey => {
      const dayEntries = timesheetData[dateKey];
      if (Array.isArray(dayEntries)) {
        dayEntries.forEach((entry: any) => {
          if (entry.hours && parseFloat(entry.hours) > 0 && entry.jobId) {
            entriesToSave.push({
              date: entry.date,
              hours: entry.hours,
              jobId: entry.jobId,
              materials: entry.materials || '',
            });
          }
        });
      }
    });

    if (entriesToSave.length > 0) {
      updateTimesheetMutation.mutate({ entries: entriesToSave });
      setTimesheetData({});
    }
  };

  return (
    <PageLayout title="Daily Timesheet Entries">
      <div className="max-w-6xl mx-auto p-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Daily Timesheet Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Date</th>
                    <th className="text-left p-3 font-medium">Hours</th>
                    <th className="text-left p-3 font-medium">Job</th>
                    <th className="text-left p-3 font-medium">Materials/Notes</th>
                    <th className="text-left p-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {fortnightDays.map((day, dayIndex) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    const dayEntries = Array.isArray(timesheetData[dateKey]) ? timesheetData[dateKey] : [];
                    const existingEntries = Array.isArray(currentFortnightEntries) ? currentFortnightEntries.filter((entry: any) => 
                      format(parseISO(entry.date), 'yyyy-MM-dd') === dateKey
                    ) : [];
                    
                    let entriesToShow;
                    const approvedEntries = existingEntries.filter((entry: any) => entry.approved);
                    const unapprovedEntries = existingEntries.filter((entry: any) => !entry.approved);
                    
                    if (approvedEntries.length > 0) {
                      entriesToShow = approvedEntries;
                    } else if (unapprovedEntries.length > 0) {
                      entriesToShow = unapprovedEntries;
                    } else if (dayEntries.length > 0) {
                      entriesToShow = dayEntries;
                    } else {
                      entriesToShow = [{}];
                    }
                    
                    return entriesToShow.map((entry: any, entryIndex: number) => (
                      <tr key={`${dayIndex}-${entryIndex}`} className={`border-b ${isWeekend ? 'bg-blue-200 border-blue-300' : ''}`}>
                        <td className="p-3">
                          {entryIndex === 0 && (
                            <div className={`font-medium ${isWeekend ? 'text-blue-900' : ''}`}>
                              {format(day, 'EEE, MMM dd')}
                              {isWeekend && <span className="text-xs text-blue-800 ml-2 font-semibold">(Weekend)</span>}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.5"
                            placeholder="0"
                            value={entry?.hours || ''}
                            onChange={(e) => {
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'hours', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'hours', e.target.value);
                              }
                            }}
                            className="w-20"
                            disabled={entry?.approved}
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={entry?.jobId || 'no-job'}
                            onValueChange={(value) => {
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'jobId', value);
                              } else {
                                handleCellChange(day, entryIndex, 'jobId', value);
                              }
                            }}
                            disabled={entry?.approved}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select job" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-job">Select a job</SelectItem>
                              {Array.isArray(jobs) && jobs.map((job: any) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobAddress}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder="Materials or notes"
                            value={entry?.materials || ''}
                            onChange={(e) => {
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'materials', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'materials', e.target.value);
                              }
                            }}
                            className="min-w-40"
                            disabled={entry?.approved}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {entry?.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteTimesheetMutation.mutate(entry.id)}
                                disabled={deleteTimesheetMutation.isPending || entry?.approved}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {entry?.approved && (
                              <span className="text-xs text-green-600 font-medium">✓ Saved</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}
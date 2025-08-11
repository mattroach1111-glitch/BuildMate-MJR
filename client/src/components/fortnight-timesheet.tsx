import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download, FileText, ArrowLeft, Users, Plus, Trash2, Save } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const FORTNIGHT_START_DATE = new Date(2025, 7, 11); // August 11, 2025 (month is 0-indexed)

interface FortnightTimesheetProps {
  selectedEmployeeId?: string;
  isAdminView?: boolean;
}

export function FortnightTimesheet({ selectedEmployeeId, isAdminView = false }: FortnightTimesheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<string>(selectedEmployeeId || "");
  // Calculate which fortnight we should start with based on current date
  const getCurrentFortnightIndex = () => {
    const today = new Date();
    const startDate = FORTNIGHT_START_DATE;
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.floor(daysDiff / 14));
  };

  const [currentFortnightIndex, setCurrentFortnightIndex] = useState(getCurrentFortnightIndex());
  const [timesheetData, setTimesheetData] = useState<any>({});
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null); // Single timeout for all auto-saves

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

  // Get staff members for admin view
  const { data: staffMembers } = useQuery({
    queryKey: ["/api/staff-users"],
    retry: false,
    enabled: isAdminView,
  });

  const { data: jobs, isLoading: jobsLoading, error: jobsError } = useQuery({
    queryKey: ["/api/jobs-for-staff"],
    retry: false,
  });

  const { data: timesheetEntries, refetch: refetchTimesheetEntries } = useQuery({
    queryKey: isAdminView ? ["/api/admin/timesheets"] : ["/api/timesheet"],
    retry: false,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });

  // Update selected employee when prop changes
  useEffect(() => {
    if (selectedEmployeeId) {
      setSelectedEmployee(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Filter entries for current fortnight and selected employee (if admin view)
  const currentFortnightEntries = Array.isArray(timesheetEntries) ? timesheetEntries.filter((entry: any) => {
    try {
      const entryDate = parseISO(entry.date);
      const fortnightStart = new Date(currentFortnight.start);
      const fortnightEnd = new Date(currentFortnight.end);
      
      // Set time to start/end of day for accurate comparison
      fortnightStart.setHours(0, 0, 0, 0);
      fortnightEnd.setHours(23, 59, 59, 999);
      entryDate.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      const isInFortnight = entryDate >= fortnightStart && entryDate <= fortnightEnd;
      
      if (isAdminView && selectedEmployee) {
        // In admin view, filter by the selected employee's ID
        const result = isInFortnight && entry.staffId === selectedEmployee;
        console.log('Admin filter:', { entryStaffId: entry.staffId, selectedEmployee, isInFortnight, result });
        return result;
      }
      
      console.log('Staff filter:', { entryDate: entry.date, isInFortnight, fortnightStart: format(fortnightStart, 'yyyy-MM-dd'), fortnightEnd: format(fortnightEnd, 'yyyy-MM-dd') });
      return isInFortnight;
    } catch (error) {
      console.error('Error filtering timesheet entry:', error, entry);
      return false;
    }
  }) : [];

  console.log('Current fortnight entries:', currentFortnightEntries);

  // Mutations for editing and deleting saved entries
  const editTimesheetMutation = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: string }) => {
      return apiRequest('PATCH', `/api/timesheet/${id}`, { [field]: value });
    },
    onSuccess: () => {
      refetchTimesheetEntries();
    },
  });

  const deleteTimesheetMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/timesheet/${id}`);
    },
    onSuccess: async () => {
      // Ensure data refresh completes before showing success
      await refetchTimesheetEntries();
      toast({
        title: "Entry Deleted",
        description: "Timesheet entry has been removed.",
        variant: "default",
      });
    },
  });

  const updateTimesheetMutation = useMutation({
    mutationFn: async (data: any) => {
      const endpoint = isAdminView ? "/api/admin/timesheet" : "/api/timesheet";
      
      // For admin view, ensure the staffId is set to the selected employee, not the admin
      if (isAdminView && selectedEmployee) {
        data.staffId = selectedEmployee;
      }
      
      return await apiRequest("POST", endpoint, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      // Remove individual success toasts for auto-save
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to save timesheet entry",
        variant: "destructive",
      });
    },
  });

  const confirmTimesheetMutation = useMutation({
    mutationFn: async () => {
      // Mark timesheet as confirmed and advance to next fortnight
      return await apiRequest("POST", "/api/timesheet/confirm", {
        fortnightStart: format(currentFortnight.start, 'yyyy-MM-dd'),
        fortnightEnd: format(currentFortnight.end, 'yyyy-MM-dd')
      });
    },
    onSuccess: () => {
      // Refresh timesheet data to reflect confirmed status
      refetchTimesheetEntries();
      
      // Advance to next fortnight
      const nextFortnightStart = addDays(currentFortnight.end, 1);
      setCurrentFortnight({
        start: nextFortnightStart,
        end: addDays(nextFortnightStart, 13)
      });
      
      // Clear any local edits since we're moving to new fortnight
      setTimesheetData({});
      
      toast({
        title: "Success",
        description: "Timesheet confirmed and advanced to next fortnight",
      });
    },
    onError: (error) => {
      toast({
        title: "Error", 
        description: "Failed to confirm timesheet",
        variant: "destructive",
      });
    },
  });

  const handleCellChange = (date: Date, entryIndex: number, field: string, value: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setTimesheetData((prev: any) => {
      const dayEntries = Array.isArray(prev[dateKey]) ? prev[dateKey] : [];
      const updatedEntries = [...dayEntries];
      
      if (!updatedEntries[entryIndex]) {
        updatedEntries[entryIndex] = {};
      }
      
      updatedEntries[entryIndex] = {
        ...updatedEntries[entryIndex],
        [field]: value
      };
      
      // No auto-save - user must use manual save button
      
      return {
        ...prev,
        [dateKey]: updatedEntries
      };
    });
  };

  const saveEntry = (date: Date, entryIndex: number, data: any) => {
    if (data && data.hours && parseFloat(data.hours) > 0) {
      const dateStr = format(date, 'yyyy-MM-dd');
      
      updateTimesheetMutation.mutate({
        date: dateStr,
        hours: parseFloat(data.hours),
        materials: data.materials || '',
        jobId: data.jobId === 'no-job' ? null : data.jobId || null,
      });
    }
  };

  const saveAllEntries = async () => {
    console.log('Save All clicked, timesheetData:', timesheetData);
    const entriesToSave: any[] = [];
    
    Object.entries(timesheetData).forEach(([dateKey, dayEntries]) => {
      if (Array.isArray(dayEntries)) {
        dayEntries.forEach((entry, index) => {
          console.log('Processing entry:', entry);
          if (entry.hours && parseFloat(entry.hours) > 0) {
            const entryData: any = {
              date: dateKey,
              hours: parseFloat(entry.hours),
              materials: entry.materials || '',
              jobId: entry.jobId === 'no-job' ? null : entry.jobId || null,
            };
            
            // For admin view, add the selected employee's staffId
            if (isAdminView && selectedEmployee) {
              entryData.staffId = selectedEmployee;
            }
            
            console.log('Adding entry to save:', entryData);
            entriesToSave.push(entryData);
          } else {
            console.log('Skipping entry - missing required fields:', { hours: entry.hours });
          }
        });
      }
    });

    console.log('Total entries to save:', entriesToSave.length, entriesToSave);

    if (entriesToSave.length === 0) {
      toast({
        title: "No entries to save",
        description: "Please enter hours for at least one entry.",
        variant: "destructive",
      });
      return;
    }

    // Save all entries in parallel since backend now handles duplicates properly
    try {
      const savePromises = entriesToSave.map(entry => 
        new Promise((resolve, reject) => {
          updateTimesheetMutation.mutate(entry, {
            onSuccess: resolve,
            onError: reject
          });
        })
      );

      await Promise.all(savePromises);
    } catch (error) {
      console.error('Error saving entries:', error);
      toast({
        title: "Save Error",
        description: "Failed to save one or more entries. Check console for details.",
        variant: "destructive",
      });
      return;
    }

    // Clear local data first to avoid display conflicts
    setTimesheetData({});
    
    // Final refresh to ensure all data is up to date
    await refetchTimesheetEntries();

    toast({
      title: "Timesheet Saved",
      description: `Successfully saved ${entriesToSave.length} entries! They should now appear in the timesheet.`,
      variant: "default",
    });
  };

  // Functions for editing and deleting saved entries
  const editSavedEntry = (id: string, field: string, value: string) => {
    editTimesheetMutation.mutate({ id, field, value });
  };

  const deleteSavedEntry = (id: string) => {
    deleteTimesheetMutation.mutate(id);
  };

  const getTotalHours = () => {
    // Sum hours from saved timesheet entries 
    const savedHours = Array.isArray(currentFortnightEntries) ? 
      currentFortnightEntries.reduce((total: number, entry: any) => {
        const hours = parseFloat(entry.hours);
        return total + (isNaN(hours) ? 0 : hours);
      }, 0) : 0;
    
    // Sum hours from unsaved form data
    const formHours = Object.values(timesheetData).reduce((total: number, dayEntries: any) => {
      if (Array.isArray(dayEntries)) {
        return total + dayEntries.reduce((dayTotal: number, entry: any) => {
          const hours = parseFloat(entry.hours);
          return dayTotal + (isNaN(hours) ? 0 : hours);
        }, 0);
      }
      return total;
    }, 0);
    
    const totalHours = savedHours + formHours;
    return isNaN(totalHours) ? 0 : totalHours;
  };

  // Check if current fortnight is confirmed (all entries approved)
  const isFortnightConfirmed = () => {
    if (!Array.isArray(currentFortnightEntries) || currentFortnightEntries.length === 0) {
      return false;
    }
    return currentFortnightEntries.every((entry: any) => entry.approved === true);
  };

  const addJobEntry = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setTimesheetData((prev: any) => {
      const dayEntries = Array.isArray(prev[dateKey]) ? prev[dateKey] : [];
      return {
        ...prev,
        [dateKey]: [...dayEntries, {}]
      };
    });
  };

  const removeJobEntry = (date: Date, entryIndex: number) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setTimesheetData((prev: any) => {
      const dayEntries = Array.isArray(prev[dateKey]) ? prev[dateKey] : [];
      const updatedEntries = dayEntries.filter((_, index) => index !== entryIndex);
      return {
        ...prev,
        [dateKey]: updatedEntries
      };
    });
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Title and header
    doc.setFontSize(16);
    doc.text('Timesheet Report', 20, 20);
    doc.setFontSize(12);
    doc.text(`Period: ${format(currentFortnight.start, 'MMM dd')} - ${format(currentFortnight.end, 'MMM dd, yyyy')}`, 20, 30);
    doc.text(`Total Hours: ${getTotalHours()}h`, 20, 40);
    
    // Table headers
    let yPos = 60;
    const colWidths = [30, 20, 60, 60];
    let xPos = 20;
    
    doc.setFontSize(10);
    doc.text('Date', xPos, yPos);
    xPos += colWidths[0];
    doc.text('Hours', xPos, yPos);
    xPos += colWidths[1];
    doc.text('Job', xPos, yPos);
    xPos += colWidths[2];
    doc.text('Materials', xPos, yPos);
    
    yPos += 10;
    
    // Table data
    fortnightDays.forEach(day => {
      const entries = Array.isArray(currentFortnightEntries) ? currentFortnightEntries.filter((entry: any) => 
        format(parseISO(entry.date), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
      ) : [];
      
      if (entries.length === 0) {
        xPos = 20;
        doc.text(format(day, 'MMM dd'), xPos, yPos);
        yPos += 8;
      } else {
        entries.forEach((entry: any) => {
          if (yPos > 280) {
            doc.addPage();
            yPos = 20;
          }
          
          xPos = 20;
          doc.text(format(parseISO(entry.date), 'MMM dd'), xPos, yPos);
          xPos += colWidths[0];
          doc.text(entry.hours || '', xPos, yPos);
          xPos += colWidths[1];
          // Handle leave types stored in materials field
          let jobText = 'No job';
          if (entry.jobId) {
            const job = Array.isArray(jobs) ? jobs.find((j: any) => j.id === entry.jobId) : null;
            jobText = job?.jobAddress || 'Job not found';
          } else if (entry.materials) {
            // Check if materials contains leave type
            const leaveTypes: { [key: string]: string } = {
              'sick-leave': 'Sick Leave',
              'personal-leave': 'Personal Leave', 
              'annual-leave': 'Annual Leave',
              'rdo': 'RDO (Rest Day Off)'
            };
            jobText = leaveTypes[entry.materials] || entry.materials;
          }
          doc.text(jobText.substring(0, 25), xPos, yPos);
          xPos += colWidths[2];
          doc.text((entry.materials || '').substring(0, 25), xPos, yPos);
          
          yPos += 8;
        });
      }
    });
    
    doc.save(`timesheet-${format(currentFortnight.start, 'yyyy-MM-dd')}-to-${format(currentFortnight.end, 'yyyy-MM-dd')}.pdf`);
  };

  const clearTimesheet = () => {
    if (window.confirm('Are you sure you want to clear all timesheet entries for this fortnight? This action cannot be undone.')) {
      // Clear local timesheet data
      setTimesheetData({});
      
      // Clear any pending auto-save timeout
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
        autoSaveTimeout.current = null;
      }
      
      // Show success message
      toast({
        title: "Timesheet Cleared",
        description: "All unsaved timesheet entries have been cleared.",
        variant: "default",
      });
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeout.current) {
        clearTimeout(autoSaveTimeout.current);
      }
    };
  }, []);

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="mb-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-2">Fortnight Timesheet</h1>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">
                {format(currentFortnight.start, 'MMM dd, yyyy')} - {format(currentFortnight.end, 'MMM dd, yyyy')}
              </p>
              {isAdminView && selectedEmployee && Array.isArray(staffMembers) && staffMembers.length > 0 && (
                <p className="text-sm text-primary font-medium bg-blue-50 px-2 py-1 rounded">
                  Viewing: {(() => {
                    const selected = staffMembers.find((s: any) => s.id === selectedEmployee);
                    return selected ? `${selected.name || 'Unknown Staff Member'}'s Timesheet` : 'Unknown Staff Member\'s Timesheet';
                  })()}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={saveAllEntries}
              variant="default"
              disabled={updateTimesheetMutation.isPending || isFortnightConfirmed()}
              className="bg-green-600 hover:bg-green-700"
              data-testid="button-save-all-timesheet"
            >
              <Save className="h-4 w-4 mr-2" />
              {updateTimesheetMutation.isPending ? 'Saving...' : 'Save All'}
            </Button>
            <Button onClick={exportToPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
            <Button 
              onClick={clearTimesheet} 
              variant="outline" 
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
              disabled={isFortnightConfirmed()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Timesheet
            </Button>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentFortnightIndex(prev => prev - 1)}
                disabled={currentFortnightIndex <= 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3">
                Fortnight {currentFortnightIndex + 1}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentFortnightIndex(prev => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Admin Employee Selection */}
        {isAdminView && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff Member Selection
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="employee-select" className="text-sm font-medium">Select Staff Member</Label>
                  <Select value={selectedEmployee} onValueChange={(value) => {
                    setSelectedEmployee(value);
                    // Clear local timesheet data when switching employees
                    setTimesheetData({});
                  }}>
                    <SelectTrigger data-testid="select-employee-timesheet" className="mt-1">
                      <SelectValue placeholder="Choose a staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(staffMembers) && staffMembers.length > 0 ? 
                        staffMembers.filter((staff: any) => staff.id && staff.id.trim() !== '').map((staff: any) => (
                          <SelectItem key={staff.id} value={staff.id}>
                            {staff.name || 'No Name'}
                          </SelectItem>
                        )) : (
                          <SelectItem value="no-staff" disabled>No staff members found</SelectItem>
                        )
                      }
                    </SelectContent>
                  </Select>
                </div>
                {selectedEmployee && Array.isArray(staffMembers) && staffMembers.length > 0 && (
                  <div className="flex items-center p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-sm">
                      <p className="font-medium text-green-800">
                        Currently Selected: {(() => {
                          const selected = staffMembers.find((s: any) => s.id === selectedEmployee);
                          return selected ? selected.name || 'Unknown Staff Member' : 'Unknown Staff Member';
                        })()}
                      </p>
                      <p className="text-green-600">Viewing their timesheet data below</p>
                    </div>
                  </div>
                )}
                

              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards - Only show when employee is selected in admin view */}
        {(!isAdminView || selectedEmployee) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">{getTotalHours()}h</p>
                  <p className="text-sm text-muted-foreground">Total Hours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{Array.isArray(currentFortnightEntries) ? currentFortnightEntries.length : 0}</p>
                  <p className="text-sm text-muted-foreground">Entries</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(() => {
                    const totalHours = getTotalHours();
                    const percentage = totalHours > 0 ? Math.round((totalHours / 80) * 100) : 0;
                    return isNaN(percentage) ? 0 : percentage;
                  })()}%</p>
                  <p className="text-sm text-muted-foreground">of 80 hours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(() => {
                    const totalHours = getTotalHours();
                    const avgPerDay = totalHours > 0 ? (totalHours / 14) : 0;
                    return isNaN(avgPerDay) ? "0.0" : avgPerDay.toFixed(1);
                  })()}h</p>
                  <p className="text-sm text-muted-foreground">Avg per day</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Timesheet Table - Only show when employee is selected in admin view */}
        {(!isAdminView || selectedEmployee) && (
          <>
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
                        
                        // Smart entry display logic:
                        // 1. If user is actively editing (has local entries), show those
                        // 2. Otherwise show saved entries from database
                        // 3. Always show at least one empty row for new input
                        let entriesToShow;
                        if (dayEntries.length > 0) {
                          // User has local unsaved entries - show those
                          entriesToShow = dayEntries;
                        } else if (existingEntries.length > 0) {
                          // Show saved entries from database
                          entriesToShow = existingEntries;
                        } else {
                          // No entries at all - show empty row for input
                          entriesToShow = [{}];
                        }
                        
                        return entriesToShow.map((entry: any, entryIndex: number) => (
                          <tr key={`${dayIndex}-${entryIndex}`} className={`border-b ${isWeekend ? 'bg-gray-50' : ''}`}>
                            <td className="p-3">
                              {entryIndex === 0 && (
                                <div className="font-medium">
                                  {format(day, 'EEE, MMM dd')}
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
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'hours', e.target.value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'hours', e.target.value);
                                  }
                                }}
                                className="w-20"
                                disabled={entry?.approved} // Only disable if approved
                              />
                            </td>
                            <td className="p-3">
                              <Select
                                value={entry?.jobId || 'no-job'}
                                onValueChange={(value) => {
                                  if (entry?.id && !entry?.approved) {
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'jobId', value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'jobId', value);
                                  }
                                }}
                                disabled={entry?.approved} // Only disable if approved
                              >
                                <SelectTrigger className="min-w-40">
                                  <SelectValue placeholder="Select job" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no-job">No job</SelectItem>
                                  <SelectItem value="rdo">RDO (Rest Day Off)</SelectItem>
                                  <SelectItem value="sick-leave">Sick Leave</SelectItem>
                                  <SelectItem value="personal-leave">Personal Leave</SelectItem>
                                  <SelectItem value="annual-leave">Annual Leave</SelectItem>
                                  {jobsLoading ? (
                                    <SelectItem value="loading" disabled>Loading jobs...</SelectItem>
                                  ) : jobsError ? (
                                    <SelectItem value="error" disabled>Error loading jobs</SelectItem>
                                  ) : Array.isArray(jobs) && jobs.length > 0 ? (
                                    jobs.filter((job: any) => job.id && job.id.trim() !== '').map((job: any) => (
                                      <SelectItem key={job.id} value={job.id}>
                                        {job.jobAddress || job.address || job.jobName || job.name || `Job ${job.id}`}
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="no-jobs" disabled>No jobs available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Input
                                type="text"
                                placeholder="Materials or notes"
                                value={entry?.materials || ''}
                                onChange={(e) => {
                                  if (entry?.id && !entry?.approved) {
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'materials', e.target.value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'materials', e.target.value);
                                  }
                                }}
                                className="min-w-32"
                                disabled={entry?.approved} // Only disable if approved
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                {entryIndex === 0 && !isFortnightConfirmed() && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addJobEntry(day)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {entryIndex > 0 && !isFortnightConfirmed() && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeJobEntry(day, entryIndex)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {entry?.id && !entry?.approved && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteSavedEntry(entry.id)}
                                    className="ml-1"
                                    data-testid={`button-delete-entry-${entry.id}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {entry?.id ? (
                                  <span className="text-xs text-green-600 flex items-center">
                                    ✓ Saved
                                  </span>
                                ) : entry?.hours && parseFloat(entry?.hours) > 0 ? (
                                  <span className="text-xs text-yellow-600 flex items-center">
                                    ⏳ Unsaved
                                  </span>
                                ) : null}
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

            {/* Confirmation Section */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Timesheet Confirmation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">Total Hours: {getTotalHours()}h</p>
                      <p className="text-sm text-muted-foreground">
                        {(Array.isArray(currentFortnightEntries) ? currentFortnightEntries.length : 0) + Object.values(timesheetData).reduce((total: number, dayEntries: any) => {
                          return total + (Array.isArray(dayEntries) ? dayEntries.filter((e: any) => e.hours && parseFloat(e.hours) > 0).length : 0);
                        }, 0)} entries recorded
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Fortnight Period</p>
                      <p className="font-medium">
                        {format(currentFortnight.start, 'MMM dd')} - {format(currentFortnight.end, 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Review your timesheet entries above. Once confirmed, your hours will be uploaded to the relevant job sheets.
                      </p>
                      <p className="text-xs text-orange-600">
                        ⚠️ You cannot edit entries after confirmation
                      </p>
                    </div>
                    {isFortnightConfirmed() ? (
                      <div className="flex items-center gap-2 text-green-600">
                        <span className="text-sm font-medium">✓ Timesheet Confirmed</span>
                        <span className="text-xs opacity-75">(Locked for editing)</span>
                      </div>
                    ) : (
                      <Button
                        onClick={() => confirmTimesheetMutation.mutate()}
                        disabled={confirmTimesheetMutation.isPending || getTotalHours() === 0}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {confirmTimesheetMutation.isPending ? "Confirming..." : "Confirm Timesheet"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Show message when no employee selected in admin view */}
        {isAdminView && !selectedEmployee && (
          <Card className="border-2 border-dashed border-gray-300">
            <CardContent className="p-12 text-center">
              <Users className="h-16 w-16 mx-auto text-gray-400 mb-6" />
              <h3 className="text-xl font-medium mb-3 text-gray-700">No Staff Member Selected</h3>
              <p className="text-gray-500 mb-4">
                Choose a staff member from the dropdown above to view their timesheet data
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700">
                💡 Tip: The timesheet will automatically load once you select an employee
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
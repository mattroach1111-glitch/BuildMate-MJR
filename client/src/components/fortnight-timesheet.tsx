import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download, FileText, ArrowLeft, Users, Plus, Trash2 } from "lucide-react";
import { format, addDays, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import jsPDF from "jspdf";

const FORTNIGHT_START_DATE = new Date(2025, 7, 11); // August 11, 2025

interface FortnightTimesheetProps {
  selectedEmployeeId?: string;
  isAdminView?: boolean;
}

export function FortnightTimesheet({ selectedEmployeeId, isAdminView = false }: FortnightTimesheetProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEmployee, setSelectedEmployee] = useState<string>(selectedEmployeeId || "");
  const [currentFortnightIndex, setCurrentFortnightIndex] = useState(0);
  const [timesheetData, setTimesheetData] = useState<any>({});

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

  const { data: jobs } = useQuery({
    queryKey: isAdminView ? ["/api/jobs"] : ["/api/jobs-for-staff"],
    retry: false,
  });

  const { data: timesheetEntries } = useQuery({
    queryKey: isAdminView && selectedEmployee ? ["/api/admin/timesheets", selectedEmployee] : ["/api/timesheet"],
    retry: false,
    enabled: !isAdminView || !!selectedEmployee, // Only fetch when employee is selected in admin view
  });

  // Update selected employee when prop changes
  useEffect(() => {
    if (selectedEmployeeId) {
      setSelectedEmployee(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Filter entries for current fortnight and selected employee (if admin view)
  const currentFortnightEntries = Array.isArray(timesheetEntries) ? timesheetEntries.filter((entry: any) => {
    const entryDate = parseISO(entry.date);
    const isInFortnight = entryDate >= currentFortnight.start && entryDate <= currentFortnight.end;
    
    if (isAdminView && selectedEmployee) {
      return isInFortnight && entry.staffId === selectedEmployee;
    }
    
    return isInFortnight;
  }) : [];

  const updateTimesheetMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/timesheet", data);
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
      // This would be an API call to mark timesheet as confirmed
      return await apiRequest("POST", "/api/timesheet/confirm", {
        fortnightStart: format(currentFortnight.start, 'yyyy-MM-dd'),
        fortnightEnd: format(currentFortnight.end, 'yyyy-MM-dd')
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Timesheet confirmed and uploaded to job sheets",
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
      
      // Auto-save when hours and job are filled
      if (field === 'hours' || field === 'jobId') {
        const entry = updatedEntries[entryIndex];
        if (entry.hours && parseFloat(entry.hours) > 0 && entry.jobId && entry.jobId !== 'no-job') {
          setTimeout(() => {
            autoSaveEntry(date, entryIndex, entry);
          }, 1000); // Debounce auto-save by 1 second
        }
      }
      
      return {
        ...prev,
        [dateKey]: updatedEntries
      };
    });
  };

  const autoSaveEntry = (date: Date, entryIndex: number, data: any) => {
    if (data.hours && parseFloat(data.hours) > 0) {
      updateTimesheetMutation.mutate({
        date: format(date, 'yyyy-MM-dd'),
        hours: parseFloat(data.hours),
        materials: data.materials || '',
        jobId: data.jobId === 'no-job' ? null : data.jobId || null,
      });
    }
  };

  const getTotalHours = () => {
    return currentFortnightEntries.reduce((total: number, entry: any) => total + (entry.hours || 0), 0);
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
          const job = Array.isArray(jobs) ? jobs.find((j: any) => j.id === entry.jobId) : null;
          doc.text((job?.jobAddress || 'No job').substring(0, 25), xPos, yPos);
          xPos += colWidths[2];
          doc.text((entry.materials || '').substring(0, 25), xPos, yPos);
          
          yPos += 8;
        });
      }
    });
    
    doc.save(`timesheet-${format(currentFortnight.start, 'yyyy-MM-dd')}-to-${format(currentFortnight.end, 'yyyy-MM-dd')}.pdf`);
  };

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
              {isAdminView && selectedEmployee && (
                <p className="text-sm text-primary font-medium">
                  Viewing: {Array.isArray(staffMembers) ? staffMembers.find((s: any) => s.id === selectedEmployee)?.firstName || '' : ''} {Array.isArray(staffMembers) ? staffMembers.find((s: any) => s.id === selectedEmployee)?.lastName || '' : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={exportToPDF} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
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
                      {Array.isArray(staffMembers) ? staffMembers.filter((staff: any) => staff.id && staff.id.trim() !== '').map((staff: any) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.firstName} {staff.lastName}
                        </SelectItem>
                      )) : []}
                    </SelectContent>
                  </Select>
                </div>
                {selectedEmployee && (
                  <div className="flex items-end">
                    <div className="text-sm text-muted-foreground">
                      <p>Selected: {Array.isArray(staffMembers) ? staffMembers.find((s: any) => s.id === selectedEmployee)?.firstName || '' : ''} {Array.isArray(staffMembers) ? staffMembers.find((s: any) => s.id === selectedEmployee)?.lastName || '' : ''}</p>
                      <p>Viewing their timesheet data</p>
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
                  <p className="text-2xl font-bold">{currentFortnightEntries.length}</p>
                  <p className="text-sm text-muted-foreground">Entries</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{Math.round((getTotalHours() / 80) * 100)}%</p>
                  <p className="text-sm text-muted-foreground">of 80 hours</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold">{(getTotalHours() / 14).toFixed(1)}h</p>
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
                        <th className="text-left p-3 font-medium">Materials</th>
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
                        
                        // Show existing entries plus any unsaved local entries
                        const allEntries = [...existingEntries];
                        if (dayEntries.length > 0) {
                          allEntries.push(...dayEntries);
                        }
                        
                        // Always show at least one entry row per day
                        const entriesToShow = allEntries.length > 0 ? allEntries : [{}];
                        
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
                                value={entry.hours || ''}
                                onChange={(e) => handleCellChange(day, entryIndex, 'hours', e.target.value)}
                                className="w-20"
                              />
                            </td>
                            <td className="p-3">
                              <Select
                                value={entry.jobId || 'no-job'}
                                onValueChange={(value) => handleCellChange(day, entryIndex, 'jobId', value)}
                              >
                                <SelectTrigger className="min-w-40">
                                  <SelectValue placeholder="Select job" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="no-job">No job</SelectItem>
                                  {Array.isArray(jobs) ? jobs.filter((job: any) => job.id && job.id.trim() !== '').map((job: any) => (
                                    <SelectItem key={job.id} value={job.id}>
                                      {job.jobAddress}
                                    </SelectItem>
                                  )) : []}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Input
                                placeholder="Materials used..."
                                value={entry.materials || ''}
                                onChange={(e) => handleCellChange(day, entryIndex, 'materials', e.target.value)}
                                className="min-w-40"
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                {entryIndex === 0 && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addJobEntry(day)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {entryIndex > 0 && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeJobEntry(day, entryIndex)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                                {entry?.hours && entry?.jobId && entry?.jobId !== 'no-job' && (
                                  <span className="text-xs text-green-600 flex items-center">
                                    ✓ Saved
                                  </span>
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
                        {currentFortnightEntries.length} entries recorded
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
                    <Button
                      onClick={() => confirmTimesheetMutation.mutate()}
                      disabled={confirmTimesheetMutation.isPending || getTotalHours() === 0}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {confirmTimesheetMutation.isPending ? "Confirming..." : "Confirm Timesheet"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Show message when no employee selected in admin view */}
        {isAdminView && !selectedEmployee && (
          <Card>
            <CardContent className="p-8 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a Staff Member</h3>
              <p className="text-muted-foreground">
                Choose a staff member from the dropdown above to view their timesheet
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
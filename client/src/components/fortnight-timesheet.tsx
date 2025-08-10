import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download, FileText, ArrowLeft, Users } from "lucide-react";
import { format, addDays, startOfWeek, parseISO } from "date-fns";
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
    queryKey: isAdminView && selectedEmployee ? ["/api/admin/timesheets"] : ["/api/timesheet"],
    retry: false,
  });

  // Update selected employee when prop changes
  useEffect(() => {
    if (selectedEmployeeId) {
      setSelectedEmployee(selectedEmployeeId);
    }
  }, [selectedEmployeeId]);

  // Filter entries for current fortnight and selected employee (if admin view)
  const currentFortnightEntries = (timesheetEntries || []).filter((entry: any) => {
    const entryDate = parseISO(entry.date);
    const isInFortnight = entryDate >= currentFortnight.start && entryDate <= currentFortnight.end;
    
    if (isAdminView && selectedEmployee) {
      return isInFortnight && entry.staffId === selectedEmployee;
    }
    
    return isInFortnight;
  });

  const updateTimesheetMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/timesheet", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/timesheet"] });
      toast({
        title: "Success",
        description: "Timesheet updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update timesheet",
        variant: "destructive",
      });
    },
  });

  const handleCellChange = (date: Date, field: string, value: string) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    setTimesheetData((prev: any) => ({
      ...prev,
      [dateKey]: {
        ...prev[dateKey],
        [field]: value
      }
    }));
  };

  const handleSaveEntry = (date: Date) => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const data = timesheetData[dateKey];
    
    if (!data?.hours || parseFloat(data.hours) <= 0) {
      toast({
        title: "Error",
        description: "Please enter valid hours",
        variant: "destructive",
      });
      return;
    }

    updateTimesheetMutation.mutate({
      date: format(date, 'yyyy-MM-dd'),
      hours: parseFloat(data.hours),
      description: data.description || '',
      materials: data.materials || '',
      jobId: data.jobId || null,
    });
  };

  const getEntryForDate = (date: Date) => {
    return currentFortnightEntries.find((entry: any) => 
      format(parseISO(entry.date), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')
    );
  };

  const getTotalHours = () => {
    return currentFortnightEntries.reduce((total: number, entry: any) => 
      total + parseFloat(entry.hours || '0'), 0
    );
  };

  const exportToPDF = () => {
    const doc = new jsPDF('landscape');
    
    // Header
    doc.setFontSize(16);
    doc.text('Fortnight Timesheet', 20, 20);
    doc.setFontSize(12);
    doc.text(`${format(currentFortnight.start, 'MMM dd, yyyy')} - ${format(currentFortnight.end, 'MMM dd, yyyy')}`, 20, 30);
    doc.text(`Employee: ${(user as any)?.firstName || ''} ${(user as any)?.lastName || ''}`, 20, 40);
    
    // Table headers
    let yPos = 60;
    const headers = ['Date', 'Day', 'Hours', 'Description', 'Materials'];
    const colWidths = [40, 30, 30, 80, 80];
    let xPos = 20;
    
    headers.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += colWidths[i];
    });
    
    yPos += 10;
    
    // Table data
    fortnightDays.forEach(day => {
      const entry = getEntryForDate(day);
      const data = timesheetData[format(day, 'yyyy-MM-dd')] || {};
      
      xPos = 20;
      doc.text(format(day, 'MMM dd'), xPos, yPos);
      xPos += colWidths[0];
      doc.text(format(day, 'EEE'), xPos, yPos);
      xPos += colWidths[1];
      doc.text(entry?.hours || data.hours || '', xPos, yPos);
      xPos += colWidths[2];
      doc.text((entry?.description || data.description || '').substring(0, 25), xPos, yPos);
      xPos += colWidths[3];
      doc.text((entry?.materials || data.materials || '').substring(0, 25), xPos, yPos);
      
      yPos += 8;
    });
    
    // Total
    yPos += 10;
    doc.text(`Total Hours: ${getTotalHours()}`, 20, yPos);
    
    doc.save(`timesheet_${format(currentFortnight.start, 'yyyy-MM-dd')}.pdf`);
  };

  const goBack = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button onClick={goBack} variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Fortnight Timesheet</h1>
              <p className="text-muted-foreground">
                {format(currentFortnight.start, 'MMM dd, yyyy')} - {format(currentFortnight.end, 'MMM dd, yyyy')}
              </p>
              {isAdminView && selectedEmployee && (
                <p className="text-sm text-primary font-medium">
                  Viewing: {(staffMembers || []).find((s: any) => s.id === selectedEmployee)?.firstName || ''} {(staffMembers || []).find((s: any) => s.id === selectedEmployee)?.lastName || ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
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
                  <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                    <SelectTrigger data-testid="select-employee-timesheet" className="mt-1">
                      <SelectValue placeholder="Choose a staff member..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(staffMembers || []).filter((staff: any) => staff.id && staff.id.trim() !== '').map((staff: any) => (
                        <SelectItem key={staff.id} value={staff.id}>
                          {staff.firstName} {staff.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
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
                <p className="text-sm text-muted-foreground">Days Worked</p>
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

        {/* Timesheet Table */}
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
                    <th className="text-left p-3 font-medium">Day</th>
                    <th className="text-left p-3 font-medium">Hours</th>
                    <th className="text-left p-3 font-medium">Job</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-left p-3 font-medium">Materials</th>
                    <th className="text-left p-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {fortnightDays.map((day, index) => {
                    const entry = getEntryForDate(day);
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    
                    return (
                      <tr key={index} className={`border-b ${isWeekend ? 'bg-gray-50' : ''}`}>
                        <td className="p-3">
                          <div className="font-medium">{format(day, 'MMM dd')}</div>
                          <div className="text-xs text-muted-foreground">{format(day, 'yyyy')}</div>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded text-xs ${
                            isWeekend ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {format(day, 'EEE')}
                          </span>
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.25"
                            min="0"
                            max="24"
                            placeholder="0"
                            value={entry?.hours || timesheetData[dateKey]?.hours || ''}
                            onChange={(e) => handleCellChange(day, 'hours', e.target.value)}
                            className="w-20"
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={entry?.jobId || timesheetData[dateKey]?.jobId || 'no-job'}
                            onValueChange={(value) => handleCellChange(day, 'jobId', value === 'no-job' ? '' : value)}
                          >
                            <SelectTrigger className="w-40">
                              <SelectValue placeholder="Select job" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-job">No job</SelectItem>
                              {(jobs || []).filter((job: any) => job.id && job.id.trim() !== '').map((job: any) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobAddress}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder="Work description"
                            value={entry?.description || timesheetData[dateKey]?.description || ''}
                            onChange={(e) => handleCellChange(day, 'description', e.target.value)}
                            className="min-w-40"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder="Materials used"
                            value={entry?.materials || timesheetData[dateKey]?.materials || ''}
                            onChange={(e) => handleCellChange(day, 'materials', e.target.value)}
                            className="min-w-40"
                          />
                        </td>
                        <td className="p-3">
                          <Button
                            size="sm"
                            onClick={() => handleSaveEntry(day)}
                            disabled={updateTimesheetMutation.isPending}
                          >
                            Save
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
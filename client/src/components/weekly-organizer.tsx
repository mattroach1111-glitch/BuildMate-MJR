import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar, Edit, Save, X, Plus, Users, Clock } from "lucide-react";
import { format, startOfWeek, addDays, addWeeks, subWeeks, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface WeeklyScheduleEntry {
  id?: string;
  employeeName: string;
  weekStartDate: string;
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface WeeklyOrganizerProps {
  isAdminView?: boolean;
}

export function WeeklyOrganizer({ isAdminView = false }: WeeklyOrganizerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 1 }); // Start on Monday
  });
  const [editMode, setEditMode] = useState(false);
  const [scheduleData, setScheduleData] = useState<WeeklyScheduleEntry[]>([]);

  // Predefined employee order matching your current system
  const employeeOrder = [
    'Liam', 'Hamish', 'Greg', 'Tim', 'Logan', 'Jesse', 'Mark',
    'Will', 'Truck', 'Scaffold', 'Plastering', 'Mark M', 'Labour'
  ];

  const weekDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
  const dayLabels = {
    monday: 'MONDAY',
    tuesday: 'TUESDAY', 
    wednesday: 'WEDNESDAY',
    thursday: 'THURSDAY',
    friday: 'FRIDAY'
  };

  // Get week dates for display
  const getWeekDates = () => {
    return weekDays.map((day, index) => ({
      day,
      date: addDays(currentWeekStart, index),
      label: dayLabels[day]
    }));
  };

  // Fetch weekly schedule data
  const { data: weeklySchedule, isLoading } = useQuery({
    queryKey: ["/api/weekly-schedule", format(currentWeekStart, 'yyyy-MM-dd')],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/weekly-schedule/${format(currentWeekStart, 'yyyy-MM-dd')}`);
      return response.json();
    },
  });

  // Update schedule mutation
  const updateScheduleMutation = useMutation({
    mutationFn: async (scheduleEntries: WeeklyScheduleEntry[]) => {
      const response = await apiRequest("POST", "/api/weekly-schedule", {
        weekStartDate: format(currentWeekStart, 'yyyy-MM-dd'),
        scheduleEntries
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/weekly-schedule"] });
      toast({
        title: "Schedule Updated",
        description: "Weekly organizer has been saved successfully",
      });
      setEditMode(false);
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update weekly schedule",
        variant: "destructive",
      });
    },
  });

  // Initialize schedule data when data loads
  useEffect(() => {
    if (weeklySchedule) {
      setScheduleData(weeklySchedule);
    } else {
      // Initialize with empty entries for all employees
      const emptySchedule = employeeOrder.map(name => ({
        employeeName: name,
        weekStartDate: format(currentWeekStart, 'yyyy-MM-dd'),
        monday: '',
        tuesday: '',
        wednesday: '',
        thursday: '',
        friday: ''
      }));
      setScheduleData(emptySchedule);
    }
  }, [weeklySchedule, currentWeekStart]);

  const handleCellChange = (employeeName: string, day: keyof WeeklyScheduleEntry, value: string) => {
    setScheduleData(prev => 
      prev.map(entry => 
        entry.employeeName === employeeName 
          ? { ...entry, [day]: value }
          : entry
      )
    );
  };

  const handleSave = () => {
    updateScheduleMutation.mutate(scheduleData);
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setCurrentWeekStart(prev => subWeeks(prev, 1));
    } else {
      setCurrentWeekStart(prev => addWeeks(prev, 1));
    }
    setEditMode(false); // Exit edit mode when changing weeks
  };

  const weekDates = getWeekDates();
  const weekNumber = Math.ceil(
    (currentWeekStart.getTime() - new Date(currentWeekStart.getFullYear(), 0, 1).getTime()) / 
    (7 * 24 * 60 * 60 * 1000)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Weekly Organizer
            </CardTitle>
            
            {isAdminView && (
              <div className="flex items-center gap-2">
                {editMode ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditMode(false)}
                      data-testid="button-cancel-edit"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSave}
                      disabled={updateScheduleMutation.isPending}
                      data-testid="button-save-schedule"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateScheduleMutation.isPending ? "Saving..." : "Save"}
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditMode(true)}
                    data-testid="button-edit-schedule"
                  >
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Schedule
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {/* Week Navigation */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('prev')}
              data-testid="button-prev-week"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous Week
            </Button>
            
            <div className="text-center">
              <h3 className="text-lg font-semibold">
                Week {weekNumber} - {format(currentWeekStart, 'MMMM do')} to {format(addDays(currentWeekStart, 4), 'do, yyyy')}
              </h3>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm text-muted-foreground">
                {weekDates.map(({ day, date, label }) => (
                  <span key={day}>
                    {label} {format(date, 'do')}
                  </span>
                ))}
              </div>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigateWeek('next')}
              data-testid="button-next-week"
            >
              Next Week
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Schedule Grid */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left p-4 font-semibold w-32">NAME</th>
                  {weekDates.map(({ day, date, label }) => (
                    <th key={day} className="text-center p-4 font-semibold min-w-[120px]">
                      <div className="space-y-1">
                        <div>{label}</div>
                        <div className="text-xs text-muted-foreground font-normal">
                          {format(date, 'MMM do')}
                        </div>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scheduleData.map((entry, index) => {
                  // Add visual separators for different sections
                  const isSpecialRow = ['Truck', 'Plastering', 'Labour'].includes(entry.employeeName);
                  const showSeparator = entry.employeeName === 'Will' || entry.employeeName === 'Plastering';
                  
                  return (
                    <React.Fragment key={entry.employeeName}>
                      {showSeparator && (
                        <tr>
                          <td colSpan={6} className="p-0">
                            <div className="border-t border-muted"></div>
                          </td>
                        </tr>
                      )}
                      <tr 
                        className={`border-b hover:bg-muted/20 ${
                          isSpecialRow ? 'bg-amber-50/50' : ''
                        } ${index % 2 === 0 ? 'bg-card' : 'bg-muted/10'}`}
                      >
                        <td className="p-4">
                          <div className="font-medium text-sm">
                            {entry.employeeName}
                          </div>
                        </td>
                        {weekDays.map((day) => (
                          <td key={day} className="p-2 text-center">
                            {editMode && isAdminView ? (
                              <Input
                                value={(entry[day] as string) || ''}
                                onChange={(e) => handleCellChange(entry.employeeName, day, e.target.value)}
                                className="text-center text-sm h-8"
                                placeholder="Location"
                                data-testid={`input-${entry.employeeName}-${day}`}
                              />
                            ) : (
                              <div className="text-sm py-1 px-2 min-h-[2rem] flex items-center justify-center">
                                {(entry[day] as string) || (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </div>
                            )}
                          </td>
                        ))}
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {!isAdminView && (
        <div className="text-center text-sm text-muted-foreground">
          Contact your administrator to update the weekly schedule
        </div>
      )}
    </div>
  );
}
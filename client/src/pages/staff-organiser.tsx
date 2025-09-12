import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, ArrowLeft, User, Clock, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import PageLayout from "@/components/page-layout";
import { format, parseISO, addDays, startOfWeek } from "date-fns";

interface WeekOption {
  weekStartDate: string;
  label: string;
  isCurrent: boolean;
}

interface Assignment {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

interface OrganiserEntry {
  id?: string;
  staffId: string;
  staffName: string;
  weekStartDate: string;
  assignments: Assignment;
  notes: string;
}

export default function StaffOrganiser() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();
  const [selectedWeek, setSelectedWeek] = useState<string>("");

  const handleBackClick = () => {
    navigate('/');
  };

  // Fetch available weeks
  const { data: weeks = [], isLoading: weeksLoading } = useQuery<WeekOption[]>({
    queryKey: ["/api/organiser/staff/weeks"],
    enabled: isAuthenticated,
  });

  // Set initial week selection
  useEffect(() => {
    if (weeks.length > 0 && !selectedWeek) {
      const currentWeek = weeks.find((w: WeekOption) => w.isCurrent);
      setSelectedWeek(currentWeek?.weekStartDate || weeks[0]?.weekStartDate);
    }
  }, [weeks, selectedWeek]);

  // Fetch organiser data for selected week - secure staff-only endpoint
  const { 
    data: organiserData = [], 
    isLoading: organiserLoading 
  } = useQuery<OrganiserEntry[]>({
    queryKey: ["/api/organiser/my-schedule", { week: selectedWeek }],
    queryFn: async () => {
      if (!selectedWeek) return [];
      const response = await fetch(`/api/organiser/my-schedule?week=${selectedWeek}`);
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Not authenticated');
        }
        throw new Error('Failed to fetch schedule');
      }
      return response.json();
    },
    enabled: !!selectedWeek && isAuthenticated,
  });

  if (isLoading || weeksLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading schedule...</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600 mb-4">You need to be logged in to view your schedule.</p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Log In
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  // Convert all organiser assignments to display format
  const generateAllAssignments = () => {
    if (!organiserData || organiserData.length === 0 || !selectedWeek) return [];

    return organiserData.map((assignment: OrganiserEntry) => ({
      staffName: assignment.staffName,
      assignments: assignment.assignments,
      notes: assignment.notes
    }));
  };

  const allAssignments = generateAllAssignments();
  const totalStaff = allAssignments.length;
  const totalAssignments = allAssignments.reduce((sum, staff) => {
    const dayAssignments = Object.values(staff.assignments).filter(job => job.trim() !== '');
    return sum + dayAssignments.length;
  }, 0);

  // Calculate unique job sites
  const uniqueJobSites = new Set();
  allAssignments.forEach(staff => {
    Object.values(staff.assignments).forEach(job => {
      if (job.trim()) uniqueJobSites.add(job.trim());
    });
  });

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  // Format week display
  const formatWeekDisplay = () => {
    if (!selectedWeek) return "Select a week";
    const weekStart = parseISO(selectedWeek);
    const weekEnd = addDays(weekStart, 6);
    return `${format(weekStart, 'EEE, dd MMM')} - ${format(weekEnd, 'EEE, dd MMM yyyy')}`;
  };

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button 
              variant="outline" 
              onClick={handleBackClick}
              className="flex items-center gap-2"
              data-testid="button-back-dashboard"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-900">Weekly Schedule</h1>
              <p className="text-gray-600">{formatWeekDisplay()}</p>
            </div>
            <div className="hidden sm:block w-[140px]"></div> {/* Spacer for flexbox alignment */}
          </div>

          {/* Week Selection */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-center justify-center">
                <label htmlFor="week-select" className="text-sm font-medium">Select Week:</label>
                <Select 
                  value={selectedWeek} 
                  onValueChange={setSelectedWeek}
                  data-testid="select-staff-week"
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Choose week..." />
                  </SelectTrigger>
                  <SelectContent>
                    {weeks.map((week: WeekOption) => (
                      <SelectItem key={week.weekStartDate} value={week.weekStartDate}>
                        {week.label} {week.isCurrent && "(Current)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {organiserLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardContent className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <>
              {/* Week Overview Card */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-orange-600" />
                    Team Schedule Overview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-blue-50 p-4 rounded-lg" data-testid="stat-staff-members">
                      <div className="text-2xl font-bold text-blue-700">{totalStaff}</div>
                      <div className="text-sm text-blue-600">Staff Members</div>
                    </div>
                    <div className="bg-green-50 p-4 rounded-lg" data-testid="stat-total-assignments">
                      <div className="text-2xl font-bold text-green-700">{totalAssignments}</div>
                      <div className="text-sm text-green-600">Total Assignments</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg" data-testid="stat-job-sites">
                      <div className="text-2xl font-bold text-orange-700">{uniqueJobSites.size}</div>
                      <div className="text-sm text-orange-600">Job Sites</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Daily Schedule by Day */}
              <div className="grid gap-4">
                {dayLabels.map((dayLabel, dayIndex) => {
                  const dayKey = dayNames[dayIndex];
                  const weekStart = selectedWeek ? parseISO(selectedWeek) : new Date();
                  const dayDate = addDays(weekStart, dayIndex);
                  
                  // Get all assignments for this day
                  const dayAssignments = allAssignments
                    .map(staff => ({
                      staffName: staff.staffName,
                      job: staff.assignments[dayKey] || "",
                      notes: staff.notes
                    }))
                    .filter(assignment => assignment.job.trim() !== "");

                  return (
                    <Card 
                      key={dayLabel} 
                      className={`${dayAssignments.length === 0 ? 'opacity-60' : ''}`}
                      data-testid={`card-day-${dayLabel.toLowerCase()}`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {dayLabel}
                          </CardTitle>
                          <Badge variant="secondary" className="text-sm">
                            {format(dayDate, 'dd MMM')}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {dayAssignments.length > 0 ? (
                          <div className="space-y-3">
                            {dayAssignments.map((assignment, index) => (
                              <div 
                                key={index} 
                                className="bg-orange-50 border border-orange-200 rounded-lg p-4"
                                data-testid={`job-assignment-${dayLabel.toLowerCase()}-${index}`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <User className="h-4 w-4 text-blue-600" />
                                      <span className="font-medium text-blue-900">{assignment.staffName}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-2">
                                      <MapPin className="h-4 w-4 text-orange-600" />
                                      <span className="font-semibold text-gray-900">{assignment.job}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                      <Clock className="h-4 w-4" />
                                      <span>8:00 AM - 4:00 PM</span>
                                    </div>
                                  </div>
                                  <Badge 
                                    variant="default"
                                    className="bg-orange-100 text-orange-800 border-orange-300"
                                  >
                                    Scheduled
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p>No jobs scheduled</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                });
                })}
              </div>

              {/* Notice */}
              <Card className="mt-6 border-blue-200 bg-blue-50">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <div className="bg-blue-600 rounded-full p-1">
                      <User className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">Schedule Updates</h3>
                      <p className="text-blue-700 text-sm">
                        Your schedule is managed by the admin team. If you have any questions about your assignments 
                        or need to request changes, please contact your supervisor.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
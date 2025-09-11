import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  Plus, 
  Download, 
  Calendar, 
  RefreshCw, 
  User, 
  UserPlus, 
  Copy, 
  Trash2, 
  FileText, 
  Bell, 
  Edit, 
  Save, 
  X 
} from "lucide-react";

interface Staff {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

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

interface EditingCell {
  staffId: string;
  day: keyof Assignment;
  value: string;
}

export default function WeeklyOrganiser() {
  const { toast } = useToast();
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [editingCell, setEditingCell] = useState<EditingCell | null>(null);
  const [tempValue, setTempValue] = useState("");
  const [showAddStaffDialog, setShowAddStaffDialog] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");

  // Fetch available weeks
  const { data: weeks = [], isLoading: weeksLoading } = useQuery<WeekOption[]>({
    queryKey: ["/api/organiser/weeks"],
    enabled: true,
  });

  // Fetch organiser staff
  const { 
    data: staff = [], 
    isLoading: staffLoading,
    refetch: refetchStaff 
  } = useQuery<Staff[]>({
    queryKey: ["/api/organiser/staff"],
    enabled: true,
  });

  // Set initial week selection
  useEffect(() => {
    if (weeks.length > 0 && !selectedWeek) {
      const currentWeek = weeks.find((w) => w.isCurrent);
      setSelectedWeek(currentWeek?.weekStartDate || weeks[0]?.weekStartDate);
    }
  }, [weeks, selectedWeek]);

  // Fetch organiser data for selected week
  const { 
    data: organiserData = [], 
    isLoading: organiserLoading,
    refetch: refetchOrganiser 
  } = useQuery<OrganiserEntry[]>({
    queryKey: ["/api/organiser", selectedWeek],
    queryFn: async () => {
      const response = await fetch(`/api/organiser?week=${selectedWeek}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch organiser data');
      }
      return response.json();
    },
    enabled: !!selectedWeek,
  });

  // Add staff mutation
  const addStaffMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("POST", "/api/organiser/staff", { 
        name: name.trim(),
        sortOrder: staff.length 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organiser/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organiser"] });
      setShowAddStaffDialog(false);
      setNewStaffName("");
      toast({
        title: "Success",
        description: "Staff member added successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error adding staff:", error);
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
    },
  });

  // Delete staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (staffId: string) => {
      return apiRequest("DELETE", `/api/organiser/staff/${staffId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organiser/staff"] });
      queryClient.invalidateQueries({ queryKey: ["/api/organiser"] });
      toast({
        title: "Success",
        description: "Staff member removed successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error deleting staff:", error);
      toast({
        title: "Error",
        description: "Failed to remove staff member",
        variant: "destructive",
      });
    },
  });

  // Create/Update organiser entry mutation
  const updateOrganiserMutation = useMutation({
    mutationFn: async ({ staffId, assignments, notes }: { staffId: string; assignments: Assignment; notes?: string }) => {
      const entry = organiserData.find((item) => item.staffId === staffId);
      
      if (entry?.id) {
        // Update existing entry
        return apiRequest("PUT", `/api/organiser/${entry.id}`, { assignments, notes });
      } else {
        // Create new entry
        return apiRequest("POST", "/api/organiser", {
          weekStartDate: selectedWeek,
          staffId,
          assignments,
          notes: notes || "",
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organiser"] });
      toast({
        title: "Success",
        description: "Assignment updated successfully",
      });
    },
    onError: (error: any) => {
      console.error("Error updating organiser:", error);
      toast({
        title: "Error",
        description: "Failed to update assignment",
        variant: "destructive",
      });
    },
  });

  const handleCellClick = (staffId: string, day: keyof Assignment) => {
    const entry = organiserData.find((item) => item.staffId === staffId);
    const currentValue = entry?.assignments[day] || "";
    
    setEditingCell({ staffId, day, value: currentValue });
    setTempValue(currentValue);
  };

  const handleSaveCell = () => {
    if (!editingCell) return;

    const entry = organiserData.find((item) => item.staffId === editingCell.staffId);
    const updatedAssignments = {
      ...(entry?.assignments || {
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
        saturday: "",
        sunday: "",
      }),
      [editingCell.day]: tempValue,
    };

    updateOrganiserMutation.mutate({
      staffId: editingCell.staffId,
      assignments: updatedAssignments,
      notes: entry?.notes || "",
    });

    setEditingCell(null);
    setTempValue("");
  };

  const handleCancelEdit = () => {
    setEditingCell(null);
    setTempValue("");
  };

  const handleRefresh = () => {
    refetchOrganiser();
    toast({
      title: "Refreshed",
      description: "Organiser data refreshed successfully",
    });
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    toast({
      title: "Export",
      description: "Export functionality coming soon",
    });
  };

  const dayNames = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  if (weeksLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 animate-pulse rounded w-1/3"></div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2"></div>
              <div className="h-10 bg-gray-200 animate-pulse rounded w-1/4"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold">Weekly Organiser</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setShowAddStaffDialog(true)}
            data-testid="button-add-staff"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleExport}
            data-testid="button-export-organiser"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Week Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Week Selection
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-center">
            <Label htmlFor="week-select">Select Week:</Label>
            <Select 
              value={selectedWeek} 
              onValueChange={setSelectedWeek}
              data-testid="select-week"
            >
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Choose week..." />
              </SelectTrigger>
              <SelectContent>
                {weeks.map((week) => (
                  <SelectItem key={week.weekStartDate} value={week.weekStartDate}>
                    {week.label} {week.isCurrent && "(Current)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleRefresh}
              disabled={organiserLoading}
              data-testid="button-refresh-organiser"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${organiserLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Organiser Spreadsheet */}
      <Card>
        <CardHeader>
          <CardTitle>Staff Weekly Assignments</CardTitle>
          <CardDescription>
            Assign jobs to staff members for the selected week. Click on a cell to edit assignments.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {organiserLoading ? (
            <div className="space-y-4">
              <div className="h-12 bg-gray-200 animate-pulse rounded"></div>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-20 bg-gray-200 animate-pulse rounded"></div>
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="border border-gray-300 p-3 text-left font-semibold">Staff Member</th>
                    {dayLabels.map((day) => (
                      <th key={day} className="border border-gray-300 p-3 text-center font-semibold min-w-[120px]">
                        {day}
                      </th>
                    ))}
                    <th className="border border-gray-300 p-3 text-center font-semibold">Notes</th>
                    <th className="border border-gray-300 p-3 text-center font-semibold w-16">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((staffMember) => {
                    // Find the corresponding organiser entry for this staff member
                    const entry = organiserData.find((item) => item.staffId === staffMember.id);
                    
                    // Create empty assignments if no entry exists
                    const assignments = entry?.assignments || {
                      monday: "",
                      tuesday: "",
                      wednesday: "",
                      thursday: "",
                      friday: "",
                      saturday: "",
                      sunday: "",
                    };

                    return (
                      <tr key={staffMember.id} className="hover:bg-gray-50">
                        <td className="border border-gray-300 p-3 font-medium">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-500" />
                            {staffMember.name}
                          </div>
                        </td>
                        {dayNames.map((day) => (
                          <td key={day} className="border border-gray-300 p-2">
                            {editingCell?.staffId === staffMember.id && editingCell?.day === day ? (
                              <div className="flex flex-col gap-2">
                                <Input
                                  value={tempValue}
                                  onChange={(e) => setTempValue(e.target.value)}
                                  placeholder="Enter job site..."
                                  className="text-sm"
                                  data-testid={`input-assignment-${staffMember.id}-${day}`}
                                />
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={handleSaveCell}
                                    disabled={updateOrganiserMutation.isPending}
                                    data-testid={`button-save-${staffMember.id}-${day}`}
                                  >
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCancelEdit}
                                    data-testid={`button-cancel-${staffMember.id}-${day}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="min-h-[60px] p-2 bg-gray-50 rounded border-dashed border-2 border-gray-300 hover:border-orange-300 hover:bg-orange-50 cursor-pointer transition-colors"
                                onClick={() => handleCellClick(staffMember.id, day)}
                                data-testid={`cell-assignment-${staffMember.id}-${day}`}
                              >
                                {assignments[day] ? (
                                  <div className="text-sm text-gray-900">
                                    {assignments[day]}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-500 flex items-center justify-center h-full">
                                    Click to assign
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="border border-gray-300 p-2">
                          <div className="text-sm text-gray-600 max-w-[100px] truncate">
                            {entry?.notes || "No notes"}
                          </div>
                        </td>
                        <td className="border border-gray-300 p-2 text-center">
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => deleteStaffMutation.mutate(staffMember.id)}
                            disabled={deleteStaffMutation.isPending}
                            data-testid={`button-delete-staff-${staffMember.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button 
              variant="outline" 
              className="justify-start"
              data-testid="button-copy-previous"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy Previous Week
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              data-testid="button-clear-assignments"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All Assignments
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              data-testid="button-print-schedule"
            >
              <FileText className="h-4 w-4 mr-2" />
              Print Schedule
            </Button>
            <Button 
              variant="outline" 
              className="justify-start"
              data-testid="button-notify-staff"
            >
              <Bell className="h-4 w-4 mr-2" />
              Notify Staff
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Add Staff Dialog */}
      <Dialog open={showAddStaffDialog} onOpenChange={setShowAddStaffDialog}>
        <DialogContent aria-describedby="add-staff-description">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
            <p id="add-staff-description" className="text-sm text-muted-foreground">
              Enter the name of the staff member you want to add to the weekly organiser.
            </p>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="staff-name">Staff Name</Label>
              <Input
                id="staff-name"
                value={newStaffName}
                onChange={(e) => setNewStaffName(e.target.value)}
                placeholder="Enter staff member name..."
                data-testid="input-staff-name"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddStaffDialog(false);
                  setNewStaffName("");
                }}
                data-testid="button-cancel-staff"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (newStaffName.trim()) {
                    addStaffMutation.mutate(newStaffName);
                  }
                }}
                disabled={!newStaffName.trim() || addStaffMutation.isPending}
                data-testid="button-confirm-add-staff"
              >
                {addStaffMutation.isPending ? "Adding..." : "Add Staff"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Trash2, Lock, Unlock, ChevronLeft } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { format, addDays, parseISO } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { OrientationToggle } from "@/components/orientation-toggle";
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
  const [unlockedWeekends, setUnlockedWeekends] = useState<Set<string>>(new Set());
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [customAddresses, setCustomAddresses] = useState<{[key: string]: {houseNumber: string, streetAddress: string}}>({});
  const [showAddressDialog, setShowAddressDialog] = useState<{show: boolean, dayIndex: number, entryIndex: number}>({show: false, dayIndex: -1, entryIndex: -1});
  const [currentAddress, setCurrentAddress] = useState({houseNumber: '', streetAddress: ''});
  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Function to unlock weekend for editing
  const unlockWeekend = (dateKey: string) => {
    setUnlockedWeekends(prev => new Set([...Array.from(prev), dateKey]));
  };

  // Function to check if weekend is unlocked
  const isWeekendUnlocked = (dateKey: string) => {
    return unlockedWeekends.has(dateKey);
  };

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
      console.log("✅ Save successful, clearing timesheet data");
      refetchTimesheetEntries();
      setTimesheetData({}); // Clear data only after successful save
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
    console.log(`📝 Cell change: ${dateKey} [${entryIndex}] ${field} = "${value}"`);
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
      
      const newData = {
        ...prev,
        [dateKey]: updatedEntries,
      };
      console.log("📊 Updated timesheet data:", newData);
      return newData;
    });

    // Temporarily disable auto-save to debug manual save issue
    // Auto-save with debounce
    if (autoSaveTimeout.current) {
      clearTimeout(autoSaveTimeout.current);
    }
    
    // autoSaveTimeout.current = setTimeout(() => {
    //   console.log("🔄 Auto-saving entries...");
    //   saveAllEntries();
    // }, 2000); // Increased timeout to 2 seconds
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
    console.log("💾 saveAllEntries called, current data:", timesheetData);
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

    console.log("📤 Entries to save:", entriesToSave);
    if (entriesToSave.length > 0) {
      updateTimesheetMutation.mutate({ entries: entriesToSave });
      // Don't clear timesheet data immediately - let it clear after successful save
    } else {
      console.log("⚠️ No entries to save - data might be missing");
    }
  };

  console.log("🚀 STAFF TIMESHEET PAGE LOADED - Weekend locking enabled");

  return (
    <PageLayout title="Daily Timesheet Entries">
      <div className="max-w-6xl mx-auto p-4">
        {/* Back to Staff Dashboard Button */}
        <div className="mb-4">
          <Button 
            variant="outline" 
            onClick={() => window.location.href = '/staff'}
            className="flex items-center gap-2"
            data-testid="button-back-staff"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Staff Dashboard
          </Button>
        </div>
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
                    const isWeekendLocked = isWeekend && !isWeekendUnlocked(dateKey);
                    if (isWeekend) {
                      console.log(`🔵 WEEKEND DETECTED: ${format(day, 'EEE MMM dd')} (${dateKey}) - Day: ${day.getDay()}, Locked: ${isWeekendLocked}`);
                    }
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
                      <tr key={`${dayIndex}-${entryIndex}`} className={`border-b ${isWeekend ? 'weekend-row' : ''}`}>
                        <td className="p-3">
                          {entryIndex === 0 && (
                            <div className={`font-medium ${isWeekend ? 'text-black' : ''} flex items-center justify-between`}>
                              <div>
                                {format(day, 'EEE, MMM dd')}
                                {isWeekend && <span className="text-xs text-black ml-2 font-semibold">(Weekend)</span>}
                              </div>
                              {isWeekend && !isWeekendUnlocked(dateKey) && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-black hover:bg-blue-700"
                                      data-testid={`unlock-weekend-${dateKey}`}
                                    >
                                      <Lock className="h-3 w-3" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Weekend Work Confirmation</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        You are about to log hours for {format(day, 'EEEE, MMMM dd, yyyy')}. 
                                        Please confirm that you actually worked on this weekend day.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => unlockWeekend(dateKey)}
                                        className="bg-blue-600 hover:bg-blue-700"
                                      >
                                        Yes, I worked this weekend
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {isWeekend && isWeekendUnlocked(dateKey) && (
                                <div className="flex items-center text-xs text-black">
                                  <Unlock className="h-3 w-3 mr-1" />
                                  Unlocked
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            step="0.5"
                            placeholder={isWeekendLocked ? "Locked" : "0"}
                            value={entry?.hours || ''}
                            onChange={(e) => {
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'hours', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'hours', e.target.value);
                              }
                            }}
                            className={`w-20 ${isWeekend ? 'text-black placeholder:text-gray-600' : ''}`}
                            disabled={entry?.approved || isWeekendLocked}
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={entry?.jobId || 'no-job'}
                            onValueChange={(value) => {
                              if (value === 'other-address') {
                                // Show address input dialog
                                setShowAddressDialog({show: true, dayIndex, entryIndex});
                                setCurrentAddress({houseNumber: '', streetAddress: ''});
                                return;
                              }
                              
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'jobId', value);
                              } else {
                                handleCellChange(day, entryIndex, 'jobId', value);
                              }
                            }}
                            disabled={entry?.approved || isWeekendLocked}
                          >
                            <SelectTrigger className={`w-40 ${isWeekend ? 'text-black border-blue-400' : ''}`}>
                              <SelectValue placeholder="Choose job or leave type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-job">No job</SelectItem>
                              <SelectItem value="rdo">RDO (Rest Day Off)</SelectItem>
                              <SelectItem value="sick-leave">Sick Leave</SelectItem>
                              <SelectItem value="personal-leave">Personal Leave</SelectItem>
                              <SelectItem value="annual-leave">Annual Leave</SelectItem>
                              <SelectItem value="leave-without-pay">🆕 Leave without pay</SelectItem>
                              <SelectItem value="other-address">🆕 Other Address (Enter manually)</SelectItem>
                              <SelectItem value="test-option">🔥 TEST - NEW OPTIONS LOADED</SelectItem>
                              {Array.isArray(jobs) && jobs.length > 0 ? jobs.map((job: any) => (
                                <SelectItem key={job.id} value={job.id}>
                                  {job.jobAddress}
                                </SelectItem>
                              )) : (
                                <SelectItem value="no-jobs-found" disabled>No jobs available</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            placeholder={isWeekendLocked ? "Locked" : "Materials or notes"}
                            value={entry?.materials || ''}
                            onChange={(e) => {
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'materials', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'materials', e.target.value);
                              }
                            }}
                            className={`min-w-40 ${isWeekend ? 'text-black placeholder:text-gray-600' : ''}`}
                            disabled={entry?.approved || isWeekendLocked}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {entry?.id && !isWeekendLocked && (
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
                            {entry?.id && !entry?.approved && (
                              <span className="text-xs text-orange-600 font-medium">Unsaved</span>
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

        {/* Action Buttons */}
        <div className="flex gap-3 mt-4">
          <Button
            onClick={saveAllEntries}
            disabled={updateTimesheetMutation.isPending}
            className="bg-green-600 hover:bg-green-700 text-white"
            data-testid="save-timesheet"
          >
            {updateTimesheetMutation.isPending ? "Saving..." : "Save Timesheet"}
          </Button>
          
          <Button
            onClick={() => {
              saveAllEntries();
              setShowSuccessAnimation(true);
              setTimeout(() => setShowSuccessAnimation(false), 3000);
              toast({
                title: "Timesheet Confirmed",
                description: "Your timesheet has been submitted successfully",
              });
            }}
            disabled={updateTimesheetMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="confirm-timesheet"
          >
            Confirm Timesheet
          </Button>
        </div>

        {/* Success Animation */}
        {showSuccessAnimation && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white rounded-full p-8 animate-bounce">
              <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center animate-pulse">
                <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
          </div>
        )}
        
        {/* Address Input Dialog */}
        <Dialog open={showAddressDialog.show} onOpenChange={(open) => setShowAddressDialog({show: open, dayIndex: -1, entryIndex: -1})}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enter Job Address</DialogTitle>
              <DialogDescription>
                Please provide the house number and street address for this job location.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="houseNumber">House Number *</Label>
                <Input
                  id="houseNumber"
                  placeholder="e.g., 123"
                  value={currentAddress.houseNumber}
                  onChange={(e) => setCurrentAddress(prev => ({...prev, houseNumber: e.target.value}))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="streetAddress">Street Address *</Label>
                <Input
                  id="streetAddress"
                  placeholder="e.g., Main Street, Suburb, City"
                  value={currentAddress.streetAddress}
                  onChange={(e) => setCurrentAddress(prev => ({...prev, streetAddress: e.target.value}))}
                  className="mt-1"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddressDialog({show: false, dayIndex: -1, entryIndex: -1})}>
                Cancel
              </Button>
              <Button 
                onClick={() => {
                  // Validate required fields
                  if (!currentAddress.houseNumber.trim() || !currentAddress.streetAddress.trim()) {
                    toast({
                      title: "Required Fields Missing",
                      description: "Please enter both house number and street address.",
                      variant: "destructive",
                    });
                    return;
                  }
                  
                  // Create custom address key and save
                  const customAddressKey = `custom-${Date.now()}`;
                  const fullAddress = `${currentAddress.houseNumber} ${currentAddress.streetAddress}`;
                  
                  setCustomAddresses(prev => ({
                    ...prev,
                    [customAddressKey]: currentAddress
                  }));
                  
                  // Get the current day for the dialog
                  const day = fortnightDays[showAddressDialog.dayIndex];
                  const entryIndex = showAddressDialog.entryIndex;
                  
                  // Handle the entry update
                  if (day && entryIndex >= 0) {
                    handleCellChange(day, entryIndex, 'jobId', customAddressKey);
                    handleCellChange(day, entryIndex, 'materials', fullAddress);
                  }
                  
                  toast({
                    title: "Address Added",
                    description: `Job address set to: ${fullAddress}`,
                  });
                  
                  // Close dialog
                  setShowAddressDialog({show: false, dayIndex: -1, entryIndex: -1});
                  setCurrentAddress({houseNumber: '', streetAddress: ''});
                }}
                disabled={!currentAddress.houseNumber.trim() || !currentAddress.streetAddress.trim()}
              >
                Add Address
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      
      {/* Show landscape toggle only in staff timesheet */}
      <OrientationToggle show={true} />
    </PageLayout>
  );
}
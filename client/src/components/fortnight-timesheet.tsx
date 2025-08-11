import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Download, FileText, ArrowLeft, Users, Plus, Trash2, Save, Clock, CheckCircle, Calendar, Lock, Unlock, Edit } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  // Calculate which fortnight we should start with based on current date
  const getCurrentFortnightIndex = () => {
    const today = new Date();
    const startDate = FORTNIGHT_START_DATE;
    const daysDiff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, Math.floor(daysDiff / 14));
  };

  const [currentFortnightIndex, setCurrentFortnightIndex] = useState(0); // Start with current fortnight (Aug 11-24)
  const [timesheetData, setTimesheetData] = useState<any>({});
  const [unlockedWeekends, setUnlockedWeekends] = useState<Set<string>>(new Set());
  const [customAddresses, setCustomAddresses] = useState<{[key: string]: {houseNumber: string, streetAddress: string}}>({});
  const [showAddressDialog, setShowAddressDialog] = useState(false);
  const [addressDialogData, setAddressDialogData] = useState<{dayIndex: number, entryIndex: number}>({dayIndex: -1, entryIndex: -1});
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false);
  const [editAddressData, setEditAddressData] = useState<{entryId: string, currentAddress: string}>({entryId: '', currentAddress: ''});
  const [currentAddress, setCurrentAddress] = useState({houseNumber: '', streetAddress: ''});
  const [showLowHoursDialog, setShowLowHoursDialog] = useState(false);
  const [lowHoursTotal, setLowHoursTotal] = useState(0);
  const [pendingSubmission, setPendingSubmission] = useState<(() => void) | null>(null);
  

  const autoSaveTimeout = useRef<NodeJS.Timeout | null>(null); // Single timeout for all auto-saves

  // Debug effect to track dialog state changes
  useEffect(() => {
    console.log('🏠 DIALOG STATE CHANGED:', showAddressDialog, 'Data:', addressDialogData);
    if (showAddressDialog) {
      console.log('🏠 DIALOG SHOULD BE VISIBLE NOW!');
      
      // Use direct DOM manipulation since React rendering is failing
      console.log('🏠 CREATING ADDRESS INPUT DIALOG...');
      
      // Remove any existing dialog
      const existingDialog = document.getElementById('address-input-dialog');
      if (existingDialog) {
        existingDialog.remove();
      }
      
      // Create proper address input dialog
      const dialog = document.createElement('div');
      dialog.id = 'address-input-dialog';
      dialog.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        z-index: 99999;
        background-color: white;
        color: black;
        padding: 24px;
        border: 1px solid #e2e8f0;
        border-radius: 12px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        min-width: 400px;
        font-family: system-ui, -apple-system, sans-serif;
      `;
      
      dialog.innerHTML = `
        <div style="margin-bottom: 16px;">
          <h3 style="font-size: 18px; font-weight: 600; margin: 0 0 8px 0;">Enter Custom Address</h3>
          <p style="font-size: 14px; color: #64748b; margin: 0;">Enter the address where you worked</p>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px;">House Number</label>
          <input 
            type="text" 
            id="house-number-input"
            placeholder="e.g. 123"
            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
          />
        </div>
        
        <div style="margin-bottom: 20px;">
          <label style="display: block; font-size: 14px; font-weight: 500; margin-bottom: 6px;">Street Address</label>
          <input 
            type="text" 
            id="street-address-input"
            placeholder="e.g. Main Street"
            style="width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 14px;"
          />
        </div>
        
        <div style="display: flex; gap: 12px; justify-content: flex-end;">
          <button 
            id="cancel-address-btn"
            style="padding: 8px 16px; border: 1px solid #d1d5db; background: white; color: #374151; border-radius: 6px; font-size: 14px; cursor: pointer;"
          >
            Cancel
          </button>
          <button 
            id="save-address-btn"
            style="padding: 8px 16px; border: none; background: #3b82f6; color: white; border-radius: 6px; font-size: 14px; cursor: pointer;"
          >
            Save Address
          </button>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      // Add event listeners
      const cancelBtn = document.getElementById('cancel-address-btn');
      const saveBtn = document.getElementById('save-address-btn');
      const houseInput = document.getElementById('house-number-input') as HTMLInputElement;
      const streetInput = document.getElementById('street-address-input') as HTMLInputElement;
      
      // Focus first input
      houseInput?.focus();
      
      // Cancel button
      cancelBtn?.addEventListener('click', () => {
        dialog.remove();
        setShowAddressDialog(false);
        setAddressDialogData({dayIndex: -1, entryIndex: -1});
      });
      
      // Save button
      saveBtn?.addEventListener('click', () => {
        const houseNumber = houseInput?.value || '';
        const streetAddress = streetInput?.value || '';
        
        if (!houseNumber.trim() || !streetAddress.trim()) {
          alert('Please enter both house number and street address');
          return;
        }
        
        const fullAddress = houseNumber.trim() + ' ' + streetAddress.trim();
        console.log('Setting custom address:', fullAddress);
        
        // Update the address in the timesheet entry
        const { dayIndex, entryIndex } = addressDialogData;
        const targetDate = addDays(currentFortnight.start, dayIndex);
        
        // Use special marker for custom addresses and store address in description
        const customAddressMarker = 'custom-address';
        
        // Update local state first - use custom marker for local tracking
        handleCellChange(targetDate, entryIndex, 'jobId', customAddressMarker);
        handleCellChange(targetDate, entryIndex, 'description', fullAddress);
        
        // Get the updated entry from local state
        const dateKey = format(targetDate, 'yyyy-MM-dd');
        const dayEntries = timesheetData[dateKey] || [];
        const entry = dayEntries[entryIndex] || { hours: '0', materials: '' };
        
        // DON'T auto-save to database - let user save manually with Save All button
        // Just update local state for now
        const localEntry = {
          jobId: 'custom-address',
          description: `CUSTOM_ADDRESS: ${fullAddress}`,
          hours: entry.hours || '0', // Default to 0 hours - let user set hours manually
          materials: entry.materials || ''
        };
        
        // Update local state only
        setTimesheetData((prev: any) => {
          const dayEntries = Array.isArray(prev[dateKey]) ? prev[dateKey] : [];
          const updatedEntries = [...dayEntries];
          updatedEntries[entryIndex] = { ...updatedEntries[entryIndex], ...localEntry };
          return { ...prev, [dateKey]: updatedEntries };
        });

        // Show success message without auto-saving
        toast({
          title: "Address Added",
          description: `Custom address set to: ${fullAddress}. Remember to click "Save All" to save to database.`,
        });
        
        console.log('Custom address set in local state - no auto-save');
        
        dialog.remove();
        setShowAddressDialog(false);
        setAddressDialogData({dayIndex: -1, entryIndex: -1});
      });
      
      // Enter key support
      const handleEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          saveBtn?.click();
        }
      };
      
      houseInput?.addEventListener('keydown', handleEnter);
      streetInput?.addEventListener('keydown', handleEnter);
      
      console.log('🏠 ADDRESS DIALOG CREATED SUCCESSFULLY');
      
      // Also check if React portals work
      setTimeout(() => {
        const alwaysVisible = document.querySelector('[data-testid="always-visible-dialog"]');
        const directDialog = document.getElementById('direct-dom-dialog');
        console.log('🏠 REACT PORTAL DIALOG IN DOM:', alwaysVisible);
        console.log('🏠 DIRECT DOM DIALOG IN DOM:', directDialog);
      }, 100);
    }
  }, [showAddressDialog, addressDialogData]);

  // Effect to handle edit address dialog
  useEffect(() => {
    if (showEditAddressDialog && editAddressData.entryId) {
      // Create edit dialog
      const dialog = document.createElement('div');
      dialog.id = 'edit-address-dialog';
      dialog.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-50';
      dialog.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
          <h3 class="text-lg font-semibold mb-4">Edit Custom Address</h3>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium mb-1">Current Address:</label>
              <p class="text-sm text-gray-600 mb-2">${editAddressData.currentAddress}</p>
              <label class="block text-sm font-medium mb-1">House Number:</label>
              <input type="text" id="edit-house-input" class="w-full border rounded px-3 py-2" placeholder="123" />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">Street Address:</label>
              <input type="text" id="edit-street-input" class="w-full border rounded px-3 py-2" placeholder="Main Street" />
            </div>
          </div>
          <div class="flex gap-2 mt-6">
            <button id="edit-address-save-btn" class="flex-1 bg-blue-500 text-white rounded px-4 py-2 hover:bg-blue-600">Save Changes</button>
            <button id="edit-address-cancel-btn" class="flex-1 bg-gray-500 text-white rounded px-4 py-2 hover:bg-gray-600">Cancel</button>
          </div>
        </div>
      `;
      
      document.body.appendChild(dialog);
      
      const houseInput = document.getElementById('edit-house-input') as HTMLInputElement;
      const streetInput = document.getElementById('edit-street-input') as HTMLInputElement;
      const saveBtn = document.getElementById('edit-address-save-btn');
      const cancelBtn = document.getElementById('edit-address-cancel-btn');
      
      // Pre-fill with current address parts
      const addressParts = editAddressData.currentAddress.split(' ');
      if (addressParts.length >= 2) {
        houseInput.value = addressParts[0];
        streetInput.value = addressParts.slice(1).join(' ');
      }
      
      houseInput?.focus();
      
      // Cancel button
      cancelBtn?.addEventListener('click', () => {
        dialog.remove();
        setShowEditAddressDialog(false);
        setEditAddressData({entryId: '', currentAddress: ''});
      });
      
      // Save button
      saveBtn?.addEventListener('click', () => {
        const houseNumber = houseInput?.value || '';
        const streetAddress = streetInput?.value || '';
        
        if (!houseNumber.trim() || !streetAddress.trim()) {
          alert('Please enter both house number and street address');
          return;
        }
        
        const newAddress = houseNumber.trim() + ' ' + streetAddress.trim();
        const newDescription = `CUSTOM_ADDRESS: ${newAddress}`;
        
        // Update the entry in database
        editSavedEntry(editAddressData.entryId, 'description', newDescription);
        
        toast({
          title: "Success",
          description: "Custom address updated successfully",
        });
        
        dialog.remove();
        setShowEditAddressDialog(false);
        setEditAddressData({entryId: '', currentAddress: ''});
      });
      
      // Enter key support
      const handleEnter = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          saveBtn?.click();
        }
      };
      
      houseInput?.addEventListener('keydown', handleEnter);
      streetInput?.addEventListener('keydown', handleEnter);
    }
  }, [showEditAddressDialog, editAddressData]);

  // Function to unlock weekend for editing
  const unlockWeekend = (dateKey: string) => {
    console.log(`🔓 UNLOCKING WEEKEND: ${dateKey}`);
    setUnlockedWeekends(prev => {
      const newSet = new Set([...Array.from(prev), dateKey]);
      console.log(`🗂️ UPDATED UNLOCKED WEEKENDS:`, Array.from(newSet));
      return newSet;
    });
    toast({
      title: "Weekend Unlocked",
      description: `You can now enter hours for ${dateKey}`,
      variant: "default",
    });
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

  // Allow editing of empty days even after fortnight confirmation
  // This enables users to add entries to previously empty days in confirmed fortnights

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
      console.log('🚀 Starting timesheet confirmation...');
      // Mark timesheet as confirmed and advance to next fortnight
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('⏰ Confirmation timeout - aborting request');
        controller.abort();
      }, 30000); // 30 second timeout
      
      try {
        const response = await apiRequest("POST", "/api/timesheet/confirm", {
          fortnightStart: format(currentFortnight.start, 'yyyy-MM-dd'),
          fortnightEnd: format(currentFortnight.end, 'yyyy-MM-dd')
        }, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log('✅ Confirmation response received');
        return await response.json();
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Confirmation failed:', error);
        throw error;
      }
    },
    onSuccess: async (data) => {
      console.log('🎉 Confirmation successful:', data);
      
      try {
        // Refresh timesheet data to reflect confirmed status
        console.log('🔄 Refreshing timesheet data...');
        await refetchTimesheetEntries();
        
        // Show success animation for timesheet completion
        console.log('✨ Showing success animation...');
        setShowSuccessAnimation(true);
        setTimeout(() => setShowSuccessAnimation(false), 3000);
        
        // Advance to next fortnight
        console.log('⏭️ Advancing to next fortnight...');
        const nextFortnightIndex = currentFortnightIndex + 1;
        setCurrentFortnightIndex(nextFortnightIndex);
        
        // Clear any local edits since we're moving to new fortnight
        console.log('🧹 Clearing local timesheet data...');
        setTimesheetData({});
        
        toast({
          title: "Success",
          description: data?.message || "Timesheet confirmed and advanced to next fortnight",
        });
        
        console.log('✅ Confirmation process completed successfully');
      } catch (error) {
        console.error('❌ Error in success handler:', error);
        toast({
          title: "Warning",
          description: "Timesheet was confirmed but there was an issue refreshing the data. Please refresh the page.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error("❌ Confirmation error:", error);
      
      let errorMessage = "Failed to confirm timesheet";
      
      if (error?.name === 'AbortError') {
        errorMessage = "Confirmation timed out. Please try again.";
      } else if (error?.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Error", 
        description: errorMessage,
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
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      const entryData: any = {
        date: dateStr,
        hours: parseFloat(data.hours),
        materials: data.materials || '',
        jobId: data.jobId === 'no-job' ? null : data.jobId || null,
      };
      
      // Add weekend confirmation if this date is unlocked
      if (isWeekend && isWeekendUnlocked(dateStr)) {
        entryData.weekendConfirmed = true;
      }
      
      updateTimesheetMutation.mutate(entryData);
    }
  };

  const validateEntries = (timesheetData: any) => {
    const errors: string[] = [];
    
    Object.entries(timesheetData).forEach(([dateKey, dayEntries]) => {
      if (Array.isArray(dayEntries)) {
        dayEntries.forEach((entry, index) => {
          const hours = parseFloat(entry.hours || '0');
          const jobId = entry.jobId;
          
          // Validation 1: Leave without pay must have 0 hours
          if (jobId === 'leave-without-pay' && hours > 0) {
            errors.push(`${format(parseISO(dateKey), 'MMM dd')}: Leave without pay must have 0 hours`);
          }
          
          // Validation 1a: Sick leave, annual leave, personal leave, and Tafe must have hours > 0
          const hourRequiredLeaveTypes = ['sick-leave', 'annual-leave', 'personal-leave', 'tafe'];
          if (hourRequiredLeaveTypes.includes(jobId) && hours <= 0) {
            const leaveTypeNames: Record<string, string> = {
              'sick-leave': 'Sick Leave',
              'annual-leave': 'Annual Leave', 
              'personal-leave': 'Personal Leave',
              'tafe': 'Tafe'
            };
            errors.push(`${format(parseISO(dateKey), 'MMM dd')}: ${leaveTypeNames[jobId]} must have hours greater than 0`);
          }
          
          // Validation 2: If hours > 0, must have a job selected (not "no-job") 
          // Exception: Special leave types (RDO, sick leave, etc.) and Tafe are allowed even with no actual job
          const leaveTypes = ['rdo', 'sick-leave', 'personal-leave', 'annual-leave', 'leave-without-pay', 'tafe'];
          if (hours > 0 && (!jobId || jobId === 'no-job') && !leaveTypes.includes(jobId)) {
            errors.push(`${format(parseISO(dateKey), 'MMM dd')}: Cannot have hours without selecting a job`);
          }
        });
      }
    });
    
    return errors;
  };

  // Validation for timesheet completion - all weekdays must have entries
  const validateFortnightCompletion = () => {
    const errors: string[] = [];
    const missingDays: string[] = [];
    
    // Check each day in the fortnight
    fortnightDays.forEach(day => {
      const dateKey = format(day, 'yyyy-MM-dd');
      const dayOfWeek = day.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      // Only validate Monday-Friday (1-5)
      if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        // Check if day has entries with hours > 0 from any source
        let hasValidEntry = false;
        
        // Check saved entries from database
        const savedEntries = Array.isArray(currentFortnightEntries) 
          ? currentFortnightEntries.filter((entry: any) => 
              format(parseISO(entry.date), 'yyyy-MM-dd') === dateKey && 
              parseFloat(entry.hours || '0') > 0
            )
          : [];
        
        // Check local unsaved entries
        const localEntries = timesheetData[dateKey] || [];
        const localValidEntries = Array.isArray(localEntries) 
          ? localEntries.filter(entry => parseFloat(entry.hours || '0') > 0)
          : [];
        
        hasValidEntry = savedEntries.length > 0 || localValidEntries.length > 0;
        
        if (!hasValidEntry) {
          missingDays.push(format(day, 'EEE, MMM dd'));
        }
      }
    });
    
    if (missingDays.length > 0) {
      errors.push(`Missing entries for weekdays: ${missingDays.join(', ')}`);
    }
    
    return errors;
  };

  const saveAllEntries = async () => {
    console.log('Save All clicked, timesheetData:', timesheetData);
    
    // Validate entries before saving
    const validationErrors = validateEntries(timesheetData);
    if (validationErrors.length > 0) {
      toast({
        title: "Validation Error",
        description: validationErrors[0], // Show first error
        variant: "destructive",
      });
      return;
    }
    
    const entriesToSave: any[] = [];
    
    Object.entries(timesheetData).forEach(([dateKey, dayEntries]) => {
      if (Array.isArray(dayEntries)) {
        dayEntries.forEach((entry, index) => {
          // Processing entry for save
          const hours = parseFloat(entry.hours || '0');
          
          // Include entries with hours > 0 OR any leave type (even with 0 hours) OR custom addresses with hours > 0
          const leaveTypes = ['rdo', 'sick-leave', 'personal-leave', 'annual-leave', 'leave-without-pay', 'tafe'];
          const isLeaveType = leaveTypes.includes(entry.jobId);
          const isCustomAddress = entry.jobId && entry.jobId.startsWith('custom-');
          

          
          if (hours > 0 || (isLeaveType && hours >= 0) || (isCustomAddress && hours > 0)) {
            let entryData: any = {
              date: dateKey,
              hours: hours,
              materials: entry.materials || '',
              jobId: entry.jobId === 'no-job' || isLeaveType ? entry.jobId : entry.jobId || null,
            };
            
            // Handle custom addresses specially - set jobId to null and store address in description
            if (isCustomAddress) {
              // Get address from materials field first, then from description if materials is empty
              let fullAddress = entry.materials;
              if (!fullAddress && entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
                fullAddress = entry.description.replace('CUSTOM_ADDRESS: ', '');
              }
              // Fallback to 'Custom Address' only if no address found anywhere
              fullAddress = fullAddress || 'Custom Address';
              
              entryData.jobId = null;
              entryData.description = `CUSTOM_ADDRESS: ${fullAddress}`;
              // Debug logging can be removed in production
              console.log('🏠 PROCESSING CUSTOM ADDRESS:', {
                originalJobId: entry.jobId,
                extractedAddress: fullAddress
              });
            }
            
            // Check if this is a weekend date and add confirmation flag
            const entryDate = parseISO(dateKey);
            const dayOfWeek = entryDate.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            if (isWeekend && isWeekendUnlocked(dateKey)) {
              entryData.weekendConfirmed = true;
              // Weekend confirmation added for unlocked weekend
            }
            
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

    // Refresh to ensure all data is up to date, but don't clear local data yet
    await refetchTimesheetEntries();
    // Only clear local data after successful refresh
    setTimesheetData({});
    
    console.log('Successfully saved and cleared local data');

    // Show success animation
    setShowSuccessAnimation(true);
    setTimeout(() => setShowSuccessAnimation(false), 3000);

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

  // Function to edit custom address
  const editCustomAddress = (entryId: string, currentAddress: string) => {
    setEditAddressData({ entryId, currentAddress });
    setShowEditAddressDialog(true);
  };

  const deleteSavedEntry = (id: string) => {
    deleteTimesheetMutation.mutate(id);
  };

  const getTotalHours = () => {
    // Only sum hours from saved timesheet entries to avoid double-counting
    // Form data (timesheetData) should only be used for preview before saving
    const savedHours = Array.isArray(currentFortnightEntries) ? 
      currentFortnightEntries.reduce((total: number, entry: any) => {
        const hours = parseFloat(entry.hours);
        return total + (isNaN(hours) ? 0 : hours);
      }, 0) : 0;
    

    return isNaN(savedHours) ? 0 : savedHours;
  };

  // Check if current fortnight is confirmed (all entries approved)
  const isFortnightConfirmed = () => {
    // Always allow editing - users should be able to add entries to empty days
    // even after fortnight confirmation/approval
    return false;
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
          // Handle leave types and custom addresses
          let jobText = 'No job';
          if (entry.jobId) {
            // Check for special leave types first
            const leaveTypes: { [key: string]: string } = {
              'sick-leave': 'Sick Leave',
              'personal-leave': 'Personal Leave', 
              'annual-leave': 'Annual Leave',
              'rdo': 'RDO (Rest Day Off)',
              'leave-without-pay': 'Leave without pay'
            };
            
            if (leaveTypes[entry.jobId]) {
              jobText = leaveTypes[entry.jobId];
            } else if (entry.jobId.startsWith('custom-')) {
              // Custom address from materials field
              jobText = entry.materials || 'Custom Address';
            } else {
              // Regular job lookup
              const job = Array.isArray(jobs) ? jobs.find((j: any) => j.id === entry.jobId) : null;
              jobText = job?.jobAddress || 'Job not found';
            }
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

  // Calculate progress stats for staff view
  const savedHours = Array.isArray(currentFortnightEntries) ? 
    currentFortnightEntries.reduce((sum: number, entry: any) => sum + parseFloat(entry.hours || '0'), 0) : 0;
  
  const workdaysCompleted = Array.isArray(currentFortnightEntries) ? 
    new Set(currentFortnightEntries.map((entry: any) => format(parseISO(entry.date), 'yyyy-MM-dd'))).size : 0;
  
  const completionPercentage = Math.round((workdaysCompleted / 10) * 100);

  // Success Animation Component
  const SuccessAnimation = () => {
    if (!showSuccessAnimation) return null;
    
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-full p-8 animate-pulse">
          <div className="bg-green-500 rounded-full p-6 animate-bounce">
            <CheckCircle className="h-16 w-16 text-white animate-spin" style={{ animationDuration: '0.5s' }} />
          </div>
        </div>
      </div>
    );
  };

  // For staff users, show enhanced interface with essential controls
  if (!isAdminView) {
    return (
      <>
        <SuccessAnimation />
        <div className="p-4 max-w-7xl mx-auto">
          <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Daily Timesheet Entries
                </CardTitle>
                {/* Fortnight Navigation for Staff */}
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentFortnightIndex(Math.max(0, currentFortnightIndex - 1))}
                    disabled={currentFortnightIndex === 0}
                    data-testid="button-previous-fortnight"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentFortnightIndex(currentFortnightIndex + 1)}
                    data-testid="button-next-fortnight"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={saveAllEntries}
                  variant="default"
                  disabled={updateTimesheetMutation.isPending}
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
                  className="text-red-600 hover:text-red-700"
                  data-testid="button-clear-timesheet"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
            <div className="text-sm text-muted-foreground mt-2">
              {format(currentFortnight.start, 'MMM dd, yyyy')} - {format(currentFortnight.end, 'MMM dd, yyyy')}
            </div>
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
                      <tr key={`${dayIndex}-${entryIndex}`} className={`border-b ${isWeekend ? 'weekend-row bg-blue-600 text-white' : ''}`} style={isWeekend ? { backgroundColor: '#1e40af !important', color: 'white !important' } : {}}>
                        <td className="p-3">
                          {entryIndex === 0 && (
                            <div className={`font-medium ${isWeekend ? 'text-white' : ''} flex items-center justify-between`}>
                              <div>
                                {format(day, 'EEE, MMM dd')}
                                {isWeekend && <span className="text-xs text-white ml-2 font-semibold">(Weekend)</span>}
                              </div>
                              {(() => {
                                const shouldShowButton = isWeekend && !isWeekendUnlocked(dateKey);
                                console.log(`🔧 STAFF UNLOCK BUTTON DEBUG: ${dateKey} - isWeekend=${isWeekend}, unlocked=${isWeekendUnlocked(dateKey)}, shouldShow=${shouldShowButton}, entryIndex=${entryIndex}`);
                                return shouldShowButton;
                              })() && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-white hover:bg-orange-600"
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
                                        className="bg-orange-500 hover:bg-orange-600"
                                      >
                                        Yes, I worked this weekend
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {isWeekend && isWeekendUnlocked(dateKey) && (
                                <div className="flex items-center text-xs text-white">
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
                            placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "0"}
                            value={entry?.hours || ''}
                            onChange={(e) => {
                              if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                console.log(`🚫 STAFF WEEKEND INPUT BLOCKED: ${dateKey} - Weekend is locked!`);
                                return; // Prevent any input on locked weekends
                              }
                              
                              const newHours = e.target.value;
                              const currentJobId = entry?.jobId;
                              
                              // Validate leave-without-pay + hours > 0
                              if (currentJobId === 'leave-without-pay' && parseFloat(newHours) > 0) {
                                toast({
                                  title: "Invalid Entry",
                                  description: "Leave without pay must have 0 hours",
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              // Don't auto-save custom addresses - let user save manually
                              const isCustomAddress = entry?.jobId === 'custom-address' || 
                                                     (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:'));
                              
                              if (entry?.id && !entry?.approved && !isCustomAddress) {
                                editSavedEntry(entry.id, 'hours', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'hours', e.target.value);
                              }
                            }}
                            className={`w-20 ${isWeekend ? 'text-white placeholder:text-blue-200 bg-blue-800 border-blue-600' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}
                            disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))} // Disable for approved entries or locked weekends
                            readOnly={isWeekend && !isWeekendUnlocked(dateKey)} // Make readonly for locked weekends
                          />
                        </td>
                        <td className="p-3">
                          <Select
                            value={
                              // Handle custom addresses properly
                              entry?.jobId === 'custom-address' || (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:')) 
                                ? 'custom-address' 
                                : entry?.jobId || 'no-job'
                            }
                            onValueChange={(value) => {
                              const dateKey = format(day, 'yyyy-MM-dd');
                              if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                console.log(`🚫 STAFF WEEKEND JOB BLOCKED: ${dateKey} - Weekend is locked!`);
                                return; // Prevent job selection on locked weekends
                              }
                              
                              if (value === 'other-address') {
                                // Clear hours when selecting other-address to start fresh
                                if (entry?.id && !entry?.approved) {
                                  editSavedEntry(entry.id, 'hours', '');
                                } else {
                                  handleCellChange(day, entryIndex, 'hours', '');
                                }
                                
                                // Show address input dialog
                                console.log('🏠 OTHER ADDRESS SELECTED - Opening dialog for dayIndex:', dayIndex, 'entryIndex:', entryIndex);
                                console.log('🏠 BEFORE setState - showAddressDialog:', showAddressDialog);
                                setAddressDialogData({dayIndex, entryIndex});
                                setCurrentAddress({houseNumber: '', streetAddress: ''});
                                setShowAddressDialog(true);
                                console.log('🏠 AFTER setState call - should show dialog now');
                                return;
                              }
                              
                              // Validate job selection with current hours
                              const dayEntries = Array.isArray(timesheetData[dateKey]) ? timesheetData[dateKey] : [];
                              const currentEntry = dayEntries[entryIndex] || {};
                              const currentHours = parseFloat(currentEntry.hours || entry?.hours || '0');
                              
                              // If selecting leave-without-pay and hours > 0, show warning
                              if (value === 'leave-without-pay' && currentHours > 0) {
                                toast({
                                  title: "Hours Cleared",
                                  description: "Leave without pay requires 0 hours. Hours have been reset to 0.",
                                  variant: "default",
                                });
                                // Clear hours when selecting leave-without-pay
                                if (entry?.id && !entry?.approved) {
                                  editSavedEntry(entry.id, 'hours', '0');
                                } else {
                                  handleCellChange(day, entryIndex, 'hours', '0');
                                }
                              }
                              
                              if (entry?.id && !entry?.approved) {
                                editSavedEntry(entry.id, 'jobId', value);
                              } else {
                                handleCellChange(day, entryIndex, 'jobId', value);
                              }
                            }}
                            disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))}
                          >
                            <SelectTrigger className={`min-w-40 ${isWeekend ? 'text-white bg-blue-800 border-blue-600' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}>
                              <SelectValue 
                                placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "Select job"}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no-job">No job</SelectItem>
                              <SelectItem value="other-address">Other Address (Enter manually)</SelectItem>
                              {/* Show custom address if it exists */}
                              {(entry?.jobId === 'custom-address' || (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:'))) && (
                                <SelectItem value="custom-address">
                                  {entry?.description 
                                    ? entry.description.replace('CUSTOM_ADDRESS: ', '')
                                    : 'Custom Address'
                                  }
                                </SelectItem>
                              )}
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
                              
                              {/* Tafe and Leave Types pinned at bottom */}
                              <Separator className="my-2" />
                              <SelectItem value="tafe">Tafe</SelectItem>
                              <SelectItem value="rdo">RDO (Rest Day Off)</SelectItem>
                              <SelectItem value="sick-leave">Sick Leave</SelectItem>
                              <SelectItem value="personal-leave">Personal Leave</SelectItem>
                              <SelectItem value="annual-leave">Annual Leave</SelectItem>
                              <SelectItem value="leave-without-pay">Leave without pay</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="p-3">
                          <Input
                            type="text"
                            placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "Materials or notes"}
                            value={entry?.materials || ''}
                            onChange={(e) => {
                              if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                console.log(`🚫 STAFF WEEKEND MATERIALS BLOCKED: ${dateKey} - Weekend is locked!`);
                                return; // Prevent materials input on locked weekends
                              }
                              // Don't auto-save custom addresses - let user save manually
                              const isCustomAddress = entry?.jobId === 'custom-address' || 
                                                     (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:'));
                              
                              if (entry?.id && !entry?.approved && !isCustomAddress) {
                                editSavedEntry(entry.id, 'materials', e.target.value);
                              } else {
                                handleCellChange(day, entryIndex, 'materials', e.target.value);
                              }
                            }}
                            className={`min-w-32 ${isWeekend ? 'text-white placeholder:text-blue-200 bg-blue-800 border-blue-600' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}
                            disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))}
                            readOnly={isWeekend && !isWeekendUnlocked(dateKey)}
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex gap-2">
                            {entryIndex === 0 && !isFortnightConfirmed() && !(isWeekend && !isWeekendUnlocked(dateKey)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addJobEntry(day)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            )}
                            {entryIndex > 0 && !isFortnightConfirmed() && !(isWeekend && !isWeekendUnlocked(dateKey)) && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeJobEntry(day, entryIndex)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                            {entry?.id && !entry?.approved && (
                              <>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteSavedEntry(entry.id)}
                                  className="ml-1"
                                  data-testid={`button-delete-entry-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                                {/* Edit button for custom addresses - admin only */}
                                {isAdminView && entry?.description && entry.description.startsWith('CUSTOM_ADDRESS:') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const address = entry.description.replace('CUSTOM_ADDRESS: ', '');
                                      editCustomAddress(entry.id, address);
                                    }}
                                    className="ml-1"
                                    data-testid={`button-edit-address-${entry.id}`}
                                    title="Edit custom address"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
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
            
            {/* Smart Progress Prompts for Staff */}
            <div className="mt-6 pt-6 border-t space-y-4">
              {/* Progress Stats */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium">{savedHours}h logged</span> • 
                  <span className="font-medium"> {Math.min(workdaysCompleted, 10)}/10 workdays</span> • 
                  <span className="font-medium">{completionPercentage}% complete</span>
                </div>
                {completionPercentage >= 100 && (
                  <Button 
                    onClick={() => {
                      // Check for low hours warning
                      const totalHours = getTotalHours();
                      if (totalHours < 76) {

                        setLowHoursTotal(totalHours);
                        setPendingSubmission(() => () => confirmTimesheetMutation.mutate());
                        setShowLowHoursDialog(true);
                        return;
                      }

                      confirmTimesheetMutation.mutate();
                    }}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={confirmTimesheetMutation.isPending}
                    data-testid="button-submit-timesheet"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {confirmTimesheetMutation.isPending ? 'Submitting...' : 'Submit Timesheet'}
                  </Button>
                )}
              </div>

              {/* Smart Prompts Based on Progress */}
              {workdaysCompleted === 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Ready to start your fortnight?</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Fill out your daily hours and job details. You need 10 workdays to complete this timesheet period.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {workdaysCompleted >= 1 && workdaysCompleted <= 3 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-900">Great start! 🎯</h4>
                      <p className="text-sm text-green-700 mt-1">
                        You've logged {workdaysCompleted} day{workdaysCompleted > 1 ? 's' : ''}. Keep going! Remember to save your entries as you fill them out.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {workdaysCompleted >= 4 && workdaysCompleted <= 6 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-900">Halfway there! 🚀</h4>
                      <p className="text-sm text-yellow-700 mt-1">
                        {workdaysCompleted} days completed - you're making excellent progress! {10 - workdaysCompleted} more days to go.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {workdaysCompleted >= 7 && workdaysCompleted <= 9 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Users className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-purple-900">Almost there! 💪</h4>
                      <p className="text-sm text-purple-700 mt-1">
                        Outstanding work! {workdaysCompleted} days logged. Just {10 - workdaysCompleted} more day{10 - workdaysCompleted > 1 ? 's' : ''} to complete your fortnight.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {workdaysCompleted >= 10 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-900">Fortnight Complete! 🎉</h4>
                      <p className="text-sm text-blue-700 mt-1">
                        Excellent! You've completed all 10 workdays ({savedHours} hours total). 
                        Your timesheet is ready for submission.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
          </Card>
        </div>
      </>
    );
  }

  return (
    <>

      
      <SuccessAnimation />
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
              disabled={updateTimesheetMutation.isPending}
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
              disabled={false}
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

        {/* Timesheet Table - Always show for staff, show for admin when employee selected */}
        {(() => {
          const shouldShow = (!isAdminView || selectedEmployee);
          console.log(`🏗️ TABLE RENDER: isAdminView=${isAdminView}, selectedEmployee=${selectedEmployee}, shouldShow=${shouldShow}`);
          console.log(`📊 FORTNIGHT DAYS: ${fortnightDays.length} days, Current fortnight:`, currentFortnight);
          if (shouldShow) {
            console.log(`✅ TABLE WILL RENDER - Weekend detection should start now`);
          } else {
            console.log(`❌ TABLE BLOCKED - Admin view requires employee selection`);
          }
          return shouldShow;
        })() && (
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
                        const dayOfWeek = day.getDay();
                        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // 0 = Sunday, 6 = Saturday
                        const isWeekendLocked = isWeekend && !isWeekendUnlocked(dateKey);
                        
                        // Force weekend detection first
                        console.log(`📅 PROCESSING DAY: ${format(day, 'EEE, MMM dd')} - Day: ${dayOfWeek}, Date: ${dateKey}`);
                        
                        // Check if this is actually a weekend (Saturday=6, Sunday=0)
                        if (dayOfWeek === 6) {
                          console.log(`🔵 SATURDAY DETECTED: ${format(day, 'EEE, MMM dd')} - Day ${dayOfWeek}`);
                        }
                        if (dayOfWeek === 0) {
                          console.log(`🔵 SUNDAY DETECTED: ${format(day, 'EEE, MMM dd')} - Day ${dayOfWeek}`);
                        }
                        
                        // Weekend detection with detailed logging
                        if (isWeekend) {
                          console.log(`🔴 WEEKEND CONFIRMED: ${format(day, 'EEE, MMM dd')} - Day: ${dayOfWeek} (${dayOfWeek === 0 ? 'Sunday' : 'Saturday'})`);
                          console.log(`🔐 LOCK CHECK: Unlocked=${isWeekendUnlocked(dateKey)}, Locked=${isWeekendLocked}`);
                          console.log(`🗂️ UNLOCKED SET:`, Array.from(unlockedWeekends));
                        }
                        const dayEntries = Array.isArray(timesheetData[dateKey]) ? timesheetData[dateKey] : [];
                        const existingEntries = Array.isArray(currentFortnightEntries) ? currentFortnightEntries.filter((entry: any) => 
                          format(parseISO(entry.date), 'yyyy-MM-dd') === dateKey
                        ) : [];
                        
                        // Smart entry display logic:
                        // 1. If there are approved entries, always show those (they're confirmed)
                        // 2. If there are saved but not approved entries, show those
                        // 3. If user is actively editing (has local entries), show those
                        // 4. Always show at least one empty row for new input
                        let entriesToShow;
                        const approvedEntries = existingEntries.filter((entry: any) => entry.approved);
                        const unapprovedEntries = existingEntries.filter((entry: any) => !entry.approved);
                        
                        // Weekend locking logic - if weekend is locked, only show approved entries or empty locked row
                        if (isWeekendLocked) {
                          // For locked weekends, only show approved entries or empty locked row
                          if (approvedEntries.length > 0) {
                            entriesToShow = approvedEntries; // Show only approved entries on locked weekends
                          } else {
                            entriesToShow = [{}]; // Show empty locked row for new weekends
                          }
                        } else if (approvedEntries.length > 0) {
                          // Always prioritize approved entries - they're confirmed and locked
                          entriesToShow = approvedEntries;
                        } else if (unapprovedEntries.length > 0) {
                          // Show saved but not approved entries
                          entriesToShow = unapprovedEntries;
                        } else if (dayEntries.length > 0) {
                          // User has local unsaved entries - show those
                          entriesToShow = dayEntries;
                        } else {
                          // No entries at all - show empty row for input
                          entriesToShow = [{}];
                        }
                        
                        return entriesToShow.map((entry: any, entryIndex: number) => {
                          if (isWeekend) {
                            console.log(`🎨 APPLYING WEEKEND STYLING: ${format(day, 'EEE, MMM dd')} - Classes: border-b weekend-row`);
                          }
                          return (
                          <tr key={`${dayIndex}-${entryIndex}`} className={`border-b ${isWeekend ? 'weekend-row bg-blue-600 text-white' : ''}`} style={isWeekend ? { backgroundColor: '#1e40af !important', color: 'white !important' } : {}}>
                            <td className="p-3">
                              {entryIndex === 0 && (
                                <div className={`font-medium ${isWeekend ? 'text-white' : ''} flex items-center justify-between`}>
                                  <div>
                                    {format(day, 'EEE, MMM dd')}
                                    {isWeekend && <span className="text-xs text-white ml-2 font-semibold">(Weekend)</span>}
                                  </div>
                                  {(() => {
                                    const shouldShowButton = isWeekend && !isWeekendUnlocked(dateKey);
                                    console.log(`🔧 UNLOCK BUTTON DEBUG: ${dateKey} - isWeekend=${isWeekend}, unlocked=${isWeekendUnlocked(dateKey)}, shouldShow=${shouldShowButton}, entryIndex=${entryIndex}`);
                                    return shouldShowButton;
                                  })() && (
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-6 w-6 p-0 text-white hover:bg-orange-600"
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
                                            className="bg-orange-500 hover:bg-orange-600"
                                          >
                                            Yes, I worked this weekend
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  )}
                                  {isWeekend && isWeekendUnlocked(dateKey) && (
                                    <div className="flex items-center text-xs text-white">
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
                                placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "0"}
                                value={entry?.hours || ''}
                                onChange={(e) => {
                                  if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                    console.log(`🚫 WEEKEND INPUT BLOCKED: ${dateKey} - Weekend is locked!`);
                                    return; // Prevent any input on locked weekends
                                  }
                                  // Don't auto-save custom addresses - let user save manually
                                  const isCustomAddress = entry?.jobId === 'custom-address' || 
                                                         (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:'));
                                  
                                  if (entry?.id && !entry?.approved && !isCustomAddress) {
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'hours', e.target.value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'hours', e.target.value);
                                  }
                                }}
                                className={`w-20 ${isWeekend ? 'text-white placeholder:text-blue-200 bg-blue-800 border-blue-600' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}
                                disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))} // Disable for approved entries or locked weekends
                                readOnly={isWeekend && !isWeekendUnlocked(dateKey)} // Make readonly for locked weekends
                              />
                            </td>
                            <td className="p-3">
                              <Select
                                value={
                                  (entry?.jobId === null && entry?.description && entry.description.startsWith('CUSTOM_ADDRESS:')) ? 'other-address' :
                                  (entry?.jobId && entry.jobId.startsWith('custom-address')) ? 'other-address' : 
                                  (entry?.jobId || 'no-job')
                                }
                                onValueChange={(value) => {
                                  if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                    console.log(`🚫 WEEKEND SELECT BLOCKED: ${dateKey} - Weekend is locked!`);
                                    return; // Prevent any selection on locked weekends
                                  }
                                  
                                  if (value === 'other-address') {
                                    // Check if this is already a custom address entry (either format)
                                    const isAlreadyCustom = (entry?.jobId === null && entry?.description && entry.description.startsWith('CUSTOM_ADDRESS:')) ||
                                                           (entry?.jobId && entry.jobId.startsWith('custom-address'));
                                    
                                    if (isAlreadyCustom) {
                                      // Don't open dialog, it's already a custom address
                                      return;
                                    }
                                    // Show address input dialog for new custom address
                                    console.log('🏠 OTHER ADDRESS SELECTED - Opening dialog for dayIndex:', dayIndex, 'entryIndex:', entryIndex);
                                    setShowAddressDialog(true);
                                    setAddressDialogData({dayIndex, entryIndex});
                                    return;
                                  }
                                  
                                  if (entry?.id && !entry?.approved) {
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'jobId', value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'jobId', value);
                                  }
                                }}
                                disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))} // Disable for approved entries or locked weekends
                              >
                                <SelectTrigger className={`min-w-40 ${isWeekend ? 'text-white border-blue-400 bg-blue-800' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}>
                                  <SelectValue placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "Select job"}>
                                    {entry?.jobId && (() => {
                                      const leaveTypes: { [key: string]: string } = {
                                        'sick-leave': 'Sick Leave',
                                        'personal-leave': 'Personal Leave', 
                                        'annual-leave': 'Annual Leave',
                                        'rdo': 'RDO (Rest Day Off)',
                                        'leave-without-pay': 'Leave without pay',
                                        'no-job': 'No job'
                                      };
                                      
                                      console.log('🔍 CHECKING ENTRY:', {jobId: entry.jobId, description: entry.description, isCustom: entry.jobId && entry.jobId.startsWith('custom-address')});
                                      
                                      if (leaveTypes[entry.jobId]) {
                                        return leaveTypes[entry.jobId];
                                      } else if (entry.jobId === null && entry.description && entry.description.startsWith('CUSTOM_ADDRESS:')) {
                                        const address = entry.description.replace('CUSTOM_ADDRESS: ', '');
                                        console.log('🏠 DISPLAY CUSTOM ADDRESS:', {description: entry.description, address});
                                        return address;
                                      } else if (entry.jobId && entry.jobId.startsWith('custom-address')) {
                                        const address = entry.materials || 'Custom Address';
                                        console.log('🏠 DISPLAY CUSTOM ADDRESS FALLBACK:', {jobId: entry.jobId, address});
                                        return address;
                                      } else {
                                        const job = Array.isArray(jobs) ? jobs.find((j: any) => j.id === entry.jobId) : null;
                                        return job?.jobAddress || job?.address || job?.jobName || job?.name || `Job ${entry.jobId}`;
                                      }
                                    })()}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {/* Regular Jobs First */}
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
                                  
                                  <SelectItem value="other-address">Other Address (Enter manually)</SelectItem>

                                  {/* Tafe and Leave Types at Bottom */}
                                  <Separator className="my-2" />
                                  <SelectItem value="tafe">Tafe</SelectItem>
                                  <SelectItem value="rdo">RDO (Rest Day Off)</SelectItem>
                                  <SelectItem value="sick-leave">Sick Leave</SelectItem>
                                  <SelectItem value="personal-leave">Personal Leave</SelectItem>
                                  <SelectItem value="annual-leave">Annual Leave</SelectItem>
                                  <SelectItem value="leave-without-pay">Leave without pay</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="p-3">
                              <Input
                                type="text"
                                placeholder={isWeekend && !isWeekendUnlocked(dateKey) ? "🔒 LOCKED" : "Materials or notes"}
                                value={entry?.materials || ''}
                                onChange={(e) => {
                                  if (isWeekend && !isWeekendUnlocked(dateKey)) {
                                    console.log(`🚫 WEEKEND MATERIALS INPUT BLOCKED: ${dateKey} - Weekend is locked!`);
                                    return; // Prevent any input on locked weekends
                                  }
                                  // Don't auto-save custom addresses - let user save manually
                                  const isCustomAddress = entry?.jobId === 'custom-address' || 
                                                         (entry?.description && entry?.description.startsWith('CUSTOM_ADDRESS:'));
                                  
                                  if (entry?.id && !entry?.approved && !isCustomAddress) {
                                    // Edit saved entry directly
                                    editSavedEntry(entry.id, 'materials', e.target.value);
                                  } else {
                                    // Handle unsaved entry
                                    handleCellChange(day, entryIndex, 'materials', e.target.value);
                                  }
                                }}
                                className={`min-w-32 ${isWeekend ? 'text-white placeholder:text-blue-200 bg-blue-800 border-blue-600' : ''} ${isWeekend && !isWeekendUnlocked(dateKey) ? 'cursor-not-allowed opacity-75' : ''}`}
                                disabled={entry?.approved || (isWeekend && !isWeekendUnlocked(dateKey))} // Disable for approved entries or locked weekends
                                readOnly={isWeekend && !isWeekendUnlocked(dateKey)} // Make readonly for locked weekends
                              />
                            </td>
                            <td className="p-3">
                              <div className="flex gap-2">
                                {entryIndex === 0 && !isFortnightConfirmed() && !(isWeekend && !isWeekendUnlocked(dateKey)) && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => addJobEntry(day)}
                                    data-testid={`button-add-entry-${dateKey}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                )}
                                {entryIndex > 0 && !isFortnightConfirmed() && !(isWeekend && !isWeekendUnlocked(dateKey)) && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => removeJobEntry(day, entryIndex)}
                                    data-testid={`button-remove-entry-${dateKey}-${entryIndex}`}
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
                          );
                        });
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
                        onClick={() => {
                          // Validate all weekdays are completed before confirming
                          const completionErrors = validateFortnightCompletion();
                          if (completionErrors.length > 0) {
                            toast({
                              title: "Incomplete Timesheet",
                              description: completionErrors[0],
                              variant: "destructive",
                            });
                            return;
                          }
                          
                          // Check for low hours warning
                          const totalHours = getTotalHours();
                          if (totalHours < 76) {

                            setLowHoursTotal(totalHours);
                            setPendingSubmission(() => () => confirmTimesheetMutation.mutate());
                            setShowLowHoursDialog(true);
                            return;
                          }

                          confirmTimesheetMutation.mutate();
                        }}
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
        
        {/* Address Input Dialog - Fixed positioning */}
        {showAddressDialog && (
          <div 
            data-testid="address-dialog"
            className="fixed inset-0 z-[9999] flex items-center justify-center"
            style={{
              position: 'fixed', 
              top: 0, 
              left: 0, 
              right: 0, 
              bottom: 0, 
              zIndex: 9999,
              backgroundColor: 'rgba(255, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)'
            }}
            onClick={(e) => {
              console.log('🏠 DIALOG BACKDROP CLICKED');
              e.stopPropagation();
            }}
          >
            <div 
              className="bg-yellow-400 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl border-4 border-red-500"
              style={{backgroundColor: 'yellow', border: '4px solid red'}}
              onClick={(e) => {
                console.log('🏠 DIALOG CONTENT CLICKED');
                e.stopPropagation();
              }}
            >
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-black">🏠 TEST DIALOG - Enter Job Address</h2>
                <p className="text-sm text-black mt-1">
                  Please provide the house number and street address for this job location.
                </p>
                <p className="text-xs text-black mt-2 font-bold">
                  If you can see this yellow dialog with red border, the dialog system works!
                </p>
              </div>
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
              <div className="flex gap-2 mt-6">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowAddressDialog(false);
                    setAddressDialogData({dayIndex: -1, entryIndex: -1});
                  }}
                  className="flex-1"
                >
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
                  const fullAddress = `${currentAddress.houseNumber} ${currentAddress.streetAddress}`;
                  // Custom address creation logging
                  console.log('🏠 CREATING CUSTOM ADDRESS:', fullAddress);
                  
                  // Store the address for job dropdown display
                  setCustomAddresses(prev => ({
                    ...prev,
                    'custom-address': { houseNumber: fullAddress, streetAddress: '' } // Store full address as houseNumber for simplicity
                  }));
                  
                  // Get the current day for the dialog
                  const day = fortnightDays[addressDialogData.dayIndex];
                  const entryIndex = addressDialogData.entryIndex;
                  
                  // Find the entry being edited
                  const dateKey = format(day, 'yyyy-MM-dd');
                  const dayEntries = Array.isArray(timesheetData[dateKey]) ? timesheetData[dateKey] : [];
                  const existingEntries = Array.isArray(currentFortnightEntries) ? currentFortnightEntries.filter((entry: any) => 
                    format(parseISO(entry.date), 'yyyy-MM-dd') === dateKey
                  ) : [];
                  
                  const approvedEntries = existingEntries.filter((entry: any) => entry.approved);
                  const unapprovedEntries = existingEntries.filter((entry: any) => !entry.approved);
                  
                  let entriesToShow;
                  if (approvedEntries.length > 0) {
                    entriesToShow = approvedEntries;
                  } else if (unapprovedEntries.length > 0) {
                    entriesToShow = unapprovedEntries;
                  } else if (dayEntries.length > 0) {
                    entriesToShow = dayEntries;
                  } else {
                    entriesToShow = [{}];
                  }
                  
                  const entry = entriesToShow[entryIndex];
                  // Setting custom address on entry
                  console.log('🏠 SETTING CUSTOM ADDRESS:', fullAddress);
                  
                  // Set the custom address as the job - but don't auto-save, let user save manually
                  handleCellChange(day, entryIndex, 'jobId', 'custom-address');
                  handleCellChange(day, entryIndex, 'materials', fullAddress);
                  handleCellChange(day, entryIndex, 'description', `CUSTOM_ADDRESS: ${fullAddress}`);
                  handleCellChange(day, entryIndex, 'hours', '');
                  
                  // If there was an existing saved entry, delete it so user can save fresh custom address entry
                  if (entry?.id && !entry?.approved) {
                    deleteTimesheetMutation.mutate(entry.id);
                  }
                  
                  toast({
                    title: "Address Added",
                    description: `Job address set to: ${fullAddress}`,
                  });
                  
                  // Close dialog
                  setShowAddressDialog(false);
                  setAddressDialogData({dayIndex: -1, entryIndex: -1});
                  setCurrentAddress({houseNumber: '', streetAddress: ''});
                }}
                disabled={!currentAddress.houseNumber.trim() || !currentAddress.streetAddress.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
              >
                Add Address
              </Button>
              </div>
            </div>
          </div>
        )}
        
        {/* Low Hours Warning Dialog */}
        <AlertDialog open={showLowHoursDialog} onOpenChange={setShowLowHoursDialog}>
          <AlertDialogContent className="max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
                <Clock className="h-5 w-5" />
                Low Hours Warning
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-700">
                <div className="space-y-3">
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600 mb-1">
                        {lowHoursTotal.toFixed(2)} hours
                      </div>
                      <div className="text-sm text-orange-700">
                        Current total for this fortnight
                      </div>
                    </div>
                  </div>
                  
                  <p className="text-center">
                    Your hours are below the expected 76 hours for a full fortnight. 
                    Are you sure you're ready to submit this timesheet?
                  </p>
                  
                  <div className="text-xs text-gray-500 text-center">
                    You can always add more hours and resubmit later if needed.
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-2">
              <AlertDialogCancel 
                onClick={() => {
                  setShowLowHoursDialog(false);
                  setPendingSubmission(null);
                }}
                className="flex-1"
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  setShowLowHoursDialog(false);
                  if (pendingSubmission) {
                    pendingSubmission();
                    setPendingSubmission(null);
                  }
                }}
                className="flex-1 bg-orange-600 hover:bg-orange-700"
              >
                Submit Anyway
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        
        </div>
      </div>
    </>
  );
}
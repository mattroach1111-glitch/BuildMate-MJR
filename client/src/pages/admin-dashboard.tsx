import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertJobSchema, insertEmployeeSchema, insertTimesheetEntrySchema } from "@shared/schema";
import { z } from "zod";
import JobSheetModal from "@/components/job-sheet-modal";
import StaffDashboard from "@/pages/staff-dashboard";
import { Plus, Users, Briefcase, Trash2, Folder, FolderOpen, ChevronRight, ChevronDown, MoreVertical, Clock, Calendar, CheckCircle, XCircle, Eye, FileText, Search, Filter, Palette, RotateCcw, Grid3X3, List } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Job, Employee, TimesheetEntry } from "@shared/schema";
import { format, parseISO, startOfWeek, endOfWeek, addDays } from "date-fns";
import PageLayout from "@/components/page-layout";

const jobFormSchema = insertJobSchema.extend({
  builderMargin: z.string()
    .min(1, "Builder margin is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Builder margin must be a valid number"),
  defaultHourlyRate: z.string()
    .min(1, "Default hourly rate is required")
    .refine((val) => !isNaN(Number(val)) && Number(val) > 0, "Default hourly rate must be a positive number"),
});

const employeeFormSchema = insertEmployeeSchema;

const adminTimesheetFormSchema = insertTimesheetEntrySchema.extend({
  hours: z.string().min(1, "Hours is required"),
  staffId: z.string().min(1, "Staff member is required"),
  date: z.string().min(1, "Date is required"),
}).omit({
  approved: true,
});

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isCreateJobOpen, setIsCreateJobOpen] = useState(false);
  const [isCreateEmployeeOpen, setIsCreateEmployeeOpen] = useState(false);
  const [isCreateTimesheetOpen, setIsCreateTimesheetOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  const { data: employees, isLoading: employeesLoading } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    retry: false,
  });

  if (isLoading) {
    return (
      <PageLayout user={user}>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-lg">Loading...</div>
        </div>
      </PageLayout>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PageLayout user={user}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        </div>

        <Tabs defaultValue="jobs" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="jobs" data-testid="tab-jobs">
              <Briefcase className="h-4 w-4 mr-2" />
              Jobs
            </TabsTrigger>
            <TabsTrigger value="employees" data-testid="tab-employees">
              <Users className="h-4 w-4 mr-2" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="timesheets" data-testid="tab-timesheets">
              <Clock className="h-4 w-4 mr-2" />
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="staff-view" data-testid="tab-staff-view">
              <Eye className="h-4 w-4 mr-2" />
              Staff View
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab */}
          <TabsContent value="jobs" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold">Job Management</h2>
              <Button data-testid="button-add-job">
                <Plus className="h-4 w-4 mr-2" />
                Add Job
              </Button>
            </div>

            {jobsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : jobs && jobs.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {jobs.map((job) => (
                  <Card key={job.id} className="cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader>
                      <CardTitle className="text-lg">{job.jobAddress}</CardTitle>
                      <p className="text-sm text-muted-foreground">{job.clientName}</p>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-2">PM: {job.projectName}</p>
                      <Badge>{job.status}</Badge>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No jobs found.
              </div>
            )}
          </TabsContent>

          {/* Employee Management Tab */}
          <TabsContent value="employees" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold">Employee Management</h2>
              <Button data-testid="button-add-employee">
                <Plus className="h-4 w-4 mr-2" />
                Add Employee
              </Button>
            </div>

            {employeesLoading ? (
              <div className="text-center py-8">Loading employees...</div>
            ) : employees && employees.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map((employee) => (
                  <Card key={employee.id}>
                    <CardHeader>
                      <CardTitle className="text-lg">{employee.name}</CardTitle>
                    </CardHeader>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                No employees found.
              </div>
            )}
          </TabsContent>

          {/* Timesheets Tab */}
          <TabsContent value="timesheets" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold">Timesheet Management</h2>
              <Button data-testid="button-add-timesheet">
                <Plus className="h-4 w-4 mr-2" />
                Add Timesheet Entry
              </Button>
            </div>
            <div className="text-center py-8 text-muted-foreground">
              Timesheet management coming soon.
            </div>
          </TabsContent>

          {/* Staff View Tab */}
          <TabsContent value="staff-view" className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h2 className="text-xl font-semibold">Staff View Preview</h2>
            </div>
            <StaffDashboard />
          </TabsContent>
        </Tabs>
      </div>
      
      {/* Job Sheet Modal */}
      {selectedJob && (
        <JobSheetModal
          jobId={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </PageLayout>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Crown, UserCheck, Shield, AlertTriangle, UserPlus, Link, Trash2, RefreshCw } from "lucide-react";
import type { User, Employee } from "@shared/schema";

export function UserManagement() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "staff">("staff");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Fetch all users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/users");
        const userData = await response.json(); // Convert Response to JSON
        console.log("User management API response:", userData);
        console.log("Is userData an array?", Array.isArray(userData));
        console.log("userData length:", userData?.length);
        
        // Ensure we have an array
        if (!Array.isArray(userData)) {
          console.warn("API response is not an array:", userData);
          return [];
        }
        
        return userData as User[];
      } catch (err: any) {
        console.error("User management API error:", err);
        if (err.message?.includes("Unauthorized") || err.status === 401 || err.status === 403) {
          throw new Error("Admin access required to manage users");
        }
        throw err;
      }
    },
    retry: false,
  });

  // Fetch all employees
  const { data: employees } = useQuery({
    queryKey: ["/api/employees"],
    retry: false,
  });

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "staff" }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      // Invalidate both user management and auth user queries
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      
      const promotedUser = users?.find(u => u.id === selectedUserId);
      const wasPromotedToAdmin = selectedRole === 'admin';
      
      const promotedUserName = [promotedUser?.firstName, promotedUser?.lastName].filter(Boolean).join(' ') 
        || promotedUser?.email 
        || 'User';
      
      toast({
        title: "Role Updated",
        description: wasPromotedToAdmin 
          ? `${promotedUserName} has been promoted to Admin. They should refresh their browser to see the admin dashboard.`
          : `${promotedUserName}'s role has been updated to Staff.`,
      });
      setSelectedUserId("");
      setSelectedRole("staff");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update user role.",
        variant: "destructive",
      });
    },
  });

  // Assign user to employee mutation
  const assignUserToEmployeeMutation = useMutation({
    mutationFn: async ({ userId, employeeId }: { userId: string; employeeId: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/assign-employee`, { employeeId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      
      const user = users?.find(u => u.id === selectedUserId);
      const employee = (employees as Employee[])?.find((e: Employee) => e.id === selectedEmployeeId);
      
      const userName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') 
        || user?.email 
        || 'User';
      
      toast({
        title: "Assignment Updated",
        description: `${userName} has been assigned to employee record: ${employee?.name}`,
      });
      setSelectedUserId("");
      setSelectedEmployeeId("");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to assign user to employee.",
        variant: "destructive",
      });
    },
  });

  const handleRoleUpdate = () => {
    if (selectedUserId && selectedRole) {
      updateRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
    }
  };

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      const deletedUser = users?.find(u => u.id === userId);
      
      const deletedUserName = [deletedUser?.firstName, deletedUser?.lastName].filter(Boolean).join(' ') 
        || deletedUser?.email 
        || 'User';
      
      toast({
        title: "User Deleted",
        description: `${deletedUserName} has been removed from the system`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  // Reset assignment mutation
  const resetAssignmentMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("PATCH", `/api/users/${userId}/reset-assignment`);
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      const resetUser = users?.find(u => u.id === userId);
      
      toast({
        title: "Assignment Reset",
        description: `${resetUser?.firstName} ${resetUser?.lastName} has been unlinked from their employee record`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Reset Failed",
        description: error.message || "Failed to reset user assignment",
        variant: "destructive",
      });
    },
  });

  // Clear employee timesheet mutation
  const clearTimesheetMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const response = await apiRequest("DELETE", `/api/admin/employee/${employeeId}/timesheets`);
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/timesheets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      toast({
        title: "Timesheet Cleared",
        description: data.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Clear Failed",
        description: error.message || "Failed to clear employee timesheet",
        variant: "destructive",
      });
    },
  });

  const handleUserEmployeeAssignment = () => {
    if (selectedUserId && selectedEmployeeId) {
      assignUserToEmployeeMutation.mutate({ userId: selectedUserId, employeeId: selectedEmployeeId });
    }
  };

  const getSelectedUser = () => {
    return users?.find(user => user.id === selectedUserId);
  };

  // Handle loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Handle error state (unauthorized or other errors)
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            User Management
          </CardTitle>
          <CardDescription>
            Promote staff members to admin or manage user roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
            <AlertTriangle className="h-12 w-12 text-muted-foreground" />
            <div>
              <h3 className="font-medium text-foreground">Access Restricted</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error instanceof Error ? error.message : "Only administrators can manage user roles"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          User Management
        </CardTitle>
        <CardDescription>
          Promote staff members to admin or manage user roles
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Users List */}
        <div>
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Current Users ({users?.length || 0})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {(() => {
              console.log("Rendering users:", users);
              console.log("Is users array?", Array.isArray(users));
              console.log("Users length:", users?.length);
              return Array.isArray(users) && users.length > 0;
            })() ? (
              users?.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  data-testid={`user-item-${user.id}`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown User'}
                      </span>
                      <Badge 
                        variant={user.role === 'admin' ? 'default' : 'secondary'}
                        className={user.role === 'admin' ? 'bg-amber-500 hover:bg-amber-600' : ''}
                      >
                        {user.role === 'admin' ? (
                          <>
                            <Crown className="h-3 w-3 mr-1" />
                            Admin
                          </>
                        ) : (
                          <>
                            <Shield className="h-3 w-3 mr-1" />
                            Staff
                          </>
                        )}
                      </Badge>
                      {user.employeeId && (
                        <Badge variant="outline" className="text-xs">
                          <Link className="h-3 w-3 mr-1" />
                          {(() => {
                            const employee = (employees as Employee[])?.find((e: Employee) => e.id === user.employeeId);
                            return employee ? `Linked to ${employee.name}` : 'Linked';
                          })()}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{user.email}</span>
                      {!user.employeeId && (
                        <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800">
                          Not Assigned
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Action buttons */}
                  <div className="flex items-center gap-2 ml-4">
                    {/* Clear Timesheet Button (only show if user has an employee assignment) */}
                    {user.employeeId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 border-blue-200"
                            data-testid={`button-clear-timesheet-${user.id}`}
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Clear Employee Timesheet</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to clear all timesheet entries for <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'this employee'}</strong>?
                              <br /><br />
                              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border-l-4 border-amber-400 mt-3">
                                <span className="text-amber-800 dark:text-amber-200 text-sm block">
                                  <strong>Note:</strong> This will permanently delete all their timesheet entries and reset labor hours in associated job sheets. 
                                  Use this when an employee encounters timesheet errors and needs a fresh start.
                                </span>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => clearTimesheetMutation.mutate(user.employeeId!)}
                              disabled={clearTimesheetMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              {clearTimesheetMutation.isPending ? "Clearing..." : "Clear Timesheet"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}

                    {/* Reset Assignment Button (only show if user has an assignment) */}
                    {user.employeeId && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                            data-testid={`button-reset-assignment-${user.id}`}
                          >
                            <Link className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset User Assignment</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to unlink <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'this user'}</strong> from their employee record?
                              <br /><br />
                              This will remove their connection to the employee record for testing purposes. They will need to be reassigned to track timesheets properly.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => resetAssignmentMutation.mutate(user.id)}
                              disabled={resetAssignmentMutation.isPending}
                              className="bg-orange-600 hover:bg-orange-700"
                            >
                              {resetAssignmentMutation.isPending ? "Resetting..." : "Reset Assignment"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                    
                    {/* Delete User Button (only show for staff users without timesheets) */}
                    {user.role === 'staff' && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to permanently delete <strong>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'this user'}</strong>?
                              <br /><br />
                              <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border-l-4 border-red-400 mt-3">
                                <span className="text-red-800 dark:text-red-200 text-sm block">
                                  <strong>Warning:</strong> This action cannot be undone. The user will be completely removed from the system.
                                  If they have timesheet entries, deletion will be prevented.
                                </span>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => deleteUserMutation.mutate(user.id)}
                              disabled={deleteUserMutation.isPending}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              {deleteUserMutation.isPending ? "Deleting..." : "Delete User"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">No users found</p>
              </div>
            )}
          </div>
        </div>

        {/* Role Change Section */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-3">Change User Role</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select User</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-user-to-promote">
                  <SelectValue placeholder="Choose a user to modify" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(users) && users.length > 0 ? (
                    users
                      .sort((a, b) => {
                        const nameA = [a.firstName, a.lastName].filter(Boolean).join(' ').trim() || a.email || 'Unknown User';
                        const nameB = [b.firstName, b.lastName].filter(Boolean).join(' ').trim() || b.email || 'Unknown User';
                        return nameA.localeCompare(nameB);
                      })
                      .map((user) => {
                      // Create a display name, falling back to email if no name is available
                      const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() 
                        || user.email 
                        || 'Unknown User';
                      
                      return (
                        <SelectItem key={user.id} value={user.id}>
                          <div className="flex items-center gap-2">
                            <span>{displayName}</span>
                            <Badge 
                              variant={user.role === 'admin' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {user.role}
                            </Badge>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="no-users" disabled>No users available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">New Role</label>
              <Select value={selectedRole} onValueChange={(value: "admin" | "staff") => setSelectedRole(value)}>
                <SelectTrigger data-testid="select-new-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Staff Member
                    </div>
                  </SelectItem>
                  <SelectItem value="admin">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4" />
                      Administrator
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && (
              <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Selected:</strong> {(() => {
                    const user = getSelectedUser();
                    return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Unknown User';
                  })()} 
                  <span className="mx-2">→</span>
                  Change from <strong>{getSelectedUser()?.role}</strong> to <strong>{selectedRole}</strong>
                </p>
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  disabled={!selectedUserId || getSelectedUser()?.role === selectedRole || updateRoleMutation.isPending}
                  className="w-full"
                  data-testid="button-update-role"
                >
                  {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Role Change</AlertDialogTitle>
                  <AlertDialogDescription>
                    <span>
                      Are you sure you want to change {(() => {
                        const user = getSelectedUser();
                        return [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'this user';
                      })()}'s role 
                      from <strong>{getSelectedUser()?.role}</strong> to <strong>{selectedRole}</strong>?
                    </span>
                    {selectedRole === 'admin' && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border-l-4 border-amber-400">
                        <span className="text-amber-800 dark:text-amber-200 text-sm block">
                          <strong>Note:</strong> Admin users will have full access to all system features including user management, 
                          job creation, timesheet approvals, and settings.
                        </span>
                      </div>
                    )}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRoleUpdate}>
                    Confirm Change
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* User-Employee Assignment Section */}
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-3 flex items-center gap-2">
            <Link className="h-4 w-4" />
            Assign Users to Employees
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            Link user accounts to employee records for proper timesheet tracking
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select User</label>
              <Select 
                value={selectedUserId} 
                onValueChange={(value) => {
                  setSelectedUserId(value);
                  // Reset employee selection when user changes
                  setSelectedEmployeeId("");
                }}
              >
                <SelectTrigger data-testid="select-user-for-assignment">
                  <SelectValue placeholder="Choose a user to assign" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(users) && users.length > 0 ? (
                    users
                      .sort((a, b) => {
                        const nameA = [a.firstName, a.lastName].filter(Boolean).join(' ') || a.email || 'Unknown User';
                        const nameB = [b.firstName, b.lastName].filter(Boolean).join(' ') || b.email || 'Unknown User';
                        return nameA.localeCompare(nameB);
                      })
                      .map((user) => (
                      <SelectItem key={`assign-${user.id}`} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{[user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Unknown User'}</span>
                          {user.employeeId ? (
                            <Badge variant="outline" className="text-xs">
                              Already Assigned
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-users" disabled>No users available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Assign to Employee</label>
              <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                <SelectTrigger data-testid="select-employee-for-assignment">
                  <SelectValue placeholder="Choose an employee record" />
                </SelectTrigger>
                <SelectContent>
                  {Array.isArray(employees) && employees.length > 0 ? (
                    employees
                      .sort((a: Employee, b: Employee) => a.name.localeCompare(b.name))
                      .map((employee: Employee) => (
                      <SelectItem key={employee.id} value={employee.id}>
                        <div className="flex items-center gap-2">
                          <UserPlus className="h-4 w-4" />
                          <span>{employee.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-employees" disabled>No employees available</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {selectedUserId && selectedEmployeeId && (
              <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                <p className="text-sm text-green-800 dark:text-green-200">
                  <strong>Assignment:</strong> {getSelectedUser()?.firstName} {getSelectedUser()?.lastName} 
                  <span className="mx-2">→</span>
                  {(employees as Employee[])?.find((e: Employee) => e.id === selectedEmployeeId)?.name}
                </p>
              </div>
            )}

            <Button
              onClick={handleUserEmployeeAssignment}
              disabled={!selectedUserId || !selectedEmployeeId || assignUserToEmployeeMutation.isPending}
              className="w-full"
              data-testid="button-assign-user-employee"
            >
              {assignUserToEmployeeMutation.isPending ? "Assigning..." : "Assign User to Employee"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
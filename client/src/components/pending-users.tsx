import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, Clock, Users } from "lucide-react";
import type { User, Employee } from "@shared/schema";

export function PendingUsers() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");

  // Fetch unassigned users
  const { data: unassignedUsers, isLoading: usersLoading, error: usersError } = useQuery({
    queryKey: ["/api/unassigned-users"],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/unassigned-users");
        const userData = await response.json();
        console.log("Unassigned users API response:", userData);
        
        if (!Array.isArray(userData)) {
          console.warn("API response is not an array:", userData);
          return [];
        }
        
        return userData as User[];
      } catch (err: any) {
        console.error("Unassigned users API error:", err);
        if (err.message?.includes("Unauthorized") || err.status === 401 || err.status === 403) {
          throw new Error("Admin access required to manage pending users");
        }
        throw err;
      }
    },
    retry: false,
  });

  // Fetch employees for assignment
  const { data: employees, isLoading: employeesLoading } = useQuery({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/employees");
      const employeeData = await response.json();
      return employeeData as Employee[];
    },
  });

  // Fetch all users for the dropdown (both assigned and unassigned)
  const { data: allUsers, isLoading: allUsersLoading } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/users");
      const userData = await response.json();
      return userData as User[];
    },
  });

  // Assign user to employee mutation
  const assignUserMutation = useMutation({
    mutationFn: async ({ userId, employeeId }: { userId: string; employeeId: string }) => {
      return apiRequest("POST", "/api/assign-user-to-employee", { userId, employeeId });
    },
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/unassigned-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      const assignedUser = unassignedUsers?.find(u => u.id === selectedUserId);
      const assignedEmployee = employees?.find(e => e.id === selectedEmployeeId);
      
      toast({
        title: "User Assigned Successfully",
        description: `${assignedUser?.firstName || assignedUser?.email} has been assigned to employee ${assignedEmployee?.name}. They can now access timesheets.`,
      });
      setSelectedUserId("");
      setSelectedEmployeeId("");
    },
    onError: (error: any) => {
      toast({
        title: "Assignment Failed",
        description: error.message || "Failed to assign user to employee.",
        variant: "destructive",
      });
    },
  });

  const handleAssignUser = () => {
    if (!selectedUserId || !selectedEmployeeId) {
      toast({
        title: "Selection Required",
        description: "Please select both a user and an employee for assignment.",
        variant: "destructive",
      });
      return;
    }

    assignUserMutation.mutate({ 
      userId: selectedUserId, 
      employeeId: selectedEmployeeId 
    });
  };

  if (usersLoading || employeesLoading || allUsersLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending User Assignments
          </CardTitle>
          <CardDescription>Loading pending users...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  if (usersError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending User Assignments
          </CardTitle>
          <CardDescription>Error loading pending users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-red-600">
            {usersError.message || "Failed to load pending users"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Pending User Assignments
        </CardTitle>
        <CardDescription>
          Users who have logged in but haven't been assigned to employee records yet. Assignment is required to access timesheets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {!unassignedUsers || unassignedUsers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">No pending user assignments</p>
            <p className="text-sm text-gray-500 mt-2">
              All users have been assigned to employees
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              {unassignedUsers.map((user) => (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    selectedUserId === user.id 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                      <Users className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {user.firstName && user.lastName 
                          ? `${user.firstName} ${user.lastName}`
                          : user.firstName || user.email || "Unknown User"
                        }
                      </p>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary">Pending Assignment</Badge>
                        <Badge variant={user.role === 'admin' ? 'default' : 'outline'}>
                          {user.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant={selectedUserId === user.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedUserId(user.id)}
                    data-testid={`button-select-user-${user.id}`}
                  >
                    {selectedUserId === user.id ? "Selected" : "Select"}
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-t pt-6">
              <h3 className="font-medium mb-4">Assign Selected User</h3>
              <div className="grid gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Match to Employee:
                  </label>
                  <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose employee to match..." />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b">Existing Employees</div>
                      {employees?.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                      <div className="px-3 py-2 text-xs font-medium text-gray-500 border-b border-t mt-1">All Users (for reference)</div>
                      {allUsers?.map((user) => (
                        <SelectItem key={`user-${user.id}`} value={user.id} disabled>
                          {user.firstName && user.lastName 
                            ? `${user.firstName} ${user.lastName}` 
                            : user.firstName || user.email} 
                          {user.isAssigned ? " (already assigned)" : " (available)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    Select an employee record to link this user account to
                  </p>
                </div>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      disabled={!selectedUserId || !selectedEmployeeId || assignUserMutation.isPending}
                      className="w-full"
                      data-testid="button-assign-user"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      {assignUserMutation.isPending ? "Assigning..." : "Assign User to Employee"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm User Assignment</AlertDialogTitle>
                      <AlertDialogDescription>
                        <span className="block">
                          Are you sure you want to assign{" "}
                          <strong>
                            {unassignedUsers?.find(u => u.id === selectedUserId)?.firstName ||
                             unassignedUsers?.find(u => u.id === selectedUserId)?.email}
                          </strong>{" "}
                          to employee{" "}
                          <strong>
                            {employees?.find(e => e.id === selectedEmployeeId)?.name}
                          </strong>?
                        </span>
                        <span className="block mt-4">
                          This will allow the user to access timesheets and be linked to the employee record.
                        </span>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAssignUser}>
                        Confirm Assignment
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Users, Crown, UserCheck, Shield, AlertTriangle } from "lucide-react";
import type { User } from "@shared/schema";

export function UserManagement() {
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<"admin" | "staff">("staff");

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

  // Update user role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "staff" }) => {
      return apiRequest("PATCH", `/api/users/${userId}/role`, { role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Role Updated",
        description: "User role has been successfully updated.",
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

  const handleRoleUpdate = () => {
    if (selectedUserId && selectedRole) {
      updateRoleMutation.mutate({ userId: selectedUserId, role: selectedRole });
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
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {user.firstName} {user.lastName}
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
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
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
                    users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <span>{user.firstName} {user.lastName}</span>
                          <Badge 
                            variant={user.role === 'admin' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {user.role}
                          </Badge>
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
                  <strong>Selected:</strong> {getSelectedUser()?.firstName} {getSelectedUser()?.lastName} 
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
                    Are you sure you want to change {getSelectedUser()?.firstName} {getSelectedUser()?.lastName}'s role 
                    from <strong>{getSelectedUser()?.role}</strong> to <strong>{selectedRole}</strong>?
                    {selectedRole === 'admin' && (
                      <div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950/20 rounded border-l-4 border-amber-400">
                        <p className="text-amber-800 dark:text-amber-200 text-sm">
                          <strong>Note:</strong> Admin users will have full access to all system features including user management, 
                          job creation, timesheet approvals, and settings.
                        </p>
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
      </CardContent>
    </Card>
  );
}
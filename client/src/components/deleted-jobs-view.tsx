import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FolderX, AlertTriangle, RotateCcw } from "lucide-react";
import type { Job } from "@shared/schema";

export function DeletedJobsView() {
  const { toast } = useToast();

  // Fetch deleted jobs
  const { data: deletedJobs, isLoading, error } = useQuery<Job[]>({
    queryKey: ["/api/deleted-jobs"],
    retry: false,
  });

  console.log("DeletedJobsView render:", { deletedJobs, isLoading, error });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("/api/deleted-jobs/bulk-delete", {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "All deleted jobs have been permanently removed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete jobs permanently.",
        variant: "destructive",
      });
    },
  });

  // Individual delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return apiRequest(`/api/deleted-jobs/${jobId}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      toast({
        title: "Success", 
        description: "Job permanently deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job permanently.",
        variant: "destructive",
      });
    },
  });

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <RotateCcw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">Loading deleted jobs...</p>
      </div>
    );
  }

  // Show error state if API call failed
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FolderX className="h-16 w-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">Error Loading Deleted Jobs</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          There was an error loading deleted jobs. The deleted jobs feature may need to be updated.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Error: {error?.message || 'Unknown error'}
        </p>
      </div>
    );
  }

  if (!deletedJobs || deletedJobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <FolderX className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No Deleted Jobs</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          There are no deleted jobs to clean up. All jobs are now permanently deleted with PDF backups automatically saved to Google Drive.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Deleted Jobs Cleanup</h3>
          <p className="text-sm text-muted-foreground">
            {deletedJobs.length} job{deletedJobs.length !== 1 ? 's' : ''} in deleted folder
          </p>
        </div>
        
        {deletedJobs.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All ({deletedJobs.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Permanently Delete All Jobs?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {deletedJobs.length} job{deletedJobs.length !== 1 ? 's' : ''} from the deleted folder. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => bulkDeleteMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={bulkDeleteMutation.isPending}
                >
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {deletedJobs.map((job) => (
          <Card key={job.id} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-base line-clamp-2">{job.jobName}</CardTitle>
                  <CardDescription className="text-xs">
                    Client: {job.clientName}
                  </CardDescription>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive hover:text-destructive-foreground">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-destructive" />
                        Permanently Delete Job?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{job.jobName}" for {job.clientName}. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(job.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending ? "Deleting..." : "Delete Permanently"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>Address: {job.address}</div>
                <div>Builder Margin: {job.builderMargin}%</div>
                <div>Status: {job.status}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
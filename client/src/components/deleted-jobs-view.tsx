import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Trash2, FolderX, AlertTriangle } from "lucide-react";
import type { Job } from "@shared/schema";

export function DeletedJobsView() {
  const { toast } = useToast();

  // Fetch deleted jobs
  const { data: deletedJobs, isLoading } = useQuery<Job[]>({
    queryKey: ["/api/deleted-jobs"],
    retry: false,
  });

  // Delete individual job permanently
  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      return await apiRequest("DELETE", `/api/deleted-jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      toast({
        title: "Success",
        description: "Job permanently deleted",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  // Bulk delete all jobs
  const bulkDeleteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/deleted-jobs");
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      toast({
        title: "Success",
        description: data.message || "All deleted jobs have been permanently removed",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to bulk delete jobs",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="text-sm text-muted-foreground mt-2">Loading deleted jobs...</p>
        </div>
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
                  disabled={bulkDeleteMutation.isPending}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <div className="grid gap-4">
        {deletedJobs.map((job) => (
          <Card key={job.id} className="border-l-4 border-l-orange-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-medium">{job.jobAddress}</CardTitle>
                  <CardDescription className="text-xs">
                    {job.clientName} • {job.projectName}
                  </CardDescription>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Permanently Delete Job?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete "{job.jobAddress}" and all associated data. 
                        This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteJobMutation.mutate(job.id)}
                        disabled={deleteJobMutation.isPending}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteJobMutation.isPending ? "Deleting..." : "Delete"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground">
                Status: {job.status} • Created: {job.createdAt ? new Date(job.createdAt).toLocaleDateString() : 'Unknown'}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
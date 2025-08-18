import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Download, 
  Upload, 
  Database, 
  Shield, 
  Clock, 
  FileText, 
  Cloud,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  HardDrive
} from "lucide-react";

interface BackupStatus {
  lastFullBackup: string | null;
  lastIncrementalBackup: string | null;
  totalBackups: number;
  backupHealth: "healthy" | "warning" | "error";
}

interface BackupResult {
  timestamp: string;
  totalRecords: number;
  size: string;
}

interface GoogleDriveBackup {
  id: string;
  name: string;
  size: string;
  createdTime: string;
  modifiedTime: string;
}

export function BackupManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);

  // Fetch backup status
  const { data: backupStatus, isLoading: statusLoading } = useQuery<BackupStatus>({
    queryKey: ["/api/backup/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch Google Drive backups
  const { data: driveBackups, isLoading: driveLoading } = useQuery<GoogleDriveBackup[]>({
    queryKey: ["/api/backup/google-drive/list"],
    retry: false,
  });

  // Create local backup mutation
  const createBackupMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/create"),
    onSuccess: (data: { message: string; backup: BackupResult }) => {
      toast({
        title: "Backup Created",
        description: `${data.backup.totalRecords} records backed up (${data.backup.size})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/status"] });
    },
    onError: (error: any) => {
      toast({
        title: "Backup Failed",
        description: error.message || "Failed to create backup",
        variant: "destructive",
      });
    },
  });

  // Upload to Google Drive mutation
  const uploadToGoogleDriveMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/backup/google-drive"),
    onSuccess: (data: { message: string; backup: BackupResult; fileId: string }) => {
      toast({
        title: "Google Drive Backup",
        description: `Backup uploaded successfully (${data.backup.size})`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/backup/google-drive/list"] });
    },
    onError: (error: any) => {
      toast({
        title: "Google Drive Upload Failed",
        description: error.message || "Failed to upload to Google Drive",
        variant: "destructive",
      });
    },
  });

  // Export SQL mutation
  const exportSqlMutation = useMutation({
    mutationFn: () => {
      window.open("/api/backup/export-sql", "_blank");
      return Promise.resolve();
    },
    onSuccess: () => {
      toast({
        title: "SQL Export Started",
        description: "Database export download should begin shortly",
      });
    },
  });

  const getHealthIcon = (health: string) => {
    switch (health) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (sizeString: string) => {
    const bytes = parseInt(sizeString);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6" data-testid="backup-management">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Protection</h1>
          <p className="text-muted-foreground">
            Manage backups and protect your construction data
          </p>
        </div>
        <Dialog open={isBackupDialogOpen} onOpenChange={setIsBackupDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-backup">
              <Shield className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Data Backup</DialogTitle>
              <DialogDescription>
                Choose your backup method to protect your BuildFlow Pro data
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 gap-4 py-4">
              <Button
                onClick={() => {
                  createBackupMutation.mutate();
                  setIsBackupDialogOpen(false);
                }}
                disabled={createBackupMutation.isPending}
                className="justify-start h-auto py-4"
                data-testid="button-local-backup"
              >
                <HardDrive className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Local Backup</div>
                  <div className="text-sm text-muted-foreground">
                    Save backup file to server storage
                  </div>
                </div>
              </Button>
              
              <Button
                onClick={() => {
                  uploadToGoogleDriveMutation.mutate();
                  setIsBackupDialogOpen(false);
                }}
                disabled={uploadToGoogleDriveMutation.isPending}
                className="justify-start h-auto py-4"
                variant="outline"
                data-testid="button-googledrive-backup"
              >
                <Cloud className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">Google Drive Backup</div>
                  <div className="text-sm text-muted-foreground">
                    Create and upload to Google Drive
                  </div>
                </div>
              </Button>
              
              <Button
                onClick={() => {
                  exportSqlMutation.mutate();
                  setIsBackupDialogOpen(false);
                }}
                disabled={exportSqlMutation.isPending}
                variant="outline"
                className="justify-start h-auto py-4"
                data-testid="button-sql-export"
              >
                <FileText className="h-5 w-5 mr-3" />
                <div className="text-left">
                  <div className="font-medium">SQL Export</div>
                  <div className="text-sm text-muted-foreground">
                    Download database as SQL file
                  </div>
                </div>
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Backup Status Overview */}
      <Card data-testid="backup-status-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Backup Status
            {backupStatus && getHealthIcon(backupStatus.backupHealth)}
          </CardTitle>
          <CardDescription>
            Current backup health and recent activity
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading backup status...
            </div>
          ) : backupStatus ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Last Full Backup</div>
                <div className="text-sm text-muted-foreground" data-testid="text-last-full-backup">
                  {backupStatus.lastFullBackup 
                    ? formatDate(backupStatus.lastFullBackup)
                    : "No backups yet"
                  }
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Last Incremental</div>
                <div className="text-sm text-muted-foreground" data-testid="text-last-incremental-backup">
                  {backupStatus.lastIncrementalBackup 
                    ? formatDate(backupStatus.lastIncrementalBackup)
                    : "No incremental backups"
                  }
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">Total Backups</div>
                <div className="text-sm text-muted-foreground" data-testid="text-total-backups">
                  {backupStatus.totalBackups} files
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Backup status unavailable</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Drive Backups */}
      <Card data-testid="googledrive-backups-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Google Drive Backups
          </CardTitle>
          <CardDescription>
            Your cloud-stored backup files
          </CardDescription>
        </CardHeader>
        <CardContent>
          {driveLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Loading Google Drive backups...
            </div>
          ) : driveBackups && driveBackups.length > 0 ? (
            <div className="space-y-3">
              {driveBackups.slice(0, 5).map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                  data-testid={`backup-item-${backup.id}`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium text-sm">{backup.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(backup.createdTime)} • {formatFileSize(backup.size)}
                      </div>
                    </div>
                  </div>
                  <Badge variant="secondary">Cloud</Badge>
                </div>
              ))}
              {driveBackups.length > 5 && (
                <div className="text-sm text-muted-foreground text-center py-2">
                  And {driveBackups.length - 5} more backups...
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Cloud className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No Google Drive backups found</p>
              <p className="text-xs mt-2">Connect Google Drive and create your first backup</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <Card data-testid="quick-actions-card">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common backup and recovery operations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/backup/status"] })}
              data-testid="button-refresh-status"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Refresh Status</div>
                <div className="text-xs text-muted-foreground">Update backup information</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => exportSqlMutation.mutate()}
              disabled={exportSqlMutation.isPending}
              data-testid="button-quick-sql-export"
            >
              <Download className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Download SQL</div>
                <div className="text-xs text-muted-foreground">Export database file</div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="h-auto py-4 justify-start"
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/backup/google-drive/list"] })}
              data-testid="button-refresh-drive"
            >
              <Upload className="h-4 w-4 mr-2" />
              <div className="text-left">
                <div className="font-medium">Refresh Drive</div>
                <div className="text-xs text-muted-foreground">Check cloud backups</div>
              </div>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading States */}
      {(createBackupMutation.isPending || 
        uploadToGoogleDriveMutation.isPending || 
        exportSqlMutation.isPending) && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-blue-700">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <div>
                <div className="font-medium">
                  {createBackupMutation.isPending && "Creating local backup..."}
                  {uploadToGoogleDriveMutation.isPending && "Uploading to Google Drive..."}
                  {exportSqlMutation.isPending && "Preparing SQL export..."}
                </div>
                <div className="text-sm">This may take a few moments</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
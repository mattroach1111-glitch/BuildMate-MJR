import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FolderOpen, Archive } from "lucide-react";

export function DeletedJobsSimple() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Previous Completed Job Sheets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Deleted Jobs</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              When jobs are deleted, their PDFs are automatically saved to your Google Drive 
              in the "Saved Job sheets Pdfs" folder for safekeeping.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
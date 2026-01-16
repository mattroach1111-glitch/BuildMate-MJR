import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";

interface SwmsTemplate {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  originalName: string;
  objectPath: string;
  mimeType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface SwmsSigningModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobAddress: string;
  onSigningComplete: () => void;
}

export function SwmsSigningModal({
  open,
  onOpenChange,
  jobId,
  jobAddress,
  onSigningComplete
}: SwmsSigningModalProps) {
  const [signerName, setSignerName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [viewedTemplates, setViewedTemplates] = useState<Set<string>>(new Set());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: checkResult, isLoading: isChecking } = useQuery<{
    allSigned: boolean;
    unsignedTemplates: SwmsTemplate[];
    unsignedCount: number;
  }>({
    queryKey: ["/api/swms/check", jobId],
    enabled: open && !!jobId,
  });

  const signAllMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/swms/sign-all", {
        jobId,
        signerName,
        occupation,
        signatureData: null
      });
      return response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "SWMS Signed",
        description: `Successfully signed ${data.signedCount} SWMS document(s)`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/check", jobId] });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/my-signatures"] });
      onSigningComplete();
      onOpenChange(false);
      setSignerName("");
      setOccupation("");
      setAcknowledged(false);
      setViewedTemplates(new Set());
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sign SWMS documents",
        variant: "destructive",
      });
    },
  });

  const handleViewTemplate = (template: SwmsTemplate) => {
    window.open(`/api/swms/templates/${template.id}/file`, "_blank");
    setViewedTemplates(prev => new Set(Array.from(prev).concat(template.id)));
  };

  const allTemplatesViewed = checkResult?.unsignedTemplates?.every(
    t => viewedTemplates.has(t.id)
  ) ?? false;

  const canSign = signerName.trim() && occupation.trim() && acknowledged && allTemplatesViewed;

  const handleSign = () => {
    if (!canSign) return;
    signAllMutation.mutate();
  };

  if (isChecking) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Checking SWMS requirements...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // If all documents are already signed, auto-complete and close
  if (checkResult?.allSigned && open) {
    // Use setTimeout to avoid state updates during render
    setTimeout(() => {
      onSigningComplete();
      onOpenChange(false);
    }, 0);
    return null;
  }

  if (!checkResult) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Safe Work Method Statement Required
          </DialogTitle>
          <DialogDescription>
            Before you can log hours for <strong>{jobAddress}</strong>, you must review and sign the following SWMS documents.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
              <h4 className="font-medium text-amber-800 dark:text-amber-200 mb-2">
                Important Safety Information
              </h4>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                These Safe Work Method Statements (SWMS) outline the safety procedures for this job site. 
                Please read each document carefully before signing. Your signature confirms that you understand 
                and will follow these safety procedures.
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-medium">Documents to Review & Sign ({checkResult.unsignedCount})</h4>
              
              {checkResult.unsignedTemplates.map((template) => (
                <Card key={template.id} className={viewedTemplates.has(template.id) ? "border-green-300 bg-green-50 dark:bg-green-950/20" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <CardTitle className="text-base">{template.title}</CardTitle>
                      </div>
                      {viewedTemplates.has(template.id) && (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Viewed
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {template.description && (
                      <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                    )}
                    <Button
                      variant={viewedTemplates.has(template.id) ? "outline" : "default"}
                      size="sm"
                      onClick={() => handleViewTemplate(template)}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      {viewedTemplates.has(template.id) ? "View Again" : "View Document"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {!allTemplatesViewed && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Please view all documents before signing.
              </p>
            )}

            <div className="border-t pt-4 space-y-4">
              <h4 className="font-medium">Your Details</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="signerName">Full Name</Label>
                  <Input
                    id="signerName"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupation">Occupation</Label>
                  <Input
                    id="occupation"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    placeholder="e.g., Carpenter, Labourer"
                  />
                </div>
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="acknowledged"
                  checked={acknowledged}
                  onCheckedChange={(checked) => setAcknowledged(checked === true)}
                />
                <label
                  htmlFor="acknowledged"
                  className="text-sm leading-tight cursor-pointer"
                >
                  I have been given the opportunity to comment on the content of these SWMS documents. 
                  I have been instructed in the work activities stated and the controls to be adopted. 
                  I understand and agree to follow the safety procedures outlined.
                </label>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSign}
            disabled={!canSign || signAllMutation.isPending}
          >
            {signAllMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Signing...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Sign All Documents
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

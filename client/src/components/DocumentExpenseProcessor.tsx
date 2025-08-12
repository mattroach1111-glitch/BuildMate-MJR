import { useState, useEffect, useRef } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { EmailInboxInfo } from "./EmailInboxInfo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, Receipt, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UploadResult } from "@uppy/core";

interface DocumentExpenseProcessorProps {
  onSuccess?: () => void;
}

interface ProcessedExpense {
  vendor: string;
  amount: number;
  description: string;
  date: string;
  category: 'materials' | 'subtrades' | 'other_costs' | 'tip_fees';
  confidence: number;
}

interface PendingExpense extends ProcessedExpense {
  id: string;
  approved: boolean;
}

export function DocumentExpenseProcessor({ onSuccess }: DocumentExpenseProcessorProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedExpense, setLastProcessedExpense] = useState<ProcessedExpense | null>(null);
  const [pendingExpense, setPendingExpense] = useState<PendingExpense | null>(null);
  const [isAddingToJobSheet, setIsAddingToJobSheet] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use ref to capture current selectedJobId value in callbacks  
  const selectedJobIdRef = useRef(selectedJobId);
  
  // Update ref whenever selectedJobId changes
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
    console.log("🔵 Job selection changed:", selectedJobId);
  }, [selectedJobId]);

  // Fetch jobs for dropdown
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  });

  // Get upload URL mutation
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      console.log("🔵 Making API request to /api/documents/upload");
      const response = await apiRequest("POST", "/api/documents/upload");
      console.log("🔵 API response status:", response.status);
      const data = await response.json();
      console.log("🔵 API response data:", data);
      return data;
    },
    onError: (error: any) => {
      console.error("🔴 Upload URL mutation error:", error);
      toast({
        title: "Connection Error",
        description: "Failed to connect to upload service",
        variant: "destructive",
      });
    },
  });

  // Process document mutation (creates pending expense for review)
  const processDocumentMutation = useMutation({
    mutationFn: async ({ documentURL, jobId }: { documentURL: string; jobId: string }) => {
      const response = await apiRequest("POST", "/api/documents/process", { documentURL, jobId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log("🔵 Document processed successfully:", data);
      setLastProcessedExpense(data.expenseData);
      
      // Create pending expense for user review
      const pending: PendingExpense = {
        ...data.expenseData,
        id: crypto.randomUUID(),
        approved: false,
      };
      setPendingExpense(pending);
      
      toast({
        title: "Document processed successfully!",
        description: "Review the extracted information below",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: error.message || "Failed to process document",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsProcessing(false);
    },
  });

  // Add approved expense to job sheet
  const addToJobSheetMutation = useMutation({
    mutationFn: async (expenseData: ProcessedExpense) => {
      const response = await apiRequest("POST", "/api/documents/add-to-job", { 
        expenseData,
        jobId: selectedJobId 
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Added to job sheet!",
        description: `${pendingExpense?.vendor} - $${pendingExpense?.amount} added successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      setPendingExpense(null);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to add to job sheet",
        description: error.message || "Failed to add expense",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsAddingToJobSheet(false);
    },
  });

  // Helper functions for expense review
  const handleCategoryChange = (newCategory: 'materials' | 'subtrades' | 'other_costs' | 'tip_fees') => {
    if (pendingExpense) {
      setPendingExpense({
        ...pendingExpense,
        category: newCategory,
      });
    }
  };

  const handleApproveExpense = () => {
    if (pendingExpense && selectedJobId) {
      setIsAddingToJobSheet(true);
      addToJobSheetMutation.mutate(pendingExpense);
    }
  };

  const handleRejectExpense = () => {
    setPendingExpense(null);
    toast({
      title: "Expense discarded",
      description: "The extracted information has been discarded",
    });
  };

  const handleGetUploadParameters = async (file: any) => {
    try {
      console.log("🔵 UPLOAD DEBUG: Getting upload parameters for file:", file);
      const response: any = await getUploadUrlMutation.mutateAsync();
      console.log("🔵 UPLOAD DEBUG: Upload URL response:", response);
      
      if (!response.uploadURL) {
        console.error("🔴 UPLOAD ERROR: No upload URL received", response);
        throw new Error("No upload URL received");
      }
      
      return {
        method: "PUT" as const,
        url: response.uploadURL,
        fields: {},
        headers: {
          'Content-Type': file.type || 'application/octet-stream'
        }
      };
    } catch (error: any) {
      console.error("🔴 UPLOAD ERROR: Failed to get upload parameters:", error);
      toast({
        title: "Upload setup failed",
        description: error.message || "Failed to prepare upload",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log("🟢 UPLOAD COMPLETE:", result);
    console.log("🔵 Selected Job ID from state:", selectedJobId);
    console.log("🔵 Selected Job ID from ref:", selectedJobIdRef.current);
    
    const currentJobId = selectedJobIdRef.current;
    
    if (!currentJobId) {
      console.error("🔴 NO JOB SELECTED - State:", selectedJobId, "Ref:", selectedJobIdRef.current);
      toast({
        title: "Job required",
        description: "Please select a job to add the expense to.",
        variant: "destructive",
      });
      return;
    }

    if (!result.successful || result.successful.length === 0) {
      console.error("🔴 UPLOAD FAILED: No successful uploads", result);
      toast({
        title: "Upload failed",
        description: "No files were uploaded successfully.",
        variant: "destructive",
      });
      return;
    }

    console.log("🟢 PROCESSING FILES:", result.successful.length);
    setIsProcessing(true);
    
    for (const file of result.successful) {
      try {
        console.log("🟢 PROCESSING FILE:", file);
        console.log("🔵 Document URL:", file.uploadURL);
        console.log("🔵 Job ID:", currentJobId);
        
        await processDocumentMutation.mutateAsync({
          documentURL: file.uploadURL || "",
          jobId: currentJobId,
        });
      } catch (error) {
        console.error("🔴 PROCESSING ERROR:", error);
        toast({
          title: "Processing failed",
          description: "Failed to process the uploaded document",
          variant: "destructive",
        });
      }
    }
    
    setIsProcessing(false);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'materials': return 'Materials';
      case 'subtrades': return 'Sub-trades';
      case 'other_costs': return 'Other Costs';
      case 'tip_fees': return 'Tip Fees';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'materials': return 'bg-blue-100 text-blue-800';
      case 'subtrades': return 'bg-green-100 text-green-800';
      case 'other_costs': return 'bg-orange-100 text-orange-800';
      case 'tip_fees': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload Documents
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Processing
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="upload">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Document Expense Processor
              </CardTitle>
              <CardDescription>
                Upload bills, invoices, and receipts to automatically extract expense information and add to job sheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
        {/* Job Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Job</label>
          <Select value={selectedJobId} onValueChange={setSelectedJobId}>
            <SelectTrigger data-testid="select-job">
              <SelectValue placeholder="Choose a job to add expenses to" />
            </SelectTrigger>
            <SelectContent>
              {(jobs as any[]).map((job: any) => (
                <SelectItem key={job.id} value={job.id} data-testid={`job-option-${job.id}`}>
                  {job.jobAddress} - {job.clientName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Upload Area */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Upload Documents</label>
          <Alert className="border-green-200 bg-green-50">
            <AlertCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              <strong>PDF Support Enabled!</strong> Upload PDF invoices and bills directly. AI will automatically convert and analyze them for expense extraction.
            </AlertDescription>
          </Alert>
          <DocumentUploader
            maxNumberOfFiles={3}
            maxFileSize={26214400} // 25MB
            onGetUploadParameters={handleGetUploadParameters}
            onComplete={handleUploadComplete}
            buttonClassName="w-full h-16 border-2 border-dashed border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100"
          >
            <div className="flex flex-col items-center gap-2 text-gray-600">
              <Upload className="h-6 w-6" />
              <span className="text-sm">Upload Bills & Invoices</span>
              <span className="text-xs">PDF, JPG, PNG (max 25MB) • Drag & Drop!</span>
            </div>
          </DocumentUploader>
        </div>

        {/* Processing Status */}
        {isProcessing && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Processing document with AI to extract expense information...
            </AlertDescription>
          </Alert>
        )}

        {/* Pending Expense Review */}
        {pendingExpense && !isProcessing && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-orange-800">
                <AlertCircle className="h-4 w-4" />
                Review Extracted Information
              </CardTitle>
              <CardDescription className="text-orange-700">
                Please review and confirm the details before adding to job sheet
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Vendor:</strong> {pendingExpense.vendor}</div>
                <div><strong>Amount:</strong> ${pendingExpense.amount.toFixed(2)}</div>
                <div className="col-span-2"><strong>Description:</strong> {pendingExpense.description}</div>
                <div><strong>Date:</strong> {pendingExpense.date}</div>
                <div><strong>Confidence:</strong> {Math.round(pendingExpense.confidence * 100)}%</div>
              </div>
              
              {/* Category Selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-orange-800">Category</label>
                <Select 
                  value={pendingExpense.category} 
                  onValueChange={handleCategoryChange}
                >
                  <SelectTrigger className="border-orange-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="materials">Materials</SelectItem>
                    <SelectItem value="subtrades">Sub-trades</SelectItem>
                    <SelectItem value="other_costs">Other Costs</SelectItem>
                    <SelectItem value="tip_fees">Tip Fees</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleApproveExpense}
                  disabled={isAddingToJobSheet || !selectedJobId}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  data-testid="button-approve-expense"
                >
                  {isAddingToJobSheet ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding to Job Sheet...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Add to Job Sheet
                    </>
                  )}
                </Button>
                <Button 
                  onClick={handleRejectExpense}
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  data-testid="button-reject-expense"
                >
                  Discard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Supported formats: PDF, JPG, PNG, GIF, BMP, TIFF
          </div>
          <div>• AI will automatically categorize expenses as Materials, Sub-trades, Tip Fees, or Other Costs</div>
          <div>• Review and confirm extracted information before adding to job sheet</div>
          <div>• Change category if needed, then click "Add to Job Sheet" to approve</div>
        </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="email">
          <EmailInboxInfo />
        </TabsContent>
      </Tabs>
    </div>
  );
}
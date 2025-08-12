import { useState } from "react";
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
  category: 'materials' | 'subtrades' | 'other_costs';
  confidence: number;
}

export function DocumentExpenseProcessor({ onSuccess }: DocumentExpenseProcessorProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedExpense, setLastProcessedExpense] = useState<ProcessedExpense | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  // Process document mutation
  const processDocumentMutation = useMutation({
    mutationFn: async ({ documentURL, jobId }: { documentURL: string; jobId: string }) => {
      const response = await apiRequest("POST", "/api/documents/process", { documentURL, jobId });
      return await response.json();
    },
    onSuccess: (data: any) => {
      setLastProcessedExpense(data.expenseData);
      toast({
        title: "Document processed successfully!",
        description: `${data.message}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onSuccess?.();
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
    
    if (!selectedJobId) {
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
        await processDocumentMutation.mutateAsync({
          documentURL: file.uploadURL || "",
          jobId: selectedJobId,
        });
      } catch (error) {
        console.error("🔴 PROCESSING ERROR:", error);
      }
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'materials': return 'Materials';
      case 'subtrades': return 'Sub-trades';
      case 'other_costs': return 'Other Costs';
      default: return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'materials': return 'bg-blue-100 text-blue-800';
      case 'subtrades': return 'bg-green-100 text-green-800';
      case 'other_costs': return 'bg-orange-100 text-orange-800';
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

        {/* Test Button */}
        <div className="space-y-2">
          <Button 
            onClick={async () => {
              try {
                console.log("🔵 Testing upload URL generation...");
                const result = await getUploadUrlMutation.mutateAsync();
                console.log("🟢 Test successful:", result);
                toast({
                  title: "Test Successful",
                  description: "Upload URL generated successfully",
                });
              } catch (error: any) {
                console.error("🔴 Test failed:", error);
                toast({
                  title: "Test Failed",
                  description: error.message || "Failed to generate upload URL",
                  variant: "destructive",
                });
              }
            }}
            variant="outline"
            className="w-full"
          >
            Test Upload Connection
          </Button>
        </div>

        {/* Upload Area */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Upload Documents</label>
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
              <span className="text-xs">PDF, JPG, PNG (max 25MB)</span>
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

        {/* Last Processed Result */}
        {lastProcessedExpense && !isProcessing && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription>
              <div className="space-y-2">
                <div className="font-medium text-green-800">Document processed successfully!</div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><strong>Vendor:</strong> {lastProcessedExpense.vendor}</div>
                  <div><strong>Amount:</strong> ${lastProcessedExpense.amount.toFixed(2)}</div>
                  <div><strong>Description:</strong> {lastProcessedExpense.description}</div>
                  <div className="flex items-center gap-2">
                    <strong>Category:</strong>
                    <Badge className={getCategoryColor(lastProcessedExpense.category)}>
                      {getCategoryLabel(lastProcessedExpense.category)}
                    </Badge>
                  </div>
                  <div><strong>Date:</strong> {lastProcessedExpense.date}</div>
                  <div>
                    <strong>Confidence:</strong> {Math.round(lastProcessedExpense.confidence * 100)}%
                  </div>
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <div className="flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Supported formats: PDF, JPG, PNG, GIF, BMP, TIFF
          </div>
          <div>• AI will automatically categorize expenses as Materials, Sub-trades, or Other Costs</div>
          <div>• Extracted information will be added directly to the selected job sheet</div>
          <div>• Review and edit the added expenses in the job sheet if needed</div>
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
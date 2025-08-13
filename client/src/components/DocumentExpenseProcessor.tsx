import { useState, useEffect, useRef, useCallback } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { EmailInboxInfo } from "./EmailInboxInfo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
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

interface PendingJobCreation {
  documentURL: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  jobAddress: string;
  clientName: string;
  projectManager?: string;
}

export function DocumentExpenseProcessor({ onSuccess }: DocumentExpenseProcessorProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessedExpense, setLastProcessedExpense] = useState<ProcessedExpense | null>(null);
  const [pendingExpense, setPendingExpense] = useState<PendingExpense | null>(null);
  const [isAddingToJobSheet, setIsAddingToJobSheet] = useState(false);
  const [jobAddress, setJobAddress] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [projectManager, setProjectManager] = useState<string>("");
  const [lastUploadedFile, setLastUploadedFile] = useState<any>(null);
  const [pendingJobCreation, setPendingJobCreation] = useState<PendingJobCreation | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Use refs to capture current values in callbacks  
  const selectedJobIdRef = useRef(selectedJobId);
  const jobAddressRef = useRef(jobAddress);
  const clientNameRef = useRef(clientName);
  const projectManagerRef = useRef(projectManager);
  
  // Update refs whenever values change
  useEffect(() => {
    selectedJobIdRef.current = selectedJobId;
    console.log("🔵 Job selection changed:", selectedJobId);
  }, [selectedJobId]);
  
  useEffect(() => {
    jobAddressRef.current = jobAddress;
    console.log("🔵 Job address changed:", jobAddress);
  }, [jobAddress]);
  
  useEffect(() => {
    clientNameRef.current = clientName;
    console.log("🔵 Client name changed:", clientName);
  }, [clientName]);
  
  useEffect(() => {
    projectManagerRef.current = projectManager;
    console.log("🔵 Project manager changed:", projectManager);
  }, [projectManager]);

  // Fetch jobs for dropdown
  const { data: jobs = [] } = useQuery({
    queryKey: ["/api/jobs"],
  });

  // Get unique project managers from existing jobs  
  const projectManagers = jobs ? Array.from(new Set((jobs as any[]).map(job => job.projectManager || job.projectName).filter(Boolean))) : [];

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
    onSuccess: async (data: any) => {
      // Save the uploaded file as a job file attachment if we have one
      if (lastUploadedFile && selectedJobId) {
        try {
          await apiRequest("POST", "/api/job-files", {
            jobId: selectedJobId,
            fileName: lastUploadedFile.name || "document.pdf",
            originalName: lastUploadedFile.name || "document.pdf",
            fileSize: lastUploadedFile.size || 0,
            mimeType: lastUploadedFile.type || "application/pdf",
            objectPath: lastUploadedFile.uploadURL
          });
          console.log("✅ Saved document as job file attachment");

          // Automatically upload to Google Drive after saving to job
          try {
            await apiRequest("POST", "/api/documents/upload-to-drive", {
              documentURL: lastUploadedFile.uploadURL,
              fileName: lastUploadedFile.name,
              mimeType: lastUploadedFile.type,
              fileSize: lastUploadedFile.size,
              jobId: selectedJobId
            });
            console.log("✅ Automatically uploaded to Google Drive");
          } catch (driveError: any) {
            console.log("ℹ️ Google Drive upload not available:", driveError.message);
            // Show helpful message about Google Drive connection
            if (driveError.message?.includes('Google Drive not connected')) {
              toast({
                title: "Document Saved", 
                description: "Document saved to job. Connect Google Drive in Settings for clickable PDF links.",
              });
            }
          }

          setLastUploadedFile(null); // Clear after saving
        } catch (fileError) {
          console.error("Failed to save document as job file:", fileError);
          // Don't fail the entire process if file saving fails
        }
      }
      
      // Only show Google Drive success if it was actually uploaded
      const wasUploadedToDrive = lastUploadedFile && selectedJobId;
      toast({
        title: "Added to job sheet!",
        description: wasUploadedToDrive 
          ? `${pendingExpense?.vendor} - $${pendingExpense?.amount} added successfully`
          : `${pendingExpense?.vendor} - $${pendingExpense?.amount} added successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", selectedJobId, "files"] });
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

  // Create complete job from document
  const createJobFromDocumentMutation = useMutation({
    mutationFn: async (data: { documentURL: string; jobAddress: string; clientName: string; projectManager?: string }) => {
      const response = await apiRequest("POST", "/api/documents/create-job", { 
        documentURL: data.documentURL,
        jobAddress: data.jobAddress,
        clientName: data.clientName,
        projectManager: data.projectManager
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "New job created!",
        description: `${data.job.jobId} created with ${data.summary.laborEntries} labor entries, ${data.summary.materials} materials`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create job",
        description: error.message || "Something went wrong",
        variant: "destructive",
      });
    }
  });

  // Upload file to Google Drive after processing
  const uploadToGoogleDriveMutation = useMutation({
    mutationFn: async (data: { jobId: string; fileInfo: any }) => {
      const response = await apiRequest("POST", "/api/documents/upload-to-drive", {
        documentURL: data.fileInfo.uploadURL,
        fileName: data.fileInfo.name,
        mimeType: data.fileInfo.type,
        fileSize: data.fileInfo.size,
        jobId: data.jobId
      });
      return await response.json();
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Google Drive Success", 
        description: "Document uploaded to Google Drive and linked to job",
      });
    },
    onError: (error: any) => {
      console.error('Error uploading to Google Drive:', error);
      toast({
        title: "Google Drive Upload Failed",
        description: error.message?.includes('Google Drive not connected') 
          ? "Please connect your Google Drive account first"
          : "Failed to upload to Google Drive",
        variant: "destructive",
      });
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

  // Job creation approval functions
  const handleApproveJobCreation = async () => {
    if (!pendingJobCreation) return;

    try {
      const jobResponse = await createJobFromDocumentMutation.mutateAsync({
        documentURL: pendingJobCreation.documentURL,
        jobAddress: pendingJobCreation.jobAddress,
        clientName: pendingJobCreation.clientName,
        projectManager: pendingJobCreation.projectManager
      });
      
      // Save the uploaded file as a job file attachment
      if (jobResponse.job?.id && pendingJobCreation.documentURL) {
        try {
          await apiRequest("POST", "/api/job-files", {
            jobId: jobResponse.job.id,
            fileName: pendingJobCreation.fileName,
            originalName: pendingJobCreation.fileName,
            fileSize: pendingJobCreation.fileSize,
            mimeType: pendingJobCreation.fileType,
            objectPath: pendingJobCreation.documentURL
          });
          console.log("✅ Saved document as job file attachment");
        } catch (fileError) {
          console.error("Failed to save document as job file:", fileError);
          // Don't fail the entire process if file saving fails
        }
      }
      
      // Clear inputs and pending job after successful creation
      setJobAddress("");
      setClientName("");
      setProjectManager("");
      setPendingJobCreation(null);
      
      toast({
        title: "Job Created Successfully",
        description: `Created job for ${pendingJobCreation.jobAddress} (${pendingJobCreation.clientName}) with document attached`,
      });
    } catch (error) {
      console.error("Job creation error:", error);
      toast({
        title: "Job creation failed",
        description: "Failed to create job from document",
        variant: "destructive",
      });
    }
  };

  const handleRejectJobCreation = () => {
    setPendingJobCreation(null);
    toast({
      title: "Job creation cancelled",
      description: "The uploaded document has been discarded",
    });
  };

  const handleGetUploadParameters = useCallback(async (file: any) => {
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
  }, [getUploadUrlMutation, toast]);

  const handleUploadComplete = async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    console.log("🟢 UPLOAD COMPLETE:", result);
    console.log("🔵 Selected Job ID:", selectedJobIdRef.current);
    
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
        
        // Store the uploaded file info for later saving as job file
        setLastUploadedFile(file);
        
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

  const handleCreateJobUploadComplete = useCallback(async (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (!result.successful || result.successful.length === 0) {
      toast({
        title: "Upload failed",
        description: "No files were uploaded successfully.",
        variant: "destructive",
      });
      return;
    }

    // Use refs to get current values (fixes React closure issue)
    const currentJobAddress = jobAddressRef.current;
    const currentClientName = clientNameRef.current;
    const currentProjectManager = projectManagerRef.current;
    
    if (!currentJobAddress.trim() || !currentClientName.trim()) {
      toast({
        title: "Missing Information",
        description: "Please enter both job address and client name before uploading.",
        variant: "destructive",
      });
      return;
    }

    // Instead of immediately creating the job, set up pending job creation for approval
    const file = result.successful[0]; // Take first file for now
    setPendingJobCreation({
      documentURL: file.uploadURL || "",
      fileName: file.name || "document.pdf",
      fileSize: file.size || 0,
      fileType: file.type || "application/pdf",
      jobAddress: currentJobAddress.trim(),
      clientName: currentClientName.trim(),
      projectManager: currentProjectManager.trim() || undefined
    });

    toast({
      title: "Document Uploaded",
      description: "Review the job details below and click 'Create Job' to proceed.",
    });
  }, [toast]);

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
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Add Expenses
          </TabsTrigger>
          <TabsTrigger value="create-job" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Create New Job
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

        {/* Job Creation Approval Card */}
        {pendingJobCreation && (
          <Card className="border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-blue-800 flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Approve Job Creation
              </CardTitle>
              <CardDescription className="text-blue-600">
                Review the job details and click 'Create Job' to proceed with automatic processing
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 p-4 bg-white rounded-lg border">
                <div>
                  <div className="text-sm font-medium text-gray-600">Job Address</div>
                  <div className="text-lg font-semibold">{pendingJobCreation.jobAddress}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-600">Client Name</div>
                  <div className="text-lg font-semibold">{pendingJobCreation.clientName}</div>
                </div>
                {pendingJobCreation.projectManager && (
                  <div>
                    <div className="text-sm font-medium text-gray-600">Project Manager</div>
                    <div className="text-lg font-semibold">{pendingJobCreation.projectManager}</div>
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-gray-600">Document</div>
                  <div className="text-sm">{pendingJobCreation.fileName}</div>
                </div>
              </div>
              
              <div className="text-sm text-blue-700 bg-blue-100 p-3 rounded-lg">
                <div className="font-medium mb-1">What happens next:</div>
                <ul className="space-y-1 text-xs">
                  <li>• AI will analyze the document and extract all job data</li>
                  <li>• Creates labor entries, materials, sub-trades, and costs</li>
                  <li>• Document will be saved to the job and uploaded to Google Drive</li>
                  <li>• Includes automatic employee matching and consumables calculation</li>
                </ul>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleApproveJobCreation}
                  disabled={createJobFromDocumentMutation.isPending}
                  className="flex-1"
                  data-testid="button-approve-job-creation"
                >
                  {createJobFromDocumentMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating Job...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Create Job
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleRejectJobCreation}
                  disabled={createJobFromDocumentMutation.isPending}
                  data-testid="button-reject-job-creation"
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
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

              {/* Google Drive Upload Option */}
              {lastUploadedFile && selectedJobId && (
                <div className="pt-3 border-t border-orange-200">
                  <div className="flex items-center justify-between text-sm text-orange-800 mb-2">
                    <span>💡 Optional: Save to Google Drive</span>
                  </div>
                  <Button
                    onClick={() => uploadToGoogleDriveMutation.mutate({ 
                      jobId: selectedJobId, 
                      fileInfo: lastUploadedFile 
                    })}
                    disabled={uploadToGoogleDriveMutation.isPending}
                    variant="outline" 
                    size="sm"
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                    data-testid="button-upload-to-drive"
                  >
                    {uploadToGoogleDriveMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading to Drive...
                      </>
                    ) : (
                      <>
                        🔗 Upload to Google Drive
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-600 mt-1">
                    Creates clickable links in job sheet PDFs
                  </p>
                </div>
              )}
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
        
        <TabsContent value="create-job">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Create Job from Cost Sheet
              </CardTitle>
              <CardDescription>
                Upload complete job cost sheets (PDFs with labor, materials, and costs) to automatically create new jobs with all data
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Job Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Job Address</label>
                  <Input
                    value={jobAddress}
                    onChange={(e) => setJobAddress(e.target.value)}
                    placeholder="e.g. 21 Greenhill Dr"
                    data-testid="input-job-address"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Client Name</label>
                  <Input
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="e.g. John Smith"
                    data-testid="input-client-name"
                  />
                </div>
              </div>
              
              {/* Project Manager (Optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Manager <span className="text-gray-400">(Optional)</span></label>
                <Select 
                  value={projectManager || undefined} 
                  onValueChange={(value) => setProjectManager(value || "")}
                >
                  <SelectTrigger data-testid="select-project-manager">
                    <SelectValue placeholder="Select project manager (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectManagers.length > 0 ? (
                      projectManagers.map((manager) => (
                        <SelectItem key={manager} value={manager}>
                          {manager}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-managers" disabled>No managers available</SelectItem>
                    )}
                  </SelectContent>
                </Select>

              </div>

              {/* Upload Section */}
              <div className="space-y-4">
                {(!jobAddress.trim() || !clientName.trim()) && (
                  <Alert className="border-orange-200 bg-orange-50">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <AlertDescription className="text-orange-800">
                      Please fill in both job address and client name before uploading
                    </AlertDescription>
                  </Alert>
                )}
                
                <DocumentUploader
                  maxNumberOfFiles={1}
                  maxFileSize={10485760}
                  onGetUploadParameters={handleGetUploadParameters}
                  onComplete={handleCreateJobUploadComplete}
                  buttonClassName={`w-full h-12 border-2 border-dashed transition-colors ${
                    !jobAddress.trim() || !clientName.trim() 
                      ? 'border-gray-200 bg-gray-100 cursor-not-allowed' 
                      : 'border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50'
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <Upload className={`h-6 w-6 ${!jobAddress.trim() || !clientName.trim() ? 'text-gray-300' : 'text-gray-400'}`} />
                    <span className={`text-sm font-medium ${!jobAddress.trim() || !clientName.trim() ? 'text-gray-400' : 'text-gray-600'}`}>
                      Upload Job Cost Sheet
                    </span>
                    <span className="text-xs text-gray-500">PDF, JPG, PNG (Max 10MB)</span>
                  </div>
                </DocumentUploader>

                {createJobFromDocumentMutation.isPending && (
                  <Alert>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <AlertDescription>
                      Processing job cost sheet and creating complete job with all labor, materials, and costs...
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Instructions */}
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Perfect for migrating existing job data during initial setup
                </div>
                <div>• Upload complete job cost sheets with labor hours, materials list, and costs</div>
                <div>• AI will extract all labor entries, materials, tip fees, and other costs</div>
                <div>• Automatically creates new job with all extracted data and relationships</div>
                <div>• Includes automatic 6% consumables calculation and employee matching</div>
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
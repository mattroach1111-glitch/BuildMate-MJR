import { useState, useEffect, useRef, useCallback } from "react";
import { DocumentUploader } from "./DocumentUploader";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import { EmailInboxInfo } from "./EmailInboxInfo";
import { JobAddressSearch } from "./job-address-search";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, Receipt, Mail, Eye } from "lucide-react";
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
  const [jobAddress, setJobAddress] = useState<string>("");
  const [clientName, setClientName] = useState<string>("");
  const [projectManager, setProjectManager] = useState<string>("");
  const [isAddingNewProjectManager, setIsAddingNewProjectManager] = useState(false);
  const [newProjectManagerName, setNewProjectManagerName] = useState<string>("");
  const [lastUploadedFile, setLastUploadedFile] = useState<any>(null);
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    filename: string;
    mimeType?: string;
    fileSize?: number;
  } | null>(null);
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

  // Get unique project managers from existing jobs and sort alphabetically
  const projectManagers = jobs ? Array.from(new Set((jobs as any[]).map(job => job.projectManager || job.projectName).filter(Boolean))).sort() : [];

  // Upload directly to Google Drive mutation
  const uploadToGoogleDriveMutation = useMutation({
    mutationFn: async ({ file, jobId }: { file: File; jobId: string }) => {
      console.log("📤 Uploading directly to Google Drive:", file.name);
      
      // Create FormData with the file
      const formData = new FormData();
      formData.append('file', file);
      formData.append('jobId', jobId);
      formData.append('fileName', file.name);
      formData.append('mimeType', file.type);
      formData.append('fileSize', file.size.toString());
      
      const response = await fetch('/api/documents/upload-direct-to-drive', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }
      
      return await response.json();
    },
    onError: (error: any) => {
      console.error("🔴 Google Drive upload error:", error);
      toast({
        title: "Upload Error",
        description: error.message || "Failed to upload to Google Drive",
        variant: "destructive",
      });
    },
  });

  // Legacy fallback upload URL mutation (used only if Google Drive fails)
  const getUploadUrlMutation = useMutation({
    mutationFn: async () => {
      console.log("⚠️ Using fallback object storage upload");
      const response = await apiRequest("POST", "/api/documents/upload");
      const data = await response.json();
      return data;
    },
    onError: (error: any) => {
      console.error("🔴 Fallback upload error:", error);
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

  // Upload file to Google Drive after processing (legacy method)
  const uploadToGoogleDriveLegacyMutation = useMutation({
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



  const handleGetUploadParameters = useCallback(async (file: any) => {
    try {
      console.log("🔵 PRIORITY: Attempting Google Drive upload for file:", file.name);
      
      // First, try to upload directly to Google Drive if we have a job selected
      const currentJobId = selectedJobIdRef.current;
      if (currentJobId) {
        try {
          const driveResult = await uploadToGoogleDriveMutation.mutateAsync({
            file: file,
            jobId: currentJobId
          });
          
          console.log("✅ SUCCESS: Google Drive upload completed:", driveResult);
          
          // Return Google Drive link as the "uploadURL" for processing
          return {
            method: "COMPLETED" as const, // Special flag to indicate direct upload was successful
            url: driveResult.googleDriveLink,
            fields: {},
            headers: {},
            googleDriveInfo: driveResult
          };
        } catch (driveError: any) {
          console.log("⚠️ Google Drive upload failed, falling back to object storage:", driveError.message);
          
          // If Google Drive is not connected, show user-friendly message
          if (driveError.message?.includes('Google Drive not connected')) {
            toast({
              title: "Google Drive Not Connected",
              description: "Using temporary storage. Connect Google Drive in Settings for permanent storage.",
            });
          }
        }
      }
      
      // Fallback to object storage
      console.log("📦 FALLBACK: Using object storage for file:", file.name);
      const response: any = await getUploadUrlMutation.mutateAsync();
      
      if (!response.uploadURL) {
        throw new Error("No upload URL received from fallback storage");
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
      console.error("🔴 UPLOAD ERROR: All upload methods failed:", error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
      throw error;
    }
  }, [selectedJobIdRef, uploadToGoogleDriveMutation, getUploadUrlMutation, toast]);

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
        
        // Check if this was a direct Google Drive upload
        const uploadParams = (file as any).uploadParams;
        if (uploadParams?.method === "COMPLETED" && uploadParams.googleDriveInfo) {
          console.log("✅ File already uploaded to Google Drive:", uploadParams.googleDriveInfo);
          
          // File is already uploaded to Google Drive, now process for AI extraction
          const documentURL = uploadParams.googleDriveInfo.googleDriveLink;
          console.log("🔵 Google Drive Document URL:", documentURL);
          
          // Store file info
          setLastUploadedFile({
            ...file,
            uploadURL: documentURL,
            googleDriveInfo: uploadParams.googleDriveInfo
          });
          
          // Use Google Drive file for processing but we need object storage URL for AI
          // For now, skip AI processing for direct Google Drive uploads
          toast({
            title: "Document uploaded to Google Drive!",
            description: `${file.name} saved successfully. AI processing will be available soon.`,
          });
          
        } else {
          // Regular object storage upload - process with AI
          console.log("🔵 Object Storage Document URL:", file.uploadURL);
          
          setLastUploadedFile(file);
          
          await processDocumentMutation.mutateAsync({
            documentURL: file.uploadURL || "",
            jobId: currentJobId,
          });
        }
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

    let anyGoogleDriveUploaded = false;
    
    for (const file of result.successful) {
      try {
        const jobResponse = await createJobFromDocumentMutation.mutateAsync({
          documentURL: file.uploadURL || "",
          jobAddress: currentJobAddress.trim(),
          clientName: currentClientName.trim(),
          projectManager: currentProjectManager.trim() || undefined
        });
        
        // Save the uploaded file as a job file attachment
        if (jobResponse.job?.id && file.uploadURL) {
          try {
            await apiRequest("POST", "/api/job-files", {
              jobId: jobResponse.job.id,
              fileName: file.name || "document.pdf",
              originalName: file.name || "document.pdf",
              fileSize: file.size || 0,
              mimeType: file.type || "application/pdf",
              objectPath: file.uploadURL
            });
            console.log("✅ Saved document as job file attachment");
            
            // Upload to Google Drive if connected
            try {
              await uploadToGoogleDriveLegacyMutation.mutateAsync({
                jobId: jobResponse.job.id,
                fileInfo: file
              });
              console.log("✅ Uploaded document to Google Drive");
              anyGoogleDriveUploaded = true;
            } catch (driveError) {
              console.log("ℹ️ Google Drive upload skipped (not connected or failed):", driveError);
              // Don't fail the process if Google Drive upload fails
            }
          } catch (fileError) {
            console.error("Failed to save document as job file:", fileError);
            // Don't fail the entire process if file saving fails
          }
        }
        
        // Clear inputs after successful creation
        setJobAddress("");
        setClientName("");
        setProjectManager("");
        
        // Show different success message based on Google Drive status
        if (anyGoogleDriveUploaded) {
          toast({
            title: "Job Created Successfully",
            description: `Created job for ${currentJobAddress} (${currentClientName}) with document attached and saved to Google Drive`,
          });
        } else {
          toast({
            title: "Job Created Successfully",
            description: `Created job for ${currentJobAddress} (${currentClientName}) with document attached. Connect Google Drive in Settings for clickable links in PDF emails.`,
          });
        }
      } catch (error) {
        console.error("Job creation error:", error);
        toast({
          title: "Job creation failed",
          description: "Failed to create job from document",
          variant: "destructive",
        });
      }
    }
  }, [createJobFromDocumentMutation, toast]);

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
          <TabsTrigger value="upload" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <Upload className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Add Expenses</span>
            <span className="text-xs sm:hidden">Add</span>
          </TabsTrigger>
          <TabsTrigger value="create-job" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <FileText className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Create New Job</span>
            <span className="text-xs sm:hidden">Create</span>
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <Mail className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Email Processing</span>
            <span className="text-xs sm:hidden">Email</span>
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
          <JobAddressSearch
            value={selectedJobId}
            onValueChange={setSelectedJobId}
            jobs={jobs as any[]}
            placeholder="Search job address..."
          />
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
                {lastUploadedFile?.uploadURL && (
                  <Button 
                    onClick={() => setPreviewDoc({
                      url: lastUploadedFile.uploadURL,
                      filename: lastUploadedFile.name,
                      mimeType: lastUploadedFile.type,
                      fileSize: lastUploadedFile.size
                    })}
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    data-testid="button-preview-document"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Preview
                  </Button>
                )}
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
                    onClick={() => uploadToGoogleDriveLegacyMutation.mutate({ 
                      jobId: selectedJobId, 
                      fileInfo: lastUploadedFile 
                    })}
                    disabled={uploadToGoogleDriveLegacyMutation.isPending}
                    variant="outline" 
                    size="sm"
                    className="w-full border-blue-300 text-blue-700 hover:bg-blue-50"
                    data-testid="button-upload-to-drive"
                  >
                    {uploadToGoogleDriveLegacyMutation.isPending ? (
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
                {!isAddingNewProjectManager ? (
                  <Select
                    value={projectManager}
                    onValueChange={(value) => {
                      if (value === "add-new") {
                        setIsAddingNewProjectManager(true);
                        setNewProjectManagerName("");
                        setProjectManager("");
                      } else {
                        setProjectManager(value);
                      }
                    }}
                  >
                    <SelectTrigger data-testid="select-project-manager">
                      <SelectValue placeholder="Select or add project manager" />
                    </SelectTrigger>
                    <SelectContent>
                      {projectManagers.map((manager) => (
                        <SelectItem key={manager} value={manager}>
                          {manager}
                        </SelectItem>
                      ))}
                      <SelectItem value="add-new" className="text-blue-600">
                        + Add new project manager
                      </SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={newProjectManagerName}
                      onChange={(e) => setNewProjectManagerName(e.target.value)}
                      placeholder="Enter new project manager name"
                      data-testid="input-new-project-manager"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newProjectManagerName.trim()) {
                          setProjectManager(newProjectManagerName.trim());
                          setIsAddingNewProjectManager(false);
                          setNewProjectManagerName("");
                        }
                      }}
                    />
                    <Button
                      type="button"
                      onClick={() => {
                        if (newProjectManagerName.trim()) {
                          setProjectManager(newProjectManagerName.trim());
                          setIsAddingNewProjectManager(false);
                          setNewProjectManagerName("");
                        }
                      }}
                      disabled={!newProjectManagerName.trim()}
                      size="sm"
                      data-testid="button-save-project-manager"
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsAddingNewProjectManager(false);
                        setNewProjectManagerName("");
                      }}
                      size="sm"
                      data-testid="button-cancel-project-manager"
                    >
                      Cancel
                    </Button>
                  </div>
                )}
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
      
      {/* Document Preview Modal */}
      {previewDoc && (
        <DocumentPreviewModal
          isOpen={true}
          onClose={() => setPreviewDoc(null)}
          documentUrl={previewDoc.url}
          filename={previewDoc.filename}
          mimeType={previewDoc.mimeType}
          fileSize={previewDoc.fileSize}
        />
      )}
    </div>
  );
}
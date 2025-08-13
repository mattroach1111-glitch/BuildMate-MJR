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
import { Upload, CheckCircle, AlertCircle, Loader2, FileText, Receipt, Mail, Inbox, Building2, DollarSign } from "lucide-react";
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
  const [lastUploadedFile, setLastUploadedFile] = useState<any>(null);
  const [isProcessingJobSheet, setIsProcessingJobSheet] = useState(false);
  const [processedJobSheet, setProcessedJobSheet] = useState<any>(null);
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
  }, [selectedJobId]);
  
  useEffect(() => {
    jobAddressRef.current = jobAddress;
  }, [jobAddress]);
  
  useEffect(() => {
    clientNameRef.current = clientName;
  }, [clientName]);
  
  useEffect(() => {
    projectManagerRef.current = projectManager;
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
      const response = await apiRequest("POST", "/api/documents/upload");
      const data = await response.json();
      return data;
    },
    onError: (error: any) => {
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
        description: "Failed to extract data from document",
        variant: "destructive",
      });
    },
  });

  // Add expense to job sheet mutation
  const addToJobSheetMutation = useMutation({
    mutationFn: async ({ expense, jobId }: { expense: ProcessedExpense; jobId: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/add-expense`, expense);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      toast({
        title: "Added to job sheet!",
        description: "Expense has been added to the selected job",
      });
      setPendingExpense(null);
      setLastProcessedExpense(null);
      setIsAddingToJobSheet(false);
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error adding to job sheet",
        description: "Failed to add expense to job",
        variant: "destructive",
      });
      setIsAddingToJobSheet(false);
    },
  });

  // Handle file upload completion
  const handleUploadComplete = useCallback((result: UploadResult) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      setLastUploadedFile(uploadedFile);
      
      // Start processing automatically if a job is selected
      if (selectedJobIdRef.current) {
        setIsProcessing(true);
        processDocumentMutation.mutate({
          documentURL: uploadedFile.uploadURL,
          jobId: selectedJobIdRef.current
        });
      }
    }
  }, [processDocumentMutation]);

  // Process job sheet mutation
  const processJobSheetMutation = useMutation({
    mutationFn: async (documentURL: string) => {
      const response = await apiRequest("POST", "/api/job-sheets/process", { documentURL });
      return await response.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: "Job sheet processed successfully!",
        description: "Review the extracted job data below",
      });
      setProcessedJobSheet(data);
      setIsProcessingJobSheet(false);
    },
    onError: (error: any) => {
      toast({
        title: "Processing failed",
        description: "Failed to extract data from job sheet",
        variant: "destructive",
      });
      setIsProcessingJobSheet(false);
    },
  });

  // Handle job sheet upload (direct processing without job selection required)
  const handleJobSheetUpload = useCallback((result: UploadResult) => {
    if (result.successful && result.successful.length > 0) {
      const uploadedFile = result.successful[0];
      
      toast({
        title: "Job sheet uploaded successfully!",
        description: "Processing job sheet data...",
      });
      
      setIsProcessingJobSheet(true);
      setProcessedJobSheet(null);
      processJobSheetMutation.mutate(uploadedFile.uploadURL);
    }
  }, [toast, processJobSheetMutation]);

  const handleProcessDocument = () => {
    if (!lastUploadedFile || !selectedJobId) {
      toast({
        title: "Missing information",
        description: "Please select a job and upload a document first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    processDocumentMutation.mutate({
      documentURL: lastUploadedFile.uploadURL,
      jobId: selectedJobId
    });
  };

  const handleJobSelection = (jobId: string) => {
    setSelectedJobId(jobId);
    const selectedJob = jobs.find((job: any) => job.id === jobId);
    if (selectedJob) {
      setJobAddress(selectedJob.jobAddress || "");
      setClientName(selectedJob.clientName || "");
      setProjectManager(selectedJob.projectManager || "");
    }
  };

  const handleApproveExpense = () => {
    if (!pendingExpense || !selectedJobId) {
      toast({
        title: "Missing information",
        description: "Please select a job first",
        variant: "destructive",
      });
      return;
    }

    setIsAddingToJobSheet(true);
    addToJobSheetMutation.mutate({
      expense: pendingExpense,
      jobId: selectedJobId
    });
  };

  const handleRejectExpense = () => {
    setPendingExpense(null);
    setLastProcessedExpense(null);
    toast({
      title: "Expense rejected",
      description: "You can upload a new document to try again",
    });
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="jobsheet" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="jobsheet" className="flex items-center gap-2">
            <Receipt className="h-4 w-4" />
            Job Sheet Upload
          </TabsTrigger>
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Expense Documents
          </TabsTrigger>
          <TabsTrigger value="email" className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Processing
          </TabsTrigger>
        </TabsList>

        <TabsContent value="jobsheet" className="space-y-6">
          {/* Job Sheet Upload - Direct Upload without requiring job selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5 text-purple-600" />
                Job Sheet Upload
              </CardTitle>
              <CardDescription>
                Upload completed job sheets with labor, materials, and costs for AI processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploader 
                onComplete={handleJobSheetUpload}
                getUploadParameters={async () => {
                  const data = await getUploadUrlMutation.mutateAsync();
                  return {
                    method: "PUT" as const,
                    url: data.uploadURL,
                  };
                }}
              />
              
              {isProcessingJobSheet && !processedJobSheet && (
                <div className="mt-4 flex items-center gap-2 text-purple-600">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Processing job sheet with AI...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Job Sheet Review Card */}
          {processedJobSheet && (
            <Card className="border-purple-200 bg-purple-50 dark:bg-purple-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-purple-800 dark:text-purple-200">
                  <AlertCircle className="h-5 w-5" />
                  Review Extracted Job Sheet Data
                </CardTitle>
                <CardDescription className="text-purple-700 dark:text-purple-300">
                  Please review the job information extracted by AI and approve or reject
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-white dark:bg-gray-950 rounded-lg border">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Job Address</p>
                    <p className="text-sm text-muted-foreground">{processedJobSheet.jobAddress || "Not detected"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Client Name</p>
                    <p className="text-sm text-muted-foreground">{processedJobSheet.clientName || "Not detected"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Total Cost</p>
                    <p className="text-sm font-semibold">${processedJobSheet.totalCost?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>

                {processedJobSheet.laborEntries && processedJobSheet.laborEntries.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Labor Entries ({processedJobSheet.laborEntries.length})</p>
                    <div className="space-y-1">
                      {processedJobSheet.laborEntries.slice(0, 3).map((entry: any, index: number) => (
                        <div key={index} className="text-sm text-muted-foreground">
                          {entry.employeeName}: {entry.hoursWorked}h @ ${entry.hourlyRate}/hr = ${entry.totalCost?.toFixed(2)}
                        </div>
                      ))}
                      {processedJobSheet.laborEntries.length > 3 && (
                        <div className="text-sm text-muted-foreground">
                          ...and {processedJobSheet.laborEntries.length - 3} more entries
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Materials</p>
                    <p className="text-sm text-muted-foreground">${processedJobSheet.materialsCost?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Sub-trades</p>
                    <p className="text-sm text-muted-foreground">${processedJobSheet.subtradesCost?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Other Costs</p>
                    <p className="text-sm text-muted-foreground">${processedJobSheet.otherCosts?.toFixed(2) || "0.00"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">GST</p>
                    <p className="text-sm text-muted-foreground">${processedJobSheet.gst?.toFixed(2) || "0.00"}</p>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setProcessedJobSheet(null);
                      setIsProcessingJobSheet(false);
                      toast({
                        title: "Job sheet rejected",
                        description: "You can upload a new job sheet to try again",
                      });
                    }}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const response = await apiRequest("POST", "/api/job-sheets/create", {
                          documentURL: processedJobSheet.documentURL,
                          jobAddress: processedJobSheet.jobAddress,
                          clientName: processedJobSheet.clientName
                        });
                        
                        if (response.ok) {
                          toast({
                            title: "Job created successfully!",
                            description: "Job sheet has been processed and job created",
                          });
                          setProcessedJobSheet(null);
                          setIsProcessingJobSheet(false);
                          queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
                        } else {
                          throw new Error("Failed to create job");
                        }
                      } catch (error) {
                        toast({
                          title: "Failed to create job",
                          description: "Please try again or contact support",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    Approve & Create Job
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="expense" className="space-y-6">
          {/* Job Selection Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Job Selection
              </CardTitle>
              <CardDescription>
                Select which job this document expense should be added to
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="job-select" className="text-sm font-medium">
                  Select Job:
                </label>
                <Select value={selectedJobId} onValueChange={handleJobSelection}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {jobs.map((job: any) => (
                      <SelectItem key={job.id} value={job.id}>
                        {job.jobAddress} - {job.clientName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedJobId && (
                <div className="grid grid-cols-3 gap-4 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Job Address</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">{jobAddress}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Client</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">{clientName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Project Manager</p>
                    <p className="text-sm text-blue-600 dark:text-blue-300">{projectManager || "Not assigned"}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Document Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-green-600" />
                Document Upload
              </CardTitle>
              <CardDescription>
                Upload invoices, receipts, or other expense documents for AI processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DocumentUploader 
                onComplete={handleUploadComplete}
                getUploadParameters={async () => {
                  const data = await getUploadUrlMutation.mutateAsync();
                  return {
                    method: "PUT" as const,
                    url: data.uploadURL,
                  };
                }}
              />
              
              {lastUploadedFile && !selectedJobId && (
                <Alert className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select a job above before processing the uploaded document.
                  </AlertDescription>
                </Alert>
              )}

              {lastUploadedFile && selectedJobId && !pendingExpense && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    Document uploaded: {lastUploadedFile.name}
                  </div>
                  <Button 
                    onClick={handleProcessDocument}
                    disabled={isProcessing}
                    className="w-full"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing with AI...
                      </>
                    ) : (
                      <>
                        <Receipt className="mr-2 h-4 w-4" />
                        Process Document
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pending Expense Review Card */}
          {pendingExpense && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <AlertCircle className="h-5 w-5" />
                  Review Extracted Expense
                </CardTitle>
                <CardDescription className="text-orange-700 dark:text-orange-300">
                  Please review the information extracted by AI and approve or reject
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Building2 className="h-3 w-3" />
                      Vendor
                    </div>
                    <p className="text-sm">{pendingExpense.vendor}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </div>
                    <p className="text-sm font-semibold">${pendingExpense.amount.toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Category</p>
                    <Badge variant="outline">{pendingExpense.category}</Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Confidence</p>
                    <Badge variant={pendingExpense.confidence > 0.8 ? "default" : "secondary"}>
                      {Math.round(pendingExpense.confidence * 100)}%
                    </Badge>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <p className="text-sm font-medium">Description</p>
                  <p className="text-sm text-muted-foreground">{pendingExpense.description}</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={handleRejectExpense}
                    className="flex-1"
                  >
                    Reject
                  </Button>
                  <Button
                    onClick={handleApproveExpense}
                    disabled={isAddingToJobSheet}
                    className="flex-1"
                  >
                    {isAddingToJobSheet ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding to Job Sheet...
                      </>
                    ) : (
                      "Approve & Add to Job Sheet"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Inbox className="h-5 w-5 text-green-600" />
                Email Inbox Status
              </CardTitle>
              <CardDescription>
                Monitor automatic email processing from documents@mjrbuilders.com.au
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmailInboxInfo />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, FileText, DollarSign, Calendar, Building2, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import * as fuzzball from 'fuzzball';

interface ProcessedDocument {
  id: string;
  filename: string;
  vendor: string;
  amount: string | number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  email_subject?: string;
}

// Helper function to match job from email subject
function getJobFromSubject(emailSubject: string, jobs: any[]): string {
  if (!emailSubject || !jobs) return '';
  
  const subject = emailSubject.toLowerCase();
  let potentialMatches = [];
  
  for (const job of jobs) {
    // Exact substring match
    if (job.jobAddress && subject.includes(job.jobAddress.toLowerCase())) {
      return `${job.jobAddress} (${job.clientName || 'Unknown Client'})`;
    }
    
    // Perfect fuzzy match (98%+ similarity)
    if (job.jobAddress) {
      const similarity = fuzzball.ratio(subject.trim(), job.jobAddress.toLowerCase().trim());
      if (similarity >= 98) {
        return `${job.jobAddress} (${job.clientName || 'Unknown Client'})`;
      }
    }
    
    // Enhanced address pattern matching
    if (job.jobAddress) {
      const jobAddr = job.jobAddress.toLowerCase().trim();
      const jobMatch = jobAddr.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
      
      if (jobMatch) {
        const jobNumber = jobMatch[1];
        const jobStreet = jobMatch[2].toLowerCase().trim();
        
        // Full address match
        const subjectFullMatch = subject.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
        if (subjectFullMatch) {
          const subjectNumber = subjectFullMatch[1];
          const subjectStreet = subjectFullMatch[2].toLowerCase().trim();
          
          if (subjectNumber === jobNumber && 
              (subjectStreet === jobStreet || fuzzball.ratio(subjectStreet, jobStreet) >= 90)) {
            potentialMatches.push({ job, priority: 1, type: 'exact_address' });
          }
        } else {
          // Partial address match
          const subjectPartialMatch = subject.match(/(\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i);
          if (subjectPartialMatch) {
            const subjectNumber = subjectPartialMatch[1];
            const subjectStreet = subjectPartialMatch[2].toLowerCase().trim();
            
            if (subjectNumber === jobNumber && 
                (subjectStreet === jobStreet || fuzzball.ratio(subjectStreet, jobStreet) >= 90)) {
              potentialMatches.push({ job, priority: 2, type: 'partial_address' });
            }
          }
        }
      }
    }
    
    // Client name match
    if (job.clientName && subject.includes(job.clientName.toLowerCase())) {
      potentialMatches.push({ job, priority: 4, type: 'client' });
    }
    
    // Project manager match
    if (job.projectManager && subject.includes(job.projectManager.toLowerCase())) {
      potentialMatches.push({ job, priority: 5, type: 'pm' });
    }
  }
  
  if (potentialMatches.length > 0) {
    potentialMatches.sort((a, b) => a.priority - b.priority);
    const bestMatch = potentialMatches[0];
    return `${bestMatch.job.jobAddress} (${bestMatch.job.clientName || 'Unknown Client'})`;
  }
  
  return '';
}

export function EmailProcessingReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [selectedCategories, setSelectedCategories] = useState<Record<string, string>>({});

  // Fetch pending documents
  const { data: pendingDocuments = [], isLoading } = useQuery({
    queryKey: ['/api/email-processing/pending'],
    refetchInterval: 5000,
  });

  // Fetch jobs for matching
  const { data: jobs = [] } = useQuery({
    queryKey: ['/api/jobs'],
  });

  const approveMutation = useMutation({
    mutationFn: async ({ documentId, jobId, category }: { documentId: string; jobId?: string; category?: string }) => {
      const response = await apiRequest('POST', `/api/email-processing/approve/${documentId}`, {
        jobId: jobId || undefined,
        category: category || undefined
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
      toast({
        title: "Document Approved",
        description: "Expense has been added to the job sheet",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to approve document",
        variant: "destructive",
      });
    },
  });

  const discardMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const response = await apiRequest('POST', `/api/email-processing/discard/${documentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
      toast({
        title: "Document Discarded",
        description: "Document has been removed from processing queue",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to discard document",
        variant: "destructive",
      });
    },
  });

  const handleCategoryChange = (documentId: string, category: string) => {
    setSelectedCategories(prev => ({ ...prev, [documentId]: category }));
  };

  const handleApprove = (doc: ProcessedDocument) => {
    const detectedJob = getJobFromSubject(doc.email_subject || '', jobs);
    const matchedJob = jobs.find((j: any) => 
      detectedJob.includes(j.jobAddress) && detectedJob.includes(j.clientName)
    );
    
    approveMutation.mutate({
      documentId: doc.id,
      jobId: matchedJob?.id,
      category: selectedCategories[doc.id] || doc.category
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
            <span className="ml-3 text-muted-foreground">Loading documents...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingDocuments.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Document Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-800 dark:text-green-200 mb-2">
              All Caught Up!
            </h3>
            <p className="text-muted-foreground">
              No documents waiting for review
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-orange-600" />
          Document Review
          <Badge variant="secondary" className="ml-2">
            {pendingDocuments.length} pending
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingDocuments.map((doc: ProcessedDocument) => {
            const detectedJob = getJobFromSubject(doc.email_subject || '', jobs);
            
            return (
              <div key={doc.id} className="border rounded-lg p-4 bg-orange-50 dark:bg-orange-950/20">
                <div className="flex items-start justify-between mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-orange-600" />
                      <span className="font-medium">{doc.filename}</span>
                    </div>
                    {doc.email_subject && (
                      <p className="text-sm text-muted-foreground">
                        From: {doc.email_subject}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline" className="border-orange-200 text-orange-700">
                    Pending Review
                  </Badge>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Building2 className="h-3 w-3" />
                      Vendor
                    </div>
                    <p className="text-sm text-muted-foreground">{doc.vendor}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <DollarSign className="h-3 w-3" />
                      Amount
                    </div>
                    <p className="text-sm font-semibold">${Number(doc.amount).toFixed(2)}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-sm font-medium">
                      <Calendar className="h-3 w-3" />
                      Category
                    </div>
                    <Select
                      value={selectedCategories[doc.id] || doc.category}
                      onValueChange={(value) => handleCategoryChange(doc.id, value)}
                    >
                      <SelectTrigger className="h-8 text-sm">
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
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Auto-detected Job</div>
                    {detectedJob ? (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium">
                        {detectedJob}
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 dark:text-amber-400">
                        No job match found
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => discardMutation.mutate(doc.id)}
                    disabled={discardMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" />
                    Discard
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleApprove(doc)}
                    disabled={approveMutation.isPending}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Approve & Add to Job
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
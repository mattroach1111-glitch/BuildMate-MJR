import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, FileText, DollarSign, Building, Edit, Eye } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { JobAddressSearch } from './job-address-search';
import * as fuzzball from 'fuzzball';

// GST calculation function (10% Australian GST)
function calculateGstAmount(baseAmount: number, gstOption: 'include' | 'exclude', originalGstOption: 'include' | 'exclude' = 'include'): number {
  // If we want the same option as the original, return the base amount
  if (gstOption === originalGstOption) {
    return baseAmount;
  }
  
  // If original was GST-inclusive and we want exclusive
  if (originalGstOption === 'include' && gstOption === 'exclude') {
    return baseAmount / 1.1; // Remove 10% GST
  }
  
  // If original was GST-exclusive and we want inclusive  
  if (originalGstOption === 'exclude' && gstOption === 'include') {
    return baseAmount * 1.1; // Add 10% GST
  }
  
  return baseAmount;
}

interface ProcessedDocument {
  id: string;
  filename: string;
  vendor: string;
  amount: string | number;
  category: string;
  gstOption?: 'include' | 'exclude';
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  email_subject?: string;
}

// Helper function to match job from email subject
function getJobFromSubject(emailSubject: string, jobs: any[]): string {
  if (!emailSubject || !jobs) {
    console.log('❌ Frontend: Missing data', { emailSubject, jobsAvailable: !!jobs, jobsLength: jobs?.length });
    return '';
  }
  
  const subject = emailSubject.toLowerCase();
  console.log('🔍 Frontend matching email subject:', subject);
  console.log('🔍 Available jobs for matching:', jobs?.map(j => ({ 
    id: j.id?.slice(0,8), 
    addr: j.jobAddress, 
    client: j.clientName, 
    pm: j.projectManager 
  })));
  
  // Look for job address patterns (exact matching only)
  let potentialMatches = [];
  
  for (const job of jobs) {
    // First try exact substring match
    if (job.jobAddress && subject.includes(job.jobAddress.toLowerCase())) {
      console.log('✅ Frontend exact substring match by address:', job.jobAddress);
      return `${job.jobAddress} (${job.clientName || 'Unknown Client'})`;
    }
    
    // Try perfect fuzzy match (98%+ similarity) for very close matches only
    if (job.jobAddress) {
      const similarity = fuzzball.ratio(subject.trim(), job.jobAddress.toLowerCase().trim());
      if (similarity >= 98) {
        console.log('🎯 Frontend PERFECT match by address:', job.jobAddress, `(${similarity}% similarity)`);
        return `${job.jobAddress} (${job.clientName || 'Unknown Client'})`;
      }
    }
    
    // Enhanced address pattern matching - handle both full and partial addresses
    if (job.jobAddress) {
      const jobAddr = job.jobAddress.toLowerCase().trim();
      
      // Extract street number and name from job address (must have street type)
      const jobMatch = jobAddr.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
      
      if (jobMatch) {
        const jobNumber = jobMatch[1];
        const jobStreet = jobMatch[2].toLowerCase().trim();
        const jobType = jobMatch[3].toLowerCase();
        
        // Try to extract full address from subject (with street type)
        const subjectFullMatch = subject.match(/(\d+)\s+([a-zA-Z\s]+?)\s+(st|street|rd|road|ave|avenue|dr|drive|pl|place|ct|court)/i);
        
        if (subjectFullMatch) {
          const subjectNumber = subjectFullMatch[1];
          const subjectStreet = subjectFullMatch[2].toLowerCase().trim();
          
          console.log(`🔍 Full address comparison: "${subjectNumber} ${subjectStreet}" vs "${jobNumber} ${jobStreet}"`);
          
          // Both street number AND street name must match exactly
          if (subjectNumber === jobNumber && 
              (subjectStreet === jobStreet || 
               fuzzball.ratio(subjectStreet, jobStreet) >= 90)) {
            console.log('✅ Frontend EXACT full address match:', job.jobAddress);
            potentialMatches.push({ job, priority: 1, type: 'exact_address' });
          }
        } else {
          // Try partial address match (number + street name without type)
          const subjectPartialMatch = subject.match(/(\d+)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/i);
          
          if (subjectPartialMatch) {
            const subjectNumber = subjectPartialMatch[1];
            const subjectStreet = subjectPartialMatch[2].toLowerCase().trim();
            
            console.log(`🔍 Partial address comparison: "${subjectNumber} ${subjectStreet}" vs "${jobNumber} ${jobStreet} ${jobType}"`);
            
            // Check if subject matches job number and street name (without street type)
            if (subjectNumber === jobNumber && 
                (subjectStreet === jobStreet || 
                 fuzzball.ratio(subjectStreet, jobStreet) >= 90)) {
              console.log('✅ Frontend PARTIAL address match:', job.jobAddress);
              potentialMatches.push({ job, priority: 2, type: 'partial_address' });
            }
          }
        }
      }
    }
    
    // Match client name
    if (job.clientName && subject.includes(job.clientName.toLowerCase())) {
      console.log('✅ Frontend found job match by client:', job.clientName);
      potentialMatches.push({ job, priority: 4, type: 'client' });
    }
    
    // Match project manager
    if (job.projectManager && subject.includes(job.projectManager.toLowerCase())) {
      console.log('✅ Frontend found job match by PM:', job.projectManager);
      potentialMatches.push({ job, priority: 5, type: 'pm' });
    }
  }
  
  // Return best match if any found
  if (potentialMatches.length > 0) {
    // Sort by priority (lower number = higher priority)
    potentialMatches.sort((a, b) => a.priority - b.priority);
    const bestMatch = potentialMatches[0];
    console.log(`🎯 Frontend match result: ${bestMatch.job.jobAddress} (${bestMatch.type} match, priority ${bestMatch.priority})`);
    return `${bestMatch.job.jobAddress} (${bestMatch.job.clientName || 'Unknown Client'})`;
  }
  
  console.log('❌ No job match found');
  return '';
}

export default function EmailProcessingReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [jobOverrides, setJobOverrides] = useState<Record<string, string>>({});
  const [gstOverrides, setGstOverrides] = useState<Record<string, 'include' | 'exclude'>>({});
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    filename: string;
    mimeType?: string;
    fileSize?: number;
  } | null>(null);

  // Get pending documents from email processing
  const { data: pendingDocs = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/email-processing/pending'],
    queryFn: async () => {
      const response = await fetch('/api/email-processing/pending', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch pending documents');
      }
      return response.json();
    },
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  // Get all jobs for job matching display
  const { data: jobs } = useQuery({
    queryKey: ['/api/jobs'],
    queryFn: async () => {
      const response = await fetch('/api/jobs', {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch jobs');
      }
      const jobsData = await response.json();
      console.log('🏢 Frontend jobs loaded:', jobsData?.length, 'jobs');
      console.log('🏢 Sample job structure:', jobsData?.[0]);
      return jobsData;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ docId, jobId, category, gstOption }: { docId: string; jobId?: string; category?: string; gstOption?: 'include' | 'exclude' }) => {
      const response = await fetch(`/api/email-processing/approve/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ jobId, categoryOverride: category, gstOption }),
      });
      if (!response.ok) {
        throw new Error('Failed to approve document');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('🟢 Document approved successfully, refreshing pending list...', data);
      
      // Force refresh the pending documents list
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
      queryClient.refetchQueries({ queryKey: ['/api/email-processing/pending'] });
      
      // Create enhanced success message with file attachment and Google Drive info
      let description = data.message || `Expense added to job successfully`;
      
      if (data.fileAttached && data.googleDriveUploaded) {
        description += ` Document saved and uploaded to Google Drive.`;
      } else if (data.fileAttached) {
        description += ` Document saved as file attachment.`;
      } else if (data.googleDriveUploaded) {
        description += ` Document uploaded to Google Drive.`;
      }
      
      toast({
        title: "Document Approved",
        description,
      });
    },
    onError: (error) => {
      console.error('Error approving document:', error);
      toast({
        title: "Approval Failed",
        description: "Failed to approve document and add to job",
        variant: "destructive",
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (docId: string) => {
      const response = await fetch(`/api/email-processing/reject/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to reject document');
      }
      return response.json();
    },
    onSuccess: () => {
      console.log('🟢 Document rejected successfully, refreshing pending list...');
      
      // Force refresh the pending documents list
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
      queryClient.refetchQueries({ queryKey: ['/api/email-processing/pending'] });
      
      toast({
        title: "Document Rejected",
        description: "Document has been removed from review queue",
      });
    },
    onError: (error) => {
      console.error('Error rejecting document:', error);
      toast({
        title: "Rejection Failed",
        description: "Failed to reject document",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Email Processing Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">Loading pending documents...</p>
        </CardContent>
      </Card>
    );
  }

  if (!pendingDocs || pendingDocs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Email Processing Review
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-500">No documents pending review.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          Email Processing Review
          <Badge variant="secondary">{pendingDocs.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-4 max-h-[70vh] sm:max-h-none">
        {pendingDocs.map((doc: any) => {
          try {
            return (
              <div key={doc.id} className="border rounded-lg p-3 sm:p-4 space-y-3 bg-white shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{doc.filename || 'Unknown File'}</span>
                    </div>
                    {doc.email_subject && (
                      <p className="text-xs text-gray-500">From: {doc.email_subject}</p>
                    )}
                    <div className="text-xs text-blue-600 mt-1">
                      <span className="font-medium">Email subject:</span> {doc.email_subject || 'No subject'}
                    </div>
                    <div className="text-xs text-gray-600 mt-1">
                      <span className="font-medium">Job assignment:</span>
                      <div className="mt-1">
                        <JobAddressSearch
                          value={jobOverrides[doc.id] || (() => {
                            if (doc.email_subject && jobs && jobs.length > 0) {
                              const match = getJobFromSubject(doc.email_subject, jobs);
                              if (match) {
                                // Extract job address from match result
                                const jobAddress = match.split(' (')[0];
                                const matchedJob = jobs.find((j: any) => j.jobAddress === jobAddress);
                                return matchedJob?.id || '';
                              }
                            }
                            return '';
                          })()}
                          onValueChange={(value) => setJobOverrides(prev => ({...prev, [doc.id]: value}))}
                          jobs={jobs || []}
                          placeholder="Search and select job..."
                          className="w-full text-xs"
                        />
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Pending Review
                  </Badge>
                </div>

                <div className="flex flex-col sm:grid sm:grid-cols-4 gap-3 sm:gap-4 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Building className="h-3 w-3 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-medium break-all">{doc.vendor || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-gray-500 flex-shrink-0" />
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">
                      ${calculateGstAmount(
                        parseFloat(doc.amount) || 0, 
                        gstOverrides[doc.id] || doc.gstOption || 'include', 
                        'include'
                      ).toFixed(2)} {(gstOverrides[doc.id] || doc.gstOption || 'include') === 'include' ? '(inc GST)' : '(exc GST)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex-shrink-0">GST:</span>
                    <Select 
                      value={gstOverrides[doc.id] || doc.gstOption || 'include'} 
                      onValueChange={(value: 'include' | 'exclude') => setGstOverrides(prev => ({...prev, [doc.id]: value}))}
                    >
                      <SelectTrigger className="w-full sm:w-24 h-8 text-xs mobile-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent 
                        position="popper" 
                        className="z-[9999]"
                        sideOffset={4}
                      >
                        <SelectItem value="include">Inc GST</SelectItem>
                        <SelectItem value="exclude">Exc GST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 flex-shrink-0">Category:</span>
                    <Select 
                      value={categoryOverrides[doc.id] || doc.category || 'other_costs'} 
                      onValueChange={(value) => setCategoryOverrides(prev => ({...prev, [doc.id]: value}))}
                    >
                      <SelectTrigger className="w-full sm:w-32 h-8 text-xs mobile-input">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent 
                        position="popper" 
                        className="z-[9999]"
                        sideOffset={4}
                      >
                        <SelectItem value="materials">Materials</SelectItem>
                        <SelectItem value="subtrades">Sub-trades</SelectItem>
                        <SelectItem value="tip_fees">Tip Fees</SelectItem>
                        <SelectItem value="other_costs">Other Costs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  {doc.attachmentURL && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setPreviewDoc({
                        url: doc.attachmentURL,
                        filename: doc.filename,
                        mimeType: doc.mimeType,
                        fileSize: doc.fileSize
                      })}
                      className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Preview
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => {
                      // Get the selected job ID
                      const selectedJobId = jobOverrides[doc.id] || (() => {
                        if (doc.email_subject && jobs && jobs.length > 0) {
                          const match = getJobFromSubject(doc.email_subject, jobs);
                          if (match) {
                            const jobAddress = match.split(' (')[0];
                            const matchedJob = jobs.find((j: any) => j.jobAddress === jobAddress);
                            return matchedJob?.id;
                          }
                        }
                        return ''; // No fallback - must explicitly select
                      })();

                      // Require job selection before approval
                      if (!selectedJobId) {
                        toast({
                          title: "Job Selection Required",
                          description: "Please select a job from the dropdown before approving this document.",
                          variant: "destructive",
                        });
                        return;
                      }

                      approveMutation.mutate({ 
                        docId: doc.id, 
                        category: categoryOverrides[doc.id] || doc.category,
                        gstOption: gstOverrides[doc.id] || doc.gstOption || 'include',
                        jobId: selectedJobId
                      });
                    }}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(doc.id)}
                    disabled={approveMutation.isPending || rejectMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="h-3 w-3 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          } catch (error) {
            console.error('Error rendering document:', error, doc);
            return (
              <div key={doc.id || Math.random()} className="border rounded-lg p-4 bg-red-50">
                <p className="text-red-600 text-sm">Error displaying document: {doc.filename || 'Unknown'}</p>
              </div>
            );
          }
        })}
      </CardContent>
      
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
    </Card>
  );
}
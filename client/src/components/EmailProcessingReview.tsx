import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Clock, FileText, DollarSign, Building, Edit } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
  
  // Look for job address patterns
  for (const job of jobs) {
    if (job.jobAddress && subject.includes(job.jobAddress.toLowerCase())) {
      return job.jobAddress;
    }
    if (job.clientName && subject.includes(job.clientName.toLowerCase())) {
      return job.clientName;
    }
    if (job.projectManager && subject.includes(job.projectManager.toLowerCase())) {
      return job.projectManager;
    }
  }
  
  return '';
}

export function EmailProcessingReview() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});

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
      return response.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ docId, jobId, category }: { docId: string; jobId?: string; category?: string }) => {
      const response = await fetch(`/api/email-processing/approve/${docId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ jobId, categoryOverride: category }),
      });
      if (!response.ok) {
        throw new Error('Failed to approve document');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
      toast({
        title: "Document Approved",
        description: data.message || `Expense added to job successfully`,
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
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-orange-600" />
          Email Processing Review
          <Badge variant="secondary">{pendingDocs.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingDocs.map((doc: any) => {
          try {
            return (
              <div key={doc.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{doc.filename || 'Unknown File'}</span>
                    </div>
                    {doc.email_subject && (
                      <p className="text-xs text-gray-500">From: {doc.email_subject}</p>
                    )}
                    {doc.email_subject && jobs && (
                      <div className="text-xs text-blue-600 mt-1">
                        <span className="font-medium">Auto-detected job:</span> {getJobFromSubject(doc.email_subject, jobs) || 'Will use first active job'}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-200">
                    Pending Review
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600">Vendor:</span>
                    <span className="font-medium">{doc.vendor || 'Unknown'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-3 w-3 text-gray-500" />
                    <span className="text-gray-600">Amount:</span>
                    <span className="font-medium">${(parseFloat(doc.amount) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Category:</span>
                    <Select 
                      value={categoryOverrides[doc.id] || doc.category || 'other_costs'} 
                      onValueChange={(value) => setCategoryOverrides(prev => ({...prev, [doc.id]: value}))}
                    >
                      <SelectTrigger className="w-32 h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="materials">Materials</SelectItem>
                        <SelectItem value="subtrades">Sub-trades</SelectItem>
                        <SelectItem value="tip_fees">Tip Fees</SelectItem>
                        <SelectItem value="other_costs">Other Costs</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate({ 
                      docId: doc.id, 
                      category: categoryOverrides[doc.id] || doc.category 
                    })}
                    disabled={approveMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => rejectMutation.mutate(doc.id)}
                    disabled={rejectMutation.isPending}
                    className="text-red-600 border-red-200 hover:bg-red-50"
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
    </Card>
  );
}
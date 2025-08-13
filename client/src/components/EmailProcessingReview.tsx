import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, FileText, DollarSign, Building } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ProcessedDocument {
  id: string;
  filename: string;
  vendor: string;
  amount: number;
  category: string;
  status: 'pending' | 'approved' | 'rejected';
  extractedAt: string;
  emailSubject?: string;
}

export function EmailProcessingReview() {
  const queryClient = useQueryClient();

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

  const approveMutation = useMutation({
    mutationFn: async ({ docId, jobId }: { docId: string; jobId?: string }) => {
      return apiRequest(`/api/email-processing/approve/${docId}`, {
        method: 'POST',
        body: JSON.stringify({ jobId }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (docId: string) => {
      return apiRequest(`/api/email-processing/reject/${docId}`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-processing/pending'] });
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
        {pendingDocs.map((doc: any) => (
          <div key={doc.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">{doc.filename}</span>
                </div>
                {doc.email_subject && (
                  <p className="text-xs text-gray-500">From: {doc.email_subject}</p>
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
                <span className="font-medium">{doc.vendor}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="h-3 w-3 text-gray-500" />
                <span className="text-gray-600">Amount:</span>
                <span className="font-medium">${parseFloat(doc.amount || 0).toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-gray-600">Category:</span>
                <Badge variant="secondary">{doc.category}</Badge>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate({ docId: doc.id })}
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
        ))}
      </CardContent>
    </Card>
  );
}
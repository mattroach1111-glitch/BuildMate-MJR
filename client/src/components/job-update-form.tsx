import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Mail, FileText, Send, Plus, Building2 } from "lucide-react";
import type { Job } from "@shared/schema";

// Schema for job update form
const jobUpdateSchema = z.object({
  updates: z.array(z.object({
    jobId: z.string(),
    update: z.string().optional(),
  })),
  emailSubject: z.string().min(1, "Email subject is required"),
  recipientEmails: z.string().min(1, "At least one email address is required"),
  additionalNotes: z.string().optional(),
});

type JobUpdateForm = z.infer<typeof jobUpdateSchema>;

interface JobUpdateFormProps {
  onClose?: () => void;
}

export function JobUpdateForm({ onClose }: JobUpdateFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch jobs data
  const { data: jobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  // Form setup
  const form = useForm<JobUpdateForm>({
    resolver: zodResolver(jobUpdateSchema),
    defaultValues: {
      updates: jobs?.map(job => ({ jobId: job.id, update: "" })) || [],
      emailSubject: `Job Updates - ${new Date().toLocaleDateString()}`,
      recipientEmails: "",
      additionalNotes: "",
    },
  });

  // Update form when jobs load
  React.useEffect(() => {
    if (jobs) {
      form.setValue("updates", jobs.map(job => ({ jobId: job.id, update: "" })));
    }
  }, [jobs, form]);

  // Submit job updates via email
  const submitUpdatesMutation = useMutation({
    mutationFn: async (data: JobUpdateForm) => {
      return apiRequest("POST", "/api/job-updates/email", data);
    },
    onSuccess: () => {
      toast({
        title: "Updates Sent",
        description: "Job updates have been emailed successfully.",
      });
      form.reset();
      onClose?.();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send job updates email.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = async (data: JobUpdateForm) => {
    // Filter out jobs without updates
    const jobsWithUpdates = data.updates.filter(update => update.update && update.update.trim() !== "");
    
    if (jobsWithUpdates.length === 0) {
      toast({
        title: "No Updates",
        description: "Please add at least one job update before submitting.",
        variant: "destructive",
      });
      return;
    }

    const submitData = {
      ...data,
      updates: jobsWithUpdates,
    };

    submitUpdatesMutation.mutate(submitData);
  };

  if (jobsLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-10 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!jobs || jobs.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No jobs available</h3>
        <p className="text-muted-foreground">Create some jobs first to send updates.</p>
      </Card>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Email Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Settings
            </CardTitle>
            <CardDescription>
              Configure the email details for sending job updates
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="emailSubject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Subject</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter email subject" 
                      {...field} 
                      data-testid="input-email-subject"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="recipientEmails"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Send To (Email Addresses)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter email addresses separated by commas (e.g., manager@company.com, client@client.com, owner@business.com)"
                      className="min-h-[80px]"
                      {...field} 
                      data-testid="input-recipient-emails"
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Separate multiple email addresses with commas. Supports as many recipients as needed.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
              <strong>Note:</strong> This will send via your Onlydomains.com email server (smtp.titan.email). 
              Make sure SMTP credentials are configured in your environment settings.
            </div>
          </CardContent>
        </Card>

        {/* Job Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Updates
            </CardTitle>
            <CardDescription>
              Add updates for each job. Only jobs with updates will be included in the email.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {jobs.map((job, index) => (
                <div key={job.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{job.jobAddress}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{job.clientName}</span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground">PM: {job.projectName}</span>
                      </div>
                      <Badge 
                        variant={job.status === 'ready_for_billing' ? 'default' : 'secondary'}
                        className="mt-2 text-xs"
                      >
                        {job.status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </Badge>
                    </div>
                  </div>
                  
                  <FormField
                    control={form.control}
                    name={`updates.${index}.update`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Update for this job</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter update notes for this job (optional)"
                            className="min-h-[80px] text-sm"
                            {...field}
                            data-testid={`textarea-job-update-${job.id}`}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Additional Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Additional Notes</CardTitle>
            <CardDescription>
              Add any general notes or comments to include at the end of the email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="additionalNotes"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional notes or comments..."
                      className="min-h-[100px]"
                      {...field}
                      data-testid="textarea-additional-notes"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Submit Actions */}
        <div className="flex justify-end gap-3 pt-4">
          {onClose && (
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              data-testid="button-cancel-updates"
            >
              Cancel
            </Button>
          )}
          <Button 
            type="submit" 
            disabled={submitUpdatesMutation.isPending}
            data-testid="button-send-updates"
          >
            {submitUpdatesMutation.isPending ? (
              <>
                <Send className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send Updates Email
              </>
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

// Dialog wrapper component
export function JobUpdateDialog() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" data-testid="button-open-job-updates">
          <Mail className="h-4 w-4 mr-2" />
          Send Job Updates
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Job Updates Email</DialogTitle>
        </DialogHeader>
        <JobUpdateForm onClose={() => setIsOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
import React, { useState, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Mail, FileText, Send, Plus, Building2, ChevronDown, Users, Clock } from "lucide-react";
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

// Local storage key for email suggestions
const EMAIL_SUGGESTIONS_KEY = 'buildflow-email-suggestions';

// Helper functions for email suggestions
const getSavedEmailSuggestions = (): string[] => {
  try {
    const saved = localStorage.getItem(EMAIL_SUGGESTIONS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveEmailSuggestions = (emails: string[]) => {
  try {
    localStorage.setItem(EMAIL_SUGGESTIONS_KEY, JSON.stringify(emails));
  } catch {
    // Ignore localStorage errors
  }
};

const addEmailsToSuggestions = (newEmails: string[]) => {
  const existing = getSavedEmailSuggestions();
  const emailSet = new Set([...existing, ...newEmails]);
  const updated = Array.from(emailSet).slice(0, 20); // Keep only 20 most recent
  saveEmailSuggestions(updated);
};

export function JobUpdateForm({ onClose }: JobUpdateFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch current user data
  const { data: currentUser } = useQuery<{ id: string; email: string }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Fetch jobs data
  const { data: allJobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  // Filter jobs by current user's project manager role
  const jobs = React.useMemo(() => {
    if (!allJobs || !currentUser) return [];
    
    // For Mark and Will, filter jobs by their project manager name
    const userEmail = currentUser.email?.toLowerCase();
    
    console.log('Current user email:', userEmail);
    console.log('All jobs:', allJobs.map(j => ({ id: j.id, address: j.jobAddress, pm: j.projectName })));
    
    if (userEmail?.includes('mark')) {
      const markJobs = allJobs.filter(job => job.projectName?.toLowerCase().includes('mark'));
      console.log('Mark filtered jobs:', markJobs.map(j => ({ id: j.id, address: j.jobAddress, pm: j.projectName })));
      return markJobs;
    } else if (userEmail?.includes('will')) {
      const willJobs = allJobs.filter(job => job.projectName?.toLowerCase().includes('will'));
      console.log('Will filtered jobs:', willJobs.map(j => ({ id: j.id, address: j.jobAddress, pm: j.projectName })));
      return willJobs;
    }
    
    console.log('Admin user - showing all jobs');
    // For other users (admins), show all jobs
    return allJobs;
  }, [allJobs, currentUser]);

  // Generate project manager specific email subject
  const getEmailSubject = React.useCallback(() => {
    const userEmail = currentUser?.email?.toLowerCase();
    let pmName = "";
    
    if (userEmail?.includes('mark')) {
      pmName = "Mark's ";
    } else if (userEmail?.includes('will')) {
      pmName = "Will's ";
    }
    
    return `${pmName}Job Updates - ${new Date().toLocaleDateString()}`;
  }, [currentUser]);

  // Form setup
  const form = useForm<JobUpdateForm>({
    resolver: zodResolver(jobUpdateSchema),
    defaultValues: {
      updates: jobs?.map(job => ({ jobId: job.id, update: "" })) || [],
      emailSubject: getEmailSubject(),
      recipientEmails: "",
      additionalNotes: "",
    },
  });

  // Load email suggestions on component mount
  useEffect(() => {
    setEmailSuggestions(getSavedEmailSuggestions());
  }, []);

  // Update form when jobs load or user changes
  React.useEffect(() => {
    if (jobs) {
      form.setValue("updates", jobs.map(job => ({ jobId: job.id, update: "" })));
    }
    if (currentUser) {
      form.setValue("emailSubject", getEmailSubject());
    }
  }, [jobs, currentUser, form, getEmailSubject]);

  // Submit job updates via email
  const submitUpdatesMutation = useMutation({
    mutationFn: async (data: JobUpdateForm) => {
      return apiRequest("POST", "/api/job-updates/email", data);
    },
    onSuccess: (response: any) => {
      // Save successful email addresses to suggestions
      if (response.sentTo && Array.isArray(response.sentTo)) {
        addEmailsToSuggestions(response.sentTo);
        setEmailSuggestions(getSavedEmailSuggestions());
      }
      
      toast({
        title: "Updates Sent",
        description: response.message || "Job updates have been emailed successfully.",
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
                  <FormLabel className="flex items-center justify-between">
                    Send To (Email Addresses)
                    {emailSuggestions.length > 0 && (
                      <Popover open={showSuggestions} onOpenChange={setShowSuggestions}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            data-testid="button-email-suggestions"
                          >
                            <Users className="h-3 w-3 mr-1" />
                            Recent Emails
                            <ChevronDown className="h-3 w-3 ml-1" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0" align="end">
                          <Command>
                            <CommandInput placeholder="Search email addresses..." />
                            <CommandEmpty>No emails found.</CommandEmpty>
                            <CommandGroup heading="Recent Email Addresses">
                              {emailSuggestions.map((email, index) => (
                                <CommandItem
                                  key={index}
                                  onSelect={() => {
                                    const currentEmails = field.value || "";
                                    const newValue = currentEmails 
                                      ? `${currentEmails}, ${email}`
                                      : email;
                                    field.onChange(newValue);
                                    setShowSuggestions(false);
                                  }}
                                  className="cursor-pointer"
                                >
                                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                                  {email}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandGroup heading="Quick Actions">
                              <CommandItem
                                onSelect={() => {
                                  const allEmails = emailSuggestions.join(", ");
                                  field.onChange(allEmails);
                                  setShowSuggestions(false);
                                }}
                                className="cursor-pointer text-primary"
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Add All Recent Emails
                              </CommandItem>
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Enter email addresses separated by commas (e.g., manager@company.com, client@client.com, owner@business.com)"
                      className="min-h-[80px]"
                      {...field} 
                      data-testid="input-recipient-emails"
                    />
                  </FormControl>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Separate multiple email addresses with commas.
                    </p>
                    {emailSuggestions.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {emailSuggestions.length} saved email{emailSuggestions.length !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
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
              {currentUser?.email?.toLowerCase().includes('mark') && (
                <Badge variant="secondary" className="text-xs">Mark's Jobs</Badge>
              )}
              {currentUser?.email?.toLowerCase().includes('will') && (
                <Badge variant="secondary" className="text-xs">Will's Jobs</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add updates for each job. Only jobs with updates will be included in the email.
              {(currentUser?.email?.toLowerCase().includes('mark') || currentUser?.email?.toLowerCase().includes('will')) && 
                " Showing only your assigned jobs."}
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
        <Button variant="outline" size="icon" data-testid="button-open-job-updates">
          <Mail className="h-4 w-4" />
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
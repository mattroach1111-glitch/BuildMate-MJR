import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  projectManager?: string; // "Mark" or "Will" to filter jobs
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

export function JobUpdateForm({ onClose, projectManager }: JobUpdateFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSuggestions, setEmailSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedClient, setSelectedClient] = useState<string>("all");

  // Fetch current user data
  const { data: currentUser } = useQuery<{ id: string; email: string; role: string }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  // Mutation for saving job update notes
  const saveNoteMutation = useMutation({
    mutationFn: (data: { jobId: string; note: string }) =>
      apiRequest("/api/job-update-notes", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-update-notes"] });
    },
    onError: (error) => {
      console.log("Note auto-save failed (user may not be logged in):", error);
    },
  });

  // localStorage fallback for non-admin users
  const saveToLocalStorage = (jobId: string, note: string) => {
    try {
      const key = `job-update-note-${jobId}`;
      if (note.trim()) {
        localStorage.setItem(key, note.trim());
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.log("Failed to save to localStorage:", error);
    }
  };

  const getFromLocalStorage = (jobId: string): string => {
    try {
      return localStorage.getItem(`job-update-note-${jobId}`) || "";
    } catch (error) {
      console.log("Failed to get from localStorage:", error);
      return "";
    }
  };

  // Debounced save function
  const debouncedSave = React.useCallback(
    React.useMemo(() => {
      const timeouts = new Map();
      return (jobId: string, note: string) => {
        // Clear existing timeout for this job
        if (timeouts.has(jobId)) {
          clearTimeout(timeouts.get(jobId));
        }
        
        // Set new timeout
        const timeoutId = setTimeout(() => {
          if (note.trim()) {
            if (currentUser?.role === "admin") {
              console.log("Auto-saving note to database for job:", jobId, "Note:", note.trim());
              saveNoteMutation.mutate({ jobId, note: note.trim() });
            } else {
              console.log("Auto-saving note to localStorage for job:", jobId, "Note:", note.trim());
              saveToLocalStorage(jobId, note);
            }
          }
          timeouts.delete(jobId);
        }, 1500);
        
        timeouts.set(jobId, timeoutId);
      };
    }, [saveNoteMutation, currentUser?.role])
  );

  // Fetch jobs data
  const { data: allJobs, isLoading: jobsLoading } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  // Filter jobs by project manager and client
  const jobs = React.useMemo(() => {
    if (!allJobs) return [];
    
    let filteredJobs = allJobs;
    
    // If projectManager is specified (from folder context), filter by that
    if (projectManager) {
      filteredJobs = filteredJobs.filter(job => 
        job.projectManager?.toLowerCase().includes(projectManager.toLowerCase())
      );
    }

    // Filter by selected client if not "all"
    if (selectedClient !== "all") {
      filteredJobs = filteredJobs.filter(job => 
        job.clientName?.toLowerCase() === selectedClient.toLowerCase()
      );
    }

    return filteredJobs;
  }, [allJobs, projectManager, selectedClient]);

  // Get unique clients from filtered jobs (by project manager)
  const availableClients = React.useMemo(() => {
    if (!allJobs) return [];
    
    let baseJobs = allJobs;
    
    // If projectManager is specified, filter base jobs first
    if (projectManager) {
      baseJobs = baseJobs.filter(job => 
        job.projectManager?.toLowerCase().includes(projectManager.toLowerCase())
      );
    }

    const clients = Array.from(new Set(baseJobs.map(job => job.clientName).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    
    return clients;
  }, [allJobs, projectManager]);

  // Generate project manager and client specific email subject
  const getEmailSubject = React.useCallback(() => {
    let pmName = "";
    let clientPart = "";
    
    if (projectManager) {
      pmName = `${projectManager}'s `;
    }
    
    if (selectedClient !== "all") {
      clientPart = ` - ${selectedClient}`;
    }
    
    return `${pmName}Job Updates${clientPart} - ${new Date().toLocaleDateString()}`;
  }, [projectManager, selectedClient]);

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

  // Load saved job update notes
  const { data: savedNotes } = useQuery({
    queryKey: ["/api/job-update-notes"],
    enabled: !!currentUser?.role && currentUser.role === "admin",
    retry: false
  });

  // Use useFieldArray for proper dynamic field management
  const { fields, replace } = useFieldArray({
    control: form.control,
    name: "updates"
  });

  // Update form when jobs load, project manager, or client changes
  React.useEffect(() => {
    if (jobs) {
      // Get current form values to preserve user input
      const currentValues = form.getValues("updates") || [];
      
      const updatedUpdates = jobs.map(job => {
        // Find existing update for this job to preserve user input
        const existingUpdate = currentValues.find(update => update.jobId === job.id);
        // Or find saved note from database (admin) or localStorage (staff)
        const savedNote = savedNotes?.find((note: any) => note.jobId === job.id);
        const localStorageNote = getFromLocalStorage(job.id);
        
        return {
          jobId: job.id,
          update: existingUpdate?.update || savedNote?.note || localStorageNote || ""
        };
      });
      
      replace(updatedUpdates);
      form.setValue("emailSubject", getEmailSubject());
    }
  }, [jobs, replace, form, getEmailSubject, savedNotes]);

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

    // Save all job update notes before sending email
    const savePromises = data.updates
      .filter(update => update.update && update.update.trim())
      .map(async (update) => {
        const note = update.update!.trim();
        console.log("Saving note before email for job:", update.jobId, "Note:", note);
        
        if (currentUser?.role === "admin") {
          // Try to save to database for admin users
          try {
            await saveNoteMutation.mutateAsync({
              jobId: update.jobId,
              note: note
            });
          } catch (error) {
            console.log(`Failed to save note to database for job ${update.jobId}, falling back to localStorage:`, error);
            saveToLocalStorage(update.jobId, note);
          }
        } else {
          // Save to localStorage for staff users
          saveToLocalStorage(update.jobId, note);
        }
      });

    // Wait for all notes to save (or fail silently)
    await Promise.allSettled(savePromises);

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

        {/* Client Filter */}
        {availableClients.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Client Filter
              </CardTitle>
              <CardDescription>
                Select a specific client to filter jobs, or choose "All Clients" to include everyone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Label htmlFor="client-filter" className="text-sm font-medium">
                  Choose Client
                </Label>
                <Select value={selectedClient} onValueChange={setSelectedClient}>
                  <SelectTrigger data-testid="select-client-filter">
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        All Clients
                      </div>
                    </SelectItem>
                    {availableClients.map((client) => (
                      <SelectItem key={client} value={client}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {client}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedClient !== "all" && (
                  <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg">
                    <strong>Filtered:</strong> Showing only jobs for <strong>{selectedClient}</strong>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Job Updates */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Job Updates
              {projectManager && (
                <Badge variant="secondary" className="text-xs">{projectManager}'s Jobs</Badge>
              )}
              {selectedClient !== "all" && (
                <Badge variant="outline" className="text-xs">{selectedClient} Only</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Add updates for each job. Only jobs with updates will be included in the email.
              {projectManager && ` Showing only ${projectManager}'s assigned jobs.`}
              {selectedClient !== "all" && ` Filtered to ${selectedClient} jobs only.`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  {selectedClient !== "all" 
                    ? `No jobs found for ${selectedClient}${projectManager ? ` under ${projectManager}` : ""}`
                    : `No jobs found${projectManager ? ` for ${projectManager}` : ""}`
                  }
                </p>
                {selectedClient !== "all" && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mt-2"
                    onClick={() => setSelectedClient("all")}
                  >
                    Show All Clients
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {fields.map((field, index) => {
                  const job = jobs.find(j => j.id === field.jobId);
                  if (!job) return null;
                  
                  return (
                    <div key={field.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-sm">{job.jobAddress}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">{job.clientName}</span>
                            <span className="text-xs text-muted-foreground">•</span>
                            <span className="text-xs text-muted-foreground">PM: {job.projectManager || job.projectName}</span>
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
                        render={({ field: formField }) => (
                          <FormItem>
                            <FormLabel className="text-sm">Update for this job</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Enter update notes for this job (optional)"
                                className="min-h-[80px] text-sm"
                                {...formField}
                                onChange={(e) => {
                                  formField.onChange(e);
                                  // Auto-save note with proper debouncing
                                  debouncedSave(job.id, e.target.value);
                                }}
                                data-testid={`textarea-job-update-${job.id}`}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            )}
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
export interface JobUpdateDialogProps {
  projectManager?: string; // "Mark" or "Will" to filter jobs by PM
}

function JobUpdateDialog({ projectManager }: JobUpdateDialogProps) {
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
          <DialogTitle>
            Send Job Updates Email
            {projectManager && ` - ${projectManager}'s Jobs`}
          </DialogTitle>
          <DialogDescription>
            Select jobs and configure email settings to send project updates to clients and stakeholders
          </DialogDescription>
        </DialogHeader>
        <JobUpdateForm onClose={() => setIsOpen(false)} projectManager={projectManager} />
      </DialogContent>
    </Dialog>
  );
}

export default JobUpdateDialog;
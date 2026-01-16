import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateJobPDF } from "@/lib/pdfGenerator";
import { ObjectUploader } from "@/components/ObjectUploader";
import { OrientationToggle } from "@/components/orientation-toggle";
import { debounce } from "lodash";
import { Upload, Download, Trash2, FileText, Clock, X, Edit, Mail, Users, RefreshCw, MessageSquare, Plus, Shield, CheckCircle2, FileSignature } from "lucide-react";
import { SwmsSigningModal } from "@/components/SwmsSigningModal";
import type { Job, LaborEntry, Material, SubTrade, OtherCost, TipFee, JobFile, JobNote } from "@shared/schema";

interface JobSheetModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface JobDetails extends Job {
  laborEntries: (LaborEntry & { staff?: { name: string } })[];
  materials: Material[];
  subTrades: SubTrade[];
  otherCosts: OtherCost[];
  tipFees: TipFee[];
}

export default function JobSheetModal({ jobId, isOpen, onClose }: JobSheetModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = (user as any)?.role === "admin";
  const [builderMargin, setBuilderMargin] = useState("25");
  const [defaultHourlyRate, setDefaultHourlyRate] = useState("50");
  const [excludeFromTotal, setExcludeFromTotal] = useState(false);
  const [localLaborRates, setLocalLaborRates] = useState<Record<string, string>>({});
  const [hasUnsavedRates, setHasUnsavedRates] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    jobAddress: "",
    clientName: "",
    projectName: "",
    projectManager: "",
    status: "",
  });
  const [isAddingNewClient, setIsAddingNewClient] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [isAddingNewProjectManager, setIsAddingNewProjectManager] = useState(false);
  const [newProjectManagerName, setNewProjectManagerName] = useState("");
  const [showEmployeeManager, setShowEmployeeManager] = useState(false);
  const [extraHours, setExtraHours] = useState<Record<string, string>>({});
  
  // Email PDF dialog state
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [emailRecipient, setEmailRecipient] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [includeSwmsInEmail, setIncludeSwmsInEmail] = useState(false);
  
  // Editing states for materials, sub-trades, other costs, and tip fees
  const [editingMaterial, setEditingMaterial] = useState<string | null>(null);
  const [editingSubTrade, setEditingSubTrade] = useState<string | null>(null);
  const [editingOtherCost, setEditingOtherCost] = useState<string | null>(null);
  const [editingTipFee, setEditingTipFee] = useState<string | null>(null);
  const [editMaterialForm, setEditMaterialForm] = useState<{description: string; supplier: string; amount: string; invoiceDate: string}>({description: "", supplier: "", amount: "", invoiceDate: ""});
  const [editSubTradeForm, setEditSubTradeForm] = useState<{trade: string; contractor: string; amount: string; invoiceDate: string}>({trade: "", contractor: "", amount: "", invoiceDate: ""});
  const [editOtherCostForm, setEditOtherCostForm] = useState<{description: string; amount: string}>({description: "", amount: ""});
  const [editTipFeeForm, setEditTipFeeForm] = useState<{description: string; amount: string}>({description: "", amount: ""});
  
  // Labor entry editing states
  
  // Job notes states
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  
  // Password-protected deletion states
  const [deleteJobDialogOpen, setDeleteJobDialogOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // SWMS signing state for admins (voluntary signing)
  const [showSwmsSigningModal, setShowSwmsSigningModal] = useState(false);
  
  // Get the deletion password from localStorage (set in admin settings)
  const DELETION_PASSWORD = localStorage.getItem('buildflow-deletion-password') || 'Festool1!';
  const [editingLaborEntry, setEditingLaborEntry] = useState<string | null>(null);
  const [editLaborHours, setEditLaborHours] = useState<string>("");

  // Scroll position preservation
  const [scrollPosition, setScrollPosition] = useState<number>(0);
  const dialogContentRef = useRef<HTMLDivElement>(null);

  const { data: jobDetails, isLoading } = useQuery<JobDetails>({
    queryKey: ["/api/jobs", jobId],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Get job files
  const { data: jobFiles = [] } = useQuery<JobFile[]>({
    queryKey: ["/api/jobs", jobId, "files"],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Get job timesheets
  const { data: jobTimesheets = [] } = useQuery<any[]>({
    queryKey: ["/api/jobs", jobId, "timesheets"],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Get job notes
  const { data: jobNotes = [] } = useQuery<(JobNote & { user: any })[]>({
    queryKey: ["/api/jobs", jobId, "notes"],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Get SWMS signatures for this job
  const { data: swmsSignatures = [] } = useQuery<Array<{
    id: string;
    templateTitle: string;
    templateActive: boolean;
    signerName: string;
    occupation: string;
    signedAt: string;
    userName: string;
  }>>({
    queryKey: ["/api/swms/job", jobId, "signatures"],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Check if current user has unsigned SWMS templates for this job
  const { data: swmsCheckData, refetch: refetchSwmsCheck } = useQuery<{
    allSigned: boolean;
    unsignedCount: number;
    unsignedTemplates: Array<{ id: string; title: string }>;
  }>({
    queryKey: ["/api/swms/check", jobId],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  // Get all jobs for dropdown options
  const { data: allJobs } = useQuery<Job[]>({
    queryKey: ["/api/jobs"],
    retry: false,
  });

  // Get unique project managers and clients from existing jobs
  const projectManagers = allJobs ? Array.from(new Set(allJobs.map(job => job.projectManager || job.projectName).filter(Boolean))) : [];
  const clientNames = allJobs ? Array.from(new Set(allJobs.map(job => job.clientName).filter(Boolean))) : [];

  // Get all employees for management
  const { data: allEmployees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
    enabled: isAdmin,
    retry: false,
  });

  const handleAddClient = () => {
    if (newClientName.trim()) {
      setEditForm(prev => ({ ...prev, clientName: newClientName.trim() }));
      setNewClientName("");
      setIsAddingNewClient(false);
    }
  };

  const handleAddProjectManager = () => {
    if (newProjectManagerName.trim()) {
      setEditForm(prev => ({ ...prev, projectManager: newProjectManagerName.trim() }));
      setNewProjectManagerName("");
      setIsAddingNewProjectManager(false);
    }
  };

  const handleClientChange = (value: string) => {
    if (value === "__add_new__") {
      setIsAddingNewClient(true);
      setNewClientName("");
    } else {
      setEditForm(prev => ({ ...prev, clientName: value }));
    }
  };

  const handleProjectManagerChange = (value: string) => {
    if (value === "__add_new__") {
      setIsAddingNewProjectManager(true);
      setNewProjectManagerName("");
    } else {
      setEditForm(prev => ({ ...prev, projectManager: value }));
    }
  };

  // Helper functions for editing
  const startEditingMaterial = (material: Material) => {
    setEditingMaterial(material.id);
    setEditMaterialForm({
      description: material.description,
      supplier: material.supplier,
      amount: material.amount,
      invoiceDate: material.invoiceDate || "",
    });
  };

  const startEditingSubTrade = (subTrade: SubTrade) => {
    setEditingSubTrade(subTrade.id);
    setEditSubTradeForm({
      trade: subTrade.trade,
      contractor: subTrade.contractor,
      amount: subTrade.amount,
      invoiceDate: subTrade.invoiceDate || "",
    });
  };

  const startEditingOtherCost = (otherCost: OtherCost) => {
    setEditingOtherCost(otherCost.id);
    setEditOtherCostForm({
      description: otherCost.description,
      amount: otherCost.amount,
    });
  };

  const startEditingTipFee = (tipFee: TipFee) => {
    setEditingTipFee(tipFee.id);
    setEditTipFeeForm({
      description: tipFee.description,
      amount: tipFee.amount,
    });
  };

  const handleUpdateMaterial = () => {
    if (editingMaterial) {
      updateMaterialMutation.mutate({
        id: editingMaterial,
        ...editMaterialForm,
      });
    }
  };

  const handleUpdateSubTrade = () => {
    if (editingSubTrade) {
      updateSubTradeMutation.mutate({
        id: editingSubTrade,
        ...editSubTradeForm,
      });
    }
  };

  const handleUpdateOtherCost = () => {
    if (editingOtherCost) {
      updateOtherCostMutation.mutate({
        id: editingOtherCost,
        ...editOtherCostForm,
      });
    }
  };

  const handleUpdateTipFee = () => {
    if (editingTipFee) {
      updateTipFeeMutation.mutate({
        id: editingTipFee,
        data: editTipFeeForm,
      });
    }
  };

  const updateJobMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setIsEditing(false);
      setIsAddingNewClient(false);
      setIsAddingNewProjectManager(false);
      setNewClientName("");
      setNewProjectManagerName("");
      toast({
        title: "Success",
        description: "Job updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update job",
        variant: "destructive",
      });
    },
  });

  // Delete job mutation
  const deleteJobMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/jobs/${jobId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-jobs"] });
      setDeleteJobDialogOpen(false);
      setDeletePassword('');
      toast({
        title: "Success", 
        description: "Job has been moved to deleted folder",
      });
      onClose(); // Close modal after successful deletion
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete job",
        variant: "destructive",
      });
    },
  });

  const handleDeleteJobClick = () => {
    setDeleteJobDialogOpen(true);
  };

  const handleSavePDFBeforeDelete = async () => {
    if (!jobDetails) return;
    
    setIsGeneratingPDF(true);
    try {
      const response = await fetch(`/api/jobs/${jobId}/pdf`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `job-sheet-${jobDetails.jobAddress.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast({
        title: "PDF Saved",
        description: "Job sheet PDF has been downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleConfirmDelete = () => {
    if (!jobDetails) return;
    
    if (deletePassword !== DELETION_PASSWORD) {
      toast({
        title: "Invalid Password",
        description: "Please enter the correct deletion password",
        variant: "destructive",
      });
      return;
    }

    deleteJobMutation.mutate();
  };

  const addLaborMutation = useMutation({
    mutationFn: async (data: { staffId: string; hourlyRate: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/labor`, {
        staffId: data.staffId,
        hourlyRate: parseFloat(data.hourlyRate),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Labor entry added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add labor entry",
        variant: "destructive",
      });
    },
  });

  const updateLaborMutation = useMutation({
    mutationFn: async ({ id, hourlyRate }: { id: string; hourlyRate: string }) => {
      const response = await apiRequest("PATCH", `/api/labor-entries/${id}`, { hourlyRate });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
    },
  });

  const addExtraHoursMutation = useMutation({
    mutationFn: async ({ laborEntryId, extraHours }: { laborEntryId: string; extraHours: string }) => {
      const response = await apiRequest("PATCH", `/api/labor-entries/${laborEntryId}/add-extra-hours`, { extraHours });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Extra hours added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add extra hours",
        variant: "destructive",
      });
    },
  });

  // Update labor entry hours mutation (admin only)
  const updateLaborHoursMutation = useMutation({
    mutationFn: async ({ laborEntryId, hoursLogged }: { laborEntryId: string; hoursLogged: string }) => {
      const response = await apiRequest("PATCH", `/api/labor-entries/${laborEntryId}/hours`, { 
        hoursLogged: parseFloat(hoursLogged) 
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setEditingLaborEntry(null);
      setEditLaborHours("");
      toast({
        title: "Success",
        description: "Labor hours updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update labor hours",
        variant: "destructive",
      });
    },
  });

  // Save all changed labor rates at once
  const saveAllLaborRates = useCallback(async () => {
    if (!hasUnsavedRates || !jobDetails) return;
    
    const ratesToUpdate = Object.entries(localLaborRates).filter(([id, rate]) => {
      const originalEntry = jobDetails.laborEntries.find(entry => entry.id === id);
      return originalEntry && originalEntry.hourlyRate !== rate && rate && !isNaN(parseFloat(rate));
    });

    if (ratesToUpdate.length === 0) {
      setHasUnsavedRates(false);
      return;
    }

    try {
      // Update all rates in parallel
      await Promise.all(
        ratesToUpdate.map(([id, hourlyRate]) => 
          updateLaborMutation.mutateAsync({ id, hourlyRate })
        )
      );
      setHasUnsavedRates(false);
      toast({
        title: "Success",
        description: "Labor rates updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update some labor rates",
        variant: "destructive",
      });
    }
  }, [localLaborRates, hasUnsavedRates, jobDetails, updateLaborMutation, toast]);

  const debouncedUpdateJobSettings = useCallback(
    debounce((data: Partial<Job>) => {
      updateJobMutation.mutate(data);
    }, 1000),
    [updateJobMutation]
  );

  const addOtherCostMutation = useMutation({
    mutationFn: async (data: { description: string; amount: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/othercosts`, {
        description: data.description,
        amount: data.amount,
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Other cost added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add other cost",
        variant: "destructive",
      });
    },
  });

  const addTipFeeMutation = useMutation({
    mutationFn: async (data: { description: string; amount: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/tipfees`, {
        description: data.description,
        amount: parseFloat(data.amount),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Tip fee added successfully (includes 20% cartage)",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add tip fee",
        variant: "destructive",
      });
    },
  });

  const addMaterialMutation = useMutation({
    mutationFn: async (data: { description: string; supplier: string; amount: string; invoiceDate: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/materials`, {
        description: data.description,
        supplier: data.supplier,
        amount: parseFloat(data.amount),
        invoiceDate: data.invoiceDate,
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Material added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add material",
        variant: "destructive",
      });
    },
  });

  const addSubTradeMutation = useMutation({
    mutationFn: async (data: { trade: string; contractor: string; amount: string; invoiceDate: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/subtrades`, {
        trade: data.trade,
        contractor: data.contractor,
        amount: parseFloat(data.amount),
        invoiceDate: data.invoiceDate,
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Sub trade added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to add sub trade",
        variant: "destructive",
      });
    },
  });

  // Update mutations for materials, sub-trades, and other costs
  const updateMaterialMutation = useMutation({
    mutationFn: async (data: { id: string; description: string; supplier: string; amount: string; invoiceDate: string }) => {
      const response = await apiRequest("PATCH", `/api/materials/${data.id}`, {
        description: data.description,
        supplier: data.supplier,
        amount: parseFloat(data.amount),
        invoiceDate: data.invoiceDate,
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setEditingMaterial(null);
      toast({
        title: "Success",
        description: "Material updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update material",
        variant: "destructive",
      });
    },
  });

  const updateSubTradeMutation = useMutation({
    mutationFn: async (data: { id: string; trade: string; contractor: string; amount: string; invoiceDate: string }) => {
      const response = await apiRequest("PATCH", `/api/subtrades/${data.id}`, {
        trade: data.trade,
        contractor: data.contractor,
        amount: parseFloat(data.amount),
        invoiceDate: data.invoiceDate,
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setEditingSubTrade(null);
      toast({
        title: "Success",
        description: "Sub trade updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update sub trade",
        variant: "destructive",
      });
    },
  });

  const updateOtherCostMutation = useMutation({
    mutationFn: async (data: { id: string; description: string; amount: string }) => {
      const response = await apiRequest("PATCH", `/api/othercosts/${data.id}`, {
        description: data.description,
        amount: parseFloat(data.amount),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setEditingOtherCost(null);
      toast({
        title: "Success",
        description: "Other cost updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update other cost",
        variant: "destructive",
      });
    },
  });

  const updateTipFeeMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { description: string; amount: string } }) => {
      const response = await apiRequest("PATCH", `/api/tipfees/${id}`, {
        description: data.description,
        amount: parseFloat(data.amount),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      setEditingTipFee(null);
      toast({
        title: "Success",
        description: "Tip fee updated successfully (includes 20% cartage)",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update tip fee",
        variant: "destructive",
      });
    },
  });

  // Delete mutations
  const deleteMaterialMutation = useMutation({
    mutationFn: async (materialId: string) => {
      await apiRequest("DELETE", `/api/materials/${materialId}`);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Material deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete material",
        variant: "destructive",
      });
    },
  });

  const deleteSubTradeMutation = useMutation({
    mutationFn: async (subTradeId: string) => {
      await apiRequest("DELETE", `/api/subtrades/${subTradeId}`);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Sub trade deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete sub trade",
        variant: "destructive",
      });
    },
  });

  const deleteOtherCostMutation = useMutation({
    mutationFn: async (otherCostId: string) => {
      await apiRequest("DELETE", `/api/othercosts/${otherCostId}`);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Other cost deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete other cost",
        variant: "destructive",
      });
    },
  });

  const deleteTipFeeMutation = useMutation({
    mutationFn: async (tipFeeId: string) => {
      await apiRequest("DELETE", `/api/tipfees/${tipFeeId}`);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Tip fee deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete tip fee",
        variant: "destructive",
      });
    },
  });

  // Employee deletion mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (employeeId: string) => {
      const response = await apiRequest("DELETE", `/api/employees/${employeeId}`);
      // API returns 204 No Content on successful deletion
      if (response.status === 204) {
        return { success: true };
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
      setShowEmployeeManager(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete employee",
        variant: "destructive",
      });
    },
  });

  // File upload mutations
  const uploadFileMutation = useMutation({
    mutationFn: async (fileData: { 
      jobId: string; 
      fileName: string; 
      originalName: string; 
      fileSize: number; 
      mimeType: string; 
      objectPath: string; 
    }) => {
      return await apiRequest("POST", "/api/job-files", fileData);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "files"] });
      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    },
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (fileId: string) => {
      return await apiRequest("DELETE", `/api/job-files/${fileId}`);
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "files"] });
      toast({
        title: "Success",
        description: "File deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    },
  });

  // Handle file upload
  const handleGetUploadParameters = async (file: any): Promise<{ method: "PUT"; url: string; headers?: Record<string, string> }> => {
    try {
      console.log("Getting upload parameters for file:", file?.name || 'unknown');
      const response = await apiRequest("POST", "/api/job-files/upload-url");
      console.log("Upload URL response:", response);
      
      const data = await response.json();
      console.log("Upload URL data:", data);
      
      if (!data.uploadURL) {
        throw new Error("No upload URL received from server");
      }
      
      return {
        method: "PUT",
        url: data.uploadURL,
        headers: {},
      };
    } catch (error) {
      console.error("Error getting upload parameters:", error);
      
      if ((error as Error).message?.includes('401')) {
        toast({
          title: "Authentication Error",
          description: "You are logged out. Please log in again.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 1000);
        throw error;
      }
      
      toast({
        title: "Upload Error",
        description: "Failed to prepare file upload. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleFileUploadComplete = (result: any) => {
    console.log("Upload complete result:", result);
    if (result.successful && result.successful.length > 0) {
      result.successful.forEach((file: any) => {
        console.log("Processing successful file:", file);
        // The object path should be the URL that was used for upload
        const objectPath = file.uploadURL || file.response?.uploadURL || file.response?.url;
        console.log("Object path for file:", objectPath);
        
        if (!objectPath) {
          console.error("No object path found for uploaded file:", file);
          toast({
            title: "Upload Error",
            description: `Failed to get object path for ${file.name}`,
            variant: "destructive",
          });
          return;
        }
        
        uploadFileMutation.mutate({
          jobId,
          fileName: file.name,
          originalName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          objectPath: objectPath,
        });
      });
    }
    
    if (result.failed && result.failed.length > 0) {
      console.error("Failed uploads:", result.failed);
      result.failed.forEach((file: any) => {
        toast({
          title: "Upload Failed",
          description: `Failed to upload ${file.name}: ${file.error}`,
          variant: "destructive",
        });
      });
    }
  };

  const handleDownloadFile = (file: JobFile) => {
    if (file.googleDriveLink) {
      // For Google Drive files, open the direct link
      window.open(file.googleDriveLink, '_blank');
    } else {
      // For object storage files, use the download endpoint
      window.open(`/api/job-files/${file.id}/download`, '_blank');
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (confirm('Are you sure you want to delete this file?')) {
      deleteFileMutation.mutate(fileId);
    }
  };

  useEffect(() => {
    if (jobDetails) {
      setBuilderMargin(jobDetails.builderMargin);
      setDefaultHourlyRate(jobDetails.defaultHourlyRate);
      setExcludeFromTotal(jobDetails.excludeFromTotal || false);
      // Initialize local labor rates
      const rates: Record<string, string> = {};
      jobDetails.laborEntries.forEach(entry => {
        rates[entry.id] = entry.hourlyRate;
      });
      setLocalLaborRates(rates);
      setHasUnsavedRates(false);

      // Initialize edit form
      setEditForm({
        jobAddress: jobDetails.jobAddress || "",
        clientName: jobDetails.clientName || "",
        projectName: jobDetails.projectName || "",
        projectManager: jobDetails.projectManager || "",
        status: jobDetails.status || "",
      });
    }
  }, [jobDetails]);

  // Custom employee sort order
  const employeeSortOrder = [
    'Matt', 'Mark', 'Will', 'Logan', 'Tim', 'Greg', 'Jesse', 'Liam', 'Hamish'
  ];

  const getSortedLaborEntries = (laborEntries: LaborEntry[]) => {
    return [...laborEntries].sort((a, b) => {
      const nameA = (a as any).staff?.name || a.staffId; // Use staff name if available, fallback to staffId
      const nameB = (b as any).staff?.name || b.staffId;
      
      // Special case: Mark Plastering always goes to the bottom
      const isMarkPlasteringA = nameA.toLowerCase().includes('mark plastering') || nameA.toLowerCase().includes('plastering');
      const isMarkPlasteringB = nameB.toLowerCase().includes('mark plastering') || nameB.toLowerCase().includes('plastering');
      
      if (isMarkPlasteringA && !isMarkPlasteringB) return 1; // A goes after B
      if (!isMarkPlasteringA && isMarkPlasteringB) return -1; // B goes after A
      if (isMarkPlasteringA && isMarkPlasteringB) return 0; // Both are Mark Plastering, same position
      
      // For non-Mark Plastering employees, use the main sort order
      const indexA = employeeSortOrder.findIndex(name => 
        nameA.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(nameA.toLowerCase())
      );
      const indexB = employeeSortOrder.findIndex(name => 
        nameB.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(nameB.toLowerCase())
      );
      
      // If both are in the sort order, sort by their position
      if (indexA !== -1 && indexB !== -1) {
        return indexA - indexB;
      }
      
      // If only one is in the sort order, prioritize it
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      
      // If neither is in the sort order, sort alphabetically
      return nameA.localeCompare(nameB);
    });
  };

  const calculateTotals = () => {
    if (!jobDetails) return { laborTotal: 0, materialsTotal: 0, subTradesTotal: 0, otherCostsTotal: 0, tipFeesTotal: 0, subtotal: 0, marginAmount: 0, subtotalWithMargin: 0, gstAmount: 0, total: 0 };

    const laborTotal = jobDetails.laborEntries.reduce((sum, entry) => {
      const currentRate = localLaborRates[entry.id] || entry.hourlyRate;
      return sum + (parseFloat(currentRate) * parseFloat(entry.hoursLogged));
    }, 0);

    const materialsTotal = jobDetails.materials.reduce((sum, material) => {
      return sum + parseFloat(material.amount);
    }, 0);

    const subTradesTotal = jobDetails.subTrades.reduce((sum, subTrade) => {
      return sum + parseFloat(subTrade.amount);
    }, 0);

    const otherCostsTotal = jobDetails.otherCosts.reduce((sum, cost) => {
      return sum + parseFloat(cost.amount);
    }, 0);

    const tipFeesTotal = jobDetails.tipFees?.reduce((sum, tipFee) => {
      return sum + parseFloat(tipFee.totalAmount);
    }, 0) || 0;

    const subtotal = laborTotal + materialsTotal + subTradesTotal + otherCostsTotal + tipFeesTotal;
    const marginPercent = parseFloat(builderMargin) / 100;
    const marginAmount = subtotal * marginPercent;
    const subtotalWithMargin = subtotal + marginAmount;
    
    // Australian GST is 10%
    const gstAmount = subtotalWithMargin * 0.10;
    const total = subtotalWithMargin + gstAmount;

    return {
      laborTotal,
      materialsTotal,
      subTradesTotal,
      otherCostsTotal,
      tipFeesTotal,
      subtotal,
      marginAmount,
      subtotalWithMargin,
      gstAmount,
      total,
    };
  };

  // Auto-save handlers for job settings
  const handleBuilderMarginChange = (value: string) => {
    setBuilderMargin(value);
    if (value && !isNaN(parseFloat(value))) {
      debouncedUpdateJobSettings({ builderMargin: value });
    }
  };

  const handleDefaultRateChange = (value: string) => {
    setDefaultHourlyRate(value);
    if (value && !isNaN(parseFloat(value))) {
      debouncedUpdateJobSettings({ defaultHourlyRate: value });
    }
  };

  const handleExcludeFromTotalChange = (checked: boolean) => {
    setExcludeFromTotal(checked);
    debouncedUpdateJobSettings({ excludeFromTotal: checked });
  };

  // Debounced function to ask about updating all labor rates
  const debouncedAskAboutBulkUpdate = useCallback(
    debounce((value: string) => {
      if (jobDetails && jobDetails.laborEntries.length > 0) {
        const shouldUpdate = confirm(
          `Do you want to update all staff hourly rates to $${value}? This will change the rates for all ${jobDetails.laborEntries.length} staff members on this job.`
        );
        
        if (shouldUpdate) {
          // Update all labor entry rates
          const newRates: Record<string, string> = {};
          jobDetails.laborEntries.forEach(entry => {
            newRates[entry.id] = value;
          });
          setLocalLaborRates(newRates);
          setHasUnsavedRates(true);
        }
      }
    }, 1000), // Wait 1 second after user stops typing
    [jobDetails]
  );

  const handleDefaultRateInput = (value: string) => {
    handleDefaultRateChange(value);
    // Only ask about bulk update if the value is valid and not empty
    if (value && !isNaN(parseFloat(value)) && parseFloat(value) > 0) {
      debouncedAskAboutBulkUpdate(value);
    }
  };

  const handleDownloadPDF = async () => {
    if (!jobDetails) return;
    
    try {
      // Include timesheet data in the job details for PDF generation
      const jobWithTimesheets = {
        ...jobDetails,
        timesheets: jobTimesheets
      };
      
      // Pass attached files to PDF generator
      const attachmentFiles = jobFiles.map(file => ({
        id: file.id,
        originalName: file.originalName,
        objectPath: file.objectPath,
        googleDriveLink: file.googleDriveLink
      }));
      
      await generateJobPDF(jobWithTimesheets, attachmentFiles, swmsSignatures);
      toast({
        title: "Success",
        description: `PDF downloaded with ${attachmentFiles.length} attached document${attachmentFiles.length === 1 ? '' : 's'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  // Email PDF functionality
  const emailPDFMutation = useMutation({
    mutationFn: async (emailData: { to: string; subject: string; message: string; includeSwms?: boolean }) => {
      // Generate PDF client-side first
      if (!jobDetails) throw new Error("Job details not available");
      
      const jobWithTimesheets = {
        ...jobDetails,
        timesheets: jobTimesheets
      };
      
      const attachmentFiles = jobFiles.map(file => ({
        id: file.id,
        originalName: file.originalName,
        objectPath: file.objectPath,
        googleDriveLink: file.googleDriveLink
      }));
      
      // Generate PDF as base64 data
      const { generateJobPDFBase64 } = await import("@/lib/pdfGenerator");
      const pdfBase64 = await generateJobPDFBase64(jobWithTimesheets, attachmentFiles, swmsSignatures);
      
      // Send email data with PDF
      const response = await apiRequest("POST", `/api/jobs/${jobId}/email-pdf`, {
        to: emailData.to,
        subject: emailData.subject,
        message: emailData.message,
        pdfData: pdfBase64,
        includeSwms: emailData.includeSwms
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Job sheet PDF sent successfully",
      });
      setIsEmailDialogOpen(false);
      setEmailRecipient("");
      setEmailSubject("");
      setEmailMessage("");
      setIncludeSwmsInEmail(false);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to send PDF email",
        variant: "destructive",
      });
    },
  });

  // Job notes mutations
  const createNoteMutation = useMutation({
    mutationFn: async (noteText: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/notes`, {
        noteText: noteText.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "notes"] });
      setNewNoteText("");
      setIsAddingNote(false);
      toast({
        title: "Success",
        description: "Note added successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to add note",
        variant: "destructive",
      });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, noteText }: { id: string; noteText: string }) => {
      const response = await apiRequest("PATCH", `/api/job-notes/${id}`, {
        noteText: noteText.trim(),
      });
      return response.json();
    },
    onSuccess: () => {
      saveScrollPosition();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "notes"] });
      setEditingNote(null);
      setEditNoteText("");
      toast({
        title: "Success",
        description: "Note updated successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to update note",
        variant: "destructive",
      });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/job-notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "notes"] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleEmailPDF = () => {
    if (!jobDetails) return;
    
    // Pre-fill email subject with job details
    setEmailSubject(`Job Sheet - ${jobDetails.jobAddress} (${jobDetails.clientName})`);
    setEmailMessage(`Please find attached the job sheet for:\n\nAddress: ${jobDetails.jobAddress}\nClient: ${jobDetails.clientName}\nProject Manager: ${jobDetails.projectManager || 'N/A'}\n\nBest regards,\nMJR Builders`);
    setIsEmailDialogOpen(true);
  };

  const handleSendEmail = () => {
    if (!emailRecipient.trim()) {
      toast({
        title: "Email Required",
        description: "Please enter a recipient email address",
        variant: "destructive",
      });
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailRecipient.trim())) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    emailPDFMutation.mutate({
      to: emailRecipient.trim(),
      subject: emailSubject.trim() || `Job Sheet - ${jobDetails?.jobAddress}`,
      message: emailMessage.trim() || "Please find attached the job sheet PDF.",
      includeSwms: includeSwmsInEmail,
    });
  };

  // Save scroll position before mutations
  const saveScrollPosition = useCallback(() => {
    if (dialogContentRef.current) {
      const currentScrollTop = dialogContentRef.current.scrollTop;
      setScrollPosition(currentScrollTop);
    }
  }, []);

  // Restore scroll position after mutations
  const restoreScrollPosition = useCallback(() => {
    if (dialogContentRef.current && scrollPosition > 0) {
      // Use multiple requestAnimationFrame calls to ensure DOM has fully updated
      // and give time for React Query to finish re-rendering
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(() => {
            if (dialogContentRef.current) {
              dialogContentRef.current.scrollTop = scrollPosition;
            }
          }, 150); // Additional delay to ensure re-render is complete
        });
      });
    }
  }, [scrollPosition]);

  useEffect(() => {
    if (jobDetails) {
      setBuilderMargin(jobDetails.builderMargin);
      setDefaultHourlyRate(jobDetails.defaultHourlyRate);
      setExcludeFromTotal(jobDetails.excludeFromTotal || false);
      // Initialize local labor rates
      const rates: Record<string, string> = {};
      jobDetails.laborEntries.forEach(entry => {
        rates[entry.id] = entry.hourlyRate;
      });
      setLocalLaborRates(rates);
      setHasUnsavedRates(false);

      // Initialize edit form
      setEditForm({
        jobAddress: jobDetails.jobAddress || "",
        clientName: jobDetails.clientName || "",
        projectName: jobDetails.projectName || "",
        projectManager: jobDetails.projectManager || "",
        status: jobDetails.status || "",
      });
    }
  }, [jobDetails]);

  // Restore scroll position after data updates
  useEffect(() => {
    restoreScrollPosition();
  }, [jobDetails, jobFiles, jobTimesheets, jobNotes, restoreScrollPosition]);

  const handleEditSave = () => {
    if (!editForm.jobAddress.trim() || !editForm.clientName.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields (Job Address and Client Name)",
        variant: "destructive",
      });
      return;
    }

    updateJobMutation.mutate({
      jobAddress: editForm.jobAddress.trim(),
      clientName: editForm.clientName.trim(),
      projectName: editForm.projectName.trim(),
      projectManager: editForm.projectManager?.trim() || null,
      status: editForm.status as "new_job" | "job_in_progress" | "job_complete" | "ready_for_billing",
    });
    setIsEditing(false);
  };

  const handleEditCancel = () => {
    if (jobDetails) {
      setEditForm({
        jobAddress: jobDetails.jobAddress || "",
        clientName: jobDetails.clientName || "",
        projectName: jobDetails.projectName || "",
        projectManager: jobDetails.projectManager || "",
        status: jobDetails.status || "",
      });
    }
    setIsEditing(false);
  };

  const handleAddExtraHours = (laborEntryId: string) => {
    const hoursToAdd = extraHours[laborEntryId];
    if (!hoursToAdd || parseFloat(hoursToAdd) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid number of hours",
        variant: "destructive",
      });
      return;
    }

    addExtraHoursMutation.mutate({ 
      laborEntryId, 
      extraHours: hoursToAdd 
    }, {
      onSuccess: () => {
        // Clear the input after successful addition
        setExtraHours(prev => ({
          ...prev,
          [laborEntryId]: ""
        }));
      }
    });
  };

  // Helper functions for editing labor hours (admin only)
  const startEditingLaborHours = (entry: LaborEntry) => {
    if (!isAdmin) return;
    setEditingLaborEntry(entry.id);
    setEditLaborHours(entry.hoursLogged);
  };

  const cancelEditingLaborHours = () => {
    setEditingLaborEntry(null);
    setEditLaborHours("");
  };

  const saveEditingLaborHours = () => {
    if (!editingLaborEntry || !editLaborHours) return;
    
    const hours = parseFloat(editLaborHours);
    if (isNaN(hours) || hours < 0) {
      toast({
        title: "Invalid Hours",
        description: "Please enter a valid number of hours (0 or greater)",
        variant: "destructive",
      });
      return;
    }

    // Find the current labor entry to show current hours in confirmation
    const currentEntry = jobDetails?.laborEntries.find(entry => entry.id === editingLaborEntry);
    const currentHours = currentEntry ? parseFloat(currentEntry.hoursLogged) : 0;
    const newHours = hours;
    const staffName = (currentEntry as any)?.staff?.name || currentEntry?.staffId || 'Unknown Staff';

    // Show confirmation dialog to prevent accidental edits
    const confirmChange = confirm(
      `Are you sure you want to change ${staffName}'s hours?\n\n` +
      `Current hours: ${currentHours} hrs\n` +
      `New hours: ${newHours} hrs\n\n` +
      `This will update the job sheet and affect the total cost.`
    );

    if (!confirmChange) {
      return; // User cancelled, don't save
    }

    updateLaborHoursMutation.mutate({
      laborEntryId: editingLaborEntry,
      hoursLogged: editLaborHours
    });
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        ref={dialogContentRef}
        className="sm:max-w-6xl sm:max-h-[95vh] 
                   max-sm:!fixed max-sm:!inset-0 max-sm:!w-screen max-sm:!h-screen max-sm:!max-w-none max-sm:!max-h-none 
                   max-sm:!rounded-none max-sm:!border-0 max-sm:!m-0 max-sm:!p-0 max-sm:!translate-x-0 max-sm:!translate-y-0 
                   max-sm:!left-0 max-sm:!top-0 max-sm:!z-[60]
                   overflow-hidden flex flex-col !bg-white" 
        style={{ WebkitOverflowScrolling: 'touch' }}
        aria-describedby="job-sheet-description"
      >
        <div id="job-sheet-description" className="sr-only">
          Job sheet details, costs, and management interface
        </div>
        <DialogHeader className="flex-shrink-0 pb-4 border-b max-sm:px-4 max-sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="shrink-0 sm:hidden h-8 w-8"
                data-testid="close-job-sheet-mobile"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                {!isEditing ? (
                  <>
                    <DialogTitle data-testid="text-job-sheet-title" className="text-lg sm:text-xl font-semibold truncate">
                      {jobDetails ? `${jobDetails.projectName} - ${jobDetails.clientName}` : "Loading..."}
                    </DialogTitle>
                    <p className="text-gray-600 text-sm truncate" data-testid="text-job-address">
                      {jobDetails?.jobAddress}
                    </p>
                    <p id="job-sheet-description" className="text-xs text-muted-foreground mt-1">
                      Manage job details, costs, and generate PDF reports
                    </p>
                  </>
                ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="edit-address" className="text-sm font-medium">Job Address</Label>
                    <Input
                      id="edit-address"
                      value={editForm.jobAddress}
                      onChange={(e) => setEditForm(prev => ({ ...prev, jobAddress: e.target.value }))}
                      placeholder="Enter job address"
                      className="mt-1"
                      data-testid="input-edit-address"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-sm font-medium">Client Name</Label>
                      <div className="mt-1 space-y-2">
                        {!isAddingNewClient ? (
                          <Select onValueChange={handleClientChange} value={editForm.clientName}>
                            <SelectTrigger data-testid="select-edit-client">
                              <SelectValue placeholder="Select or add client" />
                            </SelectTrigger>
                            <SelectContent>
                              {clientNames.filter(client => client && client.trim() !== '').map((client) => (
                                <SelectItem key={client} value={client}>
                                  {client}
                                </SelectItem>
                              ))}
                              <SelectItem value="__add_new__" className="text-primary font-medium">
                                + Add New Client
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter new client name"
                              value={newClientName}
                              onChange={(e) => setNewClientName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddClient();
                                } else if (e.key === 'Escape') {
                                  setIsAddingNewClient(false);
                                  setNewClientName("");
                                }
                              }}
                              className="flex-1"
                              data-testid="input-new-edit-client"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddClient}
                              disabled={!newClientName.trim()}
                              data-testid="button-add-edit-client"
                            >
                              Add
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsAddingNewClient(false);
                                setNewClientName("");
                              }}
                              data-testid="button-cancel-edit-client"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Project Manager</Label>
                      <div className="mt-1 space-y-2">
                        {!isAddingNewProjectManager ? (
                          <Select onValueChange={handleProjectManagerChange} value={editForm.projectManager}>
                            <SelectTrigger data-testid="select-edit-manager">
                              <SelectValue placeholder="Select or add project manager" />
                            </SelectTrigger>
                            <SelectContent>
                              {projectManagers.filter(manager => manager && manager.trim() !== '').map((manager) => (
                                <SelectItem key={manager} value={manager}>
                                  {manager}
                                </SelectItem>
                              ))}
                              <SelectItem value="__add_new__" className="text-primary font-medium">
                                + Add New Project Manager
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              placeholder="Enter new project manager name"
                              value={newProjectManagerName}
                              onChange={(e) => setNewProjectManagerName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddProjectManager();
                                } else if (e.key === 'Escape') {
                                  setIsAddingNewProjectManager(false);
                                  setNewProjectManagerName("");
                                }
                              }}
                              className="flex-1"
                              data-testid="input-new-edit-manager"
                              autoFocus
                            />
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAddProjectManager}
                              disabled={!newProjectManagerName.trim()}
                              data-testid="button-add-edit-manager"
                            >
                              Add
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsAddingNewProjectManager(false);
                                setNewProjectManagerName("");
                              }}
                              data-testid="button-cancel-edit-manager"
                            >
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose} className="hidden sm:block" size="sm" data-testid="button-close-modal">
                <X className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Orientation toggle for job sheets */}
        <OrientationToggle show={true} />
        
        <div className="flex-1 overflow-y-auto min-h-0 relative" style={{ WebkitOverflowScrolling: 'touch' }}>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : !jobDetails ? (
            <div className="text-center py-8 text-gray-500">
              Job not found
            </div>
          ) : (
            <div className="space-y-6 p-4 sm:p-6" style={{ WebkitOverflowScrolling: 'touch' }}>
            

            
            {/* Labour Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-labor-section-title">Labour</CardTitle>
                  <div className="flex gap-2">
                    {hasUnsavedRates && (
                      <Button 
                        onClick={saveAllLaborRates}
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-save-rates"
                      >
                        Save Changes
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => window.location.reload()}
                      data-testid="button-refresh-labor"
                      title="Sync all staff to this job"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => setShowEmployeeManager(true)}
                      data-testid="button-manage-employees"
                      title="Manage employees"
                      className="border-blue-200 text-blue-600 hover:bg-blue-50"
                    >
                      <Users className="h-4 w-4 mr-1" />
                      <span className="text-xs">Staff</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm font-medium text-gray-700">
                        <th className="pb-3">Staff Member</th>
                        <th className="pb-3">Hourly Rate</th>
                        <th className="pb-3">Hours Logged</th>
                        <th className="pb-3">Add Extra Hours</th>
                        <th className="pb-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {getSortedLaborEntries(jobDetails.laborEntries).map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-100 group">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-medium text-primary">
                                  {((entry as any).staff?.name || entry.staffId).charAt(0).toUpperCase()}
                                </span>
                              </div>
                              <span className="font-medium" data-testid={`text-labor-staff-${entry.id}`}>
                                {(entry as any).staff?.name || entry.staffId}
                              </span>
                            </div>
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-1">
                              <span className="text-sm text-gray-500">$</span>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={localLaborRates[entry.id] || entry.hourlyRate}
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setLocalLaborRates(prev => ({
                                    ...prev,
                                    [entry.id]: newValue
                                  }));
                                  setHasUnsavedRates(true);
                                }}
                                className="w-20 text-sm border-0 bg-transparent focus:bg-white focus:border focus:border-primary rounded px-2 py-1"
                                data-testid={`input-labor-rate-${entry.id}`}
                              />
                              <span className="text-sm text-gray-500">/hr</span>
                            </div>
                          </td>
                          <td className="py-3">
                            {isAdmin && editingLaborEntry === entry.id ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  value={editLaborHours}
                                  onChange={(e) => setEditLaborHours(e.target.value)}
                                  className="w-20 text-sm border border-primary rounded px-2 py-1"
                                  data-testid={`input-edit-hours-${entry.id}`}
                                  autoFocus
                                />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={saveEditingLaborHours}
                                  disabled={updateLaborHoursMutation.isPending}
                                  className="h-7 px-2 text-xs"
                                  data-testid={`button-save-hours-${entry.id}`}
                                >
                                  {updateLaborHoursMutation.isPending ? "..." : "Save"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={cancelEditingLaborHours}
                                  className="h-7 px-2 text-xs"
                                  data-testid={`button-cancel-hours-${entry.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600 font-medium" data-testid={`text-labor-hours-${entry.id}`}>
                                  {entry.hoursLogged} hrs
                                </span>
                                {isAdmin && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingLaborHours(entry)}
                                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                    data-testid={`button-edit-hours-${entry.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                placeholder="0"
                                value={extraHours[entry.id] || ""}
                                onChange={(e) => {
                                  setExtraHours(prev => ({
                                    ...prev,
                                    [entry.id]: e.target.value
                                  }));
                                }}
                                className="w-16 text-sm border border-gray-300 rounded px-2 py-1"
                                data-testid={`input-extra-hours-${entry.id}`}
                              />
                              <Button
                                size="sm"
                                onClick={() => handleAddExtraHours(entry.id)}
                                disabled={!extraHours[entry.id] || parseFloat(extraHours[entry.id]) <= 0 || addExtraHoursMutation.isPending}
                                className="h-8 px-2 text-xs"
                                data-testid={`button-add-extra-hours-${entry.id}`}
                              >
                                {addExtraHoursMutation.isPending ? "..." : "Add"}
                              </Button>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="font-semibold text-primary" data-testid={`text-labor-total-${entry.id}`}>
                              ${(parseFloat(localLaborRates[entry.id] || entry.hourlyRate) * parseFloat(entry.hoursLogged)).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between items-center mt-4 pt-3 border-t border-gray-200">
                  <div className="text-left">
                    <span className="text-lg font-semibold text-gray-700" data-testid="text-total-hours">
                      Total Hours: {jobDetails.laborEntries.reduce((total, entry) => total + parseFloat(entry.hoursLogged), 0)} hrs
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-semibold" data-testid="text-labor-total">
                      Labour Total: ${totals.laborTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Materials Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-materials-section-title">Materials</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      const description = prompt("Enter material description:");
                      const supplier = prompt("Enter supplier:");
                      const amount = prompt("Enter amount:");
                      const invoiceDate = prompt("Enter invoice date (e.g., 8/08):");
                      if (description && supplier && amount && invoiceDate) {
                        addMaterialMutation.mutate({ description, supplier, amount, invoiceDate });
                      }
                    }}
                    data-testid="button-add-material"
                  >
                    <i className="fas fa-plus"></i>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm font-medium text-gray-700">
                        <th className="pb-3">Description</th>
                        <th className="pb-3">Supplier</th>
                        <th className="pb-3">Invoice Date</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {jobDetails.materials.map((material) => (
                        <tr key={material.id}>
                          {editingMaterial === material.id ? (
                            <>
                              <td className="py-2">
                                <Input
                                  value={editMaterialForm.description}
                                  onChange={(e) => setEditMaterialForm(prev => ({ ...prev, description: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-material-description-${material.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  value={editMaterialForm.supplier}
                                  onChange={(e) => setEditMaterialForm(prev => ({ ...prev, supplier: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-material-supplier-${material.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  value={editMaterialForm.invoiceDate}
                                  onChange={(e) => setEditMaterialForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-material-date-${material.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editMaterialForm.amount}
                                  onChange={(e) => setEditMaterialForm(prev => ({ ...prev, amount: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-material-amount-${material.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={handleUpdateMaterial}
                                    disabled={updateMaterialMutation.isPending}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-save-material-${material.id}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingMaterial(null)}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-cancel-material-${material.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2" data-testid={`text-material-description-${material.id}`}>
                                {material.description}
                              </td>
                              <td className="py-2" data-testid={`text-material-supplier-${material.id}`}>
                                {material.supplier}
                              </td>
                              <td className="py-2" data-testid={`text-material-date-${material.id}`}>
                                {material.invoiceDate}
                              </td>
                              <td className="py-2" data-testid={`text-material-amount-${material.id}`}>
                                ${parseFloat(material.amount).toFixed(2)}
                              </td>
                              <td className="py-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingMaterial(material)}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-edit-material-${material.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                        data-testid={`button-delete-material-${material.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Material</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this material entry? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteMaterialMutation.mutate(material.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-materials-total">
                    Materials Total: ${totals.materialsTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Sub Trades Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-subtrades-section-title">Sub Trades</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      const trade = prompt("Enter trade type:");
                      const contractor = prompt("Enter contractor:");
                      const amount = prompt("Enter amount:");
                      const invoiceDate = prompt("Enter invoice date (e.g., 8/08):");
                      if (trade && contractor && amount && invoiceDate) {
                        addSubTradeMutation.mutate({ trade, contractor, amount, invoiceDate });
                      }
                    }}
                    data-testid="button-add-subtrade"
                  >
                    <i className="fas fa-plus"></i>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="text-left text-sm font-medium text-gray-700">
                        <th className="pb-3">Trade</th>
                        <th className="pb-3">Contractor</th>
                        <th className="pb-3">Invoice Date</th>
                        <th className="pb-3">Amount</th>
                        <th className="pb-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {jobDetails.subTrades.map((subTrade) => (
                        <tr key={subTrade.id}>
                          {editingSubTrade === subTrade.id ? (
                            <>
                              <td className="py-2">
                                <Input
                                  value={editSubTradeForm.trade}
                                  onChange={(e) => setEditSubTradeForm(prev => ({ ...prev, trade: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-subtrade-trade-${subTrade.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  value={editSubTradeForm.contractor}
                                  onChange={(e) => setEditSubTradeForm(prev => ({ ...prev, contractor: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-subtrade-contractor-${subTrade.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  value={editSubTradeForm.invoiceDate}
                                  onChange={(e) => setEditSubTradeForm(prev => ({ ...prev, invoiceDate: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-subtrade-date-${subTrade.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={editSubTradeForm.amount}
                                  onChange={(e) => setEditSubTradeForm(prev => ({ ...prev, amount: e.target.value }))}
                                  className="text-sm"
                                  data-testid={`input-edit-subtrade-amount-${subTrade.id}`}
                                />
                              </td>
                              <td className="py-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    onClick={handleUpdateSubTrade}
                                    disabled={updateSubTradeMutation.isPending}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-save-subtrade-${subTrade.id}`}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingSubTrade(null)}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-cancel-subtrade-${subTrade.id}`}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-2" data-testid={`text-subtrade-trade-${subTrade.id}`}>
                                {subTrade.trade}
                              </td>
                              <td className="py-2" data-testid={`text-subtrade-contractor-${subTrade.id}`}>
                                {subTrade.contractor}
                              </td>
                              <td className="py-2" data-testid={`text-subtrade-date-${subTrade.id}`}>
                                {subTrade.invoiceDate}
                              </td>
                              <td className="py-2" data-testid={`text-subtrade-amount-${subTrade.id}`}>
                                ${parseFloat(subTrade.amount).toFixed(2)}
                              </td>
                              <td className="py-2">
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => startEditingSubTrade(subTrade)}
                                    className="h-7 px-2 text-xs"
                                    data-testid={`button-edit-subtrade-${subTrade.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                        data-testid={`button-delete-subtrade-${subTrade.id}`}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Sub Trade</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this sub trade entry? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteSubTradeMutation.mutate(subTrade.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-subtrades-total">
                    Sub Trades Total: ${totals.subTradesTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Other Costs Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-other-costs-title">Other Costs</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const description = prompt("Enter cost description:");
                      const amount = prompt("Enter amount:");
                      if (description && amount && !isNaN(parseFloat(amount))) {
                        addOtherCostMutation.mutate({
                          description: description.trim(),
                          amount: parseFloat(amount).toString()
                        });
                      }
                    }}
                    data-testid="button-add-other-cost"
                  >
                    <i className="fas fa-plus mr-1"></i>
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobDetails?.otherCosts?.map((cost) => (
                  <div key={cost.id} className="flex justify-between items-center p-2 border rounded">
                    {editingOtherCost === cost.id ? (
                      <div className="flex w-full gap-2 items-center">
                        <Input
                          value={editOtherCostForm.description}
                          onChange={(e) => setEditOtherCostForm(prev => ({ ...prev, description: e.target.value }))}
                          className="text-sm flex-1"
                          placeholder="Description"
                          data-testid={`input-edit-other-cost-description-${cost.id}`}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={editOtherCostForm.amount}
                            onChange={(e) => setEditOtherCostForm(prev => ({ ...prev, amount: e.target.value }))}
                            className="text-sm w-24"
                            data-testid={`input-edit-other-cost-amount-${cost.id}`}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={handleUpdateOtherCost}
                            disabled={updateOtherCostMutation.isPending}
                            className="h-7 px-2 text-xs"
                            data-testid={`button-save-other-cost-${cost.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingOtherCost(null)}
                            className="h-7 px-2 text-xs"
                            data-testid={`button-cancel-other-cost-${cost.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <span data-testid={`text-other-cost-description-${cost.id}`}>{cost.description}</span>
                        <div className="flex items-center gap-2">
                          <span data-testid={`text-other-cost-amount-${cost.id}`}>${parseFloat(cost.amount).toFixed(2)}</span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingOtherCost(cost)}
                              className="h-7 px-2 text-xs"
                              data-testid={`button-edit-other-cost-${cost.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                  data-testid={`button-delete-other-cost-${cost.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Other Cost</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this other cost entry? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteOtherCostMutation.mutate(cost.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {(!jobDetails?.otherCosts || jobDetails.otherCosts.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No other costs added yet</p>
                )}
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-other-costs-total">
                    Other Costs Total: ${totals.otherCostsTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Tip Fees Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-tip-fees-title">Tip Fees</CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      const description = prompt("Enter tip fee description:");
                      const amount = prompt("Enter tip fee amount (cartage 20% will be added automatically):");
                      if (description && amount && !isNaN(parseFloat(amount))) {
                        addTipFeeMutation.mutate({
                          description: description.trim(),
                          amount: parseFloat(amount).toString()
                        });
                      }
                    }}
                    data-testid="button-add-tip-fee"
                  >
                    <i className="fas fa-plus mr-1"></i>
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {jobDetails?.tipFees?.map((tipFee) => (
                  <div key={tipFee.id} className="flex justify-between items-center p-2 border rounded">
                    {editingTipFee === tipFee.id ? (
                      <div className="flex w-full gap-2 items-center">
                        <Input
                          value={editTipFeeForm.description}
                          onChange={(e) => setEditTipFeeForm(prev => ({ ...prev, description: e.target.value }))}
                          className="text-sm flex-1"
                          placeholder="Description"
                          data-testid={`input-edit-tip-fee-description-${tipFee.id}`}
                        />
                        <div className="flex items-center gap-1">
                          <span className="text-sm">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            value={editTipFeeForm.amount}
                            onChange={(e) => setEditTipFeeForm(prev => ({ ...prev, amount: e.target.value }))}
                            className="text-sm w-24"
                            placeholder="Base amount"
                            data-testid={`input-edit-tip-fee-amount-${tipFee.id}`}
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={handleUpdateTipFee}
                            disabled={updateTipFeeMutation.isPending}
                            className="h-7 px-2 text-xs"
                            data-testid={`button-save-tip-fee-${tipFee.id}`}
                          >
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingTipFee(null)}
                            className="h-7 px-2 text-xs"
                            data-testid={`button-cancel-tip-fee-${tipFee.id}`}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col">
                          <span data-testid={`text-tip-fee-description-${tipFee.id}`}>{tipFee.description}</span>
                          <div className="text-xs text-gray-500">
                            Base: ${parseFloat(tipFee.amount).toFixed(2)} + 20% cartage: ${parseFloat(tipFee.cartageAmount).toFixed(2)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold" data-testid={`text-tip-fee-total-${tipFee.id}`}>
                            ${parseFloat(tipFee.totalAmount).toFixed(2)}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => startEditingTipFee(tipFee)}
                              className="h-7 px-2 text-xs"
                              data-testid={`button-edit-tip-fee-${tipFee.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-red-600 hover:text-red-700"
                                  data-testid={`button-delete-tip-fee-${tipFee.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Tip Fee</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this tip fee entry? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteTipFeeMutation.mutate(tipFee.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
                {(!jobDetails?.tipFees || jobDetails.tipFees.length === 0) && (
                  <p className="text-gray-500 text-center py-4">No tip fees added yet</p>
                )}
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-tip-fees-total">
                    Tip Fees Total: ${totals.tipFeesTotal.toFixed(2)}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Timesheets Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2" data-testid="text-timesheets-title">
                    <Clock className="h-5 w-5" />
                    Timesheet Entries
                  </CardTitle>
                  <div className="text-sm text-muted-foreground">
                    {jobTimesheets.length} entries found
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {jobTimesheets.length > 0 ? (
                  <div className="space-y-4">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left">
                            <th className="pb-2 font-medium">Date</th>
                            <th className="pb-2 font-medium">Staff Member</th>
                            <th className="pb-2 font-medium">Hours</th>
                            <th className="pb-2 font-medium">Materials/Notes</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobTimesheets
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                            .map((entry) => (
                            <tr key={entry.id} className={`border-b ${entry.entryType === 'manual' ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                              <td className="py-2" data-testid={`timesheet-date-${entry.id}`}>
                                {new Date(entry.date).toLocaleDateString()}
                              </td>
                              <td className="py-2" data-testid={`timesheet-staff-${entry.id}`}>
                                <div className="flex flex-col">
                                  <span>{entry.staffName || entry.staffEmail || 'Unknown Staff'}</span>
                                  {entry.entryType === 'manual' && (
                                    <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                      Manually entered by {entry.enteredByName || 'Admin'}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2 font-medium" data-testid={`timesheet-hours-${entry.id}`}>
                                <div className="flex items-center gap-2">
                                  <span>{parseFloat(entry.hours).toFixed(1)}h</span>
                                  {entry.entryType === 'manual' && (
                                    <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                                      Manual
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-2" data-testid={`timesheet-materials-${entry.id}`}>
                                {entry.materials || entry.description || '-'}
                              </td>
                              <td className="py-2" data-testid={`timesheet-status-${entry.id}`}>
                                <span className={`px-2 py-1 rounded-full text-xs ${
                                  entry.approved 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {entry.entryType === 'manual' ? 'Applied' : 
                                   entry.approved ? 'Approved' : 'Pending'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t">
                      <span className="text-gray-700">Total Hours Logged:</span>
                      <span className="font-semibold text-lg" data-testid="text-total-timesheet-hours">
                        {jobTimesheets.reduce((total, entry) => total + parseFloat(entry.hours), 0).toFixed(1)}h
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-700">Approved Hours:</span>
                      <span className="font-semibold" data-testid="text-approved-timesheet-hours">
                        {jobTimesheets.filter(entry => entry.approved).reduce((total, entry) => total + parseFloat(entry.hours), 0).toFixed(1)}h
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No timesheet entries found for this job</p>
                    <p className="text-sm mt-1">Staff can log hours for this job in their timesheet</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Totals and Margin Section */}
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle className="text-xl" data-testid="text-totals-title">
                  Job Totals & Billing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Labour:</span>
                      <span className="font-semibold" data-testid="text-final-labor-total">
                        ${totals.laborTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Materials:</span>
                      <span className="font-semibold" data-testid="text-final-materials-total">
                        ${totals.materialsTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Sub Trades:</span>
                      <span className="font-semibold" data-testid="text-final-subtrades-total">
                        ${totals.subTradesTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Other Costs:</span>
                      <span className="font-semibold" data-testid="text-final-other-total">
                        ${totals.otherCostsTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Tip Fees (inc. cartage):</span>
                      <span className="font-semibold" data-testid="text-final-tip-fees-total">
                        ${totals.tipFeesTotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3 bg-gray-50 px-4 rounded">
                      <span className="font-semibold text-gray-800">Subtotal:</span>
                      <span className="font-bold text-lg" data-testid="text-subtotal">
                        ${totals.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="defaultHourlyRate">Default Hourly Rate ($)</Label>
                      <Input
                        id="defaultHourlyRate"
                        type="number"
                        value={defaultHourlyRate}
                        onChange={(e) => handleDefaultRateInput(e.target.value)}
                        className="text-lg"
                        data-testid="input-default-hourly-rate"
                      />
                    </div>
                    <div>
                      <Label htmlFor="builderMargin">Builder's Margin (%)</Label>
                      <Input
                        id="builderMargin"
                        type="number"
                        value={builderMargin}
                        onChange={(e) => handleBuilderMarginChange(e.target.value)}
                        className="text-lg"
                        data-testid="input-builder-margin"
                      />
                    </div>
                    <div className="flex items-center space-x-3 py-3 px-4 rounded-lg bg-amber-50 border border-amber-200">
                      <Checkbox
                        id="excludeFromTotal"
                        checked={excludeFromTotal}
                        onCheckedChange={handleExcludeFromTotalChange}
                        data-testid="checkbox-exclude-from-total"
                      />
                      <Label 
                        htmlFor="excludeFromTotal" 
                        className="text-sm font-medium text-amber-800 cursor-pointer"
                      >
                        Exclude from Dashboard Total
                      </Label>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Margin Amount:</span>
                      <span className="font-semibold" data-testid="text-margin-amount">
                        ${totals.marginAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Subtotal + Margin:</span>
                      <span className="font-semibold" data-testid="text-subtotal-with-margin">
                        ${totals.subtotalWithMargin.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">GST (10%):</span>
                      <span className="font-semibold" data-testid="text-gst-amount">
                        ${totals.gstAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-4 bg-primary text-white px-4 rounded-lg">
                      <span className="font-bold text-lg">Total Amount (inc. GST):</span>
                      <span className="font-bold text-2xl" data-testid="text-total-amount">
                        ${totals.total.toFixed(2)}
                      </span>
                    </div>

                  </div>
                </div>
              </CardContent>
            </Card>

            {/* File Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Upload Area */}
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <ObjectUploader
                      maxNumberOfFiles={5}
                      maxFileSize={10485760} // 10MB
                      onGetUploadParameters={handleGetUploadParameters}
                      onComplete={handleFileUploadComplete}
                      buttonClassName="w-full"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="h-8 w-8 text-gray-400" />
                        <span className="text-lg font-medium">Drop files here or click to upload</span>
                        <span className="text-sm text-gray-500">PDF, Word, Excel, Images (Max 10MB each)</span>
                      </div>
                    </ObjectUploader>
                  </div>

                  {/* File List */}
                  {jobFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm text-gray-700">Uploaded Files</h4>
                      <div className="space-y-2">
                        {jobFiles.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <FileText className="h-4 w-4 text-gray-500 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate" title={file.originalName}>
                                  {file.originalName}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {(file.fileSize / 1024 / 1024).toFixed(2)} MB • {new Date(file.createdAt || '').toLocaleDateString()}
                                  {file.googleDriveLink && <span className="text-blue-600 ml-2">📎 Google Drive</span>}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadFile(file)}
                                data-testid={`button-download-file-${file.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteFile(file.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                disabled={deleteFileMutation.isPending}
                                data-testid={`button-delete-file-${file.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {jobFiles.length === 0 && (
                    <div className="text-center py-4 text-gray-500 text-sm">
                      No documents uploaded yet
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Job Notes Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-800" data-testid="text-notes-section-title">
                    Job Notes
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingNote(true)}
                    data-testid="button-add-note"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Add new note form */}
                  {isAddingNote && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="space-y-3">
                        <Textarea
                          placeholder="Enter your note..."
                          value={newNoteText}
                          onChange={(e) => setNewNoteText(e.target.value)}
                          className="min-h-[100px] resize-none"
                          data-testid="textarea-new-note"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              if (newNoteText.trim()) {
                                createNoteMutation.mutate(newNoteText);
                              }
                            }}
                            disabled={!newNoteText.trim() || createNoteMutation.isPending}
                            data-testid="button-save-note"
                          >
                            {createNoteMutation.isPending ? "Saving..." : "Save Note"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setIsAddingNote(false);
                              setNewNoteText("");
                            }}
                            data-testid="button-cancel-note"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes list */}
                  {jobNotes.length > 0 ? (
                    <div className="space-y-3">
                      {jobNotes.map((note) => (
                        <div key={note.id} className="border border-gray-200 rounded-lg p-4 bg-white">
                          {editingNote === note.id ? (
                            <div className="space-y-3">
                              <Textarea
                                value={editNoteText}
                                onChange={(e) => setEditNoteText(e.target.value)}
                                className="min-h-[100px] resize-none"
                                data-testid={`textarea-edit-note-${note.id}`}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    if (editNoteText.trim()) {
                                      updateNoteMutation.mutate({
                                        id: note.id,
                                        noteText: editNoteText,
                                      });
                                    }
                                  }}
                                  disabled={!editNoteText.trim() || updateNoteMutation.isPending}
                                  data-testid={`button-save-edit-note-${note.id}`}
                                >
                                  {updateNoteMutation.isPending ? "Saving..." : "Save"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingNote(null);
                                    setEditNoteText("");
                                  }}
                                  data-testid={`button-cancel-edit-note-${note.id}`}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">
                                    {note.user?.employee?.name ||
                                     (note.user?.firstName && note.user?.lastName 
                                       ? `${note.user.firstName} ${note.user.lastName}`
                                       : note.user?.email?.split('@')[0] || 'Unknown User'
                                     )
                                    }
                                  </span>
                                  <span className="mx-2">•</span>
                                  <span>{note.createdAt ? new Date(note.createdAt).toLocaleString() : 'Unknown date'}</span>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setEditingNote(note.id);
                                      setEditNoteText(note.noteText);
                                    }}
                                    className="h-6 w-6 p-0"
                                    data-testid={`button-edit-note-${note.id}`}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      if (confirm("Are you sure you want to delete this note?")) {
                                        deleteNoteMutation.mutate(note.id);
                                      }
                                    }}
                                    className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                                    data-testid={`button-delete-note-${note.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-gray-800 whitespace-pre-wrap" data-testid={`text-note-content-${note.id}`}>
                                {note.noteText}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    !isAddingNote && (
                      <div className="text-center py-8 text-gray-500">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p className="text-sm" data-testid="text-no-notes">No notes added yet</p>
                        <p className="text-xs text-gray-400 mt-1">Click the + button to add your first note</p>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>

            {/* SWMS Signatures Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-green-600" />
                    <CardTitle className="text-lg font-semibold text-gray-800">
                      SWMS Compliance Records
                    </CardTitle>
                  </div>
                  {/* Sign SWMS button - shown if user has unsigned templates */}
                  {swmsCheckData && !swmsCheckData.allSigned && swmsCheckData.unsignedCount > 0 && (
                    <Button
                      onClick={() => {
                        console.log('📝 Sign SWMS button clicked, setting showSwmsSigningModal to true');
                        setShowSwmsSigningModal(true);
                      }}
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600"
                    >
                      <FileSignature className="h-4 w-4 mr-2" />
                      Sign SWMS ({swmsCheckData.unsignedCount})
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {swmsSignatures.length > 0 ? (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600 mb-4">
                      The following staff members have signed Safe Work Method Statements for this job:
                    </p>
                    {/* Mobile-friendly card layout */}
                    <div className="space-y-2">
                      {swmsSignatures.map((sig) => (
                        <div key={sig.id} className="border rounded-lg p-3 bg-gray-50/50">
                          <div className="flex items-start gap-2 mb-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className={`font-medium text-sm truncate ${sig.templateActive ? "text-gray-900" : "text-gray-500"}`}>
                                {sig.templateTitle}
                              </p>
                              {!sig.templateActive && (
                                <span className="text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded inline-block mt-1">
                                  Archived
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm pl-6">
                            <div>
                              <span className="text-gray-500 text-xs">Signed by:</span>
                              <p className="text-gray-900 font-medium">{sig.signerName}</p>
                            </div>
                            <div>
                              <span className="text-gray-500 text-xs">Role:</span>
                              <p className="text-gray-700">{sig.occupation}</p>
                            </div>
                            <div className="col-span-2 mt-1">
                              <span className="text-gray-500 text-xs">Date:</span>
                              <p className="text-gray-600 text-xs">
                                {new Date(sig.signedAt).toLocaleDateString('en-AU', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Download SWMS Package Button */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                      <Button
                        onClick={() => {
                          window.open(`/api/swms/job/${jobDetails?.id}/combined-pdf`, '_blank');
                        }}
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download SWMS Package (with signatures)
                      </Button>
                      <p className="text-xs text-gray-500 mt-2">
                        Downloads all SWMS documents with digital signature proof for compliance records.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <Shield className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No SWMS signatures recorded for this job yet.</p>
                    {swmsCheckData && !swmsCheckData.allSigned && swmsCheckData.unsignedCount > 0 && (
                      <p className="text-xs text-gray-400 mt-1">
                        Click the "Sign SWMS" button above to sign safety documents.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Action Buttons - Fixed at bottom of content area - v2 */}
            <div className="flex flex-col sm:flex-row gap-3 w-full pt-4 border-t border-gray-200 mt-6 bg-white" id="bottom-action-buttons">
              {!isEditing ? (
                <>
                  <Button 
                    onClick={() => setIsEditing(true)}
                    variant="outline"
                    size="sm"
                    disabled={!jobDetails}
                    data-testid="button-edit-job"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                  <Button 
                    onClick={handleDownloadPDF}
                    className="bg-secondary hover:bg-green-700 w-full sm:w-auto"
                    size="sm"
                    disabled={!jobDetails}
                    data-testid="button-download-pdf"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button 
                    onClick={handleEmailPDF}
                    className="bg-blue-600 hover:bg-blue-700 w-full sm:w-auto"
                    size="sm"
                    disabled={!jobDetails}
                    data-testid="button-email-pdf"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Email PDF
                  </Button>
                  <Button 
                    variant="destructive"
                    size="sm"
                    disabled={!jobDetails}
                    onClick={handleDeleteJobClick}
                    data-testid="button-delete-job"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Job
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={handleEditSave}
                    size="sm"
                    disabled={updateJobMutation.isPending}
                    data-testid="button-save-edit"
                  >
                    <Clock className="h-4 w-4 mr-2" />
                    {updateJobMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                  <Button 
                    onClick={handleEditCancel}
                    variant="outline"
                    size="sm"
                    data-testid="button-cancel-edit"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                </>
              )}
            </div>
            </div>
          )}
        </div>
      </DialogContent>
      </Dialog>
      
      
      {/* Email PDF Dialog */}
      <Dialog open={isEmailDialogOpen} onOpenChange={setIsEmailDialogOpen}>
        <DialogContent className="max-w-md max-sm:max-w-[95vw] max-sm:max-h-[90vh] max-sm:m-2">
          <DialogHeader>
            <DialogTitle className="text-lg max-sm:text-base">Email Job Sheet PDF</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Send the job sheet PDF via email to specified recipients
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-sm:space-y-3">
            <div>
              <Label htmlFor="email-recipient" className="text-sm max-sm:text-xs">Recipient Email</Label>
              <Input
                id="email-recipient"
                type="email"
                placeholder="Enter email address"
                value={emailRecipient}
                onChange={(e) => setEmailRecipient(e.target.value)}
                className="max-sm:text-sm max-sm:h-10"
                data-testid="input-email-recipient"
              />
            </div>
            <div>
              <Label htmlFor="email-subject" className="text-sm max-sm:text-xs">Subject</Label>
              <Input
                id="email-subject"
                placeholder="Email subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="max-sm:text-sm max-sm:h-10"
                data-testid="input-email-subject"
              />
            </div>
            <div>
              <Label htmlFor="email-message" className="text-sm max-sm:text-xs">Message</Label>
              <Textarea
                id="email-message"
                placeholder="Email message"
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                rows={4}
                className="max-sm:text-sm max-sm:h-20 resize-none"
                data-testid="textarea-email-message"
              />
            </div>
            {/* Include SWMS Package Option */}
            {swmsSignatures.length > 0 && (
              <div className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                <Checkbox
                  id="include-swms"
                  checked={includeSwmsInEmail}
                  onCheckedChange={(checked) => setIncludeSwmsInEmail(checked === true)}
                />
                <div className="flex-1">
                  <Label htmlFor="include-swms" className="text-sm font-medium cursor-pointer">
                    Include SWMS Package
                  </Label>
                  <p className="text-xs text-gray-500">
                    Attach signed SWMS documents with signature proof ({swmsSignatures.length} signature{swmsSignatures.length > 1 ? 's' : ''})
                  </p>
                </div>
              </div>
            )}
            <div className="flex gap-2 justify-end max-sm:flex-col max-sm:gap-3">
              <Button
                variant="outline"
                onClick={() => setIsEmailDialogOpen(false)}
                className="max-sm:h-11 max-sm:text-sm"
                data-testid="button-cancel-email"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={emailPDFMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700 max-sm:h-11 max-sm:text-sm"
                data-testid="button-send-email"
              >
                <Mail className="h-4 w-4 mr-2 max-sm:h-3 max-sm:w-3" />
                {emailPDFMutation.isPending ? "Sending..." : "Send PDF"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Employee Management Dialog */}
      <Dialog open={showEmployeeManager} onOpenChange={setShowEmployeeManager}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Employees</DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Remove employees that were auto-created from document uploads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Remove employees that were auto-created from document uploads. This will permanently delete the employee and all their data.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allEmployees.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-gray-500">Created: {new Date(employee.createdAt).toLocaleDateString()}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        data-testid={`button-delete-employee-${employee.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to permanently delete {employee.name}? This will remove all their timesheet entries and labor records from all jobs. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteEmployeeMutation.mutate(employee.id)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Delete Employee
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
            {allEmployees.length === 0 && (
              <p className="text-center text-gray-500 py-4">No employees found</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Protected Job Deletion Dialog */}
      <Dialog open={deleteJobDialogOpen} onOpenChange={setDeleteJobDialogOpen}>
        <DialogContent className="max-w-md mx-4 sm:max-w-lg" aria-describedby="delete-job-description">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              ⚠️ Delete Job Sheet
            </DialogTitle>
            <p id="delete-job-description" className="text-sm text-muted-foreground">
              This will move the job to the deleted folder. Please save the PDF before deletion.
            </p>
          </DialogHeader>
          
          {jobDetails && (
            <div className="space-y-4">
              {/* Job Details */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-800 mb-2">Job to be deleted:</h4>
                <p className="text-sm text-red-700">
                  <strong>Address:</strong> {jobDetails.jobAddress}
                </p>
                <p className="text-sm text-red-700">
                  <strong>Client:</strong> {jobDetails.clientName}
                </p>
                <p className="text-sm text-red-700">
                  <strong>PM:</strong> {jobDetails.projectManager || 'N/A'}
                </p>
              </div>

              {/* PDF Save Recommendation */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <FileText className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-800 mb-1">
                      📄 Save PDF Before Deletion
                    </h4>
                    <p className="text-sm text-yellow-700 mb-3">
                      We recommend saving the job sheet PDF for your records before deletion.
                    </p>
                    <Button
                      onClick={handleSavePDFBeforeDelete}
                      disabled={isGeneratingPDF}
                      variant="outline"
                      size="sm"
                      className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
                      data-testid="button-save-pdf-before-delete"
                    >
                      {isGeneratingPDF ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-yellow-600 border-t-transparent rounded-full mr-2" />
                          Generating PDF...
                        </>
                      ) : (
                        <>
                          <Download className="h-4 w-4 mr-2" />
                          Save PDF Now
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Deletion Warning */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-blue-800 mb-1">
                      📁 Moving to Deleted Folder
                    </h4>
                    <p className="text-sm text-blue-700">
                      This job will be moved to the deleted folder. You can restore it later from the admin dashboard if needed.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password Entry */}
              <div className="space-y-2">
                <Label htmlFor="delete-password" className="text-sm font-semibold text-red-700">
                  🔒 Enter deletion password to confirm:
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter password"
                  className="border-red-200 focus:border-red-400"
                  data-testid="input-delete-password"
                />
                <p className="text-xs text-gray-500">
                  Contact admin for deletion password if needed
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setDeleteJobDialogOpen(false);
                    setDeletePassword('');
                  }}
                  className="flex-1"
                  data-testid="button-cancel-delete"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirmDelete}
                  disabled={!deletePassword || deleteJobMutation.isPending}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                  data-testid="button-confirm-delete"
                >
                  {deleteJobMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Confirm Delete
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* SWMS Signing Modal for voluntary signing */}
      <SwmsSigningModal
        open={showSwmsSigningModal}
        onOpenChange={(open) => {
          setShowSwmsSigningModal(open);
          if (!open) {
            // Refresh signatures and check status when modal closes
            queryClient.invalidateQueries({ queryKey: ["/api/swms/job", jobId, "signatures"] });
            refetchSwmsCheck();
          }
        }}
        jobId={jobId}
        jobAddress={jobDetails?.jobAddress || 'this job'}
        onSigningComplete={() => {
          setShowSwmsSigningModal(false);
          // Refresh data
          queryClient.invalidateQueries({ queryKey: ["/api/swms/job", jobId, "signatures"] });
          refetchSwmsCheck();
          toast({
            title: "SWMS Signed",
            description: "All required safety documents have been signed for this job.",
          });
        }}
      />
    </>
  );
}

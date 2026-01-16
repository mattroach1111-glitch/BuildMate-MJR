import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ArrowLeft, Upload, FileText, Trash2, Edit2, Check, X, Eye, Plus, Shield, RotateCcw } from "lucide-react";
import { useLocation } from "wouter";
import PageLayout from "@/components/page-layout";

interface SwmsTemplate {
  id: string;
  title: string;
  description: string | null;
  fileName: string;
  originalName: string;
  objectPath: string;
  mimeType: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  signatureCount?: number;
}

export default function AdminSwms() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [editingTemplate, setEditingTemplate] = useState<SwmsTemplate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const { data: templates, isLoading } = useQuery<SwmsTemplate[]>({
    queryKey: ["/api/swms/admin/templates"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { title: string; description: string; fileData: string; fileName: string; mimeType: string }) => {
      const response = await apiRequest("POST", "/api/swms/admin/templates", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "SWMS template uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/templates"] });
      setShowUploadDialog(false);
      setUploadTitle("");
      setUploadDescription("");
      setSelectedFile(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to upload template", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, title, description }: { id: string; title: string; description: string }) => {
      const response = await apiRequest("PATCH", `/api/swms/admin/templates/${id}`, { title, description });
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/templates"] });
      setEditingTemplate(null);
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to update template", variant: "destructive" });
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/swms/admin/templates/${id}/deactivate`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template deactivated. It will remain on existing job sheets." });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/templates"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to deactivate template", variant: "destructive" });
    },
  });

  const activateMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PATCH", `/api/swms/admin/templates/${id}/activate`, {});
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Template reactivated" });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/admin/templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/swms/templates"] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to activate template", variant: "destructive" });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/pdf") {
        toast({ title: "Error", description: "Only PDF files are allowed", variant: "destructive" });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) {
      toast({ title: "Error", description: "Please provide a title and select a file", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        await uploadMutation.mutateAsync({
          title: uploadTitle.trim(),
          description: uploadDescription.trim(),
          fileData: base64,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
        });
        setIsUploading(false);
      };
      reader.onerror = () => {
        toast({ title: "Error", description: "Failed to read file", variant: "destructive" });
        setIsUploading(false);
      };
      reader.readAsDataURL(selectedFile);
    } catch (error) {
      setIsUploading(false);
    }
  };

  const startEditing = (template: SwmsTemplate) => {
    setEditingTemplate(template);
    setEditTitle(template.title);
    setEditDescription(template.description || "");
  };

  const saveEdit = () => {
    if (!editingTemplate || !editTitle.trim()) return;
    updateMutation.mutate({
      id: editingTemplate.id,
      title: editTitle.trim(),
      description: editDescription.trim(),
    });
  };

  const activeTemplates = templates?.filter(t => t.isActive) || [];
  const inactiveTemplates = templates?.filter(t => !t.isActive) || [];

  return (
    <PageLayout>
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="mb-6">
            <Button 
              variant="ghost" 
              onClick={() => navigate("/admin")}
              className="mb-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">SWMS Management</h1>
                  <p className="text-gray-600">Manage Safe Work Method Statement templates</p>
                </div>
              </div>
              <Button onClick={() => setShowUploadDialog(true)} className="bg-green-600 hover:bg-green-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Template
              </Button>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-blue-800 mb-1">How SWMS Templates Work</h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>Active templates must be signed by staff before they can log hours on a new job</li>
              <li>When you deactivate a template, it remains on job sheets where it was already signed</li>
              <li>Staff will only see active templates when signing for new jobs</li>
            </ul>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Active Templates ({activeTemplates.length})
              </h2>
              
              {isLoading ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto"></div>
                  </CardContent>
                </Card>
              ) : activeTemplates.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-gray-500">
                    No active templates. Add one to require SWMS signing.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {activeTemplates.map((template) => (
                    <Card key={template.id} className="border-green-200">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 bg-green-100 rounded-lg mt-1">
                              <FileText className="h-5 w-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              {editingTemplate?.id === template.id ? (
                                <div className="space-y-2">
                                  <Input
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    placeholder="Title"
                                  />
                                  <Textarea
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    rows={2}
                                  />
                                  <div className="flex gap-2">
                                    <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                                      <Check className="h-4 w-4 mr-1" /> Save
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => setEditingTemplate(null)}>
                                      <X className="h-4 w-4 mr-1" /> Cancel
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <h3 className="font-medium text-gray-900">{template.title}</h3>
                                  {template.description && (
                                    <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                                  )}
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                      Active
                                    </Badge>
                                    {template.signatureCount !== undefined && template.signatureCount > 0 && (
                                      <Badge variant="secondary">
                                        {template.signatureCount} signature{template.signatureCount !== 1 ? 's' : ''}
                                      </Badge>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          
                          {editingTemplate?.id !== template.id && (
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(`/api/swms/templates/${template.id}/file`, "_blank")}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => startEditing(template)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Deactivate SWMS Template?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will remove the template from new job signing requirements. 
                                      Existing signatures on job sheets will be preserved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deactivateMutation.mutate(template.id)}
                                      className="bg-red-600 hover:bg-red-700"
                                    >
                                      Deactivate
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {inactiveTemplates.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-500 mb-3">
                  Inactive Templates ({inactiveTemplates.length})
                </h2>
                <div className="space-y-3">
                  {inactiveTemplates.map((template) => (
                    <Card key={template.id} className="border-gray-200 bg-gray-50">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3 flex-1">
                            <div className="p-2 bg-gray-200 rounded-lg mt-1">
                              <FileText className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium text-gray-600">{template.title}</h3>
                              {template.description && (
                                <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-300">
                                  Inactive
                                </Badge>
                                {template.signatureCount !== undefined && template.signatureCount > 0 && (
                                  <Badge variant="secondary">
                                    {template.signatureCount} historical signature{template.signatureCount !== 1 ? 's' : ''}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => window.open(`/api/swms/templates/${template.id}/file`, "_blank")}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => activateMutation.mutate(template.id)}
                              disabled={activateMutation.isPending}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Reactivate
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add SWMS Template</DialogTitle>
            <DialogDescription>
              Upload a PDF document for staff to review and sign before working on jobs.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="e.g., Working at Height"
              />
            </div>
            
            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={uploadDescription}
                onChange={(e) => setUploadDescription(e.target.value)}
                placeholder="Brief description of this SWMS document"
                rows={2}
              />
            </div>
            
            <div>
              <Label>PDF Document *</Label>
              <div 
                className="mt-2 border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-gray-400 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium">{selectedFile.name}</span>
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">Click to select a PDF file</p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleUpload} 
              disabled={isUploading || !uploadTitle.trim() || !selectedFile}
              className="bg-green-600 hover:bg-green-700"
            >
              {isUploading ? "Uploading..." : "Upload Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

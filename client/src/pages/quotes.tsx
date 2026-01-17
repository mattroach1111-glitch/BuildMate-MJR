import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  FileText, 
  Send, 
  Check, 
  X, 
  Clock, 
  Eye, 
  ArrowLeft,
  Trash2,
  Edit,
  Mail,
  DollarSign,
  Building2,
  RefreshCw,
  Download,
  Sparkles,
  Loader2
} from "lucide-react";
import { Link } from "wouter";
import { generateQuotePDF } from "@/lib/pdfGenerator";
import type { Quote, QuoteItem } from "@shared/schema";

type QuoteWithItems = Quote & { items: QuoteItem[]; signatures: any[] };

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700", icon: Send },
  viewed: { label: "Viewed", color: "bg-purple-100 text-purple-700", icon: Eye },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700", icon: Check },
  declined: { label: "Declined", color: "bg-red-100 text-red-700", icon: X },
  expired: { label: "Expired", color: "bg-orange-100 text-orange-700", icon: Clock },
  converted: { label: "Converted to Job", color: "bg-emerald-100 text-emerald-700", icon: RefreshCw },
};

export default function QuotesPage() {
  const { toast } = useToast();
  const [showNewQuoteDialog, setShowNewQuoteDialog] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithItems | null>(null);
  const [showQuoteEditor, setShowQuoteEditor] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [convertQuoteId, setConvertQuoteId] = useState<string | null>(null);
  const [convertHourlyRate, setConvertHourlyRate] = useState("50");

  const [newQuoteData, setNewQuoteData] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    projectDescription: "",
    projectAddress: "",
    projectManager: "",
    validUntil: "",
    notes: "",
    builderMargin: "10",
    director: "Will Scott",
    depositRequired: false,
    depositType: "percentage" as "percentage" | "fixed",
    depositValue: "10",
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  // Acknowledge any unread accepted quotes when the page loads
  useEffect(() => {
    const acknowledgeQuotes = async () => {
      try {
        await apiRequest("POST", "/api/quotes/acknowledge-accepted");
        // Invalidate the count query so the badge updates
        queryClient.invalidateQueries({ queryKey: ["/api/quotes/unacknowledged-count"] });
      } catch (error) {
        // Silently fail - not critical
      }
    };
    acknowledgeQuotes();
  }, []);

  const createQuoteMutation = useMutation({
    mutationFn: async (data: typeof newQuoteData) => {
      const response = await apiRequest("POST", "/api/quotes", data);
      return response.json();
    },
    onSuccess: (newQuote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      setShowNewQuoteDialog(false);
      setNewQuoteData({
        clientName: "",
        clientEmail: "",
        clientPhone: "",
        clientAddress: "",
        projectDescription: "",
        projectAddress: "",
        projectManager: "",
        validUntil: "",
        notes: "",
        builderMargin: "10",
        director: "Will Scott",
        depositRequired: false,
        depositType: "percentage" as "percentage" | "fixed",
        depositValue: "10",
      });
      toast({ title: "Success", description: "Quote created successfully" });
      fetchQuoteDetails(newQuote.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create quote", variant: "destructive" });
    },
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/quotes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Success", description: "Quote deleted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete quote", variant: "destructive" });
    },
  });

  const sendQuoteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/send`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Success", description: "Quote sent to client" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send quote", variant: "destructive" });
    },
  });

  const convertQuoteMutation = useMutation({
    mutationFn: async ({ id, hourlyRate }: { id: string; hourlyRate: string }) => {
      const response = await apiRequest("POST", `/api/quotes/${id}/convert`, { hourlyRate });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
      toast({ title: "Success", description: "Quote converted to job" });
      setShowConvertDialog(false);
      setConvertQuoteId(null);
      setConvertHourlyRate("50");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to convert quote", variant: "destructive" });
    },
  });

  const fetchQuoteDetails = async (id: string) => {
    try {
      const response = await fetch(`/api/quotes/${id}`, { credentials: "include" });
      if (response.ok) {
        const quote = await response.json();
        setSelectedQuote(quote);
        setShowQuoteEditor(true);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load quote details", variant: "destructive" });
    }
  };

  const filteredQuotes = quotes.filter((quote) => {
    const matchesSearch = 
      quote.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.projectDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || quote.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <h1 className="text-xl font-bold">Quotes</h1>
            </div>
            <div className="flex gap-2">
              <Link href="/cost-library">
                <Button variant="outline">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Cost Library
                </Button>
              </Link>
              <Button onClick={() => setShowNewQuoteDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Quote
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input
            placeholder="Search quotes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="declined">Declined</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {filteredQuotes.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-gray-500">No quotes found</p>
              <Button onClick={() => setShowNewQuoteDialog(true)} className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Quote
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredQuotes.map((quote) => (
              <Card key={quote.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => fetchQuoteDetails(quote.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-500">{quote.quoteNumber}</p>
                      <CardTitle className="text-lg mt-1">{quote.clientName}</CardTitle>
                    </div>
                    {getStatusBadge(quote.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 line-clamp-2 mb-3">{quote.projectDescription}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-lg font-semibold text-green-600">
                      <DollarSign className="h-4 w-4" />
                      {parseFloat(quote.totalAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(quote.createdAt!).toLocaleDateString('en-AU')}
                    </p>
                  </div>
                  <div className="flex gap-2 mt-4" onClick={(e) => e.stopPropagation()}>
                    {(quote.status === "draft" || quote.status === "sent" || quote.status === "viewed") && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => fetchQuoteDetails(quote.id)}>
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        {quote.clientEmail && (
                          <Button size="sm" onClick={() => sendQuoteMutation.mutate(quote.id)} disabled={sendQuoteMutation.isPending}>
                            <Mail className="h-3 w-3 mr-1" />
                            {quote.status === "draft" ? "Send" : "Resend"}
                          </Button>
                        )}
                      </>
                    )}
                    {quote.status === "accepted" && (
                      <Button size="sm" onClick={() => {
                        setConvertQuoteId(quote.id);
                        setShowConvertDialog(true);
                      }}>
                        <Building2 className="h-3 w-3 mr-1" />
                        Convert to Job
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete quote {quote.quoteNumber}.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteQuoteMutation.mutate(quote.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showNewQuoteDialog} onOpenChange={setShowNewQuoteDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Quote</DialogTitle>
            <DialogDescription>Enter client and project details to create a new quote.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Client Name *</Label>
                <Input
                  value={newQuoteData.clientName}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, clientName: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div>
                <Label>Client Email</Label>
                <Input
                  type="email"
                  value={newQuoteData.clientEmail}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, clientEmail: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
              <div>
                <Label>Client Phone</Label>
                <Input
                  value={newQuoteData.clientPhone}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, clientPhone: e.target.value })}
                  placeholder="Phone number"
                />
              </div>
              <div className="col-span-2">
                <Label>Client Address</Label>
                <Input
                  value={newQuoteData.clientAddress}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, clientAddress: e.target.value })}
                  placeholder="Client address"
                />
              </div>
            </div>
            <div>
              <Label>Project Description *</Label>
              <Textarea
                value={newQuoteData.projectDescription}
                onChange={(e) => setNewQuoteData({ ...newQuoteData, projectDescription: e.target.value })}
                placeholder="Describe the project..."
                rows={3}
              />
            </div>
            <div>
              <Label>Project Address</Label>
              <Input
                value={newQuoteData.projectAddress}
                onChange={(e) => setNewQuoteData({ ...newQuoteData, projectAddress: e.target.value })}
                placeholder="Project site address"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Valid Until</Label>
                <Input
                  type="date"
                  value={newQuoteData.validUntil}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, validUntil: e.target.value })}
                />
              </div>
              <div>
                <Label>Builder Margin (%)</Label>
                <Input
                  type="number"
                  value={newQuoteData.builderMargin}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, builderMargin: e.target.value })}
                  placeholder="10"
                />
              </div>
            </div>
            <div>
              <Label>Project Manager</Label>
              <Select
                value={newQuoteData.projectManager || "none"}
                onValueChange={(value) => setNewQuoteData({ ...newQuoteData, projectManager: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  id="depositRequired"
                  checked={newQuoteData.depositRequired}
                  onChange={(e) => setNewQuoteData({ ...newQuoteData, depositRequired: e.target.checked })}
                  className="h-4 w-4"
                />
                <Label htmlFor="depositRequired" className="font-medium">Require Deposit</Label>
              </div>
              {newQuoteData.depositRequired && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Deposit Type</Label>
                    <Select
                      value={newQuoteData.depositType}
                      onValueChange={(value) => setNewQuoteData({ ...newQuoteData, depositType: value as "percentage" | "fixed" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>{newQuoteData.depositType === "percentage" ? "Deposit %" : "Deposit Amount"}</Label>
                    <Input
                      type="number"
                      value={newQuoteData.depositValue}
                      onChange={(e) => setNewQuoteData({ ...newQuoteData, depositValue: e.target.value })}
                      placeholder={newQuoteData.depositType === "percentage" ? "10" : "1000"}
                    />
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label>Sending Director</Label>
              <Select
                value={newQuoteData.director}
                onValueChange={(value) => setNewQuoteData({ ...newQuoteData, director: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select director" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Matt Roach">Matt Roach</SelectItem>
                  <SelectItem value="Will Scott">Will Scott</SelectItem>
                  <SelectItem value="Mark Ede">Mark Ede</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={newQuoteData.notes}
                onChange={(e) => setNewQuoteData({ ...newQuoteData, notes: e.target.value })}
                placeholder="Internal notes..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowNewQuoteDialog(false)}>Cancel</Button>
              <Button
                onClick={() => createQuoteMutation.mutate(newQuoteData)}
                disabled={!newQuoteData.clientName || !newQuoteData.projectDescription || createQuoteMutation.isPending}
              >
                {createQuoteMutation.isPending ? "Creating..." : "Create Quote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showQuoteEditor && selectedQuote && (
        <QuoteEditor
          quote={selectedQuote}
          onClose={() => {
            setShowQuoteEditor(false);
            setSelectedQuote(null);
          }}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
            fetchQuoteDetails(selectedQuote.id);
          }}
        />
      )}

      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert Quote to Job</DialogTitle>
            <DialogDescription>
              Set the hourly rate for the new job sheet.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hourly Rate ($)</Label>
              <Select value={convertHourlyRate} onValueChange={setConvertHourlyRate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="45">$45/hr</SelectItem>
                  <SelectItem value="50">$50/hr</SelectItem>
                  <SelectItem value="55">$55/hr</SelectItem>
                  <SelectItem value="60">$60/hr</SelectItem>
                  <SelectItem value="65">$65/hr</SelectItem>
                  <SelectItem value="70">$70/hr</SelectItem>
                  <SelectItem value="75">$75/hr</SelectItem>
                  <SelectItem value="80">$80/hr</SelectItem>
                  <SelectItem value="85">$85/hr</SelectItem>
                  <SelectItem value="90">$90/hr</SelectItem>
                  <SelectItem value="95">$95/hr</SelectItem>
                  <SelectItem value="100">$100/hr</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (convertQuoteId) {
                    convertQuoteMutation.mutate({ id: convertQuoteId, hourlyRate: convertHourlyRate });
                  }
                }}
                disabled={convertQuoteMutation.isPending}
              >
                {convertQuoteMutation.isPending ? "Converting..." : "Convert to Job"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function QuoteEditor({ quote, onClose, onUpdate }: { quote: QuoteWithItems; onClose: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "1",
    unitPrice: "",
    itemType: "other",
  });
  const [editDetails, setEditDetails] = useState({
    clientName: quote.clientName,
    clientEmail: quote.clientEmail || "",
    clientPhone: quote.clientPhone || "",
    clientAddress: quote.clientAddress || "",
    projectDescription: quote.projectDescription,
    projectAddress: quote.projectAddress || "",
    notes: quote.notes || "",
    depositRequired: quote.depositRequired || false,
    depositType: (quote.depositType || "percentage") as "percentage" | "fixed",
    depositValue: quote.depositValue || "10",
  });

  const { data: libraryItems = [] } = useQuery<any[]>({
    queryKey: ["/api/cost-library"],
    enabled: showLibraryPicker,
  });

  const updateDetailsMutation = useMutation({
    mutationFn: async (data: typeof editDetails) => {
      const response = await apiRequest("PATCH", `/api/quotes/${quote.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      onUpdate();
      setShowEditDetails(false);
      toast({ title: "Details updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update details", variant: "destructive" });
    },
  });

  const updateMarginMutation = useMutation({
    mutationFn: async (margin: string) => {
      const response = await apiRequest("PATCH", `/api/quotes/${quote.id}`, { builderMargin: margin });
      return response.json();
    },
    onSuccess: () => {
      onUpdate();
    },
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const totalPrice = (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2);
      if (editingItem) {
        const response = await apiRequest("PATCH", `/api/quotes/${quote.id}/items/${editingItem.id}`, {
          ...item,
          totalPrice,
        });
        return response.json();
      } else {
        const response = await apiRequest("POST", `/api/quotes/${quote.id}/items`, {
          ...item,
          totalPrice,
        });
        return response.json();
      }
    },
    onSuccess: () => {
      onUpdate();
      setShowAddItem(false);
      setEditingItem(null);
      setNewItem({ description: "", quantity: "1", unitPrice: "", itemType: "other" });
      toast({ title: editingItem ? "Item updated" : "Item added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      await apiRequest("DELETE", `/api/quotes/${quote.id}/items/${itemId}`);
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Item removed" });
    },
  });

  const addFromLibraryMutation = useMutation({
    mutationFn: async (libItem: any) => {
      const totalPrice = (1 * parseFloat(libItem.defaultUnitCost)).toFixed(2);
      await apiRequest("POST", `/api/quotes/${quote.id}/items`, {
        itemType: "other",
        description: libItem.name,
        quantity: "1",
        unitPrice: libItem.defaultUnitCost,
        totalPrice,
      });
      await apiRequest("POST", `/api/cost-library/${libItem.id}/use`);
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Item added from library" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });

  const filteredLibraryItems = libraryItems.filter((item: any) =>
    item.name.toLowerCase().includes(librarySearch.toLowerCase()) ||
    (item.description && item.description.toLowerCase().includes(librarySearch.toLowerCase()))
  );

  const [showAiSuggestions, setShowAiSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isLoadingAi, setIsLoadingAi] = useState(false);

  const [showAiEstimate, setShowAiEstimate] = useState(false);
  const [estimateForm, setEstimateForm] = useState({
    scopeOfWorks: "",
    length: "",
    width: "",
    height: "",
    notes: "",
    roomType: "",
  });
  const [estimateImages, setEstimateImages] = useState<Array<{ data: string; mimeType: string; preview: string }>>([]);
  const [estimateResult, setEstimateResult] = useState<any>(null);
  const [isLoadingEstimate, setIsLoadingEstimate] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newImages: Array<{ data: string; mimeType: string; preview: string }> = [];
    for (let i = 0; i < files.length && estimateImages.length + newImages.length < 5; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      
      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          newImages.push({
            data: base64,
            mimeType: file.type,
            preview: reader.result as string,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    setEstimateImages([...estimateImages, ...newImages]);
  };

  const runAiEstimate = async () => {
    if (!estimateForm.scopeOfWorks.trim()) {
      toast({ title: "Error", description: "Please enter a scope of works", variant: "destructive" });
      return;
    }

    console.log("Starting AI estimate with:", { 
      scopeOfWorks: estimateForm.scopeOfWorks,
      imageCount: estimateImages.length,
      measurements: estimateForm
    });
    
    setIsLoadingEstimate(true);
    try {
      const response = await apiRequest("POST", "/api/quotes/ai-estimate", {
        scopeOfWorks: estimateForm.scopeOfWorks,
        measurements: {
          length: estimateForm.length ? parseFloat(estimateForm.length) : undefined,
          width: estimateForm.width ? parseFloat(estimateForm.width) : undefined,
          height: estimateForm.height ? parseFloat(estimateForm.height) : undefined,
          notes: estimateForm.notes,
        },
        images: estimateImages.map(img => ({ data: img.data, mimeType: img.mimeType })),
        roomType: estimateForm.roomType,
      });
      const result = await response.json();
      console.log("AI estimate result:", result);
      if (result && result.suggestedItems) {
        setEstimateResult(result);
      } else {
        console.error("Invalid estimate result:", result);
        toast({ title: "Error", description: result.message || "Invalid response from AI", variant: "destructive" });
      }
    } catch (error: any) {
      console.error("AI estimate error:", error);
      toast({ title: "Error", description: error?.message || "Failed to generate estimate", variant: "destructive" });
    } finally {
      setIsLoadingEstimate(false);
    }
  };

  const addEstimateItemMutation = useMutation({
    mutationFn: async (item: any) => {
      const totalPrice = (item.quantity * item.unitCost).toFixed(2);
      await apiRequest("POST", `/api/quotes/${quote.id}/items`, {
        itemType: item.category?.toLowerCase().includes('labour') ? 'labor' : 
                 item.category?.toLowerCase().includes('material') ? 'materials' : 'other',
        description: item.name,
        quantity: item.quantity.toString(),
        unitPrice: item.unitCost.toString(),
        totalPrice,
      });
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Item added to quote" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });

  const [isAddingAll, setIsAddingAll] = useState(false);

  const addAllEstimateItems = async () => {
    if (!estimateResult?.suggestedItems || estimateResult.suggestedItems.length === 0) return;
    setIsAddingAll(true);
    let successCount = 0;
    let failCount = 0;
    
    for (const item of estimateResult.suggestedItems) {
      try {
        await addEstimateItemMutation.mutateAsync(item);
        successCount++;
      } catch (error) {
        failCount++;
        console.error('Failed to add item:', item.name, error);
      }
    }
    
    setIsAddingAll(false);
    
    if (failCount === 0) {
      setShowAiEstimate(false);
      setEstimateResult(null);
      toast({ title: `All ${successCount} items added to quote` });
    } else if (successCount > 0) {
      toast({ 
        title: "Partial success", 
        description: `Added ${successCount} items, ${failCount} failed`,
        variant: "destructive" 
      });
    } else {
      toast({ title: "Error", description: "Failed to add items", variant: "destructive" });
    }
  };

  const getAiSuggestions = async () => {
    setIsLoadingAi(true);
    setShowAiSuggestions(true);
    try {
      const response = await apiRequest("POST", "/api/quotes/ai-suggest", {
        projectDescription: quote.projectDescription,
        projectAddress: quote.projectAddress,
      });
      const suggestions = await response.json();
      setAiSuggestions(suggestions);
    } catch (error) {
      toast({ title: "Error", description: "Failed to get AI suggestions", variant: "destructive" });
    } finally {
      setIsLoadingAi(false);
    }
  };

  const addAiSuggestionMutation = useMutation({
    mutationFn: async (suggestion: any) => {
      const totalPrice = (suggestion.quantity * suggestion.unitCost).toFixed(2);
      await apiRequest("POST", `/api/quotes/${quote.id}/items`, {
        itemType: "other",
        description: suggestion.description,
        quantity: suggestion.quantity.toString(),
        unitPrice: suggestion.unitCost.toString(),
        totalPrice,
      });
    },
    onSuccess: () => {
      onUpdate();
      toast({ title: "Suggested item added" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });


  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">{quote.quoteNumber}</DialogTitle>
              <DialogDescription>{quote.clientName} - {quote.projectDescription}</DialogDescription>
            </div>
            {statusConfig[quote.status] && (
              <Badge className={statusConfig[quote.status].color}>
                {statusConfig[quote.status].label}
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Customer & Project Details</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowEditDetails(!showEditDetails)}>
                  <Edit className="h-4 w-4 mr-1" />
                  {showEditDetails ? "Cancel" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showEditDetails ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Client Name *</Label>
                      <Input
                        value={editDetails.clientName}
                        onChange={(e) => setEditDetails({ ...editDetails, clientName: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Client Email</Label>
                      <Input
                        type="email"
                        value={editDetails.clientEmail}
                        onChange={(e) => setEditDetails({ ...editDetails, clientEmail: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Client Phone</Label>
                      <Input
                        value={editDetails.clientPhone}
                        onChange={(e) => setEditDetails({ ...editDetails, clientPhone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Client Address</Label>
                      <Input
                        value={editDetails.clientAddress}
                        onChange={(e) => setEditDetails({ ...editDetails, clientAddress: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Project Description *</Label>
                    <Input
                      value={editDetails.projectDescription}
                      onChange={(e) => setEditDetails({ ...editDetails, projectDescription: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Project Address</Label>
                    <Input
                      value={editDetails.projectAddress}
                      onChange={(e) => setEditDetails({ ...editDetails, projectAddress: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea
                      value={editDetails.notes}
                      onChange={(e) => setEditDetails({ ...editDetails, notes: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center gap-3 mb-3">
                      <input
                        type="checkbox"
                        id="editDepositRequired"
                        checked={editDetails.depositRequired}
                        onChange={(e) => setEditDetails({ ...editDetails, depositRequired: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="editDepositRequired" className="font-medium">Require Deposit</Label>
                    </div>
                    {editDetails.depositRequired && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Deposit Type</Label>
                          <Select
                            value={editDetails.depositType}
                            onValueChange={(value) => setEditDetails({ ...editDetails, depositType: value as "percentage" | "fixed" })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                              <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>{editDetails.depositType === "percentage" ? "Deposit %" : "Deposit Amount"}</Label>
                          <Input
                            type="number"
                            value={editDetails.depositValue}
                            onChange={(e) => setEditDetails({ ...editDetails, depositValue: e.target.value })}
                            placeholder={editDetails.depositType === "percentage" ? "10" : "1000"}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <Button
                    onClick={() => updateDetailsMutation.mutate(editDetails)}
                    disabled={!editDetails.clientName || !editDetails.projectDescription || updateDetailsMutation.isPending}
                  >
                    {updateDetailsMutation.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Client:</span>
                    <p className="font-medium">{quote.clientName}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <p className="font-medium">{quote.clientEmail || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Phone:</span>
                    <p className="font-medium">{quote.clientPhone || "-"}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Client Address:</span>
                    <p className="font-medium">{quote.clientAddress || "-"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Project:</span>
                    <p className="font-medium">{quote.projectDescription}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-500">Project Address:</span>
                    <p className="font-medium">{quote.projectAddress || "-"}</p>
                  </div>
                  {quote.notes && (
                    <div className="col-span-2">
                      <span className="text-gray-500">Notes:</span>
                      <p className="font-medium">{quote.notes}</p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <span className="text-gray-500">Deposit:</span>
                    <p className="font-medium">
                      {quote.depositRequired 
                        ? `${quote.depositType === "percentage" ? `${quote.depositValue}%` : `$${parseFloat(quote.depositValue || "0").toFixed(2)}`} required`
                        : "Not required"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Line Items</CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setShowAiEstimate(true)} className="bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:border-purple-300">
                    <Sparkles className="h-4 w-4 mr-1 text-purple-600" />
                    AI Estimate
                  </Button>
                  <Button size="sm" variant="outline" onClick={getAiSuggestions} disabled={isLoadingAi}>
                    {isLoadingAi ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                    AI Suggest
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowLibraryPicker(true)}>
                    <DollarSign className="h-4 w-4 mr-1" />
                    From Library
                  </Button>
                  <Button size="sm" onClick={() => setShowAddItem(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showAiSuggestions && (
                <div className="mb-4 p-4 border rounded-lg bg-purple-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      AI Suggested Items
                    </h4>
                    <Button size="sm" variant="ghost" onClick={() => setShowAiSuggestions(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {isLoadingAi ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                      <span className="ml-2 text-sm text-gray-600">Analyzing project and generating suggestions...</span>
                    </div>
                  ) : aiSuggestions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No suggestions available. Try adding items to your cost library first.
                    </p>
                  ) : (
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {aiSuggestions.map((suggestion: any, idx: number) => (
                        <div 
                          key={idx} 
                          className="flex items-start justify-between p-3 bg-white rounded border hover:border-purple-300 cursor-pointer"
                          onClick={() => addAiSuggestionMutation.mutate(suggestion)}
                        >
                          <div className="flex-1">
                            <p className="text-sm font-medium">{suggestion.description}</p>
                            <p className="text-xs text-gray-500">
                              {suggestion.quantity} x ${suggestion.unitCost.toFixed(2)} = ${(suggestion.quantity * suggestion.unitCost).toFixed(2)}
                            </p>
                            {suggestion.reason && (
                              <p className="text-xs text-purple-600 mt-1">{suggestion.reason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {Math.round((suggestion.confidence || 0.5) * 100)}% match
                            </Badge>
                            <Plus className="h-4 w-4 text-purple-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showLibraryPicker && (
                <div className="mb-4 p-4 border rounded-lg bg-blue-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-sm">Add from Cost Library</h4>
                    <Button size="sm" variant="ghost" onClick={() => setShowLibraryPicker(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input
                    placeholder="Search library items..."
                    value={librarySearch}
                    onChange={(e) => setLibrarySearch(e.target.value)}
                    className="mb-3"
                  />
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {filteredLibraryItems.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        {libraryItems.length === 0 
                          ? "No items in library yet. Add some from the Cost Library page." 
                          : "No matching items found"}
                      </p>
                    ) : (
                      filteredLibraryItems.slice(0, 10).map((item: any) => (
                        <div 
                          key={item.id} 
                          className="flex items-center justify-between p-2 bg-white rounded border hover:border-blue-300 cursor-pointer"
                          onClick={() => addFromLibraryMutation.mutate(item)}
                        >
                          <div>
                            <p className="text-sm font-medium">{item.name}</p>
                            <p className="text-xs text-gray-500">${parseFloat(item.defaultUnitCost).toFixed(2)} / {item.unit}</p>
                          </div>
                          <Plus className="h-4 w-4 text-blue-600" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
              {quote.items.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No items yet. Add line items to build your quote.</p>
              ) : (
                <div className="space-y-2">
                  {quote.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">{item.description}</p>
                        <p className="text-xs text-gray-500">
                          {parseFloat(item.quantity)} x ${parseFloat(item.unitPrice).toFixed(2)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold">${parseFloat(item.totalPrice).toFixed(2)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingItem(item);
                            setNewItem({
                              description: item.description,
                              quantity: item.quantity,
                              unitPrice: item.unitPrice,
                              itemType: item.itemType,
                            });
                            setShowAddItem(true);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 h-8 w-8 p-0"
                          onClick={() => deleteItemMutation.mutate(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Subtotal (ex GST):</span>
                  <span className="font-medium">${parseFloat(quote.subtotal).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600">Margin:</span>
                    <Input
                      type="number"
                      className="w-20 h-8 text-right"
                      value={quote.builderMargin || "0"}
                      onChange={(e) => {
                        updateMarginMutation.mutate(e.target.value);
                      }}
                      min="0"
                      max="100"
                      step="0.5"
                    />
                    <span className="text-gray-600">%</span>
                  </div>
                  <span className="font-medium text-blue-600">
                    +${((parseFloat(quote.subtotal) * parseFloat(quote.builderMargin || "0")) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">GST (10%):</span>
                  <span className="font-medium">${parseFloat(quote.gstAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-lg pt-2 border-t">
                  <span className="font-semibold">Total (inc GST):</span>
                  <span className="font-bold text-green-600">${parseFloat(quote.totalAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await generateQuotePDF({
                  ...quote,
                  createdAt: quote.createdAt?.toString() || new Date().toISOString(),
                  acceptedAt: quote.acceptedAt?.toString() || null,
                  validUntil: quote.validUntil?.toString() || null,
                  signature: quote.signatures?.[0] ? {
                    signerName: quote.signatures[0].signerName,
                    signatureData: quote.signatures[0].signatureData,
                    signedAt: quote.signatures[0].signedAt?.toString() || new Date().toISOString()
                  } : null
                });
                toast({ title: "PDF downloaded" });
              } catch (err) {
                toast({ title: "Error", description: "Failed to generate PDF", variant: "destructive" });
              }
            }}
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>

        <Dialog open={showAddItem} onOpenChange={(open) => {
          setShowAddItem(open);
          if (!open) {
            setEditingItem(null);
            setNewItem({ description: "", quantity: "1", unitPrice: "", itemType: "other" });
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Line Item" : "Add Line Item"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <Input
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="e.g. Demolition of deck tiles and rubbish removal"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    value={newItem.quantity}
                    onChange={(e) => setNewItem({ ...newItem, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Unit Price ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={newItem.unitPrice}
                    onChange={(e) => setNewItem({ ...newItem, unitPrice: e.target.value })}
                  />
                </div>
              </div>
              {newItem.quantity && newItem.unitPrice && (
                <p className="text-right text-sm text-gray-600">
                  Line Total: ${(parseFloat(newItem.quantity) * parseFloat(newItem.unitPrice)).toFixed(2)}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                <Button
                  onClick={() => addItemMutation.mutate(newItem)}
                  disabled={!newItem.description || !newItem.unitPrice || addItemMutation.isPending}
                >
                  {editingItem ? "Save Changes" : "Add Item"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* AI Estimate Dialog */}
        <Dialog open={showAiEstimate} onOpenChange={(open) => {
          setShowAiEstimate(open);
          if (!open) {
            setEstimateResult(null);
            setEstimateImages([]);
            setEstimateForm({ scopeOfWorks: "", length: "", width: "", height: "", notes: "", roomType: "" });
          }
        }}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-600" />
                AI Quote Estimate
              </DialogTitle>
              <DialogDescription>
                Upload photos and enter measurements to get an AI-generated quote estimate
              </DialogDescription>
            </DialogHeader>
            
            {!estimateResult ? (
              <div className="space-y-6">
                <div>
                  <Label className="text-base font-medium">Scope of Works *</Label>
                  <Textarea
                    value={estimateForm.scopeOfWorks}
                    onChange={(e) => setEstimateForm({ ...estimateForm, scopeOfWorks: e.target.value })}
                    placeholder="Describe the work to be done, e.g.:&#10;- Remove existing flooring and prep substrate&#10;- Install new vinyl plank flooring&#10;- Replace skirting boards&#10;- Paint walls and ceiling (2 coats)"
                    rows={5}
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label className="text-base font-medium">Room Measurements (optional)</Label>
                  <p className="text-sm text-gray-500 mb-2">Enter dimensions to calculate material quantities</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs">Length (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={estimateForm.length}
                        onChange={(e) => setEstimateForm({ ...estimateForm, length: e.target.value })}
                        placeholder="e.g. 5.5"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Width (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={estimateForm.width}
                        onChange={(e) => setEstimateForm({ ...estimateForm, width: e.target.value })}
                        placeholder="e.g. 4.0"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Height (m)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        value={estimateForm.height}
                        onChange={(e) => setEstimateForm({ ...estimateForm, height: e.target.value })}
                        placeholder="e.g. 2.7"
                      />
                    </div>
                  </div>
                  {estimateForm.length && estimateForm.width && (
                    <p className="text-sm text-gray-600 mt-2">
                      Floor area: {(parseFloat(estimateForm.length) * parseFloat(estimateForm.width)).toFixed(1)}m²
                      {estimateForm.height && ` | Wall area: ${(2 * parseFloat(estimateForm.height) * (parseFloat(estimateForm.length) + parseFloat(estimateForm.width))).toFixed(1)}m²`}
                    </p>
                  )}
                </div>

                <div>
                  <Label className="text-base font-medium">Photos (optional)</Label>
                  <p className="text-sm text-gray-500 mb-2">Upload up to 5 photos of the space</p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {estimateImages.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img.preview} alt={`Upload ${idx + 1}`} className="w-20 h-20 object-cover rounded border" />
                        <button
                          onClick={() => setEstimateImages(estimateImages.filter((_, i) => i !== idx))}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {estimateImages.length < 5 && (
                      <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded flex items-center justify-center cursor-pointer hover:border-purple-400 transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleImageUpload}
                        />
                        <Plus className="h-6 w-6 text-gray-400" />
                      </label>
                    )}
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Additional Notes</Label>
                  <Input
                    value={estimateForm.notes}
                    onChange={(e) => setEstimateForm({ ...estimateForm, notes: e.target.value })}
                    placeholder="e.g. Access via rear lane, 2nd floor unit"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => setShowAiEstimate(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={runAiEstimate}
                    disabled={!estimateForm.scopeOfWorks.trim() || isLoadingEstimate}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {isLoadingEstimate ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating Estimate...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Estimate
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-4 rounded-lg border">
                  <h3 className="font-semibold text-lg text-purple-800">
                    Estimated Total: ${estimateResult.totalEstimate?.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">{estimateResult.summary}</p>
                </div>

                {estimateResult.notes?.length > 0 && (
                  <div className="bg-yellow-50 p-3 rounded border border-yellow-200">
                    <h4 className="font-medium text-sm text-yellow-800 mb-1">Notes & Assumptions:</h4>
                    <ul className="text-xs text-yellow-700 list-disc list-inside space-y-1">
                      {estimateResult.notes.map((note: string, idx: number) => (
                        <li key={idx}>{note}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Suggested Line Items ({estimateResult.suggestedItems?.length || 0})</h4>
                    <Button size="sm" variant="outline" onClick={addAllEstimateItems} disabled={isAddingAll}>
                      {isAddingAll ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          Add All to Quote
                        </>
                      )}
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {estimateResult.suggestedItems?.map((item: any, idx: number) => (
                      <div key={idx} className="flex items-start justify-between p-3 bg-white rounded border hover:border-purple-300 transition-colors">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm">{item.name}</span>
                            <Badge variant="outline" className="text-xs">{item.category}</Badge>
                          </div>
                          <p className="text-xs text-gray-500">{item.reasoning}</p>
                          <p className="text-sm mt-1">
                            {item.quantity} {item.unit} × ${item.unitCost.toFixed(2)} = <span className="font-medium">${item.total.toFixed(2)}</span>
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => addEstimateItemMutation.mutate(item)}
                          disabled={addEstimateItemMutation.isPending}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between pt-4 border-t">
                  <Button variant="outline" onClick={() => setEstimateResult(null)}>
                    ← Back to Form
                  </Button>
                  <Button onClick={() => {
                    setShowAiEstimate(false);
                    setEstimateResult(null);
                  }}>
                    Done
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

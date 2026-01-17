import { useState } from "react";
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
  Download
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
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

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
            <Button onClick={() => setShowNewQuoteDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Quote
            </Button>
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
                value={newQuoteData.projectManager}
                onValueChange={(value) => setNewQuoteData({ ...newQuoteData, projectManager: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project manager (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
  const [newItem, setNewItem] = useState({
    description: "",
    quantity: "1",
    unitPrice: "",
  });

  const addItemMutation = useMutation({
    mutationFn: async (item: typeof newItem) => {
      const totalPrice = (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2);
      const response = await apiRequest("POST", `/api/quotes/${quote.id}/items`, {
        itemType: "other",
        ...item,
        totalPrice,
      });
      return response.json();
    },
    onSuccess: () => {
      onUpdate();
      setShowAddItem(false);
      setNewItem({ description: "", quantity: "1", unitPrice: "" });
      toast({ title: "Item added" });
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
                <CardTitle className="text-base">Line Items</CardTitle>
                <Button size="sm" onClick={() => setShowAddItem(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
              <div className="space-y-2 text-right">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal (ex GST):</span>
                  <span className="font-medium">${parseFloat(quote.subtotal).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
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

        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Line Item</DialogTitle>
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
                  Add Item
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

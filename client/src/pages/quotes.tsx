import { useState, useEffect, useCallback } from "react";
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, FileText, Send, Check, X, Clock, Eye, ArrowLeft, Trash2, Edit,
  Mail, DollarSign, Building2, RefreshCw, Download, Sparkles, Upload,
  ChevronRight, ChevronDown, Hammer, Package, MoreHorizontal, AlertCircle, TrendingUp,
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

const CONFIDENCE_COLORS = {
  low: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-green-100 text-green-700 border-green-200",
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

const CAT_ICONS: Record<string, any> = {
  "Labour": Hammer, "Materials": Package, "Sub-trades": Building2, "Other / Preliminaries": MoreHorizontal,
};

// ─────────────────────────────── New Quote Wizard ───────────────────────────────

interface NewQuoteWizardProps {
  onClose: () => void;
  onCreated: (quoteId: string) => void;
}

function NewQuoteWizard({ onClose, onCreated }: NewQuoteWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<"scope" | "estimate" | "details">("scope");

  // Scope step
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfMimeType, setPdfMimeType] = useState("application/pdf");
  const [fileName, setFileName] = useState<string | null>(null);
  const [scopeText, setScopeText] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [estimate, setEstimate] = useState<any | null>(null);
  const [showLineItems, setShowLineItems] = useState(false);
  // Manual adjustment of the cost total
  const [adjustedCost, setAdjustedCost] = useState("");

  // Details step
  const [details, setDetails] = useState({
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    projectAddress: "",
    projectDescription: "",
    builderMargin: "15",
    director: "Matt Roach",
    validUntil: "",
    notes: "",
    depositRequired: false,
    depositType: "percentage" as "percentage" | "fixed",
    depositValue: "10",
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    setPdfMimeType(file.type || "application/pdf");
    const reader = new FileReader();
    reader.onload = () => {
      setPdfBase64((reader.result as string).split(",")[1]);
      setIsReading(false);
    };
    reader.onerror = () => { setIsReading(false); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const estimateMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", "/api/cost-estimate", body).then(r => r.json()),
    onSuccess: (data) => {
      setEstimate(data);
      setAdjustedCost(String(data.totalEstimateExGst));
      setStep("estimate");
    },
    onError: (e: any) => toast({ title: "Estimation failed", description: e.message, variant: "destructive" }),
  });

  const createMutation = useMutation({
    mutationFn: async (body: any) => apiRequest("POST", "/api/quotes", body).then(r => r.json()),
    onSuccess: (q) => { onCreated(q.id); },
    onError: () => toast({ title: "Failed to create quote", variant: "destructive" }),
  });

  const runEstimate = () => {
    if (!pdfBase64 && !scopeText.trim()) {
      toast({ title: "Upload a PDF or paste your scope first", variant: "destructive" });
      return;
    }
    const body: any = {};
    if (pdfBase64) { body.pdfBase64 = pdfBase64; body.pdfMimeType = pdfMimeType; }
    else body.scopeText = scopeText;
    estimateMutation.mutate(body);
  };

  const handleCreate = () => {
    const costExGst = parseFloat(adjustedCost) || (estimate?.totalEstimateExGst || 0);
    const margin = parseFloat(details.builderMargin) || 0;
    const subtotalWithMargin = costExGst * (1 + margin / 100);
    const gst = subtotalWithMargin * 0.1;
    const total = subtotalWithMargin + gst;

    createMutation.mutate({
      ...details,
      quoteType: "lump_sum",
      scopeText: scopeText || `Estimated from ${fileName || "uploaded scope"}`,
      lumpSumTotal: costExGst.toFixed(2),
      subtotal: subtotalWithMargin.toFixed(2),
      gstAmount: gst.toFixed(2),
      totalAmount: total.toFixed(2),
      projectDescription: details.projectDescription || (fileName ? `Works at ${details.projectAddress}` : scopeText.slice(0, 80)),
      costEstimateData: estimate ? JSON.stringify(estimate) : undefined,
    });
  };

  // ── Step: Scope ──
  if (step === "scope") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
          <div>
            <p className="font-semibold text-gray-900">Upload Scope or Describe Works</p>
            <p className="text-xs text-gray-500">PDF scope, work order, or type what needs doing on-site</p>
          </div>
        </div>

        {/* PDF upload */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs font-medium">Scope of Works PDF</Label>
          {pdfBase64 && fileName ? (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
              <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-800 truncate">{fileName}</p>
                <p className="text-xs text-green-600">PDF ready to send to AI</p>
              </div>
              <button onClick={() => { setPdfBase64(null); setFileName(null); }} className="text-green-400 hover:text-green-700">
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className={`flex items-center justify-center gap-2 cursor-pointer border-2 border-dashed rounded-xl px-4 py-5 transition-colors
              ${isReading ? "border-purple-300 bg-purple-50/50 text-purple-400" : "border-purple-200 bg-purple-50/30 text-purple-600 hover:border-purple-400 hover:bg-purple-50"}`}>
              <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isReading} />
              {isReading ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500" /> Reading…</>
              ) : (
                <><Upload className="h-5 w-5" /> <span className="font-medium text-sm">Tap to upload PDF scope / work order</span></>
              )}
            </label>
          )}
        </div>

        {/* Manual scope */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or describe works manually</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <Textarea
            value={scopeText}
            onChange={e => setScopeText(e.target.value)}
            placeholder={"e.g. Full bathroom renovation — remove existing tiles, waterproofing, new shower base, vanity, toilet, painting and tiling throughout. Approx 8m².\n\nYou can type this while standing in the property!"}
            className="min-h-[110px] text-sm resize-y"
          />
        </div>

        <p className="text-xs text-purple-600 flex items-center gap-1">
          <AlertCircle className="h-3 w-3" /> AI will estimate your actual cost of works — ignoring any quoted prices in the document.
        </p>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white gap-2"
            onClick={runEstimate}
            disabled={estimateMutation.isPending}
          >
            {estimateMutation.isPending
              ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analysing…</>
              : <><Sparkles className="h-4 w-4" /> Estimate Cost</>
            }
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Estimate Review ──
  if (step === "estimate" && estimate) {
    const costExGst = parseFloat(adjustedCost) || estimate.totalEstimateExGst;
    const margin = parseFloat(details.builderMargin) || 0;
    const subtotalWithMargin = costExGst * (1 + margin / 100);
    const gst = subtotalWithMargin * 0.1;
    const total = subtotalWithMargin + gst;

    return (
      <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
          <div>
            <p className="font-semibold text-gray-900">Review AI Cost Estimate</p>
            <p className="text-xs text-gray-500">Adjust the cost if needed, then set your margin</p>
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-start justify-between gap-3 bg-purple-50 rounded-xl p-4 border border-purple-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
              <TrendingUp className="h-4 w-4 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-medium">AI Estimated Builder's Cost</p>
              <p className="text-2xl font-bold text-gray-900">{fmtCurrency(estimate.totalEstimateExGst)}</p>
              <p className="text-xs text-gray-400">ex GST · {fmtCurrency(estimate.totalEstimateIncGst)} inc GST</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            {estimate.jobSizeClassification && (
              <Badge variant="outline" className="text-xs capitalize bg-gray-100 text-gray-600">{estimate.jobSizeClassification} job</Badge>
            )}
            <Badge variant="outline" className={`text-xs capitalize ${CONFIDENCE_COLORS[estimate.confidence as keyof typeof CONFIDENCE_COLORS] || ""}`}>
              {estimate.confidence} confidence
            </Badge>
          </div>
        </div>

        {estimate.confidenceReason && (
          <p className="text-xs text-gray-500 italic border-l-2 border-purple-200 pl-3">{estimate.confidenceReason}</p>
        )}

        {/* Breakdown */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cost Breakdown</p>
          <div className="flex flex-col gap-2">
            {estimate.breakdown?.map((item: any) => {
              const Icon = CAT_ICONS[item.category] || MoreHorizontal;
              const pct = estimate.totalEstimateExGst > 0 ? (item.amount / estimate.totalEstimateExGst) * 100 : 0;
              return (
                <div key={item.category} className="flex flex-col gap-0.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-gray-400" /><span className="text-sm font-medium text-gray-700">{item.category}</span></div>
                    <span className="text-sm font-semibold text-gray-900">{fmtCurrency(item.amount)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  {item.notes && <p className="text-xs text-gray-400 pl-5">{item.notes}</p>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Line items */}
        {estimate.lineItems?.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <button onClick={() => setShowLineItems(!showLineItems)} className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Trade Line Items ({estimate.lineItems.length})
              {showLineItems ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
            {showLineItems && (
              <div className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                {estimate.lineItems.map((item: any, i: number) => (
                  <div key={i} className="flex items-start justify-between gap-3 px-3 py-2 bg-white">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-semibold text-purple-700">{item.trade}</span>
                      <p className="text-xs text-gray-600 mt-0.5">{item.description}</p>
                    </div>
                    <span className="text-xs font-bold text-gray-800 flex-shrink-0">{fmtCurrency(item.estimatedCost)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Adjust cost */}
        <div className="flex flex-col gap-1.5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Label className="text-xs font-semibold text-amber-800">Adjust Cost of Works (ex GST)</Label>
          <p className="text-xs text-amber-700">If the AI estimate is off, update this number before building the quote.</p>
          <div className="relative mt-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
            <Input
              type="number"
              value={adjustedCost}
              onChange={e => setAdjustedCost(e.target.value)}
              className="pl-7 font-semibold text-base"
            />
          </div>
        </div>

        {/* Margin + quote preview */}
        <div className="flex flex-col gap-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="flex items-center gap-3">
            <Label className="text-xs font-semibold text-gray-700 whitespace-nowrap">Builder Margin (%)</Label>
            <Input
              type="number"
              value={details.builderMargin}
              onChange={e => setDetails({ ...details, builderMargin: e.target.value })}
              className="w-24 h-8 text-right"
              min="0" max="100" step="1"
            />
          </div>
          <div className="flex flex-col gap-1 text-sm mt-1">
            <div className="flex justify-between"><span className="text-gray-500">Cost of works:</span><span>{fmtCurrency(costExGst)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Margin ({margin}%):</span><span className="text-blue-600">+{fmtCurrency(subtotalWithMargin - costExGst)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Subtotal ex GST:</span><span>{fmtCurrency(subtotalWithMargin)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">GST (10%):</span><span>{fmtCurrency(gst)}</span></div>
            <div className="flex justify-between font-semibold pt-1 border-t mt-1 text-green-700">
              <span>Quote Total inc GST:</span><span>{fmtCurrency(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" onClick={() => setStep("scope")}>← Back</Button>
          <Button className="flex-1 bg-purple-600 hover:bg-purple-700 text-white gap-2" onClick={() => setStep("details")}>
            Enter Client Details <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // ── Step: Client Details ──
  return (
    <div className="flex flex-col gap-5 max-h-[70vh] overflow-y-auto pr-1">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
        <div>
          <p className="font-semibold text-gray-900">Client & Project Details</p>
          <p className="text-xs text-gray-500">Who is this quote for?</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Label className="text-xs">Client / Company Name *</Label>
          <Input value={details.clientName} onChange={e => setDetails({ ...details, clientName: e.target.value })} placeholder="e.g. JP Flynn" />
        </div>
        <div>
          <Label className="text-xs">Client Email</Label>
          <Input type="email" value={details.clientEmail} onChange={e => setDetails({ ...details, clientEmail: e.target.value })} placeholder="client@example.com" />
        </div>
        <div>
          <Label className="text-xs">Client Phone</Label>
          <Input value={details.clientPhone} onChange={e => setDetails({ ...details, clientPhone: e.target.value })} placeholder="04xx xxx xxx" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Site / Project Address</Label>
          <Input value={details.projectAddress} onChange={e => setDetails({ ...details, projectAddress: e.target.value })} placeholder="48 Tottenham Rd Gagebrook" />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Project Description</Label>
          <Input value={details.projectDescription} onChange={e => setDetails({ ...details, projectDescription: e.target.value })} placeholder="e.g. Full interior restoration — malicious damage" />
        </div>
        <div>
          <Label className="text-xs">Valid Until</Label>
          <Input type="date" value={details.validUntil} onChange={e => setDetails({ ...details, validUntil: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Sending Director</Label>
          <Select value={details.director} onValueChange={v => setDetails({ ...details, director: v })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Matt Roach">Matt Roach</SelectItem>
              <SelectItem value="Will Scott">Will Scott</SelectItem>
              <SelectItem value="Mark Ede">Mark Ede</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Internal Notes</Label>
          <Textarea value={details.notes} onChange={e => setDetails({ ...details, notes: e.target.value })} rows={2} placeholder="Internal notes…" />
        </div>
      </div>

      {/* Deposit */}
      <div className="border rounded-xl p-3 bg-gray-50 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input type="checkbox" id="depositReqNew" checked={details.depositRequired} onChange={e => setDetails({ ...details, depositRequired: e.target.checked })} className="h-4 w-4 accent-purple-600" />
          <Label htmlFor="depositReqNew" className="text-sm font-medium cursor-pointer">Require Deposit</Label>
        </div>
        {details.depositRequired && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={details.depositType} onValueChange={v => setDetails({ ...details, depositType: v as any })}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{details.depositType === "percentage" ? "Deposit %" : "Amount ($)"}</Label>
              <Input type="number" value={details.depositValue} onChange={e => setDetails({ ...details, depositValue: e.target.value })} />
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button variant="outline" onClick={() => setStep("estimate")}>← Back</Button>
        <Button
          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white gap-2"
          onClick={handleCreate}
          disabled={!details.clientName || createMutation.isPending}
        >
          {createMutation.isPending
            ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Creating…</>
            : <><Check className="h-4 w-4" /> Create Quote</>
          }
        </Button>
      </div>
    </div>
  );
}

// ──────────────────────────────── Quote Editor ───────────────────────────────

function QuoteEditor({ quote, onClose, onUpdate }: { quote: QuoteWithItems; onClose: () => void; onUpdate: () => void }) {
  const { toast } = useToast();
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [editingItem, setEditingItem] = useState<QuoteItem | null>(null);
  const [newItem, setNewItem] = useState({ description: "", quantity: "1", unitPrice: "", itemType: "other" });
  const [editDetails, setEditDetails] = useState({
    clientName: quote.clientName, clientEmail: quote.clientEmail || "",
    clientPhone: quote.clientPhone || "", clientAddress: quote.clientAddress || "",
    projectDescription: quote.projectDescription, projectAddress: quote.projectAddress || "",
    notes: quote.notes || "", depositRequired: quote.depositRequired || false,
    depositType: (quote.depositType || "percentage") as "percentage" | "fixed",
    depositValue: quote.depositValue || "10",
  });
  const [lumpSumScope, setLumpSumScope] = useState(quote.scopeText || "");
  const [lumpSumAmount, setLumpSumAmount] = useState(quote.lumpSumTotal || "");
  const [showScopeEdit, setShowScopeEdit] = useState(false);
  const [hideFigures, setHideFigures] = useState(false);

  const updateDetailsMutation = useMutation({
    mutationFn: (data: typeof editDetails) => apiRequest("PATCH", `/api/quotes/${quote.id}`, data).then(r => r.json()),
    onSuccess: () => { onUpdate(); setShowEditDetails(false); toast({ title: "Details updated" }); },
    onError: () => toast({ title: "Failed to update", variant: "destructive" }),
  });

  const updateMarginMutation = useMutation({
    mutationFn: (margin: string) => apiRequest("PATCH", `/api/quotes/${quote.id}`, { builderMargin: margin }).then(r => r.json()),
    onSuccess: () => onUpdate(),
  });

  const saveLumpSumMutation = useMutation({
    mutationFn: ({ scope, amount }: { scope: string; amount: string }) => {
      const margin = parseFloat(quote.builderMargin || "0") || 0;
      const base = parseFloat(amount) || 0;
      const sub = base * (1 + margin / 100);
      const gst = sub * 0.1;
      return apiRequest("PATCH", `/api/quotes/${quote.id}`, {
        quoteType: "lump_sum", scopeText: scope, lumpSumTotal: amount,
        subtotal: sub.toFixed(2), gstAmount: gst.toFixed(2), totalAmount: (sub + gst).toFixed(2),
      }).then(r => r.json());
    },
    onSuccess: () => { onUpdate(); setShowScopeEdit(false); toast({ title: "Scope saved" }); },
    onError: () => toast({ title: "Failed to save scope", variant: "destructive" }),
  });

  const addItemMutation = useMutation({
    mutationFn: (item: typeof newItem) => {
      const totalPrice = (parseFloat(item.quantity) * parseFloat(item.unitPrice)).toFixed(2);
      if (editingItem) return apiRequest("PATCH", `/api/quotes/${quote.id}/items/${editingItem.id}`, { ...item, totalPrice }).then(r => r.json());
      return apiRequest("POST", `/api/quotes/${quote.id}/items`, { ...item, totalPrice }).then(r => r.json());
    },
    onSuccess: () => {
      onUpdate(); setShowAddItem(false); setEditingItem(null);
      setNewItem({ description: "", quantity: "1", unitPrice: "", itemType: "other" });
      toast({ title: editingItem ? "Item updated" : "Item added" });
    },
    onError: () => toast({ title: "Failed", variant: "destructive" }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (itemId: string) => apiRequest("DELETE", `/api/quotes/${quote.id}/items/${itemId}`),
    onSuccess: () => { onUpdate(); toast({ title: "Item removed" }); },
  });

  const sendMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${quote.id}/send`).then(r => r.json()),
    onSuccess: () => { onUpdate(); toast({ title: "Quote sent to client" }); },
    onError: () => toast({ title: "Failed to send quote", variant: "destructive" }),
  });

  const convertMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/quotes/${quote.id}/convert`, { hourlyRate: "50" }).then(r => r.json()),
    onSuccess: () => { onUpdate(); toast({ title: "Converted to job" }); onClose(); },
    onError: () => toast({ title: "Failed to convert", variant: "destructive" }),
  });

  const margin = parseFloat(quote.builderMargin || "0") || 0;
  const lumpAmount = parseFloat(lumpSumAmount) || 0;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg">{quote.quoteNumber}</DialogTitle>
              <DialogDescription>{quote.clientName} — {quote.projectDescription}</DialogDescription>
            </div>
            {statusConfig[quote.status] && (
              <Badge className={statusConfig[quote.status].color}>{statusConfig[quote.status].label}</Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client details */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Client & Project</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowEditDetails(!showEditDetails)}>
                  <Edit className="h-3.5 w-3.5 mr-1" />{showEditDetails ? "Cancel" : "Edit"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {showEditDetails ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2"><Label className="text-xs">Client Name</Label><Input value={editDetails.clientName} onChange={e => setEditDetails({ ...editDetails, clientName: e.target.value })} /></div>
                    <div><Label className="text-xs">Email</Label><Input value={editDetails.clientEmail} onChange={e => setEditDetails({ ...editDetails, clientEmail: e.target.value })} /></div>
                    <div><Label className="text-xs">Phone</Label><Input value={editDetails.clientPhone} onChange={e => setEditDetails({ ...editDetails, clientPhone: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Project Description</Label><Input value={editDetails.projectDescription} onChange={e => setEditDetails({ ...editDetails, projectDescription: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Project Address</Label><Input value={editDetails.projectAddress} onChange={e => setEditDetails({ ...editDetails, projectAddress: e.target.value })} /></div>
                    <div className="col-span-2"><Label className="text-xs">Notes</Label><Textarea value={editDetails.notes} onChange={e => setEditDetails({ ...editDetails, notes: e.target.value })} rows={2} /></div>
                  </div>
                  <Button size="sm" onClick={() => updateDetailsMutation.mutate(editDetails)} disabled={updateDetailsMutation.isPending}>
                    {updateDetailsMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500 text-xs">Client</span><p className="font-medium">{quote.clientName}</p></div>
                  <div><span className="text-gray-500 text-xs">Email</span><p className="font-medium">{quote.clientEmail || "—"}</p></div>
                  <div><span className="text-gray-500 text-xs">Phone</span><p className="font-medium">{quote.clientPhone || "—"}</p></div>
                  <div><span className="text-gray-500 text-xs">Project Address</span><p className="font-medium">{quote.projectAddress || "—"}</p></div>
                  {quote.notes && <div className="col-span-2"><span className="text-gray-500 text-xs">Notes</span><p className="font-medium">{quote.notes}</p></div>}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scope / line items */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-sm">{quote.quoteType === "lump_sum" ? "Scope & Pricing" : "Line Items"}</CardTitle>
                <div className="flex gap-1.5 flex-wrap">
                  {quote.quoteType === "lump_sum" && (
                    <Button size="sm" variant="outline" onClick={() => setShowScopeEdit(!showScopeEdit)}>
                      <Edit className="h-3.5 w-3.5 mr-1" />{showScopeEdit ? "Cancel" : "Edit Scope"}
                    </Button>
                  )}
                  {quote.quoteType !== "lump_sum" && (
                    <Button size="sm" variant="outline" onClick={() => setShowAddItem(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" />Add Item
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {quote.quoteType === "lump_sum" ? (
                <div className="space-y-3">
                  {quote.scopeText && !showScopeEdit && (
                    <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 whitespace-pre-wrap max-h-40 overflow-y-auto">
                      {quote.scopeText}
                    </div>
                  )}
                  {showScopeEdit && (
                    <div className="space-y-3">
                      <Textarea value={lumpSumScope} onChange={e => setLumpSumScope(e.target.value)} rows={6} className="text-sm font-mono" />
                      <div className="flex gap-3 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Cost of Works ex GST ($)</Label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                            <Input type="number" value={lumpSumAmount} onChange={e => setLumpSumAmount(e.target.value)} className="pl-7" />
                          </div>
                        </div>
                        <Button onClick={() => saveLumpSumMutation.mutate({ scope: lumpSumScope, amount: lumpSumAmount })} disabled={!lumpSumAmount || saveLumpSumMutation.isPending}>
                          {saveLumpSumMutation.isPending ? "Saving…" : "Save"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  {quote.items.length === 0 ? (
                    <p className="text-center text-gray-400 py-6 text-sm">No line items yet.</p>
                  ) : quote.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.description}</p>
                        <p className="text-xs text-gray-500">{parseFloat(item.quantity)} × ${parseFloat(item.unitPrice).toFixed(2)}</p>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className="font-semibold text-sm">${parseFloat(item.totalPrice).toFixed(2)}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => {
                          setEditingItem(item);
                          setNewItem({ description: item.description, quantity: item.quantity, unitPrice: item.unitPrice, itemType: item.itemType });
                          setShowAddItem(true);
                        }}><Edit className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteItemMutation.mutate(item.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Totals */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Subtotal ex GST:</span>
                  <span>${parseFloat(quote.subtotal).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500">Margin:</span>
                    <Input type="number" className="w-16 h-7 text-right text-xs" value={quote.builderMargin || "0"}
                      onChange={e => updateMarginMutation.mutate(e.target.value)} min="0" max="100" step="0.5" />
                    <span className="text-gray-500">%</span>
                  </div>
                  <span className="text-blue-600">+${((parseFloat(quote.subtotal) * parseFloat(quote.builderMargin || "0")) / 100).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GST (10%):</span>
                  <span>${parseFloat(quote.gstAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between font-bold text-base pt-2 border-t">
                  <span>Total inc GST:</span>
                  <span className="text-green-600">${parseFloat(quote.totalAmount).toLocaleString("en-AU", { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-3 border-t">
          <Button
            variant={hideFigures ? "default" : "outline"}
            size="sm"
            onClick={() => setHideFigures(h => !h)}
            title={hideFigures ? "Showing total only — click for detailed PDF" : "Click to hide line item figures (show total only)"}
          >
            {hideFigures ? "Total Only" : "Detailed PDF"}
          </Button>
          <Button variant="outline" onClick={async () => {
            await generateQuotePDF({
              ...quote,
              createdAt: quote.createdAt?.toString() || new Date().toISOString(),
              acceptedAt: quote.acceptedAt?.toString() || null,
              validUntil: quote.validUntil?.toString() || null,
              signature: quote.signatures?.[0] ? { signerName: quote.signatures[0].signerName, signatureData: quote.signatures[0].signatureData, signedAt: quote.signatures[0].signedAt?.toString() || new Date().toISOString() } : null,
            }, true, hideFigures);
          }}>
            <Download className="h-4 w-4 mr-1.5" /> PDF
          </Button>
          {quote.clientEmail && (quote.status === "draft" || quote.status === "sent" || quote.status === "viewed") && (
            <Button onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending}>
              <Mail className="h-4 w-4 mr-1.5" />
              {sendMutation.isPending ? "Sending…" : quote.status === "draft" ? "Send to Client" : "Resend"}
            </Button>
          )}
          {quote.status === "accepted" && (
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => convertMutation.mutate()} disabled={convertMutation.isPending}>
              <Building2 className="h-4 w-4 mr-1.5" />{convertMutation.isPending ? "Converting…" : "Convert to Job"}
            </Button>
          )}
        </div>

        {/* Add item dialog */}
        <Dialog open={showAddItem} onOpenChange={open => { setShowAddItem(open); if (!open) { setEditingItem(null); setNewItem({ description: "", quantity: "1", unitPrice: "", itemType: "other" }); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>{editingItem ? "Edit Item" : "Add Line Item"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Description</Label><Input value={newItem.description} onChange={e => setNewItem({ ...newItem, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><Label>Quantity</Label><Input type="number" value={newItem.quantity} onChange={e => setNewItem({ ...newItem, quantity: e.target.value })} /></div>
                <div><Label>Unit Price ($)</Label><Input type="number" step="0.01" value={newItem.unitPrice} onChange={e => setNewItem({ ...newItem, unitPrice: e.target.value })} /></div>
              </div>
              {newItem.quantity && newItem.unitPrice && (
                <p className="text-right text-sm text-gray-600">Total: ${(parseFloat(newItem.quantity) * parseFloat(newItem.unitPrice)).toFixed(2)}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowAddItem(false)}>Cancel</Button>
                <Button onClick={() => addItemMutation.mutate(newItem)} disabled={!newItem.description || !newItem.unitPrice || addItemMutation.isPending}>
                  {editingItem ? "Save" : "Add Item"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────── Main Page ───────────────────────────────────

export default function QuotesPage() {
  const { toast } = useToast();
  const [showWizard, setShowWizard] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteWithItems | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: quotes = [], isLoading } = useQuery<Quote[]>({
    queryKey: ["/api/quotes"],
  });

  useEffect(() => {
    apiRequest("POST", "/api/quotes/acknowledge-accepted").catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["/api/quotes/unacknowledged-count"] });
  }, []);

  const deleteQuoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/quotes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }); toast({ title: "Quote deleted" }); },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const sendQuoteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/quotes/${id}/send`).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quotes"] }); toast({ title: "Quote sent" }); },
    onError: () => toast({ title: "Failed to send", variant: "destructive" }),
  });

  const fetchQuoteDetails = async (id: string) => {
    try {
      const q = await fetch(`/api/quotes/${id}`, { credentials: "include" }).then(r => r.json());
      setSelectedQuote(q);
    } catch {
      toast({ title: "Failed to load quote", variant: "destructive" });
    }
  };

  const filteredQuotes = quotes.filter(q => {
    const matchSearch =
      q.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.projectDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase());
    return matchSearch && (statusFilter === "all" || q.status === statusFilter);
  });

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
            <h1 className="text-xl font-bold">Quotes</h1>
          </div>
          <Button onClick={() => setShowWizard(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
            <Sparkles className="h-4 w-4" /> New Quote
          </Button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <Input placeholder="Search quotes…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="sm:max-w-xs" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="sm:w-[180px]"><SelectValue placeholder="Filter by status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600" />
          </div>
        )}

        {!isLoading && filteredQuotes.length === 0 && (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="flex flex-col items-center justify-center py-20 gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-50 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-lg">No quotes yet</h3>
                <p className="text-sm text-gray-500 mt-1 max-w-sm">Upload a scope or describe works on-site — AI estimates the cost and builds a quote ready to send.</p>
              </div>
              <Button onClick={() => setShowWizard(true)} className="bg-purple-600 hover:bg-purple-700 text-white gap-2">
                <Sparkles className="h-4 w-4" /> Create First Quote
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredQuotes.map(quote => {
            const cfg = statusConfig[quote.status] || statusConfig.draft;
            const StatusIcon = cfg.icon;
            return (
              <Card key={quote.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => fetchQuoteDetails(quote.id)}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <p className="text-xs text-gray-400">{quote.quoteNumber}</p>
                      <CardTitle className="text-base truncate mt-0.5">{quote.clientName}</CardTitle>
                    </div>
                    <Badge className={`${cfg.color} flex items-center gap-1 flex-shrink-0 ml-2`}>
                      <StatusIcon className="h-3 w-3" />{cfg.label}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500 line-clamp-2 mb-3">{quote.projectDescription}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-green-600">
                      ${parseFloat(quote.totalAmount).toLocaleString("en-AU", { minimumFractionDigits: 0 })}
                      <span className="text-xs font-normal text-gray-400 ml-1">inc GST</span>
                    </p>
                    <p className="text-xs text-gray-400">{new Date(quote.createdAt!).toLocaleDateString("en-AU")}</p>
                  </div>
                  <div className="flex gap-1.5 mt-3 flex-wrap" onClick={e => e.stopPropagation()}>
                    {(quote.status === "draft" || quote.status === "sent" || quote.status === "viewed") && quote.clientEmail && (
                      <Button size="sm" onClick={() => sendQuoteMutation.mutate(quote.id)} disabled={sendQuoteMutation.isPending} className="h-7 text-xs">
                        <Mail className="h-3 w-3 mr-1" />{quote.status === "draft" ? "Send" : "Resend"}
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete {quote.quoteNumber}?</AlertDialogTitle>
                          <AlertDialogDescription>This will permanently delete this quote.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteQuoteMutation.mutate(quote.id)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* New Quote Wizard Dialog */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="max-w-lg max-h-[95vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" /> New Quote
            </DialogTitle>
            <DialogDescription>Upload a scope or describe works — AI estimates the cost, then you send it to the client.</DialogDescription>
          </DialogHeader>
          <NewQuoteWizard
            onClose={() => setShowWizard(false)}
            onCreated={async (id) => {
              setShowWizard(false);
              queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
              await fetchQuoteDetails(id);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Quote Editor */}
      {selectedQuote && (
        <QuoteEditor
          quote={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/quotes"] });
            fetchQuoteDetails(selectedQuote.id);
          }}
        />
      )}
    </div>
  );
}

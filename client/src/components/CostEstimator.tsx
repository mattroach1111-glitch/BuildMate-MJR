import { useState, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Upload, FileText, X, ChevronDown, ChevronUp,
  AlertCircle, TrendingUp, Building2, Hammer, Package, MoreHorizontal
} from "lucide-react";

interface CostBreakdownItem {
  category: string;
  amount: number;
  notes: string;
}

interface LineItem {
  trade: string;
  description: string;
  estimatedCost: number;
}

interface CostEstimate {
  jobSizeClassification?: "minor" | "medium" | "major" | "large";
  totalEstimateExGst: number;
  totalEstimateIncGst: number;
  confidence: "low" | "medium" | "high";
  confidenceReason: string;
  breakdown: CostBreakdownItem[];
  lineItems: LineItem[];
  assumptions: string[];
  similarJobDetails?: { address: string; total: number }[];
  historicalJobCount: number;
}

const CATEGORY_ICONS: Record<string, any> = {
  "Labour": Hammer,
  "Materials": Package,
  "Sub-trades": Building2,
  "Other / Preliminaries": MoreHorizontal,
};

const CONFIDENCE_COLORS = {
  low: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  high: "bg-green-100 text-green-700 border-green-200",
};

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(n);

interface CostEstimatorProps {
  jobId: string;
}

export function CostEstimator({ jobId }: CostEstimatorProps) {
  const { toast } = useToast();
  const storageKey = `cost_estimate_${jobId}`;
  const [isOpen, setIsOpen] = useState(false);
  const [scopeText, setScopeText] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [pdfMimeType, setPdfMimeType] = useState("application/pdf");
  const [fileName, setFileName] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [estimate, setEstimate] = useState<CostEstimate | null>(null);
  const [showLineItems, setShowLineItems] = useState(false);

  // Load persisted estimate when the component mounts / jobId changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setEstimate(JSON.parse(saved));
    } catch { /* ignore parse errors */ }
  }, [storageKey]);

  const saveEstimate = (data: CostEstimate) => {
    setEstimate(data);
    try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch { /* storage full */ }
  };

  const clearEstimate = () => {
    setEstimate(null);
    try { localStorage.removeItem(storageKey); } catch { /* ignore */ }
  };

  const estimateMutation = useMutation({
    mutationFn: (body: any) =>
      apiRequest("POST", "/api/cost-estimate", body).then(r => r.json()),
    onSuccess: (data: CostEstimate) => {
      saveEstimate(data);
      toast({ title: "Cost estimate ready" });
    },
    onError: (e: any) => toast({ title: "Estimation failed", description: e.message, variant: "destructive" }),
  });

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsReading(true);
    setFileName(file.name);
    setPdfMimeType(file.type || "application/pdf");
    const reader = new FileReader();
    reader.onload = () => {
      const b64 = (reader.result as string).split(",")[1];
      setPdfBase64(b64);
      setIsReading(false);
    };
    reader.onerror = () => { setIsReading(false); toast({ title: "Failed to read file", variant: "destructive" }); };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [toast]);

  const clearFile = () => { setPdfBase64(null); setFileName(null); };

  const handleEstimate = () => {
    if (!pdfBase64 && !scopeText.trim()) {
      toast({ title: "Upload a PDF or paste your scope first", variant: "destructive" });
      return;
    }
    setEstimate(null);
    const body: any = {};
    if (pdfBase64) { body.pdfBase64 = pdfBase64; body.pdfMimeType = pdfMimeType; }
    else { body.scopeText = scopeText; }
    estimateMutation.mutate(body);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Toggle / intro */}
      {!isOpen && !estimate && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-3 w-full text-left p-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/40 hover:border-purple-300 hover:bg-purple-50 transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-sm">AI Cost Estimator</p>
            <p className="text-xs text-gray-500 mt-0.5">Upload a scope of works PDF — AI predicts cost based on your job history</p>
          </div>
        </button>
      )}

      {/* Input panel */}
      {(isOpen || estimateMutation.isPending) && !estimate && (
        <div className="flex flex-col gap-4 p-4 rounded-xl border border-purple-100 bg-purple-50/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-600" />
              <span className="font-semibold text-gray-800 text-sm">AI Cost Estimator</span>
            </div>
            {!estimateMutation.isPending && (
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* PDF Upload */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-gray-700">Scope of Works PDF</label>
            {pdfBase64 && fileName ? (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                <FileText className="h-5 w-5 text-green-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-green-800 truncate">{fileName}</p>
                  <p className="text-xs text-green-600">PDF ready — will be sent directly to AI</p>
                </div>
                <button onClick={clearFile} className="flex-shrink-0 text-green-400 hover:text-green-700">
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
                  <><Upload className="h-5 w-5" /> <span className="font-medium text-sm">Tap to upload PDF</span></>
                )}
              </label>
            )}
          </div>

          {/* Manual scope fallback */}
          {!pdfBase64 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400 font-medium">or paste scope manually</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
              <Textarea
                value={scopeText}
                onChange={e => setScopeText(e.target.value)}
                placeholder="Paste your scope of works here…"
                className="min-h-[80px] text-sm resize-y"
              />
            </div>
          )}

          <p className="text-xs text-purple-600 flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> AI uses your real job history to calibrate the estimate.
          </p>

          <div className="flex gap-2">
            <Button
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white gap-2"
              onClick={handleEstimate}
              disabled={estimateMutation.isPending}
            >
              {estimateMutation.isPending ? (
                <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Analysing…</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Estimate Cost</>
              )}
            </Button>
            {!estimateMutation.isPending && (
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {estimate && (
        <div className="flex flex-col gap-4 p-4 rounded-xl border border-purple-100 bg-white">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Estimated Builder's Cost</p>
                <p className="text-2xl font-bold text-gray-900">{fmtCurrency(estimate.totalEstimateExGst)}</p>
                <p className="text-xs text-gray-400">ex GST · {fmtCurrency(estimate.totalEstimateIncGst)} inc GST</p>
                <p className="text-xs text-purple-500 mt-0.5">Your labour, materials & sub-trades</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              {estimate.jobSizeClassification && (
                <Badge variant="outline" className="text-xs font-semibold capitalize bg-gray-100 text-gray-600 border-gray-200">
                  {estimate.jobSizeClassification} job
                </Badge>
              )}
              <Badge variant="outline" className={`text-xs font-semibold capitalize ${CONFIDENCE_COLORS[estimate.confidence]}`}>
                {estimate.confidence} confidence
              </Badge>
              {estimate.historicalJobCount > 0 && (
                <span className="text-xs text-gray-400">Based on {estimate.historicalJobCount} jobs</span>
              )}
            </div>
          </div>

          {/* Confidence reason */}
          {estimate.confidenceReason && (
            <p className="text-xs text-gray-500 italic border-l-2 border-purple-200 pl-3">
              {estimate.confidenceReason}
            </p>
          )}

          {/* Cost breakdown */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Breakdown</p>
            <div className="flex flex-col gap-1.5">
              {estimate.breakdown.map(item => {
                const Icon = CATEGORY_ICONS[item.category] || MoreHorizontal;
                const pct = estimate.totalEstimateExGst > 0 ? (item.amount / estimate.totalEstimateExGst) * 100 : 0;
                return (
                  <div key={item.category} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-sm font-medium text-gray-700">{item.category}</span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900">{fmtCurrency(item.amount)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-purple-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    {item.notes && <p className="text-xs text-gray-400 pl-5">{item.notes}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Line items toggle */}
          {estimate.lineItems?.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowLineItems(!showLineItems)}
                className="flex items-center justify-between w-full text-left"
              >
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Trade Line Items ({estimate.lineItems.length})
                </p>
                {showLineItems ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
              </button>
              {showLineItems && (
                <div className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  {estimate.lineItems.map((item, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 px-3 py-2.5 bg-white">
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-semibold text-purple-700">{item.trade}</span>
                        <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{item.description}</p>
                      </div>
                      <span className="text-xs font-bold text-gray-800 flex-shrink-0">{fmtCurrency(item.estimatedCost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Similar jobs */}
          {estimate.similarJobDetails?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Similar Jobs Used</p>
              <div className="flex flex-col gap-1">
                {estimate.similarJobDetails.map((j, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-1.5">
                    <span className="truncate">{j.address}</span>
                    <span className="font-semibold text-gray-700 flex-shrink-0 ml-2">{fmtCurrency(j.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assumptions */}
          {estimate.assumptions?.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Assumptions</p>
              <ul className="flex flex-col gap-1">
                {estimate.assumptions.map((a, i) => (
                  <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                    <span className="text-purple-400 mt-0.5 flex-shrink-0">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Re-run button */}
          <Button
            variant="outline"
            size="sm"
            className="gap-2 self-start"
            onClick={() => { clearEstimate(); setIsOpen(true); }}
          >
            <Sparkles className="h-3.5 w-3.5" /> New Estimate
          </Button>
        </div>
      )}
    </div>
  );
}

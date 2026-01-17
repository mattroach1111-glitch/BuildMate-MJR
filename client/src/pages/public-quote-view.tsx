import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { 
  Check, 
  X, 
  FileText,
  DollarSign,
  Building2,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  CheckCircle2,
  XCircle
} from "lucide-react";
import type { Quote, QuoteItem } from "@shared/schema";

type QuoteWithItems = Quote & { items: QuoteItem[] };

export default function PublicQuoteView() {
  const [, params] = useRoute("/quote/view/:token");
  const token = params?.token;
  
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showDeclineDialog, setShowDeclineDialog] = useState(false);
  const [signerData, setSignerData] = useState({
    signerName: "",
    signerEmail: "",
    signerTitle: "",
  });
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const { data: quote, isLoading, error } = useQuery<QuoteWithItems>({
    queryKey: ["/api/public/quote", token],
    queryFn: async () => {
      const response = await fetch(`/api/public/quote/${token}`);
      if (!response.ok) {
        throw new Error("Quote not found or expired");
      }
      return response.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/quote/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...signerData,
          signatureData,
        }),
      });
      if (!response.ok) throw new Error("Failed to accept quote");
      return response.json();
    },
    onSuccess: () => {
      setShowAcceptDialog(false);
      window.location.reload();
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/quote/${token}/decline`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to decline quote");
      return response.json();
    },
    onSuccess: () => {
      setShowDeclineDialog(false);
      window.location.reload();
    },
  });

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      setSignatureData(canvas.toDataURL());
    }
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
      }
    }
  };

  const itemTypeLabels: Record<string, string> = {
    labor: "Labour",
    materials: "Materials",
    sub_trade: "Sub-Trade",
    other: "Other",
    tip_fee: "Tip Fee",
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-gray-600">Loading quote...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-16 w-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Quote Not Found</h2>
            <p className="text-gray-600">
              This quote link may have expired or is invalid. Please contact MJR Builders for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const itemsByType = quote.items.reduce((acc, item) => {
    if (!acc[item.itemType]) acc[item.itemType] = [];
    acc[item.itemType].push(item);
    return acc;
  }, {} as Record<string, QuoteItem[]>);

  const isAccepted = quote.status === "accepted";
  const isDeclined = quote.status === "declined";
  const canRespond = !isAccepted && !isDeclined;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">MJR Builders</h1>
          <p className="text-gray-600">Quote {quote.quoteNumber}</p>
        </div>

        {isAccepted && (
          <Card className="mb-6 border-green-200 bg-green-50">
            <CardContent className="py-6 text-center">
              <CheckCircle2 className="h-12 w-12 mx-auto text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-green-800">Quote Accepted</h3>
              <p className="text-green-700">Thank you for accepting this quote. We will be in touch shortly.</p>
            </CardContent>
          </Card>
        )}

        {isDeclined && (
          <Card className="mb-6 border-red-200 bg-red-50">
            <CardContent className="py-6 text-center">
              <XCircle className="h-12 w-12 mx-auto text-red-600 mb-3" />
              <h3 className="text-lg font-semibold text-red-800">Quote Declined</h3>
              <p className="text-red-700">This quote has been declined.</p>
            </CardContent>
          </Card>
        )}

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Project Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg">{quote.projectDescription}</h3>
              {quote.projectAddress && (
                <p className="text-gray-600 flex items-center gap-2 mt-1">
                  <MapPin className="h-4 w-4" />
                  {quote.projectAddress}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Client</p>
                <p className="font-medium">{quote.clientName}</p>
              </div>
              {quote.validUntil && (
                <div>
                  <p className="text-gray-500">Valid Until</p>
                  <p className="font-medium flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(quote.validUntil).toLocaleDateString('en-AU')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Quote Items
            </CardTitle>
          </CardHeader>
          <CardContent>
            {Object.entries(itemsByType).map(([type, items]) => (
              <div key={type} className="mb-4 last:mb-0">
                <h4 className="font-medium text-sm text-gray-600 mb-2">{itemTypeLabels[type] || type}</h4>
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.id} className="flex justify-between items-start p-3 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-gray-500">
                          {parseFloat(item.quantity)} x ${parseFloat(item.unitPrice).toFixed(2)}
                        </p>
                      </div>
                      <span className="font-semibold">${parseFloat(item.totalPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">Subtotal (ex GST)</span>
                <span className="font-medium">${(() => {
                  const subtotal = parseFloat(quote.subtotal);
                  const margin = parseFloat(quote.builderMargin) || 0;
                  const subtotalWithMargin = subtotal * (1 + margin / 100);
                  return subtotalWithMargin.toLocaleString('en-AU', { minimumFractionDigits: 2 });
                })()}</span>
              </div>
              <div className="flex justify-between text-lg">
                <span className="text-gray-600">GST (10%)</span>
                <span className="font-medium">${parseFloat(quote.gstAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between text-2xl pt-3 border-t">
                <span className="font-bold">Total (inc GST)</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
                  <DollarSign className="h-6 w-6" />
                  {parseFloat(quote.totalAmount).toLocaleString('en-AU', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {canRespond && (
          <div className="flex gap-4">
            <Button
              className="flex-1 h-14 text-lg bg-green-600 hover:bg-green-700"
              onClick={() => setShowAcceptDialog(true)}
            >
              <Check className="h-5 w-5 mr-2" />
              Accept Quote
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-14 text-lg border-red-300 text-red-600 hover:bg-red-50"
              onClick={() => setShowDeclineDialog(true)}
            >
              <X className="h-5 w-5 mr-2" />
              Decline
            </Button>
          </div>
        )}

        <p className="text-center text-sm text-gray-500 mt-8">
          For questions, contact MJR Builders
        </p>
      </div>

      <Dialog open={showAcceptDialog} onOpenChange={setShowAcceptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Accept Quote</DialogTitle>
            <DialogDescription>
              Please provide your details and signature to accept this quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your Name *</Label>
              <Input
                value={signerData.signerName}
                onChange={(e) => setSignerData({ ...signerData, signerName: e.target.value })}
                placeholder="Full name"
              />
            </div>
            <div>
              <Label>Your Email *</Label>
              <Input
                type="email"
                value={signerData.signerEmail}
                onChange={(e) => setSignerData({ ...signerData, signerEmail: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label>Your Title/Position</Label>
              <Input
                value={signerData.signerTitle}
                onChange={(e) => setSignerData({ ...signerData, signerTitle: e.target.value })}
                placeholder="e.g., Home Owner"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Signature</Label>
                <Button variant="ghost" size="sm" onClick={clearSignature}>Clear</Button>
              </div>
              <canvas
                ref={canvasRef}
                width={350}
                height={150}
                className="border rounded-lg w-full touch-none bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <p className="text-xs text-gray-500 mt-1">Draw your signature above</p>
            </div>
            <div className="flex gap-2 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowAcceptDialog(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => acceptMutation.mutate()}
                disabled={!signerData.signerName || !signerData.signerEmail || acceptMutation.isPending}
              >
                {acceptMutation.isPending ? "Accepting..." : "Accept Quote"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeclineDialog} onOpenChange={setShowDeclineDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline Quote</DialogTitle>
            <DialogDescription>
              Are you sure you want to decline this quote? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => setShowDeclineDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => declineMutation.mutate()}
              disabled={declineMutation.isPending}
            >
              {declineMutation.isPending ? "Declining..." : "Decline Quote"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { generateJobPDF } from "@/lib/pdfGenerator";
import type { Job, LaborEntry, Material, SubTrade } from "@shared/schema";

interface JobSheetModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface JobDetails extends Job {
  laborEntries: LaborEntry[];
  materials: Material[];
  subTrades: SubTrade[];
}

export default function JobSheetModal({ jobId, isOpen, onClose }: JobSheetModalProps) {
  const { toast } = useToast();
  const [builderMargin, setBuilderMargin] = useState("25");

  const { data: jobDetails, isLoading } = useQuery<JobDetails>({
    queryKey: ["/api/jobs", jobId],
    enabled: isOpen && !!jobId,
    retry: false,
  });

  const updateJobMutation = useMutation({
    mutationFn: async (data: Partial<Job>) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
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

  const addLaborMutation = useMutation({
    mutationFn: async (data: { staffId: string; hourlyRate: string }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/labor`, {
        staffId: data.staffId,
        hourlyRate: parseFloat(data.hourlyRate),
      });
      return response.json();
    },
    onSuccess: () => {
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

  useEffect(() => {
    if (jobDetails) {
      setBuilderMargin(jobDetails.builderMargin);
    }
  }, [jobDetails]);

  const calculateTotals = () => {
    if (!jobDetails) return { laborTotal: 0, materialsTotal: 0, subTradesTotal: 0, otherCostsTotal: 0, subtotal: 0, marginAmount: 0, total: 0 };

    const laborTotal = jobDetails.laborEntries.reduce((sum, entry) => {
      return sum + (parseFloat(entry.hourlyRate) * parseFloat(entry.hoursLogged));
    }, 0);

    const materialsTotal = jobDetails.materials.reduce((sum, material) => {
      return sum + parseFloat(material.amount);
    }, 0);

    const subTradesTotal = jobDetails.subTrades.reduce((sum, subTrade) => {
      return sum + parseFloat(subTrade.amount);
    }, 0);

    const otherCostsTotal = 
      parseFloat(jobDetails.tipFees) +
      parseFloat(jobDetails.permits) +
      parseFloat(jobDetails.equipment) +
      parseFloat(jobDetails.miscellaneous);

    const subtotal = laborTotal + materialsTotal + subTradesTotal + otherCostsTotal;
    const marginPercent = parseFloat(builderMargin) / 100;
    const marginAmount = subtotal * marginPercent;
    const total = subtotal + marginAmount;

    return {
      laborTotal,
      materialsTotal,
      subTradesTotal,
      otherCostsTotal,
      subtotal,
      marginAmount,
      total,
    };
  };

  const handleSave = () => {
    updateJobMutation.mutate({
      builderMargin: builderMargin,
    });
  };

  const handleDownloadPDF = async () => {
    if (!jobDetails) return;
    
    try {
      await generateJobPDF(jobDetails);
      toast({
        title: "Success",
        description: "PDF downloaded successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate PDF",
        variant: "destructive",
      });
    }
  };

  const totals = calculateTotals();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-screen overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle data-testid="text-job-sheet-title">
                {jobDetails ? `${jobDetails.projectName} - ${jobDetails.clientName}` : "Loading..."}
              </DialogTitle>
              <p className="text-gray-600" data-testid="text-job-number">
                Job #{jobDetails?.jobNumber}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button 
                onClick={handleDownloadPDF}
                className="bg-secondary hover:bg-green-700"
                disabled={!jobDetails}
                data-testid="button-download-pdf"
              >
                <i className="fas fa-download mr-2"></i>
                Download PDF
              </Button>
              <Button variant="ghost" onClick={onClose} data-testid="button-close-modal">
                <i className="fas fa-times text-xl"></i>
              </Button>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : !jobDetails ? (
          <div className="text-center py-8 text-gray-500">
            Job not found
          </div>
        ) : (
          <div className="space-y-8">
            {/* Labour Section */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle data-testid="text-labor-section-title">Labour</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // For demo purposes, we'll use a simple prompt
                      // In production, this would be a proper form modal
                      const staffId = prompt("Enter staff member name:");
                      const hourlyRate = prompt("Enter hourly rate:");
                      if (staffId && hourlyRate) {
                        addLaborMutation.mutate({ staffId, hourlyRate });
                      }
                    }}
                    data-testid="button-add-labor"
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
                        <th className="pb-3">Staff Member</th>
                        <th className="pb-3">Hourly Rate</th>
                        <th className="pb-3">Hours Logged</th>
                        <th className="pb-3">Total</th>
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {jobDetails.laborEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="py-2">
                            <span data-testid={`text-labor-staff-${entry.id}`}>{entry.staffId}</span>
                          </td>
                          <td className="py-2">
                            <span data-testid={`text-labor-rate-${entry.id}`}>${entry.hourlyRate}</span>
                          </td>
                          <td className="py-2">
                            <span className="text-sm text-gray-600" data-testid={`text-labor-hours-${entry.id}`}>
                              {entry.hoursLogged} hrs
                            </span>
                          </td>
                          <td className="py-2">
                            <span className="font-semibold" data-testid={`text-labor-total-${entry.id}`}>
                              ${(parseFloat(entry.hourlyRate) * parseFloat(entry.hoursLogged)).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-labor-total">
                    Labour Total: ${totals.laborTotal.toFixed(2)}
                  </span>
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
                      const invoiceDate = prompt("Enter invoice date (YYYY-MM-DD):");
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
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {jobDetails.materials.map((material) => (
                        <tr key={material.id}>
                          <td className="py-2" data-testid={`text-material-description-${material.id}`}>
                            {material.description}
                          </td>
                          <td className="py-2" data-testid={`text-material-supplier-${material.id}`}>
                            {material.supplier}
                          </td>
                          <td className="py-2" data-testid={`text-material-date-${material.id}`}>
                            {new Date(material.invoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-2" data-testid={`text-material-amount-${material.id}`}>
                            ${parseFloat(material.amount).toFixed(2)}
                          </td>
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
                      const invoiceDate = prompt("Enter invoice date (YYYY-MM-DD):");
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
                      </tr>
                    </thead>
                    <tbody className="space-y-2">
                      {jobDetails.subTrades.map((subTrade) => (
                        <tr key={subTrade.id}>
                          <td className="py-2" data-testid={`text-subtrade-trade-${subTrade.id}`}>
                            {subTrade.trade}
                          </td>
                          <td className="py-2" data-testid={`text-subtrade-contractor-${subTrade.id}`}>
                            {subTrade.contractor}
                          </td>
                          <td className="py-2" data-testid={`text-subtrade-date-${subTrade.id}`}>
                            {new Date(subTrade.invoiceDate).toLocaleDateString()}
                          </td>
                          <td className="py-2" data-testid={`text-subtrade-amount-${subTrade.id}`}>
                            ${parseFloat(subTrade.amount).toFixed(2)}
                          </td>
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
                <CardTitle data-testid="text-other-costs-title">Other Costs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tipFees">Tip Fees</Label>
                    <Input 
                      id="tipFees"
                      type="number" 
                      value={jobDetails.tipFees}
                      readOnly
                      data-testid="input-tip-fees"
                    />
                  </div>
                  <div>
                    <Label htmlFor="permits">Permits & Fees</Label>
                    <Input 
                      id="permits"
                      type="number" 
                      value={jobDetails.permits}
                      readOnly
                      data-testid="input-permits"
                    />
                  </div>
                  <div>
                    <Label htmlFor="equipment">Equipment Rental</Label>
                    <Input 
                      id="equipment"
                      type="number" 
                      value={jobDetails.equipment}
                      readOnly
                      data-testid="input-equipment"
                    />
                  </div>
                  <div>
                    <Label htmlFor="miscellaneous">Miscellaneous</Label>
                    <Input 
                      id="miscellaneous"
                      type="number" 
                      value={jobDetails.miscellaneous}
                      readOnly
                      data-testid="input-miscellaneous"
                    />
                  </div>
                </div>
                <div className="text-right mt-4">
                  <span className="text-lg font-semibold" data-testid="text-other-costs-total">
                    Other Costs Total: ${totals.otherCostsTotal.toFixed(2)}
                  </span>
                </div>
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
                    <div className="flex justify-between items-center py-3 bg-gray-50 px-4 rounded">
                      <span className="font-semibold text-gray-800">Subtotal:</span>
                      <span className="font-bold text-lg" data-testid="text-subtotal">
                        ${totals.subtotal.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="builderMargin">Builder's Margin (%)</Label>
                      <Input
                        id="builderMargin"
                        type="number"
                        value={builderMargin}
                        onChange={(e) => setBuilderMargin(e.target.value)}
                        className="text-lg"
                        data-testid="input-builder-margin"
                      />
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-gray-200">
                      <span className="text-gray-700">Margin Amount:</span>
                      <span className="font-semibold" data-testid="text-margin-amount">
                        ${totals.marginAmount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-4 bg-primary text-white px-4 rounded-lg">
                      <span className="font-bold text-lg">Total Amount:</span>
                      <span className="font-bold text-2xl" data-testid="text-total-amount">
                        ${totals.total.toFixed(2)}
                      </span>
                    </div>
                    <Button 
                      onClick={handleSave}
                      className="w-full bg-secondary hover:bg-green-700"
                      disabled={updateJobMutation.isPending}
                      data-testid="button-save-job"
                    >
                      <i className="fas fa-save mr-2"></i>
                      {updateJobMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

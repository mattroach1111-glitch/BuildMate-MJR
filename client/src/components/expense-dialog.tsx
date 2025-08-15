import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ExpenseData {
  isExpense: boolean;
  expenseAmount?: number;
  expenseAddress?: string;
  expenseDescription?: string;
  expenseCategory?: string;
}

interface ExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (expenseData: ExpenseData) => void;
  fileName: string;
  initialData?: ExpenseData;
}

export function ExpenseDialog({ isOpen, onClose, onSave, fileName, initialData }: ExpenseDialogProps) {
  const [isExpense, setIsExpense] = useState(initialData?.isExpense || false);
  const [expenseAmount, setExpenseAmount] = useState(initialData?.expenseAmount?.toString() || "");
  const [expenseAddress, setExpenseAddress] = useState(initialData?.expenseAddress || "");
  const [expenseDescription, setExpenseDescription] = useState(initialData?.expenseDescription || "");
  const [expenseCategory, setExpenseCategory] = useState(initialData?.expenseCategory || "");
  const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Fetch all job addresses for search suggestions
  const { data: jobs } = useQuery({
    queryKey: ["/api/jobs"],
    enabled: isOpen,
  });

  // Filter addresses based on input
  useEffect(() => {
    if (expenseAddress.trim().length > 1 && jobs) {
      const filteredAddresses = jobs
        .map((job: any) => job.jobAddress)
        .filter((address: string) => 
          address.toLowerCase().includes(expenseAddress.toLowerCase())
        )
        .slice(0, 5); // Limit to 5 suggestions
      
      setAddressSuggestions(filteredAddresses);
      setShowSuggestions(filteredAddresses.length > 0);
    } else {
      setShowSuggestions(false);
    }
  }, [expenseAddress, jobs]);

  const handleSave = () => {
    const expenseData: ExpenseData = {
      isExpense,
      expenseAmount: isExpense && expenseAmount ? parseFloat(expenseAmount) : undefined,
      expenseAddress: isExpense && expenseAddress ? expenseAddress : undefined,
      expenseDescription: isExpense && expenseDescription ? expenseDescription : undefined,
      expenseCategory: isExpense && expenseCategory ? expenseCategory : undefined,
    };
    
    onSave(expenseData);
    onClose();
  };

  const handleAddressSelect = (address: string) => {
    setExpenseAddress(address);
    setShowSuggestions(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>File Upload Details</DialogTitle>
          <DialogDescription>
            Add expense information for: {fileName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-expense"
              checked={isExpense}
              onCheckedChange={setIsExpense}
              data-testid="checkbox-is-expense"
            />
            <Label htmlFor="is-expense" className="text-sm font-medium">
              This is an expense document
            </Label>
          </div>

          {isExpense && (
            <div className="space-y-4 pl-6 border-l-2 border-blue-200">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="expense-amount">Amount ($)</Label>
                  <Input
                    id="expense-amount"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    data-testid="input-expense-amount"
                  />
                </div>
                <div>
                  <Label htmlFor="expense-category">Category</Label>
                  <Select value={expenseCategory} onValueChange={setExpenseCategory}>
                    <SelectTrigger data-testid="select-expense-category">
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="materials">Materials</SelectItem>
                      <SelectItem value="equipment">Equipment</SelectItem>
                      <SelectItem value="services">Services</SelectItem>
                      <SelectItem value="transport">Transport</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="relative">
                <Label htmlFor="expense-address">Job Address</Label>
                <div className="relative">
                  <Input
                    id="expense-address"
                    placeholder="Start typing address..."
                    value={expenseAddress}
                    onChange={(e) => setExpenseAddress(e.target.value)}
                    onFocus={() => expenseAddress.length > 1 && setShowSuggestions(true)}
                    data-testid="input-expense-address"
                  />
                  <MapPin className="absolute right-3 top-3 h-4 w-4 text-gray-400" />
                </div>
                
                {showSuggestions && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {addressSuggestions.map((address, index) => (
                      <button
                        key={index}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 text-sm"
                        onClick={() => handleAddressSelect(address)}
                        data-testid={`suggestion-address-${index}`}
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-gray-400" />
                          {address}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <Label htmlFor="expense-description">Description</Label>
                <Textarea
                  id="expense-description"
                  placeholder="Describe the expense..."
                  value={expenseDescription}
                  onChange={(e) => setExpenseDescription(e.target.value)}
                  rows={3}
                  data-testid="textarea-expense-description"
                />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-expense">
            Cancel
          </Button>
          <Button onClick={handleSave} data-testid="button-save-expense">
            Save & Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
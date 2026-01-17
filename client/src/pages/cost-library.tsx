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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit, 
  FolderPlus,
  DollarSign,
  Package,
  ArrowLeft,
  FileUp,
  Sparkles,
  RefreshCw,
  Wand2,
  CheckSquare
} from "lucide-react";
import { Link } from "wouter";
import type { CostCategory, CostLibraryItem, CostSourceDocument } from "@shared/schema";

export default function CostLibraryPage() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Clear selection when filters change
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setSelectedItems(new Set());
  };
  
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value);
    setSelectedItems(new Set());
  };
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showUploadDoc, setShowUploadDoc] = useState(false);
  const [editingItem, setEditingItem] = useState<CostLibraryItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<CostCategory | null>(null);
  const [showBulkUpdate, setShowBulkUpdate] = useState(false);
  const [bulkUpdate, setBulkUpdate] = useState({
    categoryId: "",
    unit: "all",
    action: "set",
    value: "",
  });

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    unit: "each",
    defaultUnitCost: "",
    supplier: "",
    tags: "",
    notes: "",
    categoryId: "",
  });

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    color: "#3b82f6",
    keywords: "",
  });

  const { data: categories = [] } = useQuery<CostCategory[]>({
    queryKey: ["/api/cost-categories"],
  });

  const { data: items = [], isLoading } = useQuery<CostLibraryItem[]>({
    queryKey: ["/api/cost-library", selectedCategory, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory !== "all") params.append("categoryId", selectedCategory);
      if (searchTerm) params.append("search", searchTerm);
      const response = await fetch(`/api/cost-library?${params}`);
      return response.json();
    },
  });

  const { data: documents = [] } = useQuery<CostSourceDocument[]>({
    queryKey: ["/api/cost-documents"],
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof newItem) => {
      const response = await apiRequest("POST", "/api/cost-library", {
        ...data,
        categoryId: data.categoryId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      setShowAddItem(false);
      setNewItem({
        name: "",
        description: "",
        unit: "each",
        defaultUnitCost: "",
        supplier: "",
        tags: "",
        notes: "",
        categoryId: "",
      });
      toast({ title: "Item added to library" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to add item", variant: "destructive" });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async (data: { id: string } & typeof newItem) => {
      const response = await apiRequest("PATCH", `/api/cost-library/${data.id}`, {
        ...data,
        categoryId: data.categoryId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      setEditingItem(null);
      toast({ title: "Item updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update item", variant: "destructive" });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cost-library/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ title: "Item deleted" });
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (data: typeof newCategory) => {
      const response = await apiRequest("POST", "/api/cost-categories", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-categories"] });
      setShowAddCategory(false);
      setNewCategory({ name: "", description: "", color: "#3b82f6", keywords: "" });
      toast({ title: "Category created" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create category", variant: "destructive" });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/cost-categories/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-categories"] });
      toast({ title: "Category deleted" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description?: string; color?: string; keywords?: string }) => {
      const response = await apiRequest("PATCH", `/api/cost-categories/${data.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-categories"] });
      setEditingCategory(null);
      toast({ title: "Category updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update category", variant: "destructive" });
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: typeof bulkUpdate) => {
      const response = await apiRequest("PATCH", "/api/cost-library/bulk-update", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      setShowBulkUpdate(false);
      setBulkUpdate({ categoryId: "", unit: "all", action: "set", value: "" });
      toast({ title: "Bulk update complete", description: `Updated ${result.affectedCount} items` });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update items", variant: "destructive" });
    },
  });

  const autoCategorize = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cost-library/auto-categorize", {});
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ 
        title: "Auto-categorize complete", 
        description: result.affectedCount > 0 
          ? `Matched ${result.affectedCount} of ${result.total} uncategorized items` 
          : "No items could be matched to categories"
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to auto-categorize", variant: "destructive" });
    },
  });

  const recategorizeAll = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/cost-library/recategorize-all", {});
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ 
        title: "Re-categorize complete", 
        description: result.affectedCount > 0 
          ? `Fixed ${result.affectedCount} items (moved to correct trade categories)` 
          : "All items are already correctly categorized"
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to re-categorize", variant: "destructive" });
    },
  });

  const bulkMove = useMutation({
    mutationFn: async (data: { itemIds: string[]; toCategoryId: string }) => {
      const response = await apiRequest("POST", "/api/cost-library/bulk-move", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ 
        title: "Items moved", 
        description: `Moved ${result.affectedCount} items to new category`
      });
      setShowMoveDialog(false);
      setMoveToCategoryId("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to move items", variant: "destructive" });
    },
  });

  const [showMoveDialog, setShowMoveDialog] = useState(false);
  const [moveToCategoryId, setMoveToCategoryId] = useState<string>("");
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [bulkActionType, setBulkActionType] = useState<"update" | "delete" | null>(null);

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setBulkActionType(null);
  };

  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await apiRequest("POST", "/api/cost-library/bulk-delete", { itemIds });
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ title: "Items deleted", description: `Deleted ${result.deletedCount} items` });
      clearSelection();
      setBulkActionType(null);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete items", variant: "destructive" });
    },
  });

  const bulkUpdateSelectedMutation = useMutation({
    mutationFn: async (data: { itemIds: string[]; action: string; value: string }) => {
      const response = await apiRequest("PATCH", "/api/cost-library/bulk-update-selected", data);
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
      toast({ title: "Items updated", description: `Updated ${result.affectedCount} items` });
      clearSelection();
      setBulkActionType(null);
      setBulkUpdate(prev => ({ ...prev, value: "" }));
    },
    onError: (error: any) => {
      console.error("Bulk update error:", error);
      toast({ 
        title: "Error", 
        description: error?.message || "Failed to update items", 
        variant: "destructive" 
      });
    },
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    const cat = categories.find(c => c.id === categoryId);
    return cat?.name || "Unknown";
  };

  const getCategoryColor = (categoryId: string | null) => {
    if (!categoryId) return "#6b7280";
    const cat = categories.find(c => c.id === categoryId);
    return cat?.color || "#3b82f6";
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link href="/quotes">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Quotes
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Package className="h-6 w-6" />
                Cost Library
              </h1>
              <p className="text-gray-500 text-sm">Save and reuse costs for faster quoting</p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              onClick={() => autoCategorize.mutate()}
              disabled={autoCategorize.isPending}
            >
              <Wand2 className="h-4 w-4 mr-2" />
              {autoCategorize.isPending ? "Matching..." : "Auto-Categorize"}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={recategorizeAll.isPending}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  {recategorizeAll.isPending ? "Fixing..." : "Fix Categories"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Fix Miscategorized Items?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will re-check all items and move them to the correct trade category. 
                    For example, plumber items will be moved from Carpentry to Plumbing.
                    Items that are already correctly categorized will not change.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => recategorizeAll.mutate()}>
                    Fix Categories
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button variant="outline" onClick={() => {
              // Pre-fill with currently selected category
              if (selectedCategory !== "all") {
                setBulkUpdate(prev => ({ ...prev, categoryId: selectedCategory }));
              }
              setShowBulkUpdate(true);
            }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Bulk Update
            </Button>
            <Button variant="outline" onClick={() => setShowUploadDoc(true)}>
              <FileUp className="h-4 w-4 mr-2" />
              Upload Document
            </Button>
            <Button variant="outline" onClick={() => setShowAddCategory(true)}>
              <FolderPlus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
            <Button onClick={() => setShowAddItem(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button
                  variant={selectedCategory === "all" ? "secondary" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => handleCategoryChange("all")}
                >
                  All Items
                  <Badge variant="outline" className="ml-auto">{items.length}</Badge>
                </Button>
                {categories.map((cat) => (
                  <div key={cat.id} className="flex items-center gap-1">
                    <Button
                      variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                      className="flex-1 justify-start"
                      onClick={() => handleCategoryChange(cat.id)}
                    >
                      <div 
                        className="w-3 h-3 rounded-full mr-2" 
                        style={{ backgroundColor: cat.color || "#3b82f6" }}
                      />
                      {cat.name}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-gray-400 hover:text-blue-600"
                      onClick={() => setEditingCategory(cat)}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Category?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will move all items in this category to "Uncategorized".
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteCategoryMutation.mutate(cat.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </CardContent>
            </Card>

            {documents.length > 0 && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Source Documents</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {documents.slice(0, 5).map((doc) => (
                    <div key={doc.id} className="text-xs p-2 bg-gray-50 rounded">
                      <p className="font-medium truncate">{doc.fileName}</p>
                      <p className="text-gray-500">
                        {doc.extractedItemsCount} items extracted
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="lg:col-span-3">
            <div className="mb-4 flex gap-2 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search items..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              {(searchTerm || selectedCategory !== "all") && items.length > 0 && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowMoveDialog(true)}
                >
                  Move {items.length} items
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-12 text-gray-500">Loading...</div>
            ) : items.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No items yet</h3>
                  <p className="text-gray-500 mb-4">
                    Add items to your cost library to reuse them in future quotes
                  </p>
                  <Button onClick={() => setShowAddItem(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Item
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {/* Bulk Action Bar */}
                {selectedItems.size > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                      <CheckSquare className="h-5 w-5 text-blue-600" />
                      <span className="font-medium text-blue-900">{selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected</span>
                      <Button variant="ghost" size="sm" onClick={clearSelection}>
                        Clear
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setBulkActionType("update")}
                      >
                        <DollarSign className="h-4 w-4 mr-1" />
                        Update Rates
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete Selected
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete {selectedItems.size} items?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the selected items from your cost library. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedItems))}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Delete {selectedItems.size} Items
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
                
                {/* Select All Row */}
                <div className="flex items-center gap-2 px-2 text-sm text-gray-600">
                  <Checkbox 
                    checked={items.length > 0 && selectedItems.size === items.length}
                    onCheckedChange={toggleSelectAll}
                  />
                  <span>Select all ({items.length} items)</span>
                </div>

                <div className="grid gap-3">
                {items.map((item) => (
                  <Card key={item.id} className={`hover:shadow-md transition-shadow ${selectedItems.has(item.id) ? 'ring-2 ring-blue-400 bg-blue-50/50' : ''}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <Checkbox 
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium">{item.name}</h3>
                            <Badge 
                              variant="outline" 
                              style={{ 
                                borderColor: getCategoryColor(item.categoryId),
                                color: getCategoryColor(item.categoryId)
                              }}
                            >
                              {getCategoryName(item.categoryId)}
                            </Badge>
                            {(item.usageCount ?? 0) > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                Used {item.usageCount}x
                              </Badge>
                            )}
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-500 mb-2">{item.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="font-semibold text-green-600">
                                ${parseFloat(item.defaultUnitCost).toFixed(2)}
                              </span>
                              <span className="text-gray-500">/ {item.unit}</span>
                            </span>
                            {item.supplier && (
                              <span className="text-gray-500">
                                Supplier: {item.supplier}
                              </span>
                            )}
                          </div>
                          {item.tags && (
                            <div className="flex gap-1 mt-2">
                              {item.tags.split(",").map((tag, i) => (
                                <Badge key={i} variant="outline" className="text-xs">
                                  {tag.trim()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingItem(item);
                              setNewItem({
                                name: item.name,
                                description: item.description || "",
                                unit: item.unit || "each",
                                defaultUnitCost: item.defaultUnitCost,
                                supplier: item.supplier || "",
                                tags: item.tags || "",
                                notes: item.notes || "",
                                categoryId: item.categoryId || "",
                              });
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-red-600">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Item?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will permanently remove "{item.name}" from your library.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteItemMutation.mutate(item.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      <Dialog open={showAddItem || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setShowAddItem(false);
          setEditingItem(null);
          setNewItem({
            name: "",
            description: "",
            unit: "each",
            defaultUnitCost: "",
            supplier: "",
            tags: "",
            notes: "",
            categoryId: "",
          });
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Cost Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the item details" : "Add a new item to your cost library"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g., Standard Door Frame"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                placeholder="Additional details..."
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Unit Cost *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newItem.defaultUnitCost}
                  onChange={(e) => setNewItem({ ...newItem, defaultUnitCost: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  value={newItem.unit}
                  onValueChange={(value) => setNewItem({ ...newItem, unit: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="each">Each</SelectItem>
                    <SelectItem value="m2">m²</SelectItem>
                    <SelectItem value="lm">Linear m</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="kg">kg</SelectItem>
                    <SelectItem value="tonne">Tonne</SelectItem>
                    <SelectItem value="lot">Lot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Category</Label>
              <Select
                value={newItem.categoryId || "none"}
                onValueChange={(value) => setNewItem({ ...newItem, categoryId: value === "none" ? "" : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Uncategorized</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Supplier</Label>
              <Input
                value={newItem.supplier}
                onChange={(e) => setNewItem({ ...newItem, supplier: e.target.value })}
                placeholder="e.g., Bunnings"
              />
            </div>
            <div>
              <Label>Tags (comma separated)</Label>
              <Input
                value={newItem.tags}
                onChange={(e) => setNewItem({ ...newItem, tags: e.target.value })}
                placeholder="e.g., timber, framing, structural"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (editingItem) {
                  updateItemMutation.mutate({ id: editingItem.id, ...newItem });
                } else {
                  createItemMutation.mutate(newItem);
                }
              }}
              disabled={!newItem.name || !newItem.defaultUnitCost || createItemMutation.isPending || updateItemMutation.isPending}
            >
              {createItemMutation.isPending || updateItemMutation.isPending 
                ? "Saving..." 
                : editingItem ? "Update Item" : "Add Item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddCategory} onOpenChange={setShowAddCategory}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>Create a new category to organize your cost items</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Category Name *</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Framing, Electrical, Plumbing"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                placeholder="Optional description"
              />
            </div>
            <div>
              <Label>Keywords (comma separated)</Label>
              <Input
                value={newCategory.keywords}
                onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                placeholder="e.g., carpenter, joinery, woodwork"
              />
              <p className="text-xs text-gray-500 mt-1">
                Items with matching keywords will be auto-assigned to this category
              </p>
            </div>
            <div>
              <Label>Color</Label>
              <div className="flex gap-2">
                {["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"].map((color) => (
                  <button
                    key={color}
                    className={`w-8 h-8 rounded-full border-2 ${newCategory.color === color ? "border-gray-900" : "border-transparent"}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewCategory({ ...newCategory, color })}
                  />
                ))}
              </div>
            </div>
            <Button
              className="w-full"
              onClick={() => createCategoryMutation.mutate(newCategory)}
              disabled={!newCategory.name || createCategoryMutation.isPending}
            >
              {createCategoryMutation.isPending ? "Creating..." : "Create Category"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDoc} onOpenChange={setShowUploadDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Upload Document for AI Extraction
            </DialogTitle>
            <DialogDescription>
              Upload a quote, invoice, or scope document. AI will extract costs automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <FileUp className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-2">
                Drag and drop a PDF, JPG, or PNG file here
              </p>
              <p className="text-xs text-gray-400">
                Supported: PDF, JPEG, PNG (max 10MB)
              </p>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="hidden"
                id="doc-upload"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const reader = new FileReader();
                  reader.onload = async () => {
                    const base64 = (reader.result as string).split(",")[1];
                    try {
                      const response = await apiRequest("POST", "/api/cost-documents/upload", {
                        fileName: file.name,
                        fileType: file.type,
                        fileSize: file.size,
                        fileContent: base64,
                      });
                      const result = await response.json();
                      queryClient.invalidateQueries({ queryKey: ["/api/cost-library"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/cost-documents"] });
                      setShowUploadDoc(false);
                      toast({ 
                        title: "Document processed", 
                        description: `Extracted ${result.extractedCount} items`
                      });
                    } catch (error) {
                      toast({ 
                        title: "Error", 
                        description: "Failed to process document", 
                        variant: "destructive" 
                      });
                    }
                  };
                  reader.readAsDataURL(file);
                }}
              />
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => document.getElementById("doc-upload")?.click()}
              >
                Select File
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showBulkUpdate} onOpenChange={setShowBulkUpdate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Update Rates</DialogTitle>
            <DialogDescription>
              Update all items in a category at once
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Category *</Label>
              <Select 
                value={bulkUpdate.categoryId} 
                onValueChange={(v) => setBulkUpdate({...bulkUpdate, categoryId: v})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Unit Filter</Label>
              <Select 
                value={bulkUpdate.unit} 
                onValueChange={(v) => setBulkUpdate({...bulkUpdate, unit: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Units</SelectItem>
                  <SelectItem value="hour">Per Hour</SelectItem>
                  <SelectItem value="day">Per Day</SelectItem>
                  <SelectItem value="each">Each</SelectItem>
                  <SelectItem value="m2">Per m²</SelectItem>
                  <SelectItem value="m">Per Metre</SelectItem>
                  <SelectItem value="lm">Per LM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Action</Label>
              <Select 
                value={bulkUpdate.action} 
                onValueChange={(v) => setBulkUpdate({...bulkUpdate, action: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set Fixed Rate</SelectItem>
                  <SelectItem value="percentage">Percentage Change</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>
                {bulkUpdate.action === "set" ? "New Rate ($)" : "Percentage (+ or -)"}
              </Label>
              <Input
                type="number"
                step={bulkUpdate.action === "set" ? "0.01" : "1"}
                placeholder={bulkUpdate.action === "set" ? "e.g. 85.00" : "e.g. 10 or -5"}
                value={bulkUpdate.value}
                onChange={(e) => setBulkUpdate({...bulkUpdate, value: e.target.value})}
              />
              {bulkUpdate.action === "percentage" && bulkUpdate.value && (
                <p className="text-xs text-gray-500">
                  {parseFloat(bulkUpdate.value) > 0 ? `+${bulkUpdate.value}%` : `${bulkUpdate.value}%`} change
                </p>
              )}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => setShowBulkUpdate(false)}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                disabled={!bulkUpdate.categoryId || !bulkUpdate.value || bulkUpdateMutation.isPending}
                onClick={() => bulkUpdateMutation.mutate(bulkUpdate)}
              >
                {bulkUpdateMutation.isPending ? "Updating..." : "Update All"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                  placeholder="e.g. Carpentry Labour"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  value={editingCategory.description || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                  placeholder="Describe this category..."
                />
              </div>
              
              <div className="space-y-2">
                <Label>Color</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={editingCategory.color || "#3b82f6"}
                    onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                    className="w-16 h-10 p-1"
                  />
                  <Input
                    value={editingCategory.color || "#3b82f6"}
                    onChange={(e) => setEditingCategory({ ...editingCategory, color: e.target.value })}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Keywords (comma-separated)</Label>
                <Input
                  value={editingCategory.keywords || ""}
                  onChange={(e) => setEditingCategory({ ...editingCategory, keywords: e.target.value })}
                  placeholder="e.g. timber, framing, joinery"
                />
                <p className="text-xs text-gray-500">
                  Keywords help auto-categorize new items
                </p>
              </div>
              
              <div className="flex gap-2 pt-4">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setEditingCategory(null)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1"
                  disabled={!editingCategory.name || updateCategoryMutation.isPending}
                  onClick={() => updateCategoryMutation.mutate({
                    id: editingCategory.id,
                    name: editingCategory.name,
                    description: editingCategory.description || undefined,
                    color: editingCategory.color || undefined,
                    keywords: editingCategory.keywords || undefined,
                  })}
                >
                  {updateCategoryMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Move Items Dialog */}
      <Dialog open={showMoveDialog} onOpenChange={setShowMoveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move Items to Category</DialogTitle>
            <DialogDescription>
              Move {items.length} filtered item{items.length !== 1 ? 's' : ''} to a different category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Move to Category</Label>
              <Select value={moveToCategoryId} onValueChange={setMoveToCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: cat.color || "#3b82f6" }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setShowMoveDialog(false);
                  setMoveToCategoryId("");
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                disabled={!moveToCategoryId || bulkMove.isPending}
                onClick={() => bulkMove.mutate({
                  itemIds: items.map(item => item.id),
                  toCategoryId: moveToCategoryId,
                })}
              >
                {bulkMove.isPending ? "Moving..." : `Move ${items.length} Items`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Update Selected Dialog */}
      <Dialog open={bulkActionType === "update"} onOpenChange={(open) => !open && setBulkActionType(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update {selectedItems.size} Selected Items</DialogTitle>
            <DialogDescription>
              Apply a rate change to the selected items only
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Action</Label>
              <Select 
                value={bulkUpdate.action} 
                onValueChange={(v) => setBulkUpdate({...bulkUpdate, action: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="set">Set Fixed Rate</SelectItem>
                  <SelectItem value="percentage">Percentage Change</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>
                {bulkUpdate.action === "set" ? "New Rate ($)" : "Percentage (+ or -)"}
              </Label>
              <Input
                type="number"
                step={bulkUpdate.action === "set" ? "0.01" : "1"}
                placeholder={bulkUpdate.action === "set" ? "e.g. 85.00" : "e.g. 10 or -5"}
                value={bulkUpdate.value}
                onChange={(e) => setBulkUpdate({...bulkUpdate, value: e.target.value})}
              />
              {bulkUpdate.action === "percentage" && bulkUpdate.value && (
                <p className="text-xs text-gray-500">
                  {parseFloat(bulkUpdate.value) > 0 ? `+${bulkUpdate.value}%` : `${bulkUpdate.value}%`} change to all selected items
                </p>
              )}
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setBulkActionType(null);
                  setBulkUpdate(prev => ({ ...prev, value: "" }));
                }}
              >
                Cancel
              </Button>
              <Button 
                className="flex-1"
                disabled={!bulkUpdate.value || bulkUpdateSelectedMutation.isPending}
                onClick={() => bulkUpdateSelectedMutation.mutate({
                  itemIds: Array.from(selectedItems),
                  action: bulkUpdate.action,
                  value: bulkUpdate.value,
                })}
              >
                {bulkUpdateSelectedMutation.isPending ? "Updating..." : `Update ${selectedItems.size} Items`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

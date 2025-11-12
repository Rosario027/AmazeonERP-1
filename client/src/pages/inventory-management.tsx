import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Product {
  id: number;
  name: string;
  hsnCode: string;
  category: string | null;
  rate: string;
  gstPercentage: string;
  quantity: number;
  comments: string | null;
}

export default function InventoryManagement() {
  const { toast } = useToast();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    hsnCode: "",
    category: "",
    rate: "",
    gstPercentage: "18",
    quantity: "0",
    comments: "",
  });

  const { data: products = [], isLoading: loading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return await apiRequest("POST", "/api/products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product added successfully",
      });
      setIsAddDialogOpen(false);
      setFormData({ name: "", hsnCode: "", category: "", rate: "", gstPercentage: "18", quantity: "0", comments: "" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to add product",
      });
    },
  });

  const handleAdd = async () => {
    if (!formData.name || !formData.hsnCode || !formData.rate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    const dataToSend = {
      ...formData,
      quantity: parseInt(formData.quantity) || 0,
    };

    addMutation.mutate(dataToSend);
  };

  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      return await apiRequest("PATCH", `/api/products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product updated successfully",
      });
      setIsEditDialogOpen(false);
      setEditingProduct(null);
      setFormData({ name: "", hsnCode: "", category: "", rate: "", gstPercentage: "18", quantity: "0", comments: "" });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update product",
      });
    },
  });

  const handleEdit = async () => {
    if (!editingProduct || !formData.name || !formData.hsnCode || !formData.rate) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    const dataToSend = {
      ...formData,
      quantity: parseInt(formData.quantity) || 0,
    };

    editMutation.mutate({ id: editingProduct.id, data: dataToSend });
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete product",
      });
    },
  });

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    deleteMutation.mutate(id);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      hsnCode: product.hsnCode,
      category: product.category || "",
      rate: product.rate,
      gstPercentage: product.gstPercentage,
      quantity: String(product.quantity || 0),
      comments: product.comments || "",
    });
    setIsEditDialogOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold mb-2">Inventory Management</h1>
          <p className="text-muted-foreground">Manage products and pricing</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Product</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Product Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter product name"
                  data-testid="input-product-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hsnCode">HSN Code <span className="text-destructive">*</span></Label>
                <Input
                  id="hsnCode"
                  value={formData.hsnCode}
                  onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                  placeholder="Enter HSN code (e.g. 8471)"
                  data-testid="input-hsn-code"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="Enter category (optional)"
                  data-testid="input-product-category"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="rate">Rate (₹) <span className="text-destructive">*</span></Label>
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={formData.rate}
                    onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                    placeholder="0.00"
                    data-testid="input-product-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gst">GST % <span className="text-destructive">*</span></Label>
                  <Input
                    id="gst"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.gstPercentage}
                    onChange={(e) => setFormData({ ...formData, gstPercentage: e.target.value })}
                    placeholder="Enter GST %"
                    data-testid="input-gst-percentage"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Stock Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  data-testid="input-product-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="comments">Comments / Notes</Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                  placeholder="Enter internal notes, lot numbers, etc. (optional)"
                  rows={3}
                  data-testid="input-product-comments"
                />
              </div>
              <Button className="w-full" onClick={handleAdd} data-testid="button-submit-product">
                Add Product
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-medium">Products</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading products...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No products found. Add your first product to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold">Product Name</TableHead>
                    <TableHead className="font-semibold">HSN Code</TableHead>
                    <TableHead className="font-semibold">Category</TableHead>
                    <TableHead className="font-semibold text-right">Rate (₹)</TableHead>
                    <TableHead className="font-semibold text-center">GST %</TableHead>
                    <TableHead className="font-semibold text-center">Quantity</TableHead>
                    <TableHead className="font-semibold">Comments</TableHead>
                    <TableHead className="font-semibold text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id} className="hover-elevate" data-testid={`row-product-${product.id}`}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{product.hsnCode}</Badge>
                      </TableCell>
                      <TableCell>
                        {product.category ? (
                          <Badge variant="secondary">{product.category}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold">₹{parseFloat(product.rate).toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline">{product.gstPercentage}%</Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold">
                        {product.quantity || 0}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {product.comments || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(product)}
                            data-testid={`button-edit-product-${product.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(product.id)}
                            data-testid={`button-delete-product-${product.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Product</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Product Name <span className="text-destructive">*</span></Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter product name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-hsnCode">HSN Code <span className="text-destructive">*</span></Label>
              <Input
                id="edit-hsnCode"
                value={formData.hsnCode}
                onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                placeholder="Enter HSN code (e.g. 8471)"
                data-testid="input-edit-hsn-code"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-category">Category</Label>
              <Input
                id="edit-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Enter category (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-rate">Rate (₹) <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-rate"
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-gst">GST % <span className="text-destructive">*</span></Label>
                <Input
                  id="edit-gst"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.gstPercentage}
                  onChange={(e) => setFormData({ ...formData, gstPercentage: e.target.value })}
                  placeholder="Enter GST %"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-quantity">Stock Quantity</Label>
              <Input
                id="edit-quantity"
                type="number"
                min="0"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                placeholder="0"
                data-testid="input-edit-product-quantity"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-comments">Comments / Notes</Label>
              <Textarea
                id="edit-comments"
                value={formData.comments}
                onChange={(e) => setFormData({ ...formData, comments: e.target.value })}
                placeholder="Enter internal notes, lot numbers, etc. (optional)"
                rows={3}
                data-testid="input-edit-product-comments"
              />
            </div>
            <Button className="w-full" onClick={handleEdit}>
              Update Product
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

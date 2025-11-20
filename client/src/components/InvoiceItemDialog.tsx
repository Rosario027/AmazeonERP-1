import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";

interface Product {
  id: number;
  name: string;
  rate: string;
  gstPercentage: string;
}

interface InvoiceItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: Product[];
  onAddItem: (item: {
    productName: string;
    quantity: number;
    rate: string;
    gstPercentage: string;
    productDescription?: string;
  }) => void;
}

export function InvoiceItemDialog({
  open,
  onOpenChange,
  products,
  onAddItem,
}: InvoiceItemDialogProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [rate, setRate] = useState<string>("");
  const [gstPercentage, setGstPercentage] = useState<string>("18");
  const [productDescription, setProductDescription] = useState<string>("");

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);
    const product = products.find((p) => p.id.toString() === productId);
    if (product) {
      setRate(product.rate);
      setGstPercentage(product.gstPercentage);
    }
  };

  const handleSubmit = () => {
    const product = products.find((p) => p.id.toString() === selectedProductId);
    if (!product || !rate || quantity < 1) {
      return;
    }

    onAddItem({
      productName: product.name,
      quantity,
      rate,
      gstPercentage,
      productDescription,
    });

    setSelectedProductId("");
    setQuantity(1);
    setRate("");
    setGstPercentage("18");
    setProductDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-add-item">
        <DialogHeader>
          <DialogTitle>Add Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="product" className="text-sm font-medium">
              Product <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedProductId} onValueChange={handleProductChange}>
              <SelectTrigger className="h-12" data-testid="select-dialog-product">
                <SelectValue placeholder="Select product" />
              </SelectTrigger>
              <SelectContent>
                {products.map((product) => (
                  <SelectItem key={product.id} value={product.id.toString()}>
                    {product.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity" className="text-sm font-medium">
              Quantity <span className="text-destructive">*</span>
            </Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              className="h-12"
              data-testid="input-dialog-quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rate" className="text-sm font-medium">
              Rate (₹) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="rate"
              type="number"
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
              className="h-12"
              data-testid="input-dialog-rate"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="gst" className="text-sm font-medium">
              GST (%)
            </Label>
            <Input
              id="gst"
              type="number"
              value={gstPercentage}
              onChange={(e) => setGstPercentage(e.target.value)}
              className="h-12"
              data-testid="input-dialog-gst"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="productDescription" className="text-sm font-medium">
              Product Description
            </Label>
            <Input
              id="productDescription"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Optional product description"
              className="h-12"
              data-testid="input-dialog-product-description"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!selectedProductId || !rate || quantity < 1}
            className="w-full"
            data-testid="button-dialog-add-item"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

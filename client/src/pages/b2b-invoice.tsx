import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { InvoiceItemDialog } from "@/components/InvoiceItemDialog";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import { useLocation, useSearch } from "wouter";
import { calculateInvoiceItem, type GstMode } from "@shared/gstCalculations";

interface InvoiceItem {
  productId: number | null;
  itemName: string;
  hsnCode: string;
  rate: string;
  quantity: number;
  gstPercentage: number;
  gstAmount: number;
  taxableValue: number;
  cgstPercentage: number;
  cgstAmount: number;
  sgstPercentage: number;
  sgstAmount: number;
  total: number;
  originalRate: number;
  originalMode: "Cash" | "Online";
}

export default function B2BInvoice() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const newTimestamp = urlParams.get('new');
  
  const [customerName, setCustomerName] = useState("");
  const [customerGst, setCustomerGst] = useState("");
  const [customerRequirements, setCustomerRequirements] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online">("Online");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const lastResetTimestamp = useRef<string | null>(null);

  // Reset form to blank state when navigating back from print with ?new= parameter
  useEffect(() => {
    if (newTimestamp && newTimestamp !== lastResetTimestamp.current) {
      lastResetTimestamp.current = newTimestamp;
      setCustomerName("");
      setCustomerGst("");
      setCustomerRequirements("");
      setPaymentMode("Online");
      setItems([]);
      setDialogOpen(false);
    }
  }, [newTimestamp]);

  const { data: invoiceNumberData } = useQuery<{ invoiceNumber: string }>({
    queryKey: ["/api/invoices/next-number"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: settings = [] } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  const cashGstMode: GstMode = (settings.find(s => s.key === "cash_gst_mode")?.value as GstMode) || "inclusive";
  const onlineGstMode: GstMode = (settings.find(s => s.key === "online_gst_mode")?.value as GstMode) || "exclusive";

  const invoiceNumber = invoiceNumberData?.invoiceNumber || "";

  const handleAddItem = (item: {
    productName: string;
    quantity: number;
    rate: string;
    gstPercentage: string;
  }) => {
    const product = products.find((p) => p.name === item.productName);
    const rate = parseFloat(item.rate);
    const quantity = item.quantity;
    const gstPercentage = parseFloat(item.gstPercentage);
    
    const gstMode = paymentMode === "Cash" ? cashGstMode : onlineGstMode;
    const calculated = calculateInvoiceItem(rate, quantity, gstPercentage, gstMode);
    
    const cgstPercentage = gstPercentage / 2;
    const sgstPercentage = gstPercentage / 2;
    
    const newItem: InvoiceItem = {
      productId: product?.id || null,
      itemName: item.productName,
      hsnCode: product?.hsnCode || "",
      rate: item.rate,
      quantity: quantity,
      gstPercentage: gstPercentage,
      gstAmount: calculated.gstAmount,
      taxableValue: calculated.taxableValue,
      cgstPercentage: cgstPercentage,
      cgstAmount: calculated.cgstAmount,
      sgstPercentage: sgstPercentage,
      sgstAmount: calculated.sgstAmount,
      total: calculated.total,
      originalRate: rate,
      originalMode: paymentMode,
    };
    setItems((prev) => [newItem, ...prev]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const { subtotal, totalCgst, totalSgst, totalGst, grandTotal } = useMemo(() => {
    let subtotal = 0;
    let totalCgst = 0;
    let totalSgst = 0;

    items.forEach((item) => {
      subtotal += item.taxableValue;
      totalCgst += item.cgstAmount;
      totalSgst += item.sgstAmount;
    });

    const totalGst = totalCgst + totalSgst;
    const grandTotal = subtotal + totalGst;

    return { subtotal, totalCgst, totalSgst, totalGst, grandTotal };
  }, [items]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("POST", "/api/invoices", data);
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const invoiceId = data.id;
      toast({
        title: "Success",
        description: "B2B Invoice saved successfully. Click to print receipt.",
        action: (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => setLocation(`/print-invoice/${invoiceId}`)}
            data-testid="button-print-invoice"
          >
            Print
          </Button>
        ),
      });
      setCustomerName("");
      setCustomerGst("");
      setCustomerRequirements("");
      setItems([]);
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save invoice",
      });
    },
  });

  // Note: Recalculation effect removed to prevent incorrect totals when GST settings change
  // Items are calculated once when added, using the GST mode active at that time
  // Payment mode is locked once items are added, so no recalculation is needed

  const handleSave = async () => {
    if (!customerName || !customerGst || items.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields including GST Number and add at least one item",
      });
      return;
    }

    // Determine gstMode based on current payment mode setting
    const gstMode = paymentMode === "Cash" ? cashGstMode : onlineGstMode;

    saveMutation.mutate({
      invoiceType: "B2B",
      customerName,
      customerGst,
      customerRequirements,
      paymentMode,
      gstMode,
      items: items.map((item) => ({
        productId: item.productId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        rate: item.rate,
        quantity: item.quantity,
        gstPercentage: (item.cgstPercentage + item.sgstPercentage).toFixed(2),
        gstAmount: (item.cgstAmount + item.sgstAmount).toFixed(2),
        taxableValue: item.taxableValue.toFixed(2),
        cgstPercentage: item.cgstPercentage.toFixed(2),
        cgstAmount: item.cgstAmount.toFixed(2),
        sgstPercentage: item.sgstPercentage.toFixed(2),
        sgstAmount: item.sgstAmount.toFixed(2),
        total: item.total.toFixed(2),
      })),
    });
  };

  return (
    <>
      <style>
        {`
          @media print {
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      
      <div className="p-8 max-w-7xl mx-auto no-print">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold mb-2">B2B Invoice Generation</h1>
          <p className="text-muted-foreground">Create business-to-business invoices with GST details</p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">Invoice Details</CardTitle>
                <Badge variant="secondary" className="text-base font-semibold" data-testid="text-b2b-invoice-number">
                  {invoiceNumber}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="customerName" className="text-sm font-medium">
                    Business Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customerName"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter business name"
                    className="h-12"
                    data-testid="input-business-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customerGst" className="text-sm font-medium">
                    GST Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="customerGst"
                    value={customerGst}
                    onChange={(e) => setCustomerGst(e.target.value)}
                    placeholder="Enter GST number (e.g., 29ABCDE1234F1Z5)"
                    className="h-12"
                    data-testid="input-gst-number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMode" className="text-sm font-medium">
                  Payment Mode <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentMode} onValueChange={(value: "Cash" | "Online") => setPaymentMode(value)} disabled={items.length > 0}>
                  <SelectTrigger className="h-12" data-testid="select-b2b-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {items.length > 0
                    ? "Payment mode cannot be changed after adding items"
                    : (paymentMode === "Cash" ? `Cash: GST ${cashGstMode === 'inclusive' ? 'included in' : 'added to'} rate` : `Online: GST ${onlineGstMode === 'inclusive' ? 'included in' : 'added to'} rate`)
                  }
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Items</Label>
                  <Button type="button" size="sm" onClick={() => setDialogOpen(true)} data-testid="button-add-b2b-item">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Item
                  </Button>
                </div>

                {items.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">Item Name</th>
                          <th className="text-left py-2">HSN</th>
                          <th className="text-right py-2">Qty</th>
                          <th className="text-right py-2">Rate</th>
                          <th className="text-right py-2">Taxable Value</th>
                          <th className="text-right py-2">CGST%</th>
                          <th className="text-right py-2">CGST Amt</th>
                          <th className="text-right py-2">SGST%</th>
                          <th className="text-right py-2">SGST Amt</th>
                          <th className="text-right py-2">Total</th>
                          <th className="text-right py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="border-b hover-elevate">
                            <td className="py-2 font-medium">{item.itemName}</td>
                            <td className="py-2"><Badge variant="outline" className="text-xs">{item.hsnCode}</Badge></td>
                            <td className="text-right py-2">{item.quantity}</td>
                            <td className="text-right py-2">₹{parseFloat(item.rate).toFixed(2)}</td>
                            <td className="text-right py-2 font-semibold">₹{item.taxableValue.toFixed(2)}</td>
                            <td className="text-right py-2">{item.cgstPercentage.toFixed(2)}%</td>
                            <td className="text-right py-2">₹{item.cgstAmount.toFixed(2)}</td>
                            <td className="text-right py-2">{item.sgstPercentage.toFixed(2)}%</td>
                            <td className="text-right py-2">₹{item.sgstAmount.toFixed(2)}</td>
                            <td className="text-right py-2 font-bold">₹{item.total.toFixed(2)}</td>
                            <td className="text-right py-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeItem(index)}
                                data-testid={`button-remove-item-${index}`}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {items.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    No items added yet. Click "Add Item" to start.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg font-medium">Customer Requirements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="customerRequirements" className="text-sm font-medium">
                  Message or Product Request
                </Label>
                <Textarea
                  id="customerRequirements"
                  value={customerRequirements}
                  onChange={(e) => setCustomerRequirements(e.target.value)}
                  placeholder="Enter any special requests or requirements..."
                  className="min-h-[100px] resize-none"
                  data-testid="textarea-customer-requirements"
                />
                <p className="text-xs text-muted-foreground">
                  These notes will be saved with the invoice and visible in the customer directory.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-medium">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span>Taxable Value:</span>
                  <span className="font-medium">₹{subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>CGST:</span>
                  <span className="font-medium">₹{totalCgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>SGST:</span>
                  <span className="font-medium">₹{totalSgst.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total GST:</span>
                  <span className="font-medium">₹{totalGst.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Grand Total:</span>
                    <span className="text-2xl font-bold text-primary">
                      ₹{grandTotal.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <Button
                  className="w-full h-12"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-b2b-invoice"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Bill"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

        <InvoiceItemDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          products={products}
          onAddItem={handleAddItem}
        />
      </div>

      <InvoiceReceipt
        invoiceNumber={invoiceNumber}
        customerName={customerName}
        items={items}
        subtotal={subtotal}
        grandTotal={grandTotal}
      />
    </>
  );
}

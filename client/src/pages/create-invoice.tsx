import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Printer, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { InvoiceItemDialog } from "@/components/InvoiceItemDialog";
import { InvoiceReceipt } from "@/components/InvoiceReceipt";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocation, useRoute, useSearch } from "wouter";
import { calculateInvoiceItem, type GstMode } from "@shared/gstCalculations";

interface InvoiceItem {
  productId: number | null;
  itemName: string;
  hsnCode: string;
  description?: string;
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
  originalMode: "Cash" | "Online" | "Cash+Card";
}

export default function CreateInvoice() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const urlParams = new URLSearchParams(searchString);
  const editInvoiceId = urlParams.get('edit');
  const newTimestamp = urlParams.get('new');
  const isEditing = !!editInvoiceId;

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Online" | "Cash+Card">("Cash");
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [invoiceNumberForEdit, setInvoiceNumberForEdit] = useState("");
  const [storedGstMode, setStoredGstMode] = useState<GstMode | null>(null);
  const lastResetTimestamp = useRef<string | null>(null);
  const printAfterSaveRef = useRef(false);
  const printWindowRef = useRef<Window | null>(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [cashAmount, setCashAmount] = useState(0);
  const [cardAmount, setCardAmount] = useState(0);

  // Reset form to blank state when navigating back from print with ?new= parameter
  useEffect(() => {
    if (newTimestamp && !isEditing && newTimestamp !== lastResetTimestamp.current) {
      lastResetTimestamp.current = newTimestamp;
      setCustomerName("");
      setPaymentMode("Cash");
      setItems([]);
      setDialogOpen(false);
      setInvoiceNumberForEdit("");
      setStoredGstMode(null);
    }
  }, [newTimestamp, isEditing]);

  const { data: existingInvoice } = useQuery<any>({
    queryKey: [`/api/invoices/${editInvoiceId || 'new'}`],
    enabled: isEditing && !!editInvoiceId,
  });

  useEffect(() => {
    if (existingInvoice && isEditing) {
      setCustomerName(existingInvoice.customerName || "");
      setCustomerPhone(existingInvoice.customerPhone || "");
      setPaymentMode(existingInvoice.paymentMode || "Cash");
      setInvoiceNumberForEdit(existingInvoice.invoiceNumber || "");
      setStoredGstMode(existingInvoice.gstMode || "inclusive");
      
      // Load payment split amounts if Cash+Card
      if (existingInvoice.paymentMode === "Cash+Card") {
        setCashAmount(parseFloat(existingInvoice.cashAmount) || 0);
        setCardAmount(parseFloat(existingInvoice.cardAmount) || 0);
      }
      
      if (existingInvoice.items && existingInvoice.items.length > 0) {
        const formattedItems = existingInvoice.items.map((item: any) => ({
          productId: item.productId,
          itemName: item.itemName,
          description: item.description || "",
          hsnCode: item.hsnCode,
          rate: item.rate,
          quantity: item.quantity,
          taxableValue: parseFloat(item.taxableValue),
          cgstPercentage: parseFloat(item.cgstPercentage),
          cgstAmount: parseFloat(item.cgstAmount),
          sgstPercentage: parseFloat(item.sgstPercentage),
          sgstAmount: parseFloat(item.sgstAmount),
          total: parseFloat(item.total),
          gstPercentage: parseFloat(item.cgstPercentage) + parseFloat(item.sgstPercentage),
          gstAmount: parseFloat(item.cgstAmount) + parseFloat(item.sgstAmount),
          originalRate: parseFloat(item.rate),
          originalMode: existingInvoice.paymentMode,
        }));
        setItems(formattedItems);
      }
    }
  }, [existingInvoice, isEditing]);

  const { data: invoiceNumberData } = useQuery<{ invoiceNumber: string }>({
    queryKey: ["/api/invoices/next-number"],
    enabled: !isEditing,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<any[]>({
    queryKey: ["/api/products"],
  });

  const { data: settings = [] } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["/api/settings"],
  });

  const cashGstMode: GstMode = (settings.find(s => s.key === "cash_gst_mode")?.value as GstMode) || "inclusive";
  const onlineGstMode: GstMode = (settings.find(s => s.key === "online_gst_mode")?.value as GstMode) || "exclusive";

  const invoiceNumber = isEditing ? invoiceNumberForEdit : (invoiceNumberData?.invoiceNumber || "");

  const handleAddItem = (item: {
    productName: string;
    productDescription?: string;
    quantity: number;
    rate: string;
    gstPercentage: string;
  }) => {
    const product = products.find((p) => p.name === item.productName);
    const rate = parseFloat(item.rate);
    const quantity = item.quantity;
    const gstPercentage = parseFloat(item.gstPercentage);
    
    // Use stored gstMode when editing, current settings when creating
    const gstMode = isEditing && storedGstMode 
      ? storedGstMode 
      : (paymentMode === "Cash" ? cashGstMode : onlineGstMode);
    const calculated = calculateInvoiceItem(rate, quantity, gstPercentage, gstMode);
    
    const cgstPercentage = gstPercentage / 2;
    const sgstPercentage = gstPercentage / 2;
    
    const newItem: InvoiceItem = {
      productId: product?.id || null,
      itemName: item.productName,
      description: item.productDescription || "",
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
  
  // Round off to nearest rupee
  const roundedGrandTotal = useMemo(() => Math.round(grandTotal), [grandTotal]);
  const roundOffAmount = useMemo(() => +(roundedGrandTotal - grandTotal), [roundedGrandTotal, grandTotal]);

  const recalcItemsForPaymentMode = (newPaymentMode: "Cash" | "Online" | "Cash+Card") => {
    let gstMode: GstMode;
    if (newPaymentMode === "Cash") gstMode = cashGstMode;
    else if (newPaymentMode === "Online") gstMode = onlineGstMode;
    else gstMode = onlineGstMode; // For split, default to online mode for GST
    const recalculated = items.map((item) => {
      const calculated = calculateInvoiceItem(item.originalRate, item.quantity, item.gstPercentage, gstMode);
      const cgstPercentage = item.gstPercentage / 2;
      const sgstPercentage = item.gstPercentage / 2;
      return {
        ...item,
        gstAmount: calculated.gstAmount,
        taxableValue: calculated.taxableValue,
        cgstAmount: calculated.cgstAmount,
        sgstAmount: calculated.sgstAmount,
        total: calculated.total,
        originalMode: newPaymentMode,
      } as InvoiceItem;
    });
    setItems(recalculated);
    setPaymentMode(newPaymentMode);
    if (newPaymentMode === "Cash+Card") {
      // Open modal after state updates to ensure roundedGrandTotal is current
      setTimeout(() => {
        setCashAmount(0);
        setCardAmount(Math.round(recalculated.reduce((sum, item) => sum + item.total, 0)));
        setSplitModalOpen(true);
      }, 0);
    }
  };

  // Recalculate items when GST mode settings change in admin settings so changes reflect in realtime
  useEffect(() => {
    if (items.length > 0) {
      // Reuse existing paymentMode to determine which GST mode applies
      recalcItemsForPaymentMode(paymentMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cashGstMode, onlineGstMode]);

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      // apiRequest returns a Fetch Response — parse JSON here so onSuccess receives the parsed invoice object
      if (isEditing && editInvoiceId) {
        const res = await apiRequest("PATCH", `/api/invoices/${editInvoiceId}`, data);
        return await res.json();
      } else {
        const res = await apiRequest("POST", "/api/invoices", data);
        return await res.json();
      }
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices/next-number"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      const invoiceId = data.id;
      toast({
        title: "Success",
        description: isEditing ? "Invoice updated successfully. Click to print receipt." : "Invoice saved successfully. Click to print receipt.",
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
      // If requested, automatically open print preview in the previously opened tab/window
      if ((printAfterSaveRef.current ?? false) === true) {
        printAfterSaveRef.current = false;
        const win = printWindowRef.current;
        // If we have a user-opened window, navigate it to the print page so it triggers print dialog
        if (win && !win.closed) {
          try {
            win.location.href = `${window.location.origin}/print-invoice/${invoiceId}`;
          } catch (e) {
            // fallback to same-tab navigation if cross-origin or other issue
            setLocation(`/print-invoice/${invoiceId}`);
          }
        } else {
          // Fallback: navigate current tab to print view
          setLocation(`/print-invoice/${invoiceId}`);
        }
        printWindowRef.current = null;
      }
      if (!isEditing) {
        setCustomerName("");
        setCustomerPhone("");
        setPaymentMode("Cash");
        setItems([]);
        setInvoiceNumberForEdit("");
        setStoredGstMode(null);
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: isEditing ? "Failed to update invoice" : "Failed to save invoice",
      });
    },
  });

  // Note: Recalculation effect removed to prevent incorrect totals when GST settings change
  // Items are calculated once when added, using the GST mode active at that time
  // Payment mode is locked once items are added, so no recalculation is needed

  const handleSave = async () => {
    // Basic validations
    if (!customerName || items.length === 0) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Please fill in all required fields and add at least one item",
      });
      return;
    }

    // Validate phone: must be exactly 10 digits
    const digitsOnly = customerPhone.replace(/\D/g, "");
    if (digitsOnly.length !== 10) {
      toast({
        variant: "destructive",
        title: "Validation Error",
        description: "Customer number must be exactly 10 digits",
      });
      return;
    }

    // Determine gstMode: use stored value when editing, current setting when creating
    const gstMode = isEditing && storedGstMode 
      ? storedGstMode 
      : (paymentMode === "Cash" ? cashGstMode : onlineGstMode);

    saveMutation.mutate({
      invoiceType: "B2C",
      customerName,
      customerPhone: customerPhone.replace(/\D/g, ""),
      paymentMode,
      gstMode,
      cashAmount: paymentMode === "Cash+Card" ? cashAmount : (paymentMode === "Cash" ? roundedGrandTotal : 0),
      cardAmount: paymentMode === "Cash+Card" ? cardAmount : (paymentMode === "Online" ? roundedGrandTotal : 0),
      items: items.map((item) => ({
        productId: item.productId,
        itemName: item.itemName,
        hsnCode: item.hsnCode,
        description: item.description || null,
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

  const handlePrint = () => {
    // Open the preview modal instead of navigating away
    setIsPreviewOpen(true);
  };

  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const onPreviewPrint = () => {
    // User clicked Print inside preview modal: open a popup (user gesture), then save. On save success
    // the popup will be redirected to the print page by saveMutation.onSuccess
    try {
      // Open a named popup (no noopener) so we keep a reference and can redirect it after save.
      // Using a named window also reuses the same popup if the user triggers print multiple times.
      const w = window.open("", "invoice_print", "width=800,height=600,menubar=0,toolbar=0,location=0");
      if (w) {
        try {
          w.document.write('<html><head><title>Printing...</title></head><body><p>Preparing print preview...</p></body></html>');
          w.document.close();
          w.focus();
        } catch (writeErr) {
          // Some browsers may restrict document.write; ignore and keep the window reference.
        }
        printWindowRef.current = w;
      }
    } catch (e) {
      printWindowRef.current = null;
    }

    printAfterSaveRef.current = true;
    // close preview modal (we open popup for UX)
    setIsPreviewOpen(false);
    handleSave();
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
          <h1 className="text-3xl font-semibold mb-2">{isEditing ? "Edit Invoice" : "Create Invoice"}</h1>
          <p className="text-muted-foreground">{isEditing ? "Update existing customer invoice" : "Generate a new customer invoice"}</p>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-medium">Invoice Details</CardTitle>
                <Badge variant="secondary" className="text-base font-semibold" data-testid="text-invoice-number">
                  {invoiceNumber}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="customerName" className="text-sm font-medium">
                  Customer Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customerName"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter customer name"
                  className="h-12"
                  data-testid="input-customer-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="customerPhone" className="text-sm font-medium">
                  Customer Number <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="customerPhone"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  placeholder="10-digit mobile number"
                  className="h-12"
                  data-testid="input-customer-phone"
                  maxLength={10}
                />
              </div>

              <div className="space-y-2 hidden">
                <Label htmlFor="paymentMode" className="text-sm font-medium">
                  Payment Mode <span className="text-destructive">*</span>
                </Label>
                <Select value={paymentMode} onValueChange={(value: "Cash" | "Online" | "Cash+Card") => recalcItemsForPaymentMode(value)} disabled={items.length > 0}>
                  <SelectTrigger className="h-12" data-testid="select-payment-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="Cash+Card">Cash + Card</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {items.length > 0
                    ? "Payment mode cannot be changed after adding items"
                    : (paymentMode === "Cash" ? `Cash: GST ${cashGstMode === 'inclusive' ? 'included in' : 'added to'} rate` : `Online: GST ${onlineGstMode === 'inclusive' ? 'included in' : 'added to'} rate`)
                  }
                </p>
              </div>
              {/* Hide original payment selection visually; we will also provide a payment selector in Summary so user can choose at the end */}
              

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Items</Label>
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={() => setDialogOpen(true)} 
                    data-testid="button-add-item"
                  >
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
                            <td className="py-2">
                              <Badge variant="outline" className="text-xs">{item.hsnCode}</Badge>
                              {item.description && (
                                <div className="text-xs text-muted-foreground mt-1">{item.description}</div>
                              )}
                            </td>
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
                  <div className="flex justify-between text-sm">
                    <span>Round Off:</span>
                    <span className="font-medium">₹{roundOffAmount.toFixed(2)}</span>
                  </div>
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Total GST:</span>
                  <span className="font-medium">₹{totalGst.toFixed(2)}</span>
                </div>
                <div className="border-t pt-3">
                  <div className="flex justify-between">
                    <span className="text-lg font-semibold">Grand Total:</span>
                      <span className="text-2xl font-bold text-primary" data-testid="text-grand-total">
                        ₹{roundedGrandTotal.toFixed(2)}
                      </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="paymentModeSummary" className="text-sm font-medium">
                    Payment Mode <span className="text-destructive">*</span>
                  </Label>
                  <Select value={paymentMode} onValueChange={(value: "Cash" | "Online" | "Cash+Card") => recalcItemsForPaymentMode(value)}>
                    <SelectTrigger className="h-12" data-testid="select-payment-mode-summary">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="Cash+Card">Cash + Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {paymentMode === "Cash+Card" && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Cash Amount:</span>
                      <span className="font-semibold">₹{cashAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Card/Online Amount:</span>
                      <span className="font-semibold">₹{cardAmount.toFixed(2)}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => setSplitModalOpen(true)}
                    >
                      Adjust Split
                    </Button>
                  </div>
                )}
                
                <Button
                  className="w-full h-12"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  data-testid="button-save-invoice"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saveMutation.isPending ? "Saving..." : "Save Bill"}
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={handlePrint}
                  data-testid="button-print-invoice"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Bill
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
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invoice Preview</DialogTitle>
            </DialogHeader>
            <div className="p-4">
              <InvoiceReceipt
                invoiceNumber={invoiceNumber}
                customerName={customerName}
                customerPhone={customerPhone}
                items={items}
                subtotal={subtotal}
                grandTotal={grandTotal}
              />
            </div>
            <div className="p-4 flex gap-2">
              <Button onClick={onPreviewPrint} data-testid="button-preview-print">Save & Print</Button>
              <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={splitModalOpen} onOpenChange={setSplitModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Split Payment: Cash + Card</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex justify-between text-lg font-semibold">
                <span>Total Bill:</span>
                <span>₹{roundedGrandTotal.toFixed(2)}</span>
              </div>
              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Label>Cash Amount</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    min={0}
                    max={roundedGrandTotal}
                    value={cashAmount}
                    onChange={e => {
                      let val = parseFloat(e.target.value) || 0;
                      if (val > roundedGrandTotal) val = roundedGrandTotal;
                      setCashAmount(val);
                      setCardAmount(Number((roundedGrandTotal - val).toFixed(2)));
                    }}
                  />
                </div>
                <div className="flex-1">
                  <Label>Card/Online Amount</Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    min={0}
                    max={roundedGrandTotal}
                    value={cardAmount}
                    onChange={e => {
                      let val = parseFloat(e.target.value) || 0;
                      if (val > roundedGrandTotal) val = roundedGrandTotal;
                      setCardAmount(val);
                      setCashAmount(Number((roundedGrandTotal - val).toFixed(2)));
                    }}
                  />
                </div>
              </div>
              <div className="flex justify-between text-sm">
                <span>Balance:</span>
                <span className={cashAmount + cardAmount !== roundedGrandTotal ? "text-destructive" : "text-green-700"}>
                  ₹{(roundedGrandTotal - cashAmount - cardAmount).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => {
                    setSplitModalOpen(false);
                    // If user left both zero, default all to card
                    if (cashAmount + cardAmount !== roundedGrandTotal) {
                      setCashAmount(0);
                      setCardAmount(roundedGrandTotal);
                    }
                  }}
                  disabled={cashAmount + cardAmount !== roundedGrandTotal}
                >
                  Confirm
                </Button>
                <Button variant="ghost" onClick={() => {
                  setSplitModalOpen(false);
                  setPaymentMode("Cash");
                }}>Cancel</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <InvoiceReceipt
        invoiceNumber={invoiceNumber}
        customerName={customerName}
        customerPhone={customerPhone}
        items={items}
        subtotal={subtotal}
        grandTotal={grandTotal}
      />
    </>
  );
}

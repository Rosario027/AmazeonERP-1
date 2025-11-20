import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { SHOP_INFO } from "@shared/shopInfo";
import logoImg from "@assets/1762677792449-0d76ba93-0eba-48fa-927f-62011c24e28f_1_1762963626825.jpg";
import React, { useEffect } from "react";

interface InvoiceItem {
  itemName: string;
  hsnCode: string;
  quantity: number;
  rate: string;
  taxableValue: string;
  cgstAmount: string;
  sgstAmount: string;
  total: string;
}

interface InvoiceData {
  id: number;
  invoiceNumber: string;
  invoiceType: string;
  customerName: string;
  customerPhone: string;
  createdAt: string;
  subtotal: string;
  grandTotal: string;
  items: InvoiceItem[];
}

export default function PrintInvoice() {
  const [, params] = useRoute("/print-invoice/:id");
  const [, setLocation] = useLocation();
  const invoiceId = params?.id ? parseInt(params.id) : null;

  const { data: invoice, isLoading } = useQuery<InvoiceData>({
    queryKey: ["/api/invoices", invoiceId],
    enabled: !!invoiceId,
  });

  useEffect(() => {
    if (invoice && !isLoading) {
      setTimeout(() => {
        window.print();
      }, 500);

      const handleAfterPrint = () => {
        // Navigate to blank new invoice screen after printing
        // Add timestamp to force component remount and reset state
        if (invoice.invoiceType === "B2B") {
          setLocation("/admin/b2b-invoice?new=" + Date.now());
        } else {
          setLocation("/create-invoice?new=" + Date.now());
        }
      };

      window.addEventListener("afterprint", handleAfterPrint);

      return () => {
        window.removeEventListener("afterprint", handleAfterPrint);
      };
    }
  }, [invoice, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p>Invoice not found</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const items = invoice.items.map(item => ({
    itemName: item.itemName,
    hsnCode: item.hsnCode,
    description: item.description || "",
    quantity: item.quantity,
    rate: item.rate,
    taxableValue: parseFloat(item.taxableValue),
    cgstAmount: parseFloat(item.cgstAmount),
    sgstAmount: parseFloat(item.sgstAmount),
    total: parseFloat(item.total),
  }));

  const subtotal = parseFloat(invoice.subtotal);
  const grandTotal = parseFloat(invoice.grandTotal);
  const totalCgst = items.reduce((sum, it) => sum + (it.cgstAmount || 0), 0);
  const totalSgst = items.reduce((sum, it) => sum + (it.sgstAmount || 0), 0);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'white',
      zIndex: 9999,
      overflow: 'auto'
    }}>
      <style>
        {`
          @media print {
            @page {
              size: 80mm auto;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
        `}
      </style>
      
      <div className="receipt-container" style={{
        width: "80mm",
        maxWidth: "300px",
        margin: "0 auto",
        padding: "10px",
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "1.4",
      }} data-testid="print-invoice">
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          <img 
            src={logoImg} 
            alt="Amazeon Logo" 
            style={{
              width: "60px",
              height: "60px",
              margin: "0 auto 8px",
              display: "block",
            }}
          />
          <div style={{ fontWeight: "bold", fontSize: "16px", marginBottom: "2px" }}>
            {SHOP_INFO.name}
          </div>
          <div style={{ fontSize: "10px", marginBottom: "2px" }}>
            {SHOP_INFO.address}
          </div>
          <div style={{ fontSize: "10px", marginBottom: "2px" }}>
            Ph: {SHOP_INFO.phone}
          </div>
          <div style={{ fontSize: "10px", marginBottom: "8px" }}>
            GST: {SHOP_INFO.gstNumber}
          </div>
          <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />
        </div>

        <div style={{ marginBottom: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Invoice: <strong>{invoice.invoiceNumber}</strong></span>
            <span>{formatDate(invoice.createdAt)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
            <span>Customer: {invoice.customerName}</span>
            <span>{formatTime(invoice.createdAt)}</span>
          </div>
          {invoice.customerPhone && (
            <div style={{ fontSize: "11px" }}>Ph: {invoice.customerPhone}</div>
          )}
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

        <table style={{ width: "100%", fontSize: "10px", marginBottom: "8px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #000" }}>
              <th style={{ textAlign: "left", padding: "2px 0" }}>Item</th>
              <th style={{ textAlign: "center", padding: "2px 0" }}>Qty</th>
              <th style={{ textAlign: "right", padding: "2px 0" }}>Rate</th>
              <th style={{ textAlign: "right", padding: "2px 0" }}>Amt</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <React.Fragment key={index}>
                <tr>
                  <td style={{ padding: "4px 0" }}>{item.itemName}</td>
                  <td style={{ textAlign: "center", padding: "4px 0" }}>{item.quantity}</td>
                  <td style={{ textAlign: "right", padding: "4px 0" }}>₹{item.rate}</td>
                  <td style={{ textAlign: "right", padding: "4px 0" }}>₹{item.total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td colSpan={4} style={{ fontSize: "9px", color: "#666", paddingBottom: "4px" }}>
                    HSN: {item.hsnCode} | Tax: ₹{item.taxableValue.toFixed(2)} + ₹{(item.cgstAmount + item.sgstAmount).toFixed(2)} GST
                  </td>
                </tr>
                {item.description && (
                  <tr>
                    <td colSpan={4} style={{ fontSize: "9px", color: "#555", paddingBottom: "4px" }}>
                      {item.description}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

        <div style={{ fontSize: "11px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>Subtotal:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>CGST:</span>
            <span>₹{totalCgst.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span>SGST:</span>
            <span>₹{totalSgst.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "10px", color: "#333" }}>
            <span>Total GST:</span>
            <span>₹{(totalCgst + totalSgst).toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "13px", borderTop: "1px solid #000", paddingTop: "4px" }}>
            <span>TOTAL:</span>
            <span>₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        <div style={{ borderTop: "1px dashed #000", margin: "8px 0" }} />

        <div style={{ textAlign: "center", fontSize: "10px", marginTop: "12px" }}>
          <div>Thank you for shopping</div>
          <div style={{ marginTop: "4px" }}>Visit again</div>
        </div>
      </div>
    </div>
  );
}

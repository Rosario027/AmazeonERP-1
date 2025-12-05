import { SHOP_INFO } from "@shared/shopInfo";
import { useState } from "react";
import logoImg from "@assets/1762677792449-0d76ba93-0eba-48fa-927f-62011c24e28f_1_1762963626825.jpg";

interface InvoiceReceiptProps {
  invoiceNumber: string;
  customerName: string;
  customerPhone?: string;
  date?: Date;
  items: Array<{
    itemName: string;
    hsnCode: string;
    description?: string;
    quantity: number;
    rate: string;
    taxableValue: number;
    cgstAmount: number;
    sgstAmount: number;
    total: number;
  }>;
  subtotal: number;
  grandTotal: number;
  paid?: number;
}

export function InvoiceReceipt({
  invoiceNumber,
  customerName,
  customerPhone,
  date = new Date(),
  items,
  subtotal,
  grandTotal,
  paid = 0,
}: InvoiceReceiptProps) {
  const balance = grandTotal - paid;
  const [logoError, setLogoError] = useState(false);

  const totalCgst = items.reduce((s, it) => s + (it.cgstAmount || 0), 0);
  const totalSgst = items.reduce((s, it) => s + (it.sgstAmount || 0), 0);
  const rawGrand = subtotal + totalCgst + totalSgst;
  const roundedGrand = Math.round(rawGrand);
  const roundOff = roundedGrand - rawGrand;

  const formatDate = (date: Date) => {
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  return (
    <div className="hidden print:block" data-testid="invoice-receipt">
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
            .no-print {
              display: none !important;
            }
            .receipt-container { width:80mm !important; max-width:80mm !important; }
            .receipt-item-row { page-break-inside: avoid; }
            .receipt-item-header, .receipt-totals-row { display:flex; justify-content:space-between; }
          }
        `}
      </style>
      
      <div className="receipt-container" style={{
        width: "80mm",
        maxWidth: "300px",
        margin: "0 auto",
        padding: "10px",
        fontFamily: "monospace",
        fontSize: "13px",
        lineHeight: "1.4",
        color: "#000",
        backgroundColor: "#fff",
      }}>
        {/* Header with Logo */}
        <div style={{ textAlign: "center", marginBottom: "10px" }}>
          {!logoError && (
            <img 
              src={logoImg} 
              alt={SHOP_INFO.name}
              onError={() => setLogoError(true)}
              style={{
                maxWidth: "60px",
                maxHeight: "60px",
                margin: "0 auto 8px",
                display: "block",
              }}
            />
          )}
          <div style={{ fontSize: "18px", fontWeight: "bold", marginBottom: "4px" }}>
            {SHOP_INFO.name}
          </div>
          <div style={{ fontSize: "11px", marginBottom: "2px", whiteSpace: "pre-line" }}>
            {SHOP_INFO.address}
          </div>
          <div style={{ fontSize: "11px", marginBottom: "2px" }}>
            Phone: {SHOP_INFO.phone}
          </div>
          <div style={{ fontSize: "11px", marginBottom: "8px" }}>
            GST: {SHOP_INFO.gstNumber}
          </div>
        </div>

        {/* Divider */}
        <div style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }} />

        {/* Invoice Details */}
        <div style={{ marginBottom: "8px", fontSize: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontWeight: "bold" }}>Invoice: {invoiceNumber}</span>
          </div>
          <div style={{ marginBottom: "2px" }}>
            Customer: {customerName}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>Date: {formatDate(date)}</span>
            <span>Time: {formatTime(date)}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }} />

        {/* Items Table */}
        <div style={{ marginBottom: "8px" }}>
          {items.map((item, index) => (
            <div key={index} className="receipt-item-row" style={{ marginBottom: "6px", fontSize: "11px" }}>
              <div className="receipt-item-header" style={{ fontWeight: "bold", marginBottom: "2px" }}>
                <div style={{ flex: "1", wordBreak: 'break-word' }}>{item.itemName}</div>
                <div style={{ textAlign: "right", whiteSpace:'nowrap' }}>₹{item.total.toFixed(2)}</div>
              </div>
              <div style={{ fontSize: "10px", color: "#333", marginBottom: "2px" }}>
                HSN: {item.hsnCode} | Qty: {item.quantity} x ₹{parseFloat(item.rate).toFixed(2)}
              </div>
              {item.description && (
                <div style={{ fontSize: "10px", color: "#666", marginBottom: "2px", wordBreak:'break-word' }}>
                  {item.description}
                </div>
              )}
              <div style={{ fontSize: "10px", color: "#555", display: "flex", justifyContent: "space-between" }}>
                <span>Taxable: ₹{item.taxableValue.toFixed(2)}</span>
                <span style={{ whiteSpace:'nowrap' }}>CGST: ₹{item.cgstAmount.toFixed(2)} | SGST: ₹{item.sgstAmount.toFixed(2)}</span>
              </div>
              {index < items.length - 1 && (
                <div style={{ borderTop: "1px dotted #ccc", marginTop: "4px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }} />

        {/* Totals */}
        <div style={{ fontSize: "12px", marginBottom: "8px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
            <span>Taxable Value:</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px", fontSize: "11px" }}>
            <span>CGST:</span>
            <span>₹{totalCgst.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px" }}>
            <span>SGST:</span>
            <span>₹{totalSgst.toFixed(2)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "11px", color: "#333" }}>
            <span>Round Off:</span>
            <span>₹{roundOff.toFixed(2)}</span>
          </div>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "4px",
            fontWeight: "bold",
            fontSize: "14px",
          }}>
            <span>Grand Total:</span>
            <span>₹{roundedGrand.toFixed(2)}</span>
          </div>
          {paid > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Paid:</span>
                <span>₹{paid.toFixed(2)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span>Balance:</span>
                <span>₹{balance.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div style={{
          borderTop: "1px dashed #000",
          margin: "8px 0",
        }} />

        {/* Footer Message */}
        <div style={{
          textAlign: "center",
          fontSize: "12px",
          fontStyle: "italic",
          marginTop: "8px",
          marginBottom: "12px",
        }}>
          Thank you for shopping
        </div>

        {/* QR Code and Policy */}
        <div style={{
          textAlign: "center",
          marginTop: "12px",
          marginBottom: "8px",
        }}>
          <img 
            src="/whatsapp QR.png" 
            alt="WhatsApp QR Code"
            onError={(e) => {
              // Hide image if not found
              (e.target as HTMLImageElement).style.display = 'none';
            }}
            style={{
              width: "80px",
              height: "80px",
              margin: "0 auto 8px",
              display: "block",
            }}
          />
          <div style={{
            fontSize: "11px",
            fontWeight: "bold",
            color: "#000",
            marginTop: "8px",
          }}>
            No Return / No Exchange
          </div>
        </div>
      </div>
    </div>
  );
}

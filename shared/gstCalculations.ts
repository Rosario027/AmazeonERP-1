/**
 * GST Calculation Utility
 * Handles inclusive and exclusive GST calculation modes for invoice items
 */

export type GstMode = 'inclusive' | 'exclusive';

export interface InvoiceItemCalculation {
  taxableValue: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  total: number;
}

/**
 * Calculate invoice item totals based on GST mode
 * @param rate - Rate per unit
 * @param quantity - Quantity of items
 * @param gstPercentage - Total GST percentage (e.g., 18 for 18%)
 * @param mode - 'inclusive' or 'exclusive'
 * @returns Calculated values for taxable value, GST amounts, and total
 */
export function calculateInvoiceItem(
  rate: number,
  quantity: number,
  gstPercentage: number,
  mode: GstMode
): InvoiceItemCalculation {
  let taxableValue: number;
  let gstAmount: number;
  let total: number;

  if (mode === 'inclusive') {
    // Inclusive mode: GST is already included in the rate
    // Formula: taxableValue = (rate * qty) / (1 + gst/100)
    // gstAmount = (rate * qty) - taxableValue
    const baseAmount = rate * quantity;
    gstAmount = (baseAmount * gstPercentage) / (100 + gstPercentage);
    taxableValue = baseAmount - gstAmount;
    total = baseAmount;
  } else {
    // Exclusive mode: GST is added on top of the rate
    // Formula: taxableValue = rate * qty
    // gstAmount = taxableValue * (gst/100)
    taxableValue = rate * quantity;
    gstAmount = (taxableValue * gstPercentage) / 100;
    total = taxableValue + gstAmount;
  }

  // Split GST equally between CGST and SGST
  const cgstAmount = gstAmount / 2;
  const sgstAmount = gstAmount / 2;

  return {
    taxableValue: parseFloat(taxableValue.toFixed(2)),
    gstAmount: parseFloat(gstAmount.toFixed(2)),
    cgstAmount: parseFloat(cgstAmount.toFixed(2)),
    sgstAmount: parseFloat(sgstAmount.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

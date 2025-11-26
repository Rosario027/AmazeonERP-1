-- Check ALL invoices regardless of date
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_sales,
  SUM(cash_amount) as cash_sales,
  SUM(card_amount) as card_sales,
  MIN(created_at) as first_invoice,
  MAX(created_at) as last_invoice
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Check if there are any Online invoices at all
SELECT 
  id,
  invoice_number,
  payment_mode,
  grand_total,
  cash_amount,
  card_amount,
  created_at
FROM invoices
WHERE deleted_at IS NULL
  AND payment_mode = 'Online'
ORDER BY created_at DESC
LIMIT 20;

-- Test query to see what the API should be returning for today
-- This mimics what the /api/finance/sales-summary endpoint does

SELECT 
  COUNT(*) as invoice_count,
  COALESCE(SUM(CAST(cash_amount AS DECIMAL(12,2))), 0) as cash_total,
  COALESCE(SUM(CAST(card_amount AS DECIMAL(12,2))), 0) as card_total,
  COALESCE(SUM(CAST(grand_total AS DECIMAL(12,2))), 0) as total_sales
FROM invoices
WHERE deleted_at IS NULL
  AND created_at >= '2025-11-26 00:00:00'
  AND created_at <= '2025-11-26 23:59:59';

-- Also check what timezone the created_at timestamps are in
SELECT 
  id,
  invoice_number,
  created_at,
  payment_mode,
  grand_total,
  cash_amount,
  card_amount
FROM invoices
WHERE deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 10;

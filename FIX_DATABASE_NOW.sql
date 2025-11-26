-- =====================================================
-- CRITICAL FIX: Run these queries in order
-- =====================================================

-- Query 1: Check columns exist (should show 4 columns)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' 
  AND column_name IN ('cash_amount', 'card_amount', 'payment_mode', 'grand_total')
ORDER BY column_name;

-- Query 2: Check current invoice data BEFORE backfill
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(CASE WHEN cash_amount = 0 AND card_amount = 0 THEN 1 ELSE 0 END) as need_backfill,
  SUM(grand_total) as total_amount
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Query 3: BACKFILL Cash invoices
UPDATE invoices
SET 
  cash_amount = grand_total,
  card_amount = 0
WHERE payment_mode = 'Cash' 
  AND cash_amount = 0
  AND card_amount = 0
  AND deleted_at IS NULL;

-- Query 4: BACKFILL Online invoices
UPDATE invoices
SET 
  cash_amount = 0,
  card_amount = grand_total
WHERE payment_mode = 'Online' 
  AND cash_amount = 0
  AND card_amount = 0
  AND deleted_at IS NULL;

-- Query 5: VERIFY backfill worked (discrepancy should be 0)
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_amount,
  SUM(cash_amount) as cash_total,
  SUM(card_amount) as card_total,
  SUM(grand_total - (cash_amount + card_amount)) as discrepancy
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Query 6: Check TODAY'S sales (November 26, 2025)
SELECT 
  DATE(created_at) as sale_date,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_sales,
  SUM(cash_amount) as cash_sales,
  SUM(card_amount) as card_sales
FROM invoices
WHERE deleted_at IS NULL
  AND created_at >= '2025-11-26 00:00:00'
  AND created_at < '2025-11-27 00:00:00'
GROUP BY DATE(created_at);

-- =====================================================
-- EXPECTED RESULTS:
-- - Query 2: Shows how many invoices need backfill
-- - Query 3 & 4: Updates those invoices
-- - Query 5: Discrepancy should be 0.00
-- - Query 6: Shows today's sales with cash/card breakdown
-- =====================================================

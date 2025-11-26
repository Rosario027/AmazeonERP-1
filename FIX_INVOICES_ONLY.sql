-- =====================================================
-- INVOICE BACKFILL SCRIPT - CRITICAL FIX
-- This script ONLY fixes the invoice payment amounts
-- Run each query one by one in pgAdmin
-- =====================================================

-- Query 1: Check current schema
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'invoices' 
  AND column_name IN ('cash_amount', 'card_amount', 'payment_mode', 'grand_total')
ORDER BY column_name;

-- Query 2: Check how many invoices need backfill
SELECT 
  payment_mode,
  COUNT(*) as total_invoices,
  SUM(CASE WHEN cash_amount = 0 AND card_amount = 0 THEN 1 ELSE 0 END) as need_backfill,
  SUM(grand_total) as total_amount
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Query 3: Backfill Cash invoices
UPDATE invoices
SET 
  cash_amount = grand_total,
  card_amount = 0
WHERE payment_mode = 'Cash' 
  AND cash_amount = 0 
  AND card_amount = 0
  AND deleted_at IS NULL;

-- Query 4: Backfill Online invoices
UPDATE invoices
SET 
  cash_amount = 0,
  card_amount = grand_total
WHERE payment_mode = 'Online' 
  AND cash_amount = 0 
  AND card_amount = 0
  AND deleted_at IS NULL;

-- Query 5: Backfill Cash+Card invoices (if any need it)
UPDATE invoices
SET 
  cash_amount = 0,
  card_amount = grand_total
WHERE payment_mode = 'Cash+Card'
  AND cash_amount = 0 
  AND card_amount = 0
  AND deleted_at IS NULL;

-- Query 6: Verify everything is correct
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_amount,
  SUM(cash_amount) as cash_total,
  SUM(card_amount) as card_total,
  SUM(cash_amount + card_amount) as combined_total,
  SUM(grand_total - (cash_amount + card_amount)) as discrepancy
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Query 7: Check today's sales (2025-11-26)
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_sales,
  SUM(cash_amount) as cash_sales,
  SUM(card_amount) as card_sales
FROM invoices
WHERE deleted_at IS NULL
  AND DATE(created_at) = '2025-11-26'
GROUP BY payment_mode;

-- =====================================================
-- INSTRUCTIONS:
-- 1. Run Query 2 first to see how many need backfill
-- 2. Run Queries 3, 4, 5 to do the backfill
-- 3. Run Query 6 - discrepancy should be 0
-- 4. Run Query 7 to see today's sales breakdown
-- 5. After this, refresh your finance page
-- =====================================================

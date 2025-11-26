-- =====================================================
-- COMPLETE FINANCE SCHEMA SETUP AND DATA VERIFICATION
-- Run this in pgAdmin to ensure everything is correct
-- =====================================================

-- Step 1: Check if cash_amount and card_amount columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices' 
  AND column_name IN ('cash_amount', 'card_amount', 'payment_mode', 'grand_total');

-- Step 2: Add columns if they don't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS cash_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS card_amount NUMERIC(12, 2) DEFAULT 0 NOT NULL;

-- Step 3: Check current data state (before backfill)
SELECT 
  payment_mode,
  COUNT(*) as invoice_count,
  SUM(CASE WHEN cash_amount = 0 AND card_amount = 0 THEN 1 ELSE 0 END) as need_backfill,
  SUM(grand_total) as total_amount,
  SUM(cash_amount) as current_cash_total,
  SUM(card_amount) as current_card_total
FROM invoices
WHERE deleted_at IS NULL
GROUP BY payment_mode;

-- Step 4: Backfill existing invoices (THIS IS THE CRITICAL FIX)
-- Update Cash invoices
UPDATE invoices
SET 
  cash_amount = grand_total,
  card_amount = 0
WHERE payment_mode = 'Cash' 
  AND (cash_amount = 0 OR cash_amount IS NULL)
  AND (card_amount = 0 OR card_amount IS NULL)
  AND deleted_at IS NULL;

-- Update Online invoices
UPDATE invoices
SET 
  cash_amount = 0,
  card_amount = grand_total
WHERE payment_mode = 'Online' 
  AND (cash_amount = 0 OR cash_amount IS NULL)
  AND (card_amount = 0 OR card_amount IS NULL)
  AND deleted_at IS NULL;

-- Note: Cash+Card invoices should already have split amounts from the create-invoice form
-- If they don't, we default to all card
UPDATE invoices
SET 
  cash_amount = CASE WHEN cash_amount = 0 AND card_amount = 0 THEN 0 ELSE cash_amount END,
  card_amount = CASE WHEN cash_amount = 0 AND card_amount = 0 THEN grand_total ELSE card_amount END
WHERE payment_mode = 'Cash+Card'
  AND deleted_at IS NULL;

-- Step 5: Verify the backfill worked
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

-- Step 6: Check today's sales (adjust date as needed)
SELECT 
  DATE(created_at) as sale_date,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_sales,
  SUM(cash_amount) as cash_sales,
  SUM(card_amount) as card_sales
FROM invoices
WHERE deleted_at IS NULL
  AND created_at >= CURRENT_DATE
  AND created_at < CURRENT_DATE + INTERVAL '1 day'
GROUP BY DATE(created_at);

-- Step 7: Check last 7 days of sales
SELECT 
  DATE(created_at) as sale_date,
  COUNT(*) as invoice_count,
  SUM(grand_total) as total_sales,
  SUM(cash_amount) as cash_sales,
  SUM(card_amount) as card_sales
FROM invoices
WHERE deleted_at IS NULL
  AND created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Step 8: Verify cash_balances table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cash_balances'
ORDER BY ordinal_position;

-- Step 9: Verify cash_withdrawals table exists
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'cash_withdrawals'
ORDER BY ordinal_position;

-- Step 10: Check if there's any cash balance data
SELECT 
  DATE(date) as balance_date,
  COUNT(*) as entries,
  SUM(opening) as total_opening,
  SUM(cash_total) as total_cash,
  SUM(card_total) as total_card,
  SUM(closing) as total_closing
FROM cash_balances
GROUP BY DATE(date)
ORDER BY balance_date DESC
LIMIT 10;

-- =====================================================
-- EXPECTED RESULTS:
-- - All invoices should have cash_amount + card_amount = grand_total
-- - Discrepancy should be 0 or very close to 0
-- - Today's sales should show correct amounts
-- =====================================================

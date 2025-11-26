-- SQL SCHEMA FOR PGADMIN
-- Run this in your PostgreSQL database to add payment split columns

ALTER TABLE "invoices"
  ADD COLUMN IF NOT EXISTS "cash_amount" numeric(12, 2) DEFAULT 0 NOT NULL,
  ADD COLUMN IF NOT EXISTS "card_amount" numeric(12, 2) DEFAULT 0 NOT NULL;

-- Backfill existing invoices based on payment mode
UPDATE "invoices"
SET 
  cash_amount = CASE
    WHEN payment_mode = 'Cash' THEN grand_total
    WHEN payment_mode = 'Cash+Card' THEN COALESCE(cash_amount, 0)
    ELSE 0
  END,
  card_amount = CASE
    WHEN payment_mode = 'Online' THEN grand_total
    WHEN payment_mode = 'Cash+Card' THEN COALESCE(card_amount, 0)
    ELSE 0
  END
WHERE cash_amount = 0 AND card_amount = 0;

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'invoices' 
  AND column_name IN ('cash_amount', 'card_amount');

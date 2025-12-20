-- FINANCE TABLES SETUP
-- Run this in pgAdmin to ensure all finance tables exist

-- Step 1: Check existing tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('cash_balances', 'cash_withdrawals', 'invoices');

-- Step 2: Create cash_balances table if not exists
CREATE TABLE IF NOT EXISTS cash_balances (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    opening NUMERIC(12, 2) DEFAULT 0,
    cash_total NUMERIC(12, 2) DEFAULT 0,
    card_total NUMERIC(12, 2) DEFAULT 0,
    closing NUMERIC(12, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Step 3: Create cash_withdrawals table if not exists
CREATE TABLE IF NOT EXISTS cash_withdrawals (
    id SERIAL PRIMARY KEY,
    admin_id UUID NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cash_balances_user_date ON cash_balances(user_id, date);
CREATE INDEX IF NOT EXISTS idx_cash_withdrawals_admin_date ON cash_withdrawals(admin_id, created_at);

-- Step 5: Ensure invoices table has cash_amount and card_amount columns
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'cash_amount'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN cash_amount NUMERIC(12, 2) DEFAULT 0;
        RAISE NOTICE 'Column cash_amount added to invoices';
    ELSE
        RAISE NOTICE 'Column cash_amount already exists in invoices';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'invoices' 
        AND column_name = 'card_amount'
    ) THEN
        ALTER TABLE invoices 
        ADD COLUMN card_amount NUMERIC(12, 2) DEFAULT 0;
        RAISE NOTICE 'Column card_amount added to invoices';
    ELSE
        RAISE NOTICE 'Column card_amount already exists in invoices';
    END IF;
END $$;

-- Step 6: Verify structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cash_balances'
ORDER BY ordinal_position;

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'cash_withdrawals'
ORDER BY ordinal_position;

-- Step 7: Test query
SELECT COUNT(*) as balance_count FROM cash_balances;
SELECT COUNT(*) as withdrawal_count FROM cash_withdrawals;

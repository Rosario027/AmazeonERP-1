-- Add payment_status column to employee_purchases table
-- Run this in pgAdmin or your PostgreSQL client

-- Step 1: Add the payment_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'employee_purchases' 
        AND column_name = 'payment_status'
    ) THEN
        ALTER TABLE employee_purchases 
        ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'unpaid';
        
        RAISE NOTICE 'Column payment_status added successfully';
    ELSE
        RAISE NOTICE 'Column payment_status already exists';
    END IF;
END $$;

-- Step 2: Verify the column was added
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'employee_purchases'
AND column_name = 'payment_status';

-- Step 3: View sample data to confirm
SELECT id, employee_id, purchase_date, category, amount, payment_mode, payment_status, description
FROM employee_purchases
ORDER BY created_at DESC
LIMIT 10;

-- Step 4: Check total counts
SELECT 
    payment_status,
    COUNT(*) as count,
    SUM(amount::numeric) as total_amount
FROM employee_purchases
WHERE payment_mode = 'credit' OR category = 'advance'
GROUP BY payment_status;

-- Update payment_status column for existing employee_purchases records
-- Run this in pgAdmin or your PostgreSQL client

-- Step 1: Check if payment_status column exists
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'employee_purchases'
AND column_name = 'payment_status';

-- Step 2: If column doesn't exist, add it (from ADD_PAYMENT_STATUS.sql)
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

-- Step 3: Update any NULL values to 'unpaid' (if needed)
UPDATE employee_purchases
SET payment_status = 'unpaid'
WHERE payment_status IS NULL;

-- Step 4: Verify the data
SELECT 
    payment_status,
    COUNT(*) as count,
    SUM(amount::numeric) as total_amount
FROM employee_purchases
WHERE payment_mode = 'credit' OR category = 'advance'
GROUP BY payment_status;

-- Step 5: View sample records
SELECT 
    id, 
    employee_id, 
    purchase_date, 
    category, 
    amount, 
    payment_mode, 
    payment_status, 
    description,
    created_at
FROM employee_purchases
ORDER BY created_at DESC
LIMIT 20;

-- Step 6: Check records by employee
SELECT 
    e.full_name,
    ep.category,
    ep.payment_mode,
    ep.payment_status,
    COUNT(*) as record_count,
    SUM(ep.amount::numeric) as total_amount
FROM employee_purchases ep
JOIN employees e ON ep.employee_id = e.id
WHERE ep.payment_mode = 'credit' OR ep.category = 'advance'
GROUP BY e.full_name, ep.category, ep.payment_mode, ep.payment_status
ORDER BY e.full_name, ep.payment_status;

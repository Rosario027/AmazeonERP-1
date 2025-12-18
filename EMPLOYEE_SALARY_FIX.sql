-- SQL Script for pgAdmin: Employee Salary Column Fix
-- Run this if you're getting errors when updating employee salary

-- Check if salary column exists, if not add it
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'salary'
    ) THEN
        ALTER TABLE employees ADD COLUMN salary NUMERIC(12, 2);
        RAISE NOTICE 'Added salary column to employees table';
    ELSE
        RAISE NOTICE 'Salary column already exists';
    END IF;
END $$;

-- Verify the column exists and show its type
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'salary';

-- Show all employees with their salary values
SELECT id, employee_code, full_name, salary, status 
FROM employees 
ORDER BY created_at DESC;

-- Example: Update an employee's salary manually (replace the ID)
-- UPDATE employees SET salary = 25000.00 WHERE id = 'your-employee-uuid-here';

-- If you need to fix NULL constraint issues, you can set default value
-- ALTER TABLE employees ALTER COLUMN salary SET DEFAULT 0;

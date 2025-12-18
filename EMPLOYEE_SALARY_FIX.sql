-- SQL Script for pgAdmin: Employee & Staff Audit Log Fix
-- Run this if you're getting errors when updating employee salary or audit log errors

-- ============================================
-- FIX 1: Staff Audit Log Table - Add missing columns
-- ============================================

-- Check if staff_audit_log table exists, if not create it
CREATE TABLE IF NOT EXISTS staff_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    changed_by TEXT NOT NULL,
    changed_by_role TEXT NOT NULL,
    previous_data TEXT,
    new_data TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add missing columns if the table already exists
DO $$ 
BEGIN
    -- Add changed_by_role column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_audit_log' AND column_name = 'changed_by_role'
    ) THEN
        ALTER TABLE staff_audit_log ADD COLUMN changed_by_role TEXT NOT NULL DEFAULT 'unknown';
        RAISE NOTICE 'Added changed_by_role column to staff_audit_log table';
    ELSE
        RAISE NOTICE 'changed_by_role column already exists';
    END IF;
    
    -- Add previous_data column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_audit_log' AND column_name = 'previous_data'
    ) THEN
        ALTER TABLE staff_audit_log ADD COLUMN previous_data TEXT;
        RAISE NOTICE 'Added previous_data column to staff_audit_log table';
    END IF;
    
    -- Add new_data column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_audit_log' AND column_name = 'new_data'
    ) THEN
        ALTER TABLE staff_audit_log ADD COLUMN new_data TEXT;
        RAISE NOTICE 'Added new_data column to staff_audit_log table';
    END IF;
    
    -- Add ip_address column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'staff_audit_log' AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE staff_audit_log ADD COLUMN ip_address TEXT;
        RAISE NOTICE 'Added ip_address column to staff_audit_log table';
    END IF;
END $$;

-- ============================================
-- FIX 2: Employees Table - Add salary column
-- ============================================

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

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify staff_audit_log columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'staff_audit_log'
ORDER BY ordinal_position;

-- Verify employees salary column
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name = 'employees' AND column_name = 'salary';

-- Show all employees with their salary values
SELECT id, employee_code, full_name, salary, status 
FROM employees 
ORDER BY created_at DESC;

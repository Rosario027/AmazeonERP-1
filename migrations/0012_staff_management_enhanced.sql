-- Migration: Enhanced Staff Management
-- Add new fields to employees table and create audit log

-- Add new columns to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS alternate_phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id TEXT UNIQUE;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS id_proof_files TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false NOT NULL;

-- Update existing records to split full_name into first_name and last_name
UPDATE employees 
SET first_name = SPLIT_PART(full_name, ' ', 1),
    last_name = COALESCE(NULLIF(SUBSTRING(full_name FROM POSITION(' ' IN full_name) + 1), ''), SPLIT_PART(full_name, ' ', 1))
WHERE first_name IS NULL;

-- Make first_name and last_name NOT NULL after populating
ALTER TABLE employees ALTER COLUMN first_name SET NOT NULL;
ALTER TABLE employees ALTER COLUMN last_name SET NOT NULL;

-- Create staff audit log table
CREATE TABLE IF NOT EXISTS staff_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  changed_by_role TEXT NOT NULL,
  previous_data TEXT,
  new_data TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_audit_employee ON staff_audit_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_changed_by ON staff_audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_employees_user_id ON employees(user_id);

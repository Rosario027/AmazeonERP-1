-- Idempotent Staff Management Schema Setup (safe to re-run)
-- Use this if 0010_staff_management.sql aborted in a transaction

BEGIN;

-- Ensure required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;  -- for gin_trgm_ops

-- 1) Employees table (create if missing)
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'staff',
  status TEXT NOT NULL DEFAULT 'active',
  date_joined DATE,
  date_left DATE,
  salary NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes (idempotent)
CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm ON employees USING gin (full_name gin_trgm_ops);

-- 2) Attendance table
CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON employee_attendance(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON employee_attendance(status);

-- 3) Employee purchases
CREATE TABLE IF NOT EXISTS employee_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash',
  description TEXT,
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_purchases_employee_date ON employee_purchases(employee_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_emp_purchases_category ON employee_purchases(category);
CREATE INDEX IF NOT EXISTS idx_emp_purchases_payment_mode ON employee_purchases(payment_mode);

-- 4) Add check constraints only if they do not exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_employees_role'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT chk_employees_role
      CHECK (role IN ('staff','manager','admin'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_employees_status'
  ) THEN
    ALTER TABLE employees
      ADD CONSTRAINT chk_employees_status
      CHECK (status IN ('active','inactive'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_attendance_status'
  ) THEN
    ALTER TABLE employee_attendance
      ADD CONSTRAINT chk_attendance_status
      CHECK (status IN ('present','absent','half-day','leave'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_emp_purchases_category'
  ) THEN
    ALTER TABLE employee_purchases
      ADD CONSTRAINT chk_emp_purchases_category
      CHECK (category IN ('shop-purchase','advance','reimbursement'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'chk_emp_purchases_payment_mode'
  ) THEN
    ALTER TABLE employee_purchases
      ADD CONSTRAINT chk_emp_purchases_payment_mode
      CHECK (payment_mode IN ('cash','card','online','salary-deduction'));
  END IF;
END $$;

-- 5) Triggers (idempotent)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_employees_updated
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON employee_attendance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_emp_purchases_updated
  BEFORE UPDATE ON employee_purchases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;

-- Staff Management Schema
-- Safe to run in pgAdmin on existing DB

BEGIN;

-- 1) Employees master
CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT NOT NULL DEFAULT 'staff', -- e.g., 'staff', 'manager', 'admin'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'inactive'
  date_joined DATE,
  date_left DATE,
  salary NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_role ON employees(role);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_name_trgm ON employees USING gin (full_name gin_trgm_ops);

-- 2) Attendance per employee per day
CREATE TABLE IF NOT EXISTS employee_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL, -- 'present', 'absent', 'half-day', 'leave'
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  notes TEXT,
  created_by UUID, -- user id who recorded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON employee_attendance(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON employee_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON employee_attendance(status);

-- 3) Employee purchases (salary advances, shop purchases, reimbursements)
CREATE TABLE IF NOT EXISTS employee_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  purchase_date DATE NOT NULL,
  category TEXT NOT NULL, -- 'shop-purchase', 'advance', 'reimbursement'
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_mode TEXT NOT NULL DEFAULT 'cash', -- 'cash', 'card', 'online', 'salary-deduction'
  description TEXT,
  recorded_by UUID, -- user id who recorded
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_emp_purchases_employee_date ON employee_purchases(employee_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_emp_purchases_category ON employee_purchases(category);
CREATE INDEX IF NOT EXISTS idx_emp_purchases_payment_mode ON employee_purchases(payment_mode);

-- 4) Helpers: enum-like constraints via check constraints
ALTER TABLE employees
  ADD CONSTRAINT chk_employees_role
  CHECK (role IN ('staff','manager','admin'));

ALTER TABLE employees
  ADD CONSTRAINT chk_employees_status
  CHECK (status IN ('active','inactive'));

ALTER TABLE employee_attendance
  ADD CONSTRAINT chk_attendance_status
  CHECK (status IN ('present','absent','half-day','leave'));

ALTER TABLE employee_purchases
  ADD CONSTRAINT chk_emp_purchases_category
  CHECK (category IN ('shop-purchase','advance','reimbursement'));

ALTER TABLE employee_purchases
  ADD CONSTRAINT chk_emp_purchases_payment_mode
  CHECK (payment_mode IN ('cash','card','online','salary-deduction'));

-- 5) Triggers to keep updated_at fresh
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

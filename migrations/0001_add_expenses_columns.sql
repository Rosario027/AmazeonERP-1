-- Add created_by and deleted_at to expenses so server insert/update works
ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS created_by varchar;

ALTER TABLE IF EXISTS expenses
  ADD COLUMN IF NOT EXISTS deleted_at timestamp;

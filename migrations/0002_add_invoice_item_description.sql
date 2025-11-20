-- Add description column to invoice_items for product descriptions
ALTER TABLE IF EXISTS invoice_items
  ADD COLUMN IF NOT EXISTS description text;

-- ============================================
-- CUSTOMERS SCHEMA SETUP FOR PGADMIN
-- Run this script to create the customers table
-- and add customer tracking to invoices
-- ============================================

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    customer_code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE(name, phone)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);

-- Add customer_id column to invoices table (if not exists)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(id);

-- Create index on invoices for customer lookups
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id);

-- ============================================
-- SYNC EXISTING INVOICES WITH CUSTOMERS
-- This creates customers from existing invoice data
-- ============================================

-- Step 1: Insert unique customers from existing invoices (where phone exists)
INSERT INTO customers (customer_code, name, phone, created_at)
SELECT 
    'CUST-' || LPAD(ROW_NUMBER() OVER (ORDER BY MIN(created_at))::TEXT, 4, '0') as customer_code,
    customer_name as name,
    customer_phone as phone,
    MIN(created_at) as created_at
FROM invoices
WHERE customer_phone IS NOT NULL 
  AND customer_phone != ''
  AND deleted_at IS NULL
GROUP BY customer_name, customer_phone
ON CONFLICT (name, phone) DO NOTHING;

-- Step 2: Link existing invoices to their customers
UPDATE invoices i
SET customer_id = c.id
FROM customers c
WHERE i.customer_name = c.name 
  AND i.customer_phone = c.phone
  AND i.customer_id IS NULL;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Show customer count
SELECT 'Total Customers Created' as metric, COUNT(*) as value FROM customers;

-- Show linked invoices
SELECT 'Invoices Linked to Customers' as metric, COUNT(*) as value FROM invoices WHERE customer_id IS NOT NULL;

-- Show unlinked invoices (no phone number)
SELECT 'Invoices Without Customer Link' as metric, COUNT(*) as value FROM invoices WHERE customer_id IS NULL AND deleted_at IS NULL;

-- Show top 10 customers by purchase count
SELECT 
    c.customer_code,
    c.name,
    c.phone,
    COUNT(i.id) as purchase_count,
    COALESCE(SUM(CAST(i.grand_total AS NUMERIC)), 0) as total_spent
FROM customers c
LEFT JOIN invoices i ON c.id = i.customer_id AND i.deleted_at IS NULL
GROUP BY c.id, c.customer_code, c.name, c.phone
ORDER BY purchase_count DESC
LIMIT 10;

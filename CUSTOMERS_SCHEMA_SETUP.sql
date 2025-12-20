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

-- Verify tables
SELECT 'customers table' AS table_name, COUNT(*) AS row_count FROM customers
UNION ALL
SELECT 'invoices with customer_id' AS table_name, COUNT(*) AS row_count FROM invoices WHERE customer_id IS NOT NULL;

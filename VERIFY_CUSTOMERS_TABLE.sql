-- Verify customers table exists and check its structure
SELECT 
    table_name, 
    column_name, 
    data_type, 
    is_nullable
FROM 
    information_schema.columns
WHERE 
    table_name = 'customers'
ORDER BY 
    ordinal_position;

-- Check if customers table has any data
SELECT COUNT(*) as customer_count FROM customers;

-- Show sample customers (if any exist)
SELECT id, customer_code, name, phone, created_at 
FROM customers 
ORDER BY created_at DESC 
LIMIT 10;

-- If customers table doesn't exist, create it with this SQL:
-- Uncomment and run if the table is missing:

/*
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  customer_code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS unique_customer_name_phone ON customers(name, phone);
*/

-- PostgreSQL Schema for AmazeonERP
-- Run this script in pgAdmin to set up all tables

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    token_version INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    hsn_code TEXT NOT NULL,
    category TEXT,
    rate DECIMAL(10, 2) NOT NULL,
    gst_percentage DECIMAL(5, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 0,
    comments TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    invoice_type TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_gst TEXT,
    payment_mode TEXT NOT NULL,
    gst_mode TEXT NOT NULL DEFAULT 'inclusive',
    subtotal DECIMAL(10, 2) NOT NULL,
    gst_amount DECIMAL(10, 2) NOT NULL,
    grand_total DECIMAL(10, 2) NOT NULL,
    cash_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    card_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
    is_edited BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    item_name TEXT NOT NULL,
    description TEXT,
    hsn_code TEXT NOT NULL,
    rate DECIMAL(10, 2) NOT NULL,
    quantity INTEGER NOT NULL,
    gst_percentage DECIMAL(5, 2) NOT NULL,
    gst_amount DECIMAL(10, 2) NOT NULL,
    taxable_value DECIMAL(10, 2) NOT NULL,
    cgst_percentage DECIMAL(5, 2) NOT NULL,
    cgst_amount DECIMAL(10, 2) NOT NULL,
    sgst_percentage DECIMAL(5, 2) NOT NULL,
    sgst_amount DECIMAL(10, 2) NOT NULL,
    total DECIMAL(10, 2) NOT NULL
);

-- Expenses Table
CREATE TABLE IF NOT EXISTS expenses (
    id SERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT,
    created_by VARCHAR(255),
    deleted_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Cash Balances Table
CREATE TABLE IF NOT EXISTS cash_balances (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    date TIMESTAMP NOT NULL,
    opening DECIMAL(12, 2) NOT NULL,
    cash_total DECIMAL(12, 2) NOT NULL,
    card_total DECIMAL(12, 2) NOT NULL,
    closing DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create unique index for cash_balances
CREATE UNIQUE INDEX IF NOT EXISTS cash_balances_user_date_idx ON cash_balances(user_id, date);

-- Cash Withdrawals Table
CREATE TABLE IF NOT EXISTS cash_withdrawals (
    id SERIAL PRIMARY KEY,
    admin_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_code TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'staff',
    status TEXT NOT NULL DEFAULT 'active',
    date_joined DATE,
    date_left DATE,
    salary NUMERIC(12, 2),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Employee Attendance Table
CREATE TABLE IF NOT EXISTS employee_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    attendance_date DATE NOT NULL,
    status TEXT NOT NULL,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    created_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create unique index for employee_attendance
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_employee_date ON employee_attendance(employee_id, attendance_date);

-- Employee Purchases Table
CREATE TABLE IF NOT EXISTS employee_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    purchase_date DATE NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'cash',
    description TEXT,
    recorded_by UUID,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name);
CREATE INDEX IF NOT EXISTS idx_products_deleted_at ON products(deleted_at);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_cash_balances_user_id ON cash_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);

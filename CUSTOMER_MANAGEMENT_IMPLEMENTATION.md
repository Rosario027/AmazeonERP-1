# Customer Management System Implementation

## Overview
This document describes the implementation of a comprehensive Customer Management System in the Admin Panel.

## Core Features Implemented

### 1. Customer Identity & Uniqueness
- **Unique Customer Definition**: Customers are uniquely identified by the combination of `Name + Phone Number`
- **Automatic Customer Codes**: Each unique customer receives an auto-generated code (e.g., `CUST-1`, `CUST-2`)
- **Duplicate Handling**: If a name and phone combination already exists, invoices are attributed to the existing customer record
- **Database Constraint**: Composite unique index on `(name, phone)` ensures data integrity

### 2. Database Schema

#### New Table: `customers`
```sql
CREATE TABLE customers (
  id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  customer_code text UNIQUE NOT NULL,
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX unique_customer_name_phone ON customers(name, phone);
```

#### Updated Table: `invoices`
- Added `customer_id` column (foreign key to `customers.id`)
- Automatic linking when invoices are created with phone numbers

### 3. Backend API Endpoints

All endpoints are admin-only (`/api/customers/*`):

- `GET /api/customers` - List all customers with stats (total orders, total spend)
- `GET /api/customers/stats?startDate=&endDate=` - Dashboard KPIs
  - Total new customers in period
  - Top 3 invoices from last 30 days
- `GET /api/customers/:id` - Get customer details
- `GET /api/customers/:id/invoices` - Get customer purchase history

### 4. Frontend Features

#### Dashboard Section (Top)
- **Time Period Selector**: Today, This Week, This Month
- **Total New Customers KPI**: Dynamically updates based on selected period
- **Top 3 Invoices**: Displays highest-value invoices from last 30 days
  - Clickable links that open invoice detail view in new tab
  - Shows invoice number, customer name, and amount

#### Customer Directory (Middle)
- **Search Bar**: Filter by name, phone, or customer code
- **Table Columns**:
  - Customer Code
  - Name
  - Phone Number
  - Total Orders
  - Total Spend
  - View Details button

#### Customer Detail View (Modal)
- **Summary Information**:
  - Customer Code
  - Name
  - Phone Number
  - Total Lifetime Purchase Value (prominent display)
- **Purchase History Table**:
  - Invoice Number
  - Date
  - Amount
  - View Invoice button (opens invoice in new tab)

### 5. Integration with Existing Invoice System

When creating or updating invoices:
1. If a phone number is provided, the system automatically:
   - Searches for an existing customer with matching name + phone
   - If found: Links the invoice to that customer
   - If not found: Creates a new customer record with auto-generated code
2. Invoice creation now populates the `customer_id` field
3. Historical invoices can be linked by running a backfill script

### 6. Navigation

- Added "Customers" menu item to Admin sidebar (with UserCheck icon)
- Route: `/admin/customers`
- Admin-only access enforced

## Technical Implementation Details

### Backend (`server/`)

**storage.ts** - New methods:
- `getOrCreateCustomer(name, phone)` - Find or create customer record
- `getCustomers()` - Get all customers with aggregated stats
- `getCustomer(id)` - Get single customer
- `getCustomerStats(filters)` - Get dashboard KPIs
- `getCustomerInvoices(customerId)` - Get customer's invoices

**routes.ts** - New endpoints:
- Customer CRUD routes with admin middleware

**index.ts** - Schema initialization:
- `ensureCustomersSchema()` - Creates customers table and indexes
- Adds `customer_id` column to invoices table

### Frontend (`client/src/`)

**pages/admin-customers.tsx** - New page:
- Dashboard with time period selector
- Customer directory with search
- Modal for customer details
- Uses React Query for data fetching
- Responsive design with Tailwind CSS

**App.tsx** - Added route:
- `/admin/customers` → AdminCustomers component

**components/app-sidebar.tsx** - Added navigation:
- "Customers" menu item for admin users

### Schema Updates (`shared/schema.ts`)

- New `customers` table definition
- Updated `invoices` table with `customer_id`
- Relations defined between customers and invoices
- New types: `Customer`, `InsertCustomer`, `CustomerWithStats`

## Data Flow

1. **Invoice Creation**:
   ```
   User creates invoice with name + phone
   → Backend calls getOrCreateCustomer()
   → Returns existing or new customer record
   → Invoice saved with customer_id
   ```

2. **Customer List View**:
   ```
   Admin opens /admin/customers
   → Frontend fetches /api/customers
   → Backend joins customers with invoices
   → Calculates totalOrders and totalSpend
   → Returns aggregated data
   ```

3. **Dashboard Stats**:
   ```
   Admin selects time period
   → Frontend fetches /api/customers/stats with dates
   → Backend counts new customers in period
   → Backend gets top 3 invoices from last 30 days
   → Returns stats object
   ```

## Future Enhancements

Potential improvements for future iterations:

1. **Customer Profiles**:
   - Add address, email, GST number to customer records
   - Customer notes/comments

2. **Analytics**:
   - Customer lifetime value trends
   - Purchase frequency analysis
   - Customer segmentation (VIP, regular, one-time)

3. **Export**:
   - Export customer list to Excel
   - Export customer purchase history

4. **Search Enhancement**:
   - Advanced filters (date range, spend range)
   - Sort by different criteria

5. **Customer Loyalty**:
   - Track customer loyalty points
   - Discount programs

## Testing Recommendations

1. Test customer creation with same name, different phone
2. Test customer creation with different name, same phone
3. Test customer creation with same name + phone (should link to existing)
4. Verify dashboard KPIs update correctly with time period changes
5. Test search functionality with partial matches
6. Verify invoice links open correctly
7. Test with no customers/invoices (empty states)

## Deployment Notes

The system uses idempotent schema updates that run on server startup:
- Creates customers table if not exists
- Adds customer_id column to invoices if not exists
- Creates indexes if not exist

No manual migration needed - the server will update the schema automatically.

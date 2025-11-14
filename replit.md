# Amazeon ERP - Enterprise Resource Planning System

## Overview

Amazeon ERP is a comprehensive enterprise resource planning system designed for managing invoices, inventory, expenses, and business analytics. The application provides separate interfaces for regular users (invoice creation and sales overview) and administrators (full system management including inventory, B2B invoicing, and advanced analytics).

The system handles both B2C (Business to Consumer) and B2B (Business to Business) invoice workflows, with automatic GST calculation, product management, and detailed reporting capabilities.

## Recent Changes (November 2025)

### User Management & Navigation Improvements (Latest)
- **Enhanced User Management in Settings Page**:
  - Full edit functionality: Modify username and role for existing users
  - Partial update support: Can update username or role independently
  - Validation: Username trimmed, empty/whitespace usernames rejected
  - Backend: PATCH `/api/users/:id` with Zod validation and partial updates
- **Post-Print Navigation Fix**:
  - After printing invoice, automatically navigate to blank new invoice screen
  - Timestamp-based reset logic prevents multiple print issues
  - Works for both B2C and B2B invoice types
  - No state loss or race conditions
- **Auto-Logout Bug Fixed**:
  - Print route moved inside authenticated section in App.tsx
  - User role no longer logged out when accessing print page
  - Auth context maintained throughout print workflow
- **Shop Name Updated**:
  - Changed from "AMAZEON" to "AMAZEON SHOPPING" in print templates
  - Updated in shared/shopInfo.ts

### Settings Page Implementation
- Added admin-only Settings page at `/admin/settings`
- User management: Add, edit, delete users with role assignment (admin/user)
- Password reset functionality for existing users
- Invoice series configuration: Set starting number for FY-based invoices
- Preview next invoice number before creating invoices

### Financial Year-Based Invoice Numbering
- Implemented Indian Financial Year (FY) invoice numbering system
- Format: `FY25-26/XXX` (e.g., FY25-26/001, FY25-26/002)
- Financial Year cycle: April 1 - March 31
- Automatic FY detection and annual reset on April 1st
- Configurable starting number via Settings page
- Backend API: `/api/invoices/next-number` returns formatted invoice number

### Customer Phone Field Removal
- Made `customerPhone` optional/nullable in database schema
- Removed customer phone field from all invoice creation forms (B2C and B2B)
- Updated storage layer to normalize undefined values to null
- Backend routes handle optional customerPhone with null coalescing
- Print invoice template no longer displays customer phone

### Shop Information Updates
- Updated business address: "Number 2, 3rd street, bharathy nagar Ganpathy coimbatore -641006"
- Single phone number: 9791599979
- Removed email field from shop info and print templates
- Simplified shop info structure: name, address, phone, gstNumber

### GST Calculation Settings (November 2025)
- **Configurable GST Modes**: Admin can configure GST calculation mode (inclusive/exclusive) separately for Cash and Online payment types
- **Settings Page UI**: Added "GST Calculation Settings" section with dropdowns for cash_gst_mode and online_gst_mode
- **Mode Persistence**: Each invoice stores its gstMode at creation to ensure historical data integrity
- **Protection Mechanisms**:
  - Payment mode locked once items are added to prevent recalculation issues
  - No automatic recalculation when GST settings change
  - Edit mode uses stored gstMode, not current global settings
- **Database Schema**: Added `gst_mode` column to `invoices` table (default: 'inclusive')
- **Implementation Status**:
  ✅ Schema updated with gstMode field
  ✅ Backend saves and preserves gstMode correctly
  ✅ Frontend sends gstMode based on payment type
  ✅ Edit mode uses stored gstMode for new items
  ✅ No recalculation effect (items calculated once)
  ⚠️ Existing 20 invoices backfilled with default 'inclusive' (may not match actual mode used)
- **Technical Details**:
  - Drizzle ORM fix: Explicitly include gstMode in insert to override schema default
  - Update operations preserve original gstMode (no modification allowed)
  - Cash mode defaults to inclusive, Online mode defaults to exclusive

### Database Schema Updates
- Added `settings` table for key-value configuration storage
- Modified `invoices.customerPhone` to nullable text column
- Added `invoices.gstMode` text column with default 'inclusive'
- All changes applied via Drizzle schema push

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, built using Vite as the build tool and development server.

**UI Component Library**: Shadcn UI (New York style variant) with Radix UI primitives for accessible, composable components.

**Design System**: Material Design 3 adapted for enterprise applications, prioritizing data clarity and efficient workflows. Uses Inter font family and follows a data-first hierarchy approach.

**Styling**: Tailwind CSS with custom configuration for enterprise ERP theming. Implements both light and dark mode support via theme context.

**State Management**: 
- React Context for authentication (user state, login/logout) and theme management
- TanStack Query (React Query) for server state management and API data fetching
- Local component state for form handling and UI interactions

**Routing**: Wouter for lightweight client-side routing with role-based access control (separate routes for admin and regular users).

**Form Handling**: React Hook Form with Zod validation via @hookform/resolvers for type-safe form validation.

### Backend Architecture

**Runtime**: Node.js with Express.js framework for RESTful API endpoints.

**Language**: TypeScript with ES modules (type: "module" in package.json).

**Authentication**: JWT-based authentication with bcrypt for password hashing. Implements middleware for route protection and role-based access control (admin vs user roles).

**API Design**: RESTful endpoints organized by domain:
- `/api/auth/*` - Authentication endpoints
- `/api/products/*` - Product/inventory management
- `/api/invoices/*` - Invoice CRUD operations
- `/api/expenses/*` - Expense tracking
- `/api/admin/*` - Admin-only analytics and reports

**Architecture Pattern**: Repository pattern with storage abstraction layer (`server/storage.ts`) separating business logic from data access.

### Data Storage

**Database**: PostgreSQL via Neon serverless database with WebSocket connections.

**ORM**: Drizzle ORM for type-safe database operations and schema management.

**Schema Design**:
- **users**: Authentication and role management (admin/user roles)
- **products**: Inventory items with name, category, rate, and GST percentage
- **invoices**: Invoice headers with customer details, totals, and metadata
- **invoice_items**: Line items linked to invoices with product references
- **expenses**: Business expense tracking with categories and amounts

**Migrations**: Drizzle Kit handles schema migrations with output to `/migrations` directory.

**Relationships**: One-to-many relationship between invoices and invoice_items with cascade deletion.

### Authentication & Authorization

**Strategy**: JWT tokens stored in localStorage with Bearer token authentication.

**Token Management**: 7-day expiration on JWT tokens, generated on login and verified via middleware.

**Access Control**:
- Public routes: Login page only
- Protected routes: All application pages require authentication
- Admin-only routes: Dashboard, inventory management, B2B invoicing, and sales reports

**Session Storage**: User data and auth tokens persisted in localStorage for session management.

### External Dependencies

**UI Framework Dependencies**:
- @radix-ui/* (multiple packages) - Headless UI primitives for accessible components
- class-variance-authority - Component variant management
- tailwindcss - Utility-first CSS framework
- lucide-react - Icon library

**Backend Dependencies**:
- @neondatabase/serverless - Neon PostgreSQL serverless driver with WebSocket support
- drizzle-orm - Type-safe ORM
- jsonwebtoken - JWT token generation and verification
- bcryptjs - Password hashing
- zod - Runtime type validation

**Development Tools**:
- tsx - TypeScript execution for development
- esbuild - Server bundling for production
- vite - Frontend build tool and dev server
- @replit/vite-plugin-* - Replit-specific development plugins

**Data Management**:
- @tanstack/react-query - Async state management
- date-fns - Date formatting and manipulation

**Styling**:
- tailwind-merge & clsx - Conditional class merging utilities
- autoprefixer & postcss - CSS processing
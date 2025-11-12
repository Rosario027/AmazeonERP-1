# Amazeon ERP - Enterprise Resource Planning System

## Overview

Amazeon ERP is a comprehensive enterprise resource planning system designed for managing invoices, inventory, expenses, and business analytics. The application provides separate interfaces for regular users (invoice creation and sales overview) and administrators (full system management including inventory, B2B invoicing, and advanced analytics).

The system handles both B2C (Business to Consumer) and B2B (Business to Business) invoice workflows, with automatic GST calculation, product management, and detailed reporting capabilities.

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
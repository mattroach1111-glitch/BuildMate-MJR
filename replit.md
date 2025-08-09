# Overview

BuildFlow Pro is a construction management system designed to streamline job costing, billing, and workforce management. The application provides role-based access for administrators and staff members, with admins managing job details and financials while staff handle timesheet entries. The system tracks labor costs, materials, sub-trades, and project expenses to provide comprehensive construction project oversight.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Routing**: Wouter for client-side routing
- **Forms**: React Hook Form with Zod validation

The frontend follows a component-based architecture with reusable UI components stored in `/client/src/components/ui/`. The application uses a role-based routing system that redirects users to appropriate dashboards based on their role (admin or staff).

## Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Authentication**: Replit Authentication with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage

The backend implements a RESTful API structure with role-based access control. Routes are organized by functionality (jobs, labor entries, materials, sub-trades, timesheets) with middleware for authentication and authorization.

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Centralized in `/shared/schema.ts` for type sharing between frontend and backend
- **Tables**: Users, jobs, labor entries, materials, sub-trades, timesheet entries, and sessions
- **Relationships**: Foreign key relationships between jobs and their associated entries

The database schema supports multi-tenant job management with comprehensive cost tracking including labor hours, material costs, sub-contractor expenses, and administrative fees.

## Authentication & Authorization
- **Provider**: Replit Authentication using OpenID Connect
- **Role System**: Two-tier access (admin/staff) with route-level protection
- **Session Storage**: PostgreSQL-backed sessions with configurable TTL
- **Security**: HTTP-only cookies with secure flags for production

## State Management
- **Client State**: React hooks and component state for UI interactions
- **Server State**: TanStack Query for caching, synchronization, and optimistic updates
- **Form State**: React Hook Form for complex form handling with validation

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL provider for data persistence
- **Connection Pool**: @neondatabase/serverless for efficient database connections

## Authentication Services
- **Replit Auth**: Integrated OpenID Connect authentication system
- **Session Store**: connect-pg-simple for PostgreSQL session management

## UI Framework
- **Radix UI**: Headless component library for accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Fast build tool with HMR and TypeScript support
- **Drizzle Kit**: Database migration and schema management
- **Zod**: Schema validation for runtime type checking

## PDF Generation
- **jsPDF**: Client-side PDF generation for job sheets and reports

## Utilities
- **date-fns**: Date manipulation and formatting
- **clsx**: Conditional CSS class composition
- **memoizee**: Function memoization for performance optimization
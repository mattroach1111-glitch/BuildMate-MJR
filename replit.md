# Overview

BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. It provides role-based access for administrators and staff, enabling comprehensive tracking of labor costs, materials, sub-trades, and project expenses for construction project oversight. The system's vision is to enhance efficiency in construction project management, offering a user-friendly interface for both on-site staff and administrative personnel, and consolidating critical project data for better decision-making.

## Recent Changes
- **August 11, 2025**: Set staff default route to use the same FortnightTimesheetView component as the timesheet tab. Staff users now get the complete timesheet interface as their main page, matching the user's preferred view exactly.
- **August 11, 2025**: Enhanced staff management system with comprehensive role assignment and user-employee mapping. Admins can now assign staff/admin roles, link user accounts to employee records for proper timesheet tracking, and view assignment status with visual badges. Added database reset functionality for testing purposes.
- **August 11, 2025**: Implemented smart timesheet prompting system that guides users through fortnight completion. Features include progress tracking (10 workdays), milestone celebrations, submission guidance when complete, and visual progress indicators. Enhanced success messages provide contextual feedback based on completion status.
- **August 11, 2025**: Fixed critical timesheet-to-job sheet synchronization issue affecting labor hour calculations. Resolved database field mapping problem in `updateLaborHoursFromTimesheet` function that prevented approved timesheet entries from properly updating labor costs in job sheets. System now correctly reflects staff hours across all job cost reports and billing documents.
- **August 11, 2025**: Enhanced timesheet PDF generation to show actual detailed entries instead of empty templates. Updated `getTimesheetEntriesByPeriod` to include job information via left join, modified PDF generator to filter out zero-hour entries, and improved job detail display format. Cleared all test data (57 timesheet entries, reset 98 labor entries) to provide clean testing environment.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite)
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Design Philosophy**: Component-based architecture with reusable UI components and role-based routing. Modern UI/UX redesign focusing on mobile responsiveness, touch-friendly controls, and enhanced navigation. Features include a dedicated "Ready for Billing" folder, collapsible sections, smart job sorting, and adaptable grid/list views. Vibrant, customizable folder colors are used for visual organization.
- **Key Features**: Mobile-first redesign, comprehensive job management (creation, editing, soft delete), integrated Australian GST, automated staff assignment to jobs, independent job sheet rates, folder grouping (client/project manager) with auto-expansion, real-time search, status-based job ordering, and admin staff view access.
- **Timesheet System**: Mobile-first redesign supporting multiple job entries per day, auto-saving with debounce, fortnight periods, quick stats cards, and admin capabilities for entry creation and approval. Includes support for RDO, sick leave, personal leave, and annual leave. Individual timesheet entry clearing is supported.
- **Onboarding**: Animated welcome screen and interactive guided tours (role-specific).

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Authentication with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Design Philosophy**: RESTful API structure with role-based access control.

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Centralized in `/shared/schema.ts` for type sharing.
- **Tables**: Users, jobs, labor entries, materials, sub-trades, timesheet entries, and sessions.
- **Relationships**: Comprehensive foreign key relationships for multi-tenant job management and cost tracking.

## Authentication & Authorization
- **Provider**: Replit Authentication (OpenID Connect)
- **Role System**: Two-tier (admin/staff) with route-level protection.
- **Session Storage**: PostgreSQL-backed sessions.
- **Security**: HTTP-only cookies with secure flags.
- **User Management**: Admins can promote staff to admin status. Automatic user account creation for employees and cascade cleanup on employee deletion.

## State Management
- **Client State**: React hooks and component state.
- **Server State**: TanStack Query for caching, synchronization, and optimistic updates.
- **Form State**: React Hook Form for validation.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL provider.
- **@neondatabase/serverless**: For efficient database connections.

## Authentication Services
- **Replit Auth**: OpenID Connect authentication.
- **connect-pg-simple**: PostgreSQL session management.

## UI Framework
- **Radix UI**: Headless component library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Lucide React**: Icon library.

## Development Tools
- **Vite**: Build tool.
- **Drizzle Kit**: Database migration and schema management.
- **Zod**: Schema validation.

## PDF Generation
- **jsPDF**: Client-side PDF generation.

## Cloud Integrations
- **Google Drive Integration**: OAuth flow for personal Google Drive connections, allowing timesheet PDFs to auto-save.
- **Object Storage**: Replit Object Storage integration for job document management with upload, download, and delete capabilities.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
- **memoizee**: Function memoization.
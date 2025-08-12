# Overview

BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. It provides role-based access for administrators and staff, enabling comprehensive tracking of labor costs, materials, sub-trades, and project expenses for construction project oversight. The system's vision is to enhance efficiency in construction project management, offering a user-friendly interface for both on-site staff and administrative personnel, and consolidating critical project data for better decision-making.

## Recent Changes
- **August 12, 2025**: RESOLVED SAVE ALL WORKFLOW - Fixed critical issue where "Save All" button was automatically sending timesheet entries to pending approvals, bypassing the intended draft/submit workflow. Implemented proper separation by adding `submitted` field to timesheet schema. Save All now creates draft entries (`submitted: false`) that don't appear in admin pending approvals, while Submit Timesheet properly marks entries as submitted (`submitted: true`) for admin review. This restores the intended two-step workflow: Save All for drafts, Submit Timesheet for final approval submission.
- **August 12, 2025**: RESOLVED DUPLICATE ENTRIES - Fixed critical issue where "Save All" button was creating duplicate timesheet entries. Modified `saveAllEntries` function to properly distinguish between existing entries (use PATCH to update) vs new entries (use POST to create). System now checks for existing entries by matching date/job/materials and updates them appropriately. Prevents approved entries from being modified to maintain data integrity.
- **August 12, 2025**: FEATURE COMPLETE - Successfully implemented professional low hours warning dialog for Fortnight Timesheet submission. Resolved React state management issues by implementing DOM-based dialog approach that bypasses component re-rendering conflicts. Features elegant orange theme, clock icon, prominent hours display (74.00), clear warning messaging about 76-hour expectation, and functional "Cancel"/"Submit Anyway" buttons. Dialog appears consistently when total hours < 76 and allows users to confirm or cancel timesheet submission.
- **August 11, 2025**: ENHANCEMENT - Upgraded low hours warning to professional AlertDialog component. Replaced basic browser alert with modern UI featuring orange warning theme, clock icon, highlighted hours display, clear messaging about 76-hour expectation, and styled "Cancel"/"Submit Anyway" buttons with proper state management.
- **August 11, 2025**: FEATURE - Added enhanced leave type validation requiring hours > 0 for sick leave, annual leave, personal leave, and Tafe entries. System prevents saving these leave types with zero hours and shows clear error messages.
- **August 11, 2025**: FEATURE - Added low hours warning prompt when submitting timesheets. If total hours < 76, users see confirmation dialog asking "Hours are below 76. Are you sure you're ready for submitting?" with current total displayed.
- **August 11, 2025**: FEATURE - Reorganized job dropdown structure moving all leave types (RDO, sick leave, personal leave, annual leave, leave without pay) below Tafe at the bottom of dropdowns for better organization.
- **August 11, 2025**: FEATURE - Added timesheet completion validation requiring all Monday-Friday entries to be filled before submission. System now prevents timesheet confirmation unless all weekdays have at least one entry with hours > 0. Shows clear error messages listing missing weekdays.
- **August 11, 2025**: FEATURE - Added "Tafe" as a pinned option at the bottom of timesheet job dropdowns for easy access to educational/training entries.
- **August 11, 2025**: RESOLVED - Fixed weekend timesheet multiple entry issue. Second and subsequent entries on weekend days were not saving properly due to Add Entry button being disabled for locked weekends. Added proper weekend unlock checking to allow multiple entries on unlocked weekend days. Multiple weekend entries now save successfully with proper weekend confirmation flags.
- **August 11, 2025**: RESOLVED - Fixed custom address display bug in admin dashboard. Custom addresses were showing as generic "Custom Address" text instead of actual entered addresses. Root cause was in the "Save All" processing logic that defaulted to fallback text when materials field was empty. Fixed address extraction logic to properly get address data from both materials and description fields. Custom addresses now correctly display the actual entered address (e.g., "123 Main Street") in admin pending approvals.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite)
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query (React Query) for server state; React hooks and component state for client state; React Hook Form for form state.
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Design Philosophy**: Component-based architecture with reusable UI components and role-based routing. Modern UI/UX redesign focusing on mobile responsiveness, touch-friendly controls, and enhanced navigation. Features include a dedicated "Ready for Billing" folder, collapsible sections, smart job sorting, and adaptable grid/list views. Vibrant, customizable folder colors are used for visual organization.
- **Key Features**: Mobile-first redesign, comprehensive job management (creation, editing, soft delete), integrated Australian GST, automated staff assignment to jobs, independent job sheet rates, folder grouping (client/project manager) with auto-expansion, real-time search, status-based job ordering, and admin staff view access.
- **Timesheet System**: Mobile-first redesign supporting multiple job entries per day, auto-saving with debounce, fortnight periods, quick stats cards, and admin capabilities for entry creation and approval. Includes support for RDO, sick leave, personal leave, and annual leave. Individual timesheet entry clearing is supported. Supports custom address entry with persistence, weekend work protection with unlock functionality, and robust validation. Includes fuzzy job matching for timesheet entries.
- **Onboarding**: Animated welcome screen and interactive guided tours (role-specific).
- **Admin Features**: Compressed navigation menu, comprehensive timesheet search with advanced filtering (employee name, job, client, date, approval status, hours), employee folder organization for approved timesheets, and admin edit functionality for custom addresses.

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
- **User Management**: Admins can assign staff/admin roles, link user accounts to employee records, and view assignment status. Automatic user account creation for employees and cascade cleanup on employee deletion.

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
- **fuzzball**: For fuzzy string matching.

## PDF Generation
- **jsPDF**: Client-side PDF generation.

## Cloud Integrations
- **Google Drive Integration**: OAuth flow for personal Google Drive connections, allowing timesheet PDFs to auto-save upon admin approval.
- **Replit Object Storage**: For job document management with upload, download, and delete capabilities.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
- **memoizee**: Function memoization.
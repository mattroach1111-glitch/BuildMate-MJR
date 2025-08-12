# Overview

BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. It provides role-based access for administrators and staff, enabling comprehensive tracking of labor costs, materials, sub-trades, and project expenses for construction project oversight. The system's vision is to enhance efficiency in construction project management, offering a user-friendly interface for both on-site staff and administrative personnel, and consolidating critical project data for better decision-making.

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

## Feature Specifications
- **Tip Fees**: Comprehensive system with automatic 20% cartage calculation, database schema with relations, backend API for CRUD, frontend UI with inline editing, display of base amount + cartage fees, integration with job totals and billing.
- **Inline Editing**: For job sheet items (materials, sub-trades, other costs) with edit/delete buttons, inline forms, save/cancel options, confirmation dialogs, and automatic data refresh.
- **AI Document Processing**: AI-powered expense extraction for all document types (PDF, JPG, PNG) including drag-and-drop upload, intelligent categorization, vendor/amount extraction, automatic PDF-to-image conversion, and integration with Anthropic AI.
- **Permanent Delete Functionality**: Two-tier job deletion (soft delete to folder, then permanent delete) with API endpoint, confirmation dialogs, and complete removal of all associated data.
- **Client-Filtered Email Updates**: Granular client filtering for job updates, updated email subjects with client names, visual filtering badges, and empty state handling.
- **Project Manager Filtered Emails**: Email filtering by project manager, inclusion of PM name in email subjects, and visual badges.
- **Multiple Email Recipient Support**: For job updates with comma-separated addresses, smart email suggestions, "Add All Recent Emails" option, and localStorage persistence for suggestions.
- **Job Update Email System**: Fully operational using Onlydomains.com Titan email service, SMTP authentication, and "Send Job Updates" button in admin dashboard.
- **Timesheet Workflow**: Separation of draft (`Save All`) and submitted (`Submit Timesheet`) entries to prevent premature approval.
- **Timesheet Duplicates**: Prevention of duplicate timesheet entries by distinguishing between existing (PATCH) and new (POST) entries.
- **Low Hours Warning**: Professional dialog for timesheet submission if total hours < 76, with orange theme, clock icon, and 'Cancel'/'Submit Anyway' buttons.
- **Leave Type Validation**: Requires hours > 0 for sick leave, annual leave, personal leave, and Tafe entries.
- **Timesheet Completion Validation**: Requires all Monday-Friday entries to be filled before submission.
- **Weekend Timesheet Entries**: Allows multiple entries on unlocked weekend days.
- **Custom Address Display**: Correct display of custom addresses in admin dashboard.

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
- **pdf2pic**: PDF-to-image conversion.
- **ImageMagick**: Image processing for PDF conversion.
- **Ghostscript**: PDF conversion (used by pdf2pic).

## Cloud Integrations
- **Google Drive Integration**: OAuth flow for personal Google Drive connections.
- **Replit Object Storage**: For job document management.
- **Anthropic AI**: For AI-powered document processing.
- **Uppy**: Document upload library.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
- **memoizee**: Function memoization.
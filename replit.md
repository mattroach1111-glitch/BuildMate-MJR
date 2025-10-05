# Overview
BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. It offers role-based access for administrators and staff, enabling comprehensive tracking of labor costs, materials, sub-trades, and project expenses. The system aims to enhance efficiency in construction project management, providing a user-friendly interface for both on-site and administrative personnel, and consolidating critical project data for improved decision-making.

# User Preferences
Preferred communication style: Simple, everyday language.
Data backup strategy: Comprehensive multi-location backup approach with automated scripts for database exports, source code versioning, and file storage redundancy to protect against platform failures.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript (Vite)
- **UI Library**: Radix UI components with shadcn/ui styling
- **Styling**: Tailwind CSS with CSS variables
- **State Management**: TanStack Query for server state; React hooks for client state; React Hook Form for form state.
- **Routing**: Wouter
- **Forms**: React Hook Form with Zod validation
- **Design Philosophy**: Component-based, mobile-first design with a focus on intuitive UI/UX, role-based routing, and touch-friendly controls. Features include dynamic job sorting, adaptable grid/list views, and customizable folder colors for visual organization.
- **Key Features**: Comprehensive job management (creation, editing, soft delete), integrated Australian GST, automated staff assignment, independent job sheet rates, folder grouping, real-time search, status-based job ordering, admin staff view, interactive job progress visualization, file attachment system, and database-backed staff notes.
- **Timesheet System**: Mobile-first design supporting multiple job entries, fortnight periods, quick stats, admin creation/approval, RDO/leave support, custom address entry, weekend work protection, and fuzzy job matching.
- **Admin Features**: Compressed navigation, advanced timesheet search, employee folder organization for approved timesheets, and admin editing for custom addresses.
- **Rewards System**: Simplified 4-tier system (Daily, Weekly, Fortnightly, Monthly) with dynamic rules and streak reset logic.

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Authentication with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Design Philosophy**: RESTful API with role-based access control.

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect
- **Schema**: Centralized in `/shared/schema.ts`.
- **Tables**: Users, jobs, labor entries, materials, sub-trades, timesheet entries, sessions, staff members, staff notes, and system settings.
- **Relationships**: Comprehensive foreign key relationships for multi-tenant job management and cost tracking.

## Authentication & Authorization
- **Provider**: Replit Authentication (OpenID Connect)
- **Role System**: Two-tier (admin/staff) with route-level protection.
- **Session Storage**: PostgreSQL-backed sessions.
- **Security**: HTTP-only cookies with secure flags.
- **User Management**: Admins can assign roles, link user accounts to employee records, and manage assignment status. Automatic user account creation for employees.

## Feature Specifications
- **Tip Fees**: Automatic 20% cartage calculation.
- **Inline Editing**: For job sheet items with CRUD operations and confirmation dialogs.
- **AI Document Processing**: AI-powered expense extraction from various document types (PDF, JPG, PNG) with drag-and-drop upload, intelligent categorization, vendor/amount extraction, and document review system.
- **Job Creation from PDF**: Automated job creation from PDF documents with authentic data extraction for labor, materials, sub-trades, tip fees, and consumables, including fuzzy employee and client matching.
- **Permanent Delete Functionality**: Two-tier job deletion (soft delete, then permanent with API endpoint, confirmation, and full data removal).
- **Client/Project Manager Filtered Email Updates**: Granular filtering, updated email subjects, and visual filtering badges.
- **Multiple Email Recipient Support**: For job updates with comma-separated addresses, smart suggestions, and persistence.
- **Job Update Email System**: Uses Onlydomains.com Titan email service.
- **Email PDF Functionality**: Complete job sheet PDF email system with client-side PDF generation and server-side email delivery.
- **Timesheet Workflow**: Separation of draft (`Save All`) and submitted (`Submit Timesheet`) entries, preventing duplicate entries.
- **Timesheet Validation**: Low hours warning, leave type validation, completion validation for weekdays, and custom address display in admin dashboard.
- **Admin Timesheet Editing**: Administrators can edit approved timesheet entries.
- **Automatic PDF Backup**: Automated job sheet PDF generation and backup to Google Drive upon job deletion.
- **System-Wide Google Drive Integration**: Centralized Google Drive OAuth tokens for company-wide access, shared by all admins.
- **Admin Custom Address Job Assignment**: Admins can manually assign jobs to custom address timesheet entries.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL provider.

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
- **pdf2pic**: PDF-to-image conversion.

## Cloud Integrations
- **Google Drive Integration**: For company-wide Google Drive connections.
- **Replit Object Storage**: For job document management.
- **Anthropic AI**: For AI-powered document processing.
- **Uppy**: Document upload library.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
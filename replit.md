# Overview
BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. Its purpose is to enhance efficiency in construction project management by providing a user-friendly interface for both on-site staff and administrative personnel, consolidating critical project data for better decision-making, and offering role-based access for comprehensive tracking of labor, materials, sub-trades, and project expenses.

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
- **Design Philosophy**: Component-based, mobile-first redesign focusing on responsiveness, touch-friendly controls, and enhanced navigation. Features include role-based routing, a "Ready for Billing" folder, collapsible sections, smart job sorting, adaptable grid/list views, and customizable folder colors.
- **Key Features**: Comprehensive job management (creation, editing, soft delete), integrated Australian GST, automated staff assignment, independent job sheet rates, folder grouping with auto-expansion, real-time search, status-based job ordering, admin staff view access, interactive job progress visualization, file attachment system with PDF integration, and database-backed staff notes.
- **Timesheet System**: Mobile-first design supporting multiple job entries per day, fortnight periods, quick stats, and admin capabilities for entry creation, approval, and editing of approved entries. Supports RDO, sick leave, personal leave, annual leave, custom address entry, and robust validation.
- **Admin Features**: Compressed navigation menu, comprehensive timesheet search with advanced filtering, employee folder organization for approved timesheets, and admin edit functionality for custom addresses with job matching.
- **Rewards System**: Simplified 4-tier system (Daily, Weekly, Fortnightly, Monthly) with streak resets based on leave types, including a "More Apps" section and dynamic rules display based on admin configurations.
- **Notification Preferences**: User-controllable settings for Document Processing, Job Updates, and Timesheet Reminders, with options for email and in-app notifications.

## Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Replit Authentication with OpenID Connect
- **Session Management**: Express sessions with PostgreSQL storage
- **Design Philosophy**: RESTful API structure with role-based access control.

## Database Design
- **ORM**: Drizzle with PostgreSQL dialect.
- **Schema**: Centralized in `/shared/schema.ts`.
- **Tables**: Users, jobs, labor entries, materials, sub-trades, timesheet entries, sessions, staff members, staff notes, and systemSettings.
- **Relationships**: Comprehensive foreign key relationships for multi-tenant job management and cost tracking.

## Authentication & Authorization
- **Provider**: Replit Authentication (OpenID Connect).
- **Role System**: Two-tier (admin/staff) with route-level protection.
- **Session Storage**: PostgreSQL-backed sessions.
- **Security**: HTTP-only cookies with secure flags.
- **User Management**: Admins manage staff/admin roles, link user accounts to employee records, and oversee assignment status.

## Feature Specifications
- **Tip Fees**: Automatic 20% cartage calculation.
- **Inline Editing**: For job sheet items (materials, sub-trades, other costs) with full CRUD operations and confirmation dialogs.
- **AI Document Processing**: AI-powered expense extraction from various document types (PDF, JPG, PNG) with drag-and-drop upload, intelligent categorization, vendor/amount extraction, and document review system.
- **Job Creation from PDF**: Automated job creation from PDF documents with data extraction (labor, materials, sub-trades, tip fees, consumables) and fuzzy matching for employees and clients.
- **Permanent Delete Functionality**: Two-tier job deletion (soft delete then permanent delete) with API endpoint, confirmation, and automatic PDF backup to Google Drive upon permanent deletion.
- **Client/Project Manager Filtered Email Updates**: Granular filtering for job updates, dynamic email subjects, and visual filtering badges.
- **Multiple Email Recipient Support**: For job updates with comma-separated addresses, smart suggestions, and persistence.
- **Job Update Email System**: Fully operational using Onlydomains.com Titan email service.
- **Email PDF Functionality**: Complete job sheet PDF email system with dialog for recipient/subject/message, client-side PDF generation, server-side email delivery with attachment, and error handling.
- **Timesheet Workflow**: Separation of draft (`Save All`) and submitted (`Submit Timesheet`) entries, with validation for hours, leave types, and completion, and prevention of duplicate entries.

# External Dependencies

## Database Services
- **Neon Database**: Serverless PostgreSQL provider.
- **@neondatabase/serverless**: Database connection utility.

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
- **Ghostscript**: PDF conversion.

## Cloud Integrations
- **Google Drive Integration**: System-wide OAuth flow for company Google Drive connections.
- **Replit Object Storage**: For job document management.
- **Anthropic AI**: For AI-powered document processing.
- **Uppy**: Document upload library.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
- **memoizee**: Function memoization.
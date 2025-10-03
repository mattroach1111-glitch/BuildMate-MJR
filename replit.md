# Overview
BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. It provides role-based access for administrators and staff, enabling comprehensive tracking of labor costs, materials, sub-trades, and project expenses for construction project oversight. The system's vision is to enhance efficiency in construction project management, offering a user-friendly interface for both on-site staff and administrative personnel, and consolidating critical project data for better decision-making.

## Recent Updates (August 2025)
- ✅ **Staff Notes System Migration**: Successfully migrated from localStorage to persistent PostgreSQL database storage while maintaining identical UI/UX. This enables cross-device synchronization and persistent data storage for staff member management and note tracking.
- ✅ **Simplified Rewards System**: Implemented streamlined rewards system with 4 clear reward types (Daily, Weekly, Fortnightly, Monthly) and simple streak reset rules. Features functional rewards dashboard, "More Apps" section with Rewards Rules page, admin configuration with fortnightly bonus settings, and dynamic rules that automatically update when admin changes settings. Terminology aligned between timesheet selections and rewards rules.
- ✅ **Database-Backed Reward Settings**: Migrated reward configuration from memory storage to persistent PostgreSQL database. Settings now survive app deployments and restarts, with real-time synchronization between admin configuration and reward rules display. Includes proper initialization that preserves existing custom values and enhanced debugging for troubleshooting.
- ✅ **Accessibility Compliance**: Fixed all DialogDescription console warnings by adding proper descriptions to all dialog components, including email job updates dialog, job sheet modal, and employee management dialogs. Enhanced authentication cookie settings for better deployment compatibility.
- ✅ **Admin Timesheet Data Relationship Fix** (August 19, 2025): Resolved critical issue where admin timesheet viewer displayed user account names instead of employee names from staff management. Fixed data model disconnect between staff creation (employees table) and timesheet queries (users table). Updated `getStaffForTimesheets()`, `getAllTimesheetEntries()`, and admin timesheet route to properly join employee and user data, prioritizing employee names while maintaining correct foreign key relationships for timesheet queries.
- ✅ **Admin Timesheet Editing Override** (August 19, 2025): Implemented admin privilege override allowing administrators to edit approved timesheet entries. Previously, approved entries were disabled for all users including admins. Added conditional logic throughout the timesheet component to bypass approval restrictions when `isAdminView` is true, enabling admins to modify hours, job assignments, materials, and delete entries even after approval. Includes visual indicator showing admin editing capabilities.
- ✅ **Complete Auto-Save Removal** (August 19, 2025): Completely eliminated all auto-save functionality from timesheet system per user requirement. Disabled individual field mutation calls (`editTimesheetMutation`) that were causing unwanted automatic saves when users entered hours or selected jobs. All field changes now stored locally until user clicks "Save All" button. Fixed RDO (Rostered Day Off) 500 server errors by allowing nullable jobId in schema validation. Maintained job search functionality in dropdown for both admin and staff users.
- ✅ **Automatic PDF Backup on Job Deletion** (August 22, 2025): Implemented comprehensive job sheet PDF generation and automatic backup to Google Drive when jobs are permanently deleted. Features complete job data extraction including labor entries, materials, sub-trades, and other costs with total calculations. PDF includes formatted job information, cost breakdowns, and professional presentation. Automatically uploads to "BuildFlow Pro" folder in connected Google Drive accounts with organized job-specific subfolders. Provides fallback handling when Google Drive is not connected while still proceeding with deletion.
- ✅ **Hour Tracking Fix** (August 25, 2025): Resolved critical bug where manual labor hours were being erased when timesheets were approved instead of being preserved and added to timesheet hours. Implemented separate database tracking for manual hours vs timesheet hours with inline migration logic to handle existing labor entries. Fixed `updateLaborEntry()` and `updateLaborHoursFromTimesheet()` functions to preserve manual hours during all operations. Hour calculation now properly additive: total = manual + timesheet hours.
- ✅ **RDO Zero Hours Fix** (September 22, 2025): Fixed issue preventing 0-hour RDO entries in admin timesheet submissions. Updated hours input fields to use `step="0.01"` for leave types (RDO, sick leave, etc.) allowing precise zero values, while maintaining `step="0.5"` for regular work entries. Combined with previous RDO validation fixes to fully support 0-hour leave entries.
- ✅ **Delinked Employee Filtering** (September 22, 2025): Modified employee selection to exclude delinked employees from new job creation forms. Updated `getEmployees()` function to filter out employees whose user accounts have been delinked (`isAssigned = false`) while preserving their historical data. This prevents quit employees from appearing in job assignment dropdowns while maintaining all past timesheet and labor records for reporting compliance.
- ✅ **System-Wide Google Drive Integration** (October 3, 2025): Converted Google Drive from per-user to system-wide (company-wide) integration. Created `systemSettings` table to store Google Drive OAuth tokens centrally. All admins now share access to the same company Google Drive account instead of each having separate connections. Implemented automatic migration on server startup to transfer existing user tokens to system storage. Updated all 20+ route handlers to use `getSystemGoogleDriveTokens()` and `setSystemGoogleDriveTokens()` with proper token refresh callbacks. Frontend updated to reflect company-wide connection status. Migration successfully moved tokens from user records to centralized system settings and cleared individual user tokens.

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
- **Design Philosophy**: Component-based architecture with reusable UI components and role-based routing. Modern UI/UX redesign focusing on mobile responsiveness, touch-friendly controls, and enhanced navigation. Features include a dedicated "Ready for Billing" folder, collapsible sections, smart job sorting, and adaptable grid/list views. Vibrant, customizable folder colors are used for visual organization.
- **Key Features**: Mobile-first redesign, comprehensive job management (creation, editing, soft delete), integrated Australian GST, automated staff assignment to jobs, independent job sheet rates, folder grouping (client/project manager) with auto-expansion, real-time search, status-based job ordering, admin staff view access, interactive job progress visualization, comprehensive file attachment system with PDF integration, and database-backed staff notes system with persistent cross-device synchronization.
- **Timesheet System**: Mobile-first redesign supporting multiple job entries per day, auto-saving, fortnight periods, quick stats cards, and admin capabilities for entry creation and approval. Includes support for RDO, sick leave, personal leave, and annual leave. Supports custom address entry with persistence, weekend work protection, and robust validation, including fuzzy job matching.
- **Onboarding**: Animated welcome screen and interactive guided tours (role-specific).
- **Admin Features**: Compressed navigation menu, comprehensive timesheet search with advanced filtering, employee folder organization for approved timesheets, and admin edit functionality for custom addresses.
- **Notification Preferences**: User-controllable notification settings (Document Processing, Job Updates, Timesheet Reminders) with options to disable email confirmations while maintaining full functionality via in-app notifications and dashboard indicators.
- **Rewards System**: Simplified 4-tier system (Daily: timesheet submission, Weekly: full work week completion, Fortnightly: 2-week completion, Monthly: full month completion) with streak reset on sick leave, personal leave, annual leave, and leave without pay. Includes "More Apps" section navigation and dynamic rules display.

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
- **Tables**: Users, jobs, labor entries, materials, sub-trades, timesheet entries, sessions, staff members, and staff notes.
- **Relationships**: Comprehensive foreign key relationships for multi-tenant job management and cost tracking.

## Authentication & Authorization
- **Provider**: Replit Authentication (OpenID Connect)
- **Role System**: Two-tier (admin/staff) with route-level protection.
- **Session Storage**: PostgreSQL-backed sessions.
- **Security**: HTTP-only cookies with secure flags.
- **User Management**: Admins can assign staff/admin roles, link user accounts to employee records, and view assignment status. Automatic user account creation for employees and cascade cleanup on employee deletion.

## Feature Specifications
- **Tip Fees**: Comprehensive system with automatic 20% cartage calculation.
- **Inline Editing**: For job sheet items (materials, sub-trades, other costs) with edit/delete buttons, inline forms, save/cancel options, confirmation dialogs, and automatic data refresh.
- **AI Document Processing**: AI-powered expense extraction for all document types (PDF, JPG, PNG) including drag-and-drop upload, intelligent categorization, vendor/amount extraction, automatic PDF-to-image conversion, and integration. Includes a document review system allowing category selection and approval.
- **Job Creation from PDF**: Comprehensive system for creating jobs from PDF documents with authentic data extraction, including labor entries, materials, sub-trades, tip fees, and automatic consumables calculation. Features fuzzy employee and client matching. Operates automatically upon upload without approval steps.
- **Permanent Delete Functionality**: Two-tier job deletion (soft delete to folder, then permanent delete) with API endpoint, confirmation dialogs, and complete removal of all associated data.
- **Client/Project Manager Filtered Email Updates**: Granular filtering for job updates, updated email subjects with client/PM names, and visual filtering badges.
- **Multiple Email Recipient Support**: For job updates with comma-separated addresses, smart email suggestions, and persistence.
- **Job Update Email System**: Fully operational using Onlydomains.com Titan email service.
- **Email PDF Functionality**: Complete job sheet PDF email system with email dialog for recipient/subject/message input, client-side PDF generation, server-side email delivery with attachment support, and comprehensive error handling.
- **Timesheet Workflow**: Separation of draft (`Save All`) and submitted (`Submit Timesheet`) entries to prevent premature approval. Prevents duplicate timesheet entries.
- **Timesheet Validation**: Low hours warning for submission if total hours < 76, leave type validation requiring hours > 0, and completion validation requiring all Monday-Friday entries to be filled. Allows multiple entries on unlocked weekend days.
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
- **Google Drive Integration**: System-wide OAuth flow for company Google Drive connections (all admins share access).
- **Replit Object Storage**: For job document management.
- **Anthropic AI**: For AI-powered document processing.
- **Uppy**: Document upload library.

## Utilities
- **date-fns**: Date manipulation.
- **clsx**: Conditional CSS class composition.
- **memoizee**: Function memoization.
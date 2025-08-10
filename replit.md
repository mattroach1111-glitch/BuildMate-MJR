# Overview

BuildFlow Pro is a mobile-first construction management system designed to streamline job costing, billing, and workforce management. The application provides role-based access for administrators and staff members, with admins managing job details and financials while staff handle timesheet entries. The system tracks labor costs, materials, sub-trades, and project expenses to provide comprehensive construction project oversight. 

## Recent Changes (January 2025)
- ✅ **Mobile-First Redesign**: Complete UI overhaul for mobile responsiveness with touch-friendly controls
- ✅ **Employee Management**: Added staff management system with add/remove functionality  
- ✅ **Database Schema Updates**: Migrated from "other costs" fields to flexible other_costs table with addable line items
- ✅ **Enhanced Job Creation**: Added default hourly rate setting during job creation
- ✅ **Australian GST**: Integrated 10% GST calculation on all job totals
- ✅ **Improved Accessibility**: Added proper ARIA labels and mobile-optimized dialogs
- ✅ **Auto-Staff Assignment**: All employees automatically added to job sheets with their default hourly rates
- ✅ **Independent Job Rates**: Job sheet hourly rates are fully independent per job with manual save system
- ✅ **Smart Employee Sync**: New employees automatically added to existing jobs; job sheets sync all current staff
- ✅ **Simplified Staff Management**: Removed hourly rates from staff management - all rates managed on job sheets
- ✅ **Address-First Display**: Job cards now show address as heading for easier identification
- ✅ **Folder Grouping System**: Jobs can be grouped by client names or project managers with expandable folders
- ✅ **Project Manager Field**: Changed "Project Name" to "Project Manager" for better role clarity
- ✅ **Auto-Expanding Folders**: Folders automatically expand when they contain multiple jobs for better visibility
- ✅ **Job Sheet Edit Button**: Added inline edit functionality to job sheets for quick updates
- ✅ **Search Functionality**: Added real-time search across job address, client name, project manager, and status
- ✅ **Status-Based Job Ordering**: Jobs within folders automatically sort by status priority (New Job → In Progress → Complete → Ready for Billing)
- ✅ **Ready for Billing Folder**: Dedicated collapsible folder at top for jobs marked ready for billing with green color scheme
- ✅ **Mobile-First Timesheet Redesign**: Complete overhaul with fortnight periods, responsive design, quick stats cards, and touch-friendly interface
- ✅ **Admin Timesheet Management**: Added admin capability to create timesheet entries for any staff member with approval controls
- ✅ **Staff Calendar View**: Enhanced staff dashboard with visual fortnight calendar showing daily hour breakdowns and missing entries
- ✅ **Automatic Staff Integration**: New employees automatically appear in timesheet staff selection list with duplicate entry prevention
- ✅ **Employee Timesheet Filtering**: Added comprehensive employee timesheet viewing with individual employee filtering and date range options
- ✅ **Timesheet Analytics**: Enhanced admin view with employee-specific summaries and filtering by week/month/quarter periods
- ✅ **Enhanced Folder Colors**: Added distinctive color themes for folder organization - emerald for Ready for Billing, blue for Client folders, purple for Project Manager folders
- ✅ **Vibrant Multi-Color Folders (August 2025)**: Expanded folder color system with 6 different vibrant colors each for client folders (blue, orange, pink, cyan, teal, indigo) and project manager folders (purple, red, yellow, lime, rose, violet), using hash-based consistent color assignment for fun, visually appealing interface
- ✅ **Individual Folder Color Customization (August 2025)**: Added color picker functionality to each folder header with palette icon and dropdown color selection grid, allowing users to personalize folder colors with automatic localStorage persistence
- ✅ **Soft Delete System (August 2025)**: Implemented comprehensive soft delete functionality with dedicated "Previous completed job sheets" folder pinned to dashboard bottom, preserving job data for recovery while keeping main workspace clean
- ✅ **Job Edit Dropdowns**: Added project manager and client name dropdown menus to job editing with add new functionality matching the job creation interface
- ✅ **Admin Staff View Access**: Added dedicated "Staff View" tab in admin dashboard allowing admins to preview the staff experience without switching accounts
- ✅ **Enhanced Staff Timesheet Dropdown**: Improved staff selection with individual statistics showing total hours, entry counts, and approval ratios for quick assessment
- ✅ **Removed Description Field**: Eliminated description field from timesheet entries as requested for simplified data entry
- ✅ **Multiple Jobs Per Day**: Complete timesheet redesign supporting multiple job entries per day with add/remove functionality and separate hours tracking per job
- ✅ **Auto-Save Timesheet**: Removed individual save buttons, implemented automatic saving when hours and job are entered with 1-second debounce
- ✅ **Timesheet Confirmation**: Added confirmation section at bottom requiring final approval before uploading hours to job sheets with warning about edit restrictions
- ✅ **Timesheet Bug Fixes (January 2025)**: Resolved critical issues with staff name display, timesheet data loading, job selection authentication, and total hours calculation for accurate timesheet functionality
- ✅ **Duplicate Entry Resolution (August 2025)**: Completely redesigned auto-save system with manual "Save All" functionality to eliminate duplicate timesheet entries and provide better user control over data saving
- ✅ **Employee Timesheet Mapping (August 2025)**: Fixed timesheet entries to properly link to employee profiles instead of user authentication IDs, ensuring entries appear under correct employee names in admin view
- ✅ **Admin Extra Hours Management**: Added admin-only functionality to manually add extra hours to job sheets outside of timesheet entries for additional work, overtime, and adjustments. Includes dedicated "Add Extra Hours" column in labor section with input fields and buttons for each staff member.
- ✅ **Modern UI/UX Redesign (January 2025)**: Complete interface overhaul with professional navigation system, consistent PageLayout component, BuildFlow Pro branding, and improved mobile responsiveness for better user experience.
- ✅ **Enhanced Navigation**: Added back navigation from timesheet view to dashboard, making it easier for admins and staff to move between sections without getting lost.
- ✅ **Collapsible Timesheet Approvals**: Added expand/collapse functionality to timesheet approvals, grouping all entries under each staff member's name with toggle buttons for cleaner admin interface management.
- ✅ **Approved Timesheets Folder**: Separated approved timesheets into dedicated collapsible folder with green color scheme, keeping main view focused on pending approvals for better workflow organization.
- ✅ **RDO and Leave Types**: Added RDO (Rest Day Off) option to job selection dropdown and converted materials field to job description dropdown with sick leave, personal leave, and annual leave options at the bottom.
- ✅ **Simplified Timesheet Interface**: Removed job description column and permanently added sick leave, personal leave, and annual leave directly to job selection dropdown for streamlined data entry.
- ✅ **Grid/List View Toggle (August 2025)**: Added view mode toggle to admin dashboard allowing users to switch between grid view (card layout) and list view (compact horizontal rows) for both individual jobs and jobs within folders, providing flexible display options for different user preferences and screen sizes.
- ✅ **Smart Job Sorting (August 2025)**: Implemented comprehensive sorting functionality with dropdown selector offering Address (numerical), Client, Manager, and Status sorting options. Address sorting intelligently extracts numbers for proper numerical ordering (e.g., "2 Main St" before "10 Main St"), working seamlessly with search, grouping, and view mode features.

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
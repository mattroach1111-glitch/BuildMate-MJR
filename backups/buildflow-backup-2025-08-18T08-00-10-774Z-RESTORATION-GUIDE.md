# BuildFlow Pro - Restoration Guide
Generated: 2025-08-18T08:00:10.801Z

## Quick Restoration Steps

### 1. Platform Setup
- Create new Node.js hosting environment (Vercel, Railway, DigitalOcean, etc.)
- Ensure PostgreSQL database access
- Install Node.js 18+ and npm

### 2. Database Restoration
```bash
# Create new PostgreSQL database
createdb buildflow_pro

# Restore database from backup
psql buildflow_pro < buildflow-backup-2025-08-18T08-00-10-774Z-database.sql
```

### 3. Source Code Restoration
```bash
# Extract source code
tar -xzf buildflow-backup-2025-08-18T08-00-10-774Z-source.tar.gz

# Install dependencies
npm install

# Set up environment variables (see config backup)
cp .env.example .env
# Edit .env with your new database connection and secrets
```

### 4. Environment Configuration
Copy settings from `buildflow-backup-2025-08-18T08-00-10-774Z-config.json`:
- Database connection string
- Secret keys and API tokens
- OAuth settings

### 5. Object Storage Migration
If using object storage, download files from Replit Object Storage pane and:
- Upload to new cloud storage (AWS S3, Google Cloud Storage, etc.)
- Update environment variables for new storage endpoints

### 6. Deployment
```bash
# Build the application
npm run build

# Start the server
npm start
```

## Important Notes
- Update OAuth redirect URLs for new domain
- Test all functionality after restoration
- Update DNS records if using custom domain
- Verify email service configuration

## Support
This backup was created by BuildFlow Pro's automated backup system.
All business data (jobs, timesheets, staff notes) is preserved in the database backup.

# BuildFlow Pro Complete Data Backup Guide

## Overview
This guide provides comprehensive instructions for backing up all your BuildFlow Pro data to protect against any platform failures or data loss scenarios.

## 1. Database Backup (Primary Data)

### Automatic PostgreSQL Database Export
Your database contains all critical business data including:
- User accounts and authentication
- Job information and cost tracking
- Timesheet entries and approvals
- Employee records and staff notes
- Materials, sub-trades, and other costs
- Reward points and achievements
- Job files metadata

#### Manual Database Export
To export your database:
1. Go to the Database pane in your Replit project
2. Click on "Export" button
3. Download the SQL dump file
4. Store it in multiple locations (Google Drive, local storage, etc.)

#### Scheduled Database Backups
For automated backups, you can use this backup script:

```bash
#!/bin/bash
# Database backup script
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="buildflow_backup_$DATE.sql"

# Export database (replace with your DATABASE_URL)
pg_dump $DATABASE_URL > $BACKUP_FILE

# Upload to Google Drive or other cloud storage
echo "Database backup completed: $BACKUP_FILE"
```

## 2. File Storage Backup (Documents & Attachments)

### Replit Object Storage Files
Your object storage contains:
- Job document attachments (PDFs, images)
- Uploaded expense receipts
- AI-processed documents

#### Backup Object Storage Files
1. Access the Object Storage pane in Replit
2. Download all files from both:
   - `public/` directory (public assets)
   - `.private/` directory (private documents)
3. Maintain the folder structure for restore purposes

### Google Drive Integration Files
If you've connected Google Drive, files are automatically stored in:
- `BuildFlow Pro/` folder in your Google Drive
- `Timesheets/` subfolder for generated timesheets
- Job documents organized by project

## 3. Code & Configuration Backup

### Source Code Repository
Your application code should be backed up to:

#### Option 1: GitHub Repository
1. Create a private GitHub repository
2. Push your code regularly:
   ```bash
   git init
   git add .
   git commit -m "Backup BuildFlow Pro"
   git remote add origin https://github.com/yourusername/buildflow-backup.git
   git push -u origin main
   ```

#### Option 2: Download Code Archive
1. Download your entire project as ZIP
2. Store in multiple cloud locations
3. Include these critical files:
   - `shared/schema.ts` (database schema)
   - `server/` directory (backend code)
   - `client/` directory (frontend code)
   - `package.json` (dependencies)
   - Environment variables list

## 4. Environment Variables & Secrets

### Critical Configuration to Backup
Document and securely store these environment variables:
- `DATABASE_URL` - Your PostgreSQL connection
- `REPLIT_DB_URL` - Replit database connection
- Email service credentials (Titan/SendGrid)
- Google Drive OAuth credentials
- Anthropic AI API key
- Any custom domain settings

### Secure Storage Method
1. Use a password manager (1Password, Bitwarden, etc.)
2. Create an encrypted document with all credentials
3. Store backup copies offline and in cloud storage

## 5. Complete Backup Checklist

### Weekly Backup Tasks
- [ ] Export PostgreSQL database
- [ ] Download all object storage files
- [ ] Push code to GitHub repository
- [ ] Verify Google Drive folder sync
- [ ] Update environment variables document

### Monthly Backup Tasks
- [ ] Test database restore procedure
- [ ] Verify all backup files are accessible
- [ ] Update backup storage locations
- [ ] Review and clean old backup files
- [ ] Document any new integrations or changes

### Critical Files Backup List
Essential files to backup:

1. **Database Export** (`.sql` file)
2. **Object Storage Files** (all attachments)
3. **Source Code** (complete project folder)
4. **Environment Variables** (secure document)
5. **Configuration Files**:
   - `drizzle.config.ts`
   - `package.json`
   - `tsconfig.json`
   - `tailwind.config.ts`
   - `vite.config.ts`

## 6. Recovery Procedures

### Database Recovery
1. Create new PostgreSQL database
2. Import SQL dump: `psql $NEW_DATABASE_URL < backup.sql`
3. Update DATABASE_URL in new environment
4. Run database migrations if needed

### Application Recovery
1. Create new Replit project
2. Upload backed up source code
3. Install dependencies: `npm install`
4. Configure environment variables
5. Set up object storage and upload files
6. Test all functionality

### Google Drive Recovery
Files stored in Google Drive are automatically safe and accessible even if Replit fails.

## 7. Multi-Location Storage Strategy

### Primary Backup Locations
1. **Google Drive** - Automatic for connected files
2. **GitHub** - Source code versioning
3. **Local Storage** - Download copies to computer
4. **Secondary Cloud** - Dropbox, OneDrive, etc.

### Backup Frequency
- **Database**: Daily automated exports
- **Code**: After each major change
- **Files**: Real-time via Google Drive sync
- **Configuration**: After any environment changes

## 8. Emergency Contact & Documentation

### Key Information to Document
- Database connection details
- Object storage bucket information  
- Google Drive folder structure
- API keys and service accounts
- Backup file locations and access credentials

### Business Continuity
- List of alternative platforms if needed
- Contact information for all integrated services
- Step-by-step restore procedures
- Testing schedule for backup validity

## 9. Automated Backup Script

Here's a comprehensive backup script you can run:

```bash
#!/bin/bash
# BuildFlow Pro Complete Backup Script
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="buildflow_backup_$DATE"

# Create backup directory
mkdir -p $BACKUP_DIR

# 1. Database backup
echo "Backing up database..."
pg_dump $DATABASE_URL > "$BACKUP_DIR/database_backup.sql"

# 2. Environment variables (template)
echo "Creating environment template..."
cat > "$BACKUP_DIR/environment_variables.txt" << EOF
DATABASE_URL=your_database_url_here
SENDGRID_API_KEY=your_sendgrid_key_here
ANTHROPIC_API_KEY=your_anthropic_key_here
# Add all your environment variables here
EOF

# 3. Create archive
echo "Creating backup archive..."
tar -czf "buildflow_backup_$DATE.tar.gz" $BACKUP_DIR

echo "Backup completed: buildflow_backup_$DATE.tar.gz"
```

## 10. Backup Verification

### Regular Testing
- Monthly: Restore database to test environment
- Quarterly: Full application restore test
- Annually: Complete disaster recovery drill

### Health Checks
- Verify backup file integrity
- Test download/upload speeds
- Confirm all integrations work after restore
- Validate data completeness and accuracy

---

## Quick Action Items

**Immediate Actions (Do Today):**
1. Export current database
2. Download all object storage files
3. Create GitHub repository for code
4. Document current environment variables

**Setup Long-term (This Week):**
1. Implement automated database backup
2. Configure GitHub automatic sync
3. Verify Google Drive integration
4. Create backup verification schedule

**Monthly Maintenance:**
1. Test restore procedures
2. Update backup documentation
3. Review and clean old backups
4. Verify all backup locations are accessible

This comprehensive backup strategy ensures your BuildFlow Pro data is protected against any platform failures or data loss scenarios.
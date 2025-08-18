# BuildFlow Pro - Comprehensive Backup System

This backup system protects your BuildFlow Pro data against Replit platform failures and enables migration to alternative hosting platforms.

## 🛡️ Protection Coverage

### Complete Data Protection
- **Database**: Full PostgreSQL backup with schema and data
- **Source Code**: Complete application codebase archive
- **Configuration**: Environment variables and system settings
- **Object Storage**: File storage information and download instructions
- **Restoration Guide**: Step-by-step migration instructions

### Platform Independence
- Works on any hosting platform (Railway, Vercel, DigitalOcean, etc.)
- No vendor lock-in
- Standardized restoration process
- Cross-platform compatibility

## 🚀 Quick Start

### 1. Manual Backup (Recommended First Step)
```bash
# Create immediate backup
node backup-system/automated-backup.js

# This creates a complete backup with timestamp
# Example: buildflow-backup-2025-01-18T12-30-45-123Z
```

### 2. Google Drive Integration (Optional Cloud Storage)
```bash
# Set up Google Drive backup (requires service account)
# 1. Create Google Cloud service account
# 2. Download JSON key file
# 3. Set environment variable
export GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/service-account-key.json

# Upload latest backup to Google Drive
node backup-system/google-drive-backup.js buildflow-backup-TIMESTAMP
```

### 3. Automated Scheduling
```bash
# Start automated backup scheduler
node backup-system/backup-scheduler.js start

# This runs:
# - Daily backups at 2 AM
# - Weekly Google Drive sync on Sundays at 3 AM
# - Hourly health checks
```

## 📋 Available Commands

### Backup Operations
```bash
# Manual backup
node backup-system/backup-scheduler.js manual

# Emergency backup (for immediate migration)
node backup-system/backup-scheduler.js emergency

# Health check
node backup-system/backup-scheduler.js health
```

### Google Drive Operations
```bash
# Upload specific backup
node backup-system/google-drive-backup.js BACKUP_NAME

# Automatic cleanup keeps 5 most recent backups
```

## 🔧 Setup Instructions

### 1. Basic Setup (Local Backups Only)
No additional setup required - works immediately with existing PostgreSQL and file system.

### 2. Google Drive Setup (Cloud Backups)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create new project or select existing one
3. Enable Google Drive API
4. Create service account:
   - Go to IAM & Admin > Service Accounts
   - Create new service account
   - Download JSON key file
5. Share your Google Drive folder with service account email
6. Set environment variable:
   ```bash
   export GOOGLE_SERVICE_ACCOUNT_KEY=/path/to/your/service-account-key.json
   ```

### 3. Production Deployment
Add to your Replit Secrets:
```
GOOGLE_SERVICE_ACCOUNT_KEY=your-service-account-json-content
```

## 📂 Backup Structure

Each backup creates multiple files:
```
backups/
├── buildflow-backup-TIMESTAMP-database.sql      # Complete database
├── buildflow-backup-TIMESTAMP-source.tar.gz     # Source code
├── buildflow-backup-TIMESTAMP-config.json       # Configuration
├── buildflow-backup-TIMESTAMP-storage-info.json # Storage details
├── buildflow-backup-TIMESTAMP-RESTORATION-GUIDE.md # Instructions
└── buildflow-backup-TIMESTAMP-SUMMARY.json      # Backup summary
```

## 🚨 Emergency Migration Process

### Platform Failure Imminent
1. **Immediate Backup**:
   ```bash
   node backup-system/backup-scheduler.js emergency
   ```

2. **Download Object Storage** (if used):
   - Use Replit Object Storage pane
   - Download all files manually

3. **Save Environment Variables**:
   - Copy all secrets from Replit dashboard
   - Save to secure location

4. **Follow Migration Guide**:
   - Use generated restoration guide
   - Choose target platform (Railway, Vercel, etc.)
   - Restore database and deploy

### Estimated Migration Time
- **Simple migration**: 15-30 minutes
- **Complex migration**: 1-2 hours
- **Data verification**: Additional 30 minutes

## 🎯 Target Platforms

### Railway (Easiest)
- Git-based deployment
- Automatic PostgreSQL
- One-click deployment

### Vercel + Neon
- High performance
- Generous free tier
- Serverless architecture

### DigitalOcean
- Predictable pricing
- Full control
- Scalable infrastructure

### Self-Hosted VPS
- Complete control
- Cost-effective
- Requires technical expertise

## 📊 Monitoring & Health

### Backup Health Indicators
- ✅ **Healthy**: Daily backups completing successfully
- ⚠️ **Warning**: Backup older than 25 hours
- ❌ **Critical**: Backup failures or missing files

### System Requirements
- PostgreSQL access (`pg_dump` command)
- File system write permissions
- Network access for Google Drive (if used)
- Sufficient disk space (typically 100-500MB per backup)

## 🛠️ Troubleshooting

### Common Issues

#### Database Backup Fails
```bash
# Check PostgreSQL access
pg_dump --version
psql $DATABASE_URL -c "SELECT version();"

# Common fix: Install PostgreSQL client
sudo apt-get install postgresql-client
```

#### Google Drive Upload Fails
```bash
# Verify service account key
cat $GOOGLE_SERVICE_ACCOUNT_KEY | jq .

# Check API permissions
# Ensure Google Drive API is enabled in Google Cloud Console
```

#### Source Code Backup Incomplete
```bash
# Check disk space
df -h

# Verify tar command
tar --version

# Check file permissions
ls -la backup-system/
```

## 🔐 Security Considerations

### Backup Security
- Database passwords are **NOT** stored in config backups
- Service account keys should be kept secure
- Google Drive backups are private to your account
- Local backups should be stored securely

### Migration Security
- Always verify backup integrity before migration
- Test restoration in staging environment first
- Update OAuth redirect URLs after migration
- Rotate secrets after platform change

## 📈 Best Practices

### Regular Maintenance
1. **Weekly**: Check backup health status
2. **Monthly**: Test backup restoration process
3. **Quarterly**: Review and update migration procedures
4. **Before major changes**: Create manual backup

### Backup Retention
- **Local**: Keep 7 days of daily backups
- **Google Drive**: Keep 5 most recent backup sets
- **Long-term**: Monthly archives for compliance

## 🆘 Support & Recovery

### If Backups Fail
1. Check system logs for errors
2. Verify database connectivity
3. Ensure sufficient disk space
4. Contact platform support if needed

### Emergency Contacts
- Platform issues: Replit support
- Migration assistance: Technical team
- Data recovery: Database administrator

---

**Your BuildFlow Pro data is now protected against platform failures!**

This backup system ensures business continuity and data protection for your construction management application.
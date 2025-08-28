# 🛡️ BuildFlow Pro Backup System

A comprehensive backup solution for your BuildFlow Pro construction management system, providing multi-location backup approach with automated scripts for database exports, source code versioning, and file storage redundancy.

## 🚀 Quick Start

### Complete Backup (Recommended)
```bash
# Run complete backup (database + codebase + guide)
node backup-complete.js
```

### Individual Backups
```bash
# Database only
node backup-database.js

# Codebase only  
node backup-codebase.js
```

## 📋 What Gets Backed Up

### Database Backup
- ✅ Complete PostgreSQL database dump
- ✅ All tables (users, jobs, labor entries, materials, etc.)
- ✅ Foreign key relationships preserved
- ✅ Schema and data integrity maintained

### Codebase Backup
- ✅ Source code (client/, server/, shared/)
- ✅ Configuration files (package.json, vite.config.ts, etc.)
- ✅ Documentation (replit.md, README files)
- ✅ Git repository bundle (if available)

### What's NOT Backed Up (For Security)
- ❌ node_modules/ (reinstall with npm install)
- ❌ .env files (contains sensitive data)
- ❌ Build artifacts (dist/, .cache/, etc.)
- ❌ Log files and temporary files

## 📁 Backup File Structure

After running backups, you'll find:
```
backups/
├── buildflow-pro-[timestamp].sql          # Database backup
├── buildflow-pro-codebase-[timestamp].zip # Complete codebase
├── buildflow-pro-git-[timestamp].bundle   # Git repository
├── restoration-guide-[timestamp].md       # Step-by-step restore guide
└── backup-summary-[timestamp].json        # Backup session info
```

## 🔄 Restore Process

### Quick Restore Steps:
1. **Extract codebase**: `unzip buildflow-pro-codebase-[timestamp].zip`
2. **Install dependencies**: `npm install`  
3. **Configure environment**: Copy and edit .env from .env.example
4. **Restore database**: `psql "$DATABASE_URL" < backups/buildflow-pro-[timestamp].sql`
5. **Start application**: `npm run dev`

### Detailed Restore Guide
Each backup session generates a specific restoration guide with exact commands for your backup files.

## 🔐 Environment Variables Required

When restoring, you'll need to configure these essential variables:

```env
DATABASE_URL=your_database_connection_string
ANTHROPIC_API_KEY=your_anthropic_api_key
SENDGRID_API_KEY=your_sendgrid_api_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

## 🕒 Automated Backup Schedule

### Option 1: Manual Backups
Run backup scripts whenever needed before major changes.

### Option 2: Scheduled Backups (Linux/Mac)
Add to crontab for automatic daily backups:
```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/buildflow-pro && node backup-complete.js
```

### Option 3: Scheduled Backups (Windows)
Use Task Scheduler to run backup-complete.js daily.

## 📊 Backup Management

### Automatic Cleanup
- Database backups: Keeps 10 most recent automatically
- Codebase backups: Manual cleanup recommended
- Old backups are safely removed to save space

### Manual Cleanup
```bash
# List all backup files
ls -la backups/

# Remove backups older than 30 days
find backups/ -name "buildflow-pro-*" -mtime +30 -delete
```

## 🆘 Recovery Scenarios

### Scenario 1: Complete System Loss
1. Set up new environment (Node.js, PostgreSQL)
2. Extract latest codebase backup
3. Follow restoration guide step-by-step
4. Restore database from most recent backup

### Scenario 2: Database Corruption
1. Keep existing codebase
2. Restore database: `psql "$DATABASE_URL" < backups/[latest-backup].sql`
3. Restart application

### Scenario 3: Code Changes Gone Wrong
1. Extract codebase backup to temporary directory
2. Compare and restore needed files
3. Or restore complete codebase if needed

## ✅ Testing Your Backups

### Test Database Backup
```bash
# Create test database
createdb buildflow_pro_test

# Restore to test database  
psql "postgresql://user:pass@host/buildflow_pro_test" < backups/[backup-file].sql

# Verify data
psql "postgresql://user:pass@host/buildflow_pro_test" -c "SELECT COUNT(*) FROM users;"
```

### Test Codebase Backup
```bash
# Extract to test directory
mkdir test-restore
unzip backups/buildflow-pro-codebase-[timestamp].zip -d test-restore/

# Verify files
cd test-restore/
npm install
npm run dev
```

## 🔧 Troubleshooting

### "DATABASE_URL not set" Error
- Ensure DATABASE_URL environment variable is configured
- Check database connection is working

### "pg_dump not found" Error
- Install PostgreSQL client tools
- Replit usually has this pre-installed

### Permission Denied Errors
- Make scripts executable: `chmod +x backup-*.js`
- Check file permissions in backups/ directory

### Archive/Zip Errors
- Ensure sufficient disk space
- Check write permissions in backups/ directory

## 🎯 Best Practices

1. **Regular Backups**: Run complete backup before major changes
2. **Test Restores**: Periodically test your backup restoration process
3. **Multiple Locations**: Store backups in different locations (local, cloud, external drive)
4. **Document Changes**: Update replit.md with architectural changes
5. **Monitor Size**: Keep an eye on backup file sizes and cleanup old ones
6. **Secure Storage**: Don't store backups with sensitive data in public locations

## 📞 Support

If you encounter issues:
1. Check the generated restoration-guide-[timestamp].md for specific instructions
2. Verify all environment variables are set correctly
3. Ensure database connection is working
4. Check file permissions and disk space

---

**Created:** ${new Date().toISOString()}  
**BuildFlow Pro Backup System v1.0**
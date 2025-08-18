# BuildFlow Pro Platform Migration Guide

## Overview
This comprehensive guide enables you to migrate your BuildFlow Pro construction management system from Replit to any hosting platform, protecting against platform failures and ensuring business continuity.

## 🚨 Emergency Migration (Platform Failure)

### Immediate Actions (15 minutes)
1. **Download Latest Backup**
   ```bash
   # If Replit is still accessible
   curl -H "Authorization: Bearer YOUR_TOKEN" \
        https://your-app.replit.app/api/backup/export-sql > buildflow_emergency_backup.sql
   ```

2. **Access Google Drive Backups**
   - Go to Google Drive → "BuildFlow Pro Backups" folder
   - Download the most recent `.json` backup file
   - Download any recent SQL exports

### Data Recovery Steps (30-60 minutes)
1. **Set up new PostgreSQL database** (any provider: AWS RDS, Google Cloud SQL, etc.)
2. **Restore from SQL backup**:
   ```bash
   psql -h your-new-host -U username -d database_name < buildflow_emergency_backup.sql
   ```
3. **Or restore from JSON backup** using the migration scripts provided

## 🔄 Planned Migration (Comprehensive)

### Phase 1: Pre-Migration Setup (1-2 hours)

#### 1. Create New Hosting Environment
Choose your hosting platform:
- **AWS**: EC2 + RDS + S3
- **Google Cloud**: Compute Engine + Cloud SQL + Cloud Storage  
- **Heroku**: Dyno + Heroku Postgres
- **DigitalOcean**: Droplet + Managed Database
- **Self-hosted**: VPS + PostgreSQL + file storage

#### 2. Environment Setup
```bash
# Clone repository
git clone https://github.com/your-username/buildflow-pro.git
cd buildflow-pro

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
```

Required environment variables:
```env
DATABASE_URL=postgresql://username:password@host:port/database
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REPLIT_AUTH_PROVIDER_ID=your_auth_provider  # Or set up alternative auth
NODE_ENV=production
PORT=5000
```

### Phase 2: Data Migration (30-60 minutes)

#### Method A: SQL Export (Recommended)
1. **Create final backup on Replit**:
   ```bash
   curl -X POST -H "Authorization: Bearer TOKEN" \
        https://buildflow-pro.replit.app/api/backup/export-sql
   ```

2. **Restore to new database**:
   ```bash
   psql $DATABASE_URL < buildflow_export.sql
   ```

#### Method B: JSON Backup
1. **Download JSON backup**:
   ```bash
   curl -H "Authorization: Bearer TOKEN" \
        https://buildflow-pro.replit.app/api/backup/create > backup.json
   ```

2. **Use restoration script** (provided in `/backup-scripts/restore-from-json.js`)

### Phase 3: File Migration (15-30 minutes)

#### Object Storage Files
If using Replit Object Storage, migrate files to your new storage solution:

```bash
# Example: AWS S3 migration
aws s3 sync replit-objects/ s3://your-bucket/buildflow-files/

# Update environment variables
OBJECT_STORAGE_BUCKET=your-bucket
OBJECT_STORAGE_REGION=us-east-1
```

#### PDF and Image Assets
1. **Download all attachments** from Replit Object Storage
2. **Upload to new storage provider** (AWS S3, Google Cloud Storage, etc.)
3. **Update file paths** in database if necessary

### Phase 4: Application Deployment (30-60 minutes)

#### Build and Deploy
```bash
# Build the application
npm run build

# Start production server
npm start

# Or use PM2 for process management
pm2 start "npm run start" --name buildflow-pro
```

#### Domain and SSL Setup
1. **Point domain** to new server IP
2. **Set up SSL certificate** (Let's Encrypt, CloudFlare, etc.)
3. **Configure reverse proxy** (Nginx, Apache, CloudFlare)

### Phase 5: Testing and Validation (30 minutes)

#### Data Integrity Checks
```bash
# Run data validation script
node backup-scripts/validate-migration.js

# Check critical functions
curl https://your-new-domain.com/api/jobs
curl https://your-new-domain.com/api/timesheet
```

#### User Acceptance Testing
- [ ] Login functionality
- [ ] Job management (create, edit, view)
- [ ] Timesheet submission
- [ ] File uploads and downloads
- [ ] Email notifications
- [ ] PDF generation
- [ ] Staff notes system
- [ ] Rewards system

## 🔐 Authentication Migration

### Option 1: Replit Auth (if available)
Keep existing Replit authentication if the service remains accessible.

### Option 2: Google OAuth
```javascript
// Update server/googleAuth.js
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  'https://your-new-domain.com/auth/google/callback'
);
```

### Option 3: Custom Authentication
Implement your own auth system using:
- **Passport.js** with local strategy
- **Auth0** for managed authentication  
- **Firebase Auth** for Google integration

## 📋 Migration Checklist

### Pre-Migration
- [ ] Create comprehensive backup (SQL + JSON + files)
- [ ] Set up new hosting infrastructure
- [ ] Configure environment variables
- [ ] Set up new database
- [ ] Test deployment in staging environment

### Migration Day
- [ ] Create final backup
- [ ] Notify users of maintenance window
- [ ] Deploy application to new platform
- [ ] Migrate database
- [ ] Migrate file storage
- [ ] Update DNS records
- [ ] Test all critical functionality
- [ ] Go live with new platform

### Post-Migration
- [ ] Monitor application performance
- [ ] Verify all features work correctly
- [ ] Update backup automation for new platform
- [ ] Document new infrastructure details
- [ ] Train team on new deployment process

## 🛠 Platform-Specific Instructions

### AWS Deployment
```bash
# Using Elastic Beanstalk
eb init buildflow-pro
eb create production
eb deploy

# Using EC2 directly
# See aws-deployment.md for detailed steps
```

### Google Cloud Deployment  
```bash
# Using App Engine
gcloud app deploy
gcloud sql instances create buildflow-db

# See gcp-deployment.md for detailed steps
```

### Heroku Deployment
```bash
# Using Heroku CLI
heroku create buildflow-pro
heroku addons:create heroku-postgresql:standard-0
git push heroku main

# See heroku-deployment.md for detailed steps
```

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check user permissions
psql $DATABASE_URL -c "\du"
```

### File Upload Issues
- Verify storage bucket permissions
- Check environment variables
- Test file path mappings

### Authentication Problems
- Verify OAuth callback URLs
- Check client ID/secret configuration
- Test in browser developer tools

## 📞 Emergency Support

### Critical Issues
1. **Database corruption**: Use latest Google Drive backup
2. **File storage failure**: Restore from file backups  
3. **Authentication failure**: Switch to backup auth method
4. **Performance issues**: Check resource allocation

### Rollback Plan
If migration fails:
1. **Revert DNS** to original Replit URL (if still available)
2. **Restore original database** from pre-migration backup
3. **Communicate status** to users
4. **Investigate issues** before retry

## 📈 Performance Optimization

### Database
- Set up connection pooling
- Configure appropriate indexes
- Monitor query performance
- Set up read replicas if needed

### Application
- Enable gzip compression
- Set up CDN for static assets
- Configure caching headers
- Monitor memory usage

### Monitoring
- Set up application monitoring (New Relic, DataDog)
- Configure error tracking (Sentry)
- Set up uptime monitoring
- Monitor database performance

## 🔄 Ongoing Maintenance

### Automated Backups
Set up regular backups on your new platform:
```bash
# Example cron job for daily backups
0 2 * * * pg_dump $DATABASE_URL > /backups/daily_$(date +%Y%m%d).sql
0 2 * * 0 pg_dump $DATABASE_URL > /backups/weekly_$(date +%Y%m%d).sql
```

### Updates and Security
- Regular dependency updates: `npm audit fix`
- OS security patches on your servers
- SSL certificate renewal
- Database security updates

## 📁 Migration Scripts

The following scripts are available in `/backup-scripts/`:
- `migrate-to-aws.sh` - Complete AWS migration
- `migrate-to-gcp.sh` - Complete Google Cloud migration  
- `migrate-to-heroku.sh` - Complete Heroku migration
- `restore-from-json.js` - JSON backup restoration
- `validate-migration.js` - Post-migration validation
- `emergency-restore.sh` - Emergency restoration script

---

**⚠️ Important**: Always test the migration process in a staging environment before migrating production data. Keep multiple backup copies and verify data integrity before going live with the new platform.

For technical support during migration, ensure you have:
- Database administrator access
- Server administrator access  
- DNS management access
- SSL certificate management access
- Backup files readily available
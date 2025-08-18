# BuildFlow Pro - Platform Migration Guide

Complete guide for migrating BuildFlow Pro from Replit to alternative hosting platforms when facing platform failures or planned migrations.

## Emergency Backup Process

### Immediate Actions (Platform Failure Imminent)
```bash
# 1. Create emergency backup
node backup-system/backup-scheduler.js emergency

# 2. Download all files from Replit Object Storage (if used)
# Use the Object Storage pane in Replit to download all files

# 3. Save environment variables
# Copy all environment variables from Replit Secrets
```

## Target Platform Options

### 1. Railway (Recommended for Simplicity)
- **Pros**: Git-based deployment, automatic PostgreSQL, easy setup
- **Cons**: Pricing can scale with usage
- **Best for**: Quick migration with minimal configuration

```bash
# Railway deployment
npx @railway/cli login
railway new buildflow-pro
railway add postgresql
# Deploy from restored backup
```

### 2. Vercel + Neon Database
- **Pros**: Excellent performance, generous free tier
- **Cons**: Serverless limitations for some operations
- **Best for**: Production-ready deployment

```bash
# Vercel deployment
npm i -g vercel
vercel
# Configure database with Neon
```

### 3. DigitalOcean App Platform
- **Pros**: Predictable pricing, full control
- **Cons**: Requires more setup
- **Best for**: Scalable production environment

### 4. Self-Hosted (VPS)
- **Pros**: Complete control, cost-effective long-term
- **Cons**: Requires server management skills
- **Best for**: Technical teams wanting full control

## Step-by-Step Migration Process

### Phase 1: Backup Verification
1. **Verify Backup Completeness**
   ```bash
   # Check backup files exist
   ls -la backups/buildflow-backup-*
   
   # Verify database backup
   head -n 20 buildflow-backup-*-database.sql
   
   # Check source code backup
   tar -tzf buildflow-backup-*-source.tar.gz | head -20
   ```

2. **Test Database Restoration**
   ```bash
   # Create test database
   createdb buildflow_test
   
   # Restore backup
   psql buildflow_test < buildflow-backup-*-database.sql
   
   # Verify data
   psql buildflow_test -c "SELECT COUNT(*) FROM users;"
   ```

### Phase 2: Environment Setup
1. **Create New Hosting Environment**
   - Choose target platform from options above
   - Set up PostgreSQL database
   - Configure domain/subdomain

2. **Environment Variables Setup**
   ```bash
   # Required environment variables:
   DATABASE_URL=postgresql://username:password@host:port/database
   NODE_ENV=production
   
   # Optional but recommended:
   SMTP_HOST=your-email-provider
   SMTP_USER=your-email
   SMTP_PASS=your-password
   
   # OAuth (if used):
   OAUTH_CLIENT_ID=your-oauth-client
   OAUTH_CLIENT_SECRET=your-oauth-secret
   OAUTH_REDIRECT_URL=https://yourdomain.com/auth/callback
   ```

### Phase 3: Code Deployment
1. **Extract and Deploy Source Code**
   ```bash
   # Extract backup
   tar -xzf buildflow-backup-*-source.tar.gz
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   
   # Test locally first
   npm start
   ```

2. **Database Migration**
   ```bash
   # Restore production database
   psql $DATABASE_URL < buildflow-backup-*-database.sql
   
   # Verify migration
   npm run db:studio  # Check data in browser
   ```

### Phase 4: File Storage Migration
1. **Object Storage Setup** (if applicable)
   ```bash
   # Download files from Replit Object Storage
   # Upload to new cloud storage (AWS S3, Google Cloud, etc.)
   
   # Update environment variables
   PUBLIC_OBJECT_SEARCH_PATHS=https://your-bucket.s3.amazonaws.com/public
   PRIVATE_OBJECT_DIR=https://your-bucket.s3.amazonaws.com/private
   ```

### Phase 5: Testing & Validation
1. **Functionality Testing**
   - [ ] User authentication works
   - [ ] Job creation and management
   - [ ] Timesheet functionality
   - [ ] Email notifications
   - [ ] File uploads/downloads
   - [ ] Database operations

2. **Performance Testing**
   ```bash
   # Load test endpoints
   curl -w "@curl-format.txt" -s -o /dev/null https://yourdomain.com/api/health
   ```

### Phase 6: DNS & Go-Live
1. **Domain Configuration**
   - Update DNS records to point to new platform
   - Configure SSL certificates
   - Set up CDN if needed

2. **Monitoring Setup**
   - Configure uptime monitoring
   - Set up error tracking
   - Enable backup automation on new platform

## Platform-Specific Guides

### Railway Migration
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and create project
railway login
railway new buildflow-pro

# 3. Add database
railway add postgresql

# 4. Deploy
tar -xzf buildflow-backup-*-source.tar.gz
cd buildflow-pro
railway up

# 5. Restore database
railway psql < ../buildflow-backup-*-database.sql
```

### Vercel + Neon Migration
```bash
# 1. Create Neon database
# Go to neon.tech and create new database

# 2. Restore database
psql "postgresql://user:pass@host/db" < buildflow-backup-*-database.sql

# 3. Deploy to Vercel
tar -xzf buildflow-backup-*-source.tar.gz
cd buildflow-pro
vercel --prod

# 4. Configure environment variables in Vercel dashboard
```

### DigitalOcean Migration
```bash
# 1. Create DigitalOcean App
# Use DO App Platform dashboard

# 2. Create managed database
# Add PostgreSQL database in DO

# 3. Deploy app
# Connect GitHub repo or use Docker

# 4. Restore database
psql $DO_DATABASE_URL < buildflow-backup-*-database.sql
```

## Troubleshooting Common Issues

### Database Connection Issues
```bash
# Test connection
psql $DATABASE_URL -c "SELECT version();"

# Check permissions
psql $DATABASE_URL -c "SELECT current_user, session_user;"
```

### Missing Dependencies
```bash
# Clear and reinstall
rm -rf node_modules package-lock.json
npm install

# Update if needed
npm audit fix
```

### OAuth/Authentication Issues
- Update redirect URLs in OAuth provider
- Verify client ID and secret
- Check cookie domain settings

### File Upload Issues
- Verify storage bucket permissions
- Check CORS settings
- Test upload endpoints

## Maintenance After Migration

### 1. Backup Automation
```bash
# Set up new backup system
crontab -e

# Add daily backup
0 2 * * * /usr/bin/node /path/to/backup-system/backup-scheduler.js manual
```

### 2. Monitoring
- Set up uptime monitoring (UptimeRobot, Pingdom)
- Configure error tracking (Sentry)
- Monitor database performance

### 3. Updates
```bash
# Regular updates
npm update
npm audit fix

# Security patches
npm audit --audit-level high
```

## Emergency Contacts & Resources

### Platform Support
- **Railway**: support@railway.app
- **Vercel**: support@vercel.com
- **DigitalOcean**: support.digitalocean.com

### Community Resources
- BuildFlow Pro GitHub Issues
- Platform-specific documentation
- Community forums and Discord

## Success Checklist

- [ ] All backups completed and verified
- [ ] Database successfully restored
- [ ] Application deployed and accessible
- [ ] All functionality tested
- [ ] DNS updated and working
- [ ] SSL certificates configured
- [ ] Monitoring and alerts set up
- [ ] New backup system implemented
- [ ] Team notified of new URLs
- [ ] Documentation updated

---

**Remember**: This migration guide ensures zero data loss and minimal downtime. Take your time with each step and test thoroughly before going live.
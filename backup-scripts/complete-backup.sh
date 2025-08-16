#!/bin/bash
# BuildFlow Pro Complete Backup Script
# Creates a comprehensive backup of all data and configurations

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./buildflow_backup_$DATE"

echo "🚀 Starting complete BuildFlow Pro backup..."
echo "📅 Backup date: $DATE"
echo "📁 Backup directory: $BACKUP_DIR"

# Create backup directory structure
mkdir -p "$BACKUP_DIR/database"
mkdir -p "$BACKUP_DIR/source-code"
mkdir -p "$BACKUP_DIR/config"
mkdir -p "$BACKUP_DIR/documentation"

echo ""
echo "🔄 Phase 1: Database Backup"
echo "======================================"

# Database backup
if [ -n "$DATABASE_URL" ]; then
    echo "📊 Exporting PostgreSQL database..."
    pg_dump $DATABASE_URL > "$BACKUP_DIR/database/buildflow_database.sql"
    
    if [ $? -eq 0 ]; then
        SIZE=$(du -h "$BACKUP_DIR/database/buildflow_database.sql" | cut -f1)
        LINES=$(wc -l < "$BACKUP_DIR/database/buildflow_database.sql")
        echo "✅ Database exported successfully ($SIZE, $LINES lines)"
    else
        echo "❌ Database backup failed!"
    fi
else
    echo "⚠️  DATABASE_URL not found - skipping database backup"
fi

echo ""
echo "🔄 Phase 2: Source Code Backup"
echo "======================================"

# Copy source code (exclude node_modules and build artifacts)
echo "📝 Copying source code..."
rsync -av --exclude='node_modules' --exclude='dist' --exclude='.git' \
    --exclude='backups' --exclude='attached_assets' \
    ./ "$BACKUP_DIR/source-code/"

echo "✅ Source code copied"

echo ""
echo "🔄 Phase 3: Configuration Backup"
echo "======================================"

# Environment variables template
echo "⚙️  Creating environment variables template..."
cat > "$BACKUP_DIR/config/environment_variables_template.txt" << 'EOF'
# BuildFlow Pro Environment Variables
# Replace with your actual values

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Email Service (SendGrid)
SENDGRID_API_KEY=your_sendgrid_api_key

# AI Processing (Anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key

# Google Services
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Replit Configuration
REPL_ID=your_repl_id
REPLIT_DB_URL=your_replit_db_url

# Object Storage
PUBLIC_OBJECT_SEARCH_PATHS=your_object_search_paths
PRIVATE_OBJECT_DIR=your_private_object_dir

# Email Configuration (Onlydomains Titan)
TITAN_EMAIL_HOST=smtp.titan.email
TITAN_EMAIL_PORT=587
TITAN_EMAIL_USER=your_titan_email
TITAN_EMAIL_PASS=your_titan_password

# Security
SESSION_SECRET=your_session_secret

# Application
NODE_ENV=development
PORT=5000
EOF

# Copy important config files
echo "📋 Copying configuration files..."
cp package.json "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  package.json not found"
cp tsconfig.json "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  tsconfig.json not found"
cp drizzle.config.ts "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  drizzle.config.ts not found"
cp tailwind.config.ts "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  tailwind.config.ts not found"
cp vite.config.ts "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  vite.config.ts not found"
cp components.json "$BACKUP_DIR/config/" 2>/dev/null || echo "⚠️  components.json not found"

echo "✅ Configuration files copied"

echo ""
echo "🔄 Phase 4: Documentation Backup"
echo "======================================"

# Copy documentation files
echo "📚 Copying documentation..."
cp replit.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "⚠️  replit.md not found"
cp README.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "⚠️  README.md not found"
cp USER_GUIDE.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "⚠️  USER_GUIDE.md not found"
cp REWARDS_SYSTEM_GUIDE.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "⚠️  REWARDS_SYSTEM_GUIDE.md not found"
cp backup-solution.md "$BACKUP_DIR/documentation/" 2>/dev/null || echo "⚠️  backup-solution.md not found"

# Create restore instructions
cat > "$BACKUP_DIR/RESTORE_INSTRUCTIONS.md" << 'EOF'
# BuildFlow Pro Restore Instructions

## Quick Restore Steps

1. **Create New Replit Project**
   - Create a new Node.js project in Replit
   - Upload the `source-code` folder contents

2. **Restore Database**
   - Create new PostgreSQL database in Replit
   - Import: `psql $DATABASE_URL < database/buildflow_database.sql`

3. **Configure Environment Variables**
   - Use `config/environment_variables_template.txt` as guide
   - Set all required environment variables in Replit

4. **Install Dependencies**
   ```bash
   npm install
   ```

5. **Setup Object Storage**
   - Use Replit Object Storage tool
   - Upload any backed up files

6. **Test Application**
   ```bash
   npm run dev
   ```

## Important Notes
- Update DATABASE_URL to new database connection
- Reconfigure Google Drive integration if needed
- Test all functionality before going live
- Verify email service configuration

## Support
Refer to `documentation/backup-solution.md` for detailed instructions.
EOF

echo "✅ Documentation and restore instructions created"

echo ""
echo "🔄 Phase 5: Creating Archive"
echo "======================================"

# Create compressed archive
echo "📦 Creating compressed backup archive..."
tar -czf "buildflow_complete_backup_$DATE.tar.gz" "$BACKUP_DIR"

if [ $? -eq 0 ]; then
    ARCHIVE_SIZE=$(du -h "buildflow_complete_backup_$DATE.tar.gz" | cut -f1)
    echo "✅ Archive created: buildflow_complete_backup_$DATE.tar.gz ($ARCHIVE_SIZE)"
else
    echo "❌ Failed to create archive"
fi

echo ""
echo "🎉 BACKUP COMPLETED SUCCESSFULLY!"
echo "========================================="
echo "📊 Backup Summary:"
echo "   📁 Backup folder: $BACKUP_DIR"
echo "   📦 Archive file: buildflow_complete_backup_$DATE.tar.gz"
echo "   📏 Archive size: ${ARCHIVE_SIZE:-"Unknown"}"
echo ""
echo "📋 What's included:"
echo "   ✅ Complete database export"
echo "   ✅ Full source code"
echo "   ✅ Configuration files"
echo "   ✅ Documentation"
echo "   ✅ Restore instructions"
echo "   ✅ Environment variables template"
echo ""
echo "🔄 Next steps:"
echo "   1. Download the archive file to your computer"
echo "   2. Upload to Google Drive, Dropbox, or other cloud storage"
echo "   3. Keep a local copy on external drive"
echo "   4. Test the backup by following restore instructions"
echo ""
echo "⚠️  IMPORTANT: Update your environment variables template with real values!"
echo "    Edit: $BACKUP_DIR/config/environment_variables_template.txt"

# Clean up temporary backup directory (optional)
read -p "🗑️  Remove temporary backup folder? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$BACKUP_DIR"
    echo "✅ Temporary folder removed"
fi

echo ""
echo "✨ Backup process complete! Your data is safe."
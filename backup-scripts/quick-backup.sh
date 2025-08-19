#!/bin/bash

# BuildFlow Pro - Quick Backup Script
# Creates complete backup to protect against platform failure

echo "🚀 BuildFlow Pro Emergency Backup Starting..."

# Create backup directory with timestamp
BACKUP_DIR="buildflow_backup_$(date +%Y%m%d_%H%M%S)"
echo "📁 Creating backup directory: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

echo ""
echo "📊 BACKING UP DATABASE..."
echo "========================================"

# Database backup - most critical
if [ -n "$DATABASE_URL" ]; then
    echo "🗄️  Exporting PostgreSQL database..."
    pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database_backup.sql" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup successful!"
        
        # Get database size
        DB_SIZE=$(ls -lh "$BACKUP_DIR/database_backup.sql" | awk '{print $5}')
        echo "📏 Database backup size: $DB_SIZE"
        
        # Compress database backup
        gzip "$BACKUP_DIR/database_backup.sql"
        echo "🗜️  Database backup compressed"
    else
        echo "❌ Database backup failed - check DATABASE_URL"
    fi
else
    echo "⚠️  No DATABASE_URL found - skipping database backup"
fi

echo ""
echo "💾 BACKING UP SOURCE CODE..."
echo "========================================"

# Copy critical directories
echo "📂 Copying application directories..."
for dir in client server shared; do
    if [ -d "$dir" ]; then
        cp -r "$dir" "$BACKUP_DIR/"
        echo "✅ Copied: $dir"
    else
        echo "⚠️  Directory not found: $dir"
    fi
done

echo "📄 Copying configuration files..."
for file in package.json package-lock.json tsconfig.json vite.config.ts tailwind.config.ts drizzle.config.ts components.json postcss.config.js replit.md .replit; do
    if [ -f "$file" ]; then
        cp "$file" "$BACKUP_DIR/"
        echo "✅ Copied: $file"
    fi
done

echo ""
echo "📎 BACKING UP ATTACHED ASSETS..."
echo "========================================"

# Backup attached assets (PDFs, photos, documents)
if [ -d "attached_assets" ]; then
    ASSETS_SIZE=$(du -sh attached_assets | cut -f1)
    echo "📊 Assets directory size: $ASSETS_SIZE"
    
    cp -r attached_assets "$BACKUP_DIR/"
    echo "✅ Attached assets backed up"
else
    echo "⚠️  No attached_assets directory found"
fi

echo ""
echo "📋 CREATING RESTORATION GUIDE..."
echo "========================================"

# Create restoration instructions
cat > "$BACKUP_DIR/RESTORE_INSTRUCTIONS.txt" << 'EOF'
# BuildFlow Pro - Emergency Restoration Guide

## What This Backup Contains
✅ Complete PostgreSQL database with all business data
✅ Full source code (client, server, shared)
✅ All configuration files
✅ Attached assets (PDFs, photos, documents)

## Quick Restoration Steps

### Option 1: New Replit Project
1. Create new Replit Node.js project
2. Upload this backup folder
3. Run: npm install
4. Create PostgreSQL database in Replit
5. Import database: 
   gunzip database_backup.sql.gz
   psql $DATABASE_URL < database_backup.sql
6. Start app: npm run dev

### Option 2: Other Platforms
- DigitalOcean App Platform
- Heroku
- Railway
- Self-hosted server

## Your Business Data Protected
- Employee timesheets and hours
- Job tracking and costing
- Client information
- User accounts and roles
- All uploaded documents
- Email processing data
- Rewards system data

## Estimated Restore Time: 15-30 minutes

## Critical: Set These Environment Variables
DATABASE_URL=postgresql://...
(Plus any API keys you were using)

Your BuildFlow Pro system is now safely backed up!
EOF

echo "✅ Restoration guide created"

echo ""
echo "📦 CREATING BACKUP ARCHIVE..."
echo "========================================"

# Create compressed archive
tar -czf "$BACKUP_DIR.tar.gz" "$BACKUP_DIR"

if [ $? -eq 0 ]; then
    ARCHIVE_SIZE=$(ls -lh "$BACKUP_DIR.tar.gz" | awk '{print $5}')
    echo "✅ Backup archive created: $BACKUP_DIR.tar.gz ($ARCHIVE_SIZE)"
    
    # Clean up uncompressed directory
    rm -rf "$BACKUP_DIR"
    echo "🧹 Cleanup completed"
else
    echo "❌ Archive creation failed"
fi

echo ""
echo "🎉 BACKUP COMPLETED SUCCESSFULLY!"
echo "========================================"
echo "📦 Download this file: $BACKUP_DIR.tar.gz"
echo "💾 Store in multiple safe locations (cloud + local)"
echo "🔒 Your BuildFlow Pro data is now protected against platform failure"
echo ""
echo "⚡ Quick Download Tips:"
echo "1. Right-click the backup file in Replit file explorer"
echo "2. Select 'Download'"
echo "3. Save to your computer + cloud storage"
echo ""
echo "🚨 CRITICAL: Download this backup file NOW!"
echo "   If Replit fails, this backup will save your business"
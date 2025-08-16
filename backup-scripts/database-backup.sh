#!/bin/bash
# BuildFlow Pro Database Backup Script
# Usage: ./database-backup.sh

# Configuration
DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
BACKUP_FILE="buildflow_database_$DATE.sql"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "🔄 Starting database backup..."
echo "📅 Date: $DATE"

# Export database
if [ -n "$DATABASE_URL" ]; then
    echo "📊 Exporting database to: $BACKUP_DIR/$BACKUP_FILE"
    pg_dump $DATABASE_URL > "$BACKUP_DIR/$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup completed successfully!"
        echo "📁 File location: $BACKUP_DIR/$BACKUP_FILE"
        
        # Get file size
        SIZE=$(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
        echo "📏 File size: $SIZE"
        
        # Count number of lines (rough indicator of data volume)
        LINES=$(wc -l < "$BACKUP_DIR/$BACKUP_FILE")
        echo "📋 Number of lines: $LINES"
        
    else
        echo "❌ Database backup failed!"
        exit 1
    fi
else
    echo "❌ DATABASE_URL environment variable not found!"
    echo "Please set DATABASE_URL before running this script."
    exit 1
fi

# Clean up old backups (keep last 7 days)
echo "🧹 Cleaning up old backups (keeping last 7 days)..."
find $BACKUP_DIR -name "buildflow_database_*.sql" -mtime +7 -delete

echo "🎉 Backup process completed!"
echo ""
echo "Next steps:"
echo "1. Download the backup file to your local computer"
echo "2. Upload to Google Drive or other cloud storage"
echo "3. Verify the backup file can be opened"
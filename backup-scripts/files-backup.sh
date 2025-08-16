#!/bin/bash
# BuildFlow Pro Files Backup Script
# Backs up all uploaded files, PDFs, and attachments

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./files_backup_$DATE"

echo "🗂️ Starting files backup..."
echo "📅 Date: $DATE"
echo "📁 Backup directory: $BACKUP_DIR"

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo ""
echo "🔄 Backing up attached assets..."
if [ -d "attached_assets" ]; then
    cp -r attached_assets "$BACKUP_DIR/"
    FILES_COUNT=$(find attached_assets -type f | wc -l)
    TOTAL_SIZE=$(du -sh attached_assets | cut -f1)
    echo "✅ Copied attached_assets folder ($FILES_COUNT files, $TOTAL_SIZE)"
else
    echo "⚠️ attached_assets folder not found"
fi

echo ""
echo "🔄 Backing up object storage files..."
# Note: Object storage files would need to be downloaded via the Object Storage pane
echo "ℹ️ Object storage files need to be downloaded manually from the Object Storage pane"
echo "   1. Open Object Storage pane in Replit"
echo "   2. Download files from 'public' folder"  
echo "   3. Download files from '.private' folder"

echo ""
echo "🔄 Creating files archive..."
if [ "$(ls -A $BACKUP_DIR 2>/dev/null)" ]; then
    tar -czf "files_backup_$DATE.tar.gz" "$BACKUP_DIR"
    ARCHIVE_SIZE=$(du -h "files_backup_$DATE.tar.gz" | cut -f1)
    echo "✅ Files archive created: files_backup_$DATE.tar.gz ($ARCHIVE_SIZE)"
else
    echo "⚠️ No files found to archive"
fi

echo ""
echo "🎉 Files backup completed!"
echo ""
echo "📋 What you have:"
echo "   📁 Backup folder: $BACKUP_DIR"
echo "   📦 Archive file: files_backup_$DATE.tar.gz"
echo ""
echo "🔄 Next steps:"
echo "   1. Download the archive file"
echo "   2. Manually download Object Storage files from Replit pane"
echo "   3. Store everything in Google Drive/cloud storage"
echo ""
echo "⚠️ Don't forget: Object Storage files must be downloaded separately!"

# Clean up temporary folder
read -p "🗑️ Remove temporary backup folder? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -rf "$BACKUP_DIR"
    echo "✅ Temporary folder removed"
fi
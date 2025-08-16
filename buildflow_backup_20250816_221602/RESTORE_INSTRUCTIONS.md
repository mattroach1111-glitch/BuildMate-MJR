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

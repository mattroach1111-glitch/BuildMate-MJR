# User Account Merge Guide

## Duplicate Users Detected

Based on the database analysis, you have potentially duplicate user accounts:

1. **mattroach1111@gmail.com** (ID: 46214248) - Admin (currently logged in)
   - No first_name or last_name set
   - This appears to be your Replit authentication account

2. **matt@company.local** (ID: 7b40c2f3-595a-4b02-af84-33824fdb59a1) - Admin
   - first_name: "Matt"
   - This appears to be a company local account

## Recommended Actions

### Option 1: Merge Accounts (Recommended)
If these are the same person, you should:

1. **Keep the Replit account** (mattroach1111@gmail.com) as primary
2. **Transfer any data** from the company account to the Replit account
3. **Delete the duplicate** company account

### Option 2: Update Account Information
If you want to keep both accounts separate:

1. **Update the Replit account** with proper first/last name
2. **Clarify the purpose** of each account

## To Execute the Merge:

```sql
-- Update the Replit account with proper name information
UPDATE users 
SET first_name = 'Matt', last_name = 'Roach' 
WHERE id = '46214248';

-- If the company account has any important data, transfer it first
-- Then delete the duplicate account
DELETE FROM users WHERE id = '7b40c2f3-595a-4b02-af84-33824fdb59a1';
```

Would you like me to help you merge these accounts or update the account information?
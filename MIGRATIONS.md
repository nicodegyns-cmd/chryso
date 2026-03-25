# Database Migrations Guide

## Migration 011: Add Invitation and Onboarding Columns

**Status**: Required for eBrigade sync features to work

### What it does
Adds columns to the `users` table to support email invitations and onboarding tracking:
- `invitation_token` - Unique token for signup links
- `invitation_sent_at` - When the invitation was sent
- `invitation_expires_at` - When the invitation expires
- `onboarding_status` - Tracks user onboarding state
- `import_batch_id` - Groups users from bulk imports

### Error you'll see if missing
```
500 Error: Failed to sync selected users
Details: column "invitation_token" of relation "users" does not exist
```

### How to Apply

#### Option 1: Via API Endpoint (Recommended for Production/Vercel)

1. **Add migration token to Vercel**:
   ```bash
   vercel env add ADMIN_MIGRATION_TOKEN
   # Enter a secure random token, e.g.: mig_123456789abcdef
   ```

2. **Call the migration endpoint**:
   ```bash
   curl -X POST https://your-domain.vercel.app/api/admin/migrations/apply-011 \
     -H "Authorization: Bearer YOUR_MIGRATION_TOKEN"
   ```

3. **Response**:
   ```json
   {
     "success": true,
     "message": "Migration 011 applied successfully",
     "results": [...]
   }
   ```

#### Option 2: Via psql (Direct Database Access)

If you have direct access to your PostgreSQL database:

```bash
psql postgresql://user:password@host:5432/database < sql/011_add_invitation_onboarding_columns.sql
```

#### Option 3: Using a PostgreSQL Client (pgAdmin, DBeaver, etc.)

Open the SQL file `sql/011_add_invitation_onboarding_columns.sql` and run the statements in your database client.

### Verification

After applying the migration, verify it worked:

```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name='users' AND column_name IN (
  'invitation_token', 
  'invitation_sent_at', 
  'invitation_expires_at',
  'onboarding_status',
  'import_batch_id'
);
```

You should see 5 columns returned.

### Troubleshooting

**"column already exists" error**: This is safe - the migration uses `IF NOT EXISTS` and will skip columns that are already present.

**"relation users does not exist"**: Your database schema hasn't been initialized. Run all migrations from `001_*.sql` to `013_*.sql` in order.

**Connection failed**: Check your `DATABASE_URL` environment variable is correct.

## All Available Migrations

| File | Purpose | Status |
|------|---------|--------|
| 001_create_users_table.sql | Create users table | ✅ Core |
| 002_migrate_liaison_column.sql | Migrate liaison_eve_id → liaison_ebrigade_id | ✅ Core |
| 003_create_analytics_table.sql | Create analytics table | ✅ Core |
| 004_create_activities_table.sql | Create activities table | ✅ Core |
| 004_create_prestations_table.sql | Create prestations table | ✅ Core |
| 005_* | Add columns to prestations and activities | ✅ Core |
| 006_* | Add eBrigade ID fields | ✅ Core |
| 007_update_users_role_user_to_infi.sql | Update role values | ✅ Core |
| 008_create_roles_table.sql | Create roles lookup table | ✅ Core |
| 009_create_pdf_sends_table.sql | Create PDF batch tracking | ✅ Core |
| 010_add_sent_in_batch_to_prestations.sql | Link prestations to batch sends | ✅ Core |
| **011_add_invitation_onboarding_columns.sql** | **Add invitation columns (REQUIRED for sync)** | **⚠️ PENDING** |
| 011_update_old_prestations_status.sql | Update prestation status values | ✅ Core |
| 012_remove_code_unique_constraint.sql | Fix analytics uniqueness | ✅ Core |
| 013_add_ebrigade_activity_type_to_activities.sql | Add activity type tracking | ✅ Core |

## Quick Setup for New Environment

To setup a brand new database with all migrations:

```bash
# Using postgres_init.sql (all-in-one)
psql postgresql://user:password@host:5432/database < sql/postgres_init.sql

# Or apply migrations individually in order
for i in 001 002 003 004 005 006 007 008 009 010 011 011 012 013; do
  psql postgresql://user:password@host:5432/database < sql/${i}*.sql
done
```

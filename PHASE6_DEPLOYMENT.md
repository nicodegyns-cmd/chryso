# Phase 6: User Onboarding Deployment Guide

## Overview

Phase 6 implements a complete self-service user onboarding workflow for bulk registration of users without manual account creation. This solves the legal constraint that prevents fetching external user data while enabling efficient onboarding of 200+ users.

## Workflow

```
1. Admin imports CSV of user emails
2. System generates unique invitation tokens (32-byte hex)
3. Tokens expire in 7 days
4. User receives email with signup link
5. User completes form: personal info, professional info, password
6. User status: pending_signup → pending_validation
7. Admin reviews, completes: liaison_ebrigade_id, role, permissions
8. User status: pending_validation → active
```

## Pre-Deployment Checklist

### 1. Database Migration (⚠️ REQUIRED)

Run the migration to add onboarding tracking columns:

```bash
# Using your preferred database tool (psql, SQL client, etc.)
psql -U your_user -d your_database -f sql/011_add_invitation_onboarding_columns.sql

# Or via your application
node scripts/run_migrations.js
```

**What it does:**
- Adds 5 columns to `users` table:
  - `invitation_token` (VARCHAR 128) - signup link token
  - `invitation_sent_at` (TIMESTAMP) - when email was sent
  - `invitation_expires_at` (TIMESTAMP) - 7-day expiry  
  - `onboarding_status` (VARCHAR 50, default='active') - tracking status
  - `import_batch_id` (VARCHAR 100) - groups users from same import
- Creates 3 indexes for performance

### 2. Email Service Configuration (⚠️ CRITICAL)

Verify email configuration in your `.env.local`:

```env
# Email Provider (choose one: smtp, gmail, sendgrid)
EMAIL_PROVIDER=smtp

# For SMTP:
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASSWORD=your-password
SMTP_FROM=noreply@yourcompany.com
SMTP_SECURE=false

# OR for Gmail:
EMAIL_PROVIDER=gmail
GMAIL_USER=your-email@gmail.com
GMAIL_PASSWORD=your-app-password

# OR for SendGrid:
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-key

# Application URLs
APP_NAME=Fénix
APP_URL=https://your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

**Verification:**
```bash
# Check email service is accessible
npm run dev

# In browser, test admin users page
# Click "+ Importer CSV" button - should toggle the import form
```

### 3. npm Dependencies (✓ ALREADY INSTALLED)

Verify all required packages are present:

```bash
npm list bcryptjs nodemailer
```

Expected:
- ✓ `bcryptjs@2.4.3` - for password hashing
- ✓ `nodemailer` - for email delivery

### 4. File Creation (✓ DEPLOYED)

All Phase 6 files have been created:

**Database:**
- `sql/011_add_invitation_onboarding_columns.sql` - Migration

**APIs:**
- `pages/api/admin/users/bulk-import.js` - Validate CSV, create pending users
- `pages/api/admin/users/send-invitations.js` - Send email invitations
- `pages/api/admin/users/pending-validation.js` - List awaiting-validation users
- `pages/api/admin/users/[id]/validate.js` - Admin confirms user
- `pages/api/users/by-token.js` - Validate signup token
- `pages/api/users/complete-signup.js` - Save user profile data

**Components:**
- `components/BulkImportUsers.jsx` - CSV import UI (paste CSV, preview, import)
- `components/UserValidation.jsx` - Admin validation form

**Pages:**
- `pages/signup.jsx` - Public signup form (accessed via /signup?token=...)
- `pages/admin/validation.jsx` - Admin validation page
- `pages/admin/users.jsx` - Modified to include import button

## How to Use

### Step 1: Access Admin CSV Import

1. Navigate to **Utilisateurs** page
2. Click **+ Importer CSV** button
3. Paste CSV data in textarea

**CSV Format (4 columns):**
```
email,first_name,last_name,role
john@example.com,John,Doe,INFI
jane@example.com,Jane,Smith,MED
...
```

Optional `role` column - admin can set it later if not provided.

**Example data:**
```
paul.bernard@sirenaconsult.be,Paul,Bernard
marie.dubois@sirenaconsult.be,Marie,Dubois,INFI
francois.martin@sirenaconsult.be,François,Martin,MED
```

### Step 2: Review Preview and Import

1. CSV preview shows first 5 rows
2. Click **Importer** → system creates users with status `pending_signup`
3. System automatically sends invitation emails
4. Results show: created count, failed count, error details

### Step 3: User Completes Signup

User receives email with subject: **"Invitation à compléter votre profil"**

Email contains signup link: `https://your-domain.com/signup?token=...`

User clicks link and completes form:
- **Identifiant** (read-only): pre-filled email
- **Informations personnelles**: prénom, nom, téléphone, adresse
- **Informations professionnelles**: fonction, company
- **Sécurité**: password (min 6 chars), passwordConfirm

User submits → system stores data, sets status `pending_validation`

### Step 4: Admin Validates User

1. Go to **Validation utilisateurs** (new sidebar link)
2. See list of users awaiting validation
3. Click user to open modal
4. Complete: 
   - **Role** (required): INFI, MED, etc.
   - **liaison_ebrigade_id**: ID reference
   - **NISS**: Social security number
   - **BCE**: Business number
   - **Account**: Bank account
5. Click **Valider** → user status becomes `active`, `is_active=1`
6. Or click **Rejeter** → user deleted

## Deployment Steps

### 1. Pre-Deployment (Local Testing)

```bash
# 1. Ensure database migration is ready
# Check that sql/011_add_invitation_onboarding_columns.sql exists

# 2. Test email service locally
npm run dev

# 3. Navigate to admin/users and test CSV import UI
# Should see toggle button and import form

# 4. Test email service (if configured)
# Import test CSV and check email logs
```

### 2. Production Deployment

```bash
# 1. Update environment variables
# Edit .env.production with real SMTP/Gmail credentials
# Verify APP_URL points to production domain

# 2. Run database migration
# Execute in your PostgreSQL client
psql -U prod_user -d prod_database -f sql/011_add_invitation_onboarding_columns.sql

# 3. Deploy code
git push origin main
# (Vercel auto-deploys on main branch)

# 4. Verify endpoints are accessible
curl https://your-domain.com/signup?token=test
# Should redirect or show form (depending on token validity)

# 5. Test from Admin UI
# - Go to /admin/users
# - Click "+ Importer CSV"
# - Paste test CSV with 3-5 test users
# - Verify emails sent (check email inbox or logs)
```

## Architecture

### User Status Flow

```
pending_signup (email invitation sent)
    ↓
    (User completes form)
    ↓
pending_validation (awaiting admin review)
    ↓
    (Admin validates and sets permissions)
    ↓
active (full user account)
```

### Token Security

- **Generation**: 32-byte hex random token using `crypto.randomBytes(32).toString('hex')`
- **Expiry**: 7 days from creation (`NOW() + INTERVAL 7 DAY`)
- **Validation**: Token must not be expired and user status must be `pending_signup`
- **One-time use**: Token cleared after signup completion

### Password Security

- **Hashing**: bcryptjs with 10 salt rounds (industry standard)
- **Minimum length**: 6 characters (enforced on client)
- **Storage**: Only hashed values stored in database

## Troubleshooting

### Issue: CSV Import Shows But No Emails Send

**Cause**: Email service not configured

**Fix**:
1. Check `.env.local` has EMAIL_PROVIDER set
2. Check SMTP credentials are correct
3. Check logs: `console.log('[EmailService]')`
4. For testing, emails are logged to console if SMTP not configured

### Issue: Signup Link Returns 404

**Cause**: Token invalid or database migration not run

**Fix**:
1. Verify migration was executed: `SELECT invitation_token FROM users LIMIT 1;`
2. Check token hasn't expired (7-day window)
3. Check user status is `pending_signup`: `SELECT onboarding_status FROM users WHERE id=...;`

### Issue: Password Not Accepted at Signup

**Cause**: bcryptjs not properly imported or outdated version

**Fix**:
```bash
npm install bcryptjs@2.4.3
```

Restart dev server: `npm run dev`

### Issue: Admin Validation Page Shows No Users

**Cause**: No users in `pending_validation` status

**Check**:
```sql
# View pending validation users
SELECT id, email, onboarding_status FROM users 
WHERE onboarding_status = 'pending_validation';

# View all onboarding statuses
SELECT onboarding_status, COUNT(*) FROM users 
GROUP BY onboarding_status;
```

## CSV Import Validation Rules

| Field | Required | Rules |
|-------|----------|-------|
| email | Yes | Must be valid email format, unique |
| first_name | Yes | Non-empty string |
| last_name | Yes | Non-empty string |  
| role | No | If provided, must exist in roles table |

Validation errors are shown per-row with line numbers in the import results.

## Logs & Monitoring

### Email Service Logs

All email operations logged to console:

```
[EmailService] Email sent: { to: 'user@email.com', messageId: '...' }
[EmailService] Email would be sent: (if SMTP not configured)
[EmailService] Error sending email: Cannot find module...
```

### API Logs

- CSV Import: Logs per-user creation with token
- Signup: Logs password hash and status update
- Validation: Logs user confirmation and status change

## Security Considerations

### Data Privacy (Legal Compliance)

✓ **Solves legal constraint**: Users enter their own personal data on signup form
✓ **No external data fetching**: System never pulls PII from external sources  
✓ **Data minimalism**: Only required fields collected
✓ **User control**: Users can REJECT sign their data or admin can delete pending users

### Access Control

⚠️ **To-Do**: Add role-based authorization to validation page

Currently validation page accessible to any authenticated admin user.

Recommended restriction:
```javascript
// In pages/admin/validation.jsx
if (user.role !== 'ADMIN') return <Unauthorized />
```

## Audit & Compliance

### What's Tracked

- User creation timestamp (automatic)
- Invitation sent timestamp
- Token generation and expiry
- Number of users in each status
- Admin validation actions (user, timestamp)

### What's NOT Tracked (Could Add)

- Who imported CSV batch (could store user_id in import_batch)
- IP address of signup completion
- Admin approval comments/notes
- Rejection reason logs

## Optional Enhancements (Post-MVP)

1. **GDPR Consent Checkbox**
   - Add to signup form
   - Store `gdpr_consent_date` in users table
   - Display consent text in signup email

2. **Resend Invitation**
   - Endpoint to re-send expired/missing invitations
   - Admin UI button on validation page

3. **Bulk Import History**
   - Show past imports with stats
   - List: date, batch ID, total, status distribution

4. **Validation Comments**
   - Admin can add rejection reason
   - User receives follow-up email with reason

5. **Email Template Localization**
   - Currently French hardcoded
   - Could parameterize based on user lang preference

## Files Changed in Phase 6

### New Files (12)
- `sql/011_add_invitation_onboarding_columns.sql`
- `pages/api/admin/users/bulk-import.js`
- `pages/api/admin/users/send-invitations.js`
- `pages/api/admin/users/pending-validation.js`
- `pages/api/admin/users/[id]/validate.js`
- `pages/api/users/by-token.js`
- `pages/api/users/complete-signup.js`
- `pages/signup.jsx`
- `pages/admin/validation.jsx`
- `components/BulkImportUsers.jsx`
- `components/UserValidation.jsx`

### Modified Files (3)
- `components/AdminSidebar.jsx` - Added validation link
- `pages/admin/users.jsx` - Added import UI toggle
- `services/emailService.js` - Added generic `send()` function

## Support Resources

- Email config: See `EMAIL_CONFIG.md` in project root
- Database help: See `TEST_DATABASE.md`
- Email testing: See `SETUP_EMAIL_QUICK.md`

---

**Last Updated**: 2024
**Status**: Ready for deployment
**Dependencies**: bcryptjs, nodemailer, PostgreSQL migration

# Chryso - Prestation Management System

A full-stack personnel prestation management system for tracking work hours, remuneration, and invoicing.

## 📋 Overview

Chryso helps manage:
- **Personnel**: Infirmiers (Nurses), Médecins (Doctors), and Administrators
- **Prestations**: Work hours submission (Garde, APS, Permanence pay types)
- **Analytics**: Cost center tracking and reporting
- **Invoicing**: PDF generation and distribution

## 🚀 Stack

**Frontend**: Next.js (React)  
**Backend**: Next.js API Routes  
**Database**: PostgreSQL (Supabase)  
**Deployment**: Vercel (frontend + serverless functions)  
**Authentication**: Custom JWT + Google OAuth

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- npm or yarn
- PostgreSQL (local) or Supabase account (production)

### Setup

1. Clone repository:
```bash
git clone https://github.com/nicodegyns-cmd/chryso.git
cd chryso
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
```bash
# Copy the example file
cp .env.example .env.local

# Edit .env.local with your database connection
# For local MySQL:
DATABASE_URL=mysql://user:password@localhost:3306/chryso
# For Supabase PostgreSQL:
DATABASE_URL=postgresql://postgres:password@host:5432/postgres
```

4. Run migrations (if using fresh database):
```bash
# For Supabase: execute sql/postgres_init.sql in Supabase SQL Editor
# For local MySQL: execute all migration files in sql/ directory in order
```

5. Start dev server:
```bash
npm run dev
# Open http://localhost:3000/login
```

## 📁 Project Structure

```
├── pages/
│   ├── index.jsx              # Dashboard
│   ├── login.jsx              # Login page
│   ├── admin.jsx              # Admin panel
│   ├── api/                   # Backend API routes
│   │   ├── auth/              # Authentication
│   │   ├── admin/             # Admin operations
│   │   ├── prestations.js     # Prestation endpoints
│   │   └── analytics.js       # Analytics endpoints
│   └── admin/                 # Admin pages
│       ├── users.jsx
│       ├── prestations.jsx
│       ├── activities.jsx
│       └── analytics.jsx
├── components/                # React components
│   ├── LoginForm.jsx
│   ├── PrestationsTable.jsx
│   ├── AdminPanel.jsx
│   └── ...
├── services/
│   ├── db.js                  # Database pool (MySQL/PostgreSQL compatible)
│   ├── authService.js         # Auth utilities
│   └── userStore.js           # User storage
├── sql/                       # Database migrations
│   ├── postgres_init.sql      # PostgreSQL schema (from all migrations)
│   └── 001_*.sql             # Individual migrations (MySQL)
├── public/                    # Static files
└── styles/                    # Global CSS

```

## 🔄 Database Migration: MySQL → PostgreSQL

The application has been migrated from MySQL to PostgreSQL for Supabase compatibility.

### Changes
- Driver: `mysql2/promise` → `pg` (installed)
- Connection: Individual credentials → Connection string (DATABASE_URL)
- Service wrapper: `services/db.js` includes MySQL compatibility layer
- Placeholders: `?` → `$1, $2, ...` (automatic conversion)

### SQL Schema
All 12 MySQL migrations have been consolidated into `sql/postgres_init.sql` for PostgreSQL.

**Key tables:**
- `users`: Personnel profiles
- `prestations`: Work hour submissions
- `analytics`: Cost center codes
- `activities`: Activity types with remuneration
- `pdf_sends`: Invoice distribution history
- `roles`: User role reference

## 🌐 Deployment

### Local Development
```bash
npm run dev
# Visit http://localhost:3000
```

### Production on Vercel

1. **Prepare Supabase**:
   - Create account at https://supabase.com
   - Run migrations: `sql/postgres_init.sql` via Supabase SQL Editor
   - Get connection string from Database Settings

2. **Deploy to Vercel**:
   - Connect GitHub repository to Vercel
   - Add environment variable: `DATABASE_URL`
   - Deploy automatically on push to main

3. **Verify**:
   - Login page: `https://your-domain.vercel.app/login`
   - API health: `https://your-domain.vercel.app/api/ping`

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🔐 Security

⚠️ **Important**:
- Never commit `.env.production` or secrets to Git
- Use Vercel's "Environment Variables" for production secrets
- `.env.production` is in `.gitignore`
- Store credentials in `~/.env.local` (local development only)

## 📊 Key Features

### For Personnel
- Submit work hours (Garde, APS, Permanence)
- View prestation history and status
- Download invoices
- Manage profile information

### For Administrators  
- Manage personnel profiles
- Review and approve prestations
- Generate and send batch invoices
- View analytics and cost allocations
- Create and manage activities

### Prestation Types
- **Garde**: Night/weekend shift work
- **APS**: Specific activity projects
- **Permanence**: On-call availability

## 🧪 Testing

Test database connection:
```bash
npm run test:db
# Or see TEST_DATABASE.md for manual tests
```

## 🐛 Troubleshooting

### Connection Error
- Verify `DATABASE_URL` is correct
- Check PostgreSQL/Supabase is accessible
- For Supabase: verify SSL settings in settings

### Table Not Found
- Ensure migrations have been executed
- Check table names (case-sensitive in PostgreSQL)
- Verify you're connected to the correct database

### Query Errors
- The wrapper in `services/db.js` converts MySQL syntax to PostgreSQL
- Check MySQL query syntax if issues persist

## 📝 Configuration Files

- `.env.example` — Template for environment variables
- `.env.local` — Local development secrets (not committed)
- `.env.production` — Production secrets (via Vercel)
- `DEPLOYMENT_GUIDE.md` — Step-by-step deployment
- `TEST_DATABASE.md` — Database testing guide

## 🔗 Useful Links

- GitHub: https://github.com/nicodegyns-cmd/chryso
- Supabase: https://app.supabase.com
- Vercel: https://vercel.com/dashboard
- Next.js: https://nextjs.org

## 📄 License

Licensed under MIT.

## 👤 Author

- Main developer: Nicolas

---

**Current Status**: Production-Ready ✅  
**Database**: PostgreSQL 14+ (Supabase)  
**Last Updated**: 2025-03-10

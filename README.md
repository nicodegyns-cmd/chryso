# Chryso — Auth UI (Login Page)

Minimal Next.js scaffold for the login page. Contains:

- `pages/login.jsx` — page UI
- `components/LogoHeader.jsx`, `LoginForm.jsx`, `GoogleLoginButton.jsx`
- `services/authService.js` — frontend auth stubs
- `pages/api/auth/*` — backend stubs to implement

Quick start

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

Google OAuth (overview)

- Create Google OAuth credentials in Google Cloud Console.
- Configure a backend endpoint to start the OAuth redirect (we placed a stub at `/api/auth/google`).
- The backend should redirect the user to Google's OAuth consent screen and handle the callback, exchange code for tokens, then create or lookup the user and issue a session or JWT.
- On success the backend can redirect back to the frontend with a session cookie or a token.

Recommendations

- Use `next-auth` for a quick integration with providers (Google) and sessions.
- Store tokens securely (httpOnly cookies) rather than localStorage for production.

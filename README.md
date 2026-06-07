# Oterkpolu Mobile

Mobile-first Expo app for Oterkpolu report card workflows, built with Expo Router, React Native Web, and Supabase.

## Requirements

- Node.js
- npm
- Supabase project credentials

## Local Setup

Install dependencies:

```powershell
npm install
```

Create a local environment file from the example:

```powershell
Copy-Item .env.example .env
```

Then fill in:

```text
EXPO_PUBLIC_DIRECTORY_API_URL=
```

For local native testing, point this to the deployed Vercel app. For Vercel web, the app uses same-origin `/api` automatically.

Run the app:

```powershell
npm run web
```

## Checks

Type-check the project:

```powershell
npm run typecheck
```

Build the web export used by Vercel:

```powershell
npm run build:web
```

The production web output is generated in `dist`.

## Vercel Deployment

Recommended Vercel settings:

- Framework preset: Other
- Build command: `npm run build:web`
- Output directory: `dist`

If this folder is pushed as its own GitHub repository, leave the Vercel root directory blank. If it is pushed inside the larger desktop app repository, set the Vercel root directory to:

```text
mobile/oterkpolu-mobile
```

Add these server-side central directory environment variables in Vercel before deploying:

```text
CENTRAL_SUPABASE_URL
CENTRAL_SUPABASE_ANON_KEY
CENTRAL_SUPABASE_SERVICE_ROLE_KEY
ADMIN_PASSWORD
ADMIN_SESSION_SECRET
```

Do not add each school's own Supabase URL/key to Vercel. Schools enter their own Supabase values during setup.

For first-time school onboarding, the school admin enters the school name, school Supabase URL, and school Supabase anon key in the mobile setup screen. The Vercel API registers the school in the central directory, returns a teacher access code, and marks the school as pending until central approval.

Desktop installs use the same Vercel API for school-code lookup. Configure the desktop app environment with:

```text
OTERKPOLU_DIRECTORY_API_URL=https://your-vercel-app.vercel.app
```

## Supabase

The SQL setup files are included in:

- `supabase_mobile.sql`
- `supabase_central_directory.sql`

## Developer Admin

After deployment, open:

```text
https://your-vercel-app.vercel.app/admin
```

The admin dashboard uses `ADMIN_PASSWORD` for sign-in and server-side central Supabase credentials for school approvals, connection checks, and license generation.

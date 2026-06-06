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
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_SCHOOL_ID=
EXPO_PUBLIC_DIRECTORY_SUPABASE_URL=
EXPO_PUBLIC_DIRECTORY_SUPABASE_ANON_KEY=
```

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

Add these environment variables in Vercel before deploying:

```text
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_ANON_KEY
EXPO_PUBLIC_SCHOOL_ID
EXPO_PUBLIC_DIRECTORY_SUPABASE_URL
EXPO_PUBLIC_DIRECTORY_SUPABASE_ANON_KEY
```

## Supabase

The SQL setup files are included in:

- `supabase_mobile.sql`
- `supabase_central_directory.sql`

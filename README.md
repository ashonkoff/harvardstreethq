# Family HQ — Phase 2 Starter (Secure + Synced)

A tiny, deployable React + Vite app that uses **Supabase Auth (Google OAuth)** and **Row‑Level Security** to store family data in one shared **Family Space**. It includes:
- Google Sign‑In button
- Session persistence
- Notes, Tasks, and Subscriptions synced via Supabase
- Policies that keep all data scoped to your **single family space** (you + Eleanor)
- A placeholder for **Google Calendar**

> Deploy on Netlify the same way you did in Phase 1. This is a standard SPA build (Vite).

## 0) What you need
- A Supabase project with Google OAuth already set up (you did this in Phase 1).
- Your Supabase **API URL** and **anon key**.

## 1) Configure
Copy `.env.example` to `.env.local` (for local dev) and set your keys:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

No secrets beyond the anon key are required in the frontend.

## 2) Initialize database
Run the SQL in **supabase/schema.sql** and **supabase/policies.sql** in the Supabase SQL editor (or psql). Run schema first, then policies.

This will:
- Create a single `family_space`
- Create a `profiles` row for each user on first login
- Scope all app tables (notes, tasks, subscriptions) to the shared family space
- Enforce RLS so only members see/edit their family data

## 3) Develop locally

### Quick test (frontend only):
```bash
npm install
npm run dev
```
Open http://localhost:5173

### Full local testing (with Netlify functions):
**Recommended to test everything before deploying!**

1. Create `.env.local` file with these variables:
   ```bash
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Run:
   ```bash
   npm install
   npm run dev:full
   ```
   Opens http://localhost:8888 with full Netlify functions support

   This lets you test Calendar integration and all serverless functions locally **without using Netlify build credits!**

See `LOCAL_DEVELOPMENT.md` for more details.

## 4) Build & Deploy
```bash
npm run build
```
Deploy the generated **dist/** folder to Netlify.

**Netlify notes**
- This is an SPA. `netlify.toml` already includes a catch‑all redirect to `/index.html`.
- Set **Environment Variables** in Netlify:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

## 5) Google OAuth callback
You already verified this. The Vite dev server and Netlify production URL should both be in your Google OAuth Authorized redirect URIs list in the Supabase dashboard (Auth → URL Configuration).

---

## App structure
- `src/lib/supabase.ts` — Supabase client (browser)
- `src/components/SignIn.tsx` — Google sign in
- `src/components/RequireAuth.tsx` — gate to ensure login
- `src/components/Notes.tsx`, `Tasks.tsx`, `Subscriptions.tsx` — basic CRUD
- `src/components/CalendarPlaceholder.tsx` — reserved space for Google Calendar
- `supabase/schema.sql` + `supabase/policies.sql` — schema + RLS

---

## Roadmap (Phase 3 ideas)
- Connect Google Calendar read‑only via Google API on the server (Netlify function) using Supabase Auth JWT → OAuth token exchange.
- Add optimistic updates and offline cache (TanStack Query).

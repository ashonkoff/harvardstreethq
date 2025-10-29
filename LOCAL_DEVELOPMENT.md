# Local Development Guide

Test everything locally before deploying to save Netlify build credits!

## 🚀 Quick Start

1. **Install Netlify CLI** (one-time setup):
   ```bash
   npm install
   ```

2. **Create `.env.local` file** in the project root:
   ```bash
   # Copy from Netlify environment variables or Supabase dashboard
   VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_URL=https://YOUR-PROJECT.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

3. **Run full local development** (with Netlify functions):
   ```bash
   npm run dev:full
   ```
   This starts:
   - Your React app at http://localhost:8888
   - Netlify functions (calendar-events) at http://localhost:8888/.netlify/functions/calendar-events
   - Automatically loads environment variables from `.env.local`

4. **Test your app** - everything should work exactly like production!

## 📝 Workflow

**Daily development:**
- Make changes to your code
- Test locally with `npm run dev:full`
- Fix any issues
- When everything works, commit and push (triggers one deploy)

**Before deploying:**
- ✅ Test Calendar integration
- ✅ Test Tasks, Notes, Subscriptions
- ✅ Test authentication
- ✅ Check browser console for errors

## 🎯 Environment Variables

Get these values from:
- **Supabase**: Settings → API
  - `VITE_SUPABASE_URL` = Project URL
  - `VITE_SUPABASE_ANON_KEY` = anon/public key
  - `SUPABASE_URL` = Project URL (same as above)
  - `SUPABASE_SERVICE_ROLE_KEY` = service_role key

**Important:** Add `.env.local` to `.gitignore` (if it exists) so you don't commit secrets!

## 🔧 Troubleshooting

**Functions not working locally?**
- Make sure `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Restart `npm run dev:full` after adding env vars

**OAuth redirect issues?**
- Make sure `http://localhost:8888` is in your Supabase Google OAuth redirect URIs


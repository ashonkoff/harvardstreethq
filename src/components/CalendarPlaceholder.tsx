export function CalendarPlaceholder() {
  return (
    <div>
      <h2>Calendar (Coming Soon)</h2>
      <p className="small">
        This section will show a private Google Calendar view using your authenticated Google account.
        The current app already has Google OAuth via Supabase;
        the next step is adding a small Netlify server function to call Google Calendar API with your user’s token.
      </p>
    </div>
  )
}

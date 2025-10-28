# Google Calendar Integration Setup

## 🚀 Quick Setup Guide

Your Google Calendar integration is now ready! Here's what you need to do to get it working:

### 1. **Update Supabase OAuth Configuration**

In your Supabase dashboard:

1. Go to **Authentication** → **Providers** → **Google**
2. Add these additional scopes to your Google OAuth configuration:
   ```
   https://www.googleapis.com/auth/calendar.readonly
   ```
3. Save the configuration

### 2. **Set Up Environment Variables**

Add these to your Netlify environment variables (or `.env` file for local development):

```bash
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 3. **Deploy to Netlify**

The serverless function is already configured in `netlify/functions/calendar-events.js` and `netlify.toml`.

### 4. **Test the Integration**

1. Sign out and sign back in to get the new Google Calendar permissions
2. Navigate to the Calendar tab
3. You should see your Google Calendar events!

## 🎯 Features Included

- **Weekly View**: Shows current week's events
- **Week Navigation**: Navigate between weeks
- **Event Details**: Shows event titles, times, and locations
- **Today Highlighting**: Current day is highlighted
- **Event Statistics**: Quick stats for the week
- **Error Handling**: Graceful error messages and retry options

## 🔧 How It Works

1. **Frontend**: Calendar component fetches events via serverless function
2. **Serverless Function**: Handles Google Calendar API calls with proper authentication
3. **Authentication**: Uses your existing Supabase Google OAuth session
4. **Data Flow**: Supabase → Serverless Function → Google Calendar API → Frontend

## 🛠️ Troubleshooting

### "No Google access token found"
- Sign out and sign back in to refresh OAuth permissions
- Make sure you added the calendar scope to Supabase

### "Failed to fetch calendar events"
- Check that your Netlify environment variables are set
- Verify the serverless function deployed correctly

### "Google Calendar access expired"
- Your Google token expired - sign out and back in
- This is normal and will happen periodically

## 🎨 Customization

The Calendar component is fully customizable:
- Modify the week view layout
- Add event creation capabilities
- Integrate with your tasks/notes
- Add calendar selection (multiple calendars)

## 📱 Next Steps

Once this is working, we can add:
- Event creation and editing
- Multiple calendar support
- Calendar integration with tasks (due dates)
- Mobile-optimized views
- Calendar sharing with family members

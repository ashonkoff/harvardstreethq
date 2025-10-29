import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { action, timeMin, timeMax, calendarIds, googleAccessToken } = req.body

    // Basic validation
    if (!action) {
      return res.status(400).json({ error: 'action is required' })
    }

    // Validate Supabase user via Bearer token, but do not depend on server session
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' })
    }
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Require Google access token to be passed from client session (scoped with calendar.readonly)
    if (!googleAccessToken) {
      return res.status(400).json({ error: 'googleAccessToken is required' })
    }

    if (action === 'listCalendars') {
      const resp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' },
      })
      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google CalendarList error:', errorText)
        return res.status(resp.status).json({ error: 'Failed to fetch calendar list' })
      }
      const data = await resp.json()
      const calendars = (data.items || []).map((c: any) => ({
        id: c.id,
        summary: c.summary,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor,
        accessRole: c.accessRole,
      }))
      return res.status(200).json({ calendars })
    }

    if (action === 'listEvents') {
      if (!timeMin || !timeMax) {
        return res.status(400).json({ error: 'timeMin and timeMax are required' })
      }

      const ids: string[] = Array.isArray(calendarIds) && calendarIds.length > 0 ? calendarIds : ['primary']

      // Fetch events for each calendar, then merge
      const results = await Promise.all(ids.map(async (id) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`
        const r = await fetch(url, { headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' } })
        if (!r.ok) {
          const txt = await r.text()
          console.error('Google Events error:', id, txt)
          return { id, events: [], error: true }
        }
        const j = await r.json()
        const events = (j.items || []).map((event: any) => ({
          id: event.id,
          summary: event.summary || 'No Title',
          start: event.start,
          end: event.end,
          description: event.description,
          location: event.location,
          calendarId: id,
        }))
        return { id, events }
      }))

      // Merge all events into one list
      const merged = results.flatMap(r => r.events)
      return res.status(200).json({ events: merged })
    }

    return res.status(400).json({ error: 'Unknown action' })

  } catch (error) {
    console.error('Calendar API error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

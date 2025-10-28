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
    const { timeMin, timeMax } = req.body

    if (!timeMin || !timeMax) {
      return res.status(400).json({ error: 'timeMin and timeMax are required' })
    }

    // Get the authorization header
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No valid authorization header' })
    }

    const token = authHeader.replace('Bearer ', '')

    // Verify the Supabase JWT token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // Get user's Google access token from Supabase
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError || !sessionData.session) {
      return res.status(401).json({ error: 'No valid session' })
    }

    // Extract Google access token from the session
    const googleAccessToken = sessionData.session.provider_token

    if (!googleAccessToken) {
      return res.status(400).json({ 
        error: 'No Google access token found. Please re-authenticate with Google.' 
      })
    }

    // Call Google Calendar API
    const calendarResponse = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${encodeURIComponent(timeMin)}&` +
      `timeMax=${encodeURIComponent(timeMax)}&` +
      `singleEvents=true&` +
      `orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${googleAccessToken}`,
          'Accept': 'application/json',
        },
      }
    )

    if (!calendarResponse.ok) {
      const errorText = await calendarResponse.text()
      console.error('Google Calendar API error:', errorText)
      
      if (calendarResponse.status === 401) {
        return res.status(401).json({ 
          error: 'Google Calendar access expired. Please re-authenticate.' 
        })
      }
      
      return res.status(calendarResponse.status).json({ 
        error: 'Failed to fetch calendar events' 
      })
    }

    const calendarData = await calendarResponse.json()
    
    // Transform the events to our format
    const events = (calendarData.items || []).map((event: any) => ({
      id: event.id,
      summary: event.summary || 'No Title',
      start: event.start,
      end: event.end,
      description: event.description,
      location: event.location,
      calendarId: 'primary',
      calendarName: 'Primary Calendar',
    }))

    res.status(200).json({ events })

  } catch (error) {
    console.error('Calendar API error:', error)
    res.status(500).json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

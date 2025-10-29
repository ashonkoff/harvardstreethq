import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

export const handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    const { action, timeMin, timeMax, calendarIds, googleAccessToken } = body

    if (!action) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'action is required' }),
      }
    }

    const authHeader = event.headers.authorization || event.headers.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'No valid authorization header' }),
      }
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return {
        statusCode: 401,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'Invalid token' }),
      }
    }

    if (!googleAccessToken) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'googleAccessToken is required' }),
      }
    }

    if (action === 'listCalendars') {
      const resp = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' },
      })
      if (!resp.ok) {
        const errorText = await resp.text()
        console.error('Google CalendarList error:', errorText)
        return {
          statusCode: resp.status,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'Failed to fetch calendar list' }),
        }
      }
      const data = await resp.json()
      const calendars = (data.items || []).map((c) => ({
        id: c.id,
        summary: c.summary,
        primary: !!c.primary,
        backgroundColor: c.backgroundColor,
        accessRole: c.accessRole,
      }))
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ calendars }),
      }
    }

    if (action === 'listEvents') {
      if (!timeMin || !timeMax) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({ error: 'timeMin and timeMax are required' }),
        }
      }

      const ids = Array.isArray(calendarIds) && calendarIds.length > 0 ? calendarIds : ['primary']

      const results = await Promise.all(ids.map(async (id) => {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(id)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`
        const r = await fetch(url, { headers: { 'Authorization': `Bearer ${googleAccessToken}`, 'Accept': 'application/json' } })
        if (!r.ok) {
          const txt = await r.text()
          console.error('Google Events error:', id, txt)
          return { id, events: [], error: true }
        }
        const j = await r.json()
        const events = (j.items || []).map((event) => ({
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

      const merged = results.flatMap(r => r.events)
      return {
        statusCode: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ events: merged }),
      }
    }

    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Unknown action' }),
    }

  } catch (error) {
    console.error('Calendar API error:', error)
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
    }
  }
}
# Force rebuild

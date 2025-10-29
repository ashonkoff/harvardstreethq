import ICAL from 'ical.js'

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
    const { feedUrl, timeMin, timeMax } = body

    if (!feedUrl) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'feedUrl is required' }),
      }
    }

    if (!timeMin || !timeMax) {
      return {
        statusCode: 400,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'timeMin and timeMax are required' }),
      }
    }

    // Fetch the iCalendar feed
    const icsResponse = await fetch(feedUrl)
    
    if (!icsResponse.ok) {
      return {
        statusCode: icsResponse.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: `Failed to fetch iCalendar feed: ${icsResponse.statusText}` }),
      }
    }

    const icsText = await icsResponse.text()
    
    // Parse the iCalendar data
    const jcalData = ICAL.parse(icsText)
    const comp = new ICAL.Component(jcalData)
    const events = comp.getAllSubcomponents('vevent')

    const timeMinDate = new Date(timeMin)
    const timeMaxDate = new Date(timeMax)

    const parsedEvents = events
      .map(vevent => {
        const event = new ICAL.Event(vevent)
        const start = event.startDate.toJSDate()
        const end = event.endDate ? event.endDate.toJSDate() : start

        // Filter events within the time range
        if (start < timeMinDate || start > timeMaxDate) {
          return null
        }

        return {
          id: event.uid || event.startDate.toString(),
          summary: event.summary || 'No Title',
          description: event.description || '',
          start: {
            dateTime: event.startDate.isDate ? undefined : start.toISOString(),
            date: event.startDate.isDate ? start.toISOString().split('T')[0] : undefined,
          },
          end: {
            dateTime: event.endDate && !event.endDate.isDate ? end.toISOString() : undefined,
            date: event.endDate && event.endDate.isDate ? end.toISOString().split('T')[0] : undefined,
          },
          location: event.location || '',
        }
      })
      .filter(event => event !== null)

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ events: parsedEvents }),
    }

  } catch (error) {
    console.error('iCalendar feed error:', error)
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


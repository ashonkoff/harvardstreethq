import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, isToday, isTomorrow, parseISO, addDays } from 'date-fns'
import { Session } from '@supabase/supabase-js'

export interface CalendarEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end: {
    dateTime?: string
    date?: string
  }
  description?: string
  location?: string
  calendarId: string
  calendarName: string
}

export function Calendar({ session }: { session: Session | null }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())

  useEffect(() => {
    loadCalendarEvents()
  }, [selectedDate])

  async function loadCalendarEvents() {
    if (!session) {
      setError('Please sign in to view your calendar')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      // Get the current week's date range
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Monday
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }) // Sunday
      
      // For now, let's use a simpler approach with Google Calendar embed
      // This will work immediately without additional OAuth setup
      setEvents([]) // We'll show the embed instead
      setLoading(false)
      
    } catch (err) {
      console.error('Calendar error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load calendar')
      setLoading(false)
    }
  }

  function getEventTime(event: CalendarEvent) {
    const start = event.start.dateTime || event.start.date
    if (!start) return ''
    
    const eventDate = parseISO(start)
    
    if (isToday(eventDate)) return 'Today'
    if (isTomorrow(eventDate)) return 'Tomorrow'
    
    return format(eventDate, 'MMM d')
  }

  function getEventTimeRange(event: CalendarEvent) {
    if (event.start.date && event.end.date) {
      // All-day event
      return 'All day'
    }
    
    if (event.start.dateTime && event.end.dateTime) {
      const start = parseISO(event.start.dateTime)
      const end = parseISO(event.end.dateTime)
      
      return `${format(start, 'h:mm a')} - ${format(end, 'h:mm a')}`
    }
    
    return ''
  }

  function isEventToday(event: CalendarEvent) {
    const start = event.start.dateTime || event.start.date
    if (!start) return false
    
    return isToday(parseISO(start))
  }

  function isEventTomorrow(event: CalendarEvent) {
    const start = event.start.dateTime || event.start.date
    if (!start) return false
    
    return isTomorrow(parseISO(start))
  }

  function isEventOverdue(event: CalendarEvent) {
    const start = event.start.dateTime || event.start.date
    if (!start) return false
    
    const eventDate = parseISO(start)
    return eventDate < new Date() && !isToday(eventDate)
  }

  // Group events by day
  const eventsByDay = events.reduce((acc, event) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return acc
    
    const eventDate = parseISO(start)
    const dayKey = format(eventDate, 'yyyy-MM-dd')
    
    if (!acc[dayKey]) {
      acc[dayKey] = []
    }
    acc[dayKey].push(event)
    
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  // Get the current week's days
  const weekDays = []
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
  
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i))
  }

  if (loading) {
    return (
      <div className="card">
        <h3>📅 Calendar</h3>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
          Loading calendar events...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card">
        <h3>📅 Calendar</h3>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>
          <div style={{ marginBottom: 16 }}>⚠️ {error}</div>
          <button onClick={loadCalendarEvents} className="filter-btn">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>📅 Calendar</h2>
      
      {/* Calendar Options */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px' }}>Google Calendar Integration</h3>
            <div className="small" style={{ marginTop: 4 }}>
              Choose how you'd like to view your calendar
            </div>
          </div>
        </div>
      </div>

      {/* Calendar Embed */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 16px' }}>📅 Your Google Calendar</h3>
        <div style={{ 
          background: 'var(--bg-secondary)', 
          borderRadius: '12px', 
          padding: '20px',
          textAlign: 'center',
          border: '2px dashed var(--border)'
        }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '48px', marginBottom: 8 }}>📅</div>
            <h4 style={{ margin: '0 0 8px', color: 'var(--ink)' }}>Google Calendar Embed</h4>
            <p className="small" style={{ margin: '0 0 16px' }}>
              To embed your Google Calendar, you'll need to:
            </p>
          </div>
          
          <div style={{ textAlign: 'left', maxWidth: '400px', margin: '0 auto' }}>
            <div style={{ marginBottom: 12 }}>
              <strong>1.</strong> Go to <a href="https://calendar.google.com" target="_blank" rel="noopener noreferrer">Google Calendar</a>
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>2.</strong> Click the ⚙️ settings → "Settings and sharing"
            </div>
            <div style={{ marginBottom: 12 }}>
              <strong>3.</strong> Scroll down to "Integrate calendar"
            </div>
            <div style={{ marginBottom: 16 }}>
              <strong>4.</strong> Copy the "Public URL to this calendar"
            </div>
          </div>
          
          <div style={{ marginTop: 20 }}>
            <input
              placeholder="Paste your Google Calendar public URL here..."
              style={{ 
                width: '100%', 
                maxWidth: '500px',
                marginBottom: '12px'
              }}
            />
            <button className="filter-btn" style={{ marginLeft: '8px' }}>
              Embed Calendar
            </button>
          </div>
        </div>
      </div>

      {/* Alternative: Manual Calendar Entry */}
      <div className="card">
        <h3 style={{ margin: '0 0 16px' }}>📝 Quick Calendar Entry</h3>
        <p className="small" style={{ marginBottom: 16 }}>
          Add upcoming events directly to your Harvard Street Hub
        </p>
        
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Event title..."
            style={{ flex: 1 }}
          />
          <input
            type="date"
            style={{ width: '140px' }}
          />
          <input
            type="time"
            style={{ width: '100px' }}
          />
        </div>
        
        <div className="row">
          <input
            placeholder="Location (optional)..."
            style={{ flex: 1 }}
          />
          <button className="filter-btn">
            Add Event
          </button>
        </div>
      </div>
    </div>
  )
}

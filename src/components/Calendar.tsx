import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, isToday, isTomorrow, parseISO, addDays, addWeeks, subWeeks } from 'date-fns'
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
  calendarName?: string
}

export function Calendar({ session }: { session: Session | null }) {
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [calendars, setCalendars] = useState<{ id: string, summary: string, primary?: boolean }[]>([])
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([])

  useEffect(() => {
    loadCalendarEvents()
  }, [selectedDate, selectedCalendarIds])

  async function loadCalendarEvents() {
    if (!session) {
      setError('Please sign in to view your calendar')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 })
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 })

      // Get Supabase session to extract Google provider token
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access token not found. Please sign out and sign in again to grant calendar permissions.')
        setLoading(false)
        return
      }

      // Ensure calendars are loaded once (or when empty)
      if (calendars.length === 0) {
        const listResp = await fetch('/.netlify/functions/calendar-events', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ action: 'listCalendars', googleAccessToken: providerToken })
        })
        if (!listResp.ok) {
          const errorText = await listResp.text()
          console.error('Calendar list error:', errorText)
          let errorMsg = 'Failed to load calendar list'
          try {
            const errorJson = JSON.parse(errorText)
            errorMsg = errorJson.error || errorMsg
          } catch {
            errorMsg = errorText || errorMsg
          }
          throw new Error(`${errorMsg} (Status: ${listResp.status})`)
        }
        const listJson = await listResp.json()
        const list = (listJson.calendars || []) as { id: string, summary: string, primary?: boolean }[]
        setCalendars(list)
        if (selectedCalendarIds.length === 0 && list.length > 0) {
          const primary = list.find(c => c.primary)
          setSelectedCalendarIds([primary?.id || list[0].id])
        }
      }

      // Only fetch events if we have selected calendars
      if (selectedCalendarIds.length === 0) {
        setEvents([])
        setLoading(false)
        return
      }

      const resp = await fetch('/.netlify/functions/calendar-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'listEvents',
          googleAccessToken: providerToken,
          timeMin: weekStart.toISOString(),
          timeMax: weekEnd.toISOString(),
          calendarIds: selectedCalendarIds,
        })
      })
      if (!resp.ok) {
        if (resp.status === 401) throw new Error('Google Calendar access expired. Please re-authenticate.')
        const errorText = await resp.text()
        console.error('Calendar events error:', errorText)
        let errorMsg = 'Failed to fetch calendar events'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(`${errorMsg} (Status: ${resp.status})`)
      }
      const json = await resp.json()
      setEvents(json.events || [])
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
      
      {/* Controls: Week navigation */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="filter-btn" onClick={() => setSelectedDate(d => subWeeks(d, 1))}>← Prev</button>
            <div className="tag" style={{ background: 'var(--bg-secondary)', padding: '8px 12px' }}>
              Week of {format(weekStart, 'MMM d, yyyy')}
            </div>
            <button className="filter-btn" onClick={() => setSelectedDate(d => addWeeks(d, 1))}>Next →</button>
            <button className="filter-btn" onClick={() => setSelectedDate(new Date())}>Today</button>
          </div>
        </div>
      </div>

      {/* Calendar Selection */}
      {calendars.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Select Calendars</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {calendars.map(c => {
              const checked = selectedCalendarIds.includes(c.id)
              const displayName = c.summary || c.id.split('@')[0] || c.id
              return (
                <label 
                  key={c.id} 
                  style={{ 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `2px solid ${checked ? 'var(--accent)' : 'var(--border)'}`,
                    background: checked ? 'var(--bg-secondary)' : 'transparent',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!checked) e.currentTarget.style.borderColor = 'var(--border-light)'
                  }}
                  onMouseLeave={(e) => {
                    if (!checked) e.currentTarget.style.borderColor = 'var(--border)'
                  }}
                >
                  <input 
                    type="checkbox" 
                    checked={checked} 
                    onChange={(e) => {
                      const newIds = e.target.checked 
                        ? [...new Set([...selectedCalendarIds, c.id])]
                        : selectedCalendarIds.filter(id => id !== c.id)
                      if (newIds.length === 0) {
                        // Prevent deselecting all calendars
                        return
                      }
                      setSelectedCalendarIds(newIds)
                    }}
                    style={{ 
                      margin: 0,
                      width: '16px',
                      height: '16px',
                      cursor: 'pointer'
                    }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: checked ? 600 : 400 }}>
                    {displayName}
                    {c.primary && <span style={{ marginLeft: 4, opacity: 0.7 }}>(primary)</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      <div className="grid grid-3" style={{ gap: 20 }}>
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayEvents = (eventsByDay[key] || []).sort((a, b) => {
            const as = a.start.dateTime || a.start.date || ''
            const bs = b.start.dateTime || b.start.date || ''
            return as.localeCompare(bs)
          })
          const isTodayFlag = isToday(day)
          return (
            <div 
              key={key} 
              className="card" 
              style={{ 
                borderLeft: `4px solid ${isTodayFlag ? 'var(--accent)' : 'var(--border)'}`,
                minHeight: '150px'
              }}
            >
              <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: isTodayFlag ? 'var(--accent)' : 'var(--ink)' }}>
                {format(day, 'EEE, MMM d')}
                {isTodayFlag && <span style={{ marginLeft: 8, fontSize: '12px', fontWeight: 500 }}>(Today)</span>}
              </h3>
              <div style={{ marginTop: 8 }}>
                {dayEvents.length === 0 && (
                  <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>
                    No events
                  </div>
                )}
                {dayEvents.map(ev => (
                  <div 
                    key={ev.id} 
                    className="item" 
                    style={{ 
                      marginBottom: 8, 
                      padding: '10px 12px',
                      borderRadius: '8px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '14px' }}>{ev.summary}</div>
                      <div className="small" style={{ color: 'var(--ink-secondary)', fontSize: '12px' }}>
                        {getEventTimeRange(ev)}
                        {ev.location && (
                          <span style={{ marginLeft: 8 }}>📍 {ev.location}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note: Team sites calendars can be added if they are subscribed to in Google; they'll appear in the list above. */}
    </div>
  )
}

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
  const [calendars, setCalendars] = useState<{ id: string, summary: string, primary?: boolean, backgroundColor?: string }[]>([])
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
      // Use the selectedDate as the start date (can be in the past or future)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const selectedDateOnly = new Date(selectedDate)
      selectedDateOnly.setHours(0, 0, 0, 0)
      const startDate = selectedDateOnly
      const startDateOnly = new Date(startDate)
      startDateOnly.setHours(0, 0, 0, 0)
      const endDate = addDays(startDateOnly, 6)
      endDate.setHours(23, 59, 59, 999)

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
        const list = (listJson.calendars || []) as { id: string, summary: string, primary?: boolean, backgroundColor?: string }[]
        setCalendars(list)
        if (selectedCalendarIds.length === 0 && list.length > 0) {
          const family = list.find(c => (c.summary || '').toLowerCase() === 'family calendar')
          const primary = list.find(c => c.primary)
          setSelectedCalendarIds([family?.id || primary?.id || list[0].id])
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
          timeMin: startDateOnly.toISOString(),
          timeMax: endDate.toISOString(),
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

  // Group events by day (handle multi-day and all-day events)
  const eventsByDay = events.reduce((acc, event) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return acc
    
    const isAllDay = !!(event.start.date && event.end?.date)
    let startDate: Date
    let endDate: Date
    
    if (isAllDay && event.start.date) {
      // All-day events: end.date is exclusive (the day after it ends)
      startDate = parseISO(event.start.date)
      const endDateStr = event.end?.date
      if (!endDateStr) {
        endDate = startDate
      } else {
        endDate = parseISO(endDateStr)
        endDate.setDate(endDate.getDate() - 1) // Make end date inclusive
      }
    } else if (event.start.dateTime && event.end?.dateTime) {
      // Timed events that might span multiple days
      startDate = parseISO(event.start.dateTime)
      endDate = parseISO(event.end.dateTime)
    } else {
      // Single day timed event or fallback
      startDate = parseISO(start)
      endDate = startDate
    }
    
    // Add event to all days it spans
    let currentDate = new Date(startDate)
    currentDate.setHours(0, 0, 0, 0)
    const finalEndDate = new Date(endDate)
    finalEndDate.setHours(0, 0, 0, 0)
    
    while (currentDate <= finalEndDate) {
      const dayKey = format(currentDate, 'yyyy-MM-dd')
      if (!acc[dayKey]) {
        acc[dayKey] = []
      }
      acc[dayKey].push(event)
      currentDate = addDays(currentDate, 1)
    }
    
    return acc
  }, {} as Record<string, CalendarEvent[]>)

  // Build 7-day window starting from selectedDate (can be in the past)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const selectedDateOnly = new Date(selectedDate)
  selectedDateOnly.setHours(0, 0, 0, 0)
  const startDate = selectedDateOnly
  const startDateOnly = new Date(startDate)
  startDateOnly.setHours(0, 0, 0, 0)
  
  const weekDays = []
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(startDateOnly, i))
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
      <div className="row" style={{ alignItems: 'flex-start' }}>
        {/* Sidebar: Calendar selection */}
        {calendars.length > 0 && (
          <div className="card" style={{ width: 260, padding: 16, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: '14px', opacity: 0.9 }}>Calendars</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                      padding: '6px 8px',
                      borderRadius: '8px',
                      border: `1px solid ${checked ? (c.backgroundColor || 'var(--accent)') : 'var(--border)'}`,
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
                        width: '14px',
                        height: '14px',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ fontSize: '12px', fontWeight: checked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={displayName}>
                      {displayName}
                      {c.primary && <span style={{ marginLeft: 4, opacity: 0.7 }}>(primary)</span>}
                    </span>
                    {/* color dot */}
                    {c.backgroundColor && (
                      <span style={{ width: 10, height: 10, borderRadius: 9999, background: c.backgroundColor, border: '1px solid var(--border)' }} />
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex: 1 }}>
          {/* Controls: Week navigation */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                <button className="filter-btn" onClick={() => {
                  const newDate = new Date(selectedDate)
                  newDate.setDate(newDate.getDate() - 7)
                  setSelectedDate(newDate)
                }}>← Prev</button>
                <div className="tag" style={{ background: 'var(--bg-secondary)', padding: '8px 12px' }}>
                  {weekDays.length > 0 && format(weekDays[0], 'MMM d')} - {weekDays.length > 0 && format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}
                </div>
                <button className="filter-btn" onClick={() => setSelectedDate(d => addDays(d, 7))}>Next →</button>
                <button className="filter-btn" onClick={() => setSelectedDate(new Date())}>Today</button>
              </div>
            </div>
          </div>

          {/* Week view */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(230px, 1fr))', gap: 12 }}>
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
                    {dayEvents.map(ev => {
                      const calColor = calendars.find(c => c.id === ev.calendarId)?.backgroundColor || 'var(--accent)'
                      const isAllDay = !!(ev.start.date && ev.end?.date)
                      const spansMultipleDays = (() => {
                        if (isAllDay) return true
                        if (ev.start.dateTime && ev.end?.dateTime) {
                          const s = parseISO(ev.start.dateTime)
                          const e = parseISO(ev.end.dateTime)
                          const sd = new Date(s); sd.setHours(0,0,0,0)
                          const ed = new Date(e); ed.setHours(0,0,0,0)
                          return ed.getTime() > sd.getTime()
                        }
                        return false
                      })()
                      const special = isAllDay || spansMultipleDays
                      return (
                        <div 
                          key={ev.id} 
                          className="item" 
                          style={{ 
                            marginBottom: 8, 
                            padding: '10px 12px',
                            borderRadius: '8px',
                            background: special ? 'linear-gradient(135deg, rgba(255, 196, 0, 0.16) 0%, rgba(255, 196, 0, 0.08) 100%)' : 'var(--bg-secondary)',
                            border: special ? '1px solid var(--border)' : '1px solid var(--border)',
                            borderLeft: `4px solid ${calColor}`
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '14px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{ev.summary}</div>
                              {special && (
                                <span className="tag" style={{ marginLeft: 8, padding: '2px 6px', fontSize: 10, borderRadius: 9999 }}>All day</span>
                              )}
                            </div>
                            <div className="small" style={{ color: 'var(--ink-secondary)', fontSize: '12px', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
                              {getEventTimeRange(ev)}
                              {ev.location && (
                                <span style={{ marginLeft: 8, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>📍 {ev.location}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Note: Team sites calendars can be added if they are subscribed to in Google; they'll appear in the list above. */}
    </div>
  )
}

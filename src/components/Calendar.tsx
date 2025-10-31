import { useEffect, useState, useRef } from 'react'
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
  const [showCalendarDropdown, setShowCalendarDropdown] = useState(false)
  const [preferencesLoaded, setPreferencesLoaded] = useState(false)
  const isInitialLoadRef = useRef(true)

  useEffect(() => {
    loadCalendarEvents()
  }, [selectedDate, selectedCalendarIds])

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showCalendarDropdown) return
    
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as HTMLElement
      if (!target.closest('.calendar-dropdown-container')) {
        setShowCalendarDropdown(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showCalendarDropdown])

  // Auto-save preferences when selectedCalendarIds changes (but only after preferences are loaded and not during initial load)
  useEffect(() => {
    if (preferencesLoaded && selectedCalendarIds.length > 0 && calendars.length > 0 && !isInitialLoadRef.current) {
      // Use a small delay to batch rapid changes
      const timeoutId = setTimeout(() => {
        saveUserPreferences()
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [selectedCalendarIds, preferencesLoaded, calendars.length, session?.user?.id])

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
        
        // Load user preferences if not already loaded
        if (!preferencesLoaded && list.length > 0) {
          const preferencesWereLoaded = await loadUserPreferences(list)
          
          // Only set default if no preferences were loaded
          if (!preferencesWereLoaded && selectedCalendarIds.length === 0) {
            const family = list.find(c => (c.summary || '').toLowerCase() === 'family calendar')
            const primary = list.find(c => c.primary)
            setSelectedCalendarIds([family?.id || primary?.id || list[0].id])
            // Mark initial load as complete after setting default
            setTimeout(() => {
              isInitialLoadRef.current = false
            }, 100)
          }
        } else if (selectedCalendarIds.length === 0 && list.length > 0) {
          // Fallback: set default if calendars are loaded but none selected (shouldn't happen normally)
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

  function selectAllCalendars() {
    setSelectedCalendarIds(calendars.map(c => c.id))
  }

  function selectNoneCalendars() {
    // Can't have zero, so select just the first one
    if (calendars.length > 0) {
      setSelectedCalendarIds([calendars[0].id])
    }
  }

  async function loadUserPreferences(availableCalendars: { id: string, summary: string, primary?: boolean, backgroundColor?: string }[]) {
    if (!session?.user) return false
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('default_calendar_ids')
        .eq('user_id', session.user.id)
        .single()
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error loading user preferences:', error)
        setPreferencesLoaded(true)
        return false
      }
      
      if (data?.default_calendar_ids && Array.isArray(data.default_calendar_ids) && data.default_calendar_ids.length > 0) {
        // Filter to only include calendars that still exist
        const availableIds = new Set(availableCalendars.map(c => c.id))
        const validIds = data.default_calendar_ids.filter((id: string) => availableIds.has(id))
        
        if (validIds.length > 0) {
          setSelectedCalendarIds(validIds)
          setPreferencesLoaded(true)
          isInitialLoadRef.current = false // Mark that initial load is complete after state updates
          return true // Indicates preferences were loaded
        }
      }
      
      // No valid preferences found, mark as loaded so we don't try again
      setPreferencesLoaded(true)
      isInitialLoadRef.current = false
      return false // No preferences loaded
    } catch (err) {
      console.error('Error loading user preferences:', err)
      setPreferencesLoaded(true) // Mark as loaded even on error to prevent infinite retries
      isInitialLoadRef.current = false
      return false
    }
  }

  async function saveUserPreferences() {
    if (!session?.user || !preferencesLoaded) return
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ default_calendar_ids: selectedCalendarIds })
        .eq('user_id', session.user.id)
      
      if (error) {
        console.error('Error saving user preferences:', error)
      }
    } catch (err) {
      console.error('Error saving user preferences:', err)
    }
  }

  function toggleCalendar(calendarId: string) {
    const newIds = selectedCalendarIds.includes(calendarId)
      ? selectedCalendarIds.filter(id => id !== calendarId)
      : [...new Set([...selectedCalendarIds, calendarId])]
    
    // Prevent deselecting all calendars - if trying to deselect the last one, keep it selected
    if (newIds.length === 0 && selectedCalendarIds.length > 0) {
      return
    }
    
    setSelectedCalendarIds(newIds)
  }

  return (
    <div>
      <h2>📅 Calendar</h2>
      <div style={{ position: 'relative' }}>
        {/* Main content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Simple navigation links above calendar */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
            <button 
              onClick={() => {
                const newDate = new Date(selectedDate)
                newDate.setDate(newDate.getDate() - 7)
                setSelectedDate(newDate)
              }}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--accent)', 
                cursor: 'pointer', 
                fontSize: '13px',
                padding: '4px 8px',
                textDecoration: 'underline'
              }}
            >
              ← Prev
            </button>
            <span style={{ fontSize: '13px', color: 'var(--ink-secondary)' }}>
              {weekDays.length > 0 && format(weekDays[0], 'MMM d')} - {weekDays.length > 0 && format(weekDays[weekDays.length - 1], 'MMM d, yyyy')}
            </span>
            <button 
              onClick={() => setSelectedDate(d => addDays(d, 7))}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--accent)', 
                cursor: 'pointer', 
                fontSize: '13px',
                padding: '4px 8px',
                textDecoration: 'underline'
              }}
            >
              Next →
            </button>
            <button 
              onClick={() => setSelectedDate(new Date())}
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'var(--accent)', 
                cursor: 'pointer', 
                fontSize: '13px',
                padding: '4px 8px',
                textDecoration: 'underline'
              }}
            >
              Today
            </button>
            
            {/* Calendar dropdown */}
            {calendars.length > 0 && (
              <div className="calendar-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                <button 
                  onClick={() => setShowCalendarDropdown(!showCalendarDropdown)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--accent)', 
                    cursor: 'pointer', 
                    fontSize: '13px',
                    padding: '4px 8px',
                    textDecoration: 'underline'
                  }}
                >
                  Calendars ▼
                </button>
                
                {showCalendarDropdown && (
                  <div className="card" style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    right: 0,
                    marginTop: 8,
                    zIndex: 1000,
                    width: 220,
                    padding: 12,
                    maxHeight: '400px',
                    overflowY: 'auto'
                  }}>
                    <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                      <button 
                        onClick={selectAllCalendars}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: 'var(--accent)', 
                          cursor: 'pointer', 
                          fontSize: '12px',
                          padding: '4px 8px',
                          marginRight: 8
                        }}
                      >
                        All
                      </button>
                      <button 
                        onClick={selectNoneCalendars}
                        style={{ 
                          background: 'transparent', 
                          border: 'none', 
                          color: 'var(--accent)', 
                          cursor: 'pointer', 
                          fontSize: '12px',
                          padding: '4px 8px'
                        }}
                      >
                        None
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
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
                              onChange={() => toggleCalendar(c.id)}
                              style={{ 
                                margin: 0,
                                width: '14px',
                                height: '14px',
                                cursor: 'pointer',
                                flexShrink: 0
                              }}
                            />
                            <span style={{ fontSize: '12px', fontWeight: checked ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={displayName}>
                              {displayName}
                              {c.primary && <span style={{ marginLeft: 4, opacity: 0.7, fontSize: '11px' }}>(primary)</span>}
                            </span>
                            {c.backgroundColor && (
                              <span style={{ width: 10, height: 10, borderRadius: 9999, background: c.backgroundColor, border: '1px solid var(--border)', flexShrink: 0 }} />
                            )}
                          </label>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
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
                            border: '1px solid var(--border)',
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

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, endOfWeek, isToday, parseISO, addDays } from 'date-fns'
import { Session } from '@supabase/supabase-js'

export interface MealEvent {
  id: string
  summary: string
  start: {
    dateTime?: string
    date?: string
  }
  end?: {
    dateTime?: string
    date?: string
  }
  description?: string
  calendarId: string
}

export function MealPlan({ session }: { session: Session | null }) {
  const [events, setEvents] = useState<MealEvent[]>([])
  const [calendars, setCalendars] = useState<{ id: string, summary: string, primary?: boolean }[]>([])
  const [selectedCalendarId, setSelectedCalendarId] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadCalendars()
  }, [session])

  useEffect(() => {
    if (selectedCalendarId) {
      loadMealEvents()
    }
  }, [session, selectedCalendarId, selectedDate])

  async function loadCalendars() {
    if (!session) {
      setError('Please sign in to view your meal plan')
      setLoading(false)
      return
    }

    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access not granted. Please sign out and sign in again.')
        setLoading(false)
        return
      }

      const listResp = await fetch('/.netlify/functions/calendar-events', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'listCalendars', googleAccessToken: providerToken }),
      })

      if (!listResp.ok) {
        throw new Error('Failed to load calendar list')
      }

      const listJson = await listResp.json()
      const list = (listJson.calendars || []) as { id: string, summary: string, primary?: boolean }[]
      setCalendars(list)

      // Try to auto-select AnyList meal plan calendar
      const anyListCalendar = list.find(c => 
        c.summary.toLowerCase().includes('anylist') || 
        c.summary.toLowerCase().includes('meal') ||
        c.summary.toLowerCase().includes('recipe')
      )
      
      if (anyListCalendar) {
        setSelectedCalendarId(anyListCalendar.id)
      } else if (list.length > 0) {
        // If no AnyList calendar found, let user select
        setSelectedCalendarId(null)
      }
    } catch (err) {
      console.error('Calendar error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load calendars')
      setLoading(false)
    }
  }

  async function loadMealEvents() {
    if (!session || !selectedCalendarId) {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 }) // Sunday
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 }) // Saturday

      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access not granted.')
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
          calendarIds: [selectedCalendarId],
        }),
      })

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('Google Calendar access expired. Please re-authenticate.')
        const errorText = await resp.text()
        let errorMsg = 'Failed to fetch meal plan events'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(errorMsg)
      }

      const json = await resp.json()
      setEvents(json.events || [])
      setLoading(false)
    } catch (err) {
      console.error('Meal plan error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load meal plan')
      setLoading(false)
    }
  }

  // Group events by day
  const eventsByDay = events.reduce((acc, event) => {
    const start = event.start.dateTime || event.start.date
    if (!start) return acc
    
    try {
      const eventDate = parseISO(start)
      const dayKey = format(eventDate, 'yyyy-MM-dd')
      
      if (!acc[dayKey]) {
        acc[dayKey] = []
      }
      acc[dayKey].push(event)
    } catch {
      // Skip invalid dates
    }
    
    return acc
  }, {} as Record<string, MealEvent[]>)

  // Get the current week's days (Sunday to Saturday)
  const weekDays = []
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  
  for (let i = 0; i < 7; i++) {
    weekDays.push(addDays(weekStart, i))
  }

  // Parse meal from event summary/description
  function parseMeal(event: MealEvent) {
    const summary = event.summary || ''
    const description = event.description || ''
    
    // Try to extract meal type (Breakfast, Lunch, Dinner) and meal name
    const mealMatch = summary.match(/(Breakfast|Lunch|Dinner|Brunch|Snack):?\s*(.+)/i)
    if (mealMatch) {
      return {
        type: mealMatch[1],
        name: mealMatch[2].trim(),
        description: description || summary,
      }
    }
    
    // If no meal type found, assume it's the meal name
    return {
      type: 'Meal',
      name: summary || 'Untitled',
      description: description,
    }
  }

  if (loading && events.length === 0) {
    return (
      <div>
        <h2>🍽️ Meal Plan</h2>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Loading meal plan...
          </div>
        </div>
      </div>
    )
  }

  if (error && events.length === 0) {
    return (
      <div>
        <h2>🍽️ Meal Plan</h2>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>
            <div style={{ marginBottom: 16 }}>⚠️ {error}</div>
            <button onClick={loadCalendars} className="filter-btn">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>🍽️ Meal Plan</h2>
      
      {/* Calendar Selection */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button 
              className="filter-btn" 
              onClick={() => {
                const prevWeek = new Date(selectedDate)
                prevWeek.setDate(prevWeek.getDate() - 7)
                setSelectedDate(prevWeek)
              }}
            >
              ← Prev Week
            </button>
            <div className="tag" style={{ background: 'var(--bg-secondary)', padding: '8px 12px' }}>
              Week of {format(weekStart, 'MMM d, yyyy')}
            </div>
            <button 
              className="filter-btn" 
              onClick={() => {
                const nextWeek = new Date(selectedDate)
                nextWeek.setDate(nextWeek.getDate() + 7)
                setSelectedDate(nextWeek)
              }}
            >
              Next Week →
            </button>
            <button 
              className="filter-btn" 
              onClick={() => setSelectedDate(new Date())}
            >
              This Week
            </button>
          </div>
          
          {calendars.length > 0 && (
            <select
              value={selectedCalendarId || ''}
              onChange={(e) => setSelectedCalendarId(e.target.value || null)}
              style={{ minWidth: '200px' }}
            >
              <option value="">Select meal plan calendar...</option>
              {calendars.map(c => (
                <option key={c.id} value={c.id}>
                  {c.summary}
                </option>
              ))}
            </select>
          )}
        </div>
        
        {!selectedCalendarId && calendars.length > 0 && (
          <div style={{ marginTop: 12, padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
            <div className="small" style={{ color: 'var(--muted)' }}>
              <strong>Setup:</strong> To see your AnyList meal plan, first subscribe to the AnyList iCalendar feed in Google Calendar, then select that calendar above.
            </div>
          </div>
        )}
      </div>

      {/* Week View */}
      {selectedCalendarId && (
        <div className="grid grid-3" style={{ gap: 16 }}>
          {weekDays.map(day => {
            const key = format(day, 'yyyy-MM-dd')
            const dayMeals = (eventsByDay[key] || []).sort((a, b) => {
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
                  minHeight: '200px'
                }}
              >
                <h3 style={{ margin: '0 0 12px', fontSize: '16px', color: isTodayFlag ? 'var(--accent)' : 'var(--ink)' }}>
                  {format(day, 'EEE, MMM d')}
                  {isTodayFlag && <span style={{ marginLeft: 8, fontSize: '12px', fontWeight: 500 }}>(Today)</span>}
                </h3>
                
                <div style={{ marginTop: 8 }}>
                  {dayMeals.length === 0 && (
                    <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>
                      No meals planned
                    </div>
                  )}
                  
                  {dayMeals.map(meal => {
                    const parsed = parseMeal(meal)
                    return (
                      <div 
                        key={meal.id}
                        style={{ 
                          marginBottom: 12,
                          padding: '12px',
                          borderRadius: '8px',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <div style={{ fontWeight: 600, marginBottom: 4, fontSize: '14px', color: 'var(--accent)' }}>
                          {parsed.type}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 500 }}>
                          {parsed.name}
                        </div>
                        {parsed.description && parsed.description !== parsed.name && (
                          <div className="small" style={{ marginTop: 4, color: 'var(--muted)' }}>
                            {parsed.description}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {!selectedCalendarId && (
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            <div style={{ marginBottom: 16, fontSize: '48px' }}>🍽️</div>
            <h3 style={{ marginBottom: 12 }}>Set up your Meal Plan</h3>
            <p className="small" style={{ marginBottom: 16 }}>
              To display your AnyList meal plan, you'll need to:
            </p>
            <div style={{ textAlign: 'left', maxWidth: '500px', margin: '0 auto' }}>
              <div style={{ marginBottom: 12 }}>
                <strong>1.</strong> In AnyList, go to Settings → Meal Plan → Export
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>2.</strong> Copy the iCalendar feed URL
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>3.</strong> In Google Calendar, go to Settings → Add calendar → From URL
              </div>
              <div style={{ marginBottom: 12 }}>
                <strong>4.</strong> Paste the AnyList feed URL and add the calendar
              </div>
              <div>
                <strong>5.</strong> Return here and select your meal plan calendar above
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


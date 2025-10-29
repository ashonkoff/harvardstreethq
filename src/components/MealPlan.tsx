import { useEffect, useState } from 'react'
import { format, startOfWeek, endOfWeek, isToday, parseISO, addDays } from 'date-fns'

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
  location?: string
}

const MEAL_PLAN_FEED_KEY = 'harvard-street-meal-plan-feed-url'

export function MealPlan() {
  const [events, setEvents] = useState<MealEvent[]>([])
  const [feedUrl, setFeedUrl] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isSettingUp, setIsSettingUp] = useState(false)

  // Load saved feed URL on mount
  useEffect(() => {
    const saved = localStorage.getItem(MEAL_PLAN_FEED_KEY)
    if (saved) {
      setFeedUrl(saved)
      loadMealEvents(saved)
    } else {
      setIsSettingUp(true)
    }
  }, [])

  useEffect(() => {
    if (feedUrl) {
      loadMealEvents(feedUrl)
    }
  }, [selectedDate, feedUrl])

  async function loadMealEvents(url: string) {
    if (!url || url.trim() === '') {
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 }) // Sunday
      const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 }) // Saturday

      // In local dev with netlify dev, functions run on same port (8888)
      const isNetlifyDev = window.location.port === '8888' || window.location.hostname === 'localhost'
      const functionUrl = isNetlifyDev
        ? '/.netlify/functions/ical-feed'
        : '/.netlify/functions/ical-feed'
      
      const resp = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedUrl: url,
          timeMin: weekStart.toISOString(),
          timeMax: weekEnd.toISOString(),
        }),
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        let errorMsg = 'Failed to fetch meal plan'
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

  function handleSaveFeedUrl() {
    if (!feedUrl.trim()) {
      setError('Please enter a valid iCalendar feed URL')
      return
    }

    localStorage.setItem(MEAL_PLAN_FEED_KEY, feedUrl.trim())
    setIsSettingUp(false)
    loadMealEvents(feedUrl.trim())
  }

  function handleClearFeedUrl() {
    localStorage.removeItem(MEAL_PLAN_FEED_KEY)
    setFeedUrl('')
    setEvents([])
    setIsSettingUp(true)
    setError(null)
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

  if (isSettingUp) {
    return (
      <div>
        <h2>🍽️ Meal Plan</h2>
        
        <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)' }}>
          <h3 style={{ margin: '0 0 8px', color: 'white' }}>Set Up Your Meal Plan</h3>
          <p className="small" style={{ color: 'rgba(255,255,255,0.9)', margin: 0 }}>
            Connect your AnyList meal plan directly for instant updates (no 12-hour sync delay!)
          </p>
        </div>

        <div className="card">
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', marginBottom: 8, fontWeight: 500 }}>
              AnyList iCalendar Feed URL:
            </label>
            <input
              type="text"
              placeholder="https://..."
              value={feedUrl}
              onChange={(e) => setFeedUrl(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSaveFeedUrl()}
              style={{ width: '100%', marginBottom: 12 }}
            />
            <div className="small" style={{ marginBottom: 12, color: 'var(--muted)' }}>
              <strong>How to find it:</strong> In AnyList, go to Settings → Meal Plan → Export → Copy the iCalendar feed URL
            </div>
            <button 
              onClick={handleSaveFeedUrl}
              disabled={!feedUrl.trim()}
              className="filter-btn"
              style={{ width: '100%' }}
            >
              Save & Load Meal Plan
            </button>
          </div>

          {error && (
            <div style={{ padding: '12px', background: 'var(--danger)', color: 'white', borderRadius: '8px', marginTop: 12 }}>
              {error}
            </div>
          )}
        </div>
      </div>
    )
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
            <button onClick={() => loadMealEvents(feedUrl)} className="filter-btn" style={{ marginRight: 8 }}>
              Try Again
            </button>
            <button onClick={handleClearFeedUrl} className="filter-btn">
              Change Feed URL
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>🍽️ Meal Plan</h2>
      
      {/* Week Navigation */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-hover) 100%)' }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button 
              className="filter-btn" 
              onClick={() => {
                const prevWeek = new Date(selectedDate)
                prevWeek.setDate(prevWeek.getDate() - 7)
                setSelectedDate(prevWeek)
              }}
              style={{ background: 'white', color: 'var(--accent)' }}
            >
              ← Prev Week
            </button>
            <div className="tag" style={{ background: 'white', color: 'var(--accent)', padding: '8px 16px', fontWeight: 600 }}>
              Week of {format(weekStart, 'MMM d, yyyy')}
            </div>
            <button 
              className="filter-btn" 
              onClick={() => {
                const nextWeek = new Date(selectedDate)
                nextWeek.setDate(nextWeek.getDate() + 7)
                setSelectedDate(nextWeek)
              }}
              style={{ background: 'white', color: 'var(--accent)' }}
            >
              Next Week →
            </button>
            <button 
              className="filter-btn" 
              onClick={() => setSelectedDate(new Date())}
              style={{ background: 'white', color: 'var(--accent)' }}
            >
              This Week
            </button>
          </div>
          
          <button 
            onClick={handleClearFeedUrl}
            className="filter-btn"
            style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}
          >
            Change Feed URL
          </button>
        </div>
      </div>

      {/* Week View */}
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
                  <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '16px 0', textAlign: 'center' }}>
                    No meals planned
                  </div>
                )}
                
                {dayMeals.map(meal => {
                  const parsed = parseMeal(meal)
                  const mealTypeColors: Record<string, string> = {
                    'Breakfast': '#ffd93d',
                    'Lunch': '#6bcf7f',
                    'Dinner': '#ff6b6b',
                    'Brunch': '#ffc857',
                    'Snack': '#a8e6cf',
                  }
                  const mealColor = mealTypeColors[parsed.type] || 'var(--accent)'
                  
                  return (
                    <div 
                      key={meal.id}
                      style={{ 
                        marginBottom: 12,
                        padding: '14px',
                        borderRadius: '10px',
                        background: `linear-gradient(135deg, ${mealColor}15 0%, ${mealColor}05 100%)`,
                        border: `2px solid ${mealColor}40`,
                        borderLeft: `4px solid ${mealColor}`
                      }}
                    >
                      <div 
                        style={{ 
                          fontWeight: 700, 
                          marginBottom: 6, 
                          fontSize: '12px', 
                          color: mealColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {parsed.type}
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>
                        {parsed.name}
                      </div>
                      {parsed.description && parsed.description !== parsed.name && (
                        <div className="small" style={{ marginTop: 6, color: 'var(--muted)', lineHeight: '1.4' }}>
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
    </div>
  )
}

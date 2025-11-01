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
      const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Monday
      const weekEnd = addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), 4) // Friday

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

  function handleEditFeedUrl() {
    // Show setup screen but keep the current URL
    setIsSettingUp(true)
    setError(null)
  }

  function handleBack() {
    // Restore the saved URL if it exists
    const saved = localStorage.getItem(MEAL_PLAN_FEED_KEY)
    if (saved) {
      setFeedUrl(saved)
      setIsSettingUp(false)
      loadMealEvents(saved)
    } else {
      setIsSettingUp(true)
    }
    setError(null)
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

  // Get the current week's days (Monday to Friday)
  const weekDays = []
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }) // Monday
  
  for (let i = 0; i < 5; i++) {
    weekDays.push(addDays(weekStart, i))
  }

  // Parse meal from event summary/description
  function parseMeal(event: MealEvent) {
    const summary = event.summary || ''
    const description = event.description || ''
    
    // Try to extract meal type (Breakfast, Lunch, Dinner) and meal name
    const mealMatch = summary.match(/(Breakfast|Lunch|Dinner|Brunch|Snack):?\s*(.+)/i)
    if (mealMatch) {
      const extractedName = mealMatch[2].trim()
      // Only include description if it's different from the summary and contains additional info
      const hasAdditionalDescription = description && 
        description.trim() !== summary.trim() && 
        description.trim().toLowerCase() !== extractedName.toLowerCase()
      
      return {
        type: mealMatch[1],
        name: extractedName,
        description: hasAdditionalDescription ? description : null,
      }
    }
    
    // If no meal type found, assume it's the meal name
    const hasAdditionalDescription = description && description.trim() !== summary.trim()
    return {
      type: 'Meal',
      name: summary || 'Untitled',
      description: hasAdditionalDescription ? description : null,
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
            <div style={{ display: 'flex', gap: 8 }}>
              <button 
                onClick={handleSaveFeedUrl}
                disabled={!feedUrl.trim()}
                className="filter-btn"
                style={{ flex: 1 }}
              >
                Save & Load Meal Plan
              </button>
              {localStorage.getItem(MEAL_PLAN_FEED_KEY) && (
                <button 
                  onClick={handleBack}
                  className="filter-btn"
                  style={{ background: 'var(--bg-secondary)', color: 'var(--ink)' }}
                >
                  Back
                </button>
              )}
            </div>
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
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', position: 'relative' }}>
        <button 
          onClick={() => {
            const prevWeek = new Date(selectedDate)
            prevWeek.setDate(prevWeek.getDate() - 7)
            setSelectedDate(prevWeek)
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
          onClick={() => {
            const nextWeek = new Date(selectedDate)
            nextWeek.setDate(nextWeek.getDate() + 7)
            setSelectedDate(nextWeek)
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
      </div>

      {/* Week View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
        {weekDays.map(day => {
          const key = format(day, 'yyyy-MM-dd')
          const dayMeals = (eventsByDay[key] || []).sort((a, b) => {
            const as = a.start.dateTime || a.start.date || ''
            const bs = b.start.dateTime || b.start.date || ''
            return as.localeCompare(bs)
          })
          const isTodayFlag = isToday(day)
          const dayStart = new Date(day)
          dayStart.setHours(0, 0, 0, 0)
          const now = new Date()
          now.setHours(0, 0, 0, 0)
          const isPastDay = dayStart < now && !isTodayFlag
          
          return (
            <div 
              key={key} 
              className="card" 
              style={{ 
                borderLeft: `4px solid ${isTodayFlag ? 'var(--accent)' : 'var(--border)'}`,
                minHeight: '150px',
                opacity: isPastDay ? 0.5 : 1,
                filter: isPastDay ? 'grayscale(0.3)' : 'none',
                transition: 'opacity 0.2s ease, filter 0.2s ease'
              }}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '14px', color: isTodayFlag ? 'var(--accent)' : 'var(--ink)' }}>
                {format(day, 'EEE, MMM d')}
                {isTodayFlag && <span style={{ marginLeft: 6, fontSize: '11px', fontWeight: 500 }}>(Today)</span>}
              </h3>
              
              <div style={{ marginTop: 6 }}>
                {dayMeals.length === 0 && (
                  <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0', textAlign: 'center', fontSize: '11px' }}>
                    No meals
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
                        marginBottom: 8,
                        padding: '10px',
                        borderRadius: '8px',
                        background: `linear-gradient(135deg, ${mealColor}15 0%, ${mealColor}05 100%)`,
                        border: `2px solid ${mealColor}40`,
                        borderLeft: `4px solid ${mealColor}`
                      }}
                    >
                      <div 
                        style={{ 
                          fontWeight: 700, 
                          marginBottom: 4, 
                          fontSize: '11px', 
                          color: mealColor,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px'
                        }}
                      >
                        {parsed.type}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--ink)', marginBottom: 2, lineHeight: 1.3 }}>
                        {parsed.name}
                      </div>
                      {parsed.description && (
                        <div className="small" style={{ marginTop: 4, color: 'var(--muted)', lineHeight: '1.3', fontSize: '11px' }}>
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

      {/* Change Feed URL Button */}
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-start' }}>
        <button 
          onClick={handleEditFeedUrl}
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
          Change calendar URL
        </button>
      </div>
    </div>
  )
}

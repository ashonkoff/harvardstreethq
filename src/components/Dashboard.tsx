import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays, startOfWeek, endOfWeek, isToday, parseISO } from 'date-fns'
import type { Session } from '@supabase/supabase-js'
import type { Note } from '../types'

// Reuse keys/flows used elsewhere
const MEAL_PLAN_FEED_KEY = 'harvard-street-meal-plan-feed-url'

type GoogleTask = {
  id: string
  title: string
  notes?: string
  status: 'completed' | 'needsAction'
  due?: string
  taskListId: string
}

type CalendarSummaryEvent = {
  id: string
  summary: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  location?: string
}

type DashboardProps = {
  session: Session | null
  onNavigate: (tab: 'dashboard' | 'tasks' | 'notes' | 'subscriptions' | 'calendar' | 'mealplan') => void
}

export function Dashboard({ session, onNavigate }: DashboardProps) {
  // Google Tasks (snapshot)
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [tasksError, setTasksError] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [isAddingTaskQuick, setIsAddingTaskQuick] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)

  // Notes (snapshot)
  const [notes, setNotes] = useState<Note[]>([])
  const [notesError, setNotesError] = useState<string | null>(null)
  const [newNoteText, setNewNoteText] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)

  // Compact calendar (3-day) — Family calendar preferred
  const [calEvents, setCalEvents] = useState<CalendarSummaryEvent[]>([])
  const [calError, setCalError] = useState<string | null>(null)

  // Meal plan (Mon–Fri row)
  const [mealEvents, setMealEvents] = useState<Record<string, { type: string; name: string }[]>>({})
  const [mealError, setMealError] = useState<string | null>(null)

  useEffect(() => {
    loadGoogleTasks()
    loadNotes()
    loadCompactCalendar()
    loadMealPlanRow()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  // ---- Notes (snapshot) ----
  async function loadNotes() {
    try {
      const { data, error } = await supabase.from('notes').select('*').order('created_at', { ascending: false })
      if (error) throw error
      setNotes(data || [])
      setNotesError(null)
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to load notes')
    }
  }

  async function addNoteQuick() {
    if (!newNoteText.trim()) return
    setIsAddingNote(true)
    try {
      const { error } = await supabase.from('notes').insert({ content: newNoteText.trim() })
      if (error) throw error
      setNewNoteText('')
      await loadNotes()
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to add note')
    } finally {
      setIsAddingNote(false)
    }
  }

  async function deleteNoteQuick(id: string) {
    try {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
      await loadNotes()
    } catch (err) {
      setNotesError(err instanceof Error ? err.message : 'Failed to delete note')
    }
  }

  // ---- Google Tasks (compact) ----
  async function loadGoogleTasks() {
    try {
      if (!session) return
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      if (!providerToken) {
        setTasksError('Google access not granted. Sign out/in to re‑link.')
        return
      }
      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'listTasks', googleAccessToken: providerToken, taskListId: '@default' }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      const json = await resp.json()
      const all: GoogleTask[] = (json.tasks || []).map((t: any) => ({
        id: t.id,
        title: t.title,
        notes: t.notes,
        status: t.status,
        due: t.due,
        taskListId: '@default',
      }))
      const active = all.filter(t => t.status === 'needsAction')
      const completed = all.filter(t => t.status === 'completed')
      setTasks([...active, ...completed])
      setTasksError(null)
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to load tasks')
    }
  }

  async function toggleGoogleTaskStatus(task: GoogleTask) {
    try {
      if (!session) return
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      if (!providerToken) return
      const newStatus = task.status === 'completed' ? 'needsAction' : 'completed'
      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'updateTask',
          googleAccessToken: providerToken,
          taskListId: task.taskListId,
          taskId: task.id,
          taskData: { status: newStatus },
        }),
      })
      if (!resp.ok) throw new Error('Failed to update task')
      await loadGoogleTasks()
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  async function deleteGoogleTask(task: GoogleTask) {
    try {
      if (!session) return
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      if (!providerToken) return
      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'deleteTask',
          googleAccessToken: providerToken,
          taskListId: task.taskListId,
          taskId: task.id,
        }),
      })
      if (!resp.ok) throw new Error('Failed to delete task')
      await loadGoogleTasks()
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  async function addGoogleTaskQuick() {
    if (!newTaskTitle.trim() || !session) return
    setIsAddingTaskQuick(true)
    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      if (!providerToken) throw new Error('Google access not granted')

      const taskData: any = { title: newTaskTitle.trim() }
      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'createTask',
          googleAccessToken: providerToken,
          taskListId: '@default',
          taskData,
        }),
      })
      if (!resp.ok) throw new Error(await resp.text())
      setNewTaskTitle('')
      await loadGoogleTasks()
    } catch (err) {
      setTasksError(err instanceof Error ? err.message : 'Failed to add task')
    } finally {
      setIsAddingTaskQuick(false)
    }
  }

  // ---- Calendar (3-day, Family pref) ----
  async function loadCompactCalendar() {
    try {
      if (!session) return
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      if (!providerToken) {
        setCalError('Google access not granted. Sign out/in to re‑link.')
        return
      }

      const listResp = await fetch('/.netlify/functions/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({ action: 'listCalendars', googleAccessToken: providerToken })
      })
      if (!listResp.ok) throw new Error(await listResp.text())
      const listJson = await listResp.json()
      const calendars: { id: string; summary: string; primary?: boolean }[] = listJson.calendars || []
      const family = calendars.find(c => (c.summary || '').toLowerCase().includes('family'))
      const selectedId = family?.id || calendars.find(c => c.primary)?.id || calendars[0]?.id
      if (!selectedId) { setCalEvents([]); return }

      const now = new Date()
      const end = addDays(now, 3)
      const eventsResp = await fetch('/.netlify/functions/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'listEvents',
          googleAccessToken: providerToken,
          timeMin: now.toISOString(),
          timeMax: end.toISOString(),
          calendarIds: [selectedId],
        })
      })
      if (!eventsResp.ok) throw new Error(await eventsResp.text())
      const evJson = await eventsResp.json()
      setCalEvents((evJson.events || []) as CalendarSummaryEvent[])
      setCalError(null)
    } catch (err) {
      setCalError(err instanceof Error ? err.message : 'Failed to load calendar')
    }
  }

  const eventsByDay = useMemo(() => {
    const map: Record<string, CalendarSummaryEvent[]> = {}
    for (const ev of calEvents) {
      const start = ev.start.dateTime || ev.start.date
      if (!start) continue
      const d = format(parseISO(start), 'yyyy-MM-dd')
      if (!map[d]) map[d] = []
      map[d].push(ev)
    }
    return map
  }, [calEvents])

  function formatCompactTime(ev: CalendarSummaryEvent) {
    const isAllDay = !!(ev.start.date && ev.end?.date)
    if (isAllDay) return 'All day'
    try {
      const s = ev.start.dateTime ? parseISO(ev.start.dateTime) : (ev.start.date ? parseISO(ev.start.date) : null)
      const e = ev.end?.dateTime ? parseISO(ev.end.dateTime) : (ev.end?.date ? parseISO(ev.end.date) : null)
      if (!s && !e) return ''
      const fmt = (d: Date) => format(d, 'h:mm a')
      if (s && e) return `${fmt(s)}–${fmt(e)}`
      if (s) return fmt(s)
      if (e) return fmt(e)
      return ''
    } catch {
      return ''
    }
  }

  function eventChipStyle(ev: CalendarSummaryEvent): React.CSSProperties {
    const isAllDay = !!(ev.start.date && ev.end?.date)
    return {
      background: isAllDay ? 'linear-gradient(135deg, #4a90e226 0%, #4a90e213 100%)' : 'var(--bg-secondary)',
      border: isAllDay ? 'none' : '1px solid var(--border)',
      color: 'var(--ink)',
      borderRadius: 10,
      padding: '6px 8px',
      display: 'block',
      marginBottom: 4,
      lineHeight: 1.25,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
    }
  }

  // ---- Meal Plan (Mon–Fri row) ----
  async function loadMealPlanRow() {
    try {
      const feedUrl = localStorage.getItem(MEAL_PLAN_FEED_KEY) || ''
      if (!feedUrl) return
      const start = startOfWeek(new Date(), { weekStartsOn: 1 })
      const end = endOfWeek(new Date(), { weekStartsOn: 1 })
      const resp = await fetch('/.netlify/functions/ical-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedUrl, timeMin: start.toISOString(), timeMax: end.toISOString() })
      })
      if (!resp.ok) throw new Error(await resp.text())
      const json = await resp.json()
      const byDay: Record<string, { type: string; name: string }[]> = {}
      for (const e of (json.events || [])) {
        const startStr = e.start.dateTime || e.start.date
        if (!startStr) continue
        const dKey = format(parseISO(startStr), 'yyyy-MM-dd')
        const parsed = parseMeal(e.summary || '', e.description || '')
        if (!byDay[dKey]) byDay[dKey] = []
        byDay[dKey].push({ type: parsed.type, name: parsed.name })
      }
      setMealEvents(byDay)
      setMealError(null)
    } catch (err) {
      setMealError(err instanceof Error ? err.message : 'Failed to load meal plan')
    }
  }

  function parseMeal(summary: string, description: string) {
    const m = summary.match(/(Breakfast|Lunch|Dinner|Brunch|Snack):?\s*(.+)/i)
    if (m) return { type: m[1], name: (m[2] || '').trim(), description }
    return { type: 'Meal', name: summary || 'Untitled', description }
  }

  const threeDays = useMemo(() => {
    const days: Date[] = []
    const start = new Date()
    for (let i = 0; i < 3; i++) days.push(addDays(start, i))
    return days
  }, [])

  function taskIcon(status: GoogleTask['status']) {
    return status === 'completed' ? '✅' : '⭕'
  }

  return (
    <div>
      <div className="surface" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr', gap: 16, marginLeft: 'auto', marginRight: 'auto', width: '100%' }}>
        {/* Left column: Calendar (3-day) + Meal Plan (Mon–Fri single row) */}
        <div style={{ display: 'grid', gap: 12 }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>📅 Next 3 Days</h3>
              <button className="filter-btn" onClick={() => onNavigate('calendar')}>See full calendar →</button>
            </div>
            {calError ? (
              <div className="small" style={{ color: 'var(--danger)' }}>{calError}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 230px)', gap: 8, overflowX: 'auto' }}>
                {threeDays.map(day => {
                  const key = format(day, 'yyyy-MM-dd')
                  const dayEvents = (eventsByDay[key] || []).sort((a, b) => {
                    const as = a.start.dateTime || a.start.date || ''
                    const bs = b.start.dateTime || b.start.date || ''
                    return as.localeCompare(bs)
                  })
                  const todayFlag = isToday(day)
                  return (
                    <div key={key} style={{ width: 230, border: 1 + 'px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--bg-secondary)' }}>
                      <div style={{ fontWeight: 700, color: todayFlag ? 'var(--accent)' : 'var(--ink)', marginBottom: 4 }}>
                        {format(day, 'EEE, MMM d')}{todayFlag ? ' (Today)' : ''}
          </div>
                      <div>
                        {dayEvents.length === 0 && (
                          <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No events</div>
                        )}
                        {dayEvents.map(ev => (
                          <div key={ev.id} style={eventChipStyle(ev)}>
                            <span className="small" style={{ opacity: 0.98, color: 'var(--ink)', marginRight: 6 }}>{formatCompactTime(ev)}</span>
                            <span className="small" style={{ opacity: 1, color: 'var(--ink)' }}>{ev.summary}</span>
        </div>
                        ))}
          </div>
        </div>
                  )
                })}
          </div>
            )}
          </div>
          
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>🍽️ Meal Plan (Mon–Fri)</h3>
              <button className="filter-btn" onClick={() => onNavigate('mealplan')}>Open meal plan →</button>
          </div>
            {mealError ? (
              <div className="small" style={{ color: 'var(--danger)' }}>{mealError}</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {Array.from({ length: 5 }).map((_, i) => {
                  const d = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)
                  const key = format(d, 'yyyy-MM-dd')
                  const items = mealEvents[key] || []
                  return (
                    <div key={key} style={{ border: 1 + 'px solid var(--border)', borderRadius: 12, padding: 10, background: 'var(--bg-secondary)' }}>
                      <div style={{ fontWeight: 700 }}>{format(d, 'EEE')}</div>
                      <div style={{ marginTop: 6 }}>
                        {items.length === 0 && (
                          <div className="small" style={{ color: 'var(--muted)', fontStyle: 'italic' }}>No meals</div>
                        )}
                        {items.slice(0, 2).map((m, idx) => (
                          <div key={idx} className="small" style={{ marginBottom: 4, color: 'var(--ink)' }}>
                            <span style={{ opacity: 0.95, color: 'var(--ink)' }}>{m.type}:</span> {m.name}
              </div>
            ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column: To do (Google Tasks) + Notes */}
        <div style={{ display: 'grid', gap: 12, alignSelf: 'start' }}>
          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>📋 To do</h3>
              <div className="row" style={{ gap: 8 }}>
                <button className="filter-btn" onClick={() => setShowAddTask(s => !s)}>{showAddTask ? '×' : '＋'}</button>
                <button className="filter-btn" onClick={() => onNavigate('tasks')}>Open To do →</button>
              </div>
          </div>
            {tasksError ? (
              <div className="small" style={{ color: 'var(--danger)' }}>{tasksError}</div>
            ) : (
              <>
                {showAddTask && (
                  <div className="row" style={{ marginBottom: 8 }}>
            <input
                      placeholder="New task…"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isAddingTaskQuick && newTaskTitle.trim() && addGoogleTaskQuick()}
              style={{ flex: 1 }}
            />
            <button 
                      onClick={addGoogleTaskQuick}
                      disabled={isAddingTaskQuick || !newTaskTitle.trim()}
                      className="filter-btn"
                      style={{ padding: '8px 12px' }}
                    >
                      {isAddingTaskQuick ? 'Adding…' : 'Add'}
            </button>
                  </div>
                )}
              <div style={{ display: 'grid', gap: 6 }}>
                {tasks.length === 0 && (
                  <div className="small" style={{ color: 'var(--muted)' }}>No tasks</div>
                )}
                {tasks.map(t => (
                <div key={t.id} className="item" style={{ padding: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <input 
                      type="checkbox" 
                      checked={t.status === 'completed'} 
                      onChange={() => toggleGoogleTaskStatus(t)}
                      style={{ width: 16, height: 16, cursor: 'pointer' }}
                    />
                    <div style={{ fontSize: 14, color: 'var(--ink)', textDecoration: t.status === 'completed' ? 'line-through' : 'none', opacity: t.status === 'completed' ? 0.6 : 1 }}>{t.title}</div>
                  </div>
                  <button className="icon-btn icon-btn-light" style={{ padding: '4px 8px', fontSize: 12 }} onClick={() => deleteGoogleTask(t)}>×</button>
              </div>
            ))}
              </div>
              </>
            )}
          </div>

          <div className="card" style={{ padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>📝 Notes</h3>
              <div className="row" style={{ gap: 8 }}>
                <button className="filter-btn" onClick={() => setShowAddNote(s => !s)}>{showAddNote ? '×' : '＋'}</button>
                <button className="filter-btn" onClick={() => onNavigate('notes')}>Open Notes →</button>
        </div>
          </div>
            {notesError ? (
              <div className="small" style={{ color: 'var(--danger)' }}>{notesError}</div>
            ) : (
              <>
                {showAddNote && (
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                      placeholder="New note…"
                      value={newNoteText}
                      onChange={(e) => setNewNoteText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && !isAddingNote && newNoteText.trim() && addNoteQuick()}
                style={{ flex: 1 }}
              />
            <button 
                      onClick={addNoteQuick}
                      disabled={isAddingNote || !newNoteText.trim()}
                      className="filter-btn"
                      style={{ padding: '8px 12px' }}
                    >
                      {isAddingNote ? 'Adding…' : 'Add'}
            </button>
                  </div>
                )}
                <div style={{ display: 'grid', gap: 6 }}>
                  {notes.length === 0 && (
                    <div className="small" style={{ color: 'var(--muted)' }}>No notes</div>
                  )}
                  {notes.map(n => (
                    <div key={n.id} className="item note-sticky" style={{ padding: 10 }}>
                      <button className="icon-btn note-close" onClick={() => deleteNoteQuick(n.id)}>×</button>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14 }}>
                          {n.content}
                        </div>
                        <div className="small" style={{ marginTop: 4 }}>
                          {format(new Date(n.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
              </div>
            ))}
              </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}







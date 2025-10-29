import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Task, Note, Subscription } from '../types'
import { format, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns'

export function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [newTask, setNewTask] = useState('')
  const [newNote, setNewNote] = useState('')
  const [newSubName, setNewSubName] = useState('')
  const [newSubAmount, setNewSubAmount] = useState('')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [isAddingSub, setIsAddingSub] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [tasksRes, notesRes, subsRes] = await Promise.all([
      supabase.from('tasks').select('*'),
      supabase.from('notes').select('*'),
      supabase.from('subscriptions').select('*')
    ])

    if (!tasksRes.error) setTasks(tasksRes.data || [])
    if (!notesRes.error) setNotes(notesRes.data || [])
    if (!subsRes.error) setSubscriptions(subsRes.data || [])
  }

  async function addTask() {
    if (!newTask.trim()) return
    setIsAddingTask(true)
    try {
      const { error } = await supabase.from('tasks').insert({ title: newTask })
      if (!error) {
        setNewTask('')
        await loadData()
      }
    } finally {
      setIsAddingTask(false)
    }
  }

  async function addNote() {
    if (!newNote.trim()) return
    setIsAddingNote(true)
    try {
      const { error } = await supabase.from('notes').insert({ content: newNote })
      if (!error) {
        setNewNote('')
        await loadData()
      }
    } finally {
      setIsAddingNote(false)
    }
  }

  async function addSubscription() {
    if (!newSubName.trim()) return
    setIsAddingSub(true)
    try {
      const cents = Math.round((parseFloat(newSubAmount || '0') || 0) * 100)
      const { error } = await supabase.from('subscriptions').insert({ 
        name: newSubName, 
        amount_cents: cents,
        cadence: 'monthly'
      })
      if (!error) {
        setNewSubName('')
        setNewSubAmount('')
        await loadData()
      }
    } finally {
      setIsAddingSub(false)
    }
  }

  async function toggleTaskStatus(id: string, status: Task['status']) {
    const nextStatus = status === 'todo' ? 'doing' : status === 'doing' ? 'done' : 'todo'
    await supabase.from('tasks').update({ status: nextStatus }).eq('id', id)
    loadData()
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    loadData()
  }

  async function deleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id)
    loadData()
  }

  async function deleteSubscription(id: string) {
    await supabase.from('subscriptions').delete().eq('id', id)
    loadData()
  }

  // Statistics
  const todoTasks = tasks.filter(t => t.status === 'todo')
  const doingTasks = tasks.filter(t => t.status === 'doing')
  const doneTasks = tasks.filter(t => t.status === 'done')
  const overdueTasks = tasks.filter(t => {
    if (!t.due_date) return false
    try {
      return parseISO(t.due_date) < new Date() && t.status !== 'done'
    } catch {
      return false
    }
  })

  const activeSubs = subscriptions.filter(s => s.is_active !== false)
  const monthlyTotal = activeSubs
    .filter(s => s.cadence === 'monthly')
    .reduce((sum, s) => sum + s.amount_cents, 0)

  function dollars(cents: number) {
    return `$${(cents / 100).toFixed(2)}`
  }

  function getStatusIcon(status: Task['status']) {
    switch (status) {
      case 'todo': return '⭕'
      case 'doing': return '🔄'
      case 'done': return '✅'
      default: return '⭕'
    }
  }

  return (
    <div>
      <h2>Harvard Street Hub - Overview</h2>
      
      {/* Quick Stats Row */}
      <div className="grid grid-3" style={{ marginBottom: 32 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>📋 Tasks</h3>
            <div className="row" style={{ gap: 8 }}>
              <span className="tag" style={{ background: 'var(--danger)', color: 'white' }}>{todoTasks.length}</span>
              <span className="tag" style={{ background: 'var(--warn)', color: 'white' }}>{doingTasks.length}</span>
              <span className="tag" style={{ background: 'var(--ok)', color: 'white' }}>{doneTasks.length}</span>
            </div>
          </div>
          {overdueTasks.length > 0 && (
            <div style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 500 }}>
              ⚠️ {overdueTasks.length} overdue
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>📝 Notes</h3>
            <span className="tag" style={{ background: 'var(--accent)', color: 'white' }}>{notes.length}</span>
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '12px' }}>
            {new Set(notes.map(n => n.category || 'general')).size} categories
          </div>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>💳 Subscriptions</h3>
            <span className="tag" style={{ background: 'var(--ok)', color: 'white' }}>{activeSubs.length}</span>
          </div>
          <div style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: 600 }}>
            {dollars(monthlyTotal)}/month
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-3" style={{ gap: 20 }}>
        
        {/* Tasks Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--ink)' }}>📋 Tasks</h3>
            <span className="small">{tasks.length} total</span>
          </div>
          
          {/* Add Task */}
          <div className="row" style={{ marginBottom: 20 }}>
            <input
              placeholder="New task..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              onClick={addTask}
              disabled={isAddingTask || !newTask.trim()}
              style={{ fontSize: '12px', padding: '10px 16px' }}
            >
              {isAddingTask ? 'Adding...' : 'Add'}
            </button>
          </div>

          {/* Tasks List */}
          <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
            {tasks.slice(0, 8).map((task) => (
              <div key={task.id} className="item" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <button
                    onClick={() => toggleTaskStatus(task.id, task.status)}
                    style={{ background: 'none', border: 'none', fontSize: '18px', padding: 0, cursor: 'pointer' }}
                  >
                    {getStatusIcon(task.status)}
                  </button>
                  <span style={{ 
                    fontSize: '14px',
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    opacity: task.status === 'done' ? 0.6 : 1,
                    color: 'var(--ink)'
                  }}>
                    {task.title}
                  </span>
                </div>
                <button 
                  onClick={() => deleteTask(task.id)}
                  className="delete-btn"
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  ×
                </button>
              </div>
            ))}
            {tasks.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '40px 20px' }}>
                No tasks yet
              </div>
            )}
          </div>
        </div>

        {/* Notes Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>📝 Notes</h3>
            <span className="small">{notes.length} total</span>
          </div>
          
          {/* Add Note */}
          <div className="row" style={{ marginBottom: 16 }}>
            <input
              placeholder="New note..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              style={{ flex: 1 }}
            />
            <button 
              onClick={addNote}
              disabled={isAddingNote || !newNote.trim()}
              style={{ fontSize: '12px', padding: '8px 12px' }}
            >
              {isAddingNote ? 'Adding...' : 'Add'}
            </button>
          </div>

          {/* Notes List */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {notes.slice(0, 6).map((note) => (
              <div key={note.id} className="item" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', marginBottom: 4 }}>
                    {note.content.length > 50 ? note.content.substring(0, 50) + '...' : note.content}
                  </div>
                  <div className="small">
                    {format(new Date(note.created_at), 'MMM d, h:mm a')}
                  </div>
                </div>
                <button 
                  onClick={() => deleteNote(note.id)}
                  className="delete-btn"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  ×
                </button>
              </div>
            ))}
            {notes.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
                No notes yet
              </div>
            )}
          </div>
        </div>

        {/* Subscriptions Column */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>💳 Subscriptions</h3>
            <span className="small">{subscriptions.length} total</span>
          </div>
          
          {/* Add Subscription */}
          <div style={{ marginBottom: 16 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <input
                placeholder="Service name..."
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                style={{ flex: 1 }}
              />
              <input
                placeholder="Amount"
                value={newSubAmount}
                onChange={(e) => setNewSubAmount(e.target.value)}
                style={{ width: '80px' }}
              />
            </div>
            <button 
              onClick={addSubscription}
              disabled={isAddingSub || !newSubName.trim()}
              style={{ fontSize: '12px', padding: '8px 12px', width: '100%' }}
            >
              {isAddingSub ? 'Adding...' : 'Add Subscription'}
            </button>
          </div>

          {/* Subscriptions List */}
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {subscriptions.slice(0, 6).map((sub) => (
              <div key={sub.id} className="item" style={{ marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 2 }}>
                    {sub.name}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="tag" style={{ fontSize: '10px' }}>
                      {dollars(sub.amount_cents)}
                    </span>
                    <span className="tag" style={{ fontSize: '10px' }}>
                      {sub.cadence}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => deleteSubscription(sub.id)}
                  className="delete-btn"
                  style={{ fontSize: '10px', padding: '2px 6px' }}
                >
                  ×
                </button>
              </div>
            ))}
            {subscriptions.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
                No subscriptions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Placeholder */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 16px' }}>📅 Calendar (Coming Soon)</h3>
        <p className="small">
          This section will show a private Google Calendar view using your authenticated Google account.
          The current app already has Google OAuth via Supabase;
          the next step is adding a small Netlify server function to call Google Calendar API with your user's token.
        </p>
      </div>
    </div>
  )
}

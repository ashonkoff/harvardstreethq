import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, isAfter, isBefore, isToday, isTomorrow, parseISO } from 'date-fns'
import { Session } from '@supabase/supabase-js'

export interface GoogleTask {
  id: string
  title: string
  notes?: string
  status: 'completed' | 'needsAction'
  due?: string
  completed?: string
  updated: string
  position: string
  taskListId: string
}

export function Tasks({ session }: { session: Session | null }) {
  const [tasks, setTasks] = useState<GoogleTask[]>([])
  const [taskLists, setTaskLists] = useState<{ id: string; title: string }[]>([])
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>('@default')
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  async function loadTaskLists() {
    if (!session) return

    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access not granted. Please sign out and sign in again.')
        return
      }

      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ action: 'listTaskLists', googleAccessToken: providerToken }),
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        let errorMsg = 'Failed to load task lists'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(errorMsg)
      }

      const json = await resp.json()
      const lists = [{ id: '@default', title: 'My Tasks' }, ...(json.taskLists || [])]
      setTaskLists(lists)
      if (!selectedTaskListId || selectedTaskListId === '@default') {
        setSelectedTaskListId('@default')
      }
    } catch (err) {
      console.error('Task lists error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load task lists')
    }
  }

  async function loadTasks() {
    if (!session) {
      setError('Please sign in to view your tasks')
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access not granted. Please sign out and sign in again.')
        setLoading(false)
        return
      }

      // Load task lists if we haven't yet
      if (taskLists.length === 0) {
        await loadTaskLists()
      }

      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'listTasks',
          googleAccessToken: providerToken,
          taskListId: selectedTaskListId,
        }),
      })

      if (!resp.ok) {
        if (resp.status === 401) throw new Error('Google Tasks access expired. Please re-authenticate.')
        const errorText = await resp.text()
        let errorMsg = 'Failed to fetch tasks'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(errorMsg)
      }

      const json = await resp.json()
      setTasks(json.tasks || [])
      setLoading(false)
    } catch (err) {
      console.error('Tasks error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load tasks')
      setLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      loadTaskLists()
    }
  }, [session])

  useEffect(() => {
    if (session && selectedTaskListId) {
      loadTasks()
    }
  }, [session, selectedTaskListId])

  async function add() {
    if (!title.trim() || !session) return
    setIsAdding(true)
    
    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) {
        setError('Google access not granted.')
        return
      }

      const taskData: any = { title: title.trim() }
      if (dueDate) {
        // Convert date to RFC3339 format (YYYY-MM-DDTHH:mm:ssZ)
        const date = new Date(dueDate)
        date.setHours(0, 0, 0, 0)
        taskData.due = date.toISOString()
      }

      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'createTask',
          googleAccessToken: providerToken,
          taskListId: selectedTaskListId,
          taskData,
        }),
      })

      if (!resp.ok) {
        const errorText = await resp.text()
        let errorMsg = 'Failed to create task'
        try {
          const errorJson = JSON.parse(errorText)
          errorMsg = errorJson.error || errorMsg
        } catch {
          errorMsg = errorText || errorMsg
        }
        throw new Error(errorMsg)
      }

      setTitle('')
      setDueDate('')
      await loadTasks()
    } catch (err) {
      console.error('Create task error:', err)
      setError(err instanceof Error ? err.message : 'Failed to create task')
    } finally {
      setIsAdding(false)
    }
  }

  async function toggleComplete(task: GoogleTask) {
    if (!session) return

    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) return

      const newStatus = task.status === 'completed' ? 'needsAction' : 'completed'
      
      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'updateTask',
          googleAccessToken: providerToken,
          taskListId: task.taskListId,
          taskId: task.id,
          taskData: { status: newStatus },
        }),
      })

      if (!resp.ok) {
        throw new Error('Failed to update task')
      }

      await loadTasks()
    } catch (err) {
      console.error('Update task error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update task')
    }
  }

  async function remove(task: GoogleTask) {
    if (!session) return

    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) return

      const resp = await fetch('/.netlify/functions/google-tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          action: 'deleteTask',
          googleAccessToken: providerToken,
          taskListId: task.taskListId,
          taskId: task.id,
        }),
      })

      if (!resp.ok) {
        throw new Error('Failed to delete task')
      }

      await loadTasks()
    } catch (err) {
      console.error('Delete task error:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete task')
    }
  }

  function getStatusIcon(status: GoogleTask['status']) {
    return status === 'completed' ? '✅' : '⭕'
  }

  function getDueDateStatus(due?: string) {
    if (!due) return { text: '', urgent: false, overdue: false }
    
    try {
      const date = parseISO(due)
      const now = new Date()
      
      if (isToday(date)) return { text: 'Today', urgent: true, overdue: false }
      if (isTomorrow(date)) return { text: 'Tomorrow', urgent: true, overdue: false }
      if (isBefore(date, now)) return { text: 'Overdue', urgent: true, overdue: true }
      if (isAfter(date, now)) return { text: format(date, 'MMM d'), urgent: false, overdue: false }
      
      return { text: format(date, 'MMM d'), urgent: false, overdue: false }
    } catch {
      return { text: '', urgent: false, overdue: false }
    }
  }

  const activeTasks = tasks.filter(t => t.status === 'needsAction')
  const completedTasks = tasks.filter(t => t.status === 'completed')
  
  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return task.status === 'needsAction'
    if (filter === 'completed') return task.status === 'completed'
    return true
  })

  if (loading && tasks.length === 0) {
    return (
      <div>
        <h2>To do</h2>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>
            Loading tasks...
          </div>
        </div>
      </div>
    )
  }

  if (error && tasks.length === 0) {
    return (
      <div>
        <h2>To do</h2>
        <div className="card">
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--danger)' }}>
            <div style={{ marginBottom: 16 }}>⚠️ {error}</div>
            <button onClick={loadTasks} className="filter-btn">
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>✅ To do</h2>

      {/* Task List Selection */}
      {taskLists.length > 1 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <label style={{ marginBottom: 8, display: 'block', fontSize: '14px', fontWeight: 500 }}>
            Task List:
          </label>
          <select
            value={selectedTaskListId}
            onChange={(e) => setSelectedTaskListId(e.target.value)}
            style={{ width: '100%', maxWidth: '300px' }}
          >
            {taskLists.map(list => (
              <option key={list.id} value={list.id}>{list.title}</option>
            ))}
          </select>
        </div>
      )}

      {/* Add Task Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="New task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isAdding && title.trim() && add()}
            style={{ flex: 1 }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ width: 140 }}
          />
          <button 
            onClick={add} 
            disabled={isAdding || !title.trim()}
            style={{ 
              background: isAdding ? '#666' : 'var(--accent)',
              opacity: isAdding ? 0.7 : 1,
              cursor: isAdding ? 'not-allowed' : 'pointer'
            }}
          >
            {isAdding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="row" style={{ marginBottom: 16, gap: 8 }}>
        <button 
          onClick={() => setFilter('all')}
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
        >
          All ({tasks.length})
        </button>
        <button 
          onClick={() => setFilter('active')}
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
        >
          Active ({activeTasks.length})
        </button>
        <button 
          onClick={() => setFilter('completed')}
          className={`filter-btn ${filter === 'completed' ? 'active' : ''}`}
        >
          Completed ({completedTasks.length})
        </button>
      </div>

      {/* Task List */}
      <div className="grid" style={{ gap: 8 }}>
        {filteredTasks.map((task) => {
          const dueDateStatus = getDueDateStatus(task.due)
          return (
            <div 
              className="item" 
              key={task.id}
              style={{ 
                opacity: task.status === 'completed' ? 0.6 : 1,
                borderLeft: `4px solid ${task.status === 'completed' ? 'var(--ok)' : 'var(--accent)'}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <button
                  onClick={() => toggleComplete(task)}
                  style={{ 
                    background: 'none', 
                    border: 'none', 
                    fontSize: '18px',
                    padding: 0,
                    cursor: 'pointer'
                  }}
                >
                  {getStatusIcon(task.status)}
                </button>
                
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontWeight: task.status === 'completed' ? 400 : 600,
                    textDecoration: task.status === 'completed' ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  
                  {task.notes && (
                    <div className="small" style={{ marginTop: 4, color: 'var(--muted)' }}>
                      {task.notes}
                    </div>
                  )}
                  
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    {dueDateStatus.text && (
                      <span 
                        className="tag" 
                        style={{ 
                          background: dueDateStatus.overdue ? '#ff6b6b' : 
                                     dueDateStatus.urgent ? '#ffc857' : '#26304e',
                          color: dueDateStatus.overdue ? 'white' : '#c7d3ff'
                        }}
                      >
                        {dueDateStatus.text}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <button 
                onClick={() => remove(task)}
                className="delete-btn"
              >
                Delete
              </button>
            </div>
          )
        })}
      </div>
      
      {filteredTasks.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
          {filter === 'all' ? 'No tasks yet. Tasks added in Gmail will appear here!' : `No ${filter} tasks`}
        </div>
      )}
    </div>
  )
}

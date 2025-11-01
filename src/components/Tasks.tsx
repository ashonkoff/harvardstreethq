import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { format, isAfter, isBefore, isToday, isTomorrow, parseISO } from 'date-fns'
import { Session } from '@supabase/supabase-js'

export interface GoogleTaskLink {
  type?: string
  link?: string
  description?: string
}

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
  links?: GoogleTaskLink[]
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
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDueDate, setEditDueDate] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)

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

  async function updateTask(task: GoogleTask, updates: { title?: string; due?: string }) {
    if (!session) return

    setIsUpdating(true)
    try {
      const { data } = await supabase.auth.getSession()
      const providerToken = data.session?.provider_token
      const accessToken = data.session?.access_token
      
      if (!providerToken) return

      const taskData: any = {}
      if (updates.title !== undefined) taskData.title = updates.title
      if (updates.due !== undefined) taskData.due = updates.due || null

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
          taskData,
        }),
      })

      if (!resp.ok) {
        throw new Error('Failed to update task')
      }

      await loadTasks()
      setEditingTaskId(null)
      setEditTitle('')
      setEditDueDate('')
    } catch (err) {
      console.error('Update task error:', err)
      setError(err instanceof Error ? err.message : 'Failed to update task')
    } finally {
      setIsUpdating(false)
    }
  }

  function startEdit(task: GoogleTask) {
    setEditingTaskId(task.id)
    setEditTitle(task.title)
    setEditDueDate(task.due ? format(parseISO(task.due), 'yyyy-MM-dd') : '')
  }

  function cancelEdit() {
    setEditingTaskId(null)
    setEditTitle('')
    setEditDueDate('')
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

  function getGmailLink(task: GoogleTask): string | null {
    if (!task.links || task.links.length === 0) return null
    
    // Look for email type links or Gmail URLs
    const emailLink = task.links.find(link => 
      link.type === 'email' || 
      (link.link && link.link.includes('mail.google.com'))
    )
    
    return emailLink?.link || null
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
        <h2>Tasks</h2>
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
        <h2>Tasks</h2>
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
      {/* Compact Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Task List Selection */}
        {taskLists.length > 1 && (
          <select
            value={selectedTaskListId}
            onChange={(e) => setSelectedTaskListId(e.target.value)}
            style={{ 
              fontSize: '13px',
              padding: '4px 8px',
              border: 'none',
              background: 'transparent',
              color: 'var(--accent)',
              textDecoration: 'underline',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {taskLists.map(list => (
              <option key={list.id} value={list.id}>{list.title}</option>
            ))}
          </select>
        )}
        
        {/* Filter Buttons */}
        <button 
          onClick={() => setFilter('all')}
          style={{ 
            background: filter === 'all' ? 'var(--accent)' : 'transparent',
            color: filter === 'all' ? 'white' : 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 8px',
            textDecoration: filter === 'all' ? 'none' : 'underline',
            borderRadius: filter === 'all' ? '4px' : '0'
          }}
        >
          All ({tasks.length})
        </button>
        <button 
          onClick={() => setFilter('active')}
          style={{ 
            background: filter === 'active' ? 'var(--accent)' : 'transparent',
            color: filter === 'active' ? 'white' : 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 8px',
            textDecoration: filter === 'active' ? 'none' : 'underline',
            borderRadius: filter === 'active' ? '4px' : '0'
          }}
        >
          Active ({activeTasks.length})
        </button>
        <button 
          onClick={() => setFilter('completed')}
          style={{ 
            background: filter === 'completed' ? 'var(--accent)' : 'transparent',
            color: filter === 'completed' ? 'white' : 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 8px',
            textDecoration: filter === 'completed' ? 'none' : 'underline',
            borderRadius: filter === 'completed' ? '4px' : '0'
          }}
        >
          Completed ({completedTasks.length})
        </button>
      </div>

      {/* Compact Add Task Form */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="New task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isAdding && title.trim() && add()}
          style={{ flex: 1, minWidth: '200px', maxWidth: '400px' }}
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={{ width: 140, fontSize: '13px' }}
        />
        <button 
          onClick={add} 
          disabled={isAdding || !title.trim()}
          className="filter-btn"
          style={{ 
            opacity: isAdding || !title.trim() ? 0.5 : 1,
            cursor: isAdding || !title.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
      </div>

      {/* Task List */}
      <div className="grid" style={{ gap: 8 }}>
        {filteredTasks.map((task) => {
          const dueDateStatus = getDueDateStatus(task.due)
          const isEditing = editingTaskId === task.id
          const gmailLink = getGmailLink(task)
          
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
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  onChange={() => toggleComplete(task)}
                  disabled={isEditing}
                  style={{ 
                    width: 18,
                    height: 18,
                    cursor: isEditing ? 'not-allowed' : 'pointer',
                    flexShrink: 0
                  }}
                />
                
                {isEditing ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !isUpdating && editTitle.trim()) {
                          updateTask(task, { title: editTitle.trim() })
                        }
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      style={{ flex: 1 }}
                      autoFocus
                    />
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        style={{ fontSize: '13px', width: 140 }}
                      />
                      <button
                        onClick={() => updateTask(task, { 
                          title: editTitle.trim(),
                          due: editDueDate || undefined
                        })}
                        disabled={isUpdating || !editTitle.trim()}
                        className="filter-btn"
                        style={{ fontSize: '12px', padding: '4px 8px' }}
                      >
                        Save
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="filter-btn"
                        style={{ fontSize: '12px', padding: '4px 8px', background: 'var(--bg-secondary)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
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
                    
                    <div className="row" style={{ gap: 8, marginTop: 4, alignItems: 'center' }}>
                      {gmailLink && (
                        <a
                          href={gmailLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '13px',
                            textDecoration: 'none',
                            color: 'var(--accent)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            gap: 4
                          }}
                        >
                          Go to email →
                        </a>
                      )}
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
                )}
              </div>
              
              {!isEditing && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button 
                    onClick={() => startEdit(task)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '16px',
                      color: 'var(--ink-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Edit task"
                  >
                    ✏️
                  </button>
                  <button 
                    onClick={() => remove(task)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px 8px',
                      fontSize: '16px',
                      color: 'var(--danger)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                    title="Delete task"
                  >
                    🗑️
                  </button>
                </div>
              )}
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

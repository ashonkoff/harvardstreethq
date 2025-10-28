import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'
import { format, isAfter, isBefore, isToday, isTomorrow, parseISO } from 'date-fns'

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [priority, setPriority] = useState<Task['priority']>('medium')
  const [filter, setFilter] = useState<'all' | 'todo' | 'doing' | 'done'>('all')
  const [isAdding, setIsAdding] = useState(false)

  async function load() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!title.trim()) return
    setIsAdding(true)
    
    try {
      // Create insert object with only fields that exist
      const insertData: any = {
        title,
      }
      
      // Only add new fields if they have values
      if (dueDate) insertData.due_date = dueDate
      
      const { error } = await supabase.from('tasks').insert(insertData)
      if (error) {
        console.error('Insert error', error)
        return
      }
      setTitle('')
      setDueDate('')
      setPriority('medium')
      await load()
    } finally {
      setIsAdding(false)
    }
  }

  async function updateStatus(id: string, status: Task['status']) {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', id)
    if (error) return console.error(error)
    load()
  }

  async function updatePriority(id: string, priority: Task['priority']) {
    const { error } = await supabase.from('tasks').update({ priority }).eq('id', id)
    if (error) return console.error(error)
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  function getPriorityColor(priority: Task['priority'] | undefined) {
    switch (priority) {
      case 'high': return '#ff6b6b'
      case 'medium': return '#ffc857'
      case 'low': return '#3bd39c'
      default: return '#9fb0ff'
    }
  }

  function getPriorityIcon(priority: Task['priority'] | undefined) {
    switch (priority) {
      case 'high': return '🔴'
      case 'medium': return '🟡'
      case 'low': return '🟢'
      default: return '⚪'
    }
  }

  function getStatusIcon(status: Task['status']) {
    switch (status) {
      case 'todo': return '⭕'
      case 'doing': return '🔄'
      case 'done': return '✅'
      default: return '⭕'
    }
  }

  function getDueDateStatus(dueDate: string | null) {
    if (!dueDate) return { text: '', urgent: false, overdue: false }
    
    const date = parseISO(dueDate)
    const now = new Date()
    
    if (isToday(date)) return { text: 'Today', urgent: true, overdue: false }
    if (isTomorrow(date)) return { text: 'Tomorrow', urgent: true, overdue: false }
    if (isBefore(date, now)) return { text: 'Overdue', urgent: true, overdue: true }
    if (isAfter(date, now)) return { text: format(date, 'MMM d'), urgent: false, overdue: false }
    
    return { text: format(date, 'MMM d'), urgent: false, overdue: false }
  }

  const filteredTasks = tasks.filter(task => 
    filter === 'all' || task.status === filter
  )

  const todoCount = tasks.filter(t => t.status === 'todo').length
  const doingCount = tasks.filter(t => t.status === 'doing').length
  const doneCount = tasks.filter(t => t.status === 'done').length

  return (
    <div>
      <h2>Tasks</h2>
      
      {/* Task Stats */}
      <div className="row" style={{ marginBottom: 16, gap: 12 }}>
        <div className="status-badge status-todo">
          <span className="status-count">{todoCount}</span>
          <span className="status-label">Todo</span>
        </div>
        <div className="status-badge status-doing">
          <span className="status-count">{doingCount}</span>
          <span className="status-label">Doing</span>
        </div>
        <div className="status-badge status-done">
          <span className="status-count">{doneCount}</span>
          <span className="status-label">Done</span>
        </div>
      </div>

      {/* Add Task Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="New task…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{ width: 140 }}
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            style={{ width: 100 }}
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
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
          onClick={() => setFilter('todo')}
          className={`filter-btn ${filter === 'todo' ? 'active' : ''}`}
        >
          Todo ({todoCount})
        </button>
        <button 
          onClick={() => setFilter('doing')}
          className={`filter-btn ${filter === 'doing' ? 'active' : ''}`}
        >
          Doing ({doingCount})
        </button>
        <button 
          onClick={() => setFilter('done')}
          className={`filter-btn ${filter === 'done' ? 'active' : ''}`}
        >
          Done ({doneCount})
        </button>
      </div>

      {/* Task List */}
      <div className="grid" style={{ gap: 8 }}>
        {filteredTasks.map((task) => {
          const dueDateStatus = getDueDateStatus(task.due_date)
          return (
            <div 
              className="item" 
              key={task.id}
              style={{ 
                opacity: task.status === 'done' ? 0.6 : 1,
                borderLeft: `4px solid ${getPriorityColor(task.priority)}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                <button
                  onClick={() => {
                    const nextStatus = task.status === 'todo' ? 'doing' : 
                                     task.status === 'doing' ? 'done' : 'todo'
                    updateStatus(task.id, nextStatus)
                  }}
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
                    fontWeight: task.status === 'done' ? 400 : 600,
                    textDecoration: task.status === 'done' ? 'line-through' : 'none'
                  }}>
                    {task.title}
                  </div>
                  
                  <div className="row" style={{ gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: '12px' }}>
                      {getPriorityIcon(task.priority)} {task.priority || 'medium'}
                    </span>
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
              
              <div className="row" style={{ gap: 8 }}>
                <select
                  value={task.priority || 'medium'}
                  onChange={(e) => updatePriority(task.id, e.target.value as Task['priority'])}
                  className="priority-select"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button 
                  onClick={() => remove(task.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
      
      {filteredTasks.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
          {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
        </div>
      )}
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Task } from '../types'

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [title, setTitle] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)

  async function loadSpace() {
    const { data, error } = await supabase.from('my_profile').select('family_space_id').single()
    if (!error) setSpaceId(data?.family_space_id ?? null)
  }

  async function load() {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setTasks(data || [])
  }

  useEffect(() => {
    loadSpace()
    load()
  }, [])

  async function add() {
    if (!title.trim()) return
    if (!spaceId) await loadSpace()
    const { error } = await supabase.from('tasks').insert({
      title,
      family_space_id: spaceId,
    })
    if (error) {
      console.error('Insert error', error)
      return
    }
    setTitle('')
    load()
  }

  async function toggle(id: string, status: Task['status']) {
    const next = status === 'done' ? 'todo' : 'done'
    const { error } = await supabase.from('tasks').update({ status: next }).eq('id', id)
    if (error) return console.error(error)
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  return (
    <div>
      <h2>Tasks</h2>
      <div className="row">
        <input
          placeholder="New task…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button onClick={add}>Add</button>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid" style={{ gap: 8 }}>
        {tasks.map((t) => (
          <div className="item" key={t.id}>
            <div className="row">
              <input
                type="checkbox"
                checked={t.status === 'done'}
                onChange={() => toggle(t.id, t.status)}
              />
              <div>{t.title}</div>
            </div>
            <button onClick={() => remove(t.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

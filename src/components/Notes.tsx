import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Note } from '../types'

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [text, setText] = useState('')
  const [spaceId, setSpaceId] = useState<string | null>(null)

  async function loadSpace() {
    const { data, error } = await supabase.from('my_profile').select('family_space_id').single()
    if (!error) setSpaceId(data?.family_space_id ?? null)
  }

  async function load() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setNotes(data || [])
  }

  useEffect(() => {
    loadSpace()
    load()
  }, [])

  async function add() {
    if (!text.trim()) return
    if (!spaceId) await loadSpace()
    const { error } = await supabase.from('notes').insert({
      content: text,
      family_space_id: spaceId,
    })
    if (error) {
      console.error('Insert error', error)
      return
    }
    setText('')
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  return (
    <div>
      <h2>Notes</h2>
      <div className="row">
        <input
          placeholder="Add a note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button onClick={add}>Add</button>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid" style={{ gap: 8 }}>
        {notes.map((n) => (
          <div className="item" key={n.id}>
            <div style={{ whiteSpace: 'pre-wrap' }}>{n.content}</div>
            <button onClick={() => remove(n.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Note } from '../types'
import { format } from 'date-fns'

export function Notes() {
  const [notes, setNotes] = useState<Note[]>([])
  const [text, setText] = useState('')
  const [category, setCategory] = useState('general')
  const [tags, setTags] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isAdding, setIsAdding] = useState(false)

  const categories = ['general', 'shopping', 'ideas', 'reminders', 'family', 'work']

  async function load() {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setNotes(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!text.trim()) return
    setIsAdding(true)
    
    try {
      // Create insert object with only fields that exist
      const insertData: any = {
        content: text,
      }
      
      const { error } = await supabase.from('notes').insert(insertData)
      if (error) {
        console.error('Insert error', error)
        return
      }
      setText('')
      setTags('')
      setCategory('general')
      await load()
    } finally {
      setIsAdding(false)
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from('notes').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  async function updateCategory(id: string, newCategory: string) {
    const { error } = await supabase.from('notes').update({ category: newCategory }).eq('id', id)
    if (error) return console.error(error)
    load()
  }

  const filteredNotes = notes.filter(note => {
    const matchesSearch = note.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (note.tags && note.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    const matchesCategory = selectedCategory === 'all' || (note.category || 'general') === selectedCategory
    return matchesSearch && matchesCategory
  })

  const categoryCounts = categories.reduce((acc, cat) => {
    acc[cat] = notes.filter(n => (n.category || 'general') === cat).length
    return acc
  }, {} as Record<string, number>)

  return (
    <div>
      <h2>Notes</h2>
      
      {/* Search and Filter */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Search notes and tags…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ flex: 1 }}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ width: 120 }}
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat} ({categoryCounts[cat] || 0})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Add Note Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Add a note…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            style={{ width: 180 }}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: 100 }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <button 
            onClick={add} 
            disabled={isAdding || !text.trim()}
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

      {/* Category Filter Buttons */}
      <div className="row" style={{ marginBottom: 16, gap: 8, flexWrap: 'wrap' }}>
        <button 
          onClick={() => setSelectedCategory('all')}
          className={`filter-btn ${selectedCategory === 'all' ? 'active' : ''}`}
        >
          All ({notes.length})
        </button>
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Notes List */}
      <div className="grid" style={{ gap: 8 }}>
        {filteredNotes.map((note) => (
          <div className="item" key={note.id} style={{ borderLeft: `4px solid var(--accent)` }}>
            <div style={{ flex: 1 }}>
              <div style={{ whiteSpace: 'pre-wrap', marginBottom: 8 }}>{note.content}</div>
              
              <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                <select
                  value={note.category || 'general'}
                  onChange={(e) => updateCategory(note.id, e.target.value)}
                  className="priority-select"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                
                {note.tags && note.tags.map((tag, index) => (
                  <span key={index} className="tag" style={{ fontSize: '10px' }}>
                    #{tag}
                  </span>
                ))}
                
                <span className="small" style={{ marginLeft: 'auto' }}>
                  {format(new Date(note.created_at), 'MMM d, h:mm a')}
                </span>
              </div>
            </div>
            
            <button 
              onClick={() => remove(note.id)}
              className="delete-btn"
            >
              Delete
            </button>
          </div>
        ))}
      </div>
      
      {filteredNotes.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
          {searchTerm || selectedCategory !== 'all' ? 'No notes match your filters' : 'No notes yet'}
        </div>
      )}
    </div>
  )
}

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
      {/* Compact Header */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Search */}
        <input
          placeholder="Search notes and tags…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}
        />
        
        {/* Category Filter Buttons */}
        <button 
          onClick={() => setSelectedCategory('all')}
          style={{ 
            background: selectedCategory === 'all' ? 'var(--accent)' : 'transparent',
            color: selectedCategory === 'all' ? 'white' : 'var(--accent)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px 8px',
            textDecoration: selectedCategory === 'all' ? 'none' : 'underline',
            borderRadius: selectedCategory === 'all' ? '4px' : '0'
          }}
        >
          All ({notes.length})
        </button>
        {categories.map(cat => (
          <button 
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{ 
              background: selectedCategory === cat ? 'var(--accent)' : 'transparent',
              color: selectedCategory === cat ? 'white' : 'var(--accent)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              padding: '4px 8px',
              textDecoration: selectedCategory === cat ? 'none' : 'underline',
              borderRadius: selectedCategory === cat ? '4px' : '0',
              textTransform: 'capitalize'
            }}
          >
            {cat} ({categoryCounts[cat] || 0})
          </button>
        ))}
      </div>

      {/* Compact Add Note Form */}
      <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          placeholder="Add a note…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isAdding && text.trim() && add()}
          style={{ flex: 1, minWidth: '200px', maxWidth: '400px' }}
        />
        <input
          placeholder="Tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          style={{ width: 140, fontSize: '13px' }}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={{ width: 100, fontSize: '13px' }}
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <button 
          onClick={add} 
          disabled={isAdding || !text.trim()}
          className="filter-btn"
          style={{ 
            opacity: isAdding || !text.trim() ? 0.5 : 1,
            cursor: isAdding || !text.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          {isAdding ? 'Adding...' : 'Add'}
        </button>
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

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type SchoolResource = {
  id: string
  title: string
  url: string
  description: string | null
  child_name: 'Miles' | 'Harrison' | 'Both'
  created_at: string
}

export function School() {
  const [resources, setResources] = useState<SchoolResource[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [childName, setChildName] = useState<'Miles' | 'Harrison' | 'Both'>('Both')
  const [editing, setEditing] = useState<SchoolResource | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function loadResources() {
    try {
      const { data, error } = await supabase
        .from('school_resources')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const all = (data || []) as SchoolResource[]
      
      // Sort: Both first, then Miles, then Harrison
      const sortOrder = { 'Both': 1, 'Miles': 2, 'Harrison': 3 }
      const sorted = all.sort((a, b) => {
        const aOrder = sortOrder[a.child_name || 'Both']
        const bOrder = sortOrder[b.child_name || 'Both']
        return aOrder - bOrder
      })
      
      setResources(sorted)
      setLoading(false)
    } catch (err) {
      console.error('Error loading resources:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadResources()
  }, [])

  async function saveResource() {
    if (!title.trim() || !url.trim()) return
    
    try {
      if (editing) {
        const { error } = await supabase
          .from('school_resources')
          .update({
            title: title.trim(),
            url: url.trim(),
            description: description.trim() || null,
            child_name: childName,
          })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('school_resources')
          .insert({
            title: title.trim(),
            url: url.trim(),
            description: description.trim() || null,
            child_name: childName,
          })
        if (error) throw error
      }
      
      // Reset form
      setTitle('')
      setUrl('')
      setDescription('')
      setChildName('Both')
      setEditing(null)
      setShowForm(false)
      await loadResources()
    } catch (err) {
      console.error('Error saving resource:', err)
    }
  }

  function startEdit(resource: SchoolResource) {
    setTitle(resource.title)
    setUrl(resource.url)
    setDescription(resource.description || '')
    setChildName(resource.child_name || 'Both')
    setEditing(resource)
    setShowForm(true)
  }

  function cancelEdit() {
    setTitle('')
    setUrl('')
    setDescription('')
    setChildName('Both')
    setEditing(null)
    setShowForm(false)
  }

  function openForm() {
    setShowForm(true)
    setEditing(null)
    setTitle('')
    setUrl('')
    setDescription('')
    setChildName('Both')
  }

  async function deleteResource(id: string) {
    if (!confirm('Delete this resource?')) return
    try {
      const { error } = await supabase.from('school_resources').delete().eq('id', id)
      if (error) throw error
      await loadResources()
    } catch (err) {
      console.error('Error deleting resource:', err)
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <div>
      <h2>📚 School</h2>

      {/* Birch Meadow Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Birch Meadow</h3>
          <button 
            className="filter-btn" 
            onClick={openForm}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            + Add resource
          </button>
        </div>

        {/* Compact Add/Edit Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Resource *</label>
                <input
                  type="text"
                  placeholder="e.g., Student Portal"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, marginBottom: 4 }}>Website *</label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, marginBottom: 4 }}>Description</label>
                  <input
                    type="text"
                    placeholder="Optional description..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, marginBottom: 4 }}>Child</label>
                  <select
                    value={childName}
                    onChange={(e) => setChildName(e.target.value as 'Miles' | 'Harrison' | 'Both')}
                    style={{ fontSize: 13, padding: '6px 8px' }}
                  >
                    <option value="Both">Both</option>
                    <option value="Miles">Miles</option>
                    <option value="Harrison">Harrison</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={saveResource} 
                disabled={!title.trim() || !url.trim()}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {editing ? 'Update' : 'Add'} Resource
              </button>
              <button 
                className="filter-btn" 
                onClick={cancelEdit}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Resources Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '28%' }}>Resource</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Description</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '12%' }}>Child</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '26%' }}>Website</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                    No resources added yet
                  </td>
                </tr>
              ) : (
                resources.map((resource) => {
                  return (
                    <tr key={resource.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resource.title}
                      </td>
                      <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resource.description || '—'}
                      </td>
                      <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)' }}>
                        {resource.child_name || 'Both'}
                      </td>
                      <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {resource.url ? (
                          <a href={resource.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
                            Go to site
                          </a>
                        ) : (
                          <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: 12, textAlign: 'right' }}>
                        <div className="row" style={{ gap: 8, justifyContent: 'flex-end' }}>
                          <button
                            className="filter-btn"
                            onClick={() => startEdit(resource)}
                            style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteResource(resource.id)}
                            style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--danger)', border: 'none', boxShadow: 'none' }}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

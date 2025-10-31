import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type HouseService = {
  id: string
  service: string
  last_serviced: string | null
  phone_number: string | null
  website_link: string | null
  created_at: string
}

export function House() {
  const [services, setServices] = useState<HouseService[]>([])
  const [loading, setLoading] = useState(true)

  // Form state
  const [service, setService] = useState('')
  const [lastServiced, setLastServiced] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [websiteLink, setWebsiteLink] = useState('')
  const [editing, setEditing] = useState<HouseService | null>(null)
  const [showForm, setShowForm] = useState(false)

  async function loadServices() {
    try {
      const { data, error } = await supabase
        .from('house_maintenance')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setServices((data || []) as HouseService[])
      setLoading(false)
    } catch (err) {
      console.error('Error loading services:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadServices()
  }, [])

  async function saveService() {
    if (!service.trim()) return
    
    try {
      if (editing) {
        const { error } = await supabase
          .from('house_maintenance')
          .update({
            service: service.trim(),
            last_serviced: lastServiced || null,
            phone_number: phoneNumber.trim() || null,
            website_link: websiteLink.trim() || null,
          })
          .eq('id', editing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('house_maintenance')
          .insert({
            service: service.trim(),
            last_serviced: lastServiced || null,
            phone_number: phoneNumber.trim() || null,
            website_link: websiteLink.trim() || null,
          })
        if (error) throw error
      }
      
      // Reset form
      setService('')
      setLastServiced('')
      setPhoneNumber('')
      setWebsiteLink('')
      setEditing(null)
      setShowForm(false)
      await loadServices()
    } catch (err) {
      console.error('Error saving service:', err)
    }
  }

  function startEdit(serviceItem: HouseService) {
    setService(serviceItem.service)
    setLastServiced(serviceItem.last_serviced || '')
    setPhoneNumber(serviceItem.phone_number || '')
    setWebsiteLink(serviceItem.website_link || '')
    setEditing(serviceItem)
    setShowForm(true)
  }

  function cancelEdit() {
    setService('')
    setLastServiced('')
    setPhoneNumber('')
    setWebsiteLink('')
    setEditing(null)
    setShowForm(false)
  }

  function openForm() {
    setShowForm(true)
    setEditing(null)
    setService('')
    setLastServiced('')
    setPhoneNumber('')
    setWebsiteLink('')
  }

  async function deleteService(id: string) {
    if (!confirm('Delete this service?')) return
    try {
      const { error } = await supabase.from('house_maintenance').delete().eq('id', id)
      if (error) throw error
      await loadServices()
    } catch (err) {
      console.error('Error deleting service:', err)
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return '—'
    try {
      return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return dateString
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <div>
      <h2>🏠 House</h2>

      {/* Maintenance Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Maintenance</h3>
          <button 
            className="filter-btn" 
            onClick={openForm}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            + Add new
          </button>
        </div>

        {/* Compact Add/Edit Form */}
        {showForm && (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Service *</label>
                <input
                  type="text"
                  placeholder="e.g., Chimney sweep"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Last serviced</label>
                <input
                  type="date"
                  value={lastServiced}
                  onChange={(e) => setLastServiced(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Phone number</label>
                <input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Website</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={websiteLink}
                  onChange={(e) => setWebsiteLink(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={saveService} 
                disabled={!service.trim()}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {editing ? 'Update' : 'Add'} Service
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

        {/* Services Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '25%' }}>Service</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '18%' }}>Last serviced</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Phone number</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '23%' }}>Website</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {services.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                    No services added yet
                  </td>
                </tr>
              ) : (
                services.map((serviceItem) => {
                  return (
                    <tr key={serviceItem.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: 12, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {serviceItem.service}
                      </td>
                      <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatDate(serviceItem.last_serviced)}
                      </td>
                      <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {serviceItem.phone_number || '—'}
                      </td>
                      <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {serviceItem.website_link ? (
                          <a href={serviceItem.website_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
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
                            onClick={() => startEdit(serviceItem)}
                            style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="delete-btn"
                            onClick={() => deleteService(serviceItem.id)}
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


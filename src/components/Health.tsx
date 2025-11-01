import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type PersonName = 'Miles' | 'Harrison' | 'Eleanor' | 'Adam'
type EditingState = { person: PersonName; type: 'flu_shot' | 'well_visit' } | null

type HealthRecord = {
  id: string
  child_name: PersonName
  flu_shot_last_date: string | null
  well_visit_last_date: string | null
  created_at: string
  updated_at: string | null
}

export function Health() {
  const [records, setRecords] = useState<HealthRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingState>(null)
  const [editDate, setEditDate] = useState('')

  // Define people in order for flu shots
  const fluShotPeople: PersonName[] = ['Miles', 'Harrison', 'Eleanor', 'Adam']
  // Define people for well visits
  const wellVisitPeople: PersonName[] = ['Miles', 'Harrison']

  async function loadData() {
    try {
      const { data, error } = await supabase
        .from('health_records')
        .select('*')
        .order('child_name', { ascending: true })
      
      if (error) throw error
      
      setRecords((data || []) as HealthRecord[])
      setLoading(false)
    } catch (err) {
      console.error('Error loading health data:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function getRecord(personName: PersonName): HealthRecord | null {
    return records.find(r => r.child_name === personName) || null
  }

  function startEdit(person: PersonName, type: 'flu_shot' | 'well_visit') {
    const record = getRecord(person)
    const dateValue = type === 'flu_shot' 
      ? record?.flu_shot_last_date || '' 
      : record?.well_visit_last_date || ''
    setEditing({ person, type })
    setEditDate(dateValue)
  }

  function cancelEdit() {
    setEditing(null)
    setEditDate('')
  }

  async function saveEdit() {
    if (!editing) return

    try {
      const record = getRecord(editing.person)
      const updateData: any = {
        child_name: editing.person,
        updated_at: new Date().toISOString(),
      }

      if (editing.type === 'flu_shot') {
        updateData.flu_shot_last_date = editDate || null
        // Preserve well_visit_last_date if record exists
        if (record) {
          updateData.well_visit_last_date = record.well_visit_last_date
        } else {
          updateData.well_visit_last_date = null
        }
      } else if (editing.type === 'well_visit') {
        updateData.well_visit_last_date = editDate || null
        // Preserve flu_shot_last_date if record exists
        if (record) {
          updateData.flu_shot_last_date = record.flu_shot_last_date
        } else {
          updateData.flu_shot_last_date = null
        }
      }

      if (record) {
        // Update existing
        const { error } = await supabase
          .from('health_records')
          .update(updateData)
          .eq('id', record.id)
        if (error) {
          console.error('Supabase update error:', error)
          alert(`Error saving: ${error.message}`)
          throw error
        }
      } else {
        // Create new
        const { error } = await supabase
          .from('health_records')
          .insert(updateData)
        if (error) {
          console.error('Supabase insert error:', error)
          alert(`Error saving: ${error.message}`)
          throw error
        }
      }
      
      cancelEdit()
      await loadData()
    } catch (err) {
      console.error(`Error saving ${editing.person} ${editing.type}:`, err)
      alert(`Failed to save. Please check the browser console for details.`)
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

  function needsFluShot(dateString: string | null): boolean {
    if (!dateString) return true
    try {
      const shotDate = new Date(dateString)
      const currentYear = new Date().getFullYear()
      const augustThisYear = new Date(currentYear, 7, 1) // Month 7 = August (0-indexed)
      return shotDate < augustThisYear
    } catch {
      return true
    }
  }

  function needsWellVisit(dateString: string | null): boolean {
    if (!dateString) return true
    try {
      const visitDate = new Date(dateString)
      const oneYearAgo = new Date()
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1)
      return visitDate < oneYearAgo
    } catch {
      return true
    }
  }

  function renderStatusBadge(needs: boolean): JSX.Element {
    return (
      <span 
        style={{ 
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: needs ? '#d63384' : '#2d8f47',
          display: 'inline-block',
          border: '1px solid var(--border)',
          flexShrink: 0,
        }}
        title={needs ? (editing?.type === 'flu_shot' ? 'NEEDS FLU SHOT' : 'BOOK WELL VISIT') : 'OK'}
      />
    )
  }

  function renderPersonRow(person: PersonName, type: 'flu_shot' | 'well_visit') {
    const record = getRecord(person)
    const dateValue = type === 'flu_shot' 
      ? record?.flu_shot_last_date || null
      : record?.well_visit_last_date || null
    const needs = type === 'flu_shot' 
      ? needsFluShot(dateValue)
      : needsWellVisit(dateValue)
    
    const isEditing = editing?.person === person && editing?.type === type

    return (
      <tr key={`${person}-${type}`} style={{ borderBottom: '1px solid var(--border)' }}>
        <td style={{ padding: 12, fontSize: 14, fontWeight: 500 }}>
          {person}
        </td>
        <td style={{ padding: 12, fontSize: 14, color: needs ? '#d63384' : 'var(--ink-secondary)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                style={{ fontSize: 13, padding: '6px 8px', width: '200px' }}
                autoFocus
              />
              <div className="row" style={{ gap: 8 }}>
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    saveEdit()
                  }}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Save
                </button>
                <button 
                  type="button"
                  className="filter-btn" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    cancelEdit()
                  }}
                  style={{ padding: '6px 12px', fontSize: 12 }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            formatDate(dateValue)
          )}
        </td>
        <td style={{ padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {renderStatusBadge(needs)}
            {needs && (
              <span style={{ fontSize: 12, color: '#d63384', fontWeight: 500 }}>
                {type === 'flu_shot' ? 'NEEDS FLU SHOT' : 'BOOK WELL VISIT'}
              </span>
            )}
          </div>
        </td>
        <td style={{ padding: 12, textAlign: 'right' }}>
          {!isEditing && (
            <button
              className="filter-btn"
              onClick={() => startEdit(person, type)}
              style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
              title="Edit"
            >
              ✏️
            </button>
          )}
        </td>
      </tr>
    )
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <div>
      <h2>🩺 Health</h2>

      {/* Flu Shots Section */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px' }}>Flu shots</h3>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Person</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '30%' }}>Last flu shot</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '40%' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {fluShotPeople.map(person => renderPersonRow(person, 'flu_shot'))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Well Visits Section */}
      <div>
        <h3 style={{ margin: '0 0 16px' }}>Well visits</h3>
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Person</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '30%' }}>Last visit</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '40%' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '10%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {wellVisitPeople.map(person => renderPersonRow(person, 'well_visit'))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

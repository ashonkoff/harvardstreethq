import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type CarMaintenance = {
  id: string
  car_name: 'Mazda' | 'Honda'
  last_oil_change: string | null
  next_oil_change_due: string | null
  registration_due: string | null
  inspection_due: string | null
  created_at: string
  updated_at: string | null
}

type EditingRow = 'oil' | 'registration' | 'inspection' | null

export function Car() {
  const [mazda, setMazda] = useState<CarMaintenance | null>(null)
  const [honda, setHonda] = useState<CarMaintenance | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state for Mazda - per row
  const [mazdaEditingRow, setMazdaEditingRow] = useState<EditingRow>(null)
  const [mazdaLastOil, setMazdaLastOil] = useState('')
  const [mazdaNextOil, setMazdaNextOil] = useState('')
  const [mazdaRegistration, setMazdaRegistration] = useState('')
  const [mazdaInspection, setMazdaInspection] = useState('')

  // Form state for Honda - per row
  const [hondaEditingRow, setHondaEditingRow] = useState<EditingRow>(null)
  const [hondaLastOil, setHondaLastOil] = useState('')
  const [hondaNextOil, setHondaNextOil] = useState('')
  const [hondaRegistration, setHondaRegistration] = useState('')
  const [hondaInspection, setHondaInspection] = useState('')

  async function loadData() {
    try {
      const { data, error } = await supabase
        .from('car_maintenance')
        .select('*')
        .order('car_name', { ascending: true })
      
      if (error) throw error
      
      const mazdaData = (data || []).find(c => c.car_name === 'Mazda') as CarMaintenance | undefined
      const hondaData = (data || []).find(c => c.car_name === 'Honda') as CarMaintenance | undefined
      
      setMazda(mazdaData || null)
      setHonda(hondaData || null)
      setLoading(false)
    } catch (err) {
      console.error('Error loading car data:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function startEditRow(carName: 'Mazda' | 'Honda', rowType: 'oil' | 'registration' | 'inspection') {
    const carData = carName === 'Mazda' ? mazda : honda
    
    if (carName === 'Mazda') {
      setMazdaEditingRow(rowType)
      if (rowType === 'oil') {
        setMazdaLastOil(carData?.last_oil_change || '')
        setMazdaNextOil(carData?.next_oil_change_due || '')
      } else if (rowType === 'registration') {
        setMazdaRegistration(carData?.registration_due || '')
      } else if (rowType === 'inspection') {
        setMazdaInspection(carData?.inspection_due || '')
      }
    } else {
      setHondaEditingRow(rowType)
      if (rowType === 'oil') {
        setHondaLastOil(carData?.last_oil_change || '')
        setHondaNextOil(carData?.next_oil_change_due || '')
      } else if (rowType === 'registration') {
        setHondaRegistration(carData?.registration_due || '')
      } else if (rowType === 'inspection') {
        setHondaInspection(carData?.inspection_due || '')
      }
    }
  }

  function cancelEditRow(carName: 'Mazda' | 'Honda') {
    if (carName === 'Mazda') {
      setMazdaEditingRow(null)
      setMazdaLastOil('')
      setMazdaNextOil('')
      setMazdaRegistration('')
      setMazdaInspection('')
    } else {
      setHondaEditingRow(null)
      setHondaLastOil('')
      setHondaNextOil('')
      setHondaRegistration('')
      setHondaInspection('')
    }
  }

  async function saveRow(carName: 'Mazda' | 'Honda', rowType: 'oil' | 'registration' | 'inspection') {
    try {
      const carData = carName === 'Mazda' ? mazda : honda
      
      // Build update data - only update the fields for this row type, preserve others
      const updateData: any = {
        car_name: carName,
        updated_at: new Date().toISOString(),
      }

      if (rowType === 'oil') {
        if (carName === 'Mazda') {
          updateData.last_oil_change = mazdaLastOil || null
          updateData.next_oil_change_due = mazdaNextOil || null
        } else {
          updateData.last_oil_change = hondaLastOil || null
          updateData.next_oil_change_due = hondaNextOil || null
        }
        // Preserve other fields
        if (carData) {
          updateData.registration_due = carData.registration_due
          updateData.inspection_due = carData.inspection_due
        }
      } else if (rowType === 'registration') {
        if (carName === 'Mazda') {
          updateData.registration_due = mazdaRegistration || null
        } else {
          updateData.registration_due = hondaRegistration || null
        }
        // Preserve other fields
        if (carData) {
          updateData.last_oil_change = carData.last_oil_change
          updateData.next_oil_change_due = carData.next_oil_change_due
          updateData.inspection_due = carData.inspection_due
        }
      } else if (rowType === 'inspection') {
        if (carName === 'Mazda') {
          updateData.inspection_due = mazdaInspection || null
        } else {
          updateData.inspection_due = hondaInspection || null
        }
        // Preserve other fields
        if (carData) {
          updateData.last_oil_change = carData.last_oil_change
          updateData.next_oil_change_due = carData.next_oil_change_due
          updateData.registration_due = carData.registration_due
        }
      }

      if (carData) {
        // Update existing
        const { error } = await supabase
          .from('car_maintenance')
          .update(updateData)
          .eq('id', carData.id)
        if (error) throw error
      } else {
        // Create new - need to set defaults for other fields
        if (rowType === 'oil') {
          updateData.registration_due = null
          updateData.inspection_due = null
        } else if (rowType === 'registration') {
          updateData.last_oil_change = null
          updateData.next_oil_change_due = null
          updateData.inspection_due = null
        } else if (rowType === 'inspection') {
          updateData.last_oil_change = null
          updateData.next_oil_change_due = null
          updateData.registration_due = null
        }
        const { error } = await supabase
          .from('car_maintenance')
          .insert(updateData)
        if (error) throw error
      }
      
      cancelEditRow(carName)
      await loadData()
    } catch (err) {
      console.error(`Error saving ${carName} ${rowType}:`, err)
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

  function isDueSoon(dateString: string | null, daysAhead: number = 30): boolean {
    if (!dateString) return false
    try {
      const dueDate = new Date(dateString)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const diffTime = dueDate.getTime() - today.getTime()
      const diffDays = diffTime / (1000 * 60 * 60 * 24)
      return diffDays >= 0 && diffDays <= daysAhead
    } catch {
      return false
    }
  }

  function isOverdue(dateString: string | null): boolean {
    if (!dateString) return false
    try {
      const dueDate = new Date(dateString)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      return dueDate < today
    } catch {
      return false
    }
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading...</div>
  }

  const renderCarStatus = (
    carData: CarMaintenance | null,
    carName: 'Mazda' | 'Honda',
    editingRow: EditingRow,
    onEdit: (rowType: 'oil' | 'registration' | 'inspection') => void,
    onSave: (rowType: 'oil' | 'registration' | 'inspection') => void,
    onCancel: () => void,
  ) => {
    const isEditingOil = editingRow === 'oil'
    const isEditingRegistration = editingRow === 'registration'
    const isEditingInspection = editingRow === 'inspection'
    
    const lastOil = carName === 'Mazda' ? mazdaLastOil : hondaLastOil
    const setLastOil = carName === 'Mazda' ? setMazdaLastOil : setHondaLastOil
    const nextOil = carName === 'Mazda' ? mazdaNextOil : hondaNextOil
    const setNextOil = carName === 'Mazda' ? setMazdaNextOil : setHondaNextOil
    const registration = carName === 'Mazda' ? mazdaRegistration : hondaRegistration
    const setRegistration = carName === 'Mazda' ? setMazdaRegistration : setHondaRegistration
    const inspection = carName === 'Mazda' ? mazdaInspection : hondaInspection
    const setInspection = carName === 'Mazda' ? setMazdaInspection : setHondaInspection

    const renderEditForm = (rowType: 'oil' | 'registration' | 'inspection') => {
      if (rowType === 'oil') {
        return (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Last oil change</label>
                <input
                  type="date"
                  value={lastOil}
                  onChange={(e) => setLastOil(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Next oil change due</label>
                <input
                  type="date"
                  value={nextOil}
                  onChange={(e) => setNextOil(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={() => onSave('oil')} 
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Save
              </button>
              <button 
                className="filter-btn" 
                onClick={onCancel}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      } else if (rowType === 'registration') {
        return (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, marginBottom: 4 }}>Registration expires</label>
              <input
                type="date"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                style={{ fontSize: 13, padding: '6px 8px', width: '100%' }}
              />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={() => onSave('registration')} 
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Save
              </button>
              <button 
                className="filter-btn" 
                onClick={onCancel}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      } else if (rowType === 'inspection') {
        return (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, marginBottom: 4 }}>Inspection due</label>
              <input
                type="date"
                value={inspection}
                onChange={(e) => setInspection(e.target.value)}
                style={{ fontSize: 13, padding: '6px 8px', width: '100%' }}
              />
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={() => onSave('inspection')} 
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Save
              </button>
              <button 
                className="filter-btn" 
                onClick={onCancel}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }
      return null
    }

    const renderStatusBadge = (dateString: string | null) => {
      if (!dateString) return null
      
      let statusColor: string
      let statusTitle: string
      
      if (isOverdue(dateString)) {
        statusColor = '#d63384' // red
        statusTitle = 'Overdue'
      } else if (isDueSoon(dateString)) {
        statusColor = '#e6a700' // yellow
        statusTitle = 'Due soon'
      } else {
        statusColor = '#2d8f47' // green
        statusTitle = 'OK'
      }
      
      return (
        <span 
          style={{ 
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: statusColor,
            display: 'inline-block',
            border: '1px solid var(--border)',
            flexShrink: 0,
          }}
          title={statusTitle}
        />
      )
    }

    return (
      <div className="card">
        {/* Oil Change */}
        {isEditingOil && renderEditForm('oil')}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Oil change
              {renderStatusBadge(carData?.next_oil_change_due || null)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
              Last: {formatDate(carData?.last_oil_change || null)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)', marginTop: 4 }}>
              Next due: {formatDate(carData?.next_oil_change_due || null)}
            </div>
          </div>
          <div>
            <button
              className="filter-btn"
              onClick={() => onEdit('oil')}
              style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
              title="Edit"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Registration */}
        {isEditingRegistration && renderEditForm('registration')}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          paddingBottom: 16,
          borderBottom: '1px solid var(--border)',
          marginBottom: 16
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Registration
              {renderStatusBadge(carData?.registration_due || null)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
              Expires: {formatDate(carData?.registration_due || null)}
            </div>
          </div>
          <div>
            <button
              className="filter-btn"
              onClick={() => onEdit('registration')}
              style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
              title="Edit"
            >
              ✏️
            </button>
          </div>
        </div>

        {/* Inspection */}
        {isEditingInspection && renderEditForm('inspection')}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center'
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              Inspection
              {renderStatusBadge(carData?.inspection_due || null)}
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-secondary)' }}>
              Due: {formatDate(carData?.inspection_due || null)}
            </div>
          </div>
          <div>
            <button
              className="filter-btn"
              onClick={() => onEdit('inspection')}
              style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
              title="Edit"
            >
              ✏️
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2>🚗 Car</h2>

      {/* Mazda Section */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ margin: '0 0 16px' }}>Mazda</h3>
        {renderCarStatus(
          mazda,
          'Mazda',
          mazdaEditingRow,
          (rowType) => startEditRow('Mazda', rowType),
          (rowType) => saveRow('Mazda', rowType),
          () => cancelEditRow('Mazda'),
        )}
      </div>

      {/* Honda Section */}
      <div>
        <h3 style={{ margin: '0 0 16px' }}>Honda</h3>
        {renderCarStatus(
          honda,
          'Honda',
          hondaEditingRow,
          (rowType) => startEditRow('Honda', rowType),
          (rowType) => saveRow('Honda', rowType),
          () => cancelEditRow('Honda'),
        )}
      </div>
    </div>
  )
}

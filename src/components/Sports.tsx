import { useEffect, useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'

type Sport = {
  id: string
  sport: string
  season: string
  is_registered: boolean
  website_link: string | null
  child_name: 'Miles' | 'Harrison'
  created_at: string
}

export function Sports() {
  const [milesSports, setMilesSports] = useState<Sport[]>([])
  const [harrisonSports, setHarrisonSports] = useState<Sport[]>([])
  const [loading, setLoading] = useState(true)

  // Form state for Miles
  const [milesSport, setMilesSport] = useState('')
  const [milesSeason, setMilesSeason] = useState('')
  const [milesRegistered, setMilesRegistered] = useState(false)
  const [milesLink, setMilesLink] = useState('')
  const [editingMiles, setEditingMiles] = useState<Sport | null>(null)
  const [showMilesForm, setShowMilesForm] = useState(false)

  // Form state for Harrison
  const [harrisonSport, setHarrisonSport] = useState('')
  const [harrisonSeason, setHarrisonSeason] = useState('')
  const [harrisonRegistered, setHarrisonRegistered] = useState(false)
  const [harrisonLink, setHarrisonLink] = useState('')
  const [editingHarrison, setEditingHarrison] = useState<Sport | null>(null)
  const [showHarrisonForm, setShowHarrisonForm] = useState(false)

  // Convert season string (e.g., "Fall 2025") to a sortable numeric value
  function getSeasonSortValue(season: string | null | undefined): number {
    if (!season) return 999999 // Put empty seasons at the end
    
    const match = season.match(/(Spring|Summer|Fall|Winter)\s+(\d{4})/)
    if (!match) return 999999 // Invalid format goes to end
    
    const [, seasonName, year] = match
    const yearNum = parseInt(year, 10)
    
    // Season order in chronological year: Fall=1, Winter=2, Spring=3, Summer=4
    const seasonOrder: Record<string, number> = {
      'Fall': 1,
      'Winter': 2,
      'Spring': 3,
      'Summer': 4,
    }
    
    const seasonIndex = seasonOrder[seasonName] || 0
    // Combine year and season: year * 10 + seasonIndex
    // This way Fall 2025 (20251) < Winter 2025 (20252) < Spring 2026 (20263)
    return yearNum * 10 + seasonIndex
  }

  async function loadSports() {
    try {
      const { data, error } = await supabase
        .from('sports')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      
      const all = (data || []) as Sport[]
      
      // Sort by season chronologically (soonest first)
      const sortBySeason = (a: Sport, b: Sport) => {
        const aValue = getSeasonSortValue(a.season)
        const bValue = getSeasonSortValue(b.season)
        return aValue - bValue
      }
      
      const miles = all.filter(s => s.child_name === 'Miles').sort(sortBySeason)
      const harrison = all.filter(s => s.child_name === 'Harrison').sort(sortBySeason)
      
      setMilesSports(miles)
      setHarrisonSports(harrison)
      setLoading(false)
    } catch (err) {
      console.error('Error loading sports:', err)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSports()
  }, [])

  async function saveMilesSport() {
    if (!milesSport.trim()) return
    
    try {
      if (editingMiles) {
        const { error } = await supabase
          .from('sports')
          .update({
            sport: milesSport.trim(),
            season: milesSeason.trim(),
            is_registered: milesRegistered,
            website_link: milesLink.trim() || null,
          })
          .eq('id', editingMiles.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('sports')
          .insert({
            sport: milesSport.trim(),
            season: milesSeason.trim(),
            is_registered: milesRegistered,
            website_link: milesLink.trim() || null,
            child_name: 'Miles',
          })
        if (error) throw error
      }
      
      // Reset form
      setMilesSport('')
      setMilesSeason('')
      setMilesRegistered(false)
      setMilesLink('')
      setEditingMiles(null)
      setShowMilesForm(false)
      await loadSports()
    } catch (err) {
      console.error('Error saving Miles sport:', err)
    }
  }

  async function saveHarrisonSport() {
    if (!harrisonSport.trim()) return
    
    try {
      if (editingHarrison) {
        const { error } = await supabase
          .from('sports')
          .update({
            sport: harrisonSport.trim(),
            season: harrisonSeason.trim(),
            is_registered: harrisonRegistered,
            website_link: harrisonLink.trim() || null,
          })
          .eq('id', editingHarrison.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('sports')
          .insert({
            sport: harrisonSport.trim(),
            season: harrisonSeason.trim(),
            is_registered: harrisonRegistered,
            website_link: harrisonLink.trim() || null,
            child_name: 'Harrison',
          })
        if (error) throw error
      }
      
      // Reset form
      setHarrisonSport('')
      setHarrisonSeason('')
      setHarrisonRegistered(false)
      setHarrisonLink('')
      setEditingHarrison(null)
      setShowHarrisonForm(false)
      await loadSports()
    } catch (err) {
      console.error('Error saving Harrison sport:', err)
    }
  }

  function startEditMiles(sport: Sport) {
    setMilesSport(sport.sport)
    setMilesSeason(sport.season)
    setMilesRegistered(sport.is_registered)
    setMilesLink(sport.website_link || '')
    setEditingMiles(sport)
    setShowMilesForm(true)
  }

  function startEditHarrison(sport: Sport) {
    setHarrisonSport(sport.sport)
    setHarrisonSeason(sport.season)
    setHarrisonRegistered(sport.is_registered)
    setHarrisonLink(sport.website_link || '')
    setEditingHarrison(sport)
    setShowHarrisonForm(true)
  }

  function cancelEdit(child: 'Miles' | 'Harrison') {
    if (child === 'Miles') {
      setMilesSport('')
      setMilesSeason('')
      setMilesRegistered(false)
      setMilesLink('')
      setEditingMiles(null)
      setShowMilesForm(false)
    } else {
      setHarrisonSport('')
      setHarrisonSeason('')
      setHarrisonRegistered(false)
      setHarrisonLink('')
      setEditingHarrison(null)
      setShowHarrisonForm(false)
    }
  }

  function openMilesForm() {
    setShowMilesForm(true)
    setEditingMiles(null)
    setMilesSport('')
    setMilesSeason('')
    setMilesRegistered(false)
    setMilesLink('')
  }

  function openHarrisonForm() {
    setShowHarrisonForm(true)
    setEditingHarrison(null)
    setHarrisonSport('')
    setHarrisonSeason('')
    setHarrisonRegistered(false)
    setHarrisonLink('')
  }

  async function deleteSport(id: string) {
    if (!confirm('Delete this sport?')) return
    try {
      const { error } = await supabase.from('sports').delete().eq('id', id)
      if (error) throw error
      await loadSports()
    } catch (err) {
      console.error('Error deleting sport:', err)
    }
  }

  // Get emoji for sport based on keyword matching
  function getSportEmoji(sportName: string): string | null {
    if (!sportName) return null
    
    const lowerName = sportName.toLowerCase()
    
    // Mapping of keywords to emojis (order matters - more specific first)
    const sportMap: [string[], string][] = [
      [['soccer', 'football (soccer)', 'fútbol', 'futsal'], '⚽'],
      [['basketball', 'hoops'], '🏀'],
      [['baseball', 'softball', 'tee ball', 't-ball', 'tball'], '⚾'],
      [['american football', 'football'], '🏈'],
      [['tennis'], '🎾'],
      [['swimming', 'swim', 'aquatics'], '🏊'],
      [['gymnastics', 'gym'], '🤸'],
      [['track', 'track and field', 'athletics', 'running'], '🏃'],
      [['hockey', 'ice hockey', 'field hockey'], '🏒'],
      [['volleyball', 'volley'], '🏐'],
      [['golf'], '⛳'],
      [['wrestling', 'wrestle'], '🤼'],
      [['lacrosse'], '🥍'],
      [['cross country', 'xc', 'running'], '🏃'],
      [['dance', 'ballet'], '💃'],
      [['martial arts', 'karate', 'taekwondo', 'judo'], '🥋'],
      [['skating', 'ice skating', 'figure skating', 'hockey'], '⛸️'],
      [['skiing', 'ski', 'snowboarding'], '⛷️'],
      [['cycling', 'bike', 'bicycle'], '🚴'],
      [['cheerleading', 'cheer'], '🎉'],
      [['water polo'], '🤽'],
      [['rugby'], '🏉'],
    ]
    
    // Check each mapping for keyword matches
    for (const [keywords, emoji] of sportMap) {
      if (keywords.some(keyword => lowerName.includes(keyword))) {
        return emoji
      }
    }
    
    return null
  }

  // Get the next 4 seasons dynamically
  const seasonOptions = useMemo(() => {
    const now = new Date()
    const currentMonth = now.getMonth() + 1 // 1-12
    const currentYear = now.getFullYear()
    
    // Determine current season
    // Spring: 3-5, Summer: 6-8, Fall: 9-11, Winter: 12, 1-2
    let currentSeason: 'Spring' | 'Summer' | 'Fall' | 'Winter'
    
    if (currentMonth >= 3 && currentMonth <= 5) {
      currentSeason = 'Spring'
    } else if (currentMonth >= 6 && currentMonth <= 8) {
      currentSeason = 'Summer'
    } else if (currentMonth >= 9 && currentMonth <= 11) {
      currentSeason = 'Fall'
    } else {
      currentSeason = 'Winter'
    }
    
    // Season order in the year cycle: Fall → Winter → Spring → Summer
    const seasonOrder: ('Spring' | 'Summer' | 'Fall' | 'Winter')[] = ['Fall', 'Winter', 'Spring', 'Summer']
    const currentIndex = seasonOrder.indexOf(currentSeason)
    
    // Build array of next 4 seasons starting from current
    const seasons: string[] = []
    let year = currentYear
    
    for (let i = 0; i < 4; i++) {
      const seasonIndex = (currentIndex + i) % 4
      const seasonName = seasonOrder[seasonIndex]
      
      // Year increments when we cross from Winter (index 1) to Spring (index 2)
      if (i > 0) {
        const prevSeasonIndex = (currentIndex + i - 1) % 4
        if (prevSeasonIndex === 1) { // Previous was Winter
          year = currentYear + 1 // Next season (Spring) is next year
        }
      }
      
      seasons.push(`${seasonName} ${year}`)
    }
    
    return seasons
  }, [])

  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--muted)' }}>Loading...</div>
  }

  return (
    <div>
      <h2>🏃 Sports</h2>

      {/* Miles Table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Miles</h3>
          <button 
            className="filter-btn" 
            onClick={openMilesForm}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            + Add sport
          </button>
        </div>

        {/* Compact Add/Edit Form */}
        {showMilesForm && (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Sport *</label>
                <input
                  type="text"
                  placeholder="e.g., Soccer"
                  value={milesSport}
                  onChange={(e) => setMilesSport(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Season</label>
                <select
                  value={milesSeason}
                  onChange={(e) => setMilesSeason(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                >
                  <option value="">Select season...</option>
                  {seasonOptions.map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Website Link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={milesLink}
                  onChange={(e) => setMilesLink(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={milesRegistered}
                  onChange={(e) => setMilesRegistered(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                Registered
              </label>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={saveMilesSport} 
                disabled={!milesSport.trim()}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {editingMiles ? 'Update' : 'Add'} Sport
              </button>
              <button 
                className="filter-btn" 
                onClick={() => cancelEdit('Miles')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Miles Sports Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '30%' }}>Sport</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '18%' }}>Season</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '18%' }}>Website</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {milesSports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                    No sports added yet
                  </td>
                </tr>
              ) : (
                milesSports.map((sport) => {
                  const emoji = getSportEmoji(sport.sport)
                  return (
                  <tr key={sport.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sport.sport}
                      {emoji && (
                        <span style={{ marginLeft: 6 }}>{emoji}</span>
                      )}
                    </td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sport.season || '—'}</td>
                    <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span className={`tag ${sport.is_registered ? 'status-done' : 'status-todo'}`} style={{ fontSize: 11 }}>
                        {sport.is_registered ? 'Registered' : 'Not Registered'}
                      </span>
                    </td>
                    <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sport.website_link ? (
                        <a href={sport.website_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
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
                          onClick={() => startEditMiles(sport)}
                          style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deleteSport(sport.id)}
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

      {/* Harrison Table */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Harrison</h3>
          <button 
            className="filter-btn" 
            onClick={openHarrisonForm}
            style={{ padding: '6px 12px', fontSize: 12 }}
          >
            + Add sport
          </button>
        </div>

        {/* Compact Add/Edit Form */}
        {showHarrisonForm && (
          <div className="card" style={{ marginBottom: 16, padding: 12, background: 'var(--bg-secondary)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Sport *</label>
                <input
                  type="text"
                  placeholder="e.g., Soccer"
                  value={harrisonSport}
                  onChange={(e) => setHarrisonSport(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Season</label>
                <select
                  value={harrisonSeason}
                  onChange={(e) => setHarrisonSeason(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                >
                  <option value="">Select season...</option>
                  {seasonOptions.map(season => (
                    <option key={season} value={season}>{season}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div>
                <label style={{ fontSize: 11, marginBottom: 4 }}>Website Link</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={harrisonLink}
                  onChange={(e) => setHarrisonLink(e.target.value)}
                  style={{ fontSize: 13, padding: '6px 8px' }}
                />
              </div>
              <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={harrisonRegistered}
                  onChange={(e) => setHarrisonRegistered(e.target.checked)}
                  style={{ width: 14, height: 14, cursor: 'pointer' }}
                />
                Registered
              </label>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <button 
                onClick={saveHarrisonSport} 
                disabled={!harrisonSport.trim()}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                {editingHarrison ? 'Update' : 'Add'} Sport
              </button>
              <button 
                className="filter-btn" 
                onClick={() => cancelEdit('Harrison')}
                style={{ padding: '6px 12px', fontSize: 12 }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Harrison Sports Table */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <thead>
              <tr style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '30%' }}>Sport</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '18%' }}>Season</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '20%' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '18%' }}>Website</th>
                <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'var(--ink-secondary)', width: '14%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {harrisonSports.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                    No sports added yet
                  </td>
                </tr>
              ) : (
                harrisonSports.map((sport) => {
                  const emoji = getSportEmoji(sport.sport)
                  return (
                  <tr key={sport.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sport.sport}
                      {emoji && (
                        <span style={{ marginLeft: 6 }}>{emoji}</span>
                      )}
                    </td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sport.season || '—'}</td>
                    <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span className={`tag ${sport.is_registered ? 'status-done' : 'status-todo'}`} style={{ fontSize: 11 }}>
                        {sport.is_registered ? 'Registered' : 'Not Registered'}
                      </span>
                    </td>
                    <td style={{ padding: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sport.website_link ? (
                        <a href={sport.website_link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)' }}>
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
                          onClick={() => startEditHarrison(sport)}
                          style={{ padding: '6px 10px', fontSize: 14, minWidth: 'auto', background: 'transparent', color: 'var(--ink-secondary)', border: 'none', boxShadow: 'none' }}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => deleteSport(sport.id)}
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


import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subscription } from '../types'
import { format, isAfter, isBefore, isToday, parseISO } from 'date-fns'

export function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [cadence, setCadence] = useState<'monthly' | 'yearly'>('monthly')
  const [category, setCategory] = useState('entertainment')
  const [nextRenewal, setNextRenewal] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [isAdding, setIsAdding] = useState(false)

  const categories = ['entertainment', 'productivity', 'utilities', 'news', 'fitness', 'education', 'other']

  async function load() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setSubs(data || [])
  }

  useEffect(() => {
    load()
  }, [])

  async function add() {
    if (!name.trim()) return
    setIsAdding(true)
    
    try {
      const cents = Math.round((parseFloat(amount || '0') || 0) * 100)
      
      // Create insert object with only fields that exist
      const insertData: any = {
        name,
        amount_cents: cents,
        cadence: 'monthly',
      }
      
      const { error } = await supabase.from('subscriptions').insert(insertData)
      if (error) {
        console.error('Insert error', error)
        return
      }
      setName('')
      setAmount('')
      setCadence('monthly')
      setCategory('entertainment')
      setNextRenewal('')
      await load()
    } finally {
      setIsAdding(false)
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const { error } = await supabase.from('subscriptions').update({ is_active: !isActive }).eq('id', id)
    if (error) return console.error(error)
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  function dollars(cents: number) {
    return `$${(cents / 100).toFixed(2)}`
  }

  function getRenewalStatus(renewalDate: string | null) {
    if (!renewalDate) return { text: 'No date set', urgent: false, overdue: false }
    
    const date = parseISO(renewalDate)
    const now = new Date()
    
    if (isToday(date)) return { text: 'Due today', urgent: true, overdue: false }
    if (isBefore(date, now)) return { text: 'Overdue', urgent: true, overdue: true }
    if (isAfter(date, now)) return { text: format(date, 'MMM d'), urgent: false, overdue: false }
    
    return { text: format(date, 'MMM d'), urgent: false, overdue: false }
  }

  const filteredSubs = subs.filter(sub => 
    filter === 'all' || (filter === 'active' && (sub.is_active !== false)) || (filter === 'inactive' && sub.is_active === false)
  )

  const activeSubs = subs.filter(s => s.is_active !== false)
  const monthlyTotal = activeSubs
    .filter(s => s.cadence === 'monthly')
    .reduce((sum, s) => sum + s.amount_cents, 0)
  const yearlyTotal = activeSubs
    .filter(s => s.cadence === 'yearly')
    .reduce((sum, s) => sum + s.amount_cents, 0)

  return (
    <div>
      <h2>Subscriptions</h2>
      
      {/* Summary Stats */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 16, marginBottom: 8 }}>
          <div>
            <div className="small">Monthly Total</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>
              {dollars(monthlyTotal)}
            </div>
          </div>
          <div>
            <div className="small">Yearly Total</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent)' }}>
              {dollars(yearlyTotal)}
            </div>
          </div>
          <div>
            <div className="small">Active Subscriptions</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ok)' }}>
              {activeSubs.length}
            </div>
          </div>
        </div>
      </div>

      {/* Add Subscription Form */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ marginBottom: 12 }}>
          <input
            placeholder="Name (e.g., Netflix)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Amount (e.g., 15.99)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={{ width: 120 }}
          />
          <select
            value={cadence}
            onChange={(e) => setCadence(e.target.value as 'monthly' | 'yearly')}
            style={{ width: 100 }}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={{ width: 120 }}
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="date"
            placeholder="Next renewal"
            value={nextRenewal}
            onChange={(e) => setNextRenewal(e.target.value)}
            style={{ width: 140 }}
          />
          <button 
            onClick={add} 
            disabled={isAdding || !name.trim()}
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
          All ({subs.length})
        </button>
        <button 
          onClick={() => setFilter('active')}
          className={`filter-btn ${filter === 'active' ? 'active' : ''}`}
        >
          Active ({activeSubs.length})
        </button>
        <button 
          onClick={() => setFilter('inactive')}
          className={`filter-btn ${filter === 'inactive' ? 'active' : ''}`}
        >
          Inactive ({subs.length - activeSubs.length})
        </button>
      </div>

      {/* Subscriptions List */}
      <div className="grid" style={{ gap: 8 }}>
        {filteredSubs.map((sub) => {
          const renewalStatus = getRenewalStatus(sub.next_renewal_date)
          return (
            <div 
              className="item" 
              key={sub.id}
              style={{ 
                opacity: (sub.is_active !== false) ? 1 : 0.6,
                borderLeft: `4px solid ${(sub.is_active !== false) ? 'var(--ok)' : '#ff6b6b'}`
              }}
            >
              <div style={{ flex: 1 }}>
                <div className="row" style={{ gap: 12, marginBottom: 8 }}>
                  <div style={{ fontWeight: 700, fontSize: '16px' }}>{sub.name}</div>
                  <div className="tag" style={{ background: 'var(--accent)' }}>
                    {dollars(sub.amount_cents)}
                  </div>
                  <div className="tag" style={{ background: '#26304e' }}>
                    {sub.cadence}
                  </div>
                  <div className="tag" style={{ background: '#0c1224' }}>
                    {sub.category || 'entertainment'}
                  </div>
                  {renewalStatus.text !== 'No date set' && (
                    <span 
                      className="tag" 
                      style={{ 
                        background: renewalStatus.overdue ? '#ff6b6b' : 
                                   renewalStatus.urgent ? '#ffc857' : '#26304e',
                        color: renewalStatus.overdue ? 'white' : '#c7d3ff'
                      }}
                    >
                      {renewalStatus.text}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="row" style={{ gap: 8 }}>
                <button
                  onClick={() => toggleActive(sub.id, sub.is_active)}
                  className={`toggle-btn ${(sub.is_active !== false) ? 'deactivate' : 'activate'}`}
                >
                  {(sub.is_active !== false) ? 'Deactivate' : 'Activate'}
                </button>
                <button 
                  onClick={() => remove(sub.id)}
                  className="delete-btn"
                >
                  Delete
                </button>
              </div>
            </div>
          )
        })}
      </div>
      
      {filteredSubs.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '20px' }}>
          {filter === 'all' ? 'No subscriptions yet' : `No ${filter} subscriptions`}
        </div>
      )}
    </div>
  )
}

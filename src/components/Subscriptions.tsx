import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subscription } from '../types'

export function Subscriptions() {
  const [subs, setSubs] = useState<Subscription[]>([])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  async function load() {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) console.error(error)
    setSubs(data || [])
  }

  useEffect(() => { load() }, [])

  async function add() {
    if (!name.trim()) return
    const cents = Math.round((parseFloat(amount || '0') || 0) * 100)
    const { error } = await supabase.from('subscriptions').insert({ name, amount_cents: cents, cadence: 'monthly' })
    if (error) return console.error(error)
    setName(''); setAmount('')
    load()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('subscriptions').delete().eq('id', id)
    if (error) return console.error(error)
    load()
  }

  function dollars(cents: number){ return `$${(cents/100).toFixed(2)}` }

  return (
    <div>
      <h2>Subscriptions</h2>
      <div className="row">
        <input placeholder="Name (e.g., Netflix)" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Amount (e.g., 15.99)" value={amount} onChange={e => setAmount(e.target.value)} />
        <button onClick={add}>Add</button>
      </div>
      <div style={{ height: 10 }} />
      <div className="grid" style={{ gap: 8 }}>
        {subs.map(s => (
          <div className="item" key={s.id}>
            <div className="row" style={{ gap: 12 }}>
              <div style={{ fontWeight: 700 }}>{s.name}</div>
              <div className="tag">{dollars(s.amount_cents)}</div>
              <div className="tag">{s.cadence}</div>
            </div>
            <button onClick={() => remove(s.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  )
}

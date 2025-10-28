import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { Session } from '@supabase/supabase-js'
import { Header } from './components/Header'
import { RequireAuth } from './components/RequireAuth'
import { Notes } from './components/Notes'
import { Tasks } from './components/Tasks'
import { Subscriptions } from './components/Subscriptions'
import { CalendarPlaceholder } from './components/CalendarPlaceholder'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <div className="container">
      <Header session={session} />
      <RequireAuth session={session}>
        <div className="grid grid-3">
          <div className="card"><Notes /></div>
          <div className="card"><Tasks /></div>
          <div className="card"><Subscriptions /></div>
        </div>
        <div style={{ height: 16 }} />
        <div className="card"><CalendarPlaceholder /></div>
      </RequireAuth>
    </div>
  )
}

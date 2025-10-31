import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function Header({ session }: { session: Session | null }) {
  return (
    <div className="card compact" style={{ marginBottom: 8 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1>Harvard Street Hub</h1>
        </div>
        <div>
          {session && (
            <div className="row" style={{ gap: 12 }}>
              <span className="tag" style={{ background: 'var(--bg-secondary)', color: 'var(--ink-secondary)' }}>
                {session.user.email}
              </span>
              <button 
                onClick={() => supabase.auth.signOut()}
                style={{ fontSize: '12px', padding: '8px 16px' }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

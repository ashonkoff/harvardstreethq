import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { SignIn } from './SignIn'

export function Header({ session }: { session: Session | null }) {
  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1>Family HQ</h1>
          <div className="small">Secure home for notes • tasks • subscriptions • calendar</div>
        </div>
        <div>
          {session ? (
            <div className="row">
              <span className="tag">{session.user.email}</span>
              <button onClick={() => supabase.auth.signOut()}>Sign out</button>
            </div>
          ) : (
            <SignIn />
          )}
        </div>
      </div>
    </div>
  )
}

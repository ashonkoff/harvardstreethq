import { ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { SignIn } from './SignIn'

export function RequireAuth({ session, children }: { session: Session | null, children: ReactNode }) {
  if (!session) {
    return (
      <div className="card" style={{ 
        maxWidth: '500px', 
        margin: '80px auto', 
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
      }}>
        <h2 style={{ marginBottom: 0 }}>Hello.</h2>
        <p style={{ 
          margin: 0, 
          color: 'var(--ink-secondary)', 
          fontSize: '15px',
          lineHeight: '1.6'
        }}>
          Sign in and give the Hub permission to access your Google account.
        </p>
        <div style={{ marginTop: '8px' }}>
          <SignIn />
        </div>
      </div>
    )
  }
  return <>{children}</>
}

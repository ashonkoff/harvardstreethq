import { ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { SignIn } from './SignIn'

export function RequireAuth({ session, children }: { session: Session | null, children: ReactNode }) {
  if (!session) {
    return (
      <div className="card">
        <h2>Welcome</h2>
        <p>Please sign in to access your family space.</p>
        <SignIn />
      </div>
    )
  }
  return <>{children}</>
}

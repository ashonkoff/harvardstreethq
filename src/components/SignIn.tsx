import { supabase } from '../lib/supabase'

export function SignIn() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/tasks',
        redirectTo: window.location.origin,
        queryParams: { 
          access_type: 'offline', 
          prompt: 'consent select_account',
          // Request that provider_token is returned
          skipHTTPRedirect: false
        },
      },
    })
  }

  return (
    <button 
      onClick={signInWithGoogle}
      style={{
        padding: '14px 32px',
        fontSize: '15px',
        fontWeight: 600,
        borderRadius: '12px',
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        boxShadow: 'var(--shadow)',
        transition: 'all 0.2s ease',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-hover)'
        e.currentTarget.style.boxShadow = 'var(--shadow-lg)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--accent)'
        e.currentTarget.style.boxShadow = 'var(--shadow)'
      }}
    >
      Sign in with Google
    </button>
  )
}

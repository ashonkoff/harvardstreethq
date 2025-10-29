import { supabase } from '../lib/supabase'

export function SignIn() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        scopes: 'https://www.googleapis.com/auth/calendar.readonly',
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

  return <button onClick={signInWithGoogle}>Sign in with Google</button>
}

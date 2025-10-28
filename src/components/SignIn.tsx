import { supabase } from '../lib/supabase'

export function SignIn() {
  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: 'offline', prompt: 'select_account' },
      },
    })
  }

  return <button onClick={signInWithGoogle}>Sign in with Google</button>
}

import { supabase } from './supabase'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function verifyAccountPassword(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({ email, password })
  return error === null
}

export async function signUp(displayName: string, email: string, password: string) {
  const { data, error } = await requireSupabase().auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: `${window.location.origin}/`,
    },
  })
  if (error) throw error
  return data.session !== null
}

export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw error
}

export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password })
  if (error) throw error
}

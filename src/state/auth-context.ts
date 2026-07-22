import type { Session, User } from '@supabase/supabase-js'
import { createContext } from 'react'

export interface AuthContextValue {
  loading: boolean
  session: Session | null
  user: User | null
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

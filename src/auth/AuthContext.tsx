import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, tokenStore, UNAUTHORIZED_EVENT } from '../lib/api'
import type { User } from '../types'

type Ctx = { user: User | null; loading: boolean; login: (e: string, p: string) => Promise<void>; logout: () => void }
const AuthCtx = createContext<Ctx>(null!)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(!!tokenStore.get())

  const logout = useCallback(() => { tokenStore.clear(); setUser(null) }, [])

  useEffect(() => {
    if (tokenStore.get()) api.me().then(setUser).catch(logout).finally(() => setLoading(false))
    window.addEventListener(UNAUTHORIZED_EVENT, logout)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, logout)
  }, [logout])

  const login = async (email: string, password: string) => {
    const res = await api.login(email, password)
    if (res.user.role !== 'admin' && res.user.role !== 'support') throw new Error('This account cannot access the admin dashboard.')
    tokenStore.set(res.token); setUser(res.user)
  }

  return <AuthCtx.Provider value={{ user, loading, login, logout }}>{children}</AuthCtx.Provider>
}

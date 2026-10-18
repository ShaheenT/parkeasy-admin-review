import type { Integration, Row, User } from '../types'
import { RESOURCES, type ResourceKey } from './resources'
import { db, integrationsDb } from './mock'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !BASE
const TOKEN_KEY = 'parkeasy.token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

/** Fired on any 401 so AuthContext can sign the admin out. */
export const UNAUTHORIZED_EVENT = 'parkeasy:unauthorized'

async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const target = `${BASE}?path=${encodeURIComponent(path)}`
  const res = await fetch(target, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}), ...init.headers },
  })
  if (res.status === 401) { window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); throw new Error('Session expired. Sign in again.') }
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`)
  return res.status === 204 ? (undefined as T) : res.json()
}

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))

export const api = {
  /** POST /auth/login -> { token, user } */
  async login(email: string, password: string): Promise<{ token: string; user: User }> {
    if (MOCK) {
      if (email === 'admin@parkeasy.co.za' && password === 'admin123')
        return wait({ token: 'mock-token', user: { id: '1', name: 'Admin', email, role: 'admin' } })
      throw new Error('Email or password is incorrect.')
    }
    return http('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
  },
  /** GET /auth/me -> User */
  async me(): Promise<User> {
    if (MOCK) return wait({ id: '1', name: 'Admin', email: 'admin@parkeasy.co.za', role: 'admin' })
    return http('/auth/me')
  },
  /** GET /admin/:resource -> Row[] */
  list(resource: ResourceKey): Promise<Row[]> {
    return MOCK ? wait(db[resource]) : http(`/admin/${resource}`)
  },
  /** PATCH /admin/:resource/:id { action } -> Row */
  async act(resource: ResourceKey, id: Row['id'], action: string): Promise<Row> {
    if (MOCK) {
      const def = RESOURCES[resource].actions?.find((a) => a.action === action)
      const row = db[resource].find((r) => r.id === id)
      if (!def || !row) throw new Error('Unknown action')
      Object.assign(row, def.set)
      return wait(row)
    }
    return http(`/admin/${resource}/${id}`, { method: 'PATCH', body: JSON.stringify({ action }) })
  },
  /** POST /admin/announcements { message } */
  async announce(message: string): Promise<void> {
    if (MOCK) { db.notifications.unshift({ id: Date.now(), message, when: 'just now' }); return wait(undefined) }
    return http('/admin/announcements', { method: 'POST', body: JSON.stringify({ message }) })
  },
  /** GET /admin/integrations -> Integration[] */
  integrations(): Promise<Integration[]> {
    return MOCK ? wait(integrationsDb) : http('/admin/integrations')
  },
  /** PUT /admin/integrations/:id { connected, config } */
  async setIntegration(id: string, connected: boolean, config?: string): Promise<Integration> {
    if (MOCK) {
      const i = integrationsDb.find((x) => x.id === id)!
      i.connected = connected; if (config !== undefined) i.config = config
      return wait(i)
    }
    return http(`/admin/integrations/${id}`, { method: 'PUT', body: JSON.stringify({ connected, config }) })
  },
}

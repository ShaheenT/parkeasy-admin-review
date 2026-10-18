import type { Integration, Row, User } from '../types'
import { RESOURCES, type ResourceKey } from './resources'
import { db, integrationsDb } from './mock'

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')
export const MOCK = import.meta.env.VITE_USE_MOCK === 'true' || !BASE
const TOKEN_KEY = 'parkeasy.token'
const PUBLIC_API_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

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
    headers: { 'Content-Type': 'application/json', ...(PUBLIC_API_KEY ? { apikey: PUBLIC_API_KEY } : {}), ...(tokenStore.get() ? { Authorization: `Bearer ${tokenStore.get()}` } : {}), ...init.headers },
  })
  if (res.status === 401) { window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)); throw new Error('Session expired. Sign in again.') }
  if (!res.ok) throw new Error((await res.text()) || `Request failed (${res.status})`)
  return res.status === 204 ? (undefined as T) : res.json()
}

const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(structuredClone(v)), 120))

export type OpportunityType = 'event' | 'ev_charger' | 'wash_service'
export type Opportunity = {
 id: string; opportunityType: OpportunityType; title: string; location: string; latitude: number | null; longitude: number | null;
 startsAt: string | null; endsAt: string | null; status: string; sourceUrl: string; confidence: string;
 estimatedDemand: number | null; nearbySupply: number | null; notes: string; createdAt: string; updatedAt: string
}
export type OpportunityCreate = Omit<Opportunity, 'id' | 'latitude' | 'longitude' | 'createdAt' | 'updatedAt'>
export type OpportunityUpdate = { status?: string; notes?: string; confidence?: string }
const opportunityFromDb = (row: Record<string, unknown>): Opportunity => ({
 id: String(row.id), opportunityType: String(row.opportunity_type) as OpportunityType, title: String(row.title ?? ''),
 location: String(row.location ?? ''), latitude: row.latitude == null ? null : Number(row.latitude), longitude: row.longitude == null ? null : Number(row.longitude),
 startsAt: row.starts_at ? String(row.starts_at) : null, endsAt: row.ends_at ? String(row.ends_at) : null, status: String(row.status ?? 'research'),
 sourceUrl: String(row.source_url ?? ''), confidence: String(row.confidence ?? 'unverified'),
 estimatedDemand: row.estimated_demand == null ? null : Number(row.estimated_demand), nearbySupply: row.nearby_supply == null ? null : Number(row.nearby_supply),
 notes: String(row.notes ?? ''), createdAt: String(row.created_at ?? ''), updatedAt: String(row.updated_at ?? '')
})
export type ScoutWorkflowStatus = 'identified' | 'researched' | 'host_contacted' | 'listing_onboarded'
export type ScoutTarget = {
  id: string
  targetKey: string
  latitude: number
  longitude: number
  bookingsCount: number
  supplyCount: number
  priorityScore: number
  workflowStatus: ScoutWorkflowStatus
  researchNotes: string
  contactName: string
  contactMethod: string
  listingId: string
  statusChangedAt: string
  createdAt: string
  updatedAt: string
}
export type ScoutTargetSnapshot = {
  targetKey: string
  latitude: number
  longitude: number
  bookingsCount: number
  supplyCount: number
  priorityScore: number
}
export type ScoutTargetUpdate = {
  status?: ScoutWorkflowStatus
  researchNotes?: string
  contactName?: string
  contactMethod?: string
  listingId?: string | null
}
const scoutTargetFromDb = (row: Record<string, unknown>): ScoutTarget => ({
  id: String(row.id), targetKey: String(row.target_key),
  latitude: Number(row.latitude), longitude: Number(row.longitude),
  bookingsCount: Number(row.bookings_count ?? 0), supplyCount: Number(row.supply_count ?? 0),
  priorityScore: Number(row.priority_score ?? 0),
  workflowStatus: String(row.workflow_status ?? 'identified') as ScoutWorkflowStatus,
  researchNotes: String(row.research_notes ?? ''), contactName: String(row.contact_name ?? ''),
  contactMethod: String(row.contact_method ?? ''), listingId: String(row.listing_id ?? ''),
  statusChangedAt: String(row.status_changed_at ?? ''), createdAt: String(row.created_at ?? ''),
  updatedAt: String(row.updated_at ?? ''),
})

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
  async opportunities(): Promise<Opportunity[]> {
    if (MOCK) return wait([] as Opportunity[])
    const rows = await http<Record<string, unknown>[]>('/admin/opportunities')
    return rows.map(opportunityFromDb)
  },
  async createOpportunity(input: Omit<OpportunityCreate, 'latitude' | 'longitude'>): Promise<Opportunity> {
    if (MOCK) throw new Error('Opportunity tracking requires the connected test database.')
    const body = { ...input, opportunityType: input.opportunityType, startsAt: input.startsAt || null, endsAt: input.endsAt || null }
    return opportunityFromDb(await http<Record<string, unknown>>('/admin/opportunities', { method: 'POST', body: JSON.stringify(body) }))
  },
  async updateOpportunity(id: string, patch: OpportunityUpdate): Promise<Opportunity> {
    if (MOCK) throw new Error('Opportunity tracking requires the connected test database.')
    return opportunityFromDb(await http<Record<string, unknown>>('/admin/opportunities/' + id, { method: 'PATCH', body: JSON.stringify(patch) }))
  },
  async scoutTargets(): Promise<ScoutTarget[]> {
    if (MOCK) return wait([] as ScoutTarget[])
    const rows = await http<Record<string, unknown>[]>('/admin/scout-targets')
    return rows.map(scoutTargetFromDb)
  },
  async syncScoutTargets(targets: ScoutTargetSnapshot[]): Promise<ScoutTarget[]> {
    if (MOCK) return wait([] as ScoutTarget[])
    const rows = await http<Record<string, unknown>[]>('/admin/scout-targets/sync', { method: 'POST', body: JSON.stringify({ targets }) })
    return rows.map(scoutTargetFromDb)
  },
  async updateScoutTarget(id: string, patch: ScoutTargetUpdate): Promise<ScoutTarget> {
    if (MOCK) throw new Error('Scout workflow is available only with the connected test database.')
    const row = await http<Record<string, unknown>>(`/admin/scout-targets/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    return scoutTargetFromDb(row)
  },
}

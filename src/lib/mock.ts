import type { Integration, Row } from '../types'
import type { ResourceKey } from './resources'

// Deterministic pseudo-random so the demo looks the same on every load
let seed = 7
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]

const bays: Row[] = [
  { id: 1, name: 'Kloof St Driveway', host: 'Naledi Mokoena', rate: 35, status: 'active', occupancy: 72, lat: -33.9295, lng: 18.4128 },
  { id: 2, name: 'Bree St Garage', host: 'Thabo Nkosi', rate: 50, status: 'paused', occupancy: 40, lat: -33.9217, lng: 18.4219 },
  { id: 3, name: 'Gardens Courtyard', host: 'Naledi Mokoena', rate: 45, status: 'active', occupancy: 88, lat: -33.9370, lng: 18.4107 },
  { id: 4, name: 'Sea Point Carport', host: 'Aisha Patel', rate: 40, status: 'active', occupancy: 63, lat: -33.9166, lng: 18.3847 },
]
const drivers = ['Liam van Wyk', 'Aisha Patel', 'Emma Smith', 'Sipho Dlamini']
const statuses = ['completed', 'completed', 'completed', 'confirmed', 'active', 'cancelled']

const bookings: Row[] = Array.from({ length: 48 }, (_, i) => {
  const b = pick(bays), hours = 1 + Math.floor(rnd() * 5)
  const d = new Date(); d.setDate(d.getDate() - Math.floor(rnd() * 30)); d.setHours(6 + Math.floor(rnd() * 14), 0, 0, 0)
  return { id: i + 1, ref: `BK-${1000 + i}`, driver: pick(drivers), bay: String(b.name), hours, amount: hours * Number(b.rate), status: pick(statuses), date: d.toISOString() }
})

export const db: Record<ResourceKey, Row[]> = {
  users: [
    { id: 1, name: 'Naledi Mokoena', role: 'host', status: 'active', area: 'Cape Town' },
    { id: 2, name: 'Liam van Wyk', role: 'driver', status: 'active', area: 'Sea Point' },
    { id: 3, name: 'Aisha Patel', role: 'driver', status: 'active', area: 'Gardens' },
    { id: 4, name: 'Thabo Nkosi', role: 'host', status: 'suspended', area: 'Woodstock' },
  ],
  scouts: [
    { id: 1, name: 'Emma Smith', leads: 12, earned: 'R240,00' },
    { id: 2, name: 'Sipho Dlamini', leads: 7, earned: 'R140,00' },
  ],
  leads: [
    { id: 1, address: '12 Kloof St', scout: 'Emma Smith', status: 'pending' },
    { id: 2, address: '4 Bree St', scout: 'Sipho Dlamini', status: 'approved' },
    { id: 3, address: '88 Main Rd', scout: 'Zara Jacobs', status: 'rejected' },
    { id: 4, address: '31 Long St', scout: 'Emma Smith', status: 'pending' },
  ],
  bays,
  bookings,
  payments: bookings.slice(0, 8).map((b, i) => ({ id: i + 1, ref: `PY-${500 + i}`, booking: String(b.ref), amount: Number(b.amount), status: b.status === 'cancelled' ? 'refunded' : 'paid' })),
  payouts: [
    { id: 1, ref: 'PO-21', host: 'Naledi Mokoena', amount: 420, status: 'queued' },
    { id: 2, ref: 'PO-22', host: 'Thabo Nkosi', amount: 241.5, status: 'queued' },
    { id: 3, ref: 'PO-20', host: 'Naledi Mokoena', amount: 310, status: 'paid' },
  ],
  devices: [
    { id: 1, name: 'Gate-Kloof-01', bay: 'Kloof St Driveway', status: 'online', battery: '92%' },
    { id: 2, name: 'Gate-Bree-01', bay: 'Bree St Garage', status: 'offline', battery: '—' },
    { id: 3, name: 'Gate-Gardens-01', bay: 'Gardens Courtyard', status: 'online', battery: '64%' },
  ],
  notifications: [
    { id: 1, message: 'Booking BK-1048 confirmed', when: '2 min ago' },
    { id: 2, message: 'Payout PO-22 queued', when: '1 h ago' },
    { id: 3, message: 'Device Gate-Bree-01 offline', when: '3 h ago' },
  ],
  support: [
    { id: 1, from: 'Liam van Wyk', subject: 'Gate did not open', status: 'open' },
    { id: 2, from: 'Naledi Mokoena', subject: 'Change my payout bank', status: 'open' },
    { id: 3, from: 'Aisha Patel', subject: 'Refund request', status: 'resolved' },
  ],
  kyc: [
    { id: 1, name: 'Naledi Mokoena', document: 'SA ID', risk: 'low', status: 'verified' },
    { id: 2, name: 'Thabo Nkosi', document: 'Passport', risk: 'medium', status: 'review' },
    { id: 3, name: 'Zara Jacobs', document: 'SA ID', risk: 'high', status: 'review' },
  ],
}

export const integrationsDb: Integration[] = [
  { id: 'slack', name: 'Slack', description: 'Send booking, payout and device alerts to a channel.', connected: false, config: '' },
  { id: 'zoom', name: 'Zoom', description: 'Host onboarding calls with scouts and new hosts.', connected: false },
  { id: 'hubspot', name: 'HubSpot', description: 'Sync host and scout leads into your CRM.', connected: false },
  { id: 'salesforce', name: 'Salesforce', description: 'Push verified hosts and revenue to Salesforce.', connected: false },
]

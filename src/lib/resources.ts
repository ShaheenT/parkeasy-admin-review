import type { Row } from '../types'

export type ResourceKey =
  | 'users' | 'scouts' | 'leads' | 'bays' | 'bookings' | 'payments'
  | 'payouts' | 'devices' | 'notifications' | 'support' | 'kyc'

export type RowAction = {
  label: string
  /** Sent to the API as PATCH /admin/:resource/:id { action } */
  action: string
  /** Applied locally in mock mode */
  set: Partial<Row>
  when?: (r: Row) => boolean
}

export type ResourceDef = {
  title: string
  columns: string[]
  actions?: RowAction[]
}

const on = (s: string) => (r: Row) => r.status === s

export const RESOURCES: Record<ResourceKey, ResourceDef> = {
  users: { title: 'Users', columns: ['name', 'role', 'status', 'area'], actions: [
    { label: 'Suspend', action: 'suspend', set: { status: 'suspended' }, when: on('active') },
    { label: 'Restore', action: 'restore', set: { status: 'active' }, when: on('suspended') },
  ] },
  scouts: { title: 'Scouts', columns: ['name', 'leads', 'earned'] },
  leads: { title: 'Scout Leads', columns: ['address', 'scout', 'status'], actions: [
    { label: 'Approve', action: 'approve', set: { status: 'approved' }, when: on('pending') },
    { label: 'Reject', action: 'reject', set: { status: 'rejected' }, when: on('pending') },
  ] },
  bays: { title: 'Parking Bays', columns: ['name', 'host', 'rate', 'status', 'occupancy'], actions: [
    { label: 'Pause', action: 'pause', set: { status: 'paused' }, when: on('active') },
    { label: 'Activate', action: 'activate', set: { status: 'active' }, when: on('paused') },
  ] },
  bookings: { title: 'Bookings', columns: ['ref', 'driver', 'bay', 'hours', 'amount', 'status'], actions: [
    { label: 'Cancel', action: 'cancel', set: { status: 'cancelled' }, when: (r) => ['confirmed', 'active'].includes(String(r.status)) },
  ] },
  payments: { title: 'Payments', columns: ['ref', 'booking', 'amount', 'status'], actions: [
    { label: 'Refund', action: 'refund', set: { status: 'refunded' }, when: on('paid') },
  ] },
  payouts: { title: 'Payouts', columns: ['ref', 'host', 'amount', 'status'], actions: [
    { label: 'Release', action: 'release', set: { status: 'paid' }, when: on('queued') },
  ] },
  devices: { title: 'Devices', columns: ['name', 'bay', 'status', 'battery'], actions: [
    { label: 'Ping', action: 'ping', set: { status: 'online' }, when: on('offline') },
  ] },
  notifications: { title: 'Notifications', columns: ['message', 'when'] },
  support: { title: 'Support Inbox', columns: ['from', 'subject', 'status'], actions: [
    { label: 'Resolve', action: 'resolve', set: { status: 'resolved' }, when: on('open') },
  ] },
  kyc: { title: 'KYC / Risk', columns: ['name', 'document', 'risk', 'status'], actions: [
    { label: 'Verify', action: 'verify', set: { status: 'verified' }, when: (r) => r.status !== 'verified' },
    { label: 'Flag', action: 'flag', set: { status: 'flagged', risk: 'high' }, when: (r) => r.status !== 'flagged' },
  ] },
}

export const statusClass = (s?: string) => {
  if (!s) return ''
  if (['suspended', 'rejected', 'cancelled', 'offline', 'refunded', 'flagged', 'high'].includes(s)) return 'bad'
  if (['pending', 'queued', 'open', 'paused', 'review', 'medium'].includes(s)) return 'warn'
  if (['confirmed', 'resolved'].includes(s)) return 'info'
  return 'ok'
}

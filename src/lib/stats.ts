import type { Range, Row } from '../types'

export const money = (n: number) => 'R' + n.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const COMMISSION = 0.16
const DAYS: Record<Range, number> = { day: 1, week: 7, month: 30 }
const DOW = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

export function inRange(bookings: Row[], range: Range) {
  const from = Date.now() - DAYS[range] * 864e5
  return bookings.filter((b) => new Date(String(b.date)).getTime() >= from)
}

export function revenueSeries(bookings: Row[], range: Range, paidOut: number) {
  const days = DAYS[range] === 1 ? 1 : DAYS[range]
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
    return { key: d.toDateString(), label: d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }), revenue: 0, commission: 0, payouts: 0, bookings: 0 }
  })
  bookings.filter((b) => b.status !== 'cancelled').forEach((b) => {
    const p = out.find((x) => x.key === new Date(String(b.date)).toDateString())
    if (p) { p.revenue += Number(b.amount); p.commission += Number(b.amount) * COMMISSION; p.bookings += 1 }
  })
  if (out.length) out[out.length - 1].payouts = paidOut
  return out
}

export function statusCounts(bookings: Row[]) {
  return ['confirmed', 'active', 'completed', 'cancelled'].map((name) => ({ name, value: bookings.filter((b) => b.status === name).length }))
}

/** 5 time-slots x 7 weekdays booking intensity (0..1) */
export function heatmap(bookings: Row[]) {
  const slots = [6, 9, 12, 15, 18], grid = slots.map(() => Array(7).fill(0))
  bookings.forEach((b) => {
    const d = new Date(String(b.date)), s = Math.min(4, Math.max(0, Math.floor((d.getHours() - 6) / 3)))
    grid[s][d.getDay()] += 1
  })
  const max = Math.max(1, ...grid.flat())
  return { days: DOW, slots: slots.map((h) => `${h}:00`), grid: grid.map((r) => r.map((v) => v / max)) }
}

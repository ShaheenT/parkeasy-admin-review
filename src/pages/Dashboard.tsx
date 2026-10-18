import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '../lib/api'
import { COMMISSION, heatmap, inRange, money, revenueSeries, statusCounts } from '../lib/stats'
import { statusClass } from '../lib/resources'
import type { Range, Row } from '../types'

type Data = { users: Row[]; bays: Row[]; bookings: Row[]; devices: Row[]; payouts: Row[]; kyc: Row[] }
const COLORS = ['#00E5A8', '#FFFFFF', '#1E8F73', '#7d7d88']

export default function Dashboard() {
  const [d, setD] = useState<Data | null>(null)
  const [range, setRange] = useState<Range>('week')
  const [error, setError] = useState('')

  const load = () => Promise.all((['users', 'bays', 'bookings', 'devices', 'payouts', 'kyc'] as const).map((k) => api.list(k)))
    .then(([users, bays, bookings, devices, payouts, kyc]) => setD({ users, bays, bookings, devices, payouts, kyc }))
    .catch((e: Error) => setError(e.message))
  useEffect(() => { load() }, [])

  const m = useMemo(() => {
    if (!d) return null
    const bookings = inRange(d.bookings, range)
    const gross = bookings.filter((b) => b.status !== 'cancelled').reduce((a, b) => a + Number(b.amount), 0)
    const queue = d.payouts.filter((p) => p.status === 'queued').reduce((a, p) => a + Number(p.amount), 0)
    const occ = Math.round(d.bays.reduce((a, b) => a + Number(b.occupancy), 0) / Math.max(1, d.bays.length))
    return { bookings, gross, queue, occ, series: revenueSeries(bookings, range, d.payouts.filter((p) => p.status === 'paid').reduce((a, p) => a + Number(p.amount), 0)), status: statusCounts(bookings), heat: heatmap(bookings) }
  }, [d, range])

  if (error) return <div className="err" role="alert">{error}</div>
  if (!d || !m) return <p className="lab">Loading…</p>

  const kpis: [string, string | number, string][] = [
    ['Users', d.users.length, `${d.users.filter((u) => u.status === 'active').length} active`],
    ['Active Bays', d.bays.filter((b) => b.status === 'active').length, `${d.bays.length} total listings`],
    ['Gross Revenue', money(m.gross), `Commission ${money(m.gross * COMMISSION)}`],
    ['Devices Online', d.devices.filter((x) => x.status === 'online').length, `${d.devices.length} installed`],
    ['Bookings', m.bookings.length, ''], ['Host Held', money(m.gross * (1 - COMMISSION)), ''],
    ['Payout Queue', money(m.queue), ''], ['KYC / Risk', d.kyc.filter((k) => k.risk === 'high').length, 'High-risk profiles'],
  ]
  const ang = Math.PI * (m.occ / 100), gx = 100 - 80 * Math.cos(ang), gy = 100 - 80 * Math.sin(ang)
  const tip = { background: 'var(--panel2)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--tx)' }

  return (
    <div data-testid="dashboard">
      <div className="toolbar">
        <div className="seg">{(['day', 'week', 'month'] as Range[]).map((r) => <button key={r} data-testid={`range-${r}`} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>)}</div>
        <button onClick={load}>Refresh</button>
      </div>
      <div className="grid k4">{kpis.map(([t, v, s]) => (
        <div className="card" key={t} data-testid={`kpi-${t}`}><div className="lab">{t}</div><div className="big">{v}</div>{s && <span className="chip ok">{s}</span>}</div>
      ))}</div>

      <div className="grid k2" style={{ marginTop: 14 }}>
        <div className="card"><h3>Revenue &amp; cash flow</h3>
          <ResponsiveContainer width="100%" height={240}><AreaChart data={m.series}>
            <defs><linearGradient id="rv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#00E5A8" stopOpacity={0.45} /><stop offset="1" stopColor="#00E5A8" stopOpacity={0} /></linearGradient></defs>
            <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" stroke="var(--mut)" fontSize={11} /><YAxis stroke="var(--mut)" fontSize={11} />
            <Tooltip contentStyle={tip} formatter={(v: number) => money(v)} /><Legend />
            <Area dataKey="revenue" name="Revenue" stroke="#00E5A8" strokeWidth={3} fill="url(#rv)" />
            <Area dataKey="commission" name="Commission" stroke="#FFFFFF" fill="none" strokeWidth={2} />
            <Area dataKey="payouts" name="Payouts" stroke="#fbbf24" fill="none" strokeDasharray="5 5" strokeWidth={2} />
          </AreaChart></ResponsiveContainer></div>
        <div className="card"><h3>Bay occupancy</h3>
          <svg viewBox="0 0 200 120" style={{ width: '100%', height: 190 }}>
            <defs><linearGradient id="gg"><stop offset="0" stopColor="#00E5A8" /><stop offset="1" stopColor="#00E5A8" /></linearGradient></defs>
            <path d="M20 100A80 80 0 0 1 180 100" fill="none" stroke="var(--panel2)" strokeWidth="16" strokeLinecap="round" />
            <path d={`M20 100A80 80 0 0 1 ${gx} ${gy}`} fill="none" stroke="url(#gg)" strokeWidth="16" strokeLinecap="round" />
            <text x="100" y="92" textAnchor="middle" fill="var(--tx)" fontSize="28" fontWeight="700">{m.occ}%</text>
            <text x="100" y="110" textAnchor="middle" fill="var(--mut)" fontSize="10">Average utilisation</text>
          </svg></div>
      </div>

      <div className="grid k3" style={{ marginTop: 14 }}>
        <div className="card"><h3>Booking status</h3>
          <ResponsiveContainer width="100%" height={170}><PieChart>
            <Pie data={m.status} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} stroke="none">{m.status.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Pie>
            <Tooltip contentStyle={tip} /><Legend />
          </PieChart></ResponsiveContainer></div>
        <div className="card"><h3>Bookings by day &amp; hour</h3>
          <div className="heat"><span />{m.heat.days.map((x) => <span key={x}>{x}</span>)}
            {m.heat.slots.map((s, r) => <HeatRow key={s} label={s} cells={m.heat.grid[r]} />)}</div></div>
        <div className="card"><h3>Bookings per day</h3>
          <ResponsiveContainer width="100%" height={170}><BarChart data={m.series}>
            <XAxis dataKey="label" stroke="var(--mut)" fontSize={10} /><Tooltip contentStyle={tip} /><Bar dataKey="bookings" name="Bookings" fill="#00E5A8" radius={[4, 4, 0, 0]} />
          </BarChart></ResponsiveContainer></div>
      </div>

      <div className="grid k2" style={{ marginTop: 14 }}>
        <div className="card"><h3>Commission vs payouts</h3>
          <ResponsiveContainer width="100%" height={180}><LineChart data={m.series}>
            <CartesianGrid stroke="var(--line)" vertical={false} /><XAxis dataKey="label" stroke="var(--mut)" fontSize={11} /><YAxis stroke="var(--mut)" fontSize={11} />
            <Tooltip contentStyle={tip} formatter={(v: number) => money(v)} /><Line dataKey="commission" stroke="#00E5A8" strokeWidth={2} dot={false} /><Line dataKey="payouts" stroke="#9ca3af" strokeWidth={2} dot={false} />
          </LineChart></ResponsiveContainer></div>
        <div className="card"><h3>Top bays</h3>{[...d.bays].sort((a, b) => Number(b.occupancy) - Number(a.occupancy)).map((b) => (
          <div key={b.id} style={{ marginBottom: 12 }}><div className="split">{b.name}<b>{b.occupancy}%</b></div><div className="bar"><i style={{ width: `${b.occupancy}%` }} /></div></div>))}</div>
      </div>

      <div className="card" style={{ marginTop: 14 }}><h3>Recent bookings</h3><div className="tw"><table>
        <thead><tr><th>Ref</th><th>Driver</th><th>Bay</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>{m.bookings.slice(0, 6).map((b) => <tr key={b.id}><td>{b.ref}</td><td>{b.driver}</td><td>{b.bay}</td><td>{money(Number(b.amount))}</td><td><span className={`chip ${statusClass(String(b.status))}`}>{b.status}</span></td></tr>)}</tbody>
      </table></div></div>
    </div>
  )
}

function HeatRow({ label, cells }: { label: string; cells: number[] }) {
  return <><span>{label}</span>{cells.map((v, i) => <b key={i} style={{ background: `rgba(0,229,168,${(0.08 + v * 0.8).toFixed(2)})` }} />)}</>
}

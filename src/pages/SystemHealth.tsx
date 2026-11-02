import { useEffect, useMemo, useState } from 'react'
import { Activity, AlertTriangle, Gauge, Layers, Cpu, ShieldAlert, X, RefreshCw, Clock3, Wifi, Monitor } from 'lucide-react'

type Tab = 'vitals' | 'errors' | 'assets' | 'resilience'
type TelemetryEvent = { id: number; at: string; message: string; source: string }
type Vitals = { lcp: number | null; fcp: number | null; cls: number | null; ttfb: number | null }

const stamp = () => new Date().toLocaleTimeString('en-ZA')
const fmt = (n: number | null, unit = 'ms') => n === null || !Number.isFinite(n) ? '—' : `${unit === 'ms' ? Math.round(n * 10) / 10 : Math.round(n * 1000) / 1000}${unit === 'ms' ? ' ms' : ''}`
const grade = (value: number | null, good: number, needs: number) => value === null ? 'NOT AVAILABLE' : value <= good ? 'GOOD' : value <= needs ? 'NEEDS IMPROVEMENT' : 'POOR'

export default function SystemHealth() {
  const [tab, setTab] = useState<Tab>('vitals')
  const [vitals, setVitals] = useState<Vitals>({ lcp: null, fcp: null, cls: null, ttfb: null })
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [fps, setFps] = useState<number | null>(null)
  const [refreshedAt, setRefreshedAt] = useState(stamp)
  const [resources, setResources] = useState<PerformanceResourceTiming[]>([])

  useEffect(() => {
    let lcpObserver: PerformanceObserver | undefined
    let clsObserver: PerformanceObserver | undefined
    const addEvent = (message: string, source: string) => {
      setEvents((old) => [{ id: Date.now() + Math.random(), at: stamp(), message, source }, ...old].slice(0, 100))
      setDismissed(false)
    }
    const onError = (event: ErrorEvent) => addEvent(event.message || 'Uncaught browser error', event.filename || 'window')
    const onRejection = (event: PromiseRejectionEvent) => addEvent(String(event.reason?.message || event.reason || 'Unhandled promise rejection'), 'unhandledrejection')
    const onAssetError = (event: Event) => {
      const target = event.target
      if (target instanceof HTMLImageElement || target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
        addEvent(`Failed to load ${target instanceof HTMLImageElement ? target.src : target instanceof HTMLScriptElement ? target.src : target.href}`, 'asset-load')
      }
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    window.addEventListener('error', onAssetError, true)

    try {
      lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const last = entries[entries.length - 1]
        if (last) setVitals((v) => ({ ...v, lcp: last.startTime }))
      })
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch { /* Browser does not expose this entry type. */ }
    try {
      clsObserver = new PerformanceObserver((list) => {
        const value = list.getEntries().reduce((sum, entry) => {
          const e = entry as PerformanceEntry & { value?: number; hadRecentInput?: boolean }
          return sum + (e.hadRecentInput ? 0 : e.value || 0)
        }, 0)
        setVitals((v) => ({ ...v, cls: (v.cls || 0) + value }))
      })
      clsObserver.observe({ type: 'layout-shift', buffered: true })
    } catch { /* Browser does not expose this entry type. */ }

    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    const fcp = performance.getEntriesByName('first-contentful-paint').at(-1)
    if (nav) setVitals((v) => ({ ...v, ttfb: nav.responseStart - nav.requestStart }))
    if (fcp) setVitals((v) => ({ ...v, fcp: fcp.startTime }))
    setResources(performance.getEntriesByType('resource') as PerformanceResourceTiming[])

    let frame = 0
    let frames = 0
    let started = 0
    let raf = 0
    const tick = (now: number) => {
      if (!started) started = now
      frames += 1
      if (now - started >= 2000) {
        setFps(Math.round((frames * 1000) / (now - started)))
        frames = 0
        started = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      lcpObserver?.disconnect()
      clsObserver?.disconnect()
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
      window.removeEventListener('error', onAssetError, true)
    }
  }, [])

  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory
  const heap = memory ? Math.round(memory.usedJSHeapSize / 1024 / 1024) : null
  const heapLimit = memory ? Math.round(memory.jsHeapSizeLimit / 1024 / 1024) : null
  const avgResource = resources.length ? resources.reduce((sum, item) => sum + item.duration, 0) / resources.length : null
  const slowResources = resources.filter((item) => item.duration > 1000)
  const visibleEvents = dismissed ? [] : events
  const tabs: { id: Tab; label: string; Icon: typeof Gauge }[] = [
    { id: 'vitals', label: 'Web Vitals', Icon: Gauge },
    { id: 'errors', label: `Errors & Telemetry (${events.length})`, Icon: ShieldAlert },
    { id: 'assets', label: 'Assets & Network', Icon: Layers },
    { id: 'resilience', label: 'Load Resilience', Icon: Cpu },
  ]

  const metric = (label: string, value: string, detail: string, status: string) => (
    <div className="card" key={label}>
      <div className="lab">{label}</div><div className="big" style={{ fontSize: 30 }}>{value}</div>
      <div className="lab">{detail}</div><span className={status === 'GOOD' ? 'chip ok' : status === 'POOR' ? 'chip bad' : 'chip warn'}>{status}</span>
    </div>
  )

  return (
    <div data-testid="system-health">
      <div className="card" style={{ marginBottom: 14, borderColor: 'rgba(0,229,168,.35)' }}>
        <div className="split" style={{ alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="av" style={{ width: 42, height: 42, borderRadius: 12 }}><Activity size={21} /></div>
            <div><h2 style={{ margin: 0, fontFamily: 'var(--display)', fontSize: 27, fontWeight: 400 }}>SYSTEM HEALTH &amp; MONITORING</h2>
              <div className="lab">Browser performance, runtime errors, asset loading and resilience controls</div></div>
          </div>
          <span className="chip info">LOCAL SESSION · NOT SERVER-WIDE</span>
        </div>
        <div className="lab" style={{ marginTop: 12 }}>Measurements below are collected in this administrator's browser session. They are not aggregated production telemetry and do not represent every driver's or host's experience. Last refreshed: {refreshedAt}.</div>
      </div>

      <div className="grid k4">
        {metric('FRAME RATE', fps === null ? '—' : String(fps), 'Current admin browser session', fps === null ? 'NOT AVAILABLE' : fps >= 50 ? 'GOOD' : fps >= 30 ? 'NEEDS IMPROVEMENT' : 'POOR')}
        {metric('JS HEAP', heap === null ? 'Not exposed' : `${heap} MB`, heapLimit === null ? 'Browser does not expose heap limit' : `Browser-reported limit ${heapLimit} MB`, heap === null ? 'NOT AVAILABLE' : 'GOOD')}
        {metric('RESOURCE LOADS', String(resources.length), avgResource === null ? 'No resource timing entries' : `Average ${fmt(avgResource)}`, slowResources.length ? 'NEEDS IMPROVEMENT' : 'GOOD')}
        {metric('CAPTURED ERRORS', String(events.length), 'Runtime, rejected promises and asset-load errors', events.length ? 'NEEDS IMPROVEMENT' : 'GOOD')}
      </div>

      {events.length > 0 && <div className="card" style={{ marginTop: 14, borderColor: 'rgba(251,113,133,.5)' }}>
        <div className="split" style={{ alignItems: 'center', gap: 10 }}><b style={{ color: 'var(--bad)', display: 'flex', gap: 8, alignItems: 'center' }}><AlertTriangle size={16} /> TELEMETRY EVENTS ({events.length})</b>
          <button className="sm" onClick={() => setDismissed(true)}>Dismiss view</button></div>
        {visibleEvents.length > 0 && <div style={{ marginTop: 10, maxHeight: 120, overflow: 'auto', fontFamily: 'monospace', fontSize: 11 }}>
          {visibleEvents.slice(0, 5).map((event) => <div key={event.id} style={{ padding: '4px 0', color: 'var(--bad)' }}>[{event.at}] [{event.source}] {event.message}</div>)}
        </div>}
        <div className="lab" style={{ marginTop: 8 }}>Dismissing hides this panel only; events remain in the in-memory session count until this page is closed or refreshed.</div>
      </div>}

      <div className="seg" style={{ margin: '16px 0', borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
        {tabs.map(({ id, label, Icon }) => <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}><Icon size={14} />{label}</button>)}
      </div>

      {tab === 'vitals' && <div className="grid k2eq">
        {metric('LCP · Largest Contentful Paint', fmt(vitals.lcp), 'Largest visible content render', grade(vitals.lcp, 2500, 4000))}
        {metric('FCP · First Contentful Paint', fmt(vitals.fcp), 'First text or image rendered', grade(vitals.fcp, 1800, 3000))}
        {metric('CLS · Cumulative Layout Shift', fmt(vitals.cls, 'score'), 'Unexpected visual layout movement', grade(vitals.cls, 0.1, 0.25))}
        {metric('TTFB · Time to First Byte', fmt(vitals.ttfb), 'Navigation response start minus request start', grade(vitals.ttfb, 800, 1800))}
        <div className="card" style={{ gridColumn: '1 / -1' }}><h3>Measurement scope</h3><p className="lab">These browser APIs report this page load only. Core Web Vitals should be evaluated using representative field data across real user sessions and devices before making production performance claims.</p></div>
      </div>}

      {tab === 'errors' && <div className="card">
        <div className="split"><h3>Browser error telemetry</h3><span className="chip">{events.length} captured this session</span></div>
        {events.length ? <div className="tw"><table><thead><tr><th>Time</th><th>Source</th><th>Event</th></tr></thead><tbody>{events.map((e) => <tr key={e.id}><td>{e.at}</td><td>{e.source}</td><td style={{ whiteSpace: 'normal' }}>{e.message}</td></tr>)}</tbody></table></div> : <p className="lab">No runtime errors, unhandled promise rejections or failed asset load events have been captured in this browser session.</p>}
        <p className="lab">This page does not yet ingest server, API, Supabase, payment-provider or other users' browser logs.</p>
      </div>}

      {tab === 'assets' && <div className="card">
        <div className="grid k3">
          <div><div className="lab">Resource entries</div><div className="big">{resources.length}</div></div>
          <div><div className="lab">Average resource duration</div><div className="big" style={{ fontSize: 30 }}>{fmt(avgResource)}</div></div>
          <div><div className="lab">Loads over 1 second</div><div className="big">{slowResources.length}</div></div>
        </div>
        <div className="tw" style={{ marginTop: 12 }}><table><thead><tr><th>Resource</th><th>Type</th><th>Duration</th><th>Transfer</th></tr></thead>
          <tbody>{resources.slice(-30).reverse().map((r, i) => <tr key={i}><td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</td><td>{r.initiatorType}</td><td>{fmt(r.duration)}</td><td>{r.transferSize ? `${Math.round(r.transferSize / 1024)} KB` : 'Not reported / cached'}</td></tr>)}</tbody></table></div>
        <p className="lab">Browser Resource Timing API. Transfer sizes may be unavailable because of cache or cross-origin timing restrictions.</p>
      </div>}

      {tab === 'resilience' && <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><ShieldAlert color="var(--warn)" /><h3>Controlled load &amp; resilience testing</h3></div>
        <p>This console intentionally does not run stress tests against the live marketplace. Load generation can affect real drivers, hosts, bookings and payments.</p>
        <div className="err">Production load testing is disabled. Use an isolated staging environment with synthetic accounts and explicit test limits.</div>
        <div className="grid k2eq">
          <div><div className="lab">Safe test target</div><b>Staging / isolated test environment</b></div>
          <div><div className="lab">Production test execution</div><b style={{ color: 'var(--bad)' }}>Disabled</b></div>
        </div>
        <p className="lab">A future test runner should require an approved target, request-rate cap, duration limit, stop control and audit record before execution.</p>
      </div>}

      <div className="toolbar" style={{ marginTop: 14 }}>
        <span className="lab">ParkEasy Admin · System Health</span>
        <button onClick={() => { setRefreshedAt(stamp()); setResources(performance.getEntriesByType('resource') as PerformanceResourceTiming[]) }}><RefreshCw size={14} />Refresh measurements</button>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useResource } from '../components/useResource'
import { api, type ScoutTarget, type ScoutWorkflowStatus } from '../lib/api'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const COLORS: Record<string, string> = {
  active: '#00E5A8',
  available: '#00E5A8',
  paused: '#fbbf24',
  pending: '#fbbf24',
  booked: '#fb7185',
  occupied: '#fb7185',
  unavailable: '#fb7185',
  inactive: '#fb7185',
}

type DemandCell = { key: string; lat: number; lng: number; supply: number; bookings: number; gap: boolean; names: string[]; targetScore: number }

const SCOUT_STAGES: { value: ScoutWorkflowStatus; label: string }[] = [
  { value: 'identified', label: 'Identified' },
  { value: 'researched', label: 'Researched' },
  { value: 'host_contacted', label: 'Host contacted' },
  { value: 'listing_onboarded', label: 'Listing onboarded' },
]
const SCOUT_STAGE_RANK: Record<ScoutWorkflowStatus, number> = { identified: 0, researched: 1, host_contacted: 2, listing_onboarded: 3 }

const valueOf = (row: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) { const value = row[key]; if (value != null && String(value).trim()) return String(value).trim() }
  return ''
}

/** Test-environment live bay map. Refreshes listings every 15 seconds. */
export default function LiveMap() {
  const { rows, error, loading } = useResource('bays', 15000)
  const { rows: bookings } = useResource('bookings', 15000)
  const { rows: payments } = useResource('payments', 15000)
  const { rows: devices } = useResource('devices', 15000)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])
  const demandMarkers = useRef<mapboxgl.Marker[]>([])
  const [mapReady, setMapReady] = useState(false)
  const [showDemand, setShowDemand] = useState(true)
  const [copiedTarget, setCopiedTarget] = useState('')
  const [scoutWorkflow, setScoutWorkflow] = useState<ScoutTarget[]>([])
  const [scoutWorkflowError, setScoutWorkflowError] = useState('')
  const [scoutSaving, setScoutSaving] = useState('')
  const [scoutDrafts, setScoutDrafts] = useState<Record<string, { researchNotes: string; contactName: string; contactMethod: string; listingId: string }>>({})
  const syncedScoutSnapshot = useRef('')

  const locatedRows = rows.filter((bay) =>
    bay.lat != null && bay.lng != null &&
    Number.isFinite(Number(bay.lat)) && Number.isFinite(Number(bay.lng)) &&
    Number(bay.lat) >= -90 && Number(bay.lat) <= 90 &&
    Number(bay.lng) >= -180 && Number(bay.lng) <= 180
  )
  const activeCount = locatedRows.filter((bay) => ['active', 'available'].includes(String(bay.status).toLowerCase())).length
  const pausedCount = locatedRows.filter((bay) => ['paused', 'pending'].includes(String(bay.status).toLowerCase())).length
  const unavailableCount = locatedRows.length - activeCount - pausedCount
  const missingCoordinates = rows.filter((bay) =>
    bay.lat == null || bay.lng == null ||
    !Number.isFinite(Number(bay.lat)) || !Number.isFinite(Number(bay.lng)) ||
    Number(bay.lat) < -90 || Number(bay.lat) > 90 ||
    Number(bay.lng) < -180 || Number(bay.lng) > 180
  )
  const offlineDevices = devices.filter((device) => ['offline', 'disconnected', 'error'].includes(String(device.status ?? '').toLowerCase()))
  const lowBatteryDevices = devices.filter((device) => device.battery != null && Number.isFinite(Number(device.battery)) && Number(device.battery) <= 20)
  const pendingBookings = bookings.filter((booking) => ['pending', 'awaiting_payment', 'payment_pending'].includes(String(booking.status ?? '').toLowerCase()))
  const failedPayments = payments.filter((payment) => ['failed', 'declined', 'error'].includes(String(payment.status ?? '').toLowerCase()))
  // Link real booking rows to their parking listing when an ID or listing name is present.
  // Spatial cells are approximately 1.1 km across; they are a planning proxy, not search-intent data.
  const demandCells = useMemo(() => {
    const bayByKey = new Map<string, typeof rows[number]>()
    rows.forEach((bay) => {
      const raw = bay as Record<string, unknown>
      for (const key of [String(bay.id ?? ''), String(bay.name ?? '')].filter(Boolean)) bayByKey.set(key.toLowerCase(), bay)
      for (const field of ['bay_id', 'listing_id', 'parking_bay_id']) {
        const alias = valueOf(raw, [field])
        if (alias) bayByKey.set(alias.toLowerCase(), bay)
      }
    })
    const cells = new Map<string, DemandCell>()
    locatedRows.forEach((bay) => {
      const lat = Number(bay.lat), lng = Number(bay.lng)
      const key = Math.round(lat * 100) + ':' + Math.round(lng * 100)
      const existing = cells.get(key)
      if (existing) { existing.supply += ['active', 'available'].includes(String(bay.status ?? '').toLowerCase()) ? 1 : 0; existing.names.push(String(bay.name ?? 'Parking listing')) }
      else cells.set(key, { key, lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100, supply: ['active', 'available'].includes(String(bay.status ?? '').toLowerCase()) ? 1 : 0, bookings: 0, gap: false, names: [String(bay.name ?? 'Parking listing')], targetScore: 0 })
    })
    let linkedBookings = 0
    bookings.forEach((booking) => {
      const raw = booking as Record<string, unknown>
      const status = String(booking.status ?? '').toLowerCase()
      if (!['confirmed', 'active', 'completed', 'complete'].includes(status)) return
      const key = valueOf(raw, ['bay_id', 'listing_id', 'parking_bay_id', 'bay', 'listing', 'parking_bay']).toLowerCase()
      const linkedBay = key ? bayByKey.get(key) : undefined
      if (!linkedBay || linkedBay.lat == null || linkedBay.lng == null) return
      const lat = Number(linkedBay.lat), lng = Number(linkedBay.lng)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
      const cellKey = Math.round(lat * 100) + ':' + Math.round(lng * 100)
      const cell = cells.get(cellKey)
      if (cell) { cell.bookings += 1; linkedBookings += 1 }
    })
    cells.forEach((cell) => {
      cell.gap = cell.bookings >= 3 && cell.supply <= 2
      // Transparent prioritisation: booking volume plus scarcity, capped to keep scores readable.
      cell.targetScore = cell.bookings > 0 ? Math.min(100, Math.round((cell.bookings * 12) / (cell.supply + 1) + Math.min(cell.bookings, 5) * 4)) : 0
    })
    return { cells: Array.from(cells.values()).filter((cell) => cell.bookings > 0).sort((a, b) => Number(b.gap) - Number(a.gap) || b.targetScore - a.targetScore || b.bookings - a.bookings), linkedBookings }
  }, [rows, bookings, locatedRows])
  const supplyGapCount = demandCells.cells.filter((cell) => cell.gap).length
  const scoutTargets = useMemo(() => demandCells.cells.filter((cell) => cell.gap).slice(0, 5), [demandCells.cells])
  const formatTargetLocation = (cell: DemandCell) => `${cell.lat.toFixed(2)}, ${cell.lng.toFixed(2)}`
  const scoutBrief = (target: ScoutTarget) => `PARKEASY SCOUT — HOST ACQUISITION TARGET\nMap zone: ${target.latitude.toFixed(2)}, ${target.longitude.toFixed(2)} (approx. 1 km planning cell)\nPriority score: ${target.priorityScore}/100 (rule-based)\nLinked booking records: ${target.bookingsCount}\nActive/available listings in zone: ${target.supplyCount}\nWorkflow: ${SCOUT_STAGES.find((stage) => stage.value === target.workflowStatus)?.label ?? target.workflowStatus}\nResearch notes: ${target.researchNotes || 'Not recorded'}\nContact: ${target.contactName || 'Not recorded'} · ${target.contactMethod || 'Not recorded'}\nOpportunity: investigate additional private/residential parking hosts in and around this zone.\nValidation: confirm local demand, access, safety, pricing, permissions and host availability before onboarding.\nNote: booking activity is a proxy; it does not prove unmet demand.`
  const copyScoutBrief = async (target: ScoutTarget) => {
    try { await navigator.clipboard.writeText(scoutBrief(target)); setCopiedTarget(target.targetKey) }
    catch { setCopiedTarget('') }
  }
  const replaceScoutTarget = (updated: ScoutTarget) => {
    setScoutWorkflow((current) => current.map((target) => target.id === updated.id ? updated : target).sort((a, b) => b.priorityScore - a.priorityScore))
    setScoutDrafts((current) => ({ ...current, [updated.id]: { researchNotes: updated.researchNotes, contactName: updated.contactName, contactMethod: updated.contactMethod, listingId: updated.listingId } }))
  }
  const updateScoutStage = async (target: ScoutTarget, status: ScoutWorkflowStatus) => {
    if (status === target.workflowStatus) return
    setScoutSaving(target.id); setScoutWorkflowError('')
    try { replaceScoutTarget(await api.updateScoutTarget(target.id, { status })) }
    catch (e) { setScoutWorkflowError((e as Error).message) }
    finally { setScoutSaving('') }
  }
  const saveScoutDetails = async (target: ScoutTarget) => {
    const draft = scoutDrafts[target.id] ?? { researchNotes: target.researchNotes, contactName: target.contactName, contactMethod: target.contactMethod, listingId: target.listingId }
    setScoutSaving(target.id); setScoutWorkflowError('')
    try { replaceScoutTarget(await api.updateScoutTarget(target.id, { researchNotes: draft.researchNotes, contactName: draft.contactName, contactMethod: draft.contactMethod, listingId: draft.listingId || null })) }
    catch (e) { setScoutWorkflowError((e as Error).message) }
    finally { setScoutSaving('') }
  }
  const editScoutDraft = (target: ScoutTarget, field: 'researchNotes' | 'contactName' | 'contactMethod' | 'listingId', value: string) => {
    setScoutDrafts((current) => ({
      ...current,
      [target.id]: {
        researchNotes: current[target.id]?.researchNotes ?? target.researchNotes,
        contactName: current[target.id]?.contactName ?? target.contactName,
        contactMethod: current[target.id]?.contactMethod ?? target.contactMethod,
        listingId: current[target.id]?.listingId ?? target.listingId,
        [field]: value,
      },
    }))
  }

  useEffect(() => {
    let cancelled = false
    api.scoutTargets().then((targets) => {
      if (cancelled || syncedScoutSnapshot.current) return
      setScoutWorkflow(targets)
      setScoutDrafts(Object.fromEntries(targets.map((target) => [target.id, { researchNotes: target.researchNotes, contactName: target.contactName, contactMethod: target.contactMethod, listingId: target.listingId }])))
    }).catch((e) => { if (!cancelled) setScoutWorkflowError((e as Error).message) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (demandCells.linkedBookings === 0 || scoutTargets.length === 0) return
    const snapshots = scoutTargets.map((cell) => ({
      targetKey: cell.key, latitude: cell.lat, longitude: cell.lng,
      bookingsCount: cell.bookings, supplyCount: cell.supply, priorityScore: cell.targetScore,
    }))
    const fingerprint = JSON.stringify(snapshots)
    if (syncedScoutSnapshot.current === fingerprint) return
    syncedScoutSnapshot.current = fingerprint
    let cancelled = false
    api.syncScoutTargets(snapshots).then(() => api.scoutTargets()).then((targets) => {
      if (cancelled) return
      setScoutWorkflow(targets)
      setScoutDrafts((current) => {
        const next = { ...current }
        targets.forEach((target) => { if (!next[target.id]) next[target.id] = { researchNotes: target.researchNotes, contactName: target.contactName, contactMethod: target.contactMethod, listingId: target.listingId } })
        return next
      })
      setScoutWorkflowError('')
    }).catch((e) => { if (!cancelled) { syncedScoutSnapshot.current = ''; setScoutWorkflowError((e as Error).message) } })
    return () => { cancelled = true }
  }, [demandCells.linkedBookings, scoutTargets])

  const intelligenceItems = [
    ...(offlineDevices.length ? [{ level: 'critical', title: offlineDevices.length + ' device(s) offline', detail: 'Review device connectivity before relying on live device status.' }] : []),
    ...(failedPayments.length ? [{ level: 'critical', title: failedPayments.length + ' failed payment(s)', detail: 'Review payment records and booking outcomes before taking action.' }] : []),
    ...(lowBatteryDevices.length ? [{ level: 'warning', title: lowBatteryDevices.length + ' device(s) at 20% battery or less', detail: 'Prioritise these devices for charging or maintenance.' }] : []),
    ...(pendingBookings.length ? [{ level: 'warning', title: pendingBookings.length + ' booking(s) awaiting completion', detail: 'Review the booking and payment status together.' }] : []),
    ...(missingCoordinates.length ? [{ level: 'warning', title: missingCoordinates.length + ' listing(s) missing valid coordinates', detail: 'These listings cannot be plotted accurately until latitude and longitude are corrected.' }] : []),
  ]

  useEffect(() => {
    if (!TOKEN || !el.current) return
    mapboxgl.accessToken = TOKEN
    const instance = new mapboxgl.Map({
      container: el.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [18.41, -33.925],
      zoom: 12.3,
      pitch: 55,
      bearing: -18,
      antialias: true,
    })
    map.current = instance
    instance.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), 'top-right')
    instance.addControl(new mapboxgl.FullscreenControl(), 'top-right')
    instance.on('load', () => setMapReady(true))
    if (instance.loaded()) setMapReady(true)
    instance.on('style.load', () => {
      if (!instance.getSource('composite') || instance.getLayer('parkeasy-3d-buildings')) return
      const layers = instance.getStyle().layers ?? []
      const labelLayer = layers.find((layer) => layer.type === 'symbol' && layer.layout?.['text-field'])
      instance.addLayer({
        id: 'parkeasy-3d-buildings',
        source: 'composite',
        'source-layer': 'building',
        filter: ['==', ['get', 'extrude'], 'true'],
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': '#30343b',
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'height']],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.05, ['get', 'min_height']],
          'fill-extrusion-opacity': 0.82,
        },
      }, labelLayer?.id)
    })
    return () => {
      markers.current.forEach((marker) => marker.remove())
      markers.current = []
      demandMarkers.current.forEach((marker) => marker.remove())
      demandMarkers.current = []
      instance.remove()
      map.current = null
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    markers.current.forEach((marker) => marker.remove())
    markers.current = locatedRows.map((bay) => {
      const status = String(bay.status ?? 'unknown').toLowerCase()
      const color = COLORS[status] ?? '#8f8f9a'
      const popupContent = document.createElement('div')
      popupContent.className = 'parkeasy-map-popup'
      const title = document.createElement('strong')
      title.textContent = String(bay.name ?? 'Parking listing')
      const details = document.createElement('div')
      details.textContent = `${String(bay.status ?? 'Unknown')} · ${Number(bay.occupancy ?? 0)}% occupied · R${String(bay.rate ?? '—')}/hr`
      popupContent.append(title, details)
      return new mapboxgl.Marker({ color, scale: 1.05 })
        .setLngLat([Number(bay.lng), Number(bay.lat)])
        .setPopup(new mapboxgl.Popup({ offset: 18, maxWidth: '280px' }).setDOMContent(popupContent))
        .addTo(instance)
    })

    if (locatedRows.length > 1) {
      const bounds = new mapboxgl.LngLatBounds()
      locatedRows.forEach((bay) => bounds.extend([Number(bay.lng), Number(bay.lat)]))
      instance.fitBounds(bounds, { padding: 90, maxZoom: 15, pitch: 55, bearing: -18, duration: 700 })
    } else if (locatedRows.length === 1) {
      instance.flyTo({ center: [Number(locatedRows[0].lng), Number(locatedRows[0].lat)], zoom: 15, pitch: 55, bearing: -18, essential: true })
    }
  // locatedRows is derived from the current API rows; refresh when the API refreshes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows])

  useEffect(() => {
    const instance = map.current
    if (!instance || !mapReady) return
    demandMarkers.current.forEach((marker) => marker.remove())
    demandMarkers.current = []
    if (!showDemand) return
    demandMarkers.current = demandCells.cells.map((cell) => {
      const node = document.createElement('div')
      node.className = 'demand-map-marker' + (cell.gap ? ' gap' : '')
      node.innerHTML = '<span>' + cell.bookings + '</span><small>' + (cell.gap ? 'SUPPLY GAP?' : 'BOOKING ACTIVITY') + '</small>'
      const popup = document.createElement('div')
      popup.className = 'parkeasy-map-popup'
      const title = document.createElement('strong')
      title.textContent = cell.gap ? 'Potential supply gap' : 'Booking activity area'
      const detail = document.createElement('div')
      detail.textContent = cell.bookings + ' confirmed/active/completed booking records linked to listings in this ~1.1 km cell; ' + cell.supply + ' active/available listing(s). This is a proxy, not proof of unmet demand.'
      popup.append(title, detail)
      return new mapboxgl.Marker({ element: node, anchor: 'center' })
        .setLngLat([cell.lng, cell.lat])
        .setPopup(new mapboxgl.Popup({ offset: 18, maxWidth: '300px' }).setDOMContent(popup))
        .addTo(instance)
    })
  }, [demandCells, mapReady, showDemand])

  if (!TOKEN) return <div className="card" data-testid="map-missing"><h3>Live map</h3><p className="lab">Mapbox token is not configured. {rows.length} parking listings received; {locatedRows.length} have coordinates.</p></div>

  return (
    <section className="live-map-page">
      <div className="live-map-heading">
        <div>
          <h2>LIVE PARKING MAP</h2>
          <p className="lab">Real listings from the connected ParkEasy test environment · refreshes every 15 seconds</p>
        </div>
        <span className="map-live-status"><i /> LIVE</span>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <section className="map-intelligence" aria-label="ParkEasy intelligence">
        <div className="intelligence-heading">
          <div><span className="intelligence-eyebrow">PARKEASY INTELLIGENCE</span><h3>Operations signals</h3></div>
          <span className="intelligence-mode">RULE-BASED · LIVE DATA</span>
        </div>
        <div className="intelligence-stats">
          <div><span>Listings</span><strong>{rows.length}</strong><small>{locatedRows.length} mapped</small></div>
          <div><span>Bookings</span><strong>{bookings.length}</strong><small>{pendingBookings.length} pending</small></div>
          <div><span>Payments</span><strong>{payments.length}</strong><small>{failedPayments.length} failed</small></div>
          <div><span>Devices</span><strong>{devices.length}</strong><small>{offlineDevices.length} offline</small></div>
        </div>
        <div className="intelligence-feed">
          <div className="intelligence-feed-title"><strong>Attention queue</strong><span>{intelligenceItems.length ? intelligenceItems.length + ' signal(s)' : 'No rule-based alerts'}</span></div>
          {intelligenceItems.length ? intelligenceItems.map((item) => (
            <div className={'intelligence-item ' + item.level} key={item.title}>
              <span className="intelligence-indicator" />
              <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              <span className="intelligence-level">{item.level === 'critical' ? 'URGENT' : 'REVIEW'}</span>
            </div>
          )) : <div className="intelligence-clear"><span>✓</span><div><strong>No current rule-based alerts</strong><p>Signals will appear when the connected test data meets an alert rule. This is not a guarantee that every operational issue is absent.</p></div></div>}
        </div>
      </section>
      <div className="map-summary">
        <div><span className="map-summary-dot available" /><strong>{activeCount}</strong><span>Available / active</span></div>
        <div><span className="map-summary-dot paused" /><strong>{pausedCount}</strong><span>Paused / pending</span></div>
        <div><span className="map-summary-dot unavailable" /><strong>{unavailableCount}</strong><span>Other statuses</span></div>
        <div className="map-summary-total"><strong>{locatedRows.length}</strong><span>Listings plotted</span></div>
      </div>
      <div className="demand-toolbar">
        <div><strong>Demand intelligence</strong><span>{demandCells.linkedBookings} booking record(s) linked to mapped listings · {supplyGapCount} potential supply-gap area(s)</span></div>
        <button type="button" className={showDemand ? 'pri' : 'ghost'} aria-pressed={showDemand} onClick={() => setShowDemand((value) => !value)}>{showDemand ? 'Hide demand layer' : 'Show demand layer'}</button>
      </div>
      {(demandCells.linkedBookings > 0 || scoutWorkflow.length > 0) && <section className="scout-opportunities" aria-label="ParkEasy Scout host acquisition workflow">
        <div className="scout-opportunities-head">
          <div><span className="intelligence-eyebrow">PARKEASY SCOUT</span><h3>Host acquisition pipeline</h3><p>Targets are synchronised from real test bookings and supply. Progress is saved in the test database, shared across authorised admin sessions, and retained when a zone temporarily falls below the priority rule.</p></div>
          <span className="scout-count">{scoutWorkflow.length} tracked target(s)</span>
        </div>
        <div className="scout-stage-strip">{SCOUT_STAGES.map((stage) => <div key={stage.value}><strong>{scoutWorkflow.filter((target) => target.workflowStatus === stage.value).length}</strong><span>{stage.label}</span></div>)}</div>
        {scoutWorkflowError && <div className="err" role="alert">{scoutWorkflowError}</div>}
        {scoutWorkflow.length ? <div className="scout-target-list">{scoutWorkflow.map((target, index) => {
          const draft = scoutDrafts[target.id] ?? { researchNotes: target.researchNotes, contactName: target.contactName, contactMethod: target.contactMethod, listingId: target.listingId }
          const stageRank = SCOUT_STAGE_RANK[target.workflowStatus]
          return <article className="scout-target scout-workflow-target" key={target.id}>
            <div className="scout-rank">{String(index + 1).padStart(2, '0')}</div>
            <div className="scout-target-main">
              <div className="scout-target-title"><strong>Recruit hosts near {target.latitude.toFixed(2)}, {target.longitude.toFixed(2)}</strong><span className="scout-priority">PRIORITY {target.priorityScore}</span></div>
              <p>{target.bookingsCount} linked bookings · {target.supplyCount} active/available listing(s) · approx. 1 km zone</p>
              <label className="scout-field"><span>Workflow stage</span><select aria-label="Scout workflow stage" value={target.workflowStatus} disabled={scoutSaving === target.id} onChange={(event) => void updateScoutStage(target, event.target.value as ScoutWorkflowStatus)}>{SCOUT_STAGES.map((stage) => <option key={stage.value} value={stage.value} disabled={SCOUT_STAGE_RANK[stage.value] < stageRank || SCOUT_STAGE_RANK[stage.value] > stageRank + 1}>{stage.label}</option>)}</select></label>
              <div className="scout-detail-grid">
                <label className="scout-field"><span>Host / contact name</span><input value={draft.contactName} onChange={(event) => editScoutDraft(target, 'contactName', event.target.value)} placeholder="Name, if known" /></label>
                <label className="scout-field"><span>Contact method / outcome</span><input value={draft.contactMethod} onChange={(event) => editScoutDraft(target, 'contactMethod', event.target.value)} placeholder="Email, call, visit…" /></label>
                <label className="scout-field scout-notes-field"><span>Research / follow-up notes</span><input value={draft.researchNotes} onChange={(event) => editScoutDraft(target, 'researchNotes', event.target.value)} placeholder="Access, permissions, price, next action…" /></label>
                <label className="scout-field"><span>Linked listing (optional)</span><select value={draft.listingId} onChange={(event) => editScoutDraft(target, 'listingId', event.target.value)}><option value="">Not linked</option>{rows.map((bay) => <option key={String(bay.id)} value={String(bay.id)}>{String(bay.name ?? 'Parking listing')}</option>)}</select></label>
              </div>
              <div className="scout-target-actions"><small>Stage last changed: {target.statusChangedAt ? new Date(target.statusChangedAt).toLocaleDateString('en-ZA') : '—'}</small><button type="button" className="ghost" disabled={scoutSaving === target.id} onClick={() => void saveScoutDetails(target)}>{scoutSaving === target.id ? 'Saving…' : 'Save details'}</button><button type="button" className="ghost scout-copy" onClick={() => void copyScoutBrief(target)}><span>{copiedTarget === target.targetKey ? 'Copied' : 'Copy Scout brief'}</span></button></div>
            </div>
          </article>
        })}</div> : <div className="scout-no-targets">No priority zones have been saved yet. The workflow starts when linked booking activity identifies a qualifying zone.</div>}
        <p className="scout-footnote">Priority score is a transparent heuristic, not a forecast. Workflow stages advance one step at a time. Verify local demand, property permission, safety and availability before onboarding a host.</p>
      </section>}
      {demandCells.linkedBookings === 0 && <p className="lab demand-note">No booking records could be reliably linked to mapped listings. The demand layer will only display evidence-backed areas once booking rows contain a matching listing ID or name. It does not infer demand from map proximity alone.</p>}
      <div className="card live-map-card">
        <div ref={el} data-testid="map" className="map" aria-label="Interactive 3D map of ParkEasy parking listings" />
        <div className="map-legend" aria-label="Parking map legend">
          <strong>MAP LEGEND</strong>
          {showDemand && <span><i className="demand-legend-dot" /> Booking activity</span>}
          {showDemand && <span><i className="demand-gap-legend-dot" /> Potential supply gap</span>}
          <span><i className="available" /> Available / active</span>
          <span><i className="paused" /> Paused / pending</span>
          <span><i className="unavailable" /> Booked / unavailable / other</span>
        </div>
      </div>
      <p className="demand-disclaimer">Supply-gap signals and Scout priorities are rule-based indicators from linked booking records and currently available listings, not proof of unmet demand. Search impressions, rejected bookings and time-windowed utilization would improve accuracy.</p>
      <div className="live-map-footer">
        <span>{loading ? 'Loading listings…' : `Showing ${locatedRows.length} of ${rows.length} listings with valid coordinates`}</span>
        {rows.length > locatedRows.length && <span>{rows.length - locatedRows.length} listing(s) cannot be plotted until latitude and longitude are present.</span>}
      </div>
    </section>
  )
}

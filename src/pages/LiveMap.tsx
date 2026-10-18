import { useEffect, useMemo, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useResource } from '../components/useResource'

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

type DemandCell = { key: string; lat: number; lng: number; supply: number; bookings: number; gap: boolean; names: string[] }

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
      else cells.set(key, { key, lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100, supply: ['active', 'available'].includes(String(bay.status ?? '').toLowerCase()) ? 1 : 0, bookings: 0, gap: false, names: [String(bay.name ?? 'Parking listing')] })
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
    cells.forEach((cell) => { cell.gap = cell.bookings >= 3 && cell.supply <= 2 })
    return { cells: Array.from(cells.values()).filter((cell) => cell.bookings > 0).sort((a, b) => Number(b.gap) - Number(a.gap) || b.bookings - a.bookings), linkedBookings }
  }, [rows, bookings, locatedRows])
  const supplyGapCount = demandCells.cells.filter((cell) => cell.gap).length

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
      <p className="demand-disclaimer">Supply-gap signals are rule-based indicators from linked booking records and currently available listings, not proof of unmet demand. Search impressions, rejected bookings and time-windowed utilization would improve accuracy.</p>
      <div className="live-map-footer">
        <span>{loading ? 'Loading listings…' : `Showing ${locatedRows.length} of ${rows.length} listings with valid coordinates`}</span>
        {rows.length > locatedRows.length && <span>{rows.length - locatedRows.length} listing(s) cannot be plotted until latitude and longitude are present.</span>}
      </div>
    </section>
  )
}

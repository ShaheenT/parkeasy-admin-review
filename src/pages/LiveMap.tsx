import { useEffect, useRef } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { useResource } from '../components/useResource'

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

/** Live bay map. Polls /admin/bays every 15s so pins and colours stay current. */
export default function LiveMap() {
  const { rows, error } = useResource('bays', 15000)
  const el = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<mapboxgl.Marker[]>([])

  useEffect(() => {
    if (!TOKEN || !el.current) return
    mapboxgl.accessToken = TOKEN
    map.current = new mapboxgl.Map({ container: el.current, style: 'mapbox://styles/mapbox/dark-v11', center: [18.41, -33.925], zoom: 12.3 })
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')
    return () => { map.current?.remove(); map.current = null }
  }, [])

  useEffect(() => {
    if (!map.current) return
    markers.current.forEach((m) => m.remove())
    markers.current = rows.filter((b) => b.lat != null && b.lng != null).map((b) => {
      const color = b.status === 'active' ? '#00E5A8' : '#fbbf24'
      const popup = new mapboxgl.Popup({ offset: 18 }).setHTML(`<strong>${String(b.name).replace(/</g, '&lt;')}</strong><br/>${b.status} · ${b.occupancy}% occupied · R${b.rate}/hr`)
      return new mapboxgl.Marker({ color }).setLngLat([Number(b.lng), Number(b.lat)]).setPopup(popup).addTo(map.current!)
    })
  }, [rows])

  if (!TOKEN) return <div className="card" data-testid="map-missing"><h3>Live map</h3><p className="lab">Add <code>VITE_MAPBOX_TOKEN</code> to your <code>.env</code> to show the map. {rows.length} bays are ready to plot.</p></div>
  return <>{error && <div className="err" role="alert">{error}</div>}<div className="card"><div ref={el} data-testid="map" className="map" /></div></>
}

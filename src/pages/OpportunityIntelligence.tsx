import { useEffect, useMemo, useState } from 'react'
import { api, type Opportunity, type OpportunityType } from '../lib/api'

const TYPES: { value: OpportunityType; label: string; description: string }[] = [
  { value: 'event', label: 'Events', description: 'Concerts, sport, festivals and conferences that may shift local parking demand.' },
  { value: 'ev_charger', label: 'EV readiness', description: 'Verified public chargers and candidate parking/charging partnerships.' },
  { value: 'wash_service', label: 'Mobile wash', description: 'Low-water vehicle-care partners and pilot locations.' },
]
const STATUS = ['research', 'verified', 'contacted', 'active', 'closed'] as const
const emptyForm = { opportunityType: 'event' as OpportunityType, title: '', location: '', startsAt: '', endsAt: '', status: 'research', sourceUrl: '', confidence: 'unverified', estimatedDemand: '', nearbySupply: '', notes: '' }
const labelStatus = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (s: string) => s.toUpperCase())

export default function OpportunityIntelligence() {
  const [items, setItems] = useState<Opportunity[]>([])
  const [form, setForm] = useState(emptyForm)
  const [filter, setFilter] = useState<'all' | OpportunityType>('all')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const load = async () => { try { setError(''); setItems(await api.opportunities()) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load opportunities') } finally { setLoading(false) } }
  useEffect(() => { void load() }, [])
  const visible = useMemo(() => items.filter((item) => filter === 'all' || item.opportunityType === filter).sort((a,b) => (a.startsAt || '9999').localeCompare(b.startsAt || '9999')), [items, filter])
  const counts = useMemo(() => Object.fromEntries(TYPES.map((type) => [type.value, items.filter((item) => item.opportunityType === type.value).length])) as Record<OpportunityType, number>, [items])
  const updateForm = (key: keyof typeof emptyForm, value: string) => setForm((old) => ({ ...old, [key]: value }))
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const created = await api.createOpportunity({ ...form, estimatedDemand: form.estimatedDemand ? Number(form.estimatedDemand) : null, nearbySupply: form.nearbySupply ? Number(form.nearbySupply) : null, startsAt: form.startsAt || null, endsAt: form.endsAt || null })
      setItems((old) => [created, ...old]); setForm({ ...emptyForm, opportunityType: form.opportunityType }); setNotice('Opportunity saved to the test database.')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save opportunity') } finally { setSaving(false) }
  }
  const changeStatus = async (item: Opportunity, status: string) => {
    try { const updated = await api.updateOpportunity(item.id, { status }); setItems((old) => old.map((x) => x.id === item.id ? updated : x)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not update status') }
  }
  return <section className="opportunity-page">
    <div className="opportunity-intro"><div><span className="intelligence-eyebrow">PARKEASY INTELLIGENCE</span><h2>Opportunity radar</h2><p>One operations workspace for event-led parking, EV charging readiness and mobile vehicle care. Records are admin-entered and remain labelled by verification status.</p></div><button type="button" className="ghost" onClick={() => void load()}>Refresh records</button></div>
    <div className="opportunity-cards">{TYPES.map((type) => <button key={type.value} className={'opportunity-card ' + (filter === type.value ? 'selected' : '')} onClick={() => setFilter(filter === type.value ? 'all' : type.value)}><span>{type.label}</span><strong>{counts[type.value] || 0}</strong><small>{type.description}</small></button>)}</div>
    <div className="opportunity-layout">
      <form className="card opportunity-form" onSubmit={submit}><h3>Record an opportunity</h3><p className="lab">Use source links and notes to distinguish confirmed information from ideas.</p>
        <label>Opportunity type<select value={form.opportunityType} onChange={(e) => updateForm('opportunityType', e.target.value)}>{TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
        <label>Title<input required value={form.title} onChange={(e) => updateForm('title', e.target.value)} placeholder="Event, charging site or wash pilot" /></label>
        <label>Area / address<input required value={form.location} onChange={(e) => updateForm('location', e.target.value)} placeholder="e.g. Cape Town CBD" /></label>
        <div className="opportunity-two"><label>Start date/time<input type="datetime-local" value={form.startsAt} onChange={(e) => updateForm('startsAt', e.target.value)} /></label><label>End date/time<input type="datetime-local" value={form.endsAt} onChange={(e) => updateForm('endsAt', e.target.value)} /></label></div>
        <label>Source URL<input type="url" value={form.sourceUrl} onChange={(e) => updateForm('sourceUrl', e.target.value)} placeholder="Official event / charger / partner page" /></label>
        <div className="opportunity-two"><label>Verification<select value={form.confidence} onChange={(e) => updateForm('confidence', e.target.value)}><option value="unverified">Unverified</option><option value="partially_verified">Partially verified</option><option value="verified">Verified</option></select></label><label>Workflow stage<select value={form.status} onChange={(e) => updateForm('status', e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}</select></label></div>
        <div className="opportunity-two"><label>Estimated demand (optional)<input type="number" min="0" value={form.estimatedDemand} onChange={(e) => updateForm('estimatedDemand', e.target.value)} placeholder="Vehicles / bookings" /></label><label>Nearby supply (optional)<input type="number" min="0" value={form.nearbySupply} onChange={(e) => updateForm('nearbySupply', e.target.value)} placeholder="Known parking spaces" /></label></div>
        <label>Research / next action<textarea rows={3} value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} placeholder="Source evidence, contact, access, permissions, follow-up…" /></label>
        <button className="pri" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save opportunity'}</button>
      </form>
      <div className="card opportunity-records"><div className="opportunity-records-head"><div><h3>Tracked opportunities</h3><p className="lab">{visible.length} record(s) · persistent test database</p></div><select aria-label="Filter opportunities" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}><option value="all">All types</option>{TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
        {error && <div className="err" role="alert">{error}</div>}{notice && <p className="opportunity-notice">{notice}</p>}
        {loading ? <p className="lab">Loading opportunities…</p> : visible.length ? <div className="opportunity-list">{visible.map((item) => <article className="opportunity-record" key={item.id}><div className="opportunity-record-top"><div><span className={'opportunity-type type-' + item.opportunityType}>{TYPES.find((x) => x.value === item.opportunityType)?.label}</span><h4>{item.title}</h4><p>{item.location}</p></div><span className={'confidence confidence-' + item.confidence}>{labelStatus(item.confidence)}</span></div>
          {(item.startsAt || item.endsAt) && <p className="lab">{item.startsAt ? new Date(item.startsAt).toLocaleString('en-ZA') : 'Start TBD'}{item.endsAt ? ' — ' + new Date(item.endsAt).toLocaleString('en-ZA') : ''}</p>}
          <div className="opportunity-metrics"><span>Demand estimate: <b>{item.estimatedDemand ?? '—'}</b></span><span>Nearby supply: <b>{item.nearbySupply ?? '—'}</b></span></div>{item.notes && <p className="opportunity-notes">{item.notes}</p>}
          {item.sourceUrl && <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source ↗</a>}
          <label className="opportunity-status">Workflow stage<select value={item.status} onChange={(e) => void changeStatus(item, e.target.value)}>{STATUS.map((s) => <option key={s} value={s}>{labelStatus(s)}</option>)}</select></label>
        </article>)}</div> : <div className="opportunity-empty"><strong>No opportunities recorded yet</strong><p>Add a verified event, charging location or wash-service pilot to start building this intelligence layer. The dashboard does not invent external data.</p></div>}
      </div>
    </div>
    <p className="demand-disclaimer">Demand and supply figures are optional human-entered estimates, not predictions. Confirm event dates with organisers, charger status with operators, and permissions/compliance before making customer-facing offers. Mobile-wash pilots must validate water use, wastewater handling, equipment payload and local rules.</p>
  </section>
}

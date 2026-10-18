import { useEffect, useMemo, useState } from 'react'
import { api, type EventRecord, type EventOrganizer, type EventPlan } from '../lib/api'

type Tab = 'events' | 'organizers' | 'plans'
const statusOptions = ['draft','pending_review','approved','rejected','cancelled','completed']
const human = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const blankOrganizer = { organizationName: '', contactName: '', contactEmail: '', contactPhone: '', adminNotes: '' }
const blankEvent = { organizerId: '', title: '', category: 'festival', description: '', venueName: '', address: '', latitude: '', longitude: '', startsAt: '', endsAt: '', imageUrl: '', ticketUrl: '' }
const blankPlan = { name: '', monthlyPriceZar: '0', description: '', promotedPlacement: false, monthlyImpressionLimit: '' }

export default function Events() {
  const [tab, setTab] = useState<Tab>('events')
  const [events, setEvents] = useState<EventRecord[]>([])
  const [organizers, setOrganizers] = useState<EventOrganizer[]>([])
  const [plans, setPlans] = useState<EventPlan[]>([])
  const [eventForm, setEventForm] = useState(blankEvent)
  const [orgForm, setOrgForm] = useState(blankOrganizer)
  const [planForm, setPlanForm] = useState(blankPlan)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState('all')
  const load = async () => {
    setLoading(true); setError('')
    try {
      const [e, o, p] = await Promise.all([api.eventRecords(), api.eventOrganizers(), api.eventPlans()])
      setEvents(e); setOrganizers(o); setPlans(p)
      if (!eventForm.organizerId && o[0]) setEventForm(old => ({ ...old, organizerId: o[0].id }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load event marketplace records.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])
  const approvedEvents = useMemo(() => events.filter(e => e.status === 'approved').length, [events])
  const activeSubs = 0 // Subscription records are intentionally not represented as paid until billing is connected.
  const createOrganizer = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setNotice('')
    try { const row = await api.createEventOrganizer(orgForm); setOrganizers(old => [row, ...old]); setOrgForm(blankOrganizer); setEventForm(old => ({ ...old, organizerId: old.organizerId || row.id })); setNotice('Organiser saved in the test database.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save organiser.') } finally { setSaving(false) }
  }
  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setNotice('')
    try {
      const row = await api.createEvent({ ...eventForm, latitude: eventForm.latitude ? Number(eventForm.latitude) : null, longitude: eventForm.longitude ? Number(eventForm.longitude) : null, startsAt: new Date(eventForm.startsAt).toISOString(), endsAt: new Date(eventForm.endsAt).toISOString() })
      setEvents(old => [row, ...old]); setEventForm(old => ({ ...blankEvent, organizerId: old.organizerId })); setNotice('Event submitted to the review queue. It is not public until approved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save event.') } finally { setSaving(false) }
  }
  const changeEvent = async (event: EventRecord, patch: { status?: string; promoted?: boolean }) => {
    setError(''); setNotice('')
    try { const row = await api.updateEvent(event.id, patch); setEvents(old => old.map(x => x.id === row.id ? row : x)); setNotice('Event updated.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not update event.') }
  }
  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setError(''); setNotice('')
    try { const row = await api.createEventPlan({ ...planForm, monthlyPriceZar: Number(planForm.monthlyPriceZar), monthlyImpressionLimit: planForm.monthlyImpressionLimit ? Number(planForm.monthlyImpressionLimit) : null }); setPlans(old => [row, ...old]); setPlanForm(blankPlan); setNotice('Subscription plan saved. No payment has been collected.') }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save plan.') } finally { setSaving(false) }
  }
  return <section className="opportunity-page">
    <div className="opportunity-intro"><div><span className="intelligence-eyebrow">FESTIVE-SEASON GROWTH</span><h2>Event marketplace</h2><p>Manage real organisers, event submissions, map approvals and monthly visibility plans. Only approved events are eligible for public discovery.</p></div><button className="ghost" onClick={() => void load()}>Refresh</button></div>
    <div className="opportunity-cards">
      <div className="opportunity-card"><span>Event records</span><strong>{events.length}</strong><small>Real database records; no seeded demo events.</small></div>
      <div className="opportunity-card"><span>Approved for map</span><strong>{approvedEvents}</strong><small>Approval is required before public discovery.</small></div>
      <div className="opportunity-card"><span>Organisers</span><strong>{organizers.length}</strong><small>Contact details remain admin-only.</small></div>
      <div className="opportunity-card"><span>Subscription plans</span><strong>{plans.length}</strong><small>{activeSubs} paid subscriptions confirmed; billing not connected.</small></div>
    </div>
    <div className="event-tabs">{([['events','Events & map'],['organizers','Organisers'],['plans','Monthly plans']] as [Tab,string][]).map(([key,label]) => <button key={key} className={tab===key?'selected':''} onClick={() => setTab(key)}>{label}</button>)}</div>
    {error && <div className="err" role="alert">{error}</div>}{notice && <p className="opportunity-notice">{notice}</p>}
    {loading ? <div className="card"><p className="lab">Loading live test records…</p></div> : <>
      {tab === 'events' && <div className="opportunity-layout">
        <form className="card opportunity-form" onSubmit={createEvent}><h3>Submit an event</h3><p className="lab">Create a real event record. Map coordinates improve nearby parking discovery.</p>
          <label>Organiser<select required value={eventForm.organizerId} onChange={e=>setEventForm({...eventForm,organizerId:e.target.value})}><option value="">Select organiser</option>{organizers.map(o=><option key={o.id} value={o.id}>{o.organizationName} · {human(o.status)}</option>)}</select></label>
          <label>Event name<input required value={eventForm.title} onChange={e=>setEventForm({...eventForm,title:e.target.value})} placeholder="Official event name"/></label>
          <label>Category<select value={eventForm.category} onChange={e=>setEventForm({...eventForm,category:e.target.value})}>{['festival','concert','sport','market','conference','family','community','other'].map(x=><option key={x} value={x}>{human(x)}</option>)}</select></label>
          <label>Venue<input required value={eventForm.venueName} onChange={e=>setEventForm({...eventForm,venueName:e.target.value})} placeholder="Venue name"/></label>
          <label>Street address<input required value={eventForm.address} onChange={e=>setEventForm({...eventForm,address:e.target.value})} placeholder="Full venue address"/></label>
          <div className="opportunity-two"><label>Latitude<input type="number" step="any" value={eventForm.latitude} onChange={e=>setEventForm({...eventForm,latitude:e.target.value})}/></label><label>Longitude<input type="number" step="any" value={eventForm.longitude} onChange={e=>setEventForm({...eventForm,longitude:e.target.value})}/></label></div>
          <div className="opportunity-two"><label>Start date/time<input required type="datetime-local" value={eventForm.startsAt} onChange={e=>setEventForm({...eventForm,startsAt:e.target.value})}/></label><label>End date/time<input required type="datetime-local" value={eventForm.endsAt} onChange={e=>setEventForm({...eventForm,endsAt:e.target.value})}/></label></div>
          <label>Event description<textarea rows={3} value={eventForm.description} onChange={e=>setEventForm({...eventForm,description:e.target.value})}/></label>
          <label>Artwork URL<input type="url" value={eventForm.imageUrl} onChange={e=>setEventForm({...eventForm,imageUrl:e.target.value})} placeholder="HTTPS image URL (optional)"/></label>
          <label>Official ticket / information URL<input type="url" value={eventForm.ticketUrl} onChange={e=>setEventForm({...eventForm,ticketUrl:e.target.value})}/></label>
          <button className="pri" disabled={saving || !organizers.length}>{saving?'Saving…':'Submit for review'}</button>
          {!organizers.length && <p className="lab">Add an organiser first under Organisers.</p>}
        </form>
        <div className="card opportunity-records"><div className="opportunity-records-head"><div><h3>Event approvals</h3><p className="lab">{events.length} event record(s)</p></div><select value={filter} onChange={e=>setFilter(e.target.value)}><option value="all">All statuses</option>{statusOptions.map(s=><option key={s} value={s}>{human(s)}</option>)}</select></div>
          {events.filter(e=>filter==='all'||e.status===filter).length ? <div className="opportunity-list">{events.filter(e=>filter==='all'||e.status===filter).map(e=><article className="opportunity-record" key={e.id}><div className="opportunity-record-top"><div><span className="opportunity-type type-event">{human(e.category)}</span><h4>{e.title}</h4><p>{e.venueName} · {e.address}</p></div><span className={'confidence confidence-'+e.status}>{human(e.status)}</span></div><p className="lab">{new Date(e.startsAt).toLocaleString('en-ZA')} — {new Date(e.endsAt).toLocaleString('en-ZA')}</p><p className="lab">Organiser: {e.organizerName}</p>{e.ticketUrl&&<a href={e.ticketUrl} target="_blank" rel="noreferrer">Official event link ↗</a>}<label className="opportunity-status">Review status<select value={e.status} onChange={ev=>void changeEvent(e,{status:ev.target.value})}>{statusOptions.map(s=><option key={s} value={s}>{human(s)}</option>)}</select></label><label className="event-promote"><input type="checkbox" checked={e.promoted} onChange={ev=>void changeEvent(e,{promoted:ev.target.checked})}/> Promoted map placement</label></article>)}</div> : <div className="opportunity-empty"><strong>No event records yet</strong><p>Add a real organiser and submit a real event. No events are fabricated or automatically published.</p></div>}
        </div>
      </div>}
      {tab === 'organizers' && <div className="opportunity-layout"><form className="card opportunity-form" onSubmit={createOrganizer}><h3>Add event organiser</h3><label>Organisation<input required value={orgForm.organizationName} onChange={e=>setOrgForm({...orgForm,organizationName:e.target.value})} placeholder="Company / event organiser"/></label><label>Contact person<input required value={orgForm.contactName} onChange={e=>setOrgForm({...orgForm,contactName:e.target.value})}/></label><label>Business email<input required type="email" value={orgForm.contactEmail} onChange={e=>setOrgForm({...orgForm,contactEmail:e.target.value})}/></label><label>Phone (optional)<input value={orgForm.contactPhone} onChange={e=>setOrgForm({...orgForm,contactPhone:e.target.value})}/></label><label>Internal notes<textarea rows={3} value={orgForm.adminNotes} onChange={e=>setOrgForm({...orgForm,adminNotes:e.target.value})}/></label><button className="pri" disabled={saving}>{saving?'Saving…':'Save organiser'}</button></form><div className="card opportunity-records"><h3>Organiser pipeline</h3>{organizers.length?<div className="opportunity-list">{organizers.map(o=><article className="opportunity-record" key={o.id}><div className="opportunity-record-top"><div><h4>{o.organizationName}</h4><p>{o.contactName} · {o.contactEmail}</p></div><span className={'confidence confidence-'+o.status}>{human(o.status)}</span></div>{o.contactPhone&&<p>{o.contactPhone}</p>}<label className="opportunity-status">Approval status<select value={o.status} onChange={async e=>{try{const row=await api.updateEventOrganizer(o.id,{status:e.target.value});setOrganizers(old=>old.map(x=>x.id===row.id?row:x))}catch(err){setError(err instanceof Error?err.message:'Update failed')}}}>{['pending_review','approved','suspended','rejected'].map(s=><option key={s} value={s}>{human(s)}</option>)}</select></label></article>)}</div>:<div className="opportunity-empty"><strong>No organisers added</strong><p>Start with real event-company contacts. Their details are never exposed on the public map.</p></div>}</div></div>}
      {tab === 'plans' && <div className="opportunity-layout"><form className="card opportunity-form" onSubmit={createPlan}><h3>Create monthly plan</h3><p className="lab">Set your own pricing. This configures plans only; billing is not connected and no payment is collected.</p><label>Plan name<input required value={planForm.name} onChange={e=>setPlanForm({...planForm,name:e.target.value})} placeholder="e.g. Local, Growth, Featured"/></label><label>Monthly price (ZAR)<input required type="number" min="0" step="0.01" value={planForm.monthlyPriceZar} onChange={e=>setPlanForm({...planForm,monthlyPriceZar:e.target.value})}/></label><label>Included visibility / benefits<textarea rows={3} value={planForm.description} onChange={e=>setPlanForm({...planForm,description:e.target.value})}/></label><label>Monthly impression limit (optional)<input type="number" min="0" value={planForm.monthlyImpressionLimit} onChange={e=>setPlanForm({...planForm,monthlyImpressionLimit:e.target.value})}/></label><label className="event-promote"><input type="checkbox" checked={planForm.promotedPlacement} onChange={e=>setPlanForm({...planForm,promotedPlacement:e.target.checked})}/> Includes promoted map placement</label><button className="pri" disabled={saving}>{saving?'Saving…':'Save subscription plan'}</button></form><div className="card opportunity-records"><h3>Available plans</h3>{plans.length?<div className="opportunity-list">{plans.map(p=><article className="opportunity-record" key={p.id}><div className="opportunity-record-top"><div><h4>{p.name}</h4><p>R{Number(p.monthlyPriceZar).toFixed(2)} / month</p></div><span className={'confidence '+(p.active?'confidence-approved':'confidence-closed')}>{p.active?'Active':'Inactive'}</span></div><p>{p.description||'No benefits described yet.'}</p><p className="lab">Promoted placement: {p.promotedPlacement?'Included':'Not included'} · Monthly impressions: {p.monthlyImpressionLimit??'No limit set'}</p><button className="ghost" onClick={async()=>{try{const row=await api.updateEventPlan(p.id,{active:!p.active});setPlans(old=>old.map(x=>x.id===row.id?row:x))}catch(err){setError(err instanceof Error?err.message:'Could not update plan')}}}>{p.active?'Deactivate plan':'Activate plan'}</button></article>)}</div>:<div className="opportunity-empty"><strong>No plans configured</strong><p>Create plans once pricing and benefits are decided. No price assumptions are preloaded.</p></div>}</div></div>}
    </>}
    <p className="demand-disclaimer">Public event discovery, nearby parking inventory, booking and subscription billing must be connected and tested before launch. Engagement reporting should use aggregate campaign metrics, not disclose driver identities or private location histories.</p>
  </section>
}

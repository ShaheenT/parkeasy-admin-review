import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Integration } from '../types'

/** Connection state is stored by your API; the OAuth or webhook handshake belongs server-side. */
export default function Integrations() {
  const [items, setItems] = useState<Integration[]>([]), [error, setError] = useState('')
  useEffect(() => { api.integrations().then(setItems).catch((e: Error) => setError(e.message)) }, [])

  const save = async (i: Integration, connected: boolean, config?: string) => {
    try { const u = await api.setIntegration(i.id, connected, config); setItems((l) => l.map((x) => (x.id === u.id ? u : x))) }
    catch (e) { setError((e as Error).message) }
  }
  return (
    <>
      {error && <div className="err" role="alert">{error}</div>}
      <div className="grid k2eq">{items.map((i) => (
        <div className="card" key={i.id} data-testid={`integration-${i.id}`}>
          <h3>{i.name}<span className={`chip ${i.connected ? 'ok' : ''}`}>{i.connected ? 'Connected' : 'Not connected'}</span></h3>
          <p className="lab">{i.description}</p>
          {i.id === 'slack' && <input placeholder="Slack webhook URL" defaultValue={i.config} onBlur={(e) => e.target.value !== i.config && save(i, i.connected, e.target.value)} />}
          <p><button className={i.connected ? '' : 'pri'} data-testid={`toggle-${i.id}`} onClick={() => save(i, !i.connected)}>{i.connected ? 'Disconnect' : 'Connect'}</button></p>
        </div>
      ))}</div>
    </>
  )
}

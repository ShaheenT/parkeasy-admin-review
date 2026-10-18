import { useState, type FormEvent } from 'react'
import DataTable from '../components/DataTable'
import { useResource } from '../components/useResource'
import { api } from '../lib/api'

export default function Notifications() {
  const { rows, refresh, act } = useResource('notifications')
  const [msg, setMsg] = useState(''), [info, setInfo] = useState('')
  const send = async (e: FormEvent) => {
    e.preventDefault()
    setInfo(''); try { await api.announce(msg); setMsg(''); setInfo('Announcement sent.'); refresh() } catch (e) { setInfo((e as Error).message) }
  }
  return (
    <>
      <form className="card toolbar" onSubmit={send} style={{ marginBottom: 14 }}>
        <input data-testid="announce-input" style={{ flex: 1 }} placeholder="Write a push announcement to all users" value={msg} onChange={(e) => setMsg(e.target.value)} required />
        <button className="pri" data-testid="announce-send">Send announcement</button>
        {info && <span className="chip ok">{info}</span>}
      </form>
      <DataTable resource="notifications" rows={rows} onAction={act} />
    </>
  )
}

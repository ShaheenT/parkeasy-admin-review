import { useState } from 'react'

const OPTIONS = [['Commission rate (16%)', true], ['Auto-release payouts', false], ['Require KYC for hosts', true], ['Push booking alerts', true]] as const

export default function Settings() {
  const [state, setState] = useState<Record<string, boolean>>(Object.fromEntries(OPTIONS))
  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h3>Platform settings</h3>
      {OPTIONS.map(([label]) => (
        <label className="tg" key={label}>{label}
          <input type="checkbox" checked={state[label]} onChange={(e) => setState({ ...state, [label]: e.target.checked })} />
        </label>
      ))}
      <p className="lab">Settings are held in the browser for now. Persist them with PUT /admin/settings.</p>
    </div>
  )
}

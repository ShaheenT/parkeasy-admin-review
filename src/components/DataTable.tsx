import { useMemo, useState } from 'react'
import type { Row } from '../types'
import { RESOURCES, statusClass, type ResourceKey } from '../lib/resources'
import { money } from '../lib/stats'

type Props = { resource: ResourceKey; rows: Row[]; onAction: (r: Row, action: string) => void; query?: string }

export default function DataTable({ resource, rows, onAction, query = '' }: Props) {
  const def = RESOURCES[resource]
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState(query)
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status).filter(Boolean))] as string[], [rows])
  const list = rows.filter((r) => (filter === 'all' || r.status === filter) && JSON.stringify(r).toLowerCase().includes(search.toLowerCase()))

  const cell = (r: Row, c: string) => {
    const v = r[c]
    if (c === 'status' || c === 'risk') return <span className={`chip ${statusClass(String(v))}`}>{v}</span>
    if (c === 'occupancy') return <div className="bar"><i style={{ width: `${v}%` }} /></div>
    if (c === 'amount' && typeof v === 'number') return money(v)
    if (c === 'rate') return `R${v}/hr`
    return v
  }

  return (
    <div data-testid={`table-${resource}`}>
      <div className="toolbar">
        <div className="seg">
          {statuses.length > 0 && ['all', ...statuses].map((s) => (
            <button key={s} data-testid={`filter-${s}`} className={s === filter ? 'on' : ''} onClick={() => setFilter(s)}>{s}</button>
          ))}
        </div>
        <input data-testid="search" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card tw">
        <table>
          <thead><tr>{def.columns.map((c) => <th key={c}>{c}</th>)}{def.actions && <th />}</tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} data-testid="row">
                {def.columns.map((c) => <td key={c}>{cell(r, c)}</td>)}
                {def.actions && (
                  <td className="acts">
                    {def.actions.filter((a) => !a.when || a.when(r)).map((a) => (
                      <button key={a.action} className="sm" data-testid={`action-${a.action}`} onClick={() => onAction(r, a.action)}>{a.label}</button>
                    ))}
                  </td>
                )}
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={9} className="lab">No results. Clear the search or choose another filter.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}

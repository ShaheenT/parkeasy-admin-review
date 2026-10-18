import { useCallback, useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { ResourceKey } from '../lib/resources'
import type { Row } from '../types'

export function useResource(resource: ResourceKey, pollMs = 0) {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState(''), [loading, setLoading] = useState(true)

  const refresh = useCallback(() => api.list(resource).then((r) => { setRows(r); setError('') }).catch((e: Error) => setError(e.message)).finally(() => setLoading(false)), [resource])
  useEffect(() => { setLoading(true); refresh() }, [refresh])
  useEffect(() => { if (!pollMs) return; const t = setInterval(refresh, pollMs); return () => clearInterval(t) }, [refresh, pollMs])

  const act = async (r: Row, action: string) => {
    try { await api.act(resource, r.id, action); await refresh() } catch (e) { setError((e as Error).message) }
  }
  return { rows, loading, error, refresh, act }
}

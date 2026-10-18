import DataTable from '../components/DataTable'
import { useResource } from '../components/useResource'
import type { ResourceKey } from '../lib/resources'

export default function ResourcePage({ resource }: { resource: ResourceKey; title: string }) {
  const { rows, loading, error, act } = useResource(resource)
  if (loading) return <p className="lab">Loading…</p>
  return <>{error && <div className="err" role="alert">{error}</div>}<DataTable resource={resource} rows={rows} onAction={act} /></>
}

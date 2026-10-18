import DataTable from '../components/DataTable'
import { useResource } from '../components/useResource'

/** KYC verification queue. Production: wire document images to your KYC provider's review URL. */
export default function Kyc() {
  const { rows, loading, error, act } = useResource('kyc')
  const high = rows.filter((r) => r.risk === 'high').length
  const pending = rows.filter((r) => r.status === 'review').length
  if (loading) return <p className="lab">Loading…</p>
  return (
    <>
      <div className="grid k3" style={{ marginBottom: 14 }}>
        <div className="card"><div className="lab">High-risk profiles</div><div className="big" data-testid="kyc-high">{high}</div></div>
        <div className="card"><div className="lab">Awaiting review</div><div className="big">{pending}</div></div>
        <div className="card"><div className="lab">Verified</div><div className="big">{rows.filter((r) => r.status === 'verified').length}</div></div>
      </div>
      {error && <div className="err" role="alert">{error}</div>}
      <DataTable resource="kyc" rows={rows} onAction={act} />
    </>
  )
}

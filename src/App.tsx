import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ResourcePage from './pages/ResourcePage'
import LiveMap from './pages/LiveMap'
import OpportunityIntelligence from './pages/OpportunityIntelligence'
import Integrations from './pages/Integrations'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Kyc from './pages/Kyc'
import { RESOURCES, type ResourceKey } from './lib/resources'

const TABLES: ResourceKey[] = ['users', 'scouts', 'leads', 'bays', 'bookings', 'payments', 'payouts', 'devices', 'support']

export default function App() {
  const { user, loading } = useAuth()
  if (loading) return <div className="center lab">Loading…</div>
  if (!user) return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        {TABLES.map((k) => <Route key={k} path={k} element={<ResourcePage resource={k} title={RESOURCES[k].title} />} />)}
        <Route path="kyc" element={<Kyc />} />
        <Route path="map" element={<LiveMap />} />
        <Route path="intelligence" element={<OpportunityIntelligence />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="integrations" element={<Integrations />} />
        <Route path="settings" element={<Settings />} />
        <Route path="login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

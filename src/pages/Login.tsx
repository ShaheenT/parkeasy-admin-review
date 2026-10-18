import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { MOCK } from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState(''), [password, setPassword] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await login(email, password) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <div className="center">
      <form className="card login" onSubmit={submit}>
        <div><div className="logo"><i>P</i>PARKEASY</div><div className="tagline">FIND • EARN • PARK</div></div>
        <label>Email<input data-testid="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" /></label>
        <label>Password<input data-testid="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" /></label>
        {error && <div className="err" role="alert" data-testid="login-error">{error}</div>}
        <button className="pri" data-testid="login-submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        {MOCK && <p className="lab">Demo login: admin@parkeasy.co.za / admin123</p>}
      </form>
    </div>
  )
}

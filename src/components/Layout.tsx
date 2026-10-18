import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Bell, Building2, CalendarDays, CreditCard, FileCheck2, LayoutDashboard, LogOut, MapPin, Menu, MessageSquare, Monitor, Moon, Plug, Settings, ShieldCheck, UserCog, Users, Wallet, X } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import { MOCK } from '../lib/api'

type Item = [string, string, LucideIcon]
const NAV: [string, Item[]][] = [
  ['Main', [
    ['/', 'Dashboard', LayoutDashboard], ['/users', 'Users', Users], ['/scouts', 'Scouts', UserCog],
    ['/leads', 'Scout Leads', FileCheck2], ['/bays', 'Parking Bays', Building2], ['/bookings', 'Bookings', CalendarDays],
  ]],
  ['Finance & operations', [
    ['/payments', 'Payments', CreditCard], ['/payouts', 'Payouts', Wallet], ['/kyc', 'KYC / Risk', ShieldCheck],
    ['/devices', 'Devices', Monitor], ['/map', 'Live Map', MapPin], ['/notifications', 'Notifications', Bell], ['/support', 'Support Inbox', MessageSquare],
  ]],
  ['Others', [['/integrations', 'Integrations', Plug], ['/settings', 'Settings', Settings]]],
]

export default function Layout() {
  const { user, logout } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const title = NAV.flatMap((g) => g[1]).find((n) => n[0] === loc.pathname)?.[1] ?? 'Dashboard'

  const toggleTheme = () => {
    const r = document.documentElement
    r.dataset.theme = (r.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'dark' ? 'light' : 'dark'
  }

  return (
    <div className="shell">
      <aside className={open ? 'side open' : 'side'}>
        <div className="logo"><i>P</i>PARKEASY<button className="icon mobile-only" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button></div>
        <div className="tagline">FIND • EARN • PARK</div>
        <div className="me"><div className="av">{user?.name.slice(0, 2).toUpperCase()}</div><div><b>{user?.name}</b><div className="lab">{user?.role}</div></div></div>
        <nav>
          {NAV.map(([group, items]) => (
            <div key={group}>
              <div className="grp">{group}</div>
              {items.map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')}>
                  <Icon size={17} />{label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <button className="logout" data-testid="logout" onClick={logout}><LogOut size={17} />Log out</button>
      </aside>
      <main>
        <header>
          <button className="icon mobile-only" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={20} /></button>
          <h1 data-testid="page-title">{title}</h1>
          {MOCK && <span className="chip info">Demo data</span>}
          <button className="icon" onClick={toggleTheme} aria-label="Toggle theme"><Moon size={17} /></button>
          <button className="ghost" onClick={logout}><LogOut size={15} />Log out</button>
        </header>
        <div className="view"><Outlet /></div>
      </main>
    </div>
  )
}

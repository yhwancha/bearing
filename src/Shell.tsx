import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { t } from './i18n'
import { Toaster } from './ui'
import { BrandMark, IconBox, IconCalendar, IconInbox, IconOverview, IconRules } from './ui/icons'

export interface NavCounts {
  orders?: number
}

export default function Shell({ workspace, counts, children }: {
  workspace: string
  counts?: NavCounts
  children: ReactNode
}) {
  const initials = workspace
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const items = [
    { to: '/', label: t.nav.overview, icon: <IconOverview />, end: true },
    { to: '/orders', label: t.nav.orders, icon: <IconInbox />, count: counts?.orders },
    { to: '/statements', label: t.nav.statements, icon: <IconCalendar /> },
    { to: '/catalog', label: t.nav.catalog, icon: <IconBox /> },
    { to: '/rules', label: t.nav.rules, icon: <IconRules /> },
  ]
  return (
    <div className="shell">
      <header className="topbar">
        <NavLink to="/" className="brand" aria-label={t.product}>
          <BrandMark className="brand-mark" />
          {t.product}
        </NavLink>
        <nav className="nav" aria-label="Main">
          {items.map((i) => (
            <NavLink key={i.to} to={i.to} end={i.end}>
              {i.icon}
              {i.label}
              {!!i.count && <span className="count">{i.count}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="topbar-end">
          <div className="workspace" title={`${workspace} · ${t.workspaceRole}`}>
            <span className="avatar">{initials}</span>
            <span className="name">{workspace}</span>
          </div>
        </div>
      </header>
      <main className="main">{children}</main>
      <Toaster />
    </div>
  )
}

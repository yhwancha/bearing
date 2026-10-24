import { type ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { reopenDeclaration, setCaCheck, setCaRef, updateLineQty } from '../actions'
import type { OrderView } from '../derive'
import { fmtMoney, fmtNum } from '../format'
import { t } from '../i18n'
import { lineAmount, RATION_LIMITS, sumAmount } from '../sg'
import type { ResolvedLine } from '../types'
import { Badge, Card, Empty, Flag, Meter, PageHead } from '../ui'
import { IconCheck, IconFile, IconShield, IconX } from '../ui/icons'
import { useOrderView } from './Order'
import Progress from './Progress'
import TradenetPreview from './TradenetPreview'

interface Route {
  key: string
  tone: 'info' | 'accent' | 'warn' | 'neutral'
  icon: ReactNode
  title: string
  note: string
  lines: ResolvedLine[]
}

function RouteCard({ route, currency }: { route: Route; currency: 'SGD' | 'USD' }) {
  return (
    <section className={`route route-${route.tone}`}>
      <header>
        <span className="route-icon">{route.icon}</span>
        <div>
          <h3>{route.title}</h3>
          <p>{route.note}</p>
        </div>
        <span className="route-count num">{route.lines.length}</span>
      </header>
      <ul>
        {route.lines.map((l) => (
          <li key={l.idx}>
            <span>{l.name ?? l.desc}</span>
            <span className="num muted">
              {l.qty} {l.unit ?? l.orderUnit}
            </span>
          </li>
        ))}
      </ul>
      <footer>
        <span />
        <span className="num strong">{fmtMoney(sumAmount(route.lines), currency)}</span>
      </footer>
    </section>
  )
}

function Rations({ v, locked }: { v: OrderView; locked: boolean }) {
  const { decl, order } = v
  const crew = order.vessel.crew ?? 0
  const days = order.vessel.voyageDays ?? 0
  if (!decl.rations.length) return null
  return (
    <Card title={t.decl.rationTitle} meta={t.decl.crewDays(crew, days)}>
      <div className="stack">
        {decl.rations.map((r) => {
          const lim = { ...RATION_LIMITS[r.kind], ...t.ration[r.kind] }
          const lines = decl.lines.filter((l) => r.lines.includes(l.idx))
          const single = lines.length === 1 ? lines[0] : undefined
          const fitQty = single ? Math.floor(r.allowed / (single.rationUnitQty ?? 1)) : 0
          return (
            <div key={r.kind} className="ration">
              <div className="row">
                <span className="strong">{lim.label}</span>
                {r.ok ? <Badge tone="ok"><IconCheck size={12} />{t.decl.within}</Badge> : <Badge tone="bad">{t.decl.over(fmtNum(r.requested - r.allowed), lim.unit)}</Badge>}
                <span className="spacer" />
                <span className="num small">
                  <strong>{fmtNum(r.requested)}</strong> / {fmtNum(r.allowed)} {lim.unit}
                </span>
              </div>
              <Meter value={r.requested} max={r.allowed} />
              <div className="row wrap small muted">
                <span>{t.decl.allowance(crew, days, lim.perDay, lim.unit)}</span>
                {!r.ok && single && !locked && (
                  <>
                    <span className="spacer" />
                    <label className="row" style={{ gap: 6 }}>
                      {t.decl.line(single.idx)}
                      <input
                        className="input num"
                        style={{ width: 80, minHeight: 28, padding: '3px 8px' }}
                        type="number"
                        min={0}
                        value={single.qty}
                        onChange={(e) => updateLineQty(order.id, single.idx, Math.max(0, Number(e.target.value)))}
                      />
                      {single.unit}
                    </label>
                    <button className="btn sm" onClick={() => updateLineQty(order.id, single.idx, fitQty)}>
                      {t.decl.cutTo(fitQty, single.unit)}
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function Approvals({ v, locked }: { v: OrderView; locked: boolean }) {
  const entries = Object.entries(v.decl.caChecks)
  if (!entries.length) return null
  return (
    <Card title={<div className="row"><IconShield /><h2>{t.decl.caTitle}</h2></div>}>
      <div className="stack">
        <p className="small muted">{t.decl.caNote}</p>
        {entries.map(([ca, ok]) => {
          const items = v.decl.lines.filter((l) => l.sgClass === 'controlled' && (l.controlAuthority || 'Competent Authority') === ca)
          const ref = (locked ? v.decl.caRefs : v.order.caRefs)?.[ca] ?? ''
          return (
            <div key={ca} className="stack" style={{ gap: 6 }}>
              <label className={`check ${ok ? 'on' : ''}`}>
                <input type="checkbox" aria-label={t.decl.caConfirmed(ca)} checked={ok} disabled={locked} onChange={(e) => setCaCheck(v.order.id, ca, e.target.checked)} />
                <div>
                  <div className="strong">{ca}</div>
                  <div className="small muted">{items.map((l) => `${l.name} × ${l.qty}`).join(', ')}</div>
                </div>
                <Badge tone={ok ? 'ok' : 'warn'}>{ok ? t.decl.approved : t.decl.pendingCa}</Badge>
              </label>
              <label className="row small" style={{ gap: 8 }}>
                <span className="muted" style={{ whiteSpace: 'nowrap' }}>{t.decl.caRef}</span>
                <input
                  className="input mono"
                  style={{ minHeight: 30, padding: '4px 8px' }}
                  value={ref}
                  disabled={locked}
                  placeholder={t.decl.caRefPlaceholder}
                  onChange={(e) => setCaRef(v.order.id, ca, e.target.value.toUpperCase())}
                />
              </label>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

export default function Declaration() {
  const { id } = useParams()
  const v = useOrderView(id)
  if (!v) return <Empty title={t.common.orderNotFound} />
  const { order, decl } = v
  const locked = !!order.decl?.confirmedAt
  const at = (idx: number[]) => decl.lines.filter((l) => idx.includes(l.idx))
  const aps = decl.permits.find((p) => p.declarationType === 'APS')?.lines ?? []
  const drt = decl.permits.find((p) => p.declarationType === 'DRT')?.lines ?? []
  const routes: Route[] = [
    { key: 'aps', tone: 'info', icon: <IconFile />, title: t.decl.aps, note: t.decl.apsNote, lines: at(aps) },
    { key: 'statement', tone: 'accent', icon: <IconCheck />, title: t.decl.statement, note: t.decl.statementNote, lines: at(decl.statementOnly) },
    { key: 'drt', tone: 'warn', icon: <IconShield />, title: t.decl.drt, note: t.decl.drtNote, lines: at(drt) },
    { key: 'excluded', tone: 'neutral', icon: <IconX />, title: t.decl.excluded, note: t.decl.excludedNote, lines: at(decl.excluded) },
  ]
  const used = routes.filter((r) => r.lines.length)
  const unused = routes.filter((r) => !r.lines.length)
  const total = decl.lines.reduce((s, l) => s + lineAmount(l), 0)
  const hasChecks = decl.rations.length > 0 || Object.keys(decl.caChecks).length > 0

  return (
    <>
      <PageHead
        crumbs={[
          { to: '/orders', label: t.nav.orders },
          { to: `/orders/${order.id}`, label: order.ref },
        ]}
        title={t.decl.title}
        sub={
          <span className="row wrap" style={{ gap: 8 }}>
            <Flag code="SG" />
            <span className="strong">{order.vessel.name}</span>·
            <span>{order.vessel.flag ?? t.common.flagMissing}</span>·
            <span>{order.vessel.type ? t.vesselType[order.vessel.type] : t.common.typeMissing}</span>·
            <span className="mono">IMO {order.vessel.imo ?? '—'}</span>
          </span>
        }
        actions={
          locked && !order.delivery && (
            <button className="btn ghost sm" onClick={() => confirm(t.decl.reopenConfirm) && reopenDeclaration(order.id)}>
              {t.decl.reopen}
            </button>
          )
        }
      />
      <div className="stack">
        <Progress v={v} page="declaration" />

        <section className="stack" style={{ gap: 10 }}>
          <div className="section-head">
            <h2>{t.decl.routesTitle}</h2>
            <span className="muted small">
              {t.common.lines(decl.lines.length)} · {t.decl.orderTotal} <strong className="num">{fmtMoney(total, order.currency)}</strong>
            </span>
          </div>
          {used.length > 0 && (
            <div className={`routes n${used.length}`}>
              {used.map((r) => (
                <RouteCard key={r.key} route={r} currency={order.currency} />
              ))}
            </div>
          )}
          {unused.length > 0 && (
            <p className="small muted">
              {t.decl.notInOrder}: {unused.map((r) => r.title).join(' · ')}
            </p>
          )}
        </section>

        {hasChecks && (
          <div className={decl.rations.length && Object.keys(decl.caChecks).length ? 'grid cols-2' : 'stack'}>
            <Rations v={v} locked={locked} />
            <Approvals v={v} locked={locked} />
          </div>
        )}
        <TradenetPreview v={v} />
      </div>
    </>
  )
}

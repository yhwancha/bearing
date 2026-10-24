import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { confirmDeclaration, recordPermit, reopenDeclaration, setCaCheck, updateLineQty } from '../actions'
import type { OrderView } from '../derive'
import { fmtDateTime, fmtMoney, fmtNum } from '../format'
import { t } from '../i18n'
import { lineAmount, RATION_LIMITS, sumAmount } from '../sg'
import type { ResolvedLine } from '../types'
import { Badge, Card, Empty, Flag, Meter, Notice, PageHead, toast } from '../ui'
import { IconArrowRight, IconCheck, IconFile, IconShield, IconTruck, IconX } from '../ui/icons'
import { IssueList, useOrderView } from './Order'
import TradenetPreview from './TradenetPreview'

function RouteCard({ tone, icon, title, note, lines, currency, footer }: {
  tone: 'info' | 'accent' | 'warn' | 'neutral'
  icon: ReactNode
  title: string
  note: string
  lines: ResolvedLine[]
  currency: 'SGD' | 'USD'
  footer?: ReactNode
}) {
  return (
    <section className={`route route-${tone}`}>
      <header>
        <span className="route-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p>{note}</p>
        </div>
        <span className="route-count num">{lines.length}</span>
      </header>
      {lines.length ? (
        <ul>
          {lines.map((l) => (
            <li key={l.idx}>
              <span>{l.name ?? l.desc}</span>
              <span className="num muted">
                {l.qty} {l.unit ?? l.orderUnit}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="route-empty">{t.decl.none}</p>
      )}
      <footer>
        {footer ?? <span />}
        <span className="num strong">{fmtMoney(sumAmount(lines), currency)}</span>
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
          return (
            <label key={ca} className={`check ${ok ? 'on' : ''}`}>
              <input type="checkbox" aria-label={t.decl.caConfirmed(ca)} checked={ok} disabled={locked} onChange={(e) => setCaCheck(v.order.id, ca, e.target.checked)} />
              <div>
                <div className="strong">{ca}</div>
                <div className="small muted">{items.map((l) => `${l.name} × ${l.qty}`).join(', ')}</div>
              </div>
              <Badge tone={ok ? 'ok' : 'warn'}>{ok ? t.decl.approved : t.decl.pendingCa}</Badge>
            </label>
          )
        })}
      </div>
    </Card>
  )
}

function Filing({ v }: { v: OrderView }) {
  const d = v.order.decl!
  const [permit, setPermit] = useState(d.tradenetPermitNo ?? '')
  return (
    <Card title={t.decl.filed} meta={t.decl.confirmedAt(fmtDateTime(d.confirmedAt))}>
      <div className="stack">
        <label className="field">
          <span>{t.decl.permitNo}</span>
          <div className="row">
            <input className="input mono" value={permit} placeholder={t.decl.permitPlaceholder} onChange={(e) => setPermit(e.target.value.toUpperCase())} />
            <button
              className="btn"
              disabled={permit === (d.tradenetPermitNo ?? '')}
              onClick={() => {
                recordPermit(v.order.id, permit)
                toast(t.decl.permitSaved)
              }}
            >
              {t.common.save}
            </button>
          </div>
        </label>
        <div className="row wrap">
          {!v.order.delivery && (
            <button className="btn ghost sm" onClick={() => confirm(t.decl.reopenConfirm) && reopenDeclaration(v.order.id)}>
              {t.decl.reopen}
            </button>
          )}
          <span className="spacer" />
          <Link to={`/orders/${v.order.id}/delivery`} className="btn primary">
            <IconTruck />
            {v.order.delivery ? t.decl.viewDelivery : t.decl.recordDelivery}
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function Declaration() {
  const { id } = useParams()
  const v = useOrderView(id)
  if (!v) return <Empty title={t.common.orderNotFound} />
  const { order, decl, blocking, issues } = v
  const locked = !!order.decl?.confirmedAt
  const at = (idx: number[]) => decl.lines.filter((l) => idx.includes(l.idx))
  const aps = decl.permits.find((p) => p.declarationType === 'APS')?.lines ?? []
  const drt = decl.permits.find((p) => p.declarationType === 'DRT')?.lines ?? []
  const unrouted = decl.lines.filter((l) => !l.sgClass)

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
          !locked && (
            <button
              className="btn primary"
              disabled={blocking.length > 0}
              title={blocking.length ? t.decl.clearFirst : undefined}
              onClick={() => {
                confirmDeclaration(order.id, decl)
                toast(t.decl.confirmed)
              }}
            >
              <IconCheck />
              {t.decl.confirm}
            </button>
          )
        }
      />
      <div className="stack">
        {unrouted.length > 0 && (
          <Notice tone="warn">
            {t.decl.unrouted(unrouted.length)}{' '}
            <Link to={`/orders/${order.id}`} className="strong" style={{ textDecoration: 'underline' }}>
              {t.decl.classifyOnOrder}
            </Link>
          </Notice>
        )}
        <div className="routes">
          <RouteCard
            tone="info"
            icon={<IconFile />}
            title={t.decl.aps}
            note={t.decl.apsNote}
            lines={at(aps)}
            currency={order.currency}
          />
          <RouteCard
            tone="accent"
            icon={<IconCheck />}
            title={t.decl.statement}
            note={t.decl.statementNote}
            lines={at(decl.statementOnly)}
            currency={order.currency}
          />
          <RouteCard
            tone="warn"
            icon={<IconShield />}
            title={t.decl.drt}
            note={t.decl.drtNote}
            lines={at(drt)}
            currency={order.currency}
          />
          <RouteCard
            tone="neutral"
            icon={<IconX />}
            title={t.decl.excluded}
            note={t.decl.excludedNote}
            lines={at(decl.excluded)}
            currency={order.currency}
          />
        </div>
        <div className="split">
          <div className="stack">
            <Rations v={v} locked={locked} />
            <Approvals v={v} locked={locked} />
            <TradenetPreview v={v} />
          </div>
          <div className="stack">
            {locked ? (
              <Filing v={v} />
            ) : (
              <Card title={t.decl.beforeFiling} meta={blocking.length ? t.common.blocking(blocking.length) : t.decl.ready}>
                <div className="stack">
                  <IssueList issues={issues} />
                  {!blocking.length && (
                    <p className="small muted">{t.decl.freezeNote}</p>
                  )}
                </div>
              </Card>
            )}
            <Card title={t.common.value} pad={false}>
              <table className="table">
                <tbody>
                  <tr><td>{t.decl.permitLines}</td><td className="r num">{fmtMoney(sumAmount(at(decl.permitLines)), order.currency)}</td></tr>
                  <tr><td>{t.decl.statement}</td><td className="r num">{fmtMoney(sumAmount(at(decl.statementOnly)), order.currency)}</td></tr>
                  <tr><td>{t.decl.excluded}</td><td className="r num">{fmtMoney(sumAmount(at(decl.excluded)), order.currency)}</td></tr>
                  <tr><td className="strong">{t.decl.orderTotal}</td><td className="r num strong">{fmtMoney(decl.lines.reduce((s, l) => s + lineAmount(l), 0), order.currency)}</td></tr>
                </tbody>
              </table>
            </Card>
            <Link to={`/orders/${order.id}`} className="btn ghost">
              {t.decl.back} <IconArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

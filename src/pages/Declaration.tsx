import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { confirmDeclaration, recordPermit, reopenDeclaration, setCaCheck, updateLineQty } from '../actions'
import type { OrderView } from '../derive'
import { fmtDateTime, fmtMoney, fmtNum } from '../format'
import { lineAmount, RATION_LIMITS, sumAmount, VESSEL_TYPE_LABEL } from '../sg'
import type { ResolvedLine } from '../types'
import { Badge, Card, Empty, Flag, Meter, Notice, PageHead, toast } from '../ui'
import { IconArrowRight, IconCheck, IconFile, IconShield, IconTruck, IconX } from '../ui/icons'
import { IssueList, useOrderView } from './Order'

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
        <p className="route-empty">None</p>
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
    <Card title="Daily ration check" meta={`${crew} crew × ${days} days`}>
      <div className="stack">
        {decl.rations.map((r) => {
          const lim = RATION_LIMITS[r.kind]
          const lines = decl.lines.filter((l) => r.lines.includes(l.idx))
          const single = lines.length === 1 ? lines[0] : undefined
          const fitQty = single ? Math.floor(r.allowed / (single.rationUnitQty ?? 1)) : 0
          return (
            <div key={r.kind} className="ration">
              <div className="row">
                <span className="strong">{lim.label}</span>
                {r.ok ? <Badge tone="ok"><IconCheck size={12} />Within allowance</Badge> : <Badge tone="bad">Over by {fmtNum(r.requested - r.allowed)} {lim.unit}</Badge>}
                <span className="spacer" />
                <span className="num small">
                  <strong>{fmtNum(r.requested)}</strong> / {fmtNum(r.allowed)} {lim.unit}
                </span>
              </div>
              <Meter value={r.requested} max={r.allowed} />
              <div className="row wrap small muted">
                <span>
                  Allowance = {crew} crew × {days} days × {lim.perDay} {lim.unit}
                </span>
                {!r.ok && single && !locked && (
                  <>
                    <span className="spacer" />
                    <label className="row" style={{ gap: 6 }}>
                      Line {single.idx}
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
                      Cut to {fitQty} {single.unit}
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
    <Card title={<div className="row"><IconShield /><h2>Competent Authority approvals</h2></div>}>
      <div className="stack">
        <p className="small muted">Controlled items need the authority's approval (notification, licence or certificate) before the OUT (DRT) permit.</p>
        {entries.map(([ca, ok]) => {
          const items = v.decl.lines.filter((l) => l.sgClass === 'controlled' && (l.controlAuthority || 'Competent Authority') === ca)
          return (
            <label key={ca} className={`check ${ok ? 'on' : ''}`}>
              <input type="checkbox" aria-label={`${ca} approval confirmed`} checked={ok} disabled={locked} onChange={(e) => setCaCheck(v.order.id, ca, e.target.checked)} />
              <div>
                <div className="strong">{ca}</div>
                <div className="small muted">{items.map((l) => `${l.name} × ${l.qty}`).join(', ')}</div>
              </div>
              <Badge tone={ok ? 'ok' : 'warn'}>{ok ? 'Approved' : 'Pending'}</Badge>
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
    <Card title="Filed" meta={`Confirmed ${fmtDateTime(d.confirmedAt)}`}>
      <div className="stack">
        <label className="field">
          <span>TradeNet permit number</span>
          <div className="row">
            <input className="input mono" value={permit} placeholder="Enter after TradeNet approval" onChange={(e) => setPermit(e.target.value.toUpperCase())} />
            <button
              className="btn"
              disabled={permit === (d.tradenetPermitNo ?? '')}
              onClick={() => {
                recordPermit(v.order.id, permit)
                toast('Permit number saved')
              }}
            >
              Save
            </button>
          </div>
        </label>
        <div className="row wrap">
          {!v.order.delivery && (
            <button className="btn ghost sm" onClick={() => confirm('Reopen the declaration for changes?') && reopenDeclaration(v.order.id)}>
              Reopen
            </button>
          )}
          <span className="spacer" />
          <Link to={`/orders/${v.order.id}/delivery`} className="btn primary">
            <IconTruck />
            {v.order.delivery ? 'View delivery' : 'Record delivery'}
          </Link>
        </div>
      </div>
    </Card>
  )
}

export default function Declaration() {
  const { id } = useParams()
  const v = useOrderView(id)
  if (!v) return <Empty title="Order not found" />
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
          { to: '/orders', label: 'Orders' },
          { to: `/orders/${order.id}`, label: order.ref },
        ]}
        title="Declaration"
        sub={
          <span className="row wrap" style={{ gap: 8 }}>
            <Flag code="SG" />
            <span className="strong">{order.vessel.name}</span>·
            <span>{order.vessel.flag ?? 'Flag missing'}</span>·
            <span>{order.vessel.type ? VESSEL_TYPE_LABEL[order.vessel.type] : 'Type missing'}</span>·
            <span className="mono">IMO {order.vessel.imo ?? '—'}</span>
          </span>
        }
        actions={
          !locked && (
            <button
              className="btn primary"
              disabled={blocking.length > 0}
              title={blocking.length ? 'Clear the blocking checks first' : undefined}
              onClick={() => {
                confirmDeclaration(order.id, decl)
                toast('Declaration confirmed')
              }}
            >
              <IconCheck />
              Confirm declaration
            </button>
          )
        }
      />
      <div className="stack">
        {unrouted.length > 0 && (
          <Notice tone="warn">
            {unrouted.length} line{unrouted.length > 1 ? 's have' : ' has'} no route yet.{' '}
            <Link to={`/orders/${order.id}`} className="strong" style={{ textDecoration: 'underline' }}>
              Classify on the order
            </Link>
          </Notice>
        )}
        <div className="routes">
          <RouteCard
            tone="info"
            icon={<IconFile />}
            title="Permit · APS"
            note="Duty-unpaid and dutiable stores. TradeNet OUT, CPC SEASTORE."
            lines={at(aps)}
            currency={order.currency}
          />
          <RouteCard
            tone="accent"
            icon={<IconCheck />}
            title="Statement only"
            note="Duty-paid, not controlled. No permit; monthly statement."
            lines={at(decl.statementOnly)}
            currency={order.currency}
          />
          <RouteCard
            tone="warn"
            icon={<IconShield />}
            title="Authority · DRT"
            note="Controlled items. Approval first, then OUT (DRT)."
            lines={at(drt)}
            currency={order.currency}
          />
          <RouteCard
            tone="neutral"
            icon={<IconX />}
            title="Not sea stores"
            note="Spares for installation. GST applies."
            lines={at(decl.excluded)}
            currency={order.currency}
          />
        </div>
        <div className="split">
          <div className="stack">
            <Rations v={v} locked={locked} />
            <Approvals v={v} locked={locked} />
          </div>
          <div className="stack">
            {locked ? (
              <Filing v={v} />
            ) : (
              <Card title="Before filing" meta={blocking.length ? `${blocking.length} blocking` : 'Ready'}>
                <div className="stack">
                  <IssueList issues={issues} />
                  {!blocking.length && (
                    <p className="small muted">
                      Confirming freezes this split. The TradeNet preview and export use the frozen version.
                    </p>
                  )}
                </div>
              </Card>
            )}
            <Card title="Value" pad={false}>
              <table className="table">
                <tbody>
                  <tr><td>Permit lines</td><td className="r num">{fmtMoney(sumAmount(at(decl.permitLines)), order.currency)}</td></tr>
                  <tr><td>Statement only</td><td className="r num">{fmtMoney(sumAmount(at(decl.statementOnly)), order.currency)}</td></tr>
                  <tr><td>Not sea stores</td><td className="r num">{fmtMoney(sumAmount(at(decl.excluded)), order.currency)}</td></tr>
                  <tr><td className="strong">Order total</td><td className="r num strong">{fmtMoney(decl.lines.reduce((s, l) => s + lineAmount(l), 0), order.currency)}</td></tr>
                </tbody>
              </table>
            </Card>
            <Link to={`/orders/${order.id}`} className="btn ghost">
              Back to order <IconArrowRight />
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}

import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { clearDelivery, recordDelivery } from '../actions'
import { fmtDateTime } from '../format'
import { t } from '../i18n'
import { Badge, Card, Empty, Notice, PageHead, toast } from '../ui'
import { IconCheck, IconTruck } from '../ui/icons'
import { ClassBadge } from '../ui/sg'
import { useOrderView } from './Order'

function localNow(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

/** Record what actually went on board. The monthly statement uses these quantities. */
export default function Delivery() {
  const { id } = useParams()
  const v = useOrderView(id)
  const existing = v?.order.delivery
  const [qty, setQty] = useState<Record<number, number>>(() => existing?.checked ?? Object.fromEntries((v?.decl.lines ?? []).map((l) => [l.idx, l.qty])))
  const [receivedBy, setReceivedBy] = useState(existing?.receivedBy ?? t.delivery.receivedByDefault)
  const [at, setAt] = useState(() => {
    if (!existing) return localNow()
    const d = new Date(existing.at)
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  if (!v) return <Empty title={t.common.orderNotFound} />
  const { order, decl } = v
  const crumbs = [
    { to: '/orders', label: t.nav.orders },
    { to: `/orders/${order.id}`, label: order.ref },
  ]
  if (!order.decl?.confirmedAt)
    return (
      <>
        <PageHead crumbs={crumbs} title={t.delivery.title} />
        <Notice tone="warn">
          {t.delivery.confirmFirst}{' '}
          <Link to={`/orders/${order.id}/declaration`} className="strong" style={{ textDecoration: 'underline' }}>{t.delivery.openDecl}</Link>
        </Notice>
      </>
    )

  const short = decl.lines.filter((l) => (qty[l.idx] ?? l.qty) < l.qty)

  return (
    <>
      <PageHead
        crumbs={crumbs}
        title={t.delivery.title}
        sub={`${order.vessel.name} · ${order.vessel.location ?? t.delivery.noLocation}`}
        actions={existing && <Badge tone="ok" dot>{t.delivery.deliveredAt(fmtDateTime(existing.at))}</Badge>}
      />
      <div className="split">
        <Card title={t.delivery.onBoard} pad={false} meta={t.delivery.onBoardMeta}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t.common.item}</th>
                  <th>{t.common.route}</th>
                  <th className="r">{t.delivery.ordered}</th>
                  <th className="r">{t.delivery.delivered}</th>
                </tr>
              </thead>
              <tbody>
                {decl.lines.map((l) => (
                  <tr key={l.idx}>
                    <td className="muted num">{l.idx}</td>
                    <td>
                      <div className="strong">{l.name ?? l.desc}</div>
                      <div className="small muted">{l.spec}</div>
                    </td>
                    <td title={l.sgClass ? t.sgClass[l.sgClass].route : undefined}><ClassBadge value={l.sgClass} /></td>
                    <td className="r num">{l.qty} <span className="small muted">{l.unit}</span></td>
                    <td className="r">
                      <input
                        className="input num"
                        style={{ width: 90 }}
                        type="number"
                        min={0}
                        max={l.qty}
                        aria-label={t.delivery.qtyLabel(l.idx)}
                        value={qty[l.idx] ?? l.qty}
                        onChange={(e) => setQty((q) => ({ ...q, [l.idx]: Math.min(l.qty, Math.max(0, Number(e.target.value))) }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title={<div className="row"><IconTruck /><h2>{t.delivery.signOff}</h2></div>}>
          <div className="stack">
            <label className="field">
              <span>{t.delivery.receivedBy}</span>
              <input className="input" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
            </label>
            <label className="field">
              <span>{t.delivery.at}</span>
              <input className="input" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
            </label>
            {short.length > 0 && (
              <Notice tone="warn">
                {t.delivery.short(short.length)}
              </Notice>
            )}
            <button
              className="btn primary lg"
              disabled={!receivedBy.trim() || !at}
              onClick={() => {
                recordDelivery(order.id, { at: new Date(at).toISOString(), receivedBy: receivedBy.trim(), checked: qty })
                toast(t.delivery.recorded)
              }}
            >
              <IconCheck />
              {existing ? t.delivery.update : t.delivery.record}
            </button>
            {existing && (
              <button className="btn ghost sm" onClick={() => confirm(t.delivery.removeConfirm) && clearDelivery(order.id)}>
                {t.delivery.remove}
              </button>
            )}
          </div>
        </Card>
      </div>
    </>
  )
}

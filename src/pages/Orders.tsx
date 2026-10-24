import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { headline, STATUS_INFO, viewOrder, type OrderView } from '../derive'
import { fmtDateTime, fmtMoney } from '../format'
import { sumAmount, VESSEL_TYPE_LABEL } from '../sg'
import { useStore } from '../store'
import type { OrderStatus, State } from '../types'
import { Badge, Card, Empty, Flag, PageHead } from '../ui'
import { IconPlus } from '../ui/icons'
import Intake from './Intake'

type Filter = 'all' | OrderStatus

export function useOrderViews(): OrderView[] {
  const state = useStore((s) => s)
  return useMemo(() => allViews(state), [state])
}

export function allViews(s: State): OrderView[] {
  return [...s.orders].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)).map((o) => viewOrder(s, o))
}

export function OrderTable({ views, compact }: { views: OrderView[]; compact?: boolean }) {
  const agencies = useStore((s) => s.agencies)
  const navigate = useNavigate()
  if (!views.length) return <Empty title="Nothing here">Orders you add will show up in this list.</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Vessel</th>
            {!compact && <th>Agency</th>}
            <th>Received</th>
            <th className="r">Lines</th>
            {!compact && <th className="r">Value</th>}
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => {
            const o = v.order
            const st = STATUS_INFO[v.status]
            return (
              <tr key={o.id} className="link" onClick={() => navigate(`/orders/${o.id}`)}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Flag code={o.jurisdiction} />
                    <span className="strong">{o.vessel.name || 'Unnamed vessel'}</span>
                  </div>
                  <div className="small muted">
                    <span className="mono">{o.ref}</span>
                    {o.vessel.type && ` · ${VESSEL_TYPE_LABEL[o.vessel.type]}`}
                    {o.vessel.location && ` · ${o.vessel.location}`}
                  </div>
                </td>
                {!compact && <td className="small">{agencies.find((a) => a.id === o.agencyId)?.name ?? '—'}</td>}
                <td className="small muted num">{fmtDateTime(o.receivedAt)}</td>
                <td className="r num">{o.lines.length}</td>
                {!compact && <td className="r num">{fmtMoney(sumAmount(v.lines), o.currency)}</td>}
                <td>
                  <div className="row wrap" style={{ gap: 6 }}>
                    <Badge tone={st.tone} dot>{st.label}</Badge>
                    {headline(v).map((h) => (
                      <Badge key={h.label} tone={h.tone}>{h.label}</Badge>
                    ))}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'review', label: 'Needs attention' },
  { key: 'ready', label: 'Ready' },
  { key: 'filed', label: 'Filed' },
  { key: 'delivered', label: 'Delivered' },
]

export default function Orders() {
  const views = useOrderViews()
  const [filter, setFilter] = useState<Filter>('all')
  const [intake, setIntake] = useState(false)
  const shown = filter === 'all' ? views : views.filter((v) => v.status === filter)
  return (
    <>
      <PageHead
        title="Orders"
        sub="Stores orders from ship agencies, split into Singapore Customs routes."
        actions={
          <button className="btn primary" onClick={() => setIntake(true)}>
            <IconPlus />
            New order
          </button>
        }
      />
      <Card
        pad={false}
        title={
          <div className="seg" role="tablist">
            {FILTERS.map((f) => {
              const n = f.key === 'all' ? views.length : views.filter((v) => v.status === f.key).length
              return (
                <button key={f.key} role="tab" aria-selected={filter === f.key} className={filter === f.key ? 'on' : ''} onClick={() => setFilter(f.key)}>
                  {f.label} <span className="faint num">{n}</span>
                </button>
              )
            })}
          </div>
        }
      >
        <OrderTable views={shown} />
      </Card>
      {intake && <Intake onClose={() => setIntake(false)} />}
    </>
  )
}

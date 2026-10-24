import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { headline, statusInfo, viewOrder, type OrderView } from '../derive'
import { fmtDateTime, fmtMoney } from '../format'
import { t } from '../i18n'
import { sumAmount } from '../sg'
import { useStore } from '../store'
import type { State } from '../types'
import { Badge, Card, Empty, Flag, PageHead } from '../ui'
import { IconPlus } from '../ui/icons'
import Intake from './Intake'

type Filter = (typeof FILTERS)[number]

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
  if (!views.length) return <Empty title={t.orders.emptyTitle}>{t.orders.empty}</Empty>
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>{t.orders.vessel}</th>
            {!compact && <th>{t.orders.agency}</th>}
            <th>{t.orders.received}</th>
            <th className="r">{t.orders.lines}</th>
            {!compact && <th className="r">{t.common.value}</th>}
            <th>{t.orders.status}</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => {
            const o = v.order
            const st = statusInfo(v.status)
            return (
              <tr key={o.id} className="link" onClick={() => navigate(`/orders/${o.id}`)}>
                <td>
                  <div className="row" style={{ gap: 8 }}>
                    <Flag code={o.jurisdiction} />
                    <span className="strong">{o.vessel.name || t.common.unnamedVessel}</span>
                  </div>
                  <div className="small muted">
                    <span className="mono">{o.ref}</span>
                    {o.vessel.type && ` · ${t.vesselType[o.vessel.type]}`}
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

const FILTERS = ['all', 'review', 'ready', 'filed', 'delivered'] as const

export default function Orders() {
  const views = useOrderViews()
  const [filter, setFilter] = useState<Filter>('all')
  const [intake, setIntake] = useState(false)
  const shown = filter === 'all' ? views : views.filter((v) => v.status === filter)
  return (
    <>
      <PageHead
        title={t.orders.title}
        sub={t.orders.sub}
        actions={
          <button className="btn primary" onClick={() => setIntake(true)}>
            <IconPlus />
            {t.orders.newOrder}
          </button>
        }
      />
      <Card
        pad={false}
        title={
          <div className="seg" role="tablist">
            {FILTERS.map((f) => {
              const n = f === 'all' ? views.length : views.filter((v) => v.status === f).length
              return (
                <button key={f} role="tab" aria-selected={filter === f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>
                  {t.orders.filters[f]} <span className="faint num">{n}</span>
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

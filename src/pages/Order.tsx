import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addProposals, deleteOrder, updateVessel } from '../actions'
import { headline, STATUS_INFO, viewOrder, type OrderView } from '../derive'
import { fmtDateTime, fmtMoney } from '../format'
import { proposeFor } from '../lib/propose'
import { lineAmount, sumAmount, VESSEL_TYPE_LABEL, type Issue } from '../sg'
import { useStore } from '../store'
import type { ResolvedLine, VesselInfo, VesselType } from '../types'
import { Badge, Card, Empty, Flag, Notice, PageHead, toast } from '../ui'
import { IconAlert, IconArrowRight, IconCheck, IconShip, IconSparkle, IconTrash } from '../ui/icons'
import { ClassBadge } from '../ui/sg'
import ProposalCard from './ProposalCard'

export function useOrderView(id: string | undefined): OrderView | undefined {
  const state = useStore((s) => s)
  return useMemo(() => {
    const o = state.orders.find((x) => x.id === id)
    return o && viewOrder(state, o)
  }, [state, id])
}

export function LinesTable({ lines, currency, actions }: {
  lines: ResolvedLine[]
  currency: 'SGD' | 'USD'
  actions?: (l: ResolvedLine) => ReactNode
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th style={{ width: 36 }}>#</th>
            <th>Order line → declared as</th>
            <th>Route</th>
            <th className="r">Qty</th>
            <th className="r">Amount</th>
            {actions && <th />}
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.idx}>
              <td className="muted num">{l.idx}</td>
              <td>
                <div className="mono small muted">{l.desc}</div>
                {l.name ? (
                  <div className="strong">
                    {l.name} <span className="muted" style={{ fontWeight: 400 }}>· {l.spec}</span>
                  </div>
                ) : (
                  <div className="small" style={{ color: 'var(--bad)' }}>No rule yet</div>
                )}
              </td>
              <td>
                <div className="row wrap" style={{ gap: 6 }}>
                  <ClassBadge value={l.sgClass} />
                  {l.state === 'proposed' && <Badge tone="info">Suggested</Badge>}
                </div>
              </td>
              <td className="r num">
                {l.qty} <span className="muted small">{l.unit ?? l.orderUnit}</span>
              </td>
              <td className="r num">{l.unitPrice !== undefined ? fmtMoney(lineAmount(l), currency) : '—'}</td>
              {actions && <td className="r">{actions(l)}</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            <td colSpan={3} className="strong">Total</td>
            <td className="r num strong">{fmtMoney(sumAmount(lines), currency)}</td>
            {actions && <td />}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

const TYPES = Object.keys(VESSEL_TYPE_LABEL) as VesselType[]

export function VesselCard({ orderId, vessel, locked }: { orderId: string; vessel: VesselInfo; locked?: boolean }) {
  const set = (patch: Partial<VesselInfo>) => updateVessel(orderId, patch)
  const num = (v: string) => (v === '' ? undefined : Math.max(0, Number(v)))
  return (
    <Card title={<div className="row"><IconShip /><h2>Vessel</h2></div>} meta={locked ? 'Locked after filing' : 'From the email · editable'}>
      <fieldset disabled={locked} style={{ border: 0, padding: 0, margin: 0 }} className="stack">
        <label className="field">
          <span>Name</span>
          <input className="input" value={vessel.name} onChange={(e) => set({ name: e.target.value.toUpperCase() })} />
        </label>
        <div className="grid cols-2" style={{ gap: 12 }}>
          <label className="field">
            <span>IMO</span>
            <input className="input mono" value={vessel.imo ?? ''} onChange={(e) => set({ imo: e.target.value.replace(/\D/g, '').slice(0, 7) || undefined })} />
          </label>
          <label className="field">
            <span>Flag</span>
            <input className="input" value={vessel.flag ?? ''} onChange={(e) => set({ flag: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Type</span>
            <select className="select" value={vessel.type ?? ''} onChange={(e) => set({ type: (e.target.value || undefined) as VesselType | undefined })}>
              <option value="">Unknown</option>
              {TYPES.map((t) => (
                <option key={t} value={t}>{VESSEL_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Location</span>
            <input className="input" value={vessel.location ?? ''} onChange={(e) => set({ location: e.target.value || undefined })} />
          </label>
          <label className="field">
            <span>Crew</span>
            <input className="input num" type="number" min={0} value={vessel.crew ?? ''} onChange={(e) => set({ crew: num(e.target.value) })} />
          </label>
          <label className="field">
            <span>Voyage days</span>
            <input className="input num" type="number" min={0} value={vessel.voyageDays ?? ''} onChange={(e) => set({ voyageDays: num(e.target.value) })} />
          </label>
        </div>
      </fieldset>
    </Card>
  )
}

export function IssueList({ issues }: { issues: Issue[] }) {
  if (!issues.length)
    return (
      <div className="row" style={{ color: 'var(--ok)' }}>
        <IconCheck />
        <span className="strong">All checks passed</span>
      </div>
    )
  return (
    <ul className="issues">
      {issues.map((i) => (
        <li key={i.code} className={i.level}>
          <IconAlert size={15} />
          <div>
            {i.message}
            {i.lines && <span className="muted small"> Lines {i.lines.join(', ')}</span>}
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Lines without a rule: ask for suggestions, then approve them one by one. */
function Classify({ v }: { v: OrderView }) {
  const products = useStore((s) => s.products)
  const proposals = useStore((s) => s.proposals)
  const rules = useStore((s) => s.rules)
  const [busy, setBusy] = useState(false)
  const unknown = v.lines.filter((l) => l.state === 'unknown')
  const pending = proposals.filter((p) => p.status === 'pending' && p.orderId === v.order.id && v.lines.some((l) => l.proposalId === p.id))
  if (!unknown.length && !pending.length) return null

  async function suggest() {
    setBusy(true)
    try {
      const out = await proposeFor(v.order, unknown, products, rules)
      addProposals(out.proposals)
      toast(out.source === 'ai' ? 'Suggestions ready — review before approving' : `Offline suggestions (${out.fallbackReason}) — review before approving`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card
      title={<div className="row"><IconSparkle /><h2>Classification</h2></div>}
      meta={unknown.length ? `${unknown.length} line${unknown.length > 1 ? 's' : ''} without a rule` : `${pending.length} to approve`}
      actions={
        unknown.length ? (
          <button className="btn sm primary" onClick={suggest} disabled={busy}>
            <IconSparkle size={14} />
            {busy ? 'Thinking…' : 'Suggest classification'}
          </button>
        ) : undefined
      }
    >
      <div className="stack">
        {unknown.length > 0 && !pending.length && (
          <p className="muted">
            Bearing has no rule for {unknown.map((l) => <code key={l.idx}>{l.desc}</code>).reduce<ReactNode[]>((a, c, i) => (i ? [...a, ', ', c] : [c]), [])}.
            Get a suggested route with its reasoning, then approve it once.
          </p>
        )}
        {pending.map((p) => (
          <ProposalCard key={p.id} proposal={p} />
        ))}
      </div>
    </Card>
  )
}

export default function OrderPage() {
  const { id } = useParams()
  const v = useOrderView(id)
  const agencies = useStore((s) => s.agencies)
  const navigate = useNavigate()
  if (!v) return <Empty title="Order not found"><Link to="/orders" className="btn" style={{ marginTop: 12 }}>Back to orders</Link></Empty>
  const o = v.order
  const st = STATUS_INFO[v.status]
  const filed = !!o.decl?.confirmedAt
  return (
    <>
      <PageHead
        crumbs={[{ to: '/orders', label: 'Orders' }]}
        title={
          <span className="row" style={{ gap: 12 }}>
            {o.vessel.name || 'Unnamed vessel'}
            <Badge tone={st.tone} dot>{st.label}</Badge>
          </span>
        }
        sub={
          <span className="row wrap" style={{ gap: 8 }}>
            <Flag code={o.jurisdiction} />
            <span className="mono">{o.ref}</span>·<span>{agencies.find((a) => a.id === o.agencyId)?.name}</span>·<span>{fmtDateTime(o.receivedAt)}</span>
          </span>
        }
        actions={
          <>
            {!filed && (
              <button
                className="btn ghost danger"
                onClick={() => {
                  if (confirm(`Delete ${o.ref}?`)) {
                    deleteOrder(o.id)
                    navigate('/orders')
                  }
                }}
              >
                <IconTrash />
                Delete
              </button>
            )}
            <Link to={`/orders/${o.id}/declaration`} className="btn primary">
              {filed ? 'View declaration' : 'Prepare declaration'}
              <IconArrowRight />
            </Link>
          </>
        }
      />
      <div className="split">
        <div className="stack">
          {!filed && (
            <Notice tone={o.readSource === 'ai' ? 'ok' : 'info'}>
              {o.readSource === 'ai' ? 'Read by AI. Quantities are copied from the email, never calculated.' : 'Read with the offline reader. Check the vessel details and lines against the email.'}
            </Notice>
          )}
          {!filed && <Classify v={v} />}
          <Card title="Lines" meta={`${o.lines.length} lines · ${fmtMoney(sumAmount(v.lines), o.currency)}`} pad={false}>
            <LinesTable lines={v.lines} currency={o.currency} />
          </Card>
          <Card title="Original email" pad={false}>
            <pre className="email">{o.raw}</pre>
          </Card>
        </div>
        <div className="stack">
          <Card title="Before filing" meta={headline(v).length ? `${v.blocking.length} blocking` : undefined}>
            <IssueList issues={v.issues} />
          </Card>
          <VesselCard orderId={o.id} vessel={o.vessel} locked={filed} />
        </div>
      </div>
    </>
  )
}

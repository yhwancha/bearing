import { useState } from 'react'
import { approveProposal, rejectProposal } from '../actions'
import { isDutiable, RATION_LIMITS, SG_CLASS_INFO, SG_CLASSES } from '../sg'
import { useStore } from '../store'
import type { Proposal, RationKind, SgClass } from '../types'
import { Badge, toast } from '../ui'
import { IconCheck, IconSparkle, IconX } from '../ui/icons'
import { ClassBadge } from '../ui/sg'

const KINDS = Object.keys(RATION_LIMITS) as RationKind[]

/** A suggested classification the user edits and approves into a rule. */
export default function ProposalCard({ proposal }: { proposal: Proposal }) {
  const agency = useStore((s) => s.agencies.find((a) => a.id === proposal.agencyId))
  const linked = useStore((s) => s.products.find((p) => p.id === proposal.productId))
  const [d, setD] = useState(proposal.draft)
  const [pattern, setPattern] = useState(proposal.pattern.join(' '))
  const [scope, setScope] = useState<'agency' | 'all'>('all')
  const set = (patch: Partial<Proposal['draft']>) => setD((x) => ({ ...x, ...patch }))
  const tokens = pattern.toUpperCase().split(/\s+/).filter(Boolean)

  function setClass(c: SgClass) {
    set({
      sgClass: c,
      rationKind: isDutiable(c) ? d.rationKind ?? (c === 'dutiable_tobacco' ? 'cigarettes' : 'spirits') : undefined,
      rationUnitQty: isDutiable(c) ? d.rationUnitQty ?? 1 : undefined,
      controlAuthority: c === 'controlled' ? d.controlAuthority ?? '' : undefined,
    })
  }

  return (
    <article className="proposal">
      <header className="row wrap">
        <span className="mono strong">{proposal.desc}</span>
        <span className="spacer" />
        <Badge tone={proposal.source === 'ai' ? 'violet' : 'outline'}>
          <IconSparkle size={12} />
          {proposal.source === 'ai' ? 'AI suggestion' : 'Offline suggestion'}
        </Badge>
      </header>

      <div className="proposal-why">
        <ClassBadge value={d.sgClass} />
        <p>{proposal.rationale}</p>
      </div>

      {linked && <p className="small muted">Links to catalog item <span className="mono">{linked.sku}</span>. Approving updates that product.</p>}

      <div className="grid cols-3" style={{ gap: 12 }}>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>Route</span>
          <select className="select" value={d.sgClass ?? ''} onChange={(e) => setClass(e.target.value as SgClass)}>
            {SG_CLASSES.map((c) => (
              <option key={c} value={c}>{SG_CLASS_INFO[c].label} — {SG_CLASS_INFO[c].route}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>HS code</span>
          <input className="input mono" value={d.hs} placeholder="0000.00" onChange={(e) => set({ hs: e.target.value })} />
        </label>
        <label className="field">
          <span>Declared name</span>
          <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Pack</span>
          <input className="input" value={d.spec} onChange={(e) => set({ spec: e.target.value })} />
        </label>
        <label className="field">
          <span>Unit</span>
          <input className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>Unit price (SGD)</span>
          <input className="input num" type="number" min={0} step="0.01" value={d.price ?? ''} onChange={(e) => set({ price: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </label>
        {d.sgClass === 'controlled' && (
          <label className="field" style={{ gridColumn: 'span 3' }}>
            <span>Competent Authority</span>
            <input className="input" value={d.controlAuthority ?? ''} placeholder="e.g. SPF Arms & Explosives" onChange={(e) => set({ controlAuthority: e.target.value })} />
          </label>
        )}
        {isDutiable(d.sgClass) && (
          <>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Ration</span>
              <select className="select" value={d.rationKind ?? ''} onChange={(e) => set({ rationKind: e.target.value as RationKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{RATION_LIMITS[k].label} — {RATION_LIMITS[k].perDay} {RATION_LIMITS[k].unit} per crew per day</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{d.rationKind ? RATION_LIMITS[d.rationKind].unit : 'Units'} per {d.unit || 'unit'}</span>
              <input className="input num" type="number" min={0} value={d.rationUnitQty ?? ''} onChange={(e) => set({ rationUnitQty: Number(e.target.value) || undefined })} />
            </label>
          </>
        )}
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>Match wording <span className="hint">· keywords in order</span></span>
          <input className="input mono" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        </label>
        <label className="field">
          <span>Applies to</span>
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value as 'agency' | 'all')}>
            <option value="all">All agencies</option>
            <option value="agency">{agency?.name ?? 'This agency'} only</option>
          </select>
        </label>
      </div>

      <footer className="row">
        <span className="small muted">Approved rules apply to future orders without AI.</span>
        <span className="spacer" />
        <button className="btn sm" onClick={() => rejectProposal(proposal.id)}>
          <IconX size={14} />
          Reject
        </button>
        <button
          className="btn sm accent"
          disabled={!tokens.length || !d.name.trim() || !d.sgClass}
          onClick={() => {
            approveProposal(proposal.id, d, tokens, scope)
            toast('Rule saved — applies to future orders automatically')
          }}
        >
          <IconCheck size={14} />
          Approve
        </button>
      </footer>
    </article>
  )
}

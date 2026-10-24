import { useState } from 'react'
import { approveProposal, rejectProposal } from '../actions'
import { t } from '../i18n'
import { isDutiable, RATION_LIMITS, SG_CLASSES } from '../sg'
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
          {proposal.source === 'ai' ? t.proposal.ai : t.proposal.offline}
        </Badge>
      </header>

      <div className="proposal-why">
        <ClassBadge value={d.sgClass} />
        <p>{proposal.rationale}</p>
      </div>

      {linked && <p className="small muted">{t.proposal.linksTo} <span className="mono">{linked.sku}</span>{t.proposal.linksToAfter}</p>}

      <div className="grid cols-3" style={{ gap: 12 }}>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>{t.common.route}</span>
          <select className="select" value={d.sgClass ?? ''} onChange={(e) => setClass(e.target.value as SgClass)}>
            {SG_CLASSES.map((c) => (
              <option key={c} value={c}>{t.sgClass[c].label} — {t.sgClass[c].route}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t.common.hsCode}</span>
          <input className="input mono" value={d.hs} placeholder="0000.00" onChange={(e) => set({ hs: e.target.value })} />
        </label>
        <label className="field">
          <span>{t.common.declaredName}</span>
          <input className="input" value={d.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>{t.common.pack}</span>
          <input className="input" value={d.spec} onChange={(e) => set({ spec: e.target.value })} />
        </label>
        <label className="field">
          <span>{t.common.unit}</span>
          <input className="input" value={d.unit} onChange={(e) => set({ unit: e.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>{t.common.unitPrice}</span>
          <input className="input num" type="number" min={0} step="0.01" value={d.price ?? ''} onChange={(e) => set({ price: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </label>
        {d.sgClass === 'controlled' && (
          <label className="field" style={{ gridColumn: 'span 3' }}>
            <span>{t.common.competentAuthority}</span>
            <input className="input" value={d.controlAuthority ?? ''} placeholder={t.common.caPlaceholder} onChange={(e) => set({ controlAuthority: e.target.value })} />
          </label>
        )}
        {isDutiable(d.sgClass) && (
          <>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>{t.common.ration}</span>
              <select className="select" value={d.rationKind ?? ''} onChange={(e) => set({ rationKind: e.target.value as RationKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{t.common.rationPerDay(t.ration[k].label, RATION_LIMITS[k].perDay, t.ration[k].unit)}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t.common.unitsPer(d.rationKind && t.ration[d.rationKind].unit, d.unit)}</span>
              <input className="input num" type="number" min={0} value={d.rationUnitQty ?? ''} onChange={(e) => set({ rationUnitQty: Number(e.target.value) || undefined })} />
            </label>
          </>
        )}
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>{t.proposal.match} <span className="hint">{t.proposal.matchHint}</span></span>
          <input className="input mono" value={pattern} onChange={(e) => setPattern(e.target.value)} />
        </label>
        <label className="field">
          <span>{t.proposal.appliesTo}</span>
          <select className="select" value={scope} onChange={(e) => setScope(e.target.value as 'agency' | 'all')}>
            <option value="all">{t.proposal.allAgencies}</option>
            <option value="agency">{t.proposal.onlyAgency(agency?.name)}</option>
          </select>
        </label>
      </div>

      <footer className="row">
        <span className="small muted">{t.proposal.foot}</span>
        <span className="spacer" />
        <button className="btn sm" onClick={() => rejectProposal(proposal.id)}>
          <IconX size={14} />
          {t.common.reject}
        </button>
        <button
          className="btn sm accent"
          disabled={!tokens.length || !d.name.trim() || !d.sgClass}
          onClick={() => {
            approveProposal(proposal.id, d, tokens, scope)
            toast(t.proposal.saved)
          }}
        >
          <IconCheck size={14} />
          {t.common.approve}
        </button>
      </footer>
    </article>
  )
}

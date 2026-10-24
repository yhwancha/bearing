/* Singapore Customs rules for sea stores. Pure functions: every number on the
   declaration (limits, totals, amounts) is computed here, never by the model.
   Source: customs.gov.sg — Supply of Air/Sea Stores (checked 24 Oct 2026). */

import { fmtNum } from './format'
import { t } from './i18n'
import type { Order, PermitGroup, RationCheck, RationKind, ResolvedLine, SgClass, SgDeclaration, VesselInfo, VesselType } from './types'

/** Duty-free ration per crew member per day, in ration units. Labels here are the English
    wording used on customs documents; the UI reads `t.ration`. */
export const RATION_LIMITS: Record<RationKind, { perDay: number; unit: string; label: string }> = {
  cigarettes: { perDay: 40, unit: 'sticks', label: 'Cigarettes' },
  tobacco: { perDay: 15, unit: 'g', label: 'Smoking tobacco' },
  cigars: { perDay: 3, unit: 'sticks', label: 'Cigars & cheroots' },
  spirits: { perDay: 0.25, unit: 'bottles', label: 'Spirits' },
  wine: { perDay: 0.25, unit: 'bottles', label: 'Wine' },
  beer: { perDay: 4, unit: 'cans', label: 'Beer & stout' },
}

/** Vessel types allowed to take dutiable sea stores (liquor and tobacco). */
export const APPROVED_VESSEL_TYPES: VesselType[] = ['passenger', 'cargo', 'oil_rig', 'dredge', 'fishing', 'supply', 'tug']

export const VESSEL_TYPES: VesselType[] = ['cargo', 'passenger', 'oil_rig', 'dredge', 'fishing', 'supply', 'tug', 'other']

export const SG_CLASSES: SgClass[] = [
  'sea_store_paid', 'sea_store_unpaid', 'dutiable_liquor', 'dutiable_tobacco', 'controlled', 'ship_spare_install',
]

export function isDutiable(c: SgClass | undefined): boolean {
  return c === 'dutiable_liquor' || c === 'dutiable_tobacco'
}

/** Rule first, then product — resolveLines already merged both onto the line. */
export function resolveSgClass(line: ResolvedLine): SgClass | undefined {
  return line.sgClass
}

/** true / false, or undefined when the vessel type is unknown. */
export function vesselAllowsDutiable(v: VesselInfo): boolean | undefined {
  if (!v.type) return undefined
  return APPROVED_VESSEL_TYPES.includes(v.type)
}

export function rationUnits(line: ResolvedLine): number {
  return line.qty * (line.rationUnitQty ?? 1)
}

/** Compare requested dutiable quantities with crew × voyage days × daily ration. */
export function checkRations(lines: ResolvedLine[], v: VesselInfo): RationCheck[] {
  const byKind = new Map<RationKind, ResolvedLine[]>()
  for (const l of lines) {
    if (!isDutiable(l.sgClass) || !l.rationKind) continue
    byKind.set(l.rationKind, [...(byKind.get(l.rationKind) ?? []), l])
  }
  const crewDays = (v.crew ?? 0) * (v.voyageDays ?? 0)
  return [...byKind.entries()].map(([kind, ls]) => {
    const requested = round(ls.reduce((s, l) => s + rationUnits(l), 0))
    const allowed = round(crewDays * RATION_LIMITS[kind].perDay)
    return { kind, requested, allowed, ok: requested <= allowed, lines: ls.map((l) => l.idx) }
  })
}

/** Split an order into the Singapore filing routes. */
export function splitSgDeclaration(lines: ResolvedLine[], v: VesselInfo, caChecks: Record<string, boolean> = {}): SgDeclaration {
  const aps: number[] = []
  const drt: number[] = []
  const statementOnly: number[] = []
  const excluded: number[] = []
  const checks: Record<string, boolean> = {}
  for (const l of lines) {
    switch (resolveSgClass(l)) {
      case 'sea_store_paid':
        statementOnly.push(l.idx)
        break
      case 'sea_store_unpaid':
      case 'dutiable_liquor':
      case 'dutiable_tobacco':
        aps.push(l.idx)
        break
      case 'controlled': {
        drt.push(l.idx)
        const ca = l.controlAuthority?.trim() || 'Competent Authority'
        checks[ca] = caChecks[ca] ?? false
        break
      }
      case 'ship_spare_install':
        excluded.push(l.idx)
        break
      default:
        break
    }
  }
  const permits: PermitGroup[] = []
  if (aps.length) permits.push({ declarationType: 'APS', lines: aps })
  if (drt.length) permits.push({ declarationType: 'DRT', lines: drt })
  return {
    lines,
    permitLines: [...aps, ...drt],
    statementOnly,
    excluded,
    caChecks: checks,
    rations: checkRations(lines, v),
    messageType: 'OUT',
    permits,
  }
}

export interface Issue {
  level: 'block' | 'warn'
  code: string
  message: string
  lines?: number[]
}

/** Checks to clear before filing. Blocking issues stop the declaration from being confirmed. */
export function sgPreflight(decl: SgDeclaration, v: VesselInfo): Issue[] {
  const issues: Issue[] = []
  const unclassified = decl.lines.filter((l) => !l.sgClass && l.state !== 'proposed').map((l) => l.idx)
  const pending = decl.lines.filter((l) => l.state === 'proposed').map((l) => l.idx)
  const dutiable = decl.lines.filter((l) => isDutiable(l.sgClass))

  if (unclassified.length) issues.push({ level: 'block', code: 'unclassified', message: t.issue.unclassified(unclassified.length), lines: unclassified })
  if (pending.length) issues.push({ level: 'block', code: 'pending', message: t.issue.pending(pending.length), lines: pending })
  if (!v.name) issues.push({ level: 'block', code: 'vessel_name', message: t.issue.vesselName })
  if (!v.flag) issues.push({ level: 'block', code: 'flag', message: t.issue.flag })

  if (dutiable.length) {
    const allowed = vesselAllowsDutiable(v)
    const idx = dutiable.map((l) => l.idx)
    if (allowed === undefined) issues.push({ level: 'block', code: 'vessel_type', message: t.issue.vesselType, lines: idx })
    else if (!allowed) issues.push({ level: 'block', code: 'vessel_not_approved', message: t.issue.vesselNotApproved, lines: idx })
    if (!v.crew || !v.voyageDays) issues.push({ level: 'block', code: 'crew_days', message: t.issue.crewDays, lines: idx })
    const noRation = dutiable.filter((l) => !l.rationKind).map((l) => l.idx)
    if (noRation.length) issues.push({ level: 'block', code: 'ration_kind', message: t.issue.rationKind(noRation.length), lines: noRation })
  }

  for (const r of decl.rations) {
    if (!r.ok && v.crew && v.voyageDays) {
      const lim = RATION_LIMITS[r.kind]
      const ui = t.ration[r.kind]
      issues.push({
        level: 'block',
        code: `ration_${r.kind}`,
        message: t.issue.ration(ui.label, fmtNum(r.requested), fmtNum(r.allowed), ui.unit, v.crew, v.voyageDays, lim.perDay),
        lines: r.lines,
      })
    }
  }

  const unapproved = Object.entries(decl.caChecks).filter(([, ok]) => !ok).map(([ca]) => ca)
  if (unapproved.length) issues.push({ level: 'block', code: 'ca', message: t.issue.ca(unapproved.join(', ')) })

  if (decl.permits.length) {
    // Particulars Singapore Customs requires on every sea-stores permit
    if (!v.nrt) issues.push({ level: 'block', code: 'nrt', message: t.issue.nrt })
    if (!v.nextPort) issues.push({ level: 'block', code: 'next_port', message: t.issue.nextPort })
    if (!v.finalPort) issues.push({ level: 'block', code: 'final_port', message: t.issue.finalPort })
    if (!v.voyageNo) issues.push({ level: 'warn', code: 'voyage_no', message: t.issue.voyageNo })
    if (!v.departure) issues.push({ level: 'warn', code: 'departure', message: t.issue.departure })
    // Each permit item carries its HS code and country of origin
    const bare = decl.lines.filter((l) => decl.permitLines.includes(l.idx) && l.sgClass && (!l.hs || !l.origin)).map((l) => l.idx)
    if (bare.length) issues.push({ level: 'block', code: 'item_fields', message: t.issue.itemFields(bare.length), lines: bare })
  }

  if (decl.excluded.length) issues.push({ level: 'warn', code: 'install', message: t.issue.install(decl.excluded.length), lines: decl.excluded })
  if (!v.imo) issues.push({ level: 'warn', code: 'imo', message: t.issue.imo })
  return issues
}

export function lineAmount(l: ResolvedLine): number {
  return round(l.qty * (l.unitPrice ?? 0))
}

export function sumAmount(lines: ResolvedLine[]): number {
  return round(lines.reduce((s, l) => s + lineAmount(l), 0))
}

export interface StatementRow {
  vessel: string
  imo?: string
  flag?: string
  orders: string[]
  deliveredOn: string[]
  items: { name: string; spec: string; unit: string; qty: number; value: number }[]
  total: number
}

/** Monthly Statement of Stores Supplied to Vessels: delivered, statement-only lines grouped by vessel. */
export function monthlyStatement(orders: Order[], month: string): StatementRow[] {
  const rows = new Map<string, StatementRow>()
  for (const o of orders) {
    if (!o.decl || !o.delivery || !o.delivery.at.startsWith(month)) continue
    const key = o.vessel.imo || o.vessel.name
    const row = rows.get(key) ?? { vessel: o.vessel.name, imo: o.vessel.imo, flag: o.vessel.flag, orders: [], deliveredOn: [], items: [], total: 0 }
    row.orders.push(o.ref)
    row.deliveredOn.push(o.delivery.at)
    for (const idx of o.decl.statementOnly) {
      const l = o.decl.lines.find((x) => x.idx === idx)
      if (!l) continue
      const qty = o.delivery.checked[idx] ?? l.qty
      if (qty <= 0) continue
      const name = l.name ?? l.desc
      const existing = row.items.find((i) => i.name === name && i.spec === (l.spec ?? ''))
      const value = round(qty * (l.unitPrice ?? 0))
      if (existing) {
        existing.qty += qty
        existing.value = round(existing.value + value)
      } else row.items.push({ name, spec: l.spec ?? '', unit: l.unit ?? l.orderUnit, qty, value })
      row.total = round(row.total + value)
    }
    rows.set(key, row)
  }
  return [...rows.values()].filter((r) => r.items.length).sort((a, b) => a.vessel.localeCompare(b.vessel))
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

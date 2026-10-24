/* Singapore Customs rules for sea stores. Pure functions: every number on the
   declaration (limits, totals, amounts) is computed here, never by the model.
   Source: customs.gov.sg — Supply of Air/Sea Stores (checked 24 Oct 2026). */

import type { Order, PermitGroup, RationCheck, RationKind, ResolvedLine, SgClass, SgDeclaration, VesselInfo, VesselType } from './types'

/** Duty-free ration per crew member per day, in ration units. */
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

export const SG_CLASSES: SgClass[] = [
  'sea_store_paid', 'sea_store_unpaid', 'dutiable_liquor', 'dutiable_tobacco', 'controlled', 'ship_spare_install',
]

export const SG_CLASS_INFO: Record<SgClass, { label: string; short: string; route: string }> = {
  sea_store_paid: { label: 'Sea store · duty paid', short: 'Duty paid', route: 'No permit. Report on the monthly statement.' },
  sea_store_unpaid: { label: 'Sea store · duty unpaid', short: 'Duty unpaid', route: 'TradeNet OUT permit (APS).' },
  dutiable_liquor: { label: 'Dutiable · liquor', short: 'Liquor', route: 'APS permit, approved vessel, daily ration.' },
  dutiable_tobacco: { label: 'Dutiable · tobacco', short: 'Tobacco', route: 'APS permit, approved vessel, daily ration.' },
  controlled: { label: 'Controlled item', short: 'Controlled', route: 'Competent Authority approval, then OUT (DRT).' },
  ship_spare_install: { label: 'Spare for installation', short: 'Install', route: 'Not sea stores. GST applies.' },
}

export const VESSEL_TYPE_LABEL: Record<VesselType, string> = {
  cargo: 'Cargo', passenger: 'Passenger', oil_rig: 'Oil rig', dredge: 'Dredger', fishing: 'Fishing', supply: 'Supply boat', tug: 'Tug', other: 'Other',
}

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

  if (unclassified.length) issues.push({ level: 'block', code: 'unclassified', message: `${plural(unclassified.length, 'line')} not classified yet.`, lines: unclassified })
  if (pending.length) issues.push({ level: 'block', code: 'pending', message: `${plural(pending.length, 'suggested classification')} waiting for approval.`, lines: pending })
  if (!v.name) issues.push({ level: 'block', code: 'vessel_name', message: 'Vessel name is missing.' })
  if (!v.flag) issues.push({ level: 'block', code: 'flag', message: 'Vessel nationality (flag) is required on a sea-stores permit.' })

  if (dutiable.length) {
    const allowed = vesselAllowsDutiable(v)
    const idx = dutiable.map((l) => l.idx)
    if (allowed === undefined) issues.push({ level: 'block', code: 'vessel_type', message: 'Vessel type is needed to check eligibility for liquor and tobacco.', lines: idx })
    else if (!allowed) issues.push({ level: 'block', code: 'vessel_not_approved', message: 'This vessel type cannot take dutiable stores. Remove the liquor and tobacco lines.', lines: idx })
    if (!v.crew || !v.voyageDays) issues.push({ level: 'block', code: 'crew_days', message: 'Crew count and voyage days are needed to check daily rations.', lines: idx })
    const noRation = dutiable.filter((l) => !l.rationKind).map((l) => l.idx)
    if (noRation.length) issues.push({ level: 'block', code: 'ration_kind', message: `${plural(noRation.length, 'dutiable line')} missing a ration type.`, lines: noRation })
  }

  for (const r of decl.rations) {
    if (!r.ok && v.crew && v.voyageDays) {
      const lim = RATION_LIMITS[r.kind]
      issues.push({
        level: 'block',
        code: `ration_${r.kind}`,
        message: `${lim.label}: ${fmt(r.requested)} ${lim.unit} requested, ${fmt(r.allowed)} allowed (${v.crew} crew × ${v.voyageDays} days × ${lim.perDay}).`,
        lines: r.lines,
      })
    }
  }

  const unapproved = Object.entries(decl.caChecks).filter(([, ok]) => !ok).map(([ca]) => ca)
  if (unapproved.length) issues.push({ level: 'block', code: 'ca', message: `Approval not confirmed: ${unapproved.join(', ')}.` })

  if (decl.excluded.length) issues.push({ level: 'warn', code: 'install', message: `${plural(decl.excluded.length, 'line')} for installation left out of sea stores. Invoice with GST.`, lines: decl.excluded })
  if (!v.imo) issues.push({ level: 'warn', code: 'imo', message: 'IMO number is missing.' })
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

function fmt(n: number): string {
  return n.toLocaleString('en-SG')
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

import { describe, expect, it } from 'vitest'
import { checkRations, monthlyStatement, sgPreflight, splitSgDeclaration, vesselAllowsDutiable } from './sg'
import type { Order, ResolvedLine, VesselInfo } from './types'

const vessel: VesselInfo = { name: 'MV OCEAN LYRA', imo: '9734512', flag: 'Liberia', type: 'cargo', crew: 20, voyageDays: 5 }

const line = (idx: number, desc: string, qty: number, extra: Partial<ResolvedLine>): ResolvedLine => ({
  idx, raw: desc, desc, qty, orderUnit: 'PC', state: 'rule', ...extra,
})

const demo: ResolvedLine[] = [
  line(1, 'RICE JASMINE 25KG BAG', 10, { sgClass: 'sea_store_paid', name: 'Jasmine rice', spec: '25 kg', unit: 'BAG', unitPrice: 46 }),
  line(2, 'WHISKY 70CL', 24, { sgClass: 'dutiable_liquor', rationKind: 'spirits', rationUnitQty: 1, unitPrice: 38 }),
  line(3, 'CIGARETTES 200S CTN', 60, { sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', rationUnitQty: 200, unitPrice: 31 }),
  line(4, 'PUMP IMPELLER FOR INSTALLATION', 1, { sgClass: 'ship_spare_install', unitPrice: 880 }),
  line(5, 'FRESH BEEF CHILLED 20KG', 4, { sgClass: 'controlled', controlAuthority: 'SFA', unitPrice: 310 }),
]

describe('vessel eligibility', () => {
  it('allows approved types only', () => {
    expect(vesselAllowsDutiable(vessel)).toBe(true)
    expect(vesselAllowsDutiable({ ...vessel, type: 'other' })).toBe(false)
    expect(vesselAllowsDutiable({ ...vessel, type: undefined })).toBeUndefined()
  })
})

describe('checkRations', () => {
  it('flags the tobacco trap from the demo order', () => {
    const r = checkRations(demo, vessel)
    // 20 crew × 5 days × 40 sticks = 4,000; 60 cartons × 200 = 12,000
    expect(r.find((x) => x.kind === 'cigarettes')).toMatchObject({ requested: 12000, allowed: 4000, ok: false })
    // 20 × 5 × 0.25 = 25 bottles; 24 requested
    expect(r.find((x) => x.kind === 'spirits')).toMatchObject({ requested: 24, allowed: 25, ok: true })
  })
  it('passes once the order is cut to the allowance', () => {
    const fixed = demo.map((l) => (l.idx === 3 ? { ...l, qty: 20 } : l))
    expect(checkRations(fixed, vessel).every((r) => r.ok)).toBe(true)
  })
})

describe('splitSgDeclaration', () => {
  it('routes each line', () => {
    const d = splitSgDeclaration(demo, vessel)
    expect(d.statementOnly).toEqual([1])
    expect(d.excluded).toEqual([4])
    expect(d.permits).toEqual([
      { declarationType: 'APS', lines: [2, 3] },
      { declarationType: 'DRT', lines: [5] },
    ])
    expect(d.caChecks).toEqual({ SFA: false })
  })
  it('keeps approvals already ticked', () => {
    expect(splitSgDeclaration(demo, vessel, { SFA: true }).caChecks).toEqual({ SFA: true })
  })
})

describe('sgPreflight', () => {
  it('blocks on rations and unconfirmed approvals, warns on install parts', () => {
    const issues = sgPreflight(splitSgDeclaration(demo, vessel), vessel)
    expect(issues.filter((i) => i.level === 'block').map((i) => i.code)).toEqual(['ration_cigarettes', 'ca'])
    expect(issues.find((i) => i.code === 'install')?.level).toBe('warn')
  })
  it('blocks dutiable stores on an unknown or unapproved vessel type', () => {
    const v = { ...vessel, type: undefined }
    expect(sgPreflight(splitSgDeclaration(demo, v), v).map((i) => i.code)).toContain('vessel_type')
    const other = { ...vessel, type: 'other' as const }
    expect(sgPreflight(splitSgDeclaration(demo, other), other).map((i) => i.code)).toContain('vessel_not_approved')
  })
  it('requires the flag and classifications', () => {
    const v = { ...vessel, flag: undefined }
    const lines = [...demo, line(6, 'MYSTERY ITEM', 1, { state: 'unknown' })]
    const codes = sgPreflight(splitSgDeclaration(lines, v), v).map((i) => i.code)
    expect(codes).toContain('flag')
    expect(codes).toContain('unclassified')
  })
})

describe('monthlyStatement', () => {
  it('sums delivered statement-only quantities by vessel', () => {
    const decl = splitSgDeclaration(demo, vessel)
    const order = (id: string, at: string, rice: number): Order => ({
      id, ref: id, agencyId: 'a', receivedAt: at, subject: '', raw: '', vessel, lines: demo,
      jurisdiction: 'SG', currency: 'SGD', readSource: 'heuristic', decl,
      delivery: { at, receivedBy: 'Master', checked: { 1: rice } },
    })
    const rows = monthlyStatement([order('A', '2026-10-03T08:00:00Z', 8), order('B', '2026-10-20T08:00:00Z', 10), order('C', '2026-11-02T08:00:00Z', 5)], '2026-10')
    expect(rows).toHaveLength(1)
    expect(rows[0].items).toEqual([{ name: 'Jasmine rice', spec: '25 kg', unit: 'BAG', qty: 18, value: 828 }])
    expect(rows[0].orders).toEqual(['A', 'B'])
  })
})

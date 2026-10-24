import { describe, expect, it } from 'vitest'
import { splitSgDeclaration } from './sg'
import { inPack, litresPerUnit, permitDocs, permitSheets, printHtml } from './tradenet'
import type { Order, ResolvedLine, VesselInfo } from './types'

const vessel: VesselInfo = {
  name: 'MV OCEAN LYRA', imo: '9734512', flag: 'Liberia', type: 'cargo', crew: 20, voyageDays: 5, location: 'Western Anchorage',
  nrt: 18450, voyageNo: 'OL-2611', departure: '27 Oct 18:00', nextPort: 'Port Hedland', finalPort: 'Qingdao',
}

const line = (idx: number, extra: Partial<ResolvedLine>): ResolvedLine => ({ idx, raw: '', desc: '', qty: 1, orderUnit: 'PC', state: 'rule', ...extra })

const lines: ResolvedLine[] = [
  line(1, { name: 'Scotch whisky', spec: '70 cl', unit: 'BTL', qty: 24, hs: '2208.30', origin: 'GB', sgClass: 'dutiable_liquor', rationKind: 'spirits', rationUnitQty: 1, unitPrice: 38 }),
  line(2, { name: 'Lager beer', spec: '330 ml × 24 cans', unit: 'CASE', qty: 4, hs: '2203.00', origin: 'SG', sgClass: 'dutiable_liquor', rationKind: 'beer', rationUnitQty: 24, unitPrice: 42 }),
  line(3, { name: 'Cigarettes', spec: '200 sticks', unit: 'CTN', qty: 20, hs: '2402.20', origin: 'ID', sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', rationUnitQty: 200, unitPrice: 31 }),
  line(4, { name: 'Red hand flare', spec: '1 pc', unit: 'PC', qty: 6, hs: '3604.90', sgClass: 'controlled', controlAuthority: 'SPF', unitPrice: 58 }),
]

const order: Order = {
  id: 'o1', ref: 'SO-1', agencyId: 'a', receivedAt: '', subject: '', raw: '', vessel, lines, jurisdiction: 'SG', currency: 'SGD', readSource: 'heuristic',
}
const ws = { name: 'Lion Gate Ship Supply (Demo)', uen: '2026DEMO01K' }
const agency = { id: 'a', name: 'Straits Line Agencies (Demo)', domain: 'x', uen: '2019DEMO02A' }

describe('in-pack quantities', () => {
  it('reads litres from the pack spec', () => {
    expect(litresPerUnit('70 cl')).toBeCloseTo(0.7)
    expect(litresPerUnit('330 ml × 24 cans')).toBeCloseTo(7.92)
    expect(litresPerUnit('12 pairs')).toBeUndefined()
  })
  it('counts sticks and litres', () => {
    expect(inPack(lines[0])).toEqual({ qty: 16.8, unit: 'LTR' })
    expect(inPack(lines[1])).toEqual({ qty: 31.68, unit: 'LTR' })
    expect(inPack(lines[2])).toEqual({ qty: 4000, unit: 'STK' })
    expect(inPack(lines[3])).toBeUndefined()
  })
})

describe('permitDocs', () => {
  const decl = splitSgDeclaration(lines, vessel)
  it('fills the TradeNet header from the order, workspace and agency', () => {
    const [aps] = permitDocs(order, ws, agency, decl.lines, decl.permits)
    const field = (k: string) => aps.sections.flatMap((s) => s.fields).find((f) => f.key === k)?.value
    expect(aps.group.declarationType).toBe('APS')
    expect(field('cpc')).toBe('SEASTORE')
    expect(field('pc1')).toBe('20')
    expect(field('pc2')).toBe('5')
    expect(field('carrierAgentUen')).toBe('2019DEMO02A')
    expect(field('nrt')).toBe('18450')
    expect(field('vesselType')).toBe('Cargo vessel')
    expect(aps.missing).toBe(0)
  })
  it('flags the missing origin and CA licence on the DRT permit, until the licence is keyed in', () => {
    const drt = permitDocs(order, ws, agency, decl.lines, decl.permits).find((d) => d.group.declarationType === 'DRT')!
    expect(drt.items[0].missing).toEqual(['origin', 'caLicence'])
    expect(drt.missing).toBe(2)
    const keyed = permitDocs(order, ws, agency, decl.lines, decl.permits, { SPF: 'AE-2026-0142' }).find((d) => d.group.declarationType === 'DRT')!
    expect(keyed.items[0].caLicence).toBe('AE-2026-0142')
    expect(keyed.missing).toBe(1)
  })
  it('exports official field names and prints the Master acknowledgement', () => {
    const docs = permitDocs(order, ws, agency, decl.lines, decl.permits)
    const [sheet] = permitSheets(order, docs)
    expect(sheet.rows.map((r) => r[0])).toEqual(expect.arrayContaining(['Net Registered Tonnage', 'Next Port of Call', 'Outward Carrier Agent UEN']))
    const html = printHtml(order, docs)
    expect(html).toContain('I certify that I have to-day received')
    expect(html).toContain('Condition A4')
  })
})

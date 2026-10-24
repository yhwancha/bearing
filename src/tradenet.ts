/* TradeNet permit preview. Nothing is submitted; this lays out the fields a declarant keys in
   (or hands to a TradeNet front-end) for each permit the order needs. Field set follows
   Singapore Customs guidance for sea stores; verify against "Module 5 Important Permit Fields". */

import { fmtMoney, fmtNum } from './format'
import { lineAmount, RATION_LIMITS, sumAmount } from './sg'
import type { Order, PermitGroup, ResolvedLine, Workspace } from './types'
import type { Sheet } from './lib/xlsx'

export interface PermitPreview {
  group: PermitGroup
  header: [string, string][]
  items: ResolvedLine[]
  total: number
}

export function permitPreviews(order: Order, ws: Workspace, lines: ResolvedLine[], permits: PermitGroup[]): PermitPreview[] {
  return permits.map((group) => {
    const items = lines.filter((l) => group.lines.includes(l.idx))
    const header: [string, string][] = [
      ['Message type', 'OUT'],
      ['Declaration type', group.declarationType],
      ['Customs procedure code (CPC)', 'SEASTORE'],
      ['Declarant / exporter', ws.uen ? `${ws.name} (UEN ${ws.uen})` : ws.name],
      ['Vessel name', order.vessel.name],
      ['IMO number', order.vessel.imo ?? ''],
      ['Vessel nationality', order.vessel.flag ?? ''],
      ['Place of loading', order.vessel.location ?? ''],
      ['Total value', fmtMoney(sumAmount(items), order.currency)],
    ]
    return { group, header, items, total: sumAmount(items) }
  })
}

export function itemNote(l: ResolvedLine): string {
  if (l.rationKind) return `${RATION_LIMITS[l.rationKind].label}: ${fmtNum(l.qty * (l.rationUnitQty ?? 1))} ${RATION_LIMITS[l.rationKind].unit}`
  if (l.controlAuthority) return `CA: ${l.controlAuthority}`
  return ''
}

export function permitSheets(order: Order, previews: PermitPreview[]): Sheet[] {
  return previews.map((p) => ({
    name: `${p.group.declarationType} ${order.ref}`,
    rows: [
      ...p.header,
      [],
      ['Seq', 'HS code', 'Description', 'Pack', 'Quantity', 'Unit', `Value (${order.currency})`, 'Note'],
      ...p.items.map((l, i) => [i + 1, l.hs ?? '', l.name ?? l.desc, l.spec ?? '', l.qty, l.unit ?? l.orderUnit, lineAmount(l), itemNote(l)]),
    ],
  }))
}

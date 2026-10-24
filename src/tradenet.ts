/* TradeNet permit preview. Nothing is submitted; this lays out the fields a declarant keys in
   (or hands to a TradeNet front-end) for each permit the order needs. Field set follows
   Singapore Customs guidance for sea stores; verify against "Module 5 Important Permit Fields". */

import { fmtMoney, fmtNum } from './format'
import { lineAmount, RATION_LIMITS, sumAmount } from './sg'
import type { Order, PermitGroup, RationKind, ResolvedLine, Workspace } from './types'
import type { Sheet } from './lib/xlsx'

export type PermitField = 'messageType' | 'declarationType' | 'cpc' | 'declarant' | 'vesselName' | 'imo' | 'nationality' | 'loading' | 'total'

/** Field names as they appear on the exported sheet. Customs documents stay in English. */
export const FIELD_LABEL: Record<PermitField, string> = {
  messageType: 'Message type',
  declarationType: 'Declaration type',
  cpc: 'Customs procedure code (CPC)',
  declarant: 'Declarant / exporter',
  vesselName: 'Vessel name',
  imo: 'IMO number',
  nationality: 'Vessel nationality',
  loading: 'Place of loading',
  total: 'Total value',
}

export interface PermitPreview {
  group: PermitGroup
  header: [PermitField, string][]
  items: ResolvedLine[]
  total: number
}

export function permitPreviews(order: Order, ws: Workspace, lines: ResolvedLine[], permits: PermitGroup[]): PermitPreview[] {
  return permits.map((group) => {
    const items = lines.filter((l) => group.lines.includes(l.idx))
    const header: [PermitField, string][] = [
      ['messageType', 'OUT'],
      ['declarationType', group.declarationType],
      ['cpc', 'SEASTORE'],
      ['declarant', ws.uen ? `${ws.name} (UEN ${ws.uen})` : ws.name],
      ['vesselName', order.vessel.name],
      ['imo', order.vessel.imo ?? ''],
      ['nationality', order.vessel.flag ?? ''],
      ['loading', order.vessel.location ?? ''],
      ['total', fmtMoney(sumAmount(items), order.currency)],
    ]
    return { group, header, items, total: sumAmount(items) }
  })
}

/** Ration or authority note per item. Pass `t.ration` for the screen; the sheet keeps the English labels. */
export function itemNote(l: ResolvedLine, labels: Record<RationKind, { label: string; unit: string }> = RATION_LIMITS): string {
  if (l.rationKind) return `${labels[l.rationKind].label}: ${fmtNum(l.qty * (l.rationUnitQty ?? 1))} ${labels[l.rationKind].unit}`
  if (l.controlAuthority) return `CA: ${l.controlAuthority}`
  return ''
}

export function permitSheets(order: Order, previews: PermitPreview[]): Sheet[] {
  return previews.map((p) => ({
    name: `${p.group.declarationType} ${order.ref}`,
    rows: [
      ...p.header.map(([k, v]) => [FIELD_LABEL[k], v]),
      [],
      ['Seq', 'HS code', 'Description', 'Pack', 'Quantity', 'Unit', `Value (${order.currency})`, 'Note'],
      ...p.items.map((l, i) => [i + 1, l.hs ?? '', l.name ?? l.desc, l.spec ?? '', l.qty, l.unit ?? l.orderUnit, lineAmount(l), itemNote(l)]),
    ],
  }))
}

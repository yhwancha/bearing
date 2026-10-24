/* TradeNet sea-stores permit document. Nothing is submitted: this lays out every field the declarant
   keys into TradeNet (or hands to a TradeNet front-end) for each permit the order needs, flags what is
   still missing, and prints the Master's acknowledgement that goes on board with the stores.
   Field set follows Singapore Customs guidance for sea stores (CPC SEASTORE, Condition A4);
   verify against "Module 5 Important Permit Fields" before filing. */

import { fmtMoney, fmtNum } from './format'
import { lineAmount, RATION_LIMITS, sumAmount } from './sg'
import type { Agency, Order, PermitGroup, RationKind, ResolvedLine, Workspace } from './types'
import type { Sheet } from './lib/xlsx'

export type FieldKey =
  | 'messageType' | 'declarationType' | 'cpc' | 'pc1' | 'pc2'
  | 'declarant' | 'declarantUen' | 'carrierAgent' | 'carrierAgentUen' | 'consignee'
  | 'transportMode' | 'vesselName' | 'voyageNo' | 'vesselType' | 'nationality' | 'nrt' | 'departure' | 'nextPort' | 'finalPort' | 'remarks'
  | 'totalOuterPack' | 'totalValue'

export type SectionKey = 'header' | 'parties' | 'transport' | 'summary'
export type ItemKey = 'hs' | 'description' | 'origin' | 'outerQty' | 'inQty' | 'value' | 'caLicence'
/** Where a missing value is fixed in the app. */
export type FixAt = 'vessel' | 'catalog' | 'approvals'

/** Field names as TradeNet shows them. Customs documents stay in English. */
export const FIELD_NAME: Record<FieldKey, string> = {
  messageType: 'Message Type',
  declarationType: 'Declaration Type',
  cpc: 'CPC',
  pc1: 'Processing Code 1 (no. of crew)',
  pc2: 'Processing Code 2 (voyage duration, days)',
  declarant: 'Exporter / Declarant',
  declarantUen: 'Exporter UEN',
  carrierAgent: 'Outward Carrier Agent',
  carrierAgentUen: 'Outward Carrier Agent UEN',
  consignee: 'Consignee',
  transportMode: 'Outward Transport Mode',
  vesselName: 'Outward Transport Identifier (vessel name)',
  voyageNo: 'Outward Conveyance Reference No. (voyage)',
  vesselType: 'Vessel Type',
  nationality: 'Nationality of Vessel',
  nrt: 'Net Registered Tonnage',
  departure: 'Date / Time of Departure',
  nextPort: 'Next Port of Call',
  finalPort: 'Final Port of Call',
  remarks: "Traders' Remarks",
  totalOuterPack: 'Total Outer Pack Qty',
  totalValue: 'Total Value',
}

export const ITEM_NAME: Record<ItemKey, string> = {
  hs: 'HS Code',
  description: 'Goods Description',
  origin: 'Country of Origin',
  outerQty: 'Outer Pack Qty / UOM',
  inQty: 'In-Pack Qty / UOM',
  value: 'Item Value',
  caLicence: 'CA Licence / Approval No.',
}

const VESSEL_TYPE_NAME = {
  cargo: 'Cargo vessel', passenger: 'Passenger vessel', oil_rig: 'Oil rig', dredge: 'Dredger', fishing: 'Fishing vessel',
  supply: 'Supply vessel', tug: 'Tug', other: 'Other',
} as const

export interface DocField {
  key: FieldKey
  value: string
  required: boolean
  fix?: FixAt
}

export interface DocSection {
  key: SectionKey
  fields: DocField[]
}

export interface DocItem {
  seq: number
  line: ResolvedLine
  hs: string
  description: string
  origin: string
  outerQty: number
  outerUnit: string
  inQty?: number
  inUnit?: string
  value: number
  caLicence: string
  /** Required item fields that are still empty. */
  missing: ItemKey[]
}

export interface PermitDoc {
  group: PermitGroup
  sections: DocSection[]
  items: DocItem[]
  total: number
  /** Required fields still empty, header and items together. */
  missing: number
}

/** Litres in one unit, from a pack spec like "70 cl", "75 cl" or "330 ml × 24 cans". */
export function litresPerUnit(spec = ''): number | undefined {
  const m = spec.match(/(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/i)
  if (!m) return undefined
  const per = Number(m[1]) * ({ ml: 0.001, cl: 0.01, l: 1 } as const)[m[2].toLowerCase() as 'ml' | 'cl' | 'l']
  const n = spec.match(/[×x]\s*(\d+)/i)
  return per * (n ? Number(n[1]) : 1)
}

/** Inner quantity TradeNet asks for on dutiable goods: sticks for tobacco, litres for liquor. */
export function inPack(l: ResolvedLine): { qty: number; unit: string } | undefined {
  const k = l.rationKind
  if (k === 'cigarettes' || k === 'cigars') return { qty: l.qty * (l.rationUnitQty ?? 1), unit: 'STK' }
  if (k === 'tobacco') return { qty: round((l.qty * (l.rationUnitQty ?? 0)) / 1000), unit: 'KGM' }
  if (k === 'spirits' || k === 'wine' || k === 'beer') {
    const litres = litresPerUnit(l.spec)
    return litres === undefined ? undefined : { qty: round(l.qty * litres), unit: 'LTR' }
  }
  return undefined
}

/** Customs documents are formatted in English whatever the UI language. */
const DOC_LOCALE = 'en-SG'

const round = (n: number) => Math.round(n * 1000) / 1000

const f = (key: FieldKey, value: string | number | undefined, required = true, fix?: FixAt): DocField => ({
  key, value: value === undefined ? '' : String(value), required, fix,
})

export function permitDocs(order: Order, ws: Workspace, agency: Agency | undefined, lines: ResolvedLine[], permits: PermitGroup[], caRefs: Record<string, string> = {}): PermitDoc[] {
  const v = order.vessel
  return permits.map((group) => {
    const rows = lines.filter((l) => group.lines.includes(l.idx))
    const items: DocItem[] = rows.map((l, i) => {
      const ca = l.sgClass === 'controlled' ? l.controlAuthority || 'Competent Authority' : undefined
      const inner = inPack(l)
      const item: DocItem = {
        seq: i + 1,
        line: l,
        hs: l.hs ?? '',
        description: [l.name ?? l.desc, l.spec].filter(Boolean).join(', '),
        origin: l.origin ?? '',
        outerQty: l.qty,
        outerUnit: l.unit ?? l.orderUnit,
        inQty: inner?.qty,
        inUnit: inner?.unit,
        value: lineAmount(l),
        caLicence: ca ? caRefs[ca] ?? '' : '',
        missing: [],
      }
      if (!item.hs) item.missing.push('hs')
      if (!item.origin) item.missing.push('origin')
      if (l.rationKind && item.inQty === undefined) item.missing.push('inQty')
      if (ca && !item.caLicence) item.missing.push('caLicence')
      return item
    })
    const total = sumAmount(rows)
    const place = v.location ? `supplied at ${v.location}` : ''
    const sections: DocSection[] = [
      {
        key: 'header',
        fields: [
          f('messageType', 'OUT'),
          f('declarationType', group.declarationType),
          f('cpc', 'SEASTORE'),
          f('pc1', v.crew, true, 'vessel'),
          f('pc2', v.voyageDays, true, 'vessel'),
        ],
      },
      {
        key: 'parties',
        fields: [
          f('declarant', ws.name),
          f('declarantUen', ws.uen),
          f('carrierAgent', agency?.name, false),
          f('carrierAgentUen', agency?.uen, false),
          f('consignee', `Master, ${v.name}`),
        ],
      },
      {
        key: 'transport',
        fields: [
          f('transportMode', 'SEA'),
          f('vesselName', v.name, true, 'vessel'),
          f('voyageNo', v.voyageNo, false, 'vessel'),
          f('vesselType', v.type && VESSEL_TYPE_NAME[v.type], true, 'vessel'),
          f('nationality', v.flag, true, 'vessel'),
          f('nrt', v.nrt, true, 'vessel'),
          f('departure', v.departure, false, 'vessel'),
          f('nextPort', v.nextPort, true, 'vessel'),
          f('finalPort', v.finalPort, true, 'vessel'),
          f('remarks', [v.imo && `IMO ${v.imo}`, place, `ref ${order.ref}`].filter(Boolean).join('; '), false),
        ],
      },
      {
        key: 'summary',
        fields: [
          f('totalOuterPack', fmtNum(rows.reduce((s, l) => s + l.qty, 0))),
          f('totalValue', fmtMoney(total, order.currency, DOC_LOCALE)),
        ],
      },
    ]
    const missing = sections.flatMap((s) => s.fields).filter((x) => x.required && !x.value).length + items.reduce((s, x) => s + x.missing.length, 0)
    return { group, sections, items, total, missing }
  })
}

/** Ration or authority note per item. Pass `t.ration` for the screen; documents keep the English labels. */
export function itemNote(l: ResolvedLine, labels: Record<RationKind, { label: string; unit: string }> = RATION_LIMITS): string {
  if (l.rationKind) return `${labels[l.rationKind].label}: ${fmtNum(l.qty * (l.rationUnitQty ?? 1))} ${labels[l.rationKind].unit}`
  if (l.controlAuthority) return `CA: ${l.controlAuthority}`
  return ''
}

/** One sheet per permit, laid out in TradeNet field order. */
export function permitSheets(order: Order, docs: PermitDoc[]): Sheet[] {
  return docs.map((d) => ({
    name: `OUT ${d.group.declarationType} ${order.ref}`.slice(0, 31),
    rows: [
      ['TradeNet sea-stores permit — data entry sheet', '', d.missing ? `${d.missing} required field(s) missing` : 'All required fields present'],
      [],
      ...d.sections.flatMap((s) => [...s.fields.map((x) => [x.key === 'totalValue' ? `${FIELD_NAME[x.key]} (${order.currency})` : FIELD_NAME[x.key], x.value || (x.required ? 'MISSING' : '')]), []]),
      ['Item No.', ITEM_NAME.hs, ITEM_NAME.description, ITEM_NAME.origin, 'Outer Pack Qty', 'Outer Pack UOM', 'In-Pack Qty', 'In-Pack UOM', `${ITEM_NAME.value} (${order.currency})`, ITEM_NAME.caLicence],
      ...d.items.map((x) => [
        x.seq, x.hs || 'MISSING', x.description, x.origin || 'MISSING', x.outerQty, x.outerUnit, x.inQty ?? '', x.inUnit ?? '', x.value,
        x.caLicence || (x.missing.includes('caLicence') ? 'MISSING' : ''),
      ]),
    ],
  }))
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const cell = (s: string | number | undefined, missing = false) => (missing ? '<span class="miss">MISSING</span>' : esc(String(s ?? '')))

const SECTION_NAME: Record<SectionKey, string> = { header: 'Declaration', parties: 'Parties', transport: 'Outward transport', summary: 'Summary' }

/** A4 print-out: one page per permit plus the Master's acknowledgement (Condition A4). English only. */
export function printHtml(order: Order, docs: PermitDoc[], permitNo?: string): string {
  const v = order.vessel
  const pages = docs.map(
    (d) => `
  <section class="page">
    <header><h1>OUT (${d.group.declarationType}) — sea stores permit application</h1>
      <p>CPC SEASTORE · ${esc(order.ref)}${permitNo ? ` · Permit No. ${esc(permitNo)}` : ' · Permit No. ____________'}</p>
      ${d.missing ? `<p class="miss">${d.missing} required field(s) missing — draft, do not file</p>` : ''}</header>
    ${d.sections
      .map(
        (s) => `<h2>${SECTION_NAME[s.key]}</h2><table class="kv">${s.fields
          .map((x) => `<tr><th>${esc(x.key === 'totalValue' ? `${FIELD_NAME[x.key]} (${order.currency})` : FIELD_NAME[x.key])}</th><td>${cell(x.value, x.required && !x.value)}</td></tr>`)
          .join('')}</table>`,
      )
      .join('')}
    <h2>Items</h2>
    <table class="items"><thead><tr><th>No.</th><th>${ITEM_NAME.hs}</th><th>${ITEM_NAME.description}</th><th>Origin</th><th class="r">Outer pack</th><th class="r">In-pack</th><th class="r">Value (${order.currency})</th><th>CA licence</th></tr></thead>
    <tbody>${d.items
      .map(
        (x) => `<tr><td>${x.seq}</td><td>${cell(x.hs, !x.hs)}</td><td>${esc(x.description)}</td><td>${cell(x.origin, !x.origin)}</td>
        <td class="r">${fmtNum(x.outerQty)} ${esc(x.outerUnit)}</td><td class="r">${x.inQty === undefined ? (x.missing.includes('inQty') ? cell('', true) : '') : `${fmtNum(x.inQty)} ${x.inUnit}`}</td>
        <td class="r">${fmtMoney(x.value, order.currency, DOC_LOCALE)}</td><td>${cell(x.caLicence, x.missing.includes('caLicence'))}</td></tr>`,
      )
      .join('')}</tbody></table>
  </section>`,
  )
  const packages = docs.reduce((s, d) => s + d.items.reduce((n, x) => n + x.outerQty, 0), 0)
  const ack = `
  <section class="page">
    <header><h1>Master's acknowledgement of sea stores received</h1>
      <p>Singapore Customs · Condition A4 · ${esc(order.ref)}${permitNo ? ` · Permit No. ${esc(permitNo)}` : ''}</p></header>
    <table class="kv">
      <tr><th>Vessel</th><td>${esc(v.name)}${v.imo ? ` (IMO ${esc(v.imo)})` : ''}</td></tr>
      <tr><th>Nationality</th><td>${esc(v.flag ?? '')}</td></tr>
      <tr><th>Voyage</th><td>${esc(v.voyageNo ?? '')}</td></tr>
      <tr><th>Place of supply</th><td>${esc(v.location ?? '')}</td></tr>
      <tr><th>Permit(s)</th><td>${docs.map((d) => `OUT (${d.group.declarationType})`).join(', ')}</td></tr>
    </table>
    <p class="cert">I certify that I have to-day received <span class="fill">${fmtNum(packages)}</span> packages/containers of goods as declared in the above permit(s), on board the vessel named above.</p>
    <table class="sign">
      <tr><th>Signature of Master</th><td></td></tr>
      <tr><th>Full name (block letters)</th><td></td></tr>
      <tr><th>Designation</th><td>Master</td></tr>
      <tr><th>Date / time</th><td></td></tr>
      <tr><th>Vessel stamp</th><td class="stamp"></td></tr>
    </table>
  </section>`
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(order.ref)} — TradeNet sea stores</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { background: #fff; font: 10.5pt/1.4 -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: #111; margin: 0; }
  .page { page-break-after: always; padding: 8mm 0; max-width: 190mm; margin: 0 auto; }
  .page:last-child { page-break-after: auto; }
  header { border-bottom: 2px solid #111; margin-bottom: 10px; padding-bottom: 6px; }
  h1 { font-size: 15pt; margin: 0 0 2px; }
  h2 { font-size: 10pt; text-transform: uppercase; letter-spacing: .04em; margin: 14px 0 4px; color: #444; }
  p { margin: 2px 0; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
  .kv th { width: 42%; background: #f4f4f4; font-weight: 600; }
  .items th { background: #f4f4f4; font-size: 9pt; }
  .items td { font-size: 9.5pt; }
  .r { text-align: right; white-space: nowrap; }
  .miss { color: #b00020; font-weight: 700; }
  .cert { margin: 22px 0 16px; font-size: 11.5pt; }
  .fill { display: inline-block; min-width: 60px; border-bottom: 1px solid #111; text-align: center; font-weight: 700; }
  .sign th { width: 34%; background: #f4f4f4; }
  .sign td { height: 34px; }
  .sign td.stamp { height: 90px; }
</style></head><body>${pages.join('')}${ack}</body></html>`
}

/** Open the print-out in a new window and bring up the print dialog (Save as PDF works there). */
export function printDocs(order: Order, docs: PermitDoc[], permitNo?: string): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(printHtml(order, docs, permitNo))
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 250)
  return true
}

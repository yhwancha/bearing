/* Deterministic engine. The model only reads and suggests; approved rules are
   applied here, so the same order always produces the same paperwork. */

import type { Agency, OrderLine, Product, Proposal, ResolvedLine, Rule, VesselInfo, VesselType } from './types'

/* ---------- Tokens and rule matching ---------- */

export function tokenize(desc: string): string[] {
  return desc
    .toUpperCase()
    .replace(/[(),;:/"'`]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function globToRegex(tok: string): RegExp {
  const esc = tok.toUpperCase().replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${esc}$`)
}

/** Every pattern token appears in the description, in order. */
export function matchPattern(pattern: string[], tokens: string[]): boolean {
  let i = 0
  for (const p of pattern) {
    const re = globToRegex(p)
    while (i < tokens.length && !re.test(tokens[i])) i++
    if (i >= tokens.length) return false
    i++
  }
  return pattern.length > 0
}

function specificity(r: Rule): number {
  // Agency-specific rules first, then rules with more literal tokens
  const literal = r.pattern.filter((t) => !t.includes('*')).length
  return (r.agencyId ? 100 : 0) + literal * 10 + r.pattern.length
}

export function findRule(rules: Rule[], agencyId: string, desc: string): Rule | undefined {
  const tokens = tokenize(desc)
  return rules
    .filter((r) => (r.agencyId === null || r.agencyId === agencyId) && matchPattern(r.pattern, tokens))
    .sort((a, b) => specificity(b) - specificity(a))[0]
}

function fromProduct(p: Product): Partial<ResolvedLine> {
  return {
    productId: p.id,
    name: p.name,
    spec: p.spec,
    unit: p.unit,
    hs: p.hs,
    sgClass: p.sgClass,
    controlAuthority: p.controlAuthority,
    rationKind: p.rationKind,
    rationUnitQty: p.rationUnitQty,
    unitPrice: p.price,
  }
}

/** Apply rules (then pending proposals) to each order line. */
export function resolveLines(
  lines: OrderLine[],
  agencyId: string,
  rules: Rule[],
  products: Product[],
  proposals: Proposal[],
): ResolvedLine[] {
  return lines.map((l) => {
    const rule = findRule(rules, agencyId, l.desc)
    const product = rule && products.find((p) => p.id === rule.productId)
    if (rule && product) return { ...l, ...fromProduct(product), ruleId: rule.id, state: 'rule' }
    const prop = proposals.find((x) => x.status === 'pending' && x.agencyId === agencyId && x.desc === l.desc)
    if (prop) {
      const linked = prop.productId ? products.find((p) => p.id === prop.productId) : undefined
      const draft = linked ? fromProduct(linked) : { ...prop.draft, unitPrice: prop.draft.price }
      return { ...l, ...draft, proposalId: prop.id, state: 'proposed' }
    }
    return { ...l, state: 'unknown' }
  })
}

/* ---------- Offline reader ---------- */

const UNIT_WORDS = new Set([
  'BAG', 'BAGS', 'CTN', 'CTNS', 'CARTON', 'CARTONS', 'BTL', 'BTLS', 'BOTTLE', 'BOTTLES', 'CASE', 'CASES',
  'PC', 'PCS', 'EA', 'SET', 'SETS', 'ROLL', 'ROLLS', 'CAN', 'CANS', 'BOX', 'BOXES', 'PKT', 'PKTS', 'TIN', 'TINS',
  'KG', 'KGS', 'LTR', 'LTRS', 'DRUM', 'DRUMS', 'PAIL', 'PAILS', 'TRAY', 'TRAYS', 'PACK', 'PACKS', 'UNIT', 'UNITS', 'COIL', 'COILS', 'PAIR', 'PAIRS', 'TUBE', 'TUBES', 'CS',
])

function normUnit(u: string): string {
  const up = u.toUpperCase()
  const singular: Record<string, string> = {
    BAGS: 'BAG', CTNS: 'CTN', CARTON: 'CTN', CARTONS: 'CTN', BTLS: 'BTL', BOTTLE: 'BTL', BOTTLES: 'BTL',
    CASES: 'CASE', PCS: 'PC', EA: 'PC', SETS: 'SET', ROLLS: 'ROLL', CANS: 'CAN', BOXES: 'BOX', PKTS: 'PKT',
    TINS: 'TIN', KGS: 'KG', LTRS: 'LTR', DRUMS: 'DRUM', PAILS: 'PAIL', TRAYS: 'TRAY', PACKS: 'PACK', UNITS: 'UNIT', COILS: 'COIL', PAIRS: 'PAIR', TUBES: 'TUBE', CS: 'CASE',
  }
  return singular[up] ?? up
}

const isUnit = (w: string | undefined) => !!w && UNIT_WORDS.has(w.toUpperCase())

/** Reads one order line in the shapes agencies and masters actually send:
    "RICE JASMINE 25KG BAG x 10", "EGGS 30PCS 15 TRAY", "36 BTL Whisky 70cl", and shorthand like "water 30". */
export function parseItemLine(text: string): Omit<OrderLine, 'idx'> | null {
  const raw = text.trim()
  const s = raw.replace(/^\s*(?:\d{1,3}[.)]|[-*•])\s+/, '').trim()
  if (!s || s.length > 90 || s.includes(':')) return null
  let desc = ''
  let qty = 0
  let unit = ''
  let m: RegExpMatchArray | null

  if ((m = s.match(/^(.*?)[\s,]*[x×]\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$/i)) && m[1].trim()) {
    // "... x 24 BTL" / "... × 10"
    if (m[3] && !isUnit(m[3])) return null
    desc = m[1]
    qty = Number(m[2])
    unit = m[3] ?? ''
  } else if ((m = s.match(/^(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s+(.+)$/)) && isUnit(m[2])) {
    // "36 BTL Whisky 70cl" — quantity first, as masters often write
    qty = Number(m[1])
    unit = m[2]
    desc = m[3]
  } else if ((m = s.match(/^(.*?)\s+(?:QTY[:.]?\s*)?(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*$/i)) && isUnit(m[3]) && m[1].trim()) {
    // "... 10 CTN"
    desc = m[1]
    qty = Number(m[2])
    unit = m[3]
  } else if ((m = s.match(/^([A-Za-z][A-Za-z0-9 .,/&'-]*?)\s+(\d{1,4})$/)) && m[1].split(/\s+/).length <= 5) {
    // "water 30": shorthand with no unit
    desc = m[1]
    qty = Number(m[2])
  } else return null

  desc = desc.trim().replace(/[\s,]+$/, '')
  if (!desc) return null
  if (!unit) {
    const last = tokenize(desc).at(-1)
    if (isUnit(last)) unit = last!
  }
  if (!(qty > 0)) return null
  return { raw, desc: desc.toUpperCase(), qty, orderUnit: unit ? normUnit(unit) : 'UNIT' }
}

/** A row of a requisition table ("000105 | RICE JASMINE 25KG | BAG | 12"), cells split on | or tabs. */
export function parseTableRow(text: string): Omit<OrderLine, 'idx'> | null {
  if (!/[|\t]/.test(text)) return null
  const cells = text.split(/\s*[|\t]\s*/).map((c) => c.trim()).filter(Boolean)
  const qtyCell = [...cells].reverse().find((c) => /^\d+(?:\.\d+)?$/.test(c) && !/^\d{6}$/.test(c))
  const code = cells.find((c) => /^\d{6}$/.test(c))
  const unit = cells.find((c) => isUnit(c))
  const desc = cells.filter((c) => c !== qtyCell && c !== code && c !== unit && /[A-Za-z]{2}/.test(c)).sort((a, b) => b.length - a.length)[0]
  if (!qtyCell || !desc || !(Number(qtyCell) > 0)) return null
  return { raw: text.trim(), desc: desc.toUpperCase(), qty: Number(qtyCell), orderUnit: unit ? normUnit(unit) : 'UNIT', code }
}

/** Berths and anchorages in the Port of Singapore the reader recognises. */
export const SG_LOCATIONS = [
  'Western Petroleum Anchorage', 'Western Holding Anchorage', 'Western Anchorage', 'Eastern Petroleum Anchorage',
  'Eastern Special Purposes Anchorage', 'Eastern Anchorage', 'Changi General Purpose Anchorage', 'Raffles Reserved Anchorage',
  'Sudong Explosive Anchorage', 'Jurong Port', 'Pasir Panjang Terminal', 'Keppel Terminal', 'Tanjong Pagar Terminal',
  'Brani Terminal', 'Sembawang Wharves', 'Tuas Port', 'Marina Bay Cruise Centre', 'Singapore Cruise Centre',
]

const VESSEL_TYPES: [RegExp, VesselType][] = [
  [/\b(cruise|ferry|passenger|ro-?pax)\b/i, 'passenger'],
  [/\b(tug|tugboat)\b/i, 'tug'],
  [/\b(supply|psv|ahts|osv)\b/i, 'supply'],
  [/\b(rig|jack-?up|drillship|fpso)\b/i, 'oil_rig'],
  [/\b(dredger|dredge)\b/i, 'dredge'],
  [/\b(fishing|trawler)\b/i, 'fishing'],
  [/\b(bulk|container|tanker|cargo|carrier|lng|lpg|ro-?ro|reefer)\b/i, 'cargo'],
]

export function guessVesselType(text: string): VesselType | undefined {
  for (const [re, t] of VESSEL_TYPES) if (re.test(text)) return t
  return undefined
}

function field(text: string, labels: string[]): string | undefined {
  for (const l of labels) {
    const m = text.match(new RegExp(`^\\s*${l}\\s*[:\\-]\\s*(.+)$`, 'im'))
    if (m) return m[1].trim()
  }
  return undefined
}

export interface ReadResult {
  subject: string
  agencyId?: string
  vessel: VesselInfo
  lines: OrderLine[]
}

/** Flag states the reader recognises when there is no "Flag:" field. */
const FLAGS = [
  'Marshall Islands', 'Hong Kong', 'Panama', 'Liberia', 'Singapore', 'Bahamas', 'Malta', 'Greece', 'Cyprus', 'Norway',
  'Japan', 'China', 'Korea', 'India', 'Indonesia', 'Malaysia', 'Vietnam', 'Philippines', 'Denmark', 'Portugal',
]

const VESSEL_NAME = /\b(M\/?V|M\/?T)\.?\s+([A-Za-z0-9][A-Za-z0-9 ]*?)(?=\s*(?:[(),.;:/]|\s-\s|\s+(?:at|@|is|eta)\b|$))/im

function vesselName(raw: string): string {
  const m = raw.match(VESSEL_NAME)
  if (m) return `${m[1].replace('/', '').toUpperCase()} ${m[2].trim().toUpperCase()}`
  return raw.split(' / ')[0].replace(/\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim().toUpperCase()
}

/** Best-effort reader for a pasted agency email. Used when the model is unavailable.
    Handles labelled fields, particulars written in a sentence, and the usual shorthand ("western anch"). */
export function heuristicRead(text: string, agencies: Agency[]): ReadResult {
  const from = field(text, ['From']) ?? ''
  const agency = agencies.find((a) => from.toLowerCase().includes(a.domain) || text.toLowerCase().includes(a.domain))
  const subject = field(text, ['Subject', 'Re']) ?? ''
  const plain = text.replace(/\banch\b\.?/gi, 'anchorage')

  const vesselField = field(text, ['Vessel', 'Vessel name', "Ship's name", 'Ship name', 'Ship', 'MV', 'M\\.V\\.'])
  const name = vesselName(vesselField ?? (VESSEL_NAME.test(subject) ? subject : text))
  const imo = text.match(/\bIMO\s*(?:No\.?|Number)?\s*[:#]?\s*(\d{7})\b/i)?.[1]
  const flag =
    field(text, ['Flag', 'Nationality', 'Flag state']) ??
    FLAGS.find((f) => new RegExp(`\\b${f}\\b`, 'i').test(text))
  const typeText = field(text, ['Type', 'Vessel type', 'Ship type']) ?? vesselField ?? ''
  const crew =
    Number(field(text, ['Crew', 'Crew onboard', 'POB'])?.match(/\d+/)?.[0]) ||
    Number(text.match(/\b(\d+)[ \t]*(?:crew|pob|persons on board)\b/i)?.[1]) ||
    Number(text.match(/\bcrew[ \t]*(?:of[ \t]*)?(\d+)\b/i)?.[1]) ||
    undefined
  const voyage =
    Number(field(text, ['Voyage days', 'Days to next port', 'Voyage'])?.match(/\d+/)?.[0]) ||
    Number(text.match(/\b(\d+)[ \t]*days?\b/i)?.[1]) ||
    undefined
  const eta = field(text, ['ETA', 'Arrival'])
  const port = (v: string | undefined) => {
    const p = v?.replace(/\(.*?\)/g, '').split(/[,;]/)[0].trim()
    return p ? p.replace(/\b[a-z]/g, (c) => c.toUpperCase()) : undefined
  }
  const nrt = Number((field(text, ['NRT', 'N\\.R\\.T\\.', 'Net registered tonnage']) ?? text.match(/\bNRT[ \t:]*([\d,]+)/i)?.[1])?.replace(/[^\d]/g, '')) || undefined
  const voyageNo =
    field(text, ['Voyage No\\.?', 'Voy\\.? No\\.?', 'Voyage number'])?.split(/\s/)[0] ??
    text.match(/\bvoy(?:age)?\.?[ \t]+(?:no\.?[ \t]*)?([A-Z0-9-]*\d[A-Z0-9-]*)\b/i)?.[1]
  const departure = field(text, ['ETD', 'Departure', 'Date of departure']) ?? text.match(/\bETD[ \t:]+([^,.\n]+)/i)?.[1]?.trim()
  const nextPort = port(
    field(text, ['Next port', 'Next port of call']) ??
      text.match(/\bnext port(?: of call)?[ \t:]+([A-Za-z][A-Za-z .'-]*?)(?=\s*[,(.;\n]|$)/im)?.[1] ??
      text.match(/\b(?:sailing|bound|proceeding|heading)[ \t]+(?:to|for)[ \t]+([A-Za-z][A-Za-z .'-]*?)(?=\s*(?:[,(.;\n]|\d)|$)/im)?.[1],
  )
  const finalPort = port(
    field(text, ['Final port', 'Final port of call', 'Last port']) ??
      text.match(/\bfinal port(?: of call)?[ \t:]+([A-Za-z][A-Za-z .'-]*?)(?=\s*[,(.;\n]|$)/im)?.[1],
  )
  const location =
    SG_LOCATIONS.find((l) => plain.toLowerCase().includes(l.toLowerCase())) ?? field(text, ['Location', 'Berth', 'Anchorage'])

  const lines: OrderLine[] = []
  for (const row of text.split(/\r?\n/)) {
    if (/^\s*(from|to|subject|vessel|imo|flag|type|crew|eta|location|voyage|date|cc)\b/i.test(row)) continue
    const parsed = parseTableRow(row) ?? parseItemLine(row)
    if (parsed) lines.push({ ...parsed, idx: lines.length + 1 })
  }

  return {
    subject,
    agencyId: agency?.id,
    vessel: {
      name,
      imo,
      flag,
      type: guessVesselType(typeText),
      crew,
      voyageDays: voyage,
      location,
      eta,
      nrt,
      voyageNo,
      departure,
      nextPort,
      finalPort,
    },
    lines,
  }
}

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
  'KG', 'KGS', 'LTR', 'LTRS', 'DRUM', 'DRUMS', 'PAIL', 'PAILS', 'TRAY', 'TRAYS', 'PACK', 'PACKS', 'UNIT', 'UNITS',
])

function normUnit(u: string): string {
  const up = u.toUpperCase()
  const singular: Record<string, string> = {
    BAGS: 'BAG', CTNS: 'CTN', CARTON: 'CTN', CARTONS: 'CTN', BTLS: 'BTL', BOTTLE: 'BTL', BOTTLES: 'BTL',
    CASES: 'CASE', PCS: 'PC', EA: 'PC', SETS: 'SET', ROLLS: 'ROLL', CANS: 'CAN', BOXES: 'BOX', PKTS: 'PKT',
    TINS: 'TIN', KGS: 'KG', LTRS: 'LTR', DRUMS: 'DRUM', PAILS: 'PAIL', TRAYS: 'TRAY', PACKS: 'PACK', UNITS: 'UNIT',
  }
  return singular[up] ?? up
}

/** "RICE JASMINE 25KG BAG x 10" → { desc, qty: 10, orderUnit: "BAG" } */
export function parseItemLine(text: string): Omit<OrderLine, 'idx'> | null {
  const raw = text.trim()
  const s = raw.replace(/^\s*(?:\d{1,3}[.)]|[-*•])\s+/, '').trim()
  let desc: string
  let qty: number
  let unit = ''

  // "... x 24 BTL" / "... × 10"
  let m = s.match(/^(.*?)[\s,]*[x×]\s*(\d+(?:\.\d+)?)\s*([A-Za-z]+)?\s*$/i)
  if (m && m[1].trim()) {
    desc = m[1].trim()
    qty = Number(m[2])
    if (m[3] && UNIT_WORDS.has(m[3].toUpperCase())) unit = normUnit(m[3])
    else if (m[3]) return null
  } else {
    // "... QTY: 10 CTN" / "... 10 CTN"
    m = s.match(/^(.*?)\s+(?:QTY[:.]?\s*)?(\d+(?:\.\d+)?)\s*([A-Za-z]+)\s*$/i)
    if (!m || !UNIT_WORDS.has(m[3].toUpperCase()) || !m[1].trim()) return null
    desc = m[1].trim()
    qty = Number(m[2])
    unit = normUnit(m[3])
  }
  if (!unit) {
    const last = tokenize(desc).at(-1)
    if (last && UNIT_WORDS.has(last)) unit = normUnit(last)
  }
  if (!(qty > 0)) return null
  return { raw, desc: desc.toUpperCase(), qty, orderUnit: unit || 'UNIT' }
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

/** Best-effort reader for a pasted agency email. Used when the model is unavailable. */
export function heuristicRead(text: string, agencies: Agency[]): ReadResult {
  const from = field(text, ['From']) ?? ''
  const agency = agencies.find((a) => from.toLowerCase().includes(a.domain) || text.toLowerCase().includes(a.domain))
  const subject = field(text, ['Subject', 'Re']) ?? ''

  const vesselRaw = field(text, ['Vessel', 'Vessel name', 'Ship', 'MV', 'M\\.V\\.']) ?? subject.match(/\b(?:MV|M\/V|MT|M\/T)\s+[A-Z][A-Z0-9 ]+/)?.[0] ?? ''
  const name = vesselRaw.replace(/\(.*?\)/g, '').replace(/\s{2,}/g, ' ').trim().toUpperCase()
  const imo = text.match(/\bIMO\s*(?:No\.?|Number)?\s*[:#]?\s*(\d{7})\b/i)?.[1]
  const flag = field(text, ['Flag', 'Nationality', 'Flag state'])
  const typeText = field(text, ['Type', 'Vessel type', 'Ship type']) ?? vesselRaw
  const crew = Number(field(text, ['Crew', 'Crew onboard', 'POB'])?.match(/\d+/)?.[0]) || undefined
  const voyage =
    Number(field(text, ['Voyage days', 'Days to next port', 'Voyage'])?.match(/\d+/)?.[0]) ||
    Number(text.match(/\((\d+)\s*days?\)/i)?.[1]) ||
    undefined
  const eta = field(text, ['ETA', 'Arrival'])
  const location =
    SG_LOCATIONS.find((l) => text.toLowerCase().includes(l.toLowerCase())) ?? field(text, ['Location', 'Berth', 'Anchorage'])

  const lines: OrderLine[] = []
  for (const row of text.split(/\r?\n/)) {
    if (/^\s*(from|to|subject|vessel|imo|flag|type|crew|eta|location|voyage|date|cc)\b/i.test(row)) continue
    const parsed = parseItemLine(row)
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
    },
    lines,
  }
}

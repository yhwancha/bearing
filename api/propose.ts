/* Suggest a Singapore Customs route for order lines that have no rule yet.
   POST /api/propose { lines: [{desc, orderUnit}], products: [...], examples: [...] }
   → { proposals: [{desc, pattern, productSku, name, spec, unit, hs, category, sgClass, controlAuthority, rationKind, rationUnitQty, rationale}] }
   A person approves every suggestion before it becomes a rule. */

import { callJson, cors, errorResponse } from './_claude.js'

const SG_CLASSES = ['sea_store_paid', 'sea_store_unpaid', 'dutiable_liquor', 'dutiable_tobacco', 'controlled', 'ship_spare_install']
const RATION_KINDS = ['cigarettes', 'tobacco', 'cigars', 'spirits', 'wine', 'beer', '']

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['proposals'],
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['desc', 'pattern', 'productSku', 'name', 'spec', 'unit', 'hs', 'category', 'sgClass', 'controlAuthority', 'rationKind', 'rationUnitQty', 'rationale'],
        properties: {
          desc: { type: 'string', description: 'The input desc, copied exactly.' },
          pattern: { type: 'array', items: { type: 'string' }, description: '1-3 upper-case keywords from desc, in order, that identify the product. No sizes or quantities.' },
          productSku: { type: 'string', description: 'SKU of the catalog product this line is, or "" for a new product.' },
          name: { type: 'string', description: 'Plain English item name for the permit, e.g. "Centrifugal pump impeller".' },
          spec: { type: 'string', description: 'Pack or size from desc, e.g. "25 kg", "70 cl", "200 sticks", or "1 pc".' },
          unit: { type: 'string', description: 'Upper-case unit matching the ordered packaging.' },
          hs: { type: 'string', description: 'Best-guess 6-digit HS code with a dot, e.g. 8413.91, or "". The supplier confirms it.' },
          category: { type: 'string', description: 'Provisions, Bonded, Engine, Deck, Safety, Spares or General.' },
          sgClass: { type: 'string', enum: SG_CLASSES },
          controlAuthority: { type: 'string', description: 'Competent Authority for controlled items, else "".' },
          rationKind: { type: 'string', enum: RATION_KINDS, description: 'Only for dutiable liquor or tobacco, else "".' },
          rationUnitQty: { type: 'number', description: 'Ration units in one unit: sticks per carton, bottles per case, cans per case, grams per pouch. 0 if not dutiable.' },
          rationale: { type: 'string', description: 'One or two plain sentences on why this route, citing the wording in desc.' },
        },
      },
    },
  },
} as const

const SYSTEM = `You classify ship stores for a Singapore ship chandler under Singapore Customs rules for sea stores.
Routes:
- sea_store_paid: duty/GST-paid goods that are not controlled. No permit; reported on the monthly statement.
- sea_store_unpaid: duty/GST-unpaid stores from a licensed or zero-GST warehouse. TradeNet OUT permit (APS).
- dutiable_liquor: spirits, wine, beer and stout. Approved vessel types only; daily ration per crew: spirits 0.25 bottle, wine 0.25 bottle, beer 4 cans.
- dutiable_tobacco: cigarettes 40 sticks, smoking tobacco 15 g, cigars 3 sticks per crew per day.
- controlled: goods a Competent Authority controls (e.g. pyrotechnics → SPF Arms & Explosives). Approval first, then OUT (DRT).
- ship_spare_install: parts to be installed on the vessel during the call. Not sea stores; GST applies.
For parts, decide from the wording whether the item is installed during the call or kept on board as a spare, and say which words decided it.
Prefer an existing catalog product when the line is the same item. Follow the style of approved rules.`

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return
  const { lines, products, examples } = req.body ?? {}
  if (!Array.isArray(lines) || !lines.length) return res.status(400).json({ error: 'lines required' })
  const catalog = (products ?? []).map((p: any) => `- ${p.sku}: ${p.name} · ${p.spec} · ${p.unit} · ${p.sgClass ?? '?'}`).join('\n') || '(empty)'
  const approved = (examples ?? []).map((e: any) => `- ${e.pattern.join(' … ')} → ${e.name} (${e.sgClass})`).join('\n') || '(none)'
  const todo = lines.map((l: any) => `- desc: "${l.desc}" (ordered unit: ${l.orderUnit || '?'})`).join('\n')
  try {
    const out = await callJson(SYSTEM, `Catalog:\n${catalog}\n\nApproved rules:\n${approved}\n\nLines to classify:\n${todo}`, SCHEMA)
    return res.status(200).json(out)
  } catch (e) {
    return errorResponse(res, e)
  }
}

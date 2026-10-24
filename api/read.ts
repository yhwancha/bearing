/* Read a pasted ship-agency email into vessel particulars and order lines.
   POST /api/read { text, agencies: [{id, name, domain}] } → { subject, agencyId, vessel, lines } */

import { callJson, cors, errorResponse } from './_claude.js'

const VESSEL_TYPES = ['cargo', 'passenger', 'oil_rig', 'dredge', 'fishing', 'supply', 'tug', 'other', '']

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['subject', 'agencyId', 'vessel', 'lines'],
  properties: {
    subject: { type: 'string' },
    agencyId: { type: 'string', description: 'id of the sending agency from the list, or "" if none matches.' },
    vessel: {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'imo', 'flag', 'type', 'crew', 'voyageDays', 'location', 'eta', 'nrt', 'voyageNo', 'departure', 'nextPort', 'finalPort'],
      properties: {
        name: { type: 'string', description: 'Vessel name in upper case with its prefix, e.g. "MV OCEAN LYRA".' },
        imo: { type: 'string', description: '7-digit IMO number or "".' },
        flag: { type: 'string', description: 'Flag state in English, e.g. "Liberia", or "".' },
        type: { type: 'string', enum: VESSEL_TYPES, description: 'Map bulk/container/tanker/general cargo/car carrier to cargo; cruise/ferry to passenger; PSV/AHTS to supply; jack-up/drillship/FPSO to oil_rig. "" if not stated.' },
        crew: { type: 'integer', description: 'Persons on board, 0 if not stated.' },
        voyageDays: { type: 'integer', description: 'Days to the next port, 0 if not stated.' },
        location: { type: 'string', description: 'Berth or anchorage in the Port of Singapore, or "".' },
        eta: { type: 'string', description: 'ETA as written, or "".' },
        nrt: { type: 'integer', description: 'Net registered tonnage (NRT), 0 if not stated.' },
        voyageNo: { type: 'string', description: 'Outward voyage number as written, or "".' },
        departure: { type: 'string', description: 'Departure date/time (ETD) as written, or "".' },
        nextPort: { type: 'string', description: 'Next port of call, port name only, or "".' },
        finalPort: { type: 'string', description: 'Final port of call, port name only, or "".' },
      },
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw', 'desc', 'qty', 'orderUnit', 'code'],
        properties: {
          raw: { type: 'string', description: 'The line exactly as written.' },
          desc: { type: 'string', description: 'Item description in upper case, without the quantity and order unit.' },
          qty: { type: 'number', description: 'Ordered quantity, copied from the line. Never computed.' },
          orderUnit: { type: 'string', description: 'Order unit in upper case singular, e.g. BAG, CTN, BTL, CASE, PC. If the line has no unit, "".' },
          code: { type: 'string', description: 'Item code written on the line, e.g. a 6-digit IMPA code, or "".' },
        },
      },
    },
  },
} as const

const SYSTEM = `You read stores orders that ship agencies email to a ship chandler in Singapore.
Extract the vessel particulars and every ordered line. Copy numbers exactly as written; never calculate or guess.
Leave a field empty ("" or 0) when the email does not state it. Ignore greetings, signatures and notes that are not order lines.
Orders come in many shapes: numbered lists, tables with IMPA codes, quantity-first lines, forwarded requisitions from the master,
and shorthand like "water 30" or "smokes 8 ctn". Vessel particulars may sit in a sentence instead of labelled fields.`

export default async function handler(req: any, res: any) {
  if (cors(req, res)) return
  const { text, agencies } = req.body ?? {}
  if (typeof text !== 'string' || !text.trim()) return res.status(400).json({ error: 'text required' })
  const list = (Array.isArray(agencies) ? agencies : []).map((a: any) => `- ${a.id}: ${a.name} (${a.domain})`).join('\n') || '(none)'
  try {
    const out = await callJson(SYSTEM, `Agencies:\n${list}\n\nEmail:\n"""\n${text.slice(0, 20000)}\n"""`, SCHEMA)
    return res.status(200).json(out)
  } catch (e) {
    return errorResponse(res, e)
  }
}

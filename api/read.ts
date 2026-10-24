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
      required: ['name', 'imo', 'flag', 'type', 'crew', 'voyageDays', 'location', 'eta'],
      properties: {
        name: { type: 'string', description: 'Vessel name in upper case with its prefix, e.g. "MV OCEAN LYRA".' },
        imo: { type: 'string', description: '7-digit IMO number or "".' },
        flag: { type: 'string', description: 'Flag state in English, e.g. "Liberia", or "".' },
        type: { type: 'string', enum: VESSEL_TYPES, description: 'Map bulk/container/tanker/general cargo/car carrier to cargo; cruise/ferry to passenger; PSV/AHTS to supply; jack-up/drillship/FPSO to oil_rig. "" if not stated.' },
        crew: { type: 'integer', description: 'Persons on board, 0 if not stated.' },
        voyageDays: { type: 'integer', description: 'Days to the next port, 0 if not stated.' },
        location: { type: 'string', description: 'Berth or anchorage in the Port of Singapore, or "".' },
        eta: { type: 'string', description: 'ETA as written, or "".' },
      },
    },
    lines: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['raw', 'desc', 'qty', 'orderUnit'],
        properties: {
          raw: { type: 'string', description: 'The line exactly as written.' },
          desc: { type: 'string', description: 'Item description in upper case, without the quantity and order unit.' },
          qty: { type: 'number', description: 'Ordered quantity, copied from the line. Never computed.' },
          orderUnit: { type: 'string', description: 'Order unit in upper case singular, e.g. BAG, CTN, BTL, CASE, PC.' },
        },
      },
    },
  },
} as const

const SYSTEM = `You read stores orders that ship agencies email to a ship chandler in Singapore.
Extract the vessel particulars and every ordered line. Copy numbers exactly as written; never calculate or guess.
Leave a field empty ("" or 0) when the email does not state it. Ignore greetings, signatures and notes that are not order lines.`

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

/* Demo workspace for Singapore. All companies, vessels and permit numbers are fictional.
   Dates are relative to today so the demo always looks current. */

import { heuristicRead, resolveLines } from './engine'
import { splitSgDeclaration } from './sg'
import type { Agency, Order, Product, Rule, State } from './types'

export const AGENCIES: Agency[] = [
  { id: 'ag_straits', name: 'Straits Line Agencies (Demo)', domain: 'straitsline.demo', uen: '2019DEMO02A' },
  { id: 'ag_merlion', name: 'Merlion Ship Agency (Demo)', domain: 'merlion-agency.demo', uen: '2017DEMO03M' },
]

const P = (p: Product) => p

export const PRODUCTS: Product[] = [
  P({ id: 'p_rice', sku: 'PRV-1001', name: 'Thai jasmine rice', spec: '25 kg', unit: 'BAG', hs: '1006.30', category: 'Provisions', price: 46, origin: 'TH', sgClass: 'sea_store_paid' }),
  P({ id: 'p_eggs', sku: 'PRV-1002', name: 'Fresh eggs', spec: '30 pcs', unit: 'TRAY', hs: '0407.21', category: 'Provisions', price: 9.5, origin: 'MY', sgClass: 'sea_store_paid' }),
  P({ id: 'p_water', sku: 'PRV-1003', name: 'Drinking water', spec: '1.5 L × 12', unit: 'CASE', hs: '2201.10', category: 'Provisions', price: 6.8, origin: 'MY', sgClass: 'sea_store_paid' }),
  P({ id: 'p_oil', sku: 'PRV-1004', name: 'Vegetable cooking oil', spec: '18 L', unit: 'TIN', hs: '1512.19', category: 'Provisions', price: 52, origin: 'MY', sgClass: 'sea_store_paid' }),
  P({ id: 'p_noodle', sku: 'PRV-1005', name: 'Instant noodles', spec: '30 packs', unit: 'CTN', hs: '1902.30', category: 'Provisions', price: 24, origin: 'ID', sgClass: 'sea_store_paid' }),
  P({ id: 'p_coffee', sku: 'PRV-1006', name: 'Coffee mix 3-in-1', spec: '50 sachets', unit: 'BAG', hs: '2101.12', category: 'Provisions', price: 11, origin: 'MY', sgClass: 'sea_store_paid' }),
  P({ id: 'p_whisky', sku: 'BND-2001', name: 'Scotch whisky', spec: '70 cl', unit: 'BTL', hs: '2208.30', category: 'Bonded', price: 38, origin: 'GB', sgClass: 'dutiable_liquor', rationKind: 'spirits', rationUnitQty: 1 }),
  P({ id: 'p_wine', sku: 'BND-2002', name: 'Red wine', spec: '75 cl', unit: 'BTL', hs: '2204.21', category: 'Bonded', price: 16, origin: 'FR', sgClass: 'dutiable_liquor', rationKind: 'wine', rationUnitQty: 1 }),
  P({ id: 'p_beer', sku: 'BND-2003', name: 'Lager beer', spec: '330 ml × 24 cans', unit: 'CASE', hs: '2203.00', category: 'Bonded', price: 42, origin: 'SG', sgClass: 'dutiable_liquor', rationKind: 'beer', rationUnitQty: 24 }),
  P({ id: 'p_cig', sku: 'BND-2004', name: 'Cigarettes', spec: '200 sticks', unit: 'CTN', hs: '2402.20', category: 'Bonded', price: 31, origin: 'ID', sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', rationUnitQty: 200 }),
  P({ id: 'p_lube', sku: 'ENG-3001', name: 'Marine engine oil SAE 40', spec: '20 L', unit: 'PAIL', hs: '2710.19', category: 'Engine', price: 95, origin: 'SG', sgClass: 'sea_store_unpaid' }),
  P({ id: 'p_rope', sku: 'DCK-4001', name: 'Polypropylene mooring rope', spec: '40 mm × 220 m', unit: 'COIL', hs: '5607.49', category: 'Deck', price: 410, origin: 'CN', sgClass: 'sea_store_paid' }),
  P({ id: 'p_clean', sku: 'DCK-4002', name: 'Deck cleaner, alkaline', spec: '25 L', unit: 'DRUM', hs: '3402.90', category: 'Deck', price: 64, origin: 'SG', sgClass: 'sea_store_paid' }),
  P({ id: 'p_flare', sku: 'SAF-5001', name: 'Red hand flare, SOLAS', spec: '1 pc', unit: 'PC', hs: '3604.90', category: 'Safety', price: 58, origin: 'GB', sgClass: 'controlled', controlAuthority: 'SPF Arms & Explosives' }),
  P({ id: 'p_glove', sku: 'SAF-5002', name: 'Cotton work gloves', spec: '12 pairs', unit: 'PKT', hs: '6116.92', category: 'Safety', price: 14, origin: 'CN', sgClass: 'sea_store_paid' }),
]

const R = (id: string, pattern: string[], productId: string): Rule => ({
  id, pattern, productId, agencyId: null, source: 'seed', createdAt: '2026-09-01T00:00:00.000Z',
})

export const RULES: Rule[] = [
  R('r_rice', ['RICE', 'JASMINE'], 'p_rice'),
  R('r_eggs', ['EGG*'], 'p_eggs'),
  R('r_water', ['*WATER'], 'p_water'),
  R('r_oil', ['COOKING', 'OIL'], 'p_oil'),
  R('r_noodle', ['*NOODLE*'], 'p_noodle'),
  R('r_coffee', ['COFFEE'], 'p_coffee'),
  R('r_whisky', ['WHISK*'], 'p_whisky'),
  R('r_wine', ['WINE'], 'p_wine'),
  R('r_beer', ['BEER'], 'p_beer'),
  R('r_cig', ['CIGARETTE*'], 'p_cig'),
  R('r_lube', ['ENGINE', 'OIL'], 'p_lube'),
  R('r_rope', ['ROPE'], 'p_rope'),
  R('r_clean', ['DECK', 'CLEAN*'], 'p_clean'),
  R('r_flare', ['HAND', 'FLARE*'], 'p_flare'),
  R('r_glove', ['GLOVE*'], 'p_glove'),
]

/** The order the demo is built around: a tobacco ration trap, an installation spare and a controlled item. */
export const TRAP_EMAIL = `From: ops@straitsline.demo
Subject: Stores supply — MV OCEAN LYRA / Western Anchorage
Vessel: MV OCEAN LYRA
IMO: 9734512
Flag: Liberia
Type: Bulk carrier
NRT: 18,450
Voyage No: OL-2611
Crew: 20
ETA: 26 Oct 08:00
ETD: 27 Oct 18:00
Next port: Port Hedland (5 days)
Final port: Qingdao
Location: Western Anchorage

Dear team, please supply the following on arrival:

1. RICE JASMINE 25KG BAG x 10
2. WHISKY 70CL x 24 BTL
3. CIGARETTES 200S CTN x 60
4. PUMP IMPELLER FOR INSTALLATION x 1
5. RED HAND FLARES SOLAS x 6 PCS
6. EGGS FRESH 30PCS TRAY x 12

Best regards,
Ops desk, Straits Line Agencies`

/* Sample emails for the new-order window. Each is a different real-world shape of order,
   so the demo shows the reader coping with more than one tidy format. */

/** Typed in a hurry: shorthand, missing units, slang, particulars in one sentence, no vessel type. */
const SAMPLE_SHORTHAND = `From: dennis.tan@merlion-agency.demo
Subject: urgent - mv sea heron

hi team, mv sea heron (panama, imo 9614402) at western anch, eta 1400 today.
20 crew, sailing to manila 4 days. pls send asap:

water 30
eggs 10
rice 5 bag
coffee 3in1 6
beer 10 cs
smokes 8 ctn

tks
dennis`

/** The master's requisition forwarded as a table with IMPA codes. Duty-paid only: no permit, monthly statement. */
const SAMPLE_IMPA = `From: husbandry@merlion-agency.demo
Subject: FW: Requisition REQ-PW-1026 / MV PACIFIC WREN

Please find below the master's requisition for supply at Keppel Terminal.

Ship's name : MV PACIFIC WREN
IMO No.     : 9811460
Flag state  : Hong Kong
Ship type   : Container ship
NRT         : 25,310
Voyage No.  : 061N
POB         : 21
ETD         : 25 Oct 06:00
Next port   : Busan, ETA in 7 days
Final port  : Los Angeles

IMPA   | DESCRIPTION                 | UNIT | QTY
000105 | RICE JASMINE 25KG           | BAG  | 12
000210 | EGGS FRESH 30PCS            | TRAY | 20
000330 | DRINKING WATER 1.5L X 12    | CASE | 50
000412 | INSTANT NOODLES 30 PKT      | CTN  | 15
000515 | COFFEE 3IN1 50 SACHET       | BAG  | 10
210301 | MOORING ROPE PP 40MM X 220M | COIL | 1
190104 | WORK GLOVES COTTON          | PKT  | 10`

/** Forwarded from the ship, quantity before the item. Bonded stores inside the ration: one APS permit, nothing blocking. */
const SAMPLE_BONDED = `From: ops@straitsline.demo
Subject: Fwd: Bonded stores - MT AMBER TIDE

---------- Forwarded message ----------
From: Master MT AMBER TIDE <master.ambertide@shipmail.demo>
Date: Fri, 24 Oct 2026 06:12

Dear Chandler,

Kindly arrange the following bonded stores before departure from Eastern Petroleum Anchorage.
Vessel: MT AMBER TIDE / product tanker / Bahamas flag / IMO 9702245 / NRT 8,140
Crew 25. Voyage 2643W, ETD 24 Oct 22:00, next port Kaohsiung (approx. 10 days), final port Ulsan.

36 BTL  Whisky 70cl
24 BTL  Red wine 75cl
20 CASE Beer 330ml
40 CTN  Cigarettes 200s
8 PAIL  Engine oil SAE40 20L

Please deliver together with the customs permit.
Capt. R. Santos
Master, MT AMBER TIDE`

/** Sample emails offered in the new-order window. `preview` is the excerpt shown on the card. */
export const SAMPLES = [
  { id: 'mixed', email: TRAP_EMAIL, preview: 'Vessel: MV OCEAN LYRA\n3. CIGARETTES 200S CTN x 60\n4. PUMP IMPELLER FOR INSTALLATION x 1' },
  { id: 'shorthand', email: SAMPLE_SHORTHAND, preview: 'mv sea heron (panama, imo 9614402)\nwater 30\nsmokes 8 ctn' },
  { id: 'impa', email: SAMPLE_IMPA, preview: 'IMPA   | DESCRIPTION       | QTY\n000105 | RICE JASMINE 25KG | 12\n210301 | MOORING ROPE PP   | 1' },
  { id: 'bonded', email: SAMPLE_BONDED, preview: 'Fwd: Bonded stores - MT AMBER TIDE\n36 BTL  Whisky 70cl\n40 CTN  Cigarettes 200s' },
] as const

export type SampleId = (typeof SAMPLES)[number]['id']

const EMAIL_CORAL = `From: husbandry@merlion-agency.demo
Subject: MT CORAL BREEZE provisions
Vessel: MT CORAL BREEZE
IMO: 9651187
Flag: Marshall Islands
Type: Product tanker
NRT: 14,280
Voyage No: CB-0917
Crew: 24
ETD: 18 Oct 20:00
Next port: Fujairah (9 days)
Final port: Rotterdam
Location: Eastern Petroleum Anchorage

1. RICE JASMINE 25KG BAG x 8
2. DRINKING WATER 1.5L x 40 CASES
3. COOKING OIL 18L x 4 TINS
4. INSTANT NOODLES x 10 CTN
5. COFFEE 3IN1 x 12 BAGS
6. BEER 330ML CASE x 6`

const EMAIL_KESTREL = `From: ops@straitsline.demo
Subject: MV KESTREL TRADER — deck & engine stores
Vessel: MV KESTREL TRADER
IMO: 9488216
Flag: Panama
Type: Container ship
NRT: 31,060
Voyage No: 0442W
Crew: 22
ETD: 25 Oct 02:00
Next port: Colombo (6 days)
Final port: Felixstowe
Location: Pasir Panjang Terminal

1. MOORING ROPE PP 40MM x 2 COIL
2. DECK CLEANER ALKALINE 25L x 6 DRUMS
3. ENGINE OIL SAE40 20L x 10 PAIL
4. WORK GLOVES COTTON x 20 PKT
5. EGGS 30PCS x 15 TRAY`

const EMAIL_HARBOUR = `From: husbandry@merlion-agency.demo
Subject: MV HARBOUR JADE — provisions
Vessel: MV HARBOUR JADE
IMO: 9590034
Flag: Singapore
Type: General cargo
NRT: 4,920
Voyage No: HJ-118
Crew: 18
ETD: 17 Oct 21:00
Next port: Manila (4 days)
Final port: Manila
Location: Jurong Port

1. RICE JASMINE 25KG BAG x 6
2. EGGS 30PCS x 10 TRAY
3. DRINKING WATER x 30 CASES
4. RED WINE 75CL x 12 BTL`

function daysAgo(n: number, hour = 9): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, 0, 0, 0)
  return d.toISOString()
}

function minutesAgo(n: number): string {
  return new Date(Date.now() - n * 60_000).toISOString()
}

function makeOrder(id: string, ref: string, email: string, receivedAt: string): Order {
  const r = heuristicRead(email, AGENCIES)
  return {
    id, ref, agencyId: r.agencyId ?? AGENCIES[0].id, receivedAt, subject: r.subject, raw: email,
    vessel: r.vessel, lines: r.lines, jurisdiction: 'SG', currency: 'SGD', readSource: 'heuristic',
  }
}

/** Freeze the declaration and record delivery, as if the order went through the app. */
function completed(o: Order, opts: { filedAt: string; permit?: string; deliveredAt?: string; short?: Record<number, number> }): Order {
  const lines = resolveLines(o.lines, o.agencyId, RULES, PRODUCTS, [])
  const decl = { ...splitSgDeclaration(lines, o.vessel), confirmedAt: opts.filedAt, tradenetPermitNo: opts.permit }
  const checked = Object.fromEntries(o.lines.map((l) => [l.idx, opts.short?.[l.idx] ?? l.qty]))
  return {
    ...o,
    decl,
    delivery: opts.deliveredAt ? { at: opts.deliveredAt, receivedBy: 'Chief Officer', checked } : undefined,
  }
}

export function seedState(): State {
  // Keep earlier-in-month deliveries inside the current month so the statement has data
  const today = new Date().getDate()
  const early = Math.max(0, Math.min(today - 1, 6))
  return {
    version: 1,
    workspace: { name: 'Lion Gate Ship Supply (Demo)', uen: '2026DEMO01K' },
    agencies: AGENCIES,
    products: PRODUCTS,
    rules: RULES,
    proposals: [],
    orders: [
      makeOrder('o_lyra', 'SO-2026-0148', TRAP_EMAIL, minutesAgo(42)),
      completed(makeOrder('o_kestrel', 'SO-2026-0147', EMAIL_KESTREL, daysAgo(0, 7)), {
        filedAt: minutesAgo(180),
        permit: 'DEMO26A0047812',
      }),
      completed(makeOrder('o_coral', 'SO-2026-0141', EMAIL_CORAL, daysAgo(early + 1)), {
        filedAt: daysAgo(early + 1, 11),
        permit: 'DEMO26A0046120',
        deliveredAt: daysAgo(early, 15),
        short: { 2: 36 },
      }),
      completed(makeOrder('o_harbour', 'SO-2026-0133', EMAIL_HARBOUR, daysAgo(early + 2)), {
        filedAt: daysAgo(early + 2, 10),
        permit: 'DEMO26A0045503',
        deliveredAt: daysAgo(early + 1, 16),
      }),
    ],
    touched: false,
  }
}

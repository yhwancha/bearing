/* Demo workspace for Singapore. All companies, vessels and permit numbers are fictional.
   Dates are relative to today so the demo always looks current. */

import { heuristicRead, resolveLines } from './engine'
import { splitSgDeclaration } from './sg'
import type { Agency, Order, Product, Rule, State } from './types'

export const AGENCIES: Agency[] = [
  { id: 'ag_straits', name: 'Straits Line Agencies (Demo)', domain: 'straitsline.demo' },
  { id: 'ag_merlion', name: 'Merlion Ship Agency (Demo)', domain: 'merlion-agency.demo' },
]

const P = (p: Product) => p

export const PRODUCTS: Product[] = [
  P({ id: 'p_rice', sku: 'PRV-1001', name: 'Thai jasmine rice', spec: '25 kg', unit: 'BAG', hs: '1006.30', category: 'Provisions', price: 46, sgClass: 'sea_store_paid' }),
  P({ id: 'p_eggs', sku: 'PRV-1002', name: 'Fresh eggs', spec: '30 pcs', unit: 'TRAY', hs: '0407.21', category: 'Provisions', price: 9.5, sgClass: 'sea_store_paid' }),
  P({ id: 'p_water', sku: 'PRV-1003', name: 'Drinking water', spec: '1.5 L × 12', unit: 'CASE', hs: '2201.10', category: 'Provisions', price: 6.8, sgClass: 'sea_store_paid' }),
  P({ id: 'p_oil', sku: 'PRV-1004', name: 'Vegetable cooking oil', spec: '18 L', unit: 'TIN', hs: '1512.19', category: 'Provisions', price: 52, sgClass: 'sea_store_paid' }),
  P({ id: 'p_noodle', sku: 'PRV-1005', name: 'Instant noodles', spec: '30 packs', unit: 'CTN', hs: '1902.30', category: 'Provisions', price: 24, sgClass: 'sea_store_paid' }),
  P({ id: 'p_coffee', sku: 'PRV-1006', name: 'Coffee mix 3-in-1', spec: '50 sachets', unit: 'BAG', hs: '2101.12', category: 'Provisions', price: 11, sgClass: 'sea_store_paid' }),
  P({ id: 'p_whisky', sku: 'BND-2001', name: 'Scotch whisky', spec: '70 cl', unit: 'BTL', hs: '2208.30', category: 'Bonded', price: 38, sgClass: 'dutiable_liquor', rationKind: 'spirits', rationUnitQty: 1 }),
  P({ id: 'p_wine', sku: 'BND-2002', name: 'Red wine', spec: '75 cl', unit: 'BTL', hs: '2204.21', category: 'Bonded', price: 16, sgClass: 'dutiable_liquor', rationKind: 'wine', rationUnitQty: 1 }),
  P({ id: 'p_beer', sku: 'BND-2003', name: 'Lager beer', spec: '330 ml × 24 cans', unit: 'CASE', hs: '2203.00', category: 'Bonded', price: 42, sgClass: 'dutiable_liquor', rationKind: 'beer', rationUnitQty: 24 }),
  P({ id: 'p_cig', sku: 'BND-2004', name: 'Cigarettes', spec: '200 sticks', unit: 'CTN', hs: '2402.20', category: 'Bonded', price: 31, sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', rationUnitQty: 200 }),
  P({ id: 'p_lube', sku: 'ENG-3001', name: 'Marine engine oil SAE 40', spec: '20 L', unit: 'PAIL', hs: '2710.19', category: 'Engine', price: 95, sgClass: 'sea_store_unpaid' }),
  P({ id: 'p_rope', sku: 'DCK-4001', name: 'Polypropylene mooring rope', spec: '40 mm × 220 m', unit: 'COIL', hs: '5607.49', category: 'Deck', price: 410, sgClass: 'sea_store_paid' }),
  P({ id: 'p_clean', sku: 'DCK-4002', name: 'Deck cleaner, alkaline', spec: '25 L', unit: 'DRUM', hs: '3402.90', category: 'Deck', price: 64, sgClass: 'sea_store_paid' }),
  P({ id: 'p_flare', sku: 'SAF-5001', name: 'Red hand flare, SOLAS', spec: '1 pc', unit: 'PC', hs: '3604.90', category: 'Safety', price: 58, sgClass: 'controlled', controlAuthority: 'SPF Arms & Explosives' }),
  P({ id: 'p_glove', sku: 'SAF-5002', name: 'Cotton work gloves', spec: '12 pairs', unit: 'PKT', hs: '6116.92', category: 'Safety', price: 14, sgClass: 'sea_store_paid' }),
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
Crew: 20
ETA: 26 Oct 08:00
Next port: Port Hedland (5 days)
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

const EMAIL_CORAL = `From: husbandry@merlion-agency.demo
Subject: MT CORAL BREEZE provisions
Vessel: MT CORAL BREEZE
IMO: 9651187
Flag: Marshall Islands
Type: Product tanker
Crew: 24
Next port: Fujairah (9 days)
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
Crew: 22
Next port: Colombo (6 days)
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
Crew: 18
Next port: Manila (4 days)
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

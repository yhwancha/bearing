/* Offline classification suggestions, used when the model is unavailable.
   Keyword defaults only — a person approves every suggestion before it becomes a rule. */

import { tokenize } from './engine'
import type { Product, Proposal, RationKind, SgClass } from './types'

type Draft = Proposal['draft']

interface Hint {
  test: RegExp
  sgClass: SgClass
  category: string
  rationKind?: RationKind
  controlAuthority?: string
  why: string
}

const HINTS: Hint[] = [
  { test: /\b(FOR INSTALLATION|TO BE INSTALLED|INSTALL(ED|ING)?|FITTING ON BOARD)\b/, sgClass: 'ship_spare_install', category: 'Spares', why: 'The order says the part is for installation on the vessel, so it is not a sea store and GST applies.' },
  { test: /\b(WHISK(E)?Y|VODKA|GIN|RUM|BRANDY|COGNAC|TEQUILA|LIQUEUR|SPIRIT)S?\b/, sgClass: 'dutiable_liquor', rationKind: 'spirits', category: 'Bonded', why: 'Spirits are dutiable liquor: approved vessel and the 0.25 bottle daily ration apply.' },
  { test: /\bWINES?\b/, sgClass: 'dutiable_liquor', rationKind: 'wine', category: 'Bonded', why: 'Wine is dutiable liquor: approved vessel and the 0.25 bottle daily ration apply.' },
  { test: /\b(BEER|LAGER|STOUT|ALE)S?\b/, sgClass: 'dutiable_liquor', rationKind: 'beer', category: 'Bonded', why: 'Beer is dutiable liquor: approved vessel and the 4 can daily ration apply.' },
  { test: /\bCIGARS?\b|\bCHEROOTS?\b/, sgClass: 'dutiable_tobacco', rationKind: 'cigars', category: 'Bonded', why: 'Cigars are dutiable tobacco with a 3 stick daily ration.' },
  { test: /\bCIGARETTES?\b/, sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', category: 'Bonded', why: 'Cigarettes are dutiable tobacco with a 40 stick daily ration.' },
  { test: /\bTOBACCO\b/, sgClass: 'dutiable_tobacco', rationKind: 'tobacco', category: 'Bonded', why: 'Smoking tobacco is dutiable with a 15 g daily ration.' },
  { test: /\b(FLARES?|PYROTECHNIC|ROCKETS?|LINE THROW(ING|ER)?|SMOKE SIGNAL)\b/, sgClass: 'controlled', controlAuthority: 'SPF Arms & Explosives', category: 'Safety', why: 'Pyrotechnics are controlled explosives and need Competent Authority approval.' },
  { test: /\b(IMPELLER|VALVE|GASKET|BEARING|SEAL|FILTER|PISTON|LINER|INJECTOR|PUMP)S?\b/, sgClass: 'sea_store_paid', category: 'Spares', why: 'Spare kept on board as stores. If it will be installed during the call, classify it as a spare for installation instead.' },
]

const NOISE = /^(\d+([.,]\d+)?[A-Z]*|X|FOR|THE|OF|AND|WITH|PCS?|CTN|BTL|BAG|CASE|EA|SET|FRESH|NEW)$/

/** 1–3 distinctive tokens, in order, to recognise the wording next time. */
export function patternFor(desc: string): string[] {
  return tokenize(desc).filter((t) => !NOISE.test(t)).slice(0, 3)
}

function title(desc: string): string {
  return patternFor(desc)
    .filter((t) => !/^(INSTALL\w*|SPARE|SOLAS)$/.test(t))
    .map((t) => t.charAt(0) + t.slice(1).toLowerCase())
    .join(' ')
}

/** Find a catalog product that shares the pattern's words. */
export function matchProduct(desc: string, products: Product[]): Product | undefined {
  const words = new Set(patternFor(desc))
  let best: { p: Product; score: number } | undefined
  for (const p of products) {
    const score = tokenize(p.name).filter((w) => words.has(w)).length
    if (score >= 2 && (!best || score > best.score)) best = { p, score }
  }
  return best?.p
}

export function heuristicPropose(desc: string, orderUnit: string, products: Product[]): { draft: Draft; productId?: string; rationale: string } {
  const up = desc.toUpperCase()
  const hint = HINTS.find((h) => h.test.test(up))
  const linked = matchProduct(desc, products)
  if (linked && (!hint || hint.sgClass === linked.sgClass)) {
    const { id, sku: _sku, ...rest } = linked
    return { draft: rest, productId: id, rationale: `Matches catalog item ${linked.sku} (${linked.name}).` }
  }
  const sticks = up.match(/\b(\d+)\s*S\b/)
  return {
    draft: {
      name: title(desc),
      spec: up.match(/\b\d+(?:\.\d+)?\s*(?:KG|G|L|ML|CL|MM|M)\b/)?.[0].toLowerCase() ?? '1 pc',
      unit: orderUnit || 'PC',
      hs: '',
      category: hint?.category ?? 'General',
      sgClass: hint?.sgClass ?? 'sea_store_paid',
      controlAuthority: hint?.controlAuthority,
      rationKind: hint?.rationKind,
      rationUnitQty: hint?.rationKind === 'cigarettes' ? Number(sticks?.[1] ?? 200) : hint?.rationKind ? 1 : undefined,
    },
    rationale: hint?.why ?? 'No keyword matched. Defaulted to a duty-paid general store; check before approving.',
  }
}

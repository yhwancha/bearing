/* Classification suggestions for lines without a rule: the model first, offline keywords as fallback. */

import { heuristicPropose, patternFor } from '../heuristics'
import { uid } from '../format'
import type { Order, Product, Proposal, RationKind, ResolvedLine, Rule, SgClass } from '../types'
import { postJson } from './api'

export interface ProposeOutcome {
  proposals: Proposal[]
  source: 'ai' | 'heuristic'
  fallbackReason?: string
}

interface ApiProposal {
  desc: string
  pattern: string[]
  productSku: string
  name: string
  spec: string
  unit: string
  hs: string
  category: string
  sgClass: SgClass
  controlAuthority: string
  rationKind: RationKind | ''
  rationUnitQty: number
  rationale: string
}

function offline(order: Order, lines: ResolvedLine[], products: Product[], now: string): Proposal[] {
  return lines.map((l) => {
    const h = heuristicPropose(l.desc, l.orderUnit, products)
    return {
      id: uid('pr'), orderId: order.id, agencyId: order.agencyId, desc: l.desc, pattern: patternFor(l.desc),
      productId: h.productId, draft: h.draft, rationale: h.rationale, source: 'heuristic', status: 'pending', createdAt: now,
    }
  })
}

export async function proposeFor(order: Order, lines: ResolvedLine[], products: Product[], rules: Rule[] = []): Promise<ProposeOutcome> {
  const now = new Date().toISOString()
  try {
    const examples = rules
      .filter((r) => r.source === 'approved')
      .slice(-20)
      .map((r) => {
        const p = products.find((x) => x.id === r.productId)
        return { pattern: r.pattern, name: p?.name ?? '', sgClass: p?.sgClass ?? '' }
      })
    const out = await postJson<{ proposals: ApiProposal[] }>('/api/propose', {
      lines: lines.map((l) => ({ desc: l.desc, orderUnit: l.orderUnit })),
      products: products.map(({ sku, name, spec, unit, sgClass }) => ({ sku, name, spec, unit, sgClass })),
      examples,
    })
    const proposals = lines.map((l): Proposal => {
      const a = out.proposals.find((p) => p.desc === l.desc)
      if (!a) return offline(order, [l], products, now)[0]
      const linked = a.productSku ? products.find((p) => p.sku === a.productSku) : undefined
      const dutiable = a.sgClass === 'dutiable_liquor' || a.sgClass === 'dutiable_tobacco'
      return {
        id: uid('pr'), orderId: order.id, agencyId: order.agencyId, desc: l.desc,
        pattern: a.pattern.map((t) => t.toUpperCase()).filter(Boolean).slice(0, 3),
        productId: linked?.id,
        draft: {
          name: a.name, spec: a.spec, unit: a.unit || l.orderUnit, hs: a.hs, category: a.category, sgClass: a.sgClass,
          controlAuthority: a.sgClass === 'controlled' ? a.controlAuthority || 'Competent Authority' : undefined,
          rationKind: dutiable && a.rationKind ? a.rationKind : undefined,
          rationUnitQty: dutiable ? a.rationUnitQty || 1 : undefined,
          price: linked?.price,
        },
        rationale: a.rationale, source: 'ai', status: 'pending', createdAt: now,
      }
    })
    return { proposals, source: 'ai' }
  } catch (e) {
    return { proposals: offline(order, lines, products, now), source: 'heuristic', fallbackReason: e instanceof Error ? e.message : 'AI unavailable' }
  }
}

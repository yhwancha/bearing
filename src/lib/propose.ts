/* Classification suggestions for lines without a rule. */

import { heuristicPropose, patternFor } from '../heuristics'
import type { Order, Product, Proposal, ResolvedLine } from '../types'
import { uid } from '../format'

export interface ProposeOutcome {
  proposals: Proposal[]
  source: 'ai' | 'heuristic'
  fallbackReason?: string
}

export async function proposeFor(order: Order, lines: ResolvedLine[], products: Product[]): Promise<ProposeOutcome> {
  const now = new Date().toISOString()
  const proposals = lines.map((l): Proposal => {
    const h = heuristicPropose(l.desc, l.orderUnit, products)
    return {
      id: uid('pr'), orderId: order.id, agencyId: order.agencyId, desc: l.desc, pattern: patternFor(l.desc),
      productId: h.productId, draft: h.draft, rationale: h.rationale, source: 'heuristic', status: 'pending', createdAt: now,
    }
  })
  return { proposals, source: 'heuristic', fallbackReason: 'Offline suggestions' }
}

/* State changes. Every write goes through `update`, which persists and notifies. */

import type { ReadResult } from './engine'
import { uid } from './format'
import { update } from './store'
import type { Delivery, Order, Product, Proposal, Rule, SgDeclaration, VesselInfo } from './types'

function patchOrder(id: string, fn: (o: Order) => Order) {
  update((s) => ({ ...s, orders: s.orders.map((o) => (o.id === id ? fn(o) : o)) }))
}

export function nextRef(orders: Order[]): string {
  const year = new Date().getFullYear()
  const max = orders
    .map((o) => Number(o.ref.match(/-(\d+)$/)?.[1] ?? 0))
    .reduce((a, b) => Math.max(a, b), 0)
  return `SO-${year}-${String(max + 1).padStart(4, '0')}`
}

export function addOrder(read: ReadResult, raw: string, agencyId: string, source: Order['readSource']): string {
  const id = uid('o')
  update((s) => ({
    ...s,
    orders: [
      {
        id,
        ref: nextRef(s.orders),
        agencyId,
        receivedAt: new Date().toISOString(),
        subject: read.subject || `Stores for ${read.vessel.name || 'vessel'}`,
        raw,
        vessel: read.vessel,
        lines: read.lines,
        jurisdiction: 'SG',
        currency: 'SGD',
        readSource: source,
      },
      ...s.orders,
    ],
  }))
  return id
}

export function updateVessel(id: string, patch: Partial<VesselInfo>) {
  patchOrder(id, (o) => ({ ...o, vessel: { ...o.vessel, ...patch } }))
}

export function updateLineQty(id: string, idx: number, qty: number) {
  patchOrder(id, (o) => ({ ...o, lines: o.lines.map((l) => (l.idx === idx ? { ...l, qty } : l)) }))
}

export function deleteOrder(id: string) {
  update((s) => ({ ...s, orders: s.orders.filter((o) => o.id !== id), proposals: s.proposals.filter((p) => p.orderId !== id) }))
}

/* ---------- Classification ---------- */

export function addProposals(list: Proposal[]) {
  update((s) => ({
    ...s,
    // A new suggestion for the same wording replaces the old pending one
    proposals: [...s.proposals.filter((p) => !(p.status === 'pending' && list.some((n) => n.agencyId === p.agencyId && n.desc === p.desc))), ...list],
  }))
}

function nextSku(products: Product[], category: string): string {
  const prefix = (category.replace(/[^A-Za-z]/g, '').slice(0, 3) || 'GEN').toUpperCase()
  const n = products.filter((p) => p.sku.startsWith(prefix)).length + 1
  return `${prefix}-${String(9000 + n)}`
}

/** Approve a suggestion: create (or link) the product and save a rule that applies from now on. */
export function approveProposal(id: string, draft: Proposal['draft'], pattern: string[], scope: 'agency' | 'all') {
  update((s) => {
    const p = s.proposals.find((x) => x.id === id)
    if (!p) return s
    let products = s.products
    let productId = p.productId
    if (productId) {
      products = products.map((x) => (x.id === productId ? { ...x, ...draft, price: draft.price ?? x.price } : x))
    } else {
      productId = uid('p')
      products = [...products, { ...draft, id: productId, sku: nextSku(products, draft.category), price: draft.price ?? 0 }]
    }
    const rule: Rule = {
      id: uid('r'), pattern, productId, agencyId: scope === 'agency' ? p.agencyId : null, source: 'approved', createdAt: new Date().toISOString(),
    }
    return {
      ...s,
      products,
      rules: [...s.rules, rule],
      proposals: s.proposals.map((x) => (x.id === id ? { ...x, status: 'approved' as const, productId } : x)),
    }
  })
}

export function rejectProposal(id: string) {
  update((s) => ({ ...s, proposals: s.proposals.map((x) => (x.id === id ? { ...x, status: 'rejected' as const } : x)) }))
}

export function deleteRule(id: string) {
  update((s) => ({ ...s, rules: s.rules.filter((r) => r.id !== id) }))
}

/* ---------- Declaration ---------- */

export function setCaCheck(orderId: string, authority: string, ok: boolean) {
  patchOrder(orderId, (o) => ({ ...o, caChecks: { ...o.caChecks, [authority]: ok } }))
}

export function setCaRef(orderId: string, authority: string, ref: string) {
  patchOrder(orderId, (o) => ({ ...o, caRefs: { ...o.caRefs, [authority]: ref } }))
}

/** Freeze the split so later rule changes never alter what was filed. */
export function confirmDeclaration(orderId: string, decl: SgDeclaration) {
  patchOrder(orderId, (o) => ({ ...o, decl: { ...decl, caRefs: o.caRefs, confirmedAt: new Date().toISOString() } }))
}

export function reopenDeclaration(orderId: string) {
  patchOrder(orderId, (o) => ({ ...o, decl: undefined }))
}

export function recordPermit(orderId: string, permitNo: string) {
  patchOrder(orderId, (o) => (o.decl ? { ...o, decl: { ...o.decl, tradenetPermitNo: permitNo.trim() || undefined } } : o))
}

/* ---------- Delivery ---------- */

export function recordDelivery(orderId: string, delivery: Delivery) {
  patchOrder(orderId, (o) => ({ ...o, delivery }))
}

export function clearDelivery(orderId: string) {
  patchOrder(orderId, (o) => ({ ...o, delivery: undefined }))
}

/* ---------- Catalog ---------- */

export function saveProduct(p: Product) {
  update((s) => ({
    ...s,
    products: s.products.some((x) => x.id === p.id) ? s.products.map((x) => (x.id === p.id ? p : x)) : [...s.products, p],
  }))
}

/** Removing a product also removes the rules that point to it. */
export function deleteProduct(id: string) {
  update((s) => ({ ...s, products: s.products.filter((p) => p.id !== id), rules: s.rules.filter((r) => r.productId !== id) }))
}

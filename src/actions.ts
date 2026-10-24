/* State changes. Every write goes through `update`, which persists and notifies. */

import type { ReadResult } from './engine'
import { uid } from './format'
import { update } from './store'
import type { Order, VesselInfo } from './types'

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

/* Derived views over the stored state. Recomputed on render; nothing here is persisted. */

import { resolveLines } from './engine'
import { t } from './i18n'
import { sgPreflight, splitSgDeclaration, type Issue } from './sg'
import type { Order, OrderStatus, ResolvedLine, SgDeclaration, State } from './types'

export interface OrderView {
  order: Order
  lines: ResolvedLine[]
  decl: SgDeclaration
  issues: Issue[]
  blocking: Issue[]
  status: OrderStatus
}

export function viewOrder(s: State, order: Order): OrderView {
  // A confirmed declaration is frozen: later rule changes never alter what was filed
  const lines = order.decl?.confirmedAt ? order.decl.lines : resolveLines(order.lines, order.agencyId, s.rules, s.products, s.proposals)
  const decl = order.decl?.confirmedAt ? order.decl : splitSgDeclaration(lines, order.vessel, order.caChecks)
  const issues = order.decl?.confirmedAt ? [] : sgPreflight(decl, order.vessel)
  const blocking = issues.filter((i) => i.level === 'block')
  const status: OrderStatus = order.delivery
    ? 'delivered'
    : order.decl?.confirmedAt
      ? 'filed'
      : blocking.length
        ? 'review'
        : 'ready'
  return { order, lines, decl, issues, blocking, status }
}

const STATUS_TONE: Record<OrderStatus, 'ok' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral'> = {
  new: 'info',
  review: 'warn',
  ready: 'accent',
  filed: 'info',
  delivered: 'ok',
}

export function statusInfo(s: OrderStatus): { label: string; tone: (typeof STATUS_TONE)[OrderStatus] } {
  return { label: t.status[s], tone: STATUS_TONE[s] }
}

/** Short labels for the blockers that matter most in a list. */
export function headline(v: OrderView): { label: string; tone: 'bad' | 'warn' }[] {
  const out: { label: string; tone: 'bad' | 'warn' }[] = []
  const codes = new Set(v.blocking.map((i) => i.code))
  if (codes.has('unclassified') || codes.has('pending')) out.push({ label: t.headline.classify, tone: 'warn' })
  if ([...codes].some((c) => c.startsWith('ration_') && c !== 'ration_kind')) out.push({ label: t.headline.ration, tone: 'bad' })
  if (codes.has('ca')) out.push({ label: t.headline.approval, tone: 'warn' })
  if (codes.has('vessel_not_approved')) out.push({ label: t.headline.vesselNotApproved, tone: 'bad' })
  if (codes.has('flag') || codes.has('vessel_type') || codes.has('crew_days') || codes.has('vessel_name')) out.push({ label: t.headline.vesselMissing, tone: 'warn' })
  return out
}

export type StepKey = 'classify' | 'check' | 'confirm' | 'permit' | 'deliver'
export const STEPS: StepKey[] = ['classify', 'check', 'confirm', 'permit', 'deliver']

/** Where the order stands in the filing flow, and the one thing to do next ('done' when nothing is left). */
export function progress(v: OrderView): { done: Record<StepKey, boolean>; current: StepKey | 'done' } {
  const filed = !!v.order.decl?.confirmedAt
  const done: Record<StepKey, boolean> = {
    classify: filed || v.lines.every((l) => l.sgClass && l.state !== 'proposed'),
    check: filed || !v.blocking.length,
    confirm: filed,
    permit: filed && (!!v.order.decl?.tradenetPermitNo || !v.decl.permits.length),
    deliver: !!v.order.delivery,
  }
  return { done, current: STEPS.find((s) => !done[s]) ?? 'done' }
}

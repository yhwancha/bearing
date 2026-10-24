/* Browser-persisted app state. One JSON blob under `bearing.v1`. */

import { useSyncExternalStore } from 'react'
import type { State } from './types'

const KEY = 'bearing.v1'

let seeder: () => State = () => ({
  version: 1,
  workspace: { name: 'My workspace', uen: '' },
  agencies: [],
  products: [],
  rules: [],
  proposals: [],
  orders: [],
  touched: false,
})

let state: State | null = null
const listeners = new Set<() => void>()

function load(): State {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as State
      if (parsed.version === 1 && parsed.touched) return backfill(parsed, seeder())
    }
  } catch {
    // storage blocked or corrupt — start from the seed
  }
  // An untouched demo is rebuilt on each load so its dates stay relative to today
  return seeder()
}

/** Fill fields added after a workspace was saved (origin, agency UEN) from the seed, matched by id. */
function backfill(s: State, seed: State): State {
  const fill = <T extends { id: string }>(xs: T[], from: T[], keys: (keyof T)[]) =>
    xs.map((x) => {
      const src = from.find((y) => y.id === x.id)
      if (!src) return x
      const patch = Object.fromEntries(keys.filter((k) => x[k] === undefined && src[k] !== undefined).map((k) => [k, src[k]]))
      return { ...x, ...patch }
    })
  return { ...s, products: fill(s.products, seed.products, ['origin']), agencies: fill(s.agencies, seed.agencies, ['uen']) }
}

function persist(s: State) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    // ignore quota / private mode
  }
}

export function setSeeder(fn: () => State) {
  seeder = fn
  state = null
}

export function getState(): State {
  if (!state) state = load()
  return state
}

/** Apply a change. Marks the workspace as touched so the demo is kept. */
export function update(fn: (s: State) => State) {
  state = { ...fn(getState()), touched: true }
  persist(state)
  listeners.forEach((l) => l())
}

export function resetDemo() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
  state = seeder()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useStore<T>(select: (s: State) => T): T {
  return useSyncExternalStore(subscribe, () => select(getState()))
}

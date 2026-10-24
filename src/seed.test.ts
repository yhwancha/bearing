import { describe, expect, it } from 'vitest'
import { resolveLines } from './engine'
import { PRODUCTS, RULES, seedState } from './seed'
import { sgPreflight, splitSgDeclaration } from './sg'

describe('demo seed', () => {
  const s = seedState()
  const trap = s.orders.find((o) => o.id === 'o_lyra')!

  it('reads every line of every demo email', () => {
    expect(trap.lines).toHaveLength(6)
    expect(trap.vessel).toMatchObject({ name: 'MV OCEAN LYRA', crew: 20, voyageDays: 5, type: 'cargo', flag: 'Liberia' })
    expect(Object.fromEntries(s.orders.map((o) => [o.id, o.lines.length]))).toEqual({ o_lyra: 6, o_kestrel: 5, o_coral: 6, o_harbour: 4 })
  })

  it('leaves only the pump impeller without a rule in the trap order', () => {
    const lines = resolveLines(trap.lines, trap.agencyId, RULES, PRODUCTS, [])
    expect(lines.filter((l) => l.state === 'unknown').map((l) => l.desc)).toEqual(['PUMP IMPELLER FOR INSTALLATION'])
  })

  it('springs the tobacco trap', () => {
    const lines = resolveLines(trap.lines, trap.agencyId, RULES, PRODUCTS, [])
    const codes = sgPreflight(splitSgDeclaration(lines, trap.vessel), trap.vessel).map((i) => i.code)
    expect(codes).toEqual(expect.arrayContaining(['unclassified', 'ration_cigarettes', 'ca']))
  })

  it('classifies every line of the completed orders', () => {
    for (const o of s.orders.filter((x) => x.decl)) {
      expect(o.decl!.lines.every((l) => l.state === 'rule'), o.ref).toBe(true)
    }
  })
})

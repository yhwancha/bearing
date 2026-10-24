import { describe, expect, it } from 'vitest'
import { heuristicPropose, patternFor } from './heuristics'
import { PRODUCTS } from './seed'

describe('heuristicPropose', () => {
  it('treats a part for installation as not sea stores', () => {
    const r = heuristicPropose('PUMP IMPELLER FOR INSTALLATION', 'PC', PRODUCTS)
    expect(r.draft.sgClass).toBe('ship_spare_install')
    expect(r.rationale).toMatch(/installation/)
  })
  it('keeps a loose spare as stores', () => {
    expect(heuristicPropose('PUMP IMPELLER SPARE', 'PC', PRODUCTS).draft.sgClass).toBe('sea_store_paid')
  })
  it('sets ration kind and sticks for tobacco', () => {
    expect(heuristicPropose('MARLBORO CIGARETTES 200S', 'CTN', []).draft).toMatchObject({ sgClass: 'dutiable_tobacco', rationKind: 'cigarettes', rationUnitQty: 200 })
  })
  it('links to an existing catalog product', () => {
    expect(heuristicPropose('THAI JASMINE RICE 25KG', 'BAG', PRODUCTS).productId).toBe('p_rice')
  })
  it('builds a short pattern without sizes', () => {
    expect(patternFor('PUMP IMPELLER FOR INSTALLATION x 1')).toEqual(['PUMP', 'IMPELLER', 'INSTALLATION'])
  })
})

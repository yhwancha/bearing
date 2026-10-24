import { describe, expect, it } from 'vitest'
import { findRule, heuristicRead, matchPattern, parseItemLine, parseTableRow, resolveLines, tokenize } from './engine'
import type { Product, Rule } from './types'

const rule = (id: string, pattern: string[], productId: string, agencyId: string | null = null): Rule => ({
  id, pattern, productId, agencyId, source: 'seed', createdAt: '2026-10-01',
})

describe('matchPattern', () => {
  it('matches tokens in order with wildcards', () => {
    expect(matchPattern(['RICE', 'JASMINE'], tokenize('RICE THAI JASMINE 25KG'))).toBe(true)
    expect(matchPattern(['JASMINE', 'RICE'], tokenize('RICE THAI JASMINE 25KG'))).toBe(false)
    expect(matchPattern(['WHISK*', '70CL'], tokenize('WHISKY 70CL'))).toBe(true)
  })
})

describe('findRule', () => {
  it('prefers agency-specific, more literal rules', () => {
    const rules = [rule('a', ['RICE'], 'p1'), rule('b', ['RICE', 'JASMINE'], 'p2'), rule('c', ['RICE'], 'p3', 'ag1')]
    expect(findRule(rules, 'ag1', 'RICE JASMINE 25KG')?.id).toBe('c')
    expect(findRule(rules, 'ag2', 'RICE JASMINE 25KG')?.id).toBe('b')
  })
})

describe('parseItemLine', () => {
  it('reads the common agency formats', () => {
    expect(parseItemLine('RICE JASMINE 25KG BAG x 10')).toMatchObject({ desc: 'RICE JASMINE 25KG BAG', qty: 10, orderUnit: 'BAG' })
    expect(parseItemLine('2. WHISKY 70CL x 24 BTL')).toMatchObject({ desc: 'WHISKY 70CL', qty: 24, orderUnit: 'BTL' })
    expect(parseItemLine('- CIGARETTES 200S CTN x 60')).toMatchObject({ qty: 60, orderUnit: 'CTN' })
    expect(parseItemLine('Fresh eggs 30pcs tray 12 TRAYS')).toMatchObject({ qty: 12, orderUnit: 'TRAY' })
  })
  it('reads quantity-first lines and shorthand without units', () => {
    expect(parseItemLine('36 BTL  Whisky 70cl')).toMatchObject({ desc: 'WHISKY 70CL', qty: 36, orderUnit: 'BTL' })
    expect(parseItemLine('water 30')).toMatchObject({ desc: 'WATER', qty: 30, orderUnit: 'UNIT' })
    expect(parseItemLine('beer 10 cs')).toMatchObject({ desc: 'BEER', qty: 10, orderUnit: 'CASE' })
    expect(parseItemLine('POB : 21')).toBeNull()
  })
  it('reads requisition table rows with IMPA codes', () => {
    expect(parseTableRow('000105 | RICE JASMINE 25KG | BAG | 12')).toMatchObject({ code: '000105', desc: 'RICE JASMINE 25KG', qty: 12, orderUnit: 'BAG' })
    expect(parseTableRow('IMPA | DESCRIPTION | UNIT | QTY')).toBeNull()
  })
  it('ignores prose', () => {
    expect(parseItemLine('Please supply the following by 0800 hrs')).toBeNull()
    expect(parseItemLine('Best regards')).toBeNull()
  })
})

describe('heuristicRead', () => {
  it('pulls vessel particulars and items from an email', () => {
    const r = heuristicRead(
      `From: ops@straitsmarine.sg
Subject: Provisions for MV OCEAN LYRA
Vessel: MV OCEAN LYRA
IMO: 9734512
Flag: Liberia
Type: Bulk carrier
Crew: 20
Next port: Port Hedland (5 days)
Location: Western Anchorage

1. RICE JASMINE 25KG BAG x 10
2. WHISKY 70CL x 24 BTL`,
      [{ id: 'ag1', name: 'Straits Marine', domain: 'straitsmarine.sg' }],
    )
    expect(r.agencyId).toBe('ag1')
    expect(r.vessel).toMatchObject({ name: 'MV OCEAN LYRA', imo: '9734512', flag: 'Liberia', type: 'cargo', crew: 20, voyageDays: 5, location: 'Western Anchorage' })
    expect(r.lines).toHaveLength(2)
  })
})

describe('heuristicRead, particulars in a sentence', () => {
  it('finds name, flag, IMO, crew and days without labels', () => {
    const r = heuristicRead('hi team, mv sea heron (panama, imo 9614402) at western anch, eta 1400 today.\n20 crew, sailing to manila 4 days.\nwater 30', [])
    expect(r.vessel).toMatchObject({ name: 'MV SEA HERON', flag: 'Panama', imo: '9614402', crew: 20, voyageDays: 4, location: 'Western Anchorage' })
    expect(r.lines).toHaveLength(1)
  })
})

describe('resolveLines', () => {
  it('applies the matching rule and its product', () => {
    const products: Product[] = [{ id: 'p1', sku: 'R1', name: 'Rice', spec: '25 kg', unit: 'BAG', hs: '1006.30', category: 'Provisions', price: 42, sgClass: 'sea_store_paid' }]
    const [line] = resolveLines([{ idx: 1, raw: '', desc: 'RICE JASMINE 25KG', qty: 1, orderUnit: 'BAG' }], 'ag1', [rule('r', ['RICE'], 'p1')], products, [])
    expect(line).toMatchObject({ state: 'rule', productId: 'p1', sgClass: 'sea_store_paid', unitPrice: 42 })
  })
})

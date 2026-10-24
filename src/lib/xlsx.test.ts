import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { buildXlsx } from './xlsx'

describe('buildXlsx', () => {
  it('writes a readable workbook', () => {
    const files = unzipSync(buildXlsx([{ name: 'APS SO-1', rows: [['Vessel', 'MV A & B'], [], ['Qty', 12]] }]))
    expect(Object.keys(files)).toContain('xl/worksheets/sheet1.xml')
    const xml = strFromU8(files['xl/worksheets/sheet1.xml'])
    expect(xml).toContain('MV A &amp; B')
    expect(xml).toContain('<c r="B3"><v>12</v></c>')
  })
})

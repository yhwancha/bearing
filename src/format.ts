import { LOCALE } from './i18n'
import type { Currency } from './types'

const money = new Map<Currency, Intl.NumberFormat>()

export function fmtMoney(amount: number, currency: Currency = 'SGD'): string {
  let f = money.get(currency)
  if (!f) {
    f = new Intl.NumberFormat(LOCALE, { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2 })
    money.set(currency, f)
  }
  // "SGD 1,234.50" reads better than the narrow no-break space Intl puts between code and number
  return f.format(amount).replace(/ /g, ' ')
}

const numFmt = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 2 })

export function fmtNum(n: number): string {
  return numFmt.format(n)
}

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
const monthFmt = new Intl.DateTimeFormat(LOCALE, { month: 'long', year: 'numeric' })

export function fmtDate(iso: string | undefined): string {
  return iso ? dateFmt.format(new Date(iso)) : '—'
}

export function fmtDateTime(iso: string | undefined): string {
  return iso ? dateTimeFmt.format(new Date(iso)) : '—'
}

/** "2026-10" → "October 2026" */
export function fmtMonth(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return monthFmt.format(new Date(y, m - 1, 1))
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

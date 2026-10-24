import { LOCALE } from './i18n'
import type { Currency } from './types'

/* Intl formatters are built once per locale; the locale changes with the UI language. */
const cache = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>()

function nf(key: string, opts: Intl.NumberFormatOptions): Intl.NumberFormat {
  const k = `${LOCALE}|${key}`
  let f = cache.get(k) as Intl.NumberFormat | undefined
  if (!f) cache.set(k, (f = new Intl.NumberFormat(LOCALE, opts)))
  return f
}

function df(key: string, opts: Intl.DateTimeFormatOptions, locale = LOCALE): Intl.DateTimeFormat {
  const k = `${locale}|${key}`
  let f = cache.get(k) as Intl.DateTimeFormat | undefined
  if (!f) cache.set(k, (f = new Intl.DateTimeFormat(locale, opts)))
  return f
}

export function fmtMoney(amount: number, currency: Currency = 'SGD'): string {
  const f = nf(currency, { style: 'currency', currency, currencyDisplay: 'code', minimumFractionDigits: 2 })
  // "SGD 1,234.50" reads better than the narrow no-break space Intl puts between code and number
  return f.format(amount).replace(/[\u00a0\u202f]/g, ' ')
}

export function fmtNum(n: number): string {
  return nf('num', { maximumFractionDigits: 2 }).format(n)
}

const dateOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }
const dateTimeOpts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }
const monthOpts: Intl.DateTimeFormatOptions = { month: 'long', year: 'numeric' }

/** `locale` overrides the UI language, e.g. 'en-SG' for documents filed with customs. */
export function fmtDate(iso: string | undefined, locale?: string): string {
  return iso ? df('date', dateOpts, locale).format(new Date(iso)) : '—'
}

export function fmtDateTime(iso: string | undefined): string {
  return iso ? df('dt', dateTimeOpts).format(new Date(iso)) : '—'
}

/** "2026-10" → "October 2026" */
export function fmtMonth(ym: string, locale?: string): string {
  const [y, m] = ym.split('-').map(Number)
  return df('month', monthOpts, locale).format(new Date(y, m - 1, 1))
}

export function monthOf(iso: string): string {
  return iso.slice(0, 7)
}

export function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`
}

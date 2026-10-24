import { useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { t } from '../i18n'
import { FlagSG, IconAlert, IconChevron, IconInfo, IconX } from './icons'

export type Tone = 'ok' | 'warn' | 'bad' | 'info' | 'violet' | 'accent' | 'neutral' | 'outline'

export function Badge({ tone = 'neutral', dot, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return (
    <span className={`badge ${tone === 'neutral' ? '' : tone}`}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

export function Flag({ code }: { code: 'SG' }) {
  return (
    <span className="flag" title={t.common.singapore}>
      {code === 'SG' && <FlagSG />}
      {code}
    </span>
  )
}

export function Card({ title, meta, actions, children, pad = true }: {
  title?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  children: ReactNode
  pad?: boolean
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card-head">
          {typeof title === 'string' ? <h2>{title}</h2> : title}
          {meta && <span className="meta">{meta}</span>}
          {actions && <div className="row" style={{ marginLeft: meta ? 0 : 'auto' }}>{actions}</div>}
        </header>
      )}
      {pad ? <div className="card-body">{children}</div> : children}
    </section>
  )
}

export function PageHead({ title, sub, crumbs, actions }: {
  title: ReactNode
  sub?: ReactNode
  crumbs?: { to: string; label: string }[]
  actions?: ReactNode
}) {
  return (
    <div className="page-head">
      <div>
        {crumbs && (
          <nav className="crumbs" aria-label={t.common.breadcrumb}>
            {crumbs.map((c) => (
              <span key={c.to} className="row" style={{ gap: 6 }}>
                <Link to={c.to}>{c.label}</Link>
                <IconChevron size={12} />
              </span>
            ))}
          </nav>
        )}
        <h1>{title}</h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
      {actions && <div className="row wrap">{actions}</div>}
    </div>
  )
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'bad' | 'ok'; children: ReactNode }) {
  return (
    <div className={`notice ${tone}`} role={tone === 'bad' ? 'alert' : undefined}>
      {tone === 'info' || tone === 'ok' ? <IconInfo size={15} /> : <IconAlert size={15} />}
      <div>{children}</div>
    </div>
  )
}

export function Stat({ label, value, foot }: { label: string; value: ReactNode; foot?: ReactNode }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  )
}

export function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : value > 0 ? 100 : 0
  return (
    <div className={`meter ${value > max ? 'over' : ''}`} role="meter" aria-valuenow={value} aria-valuemax={max}>
      <i style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  )
}

export function Modal({ title, onClose, children, footer }: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost sm" style={{ marginLeft: 'auto' }} onClick={onClose} aria-label={t.common.close}>
            <IconX />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

let pushToast: ((msg: string) => void) | null = null

/** Show a short confirmation at the bottom of the screen. */
export function toast(msg: string) {
  pushToast?.(msg)
}

export function Toaster() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    pushToast = (m) => {
      setMsg(m)
      clearTimeout(timer)
      timer = setTimeout(() => setMsg(null), 2600)
    }
    return () => {
      pushToast = null
      clearTimeout(timer)
    }
  }, [])
  return msg ? <div className="toast" role="status">{msg}</div> : null
}

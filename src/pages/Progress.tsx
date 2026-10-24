import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { confirmDeclaration, recordPermit } from '../actions'
import { progress, STEPS, type OrderView } from '../derive'
import { t } from '../i18n'
import { toast } from '../ui'
import { IconArrowRight, IconCheck } from '../ui/icons'
import { IssueList } from './Order'

type Page = 'order' | 'declaration' | 'delivery'

/** The filing flow at a glance: where the order is, and the one thing to do next. */
export default function Progress({ v, page }: { v: OrderView; page: Page }) {
  const { done, current } = progress(v)
  const id = v.order.id
  const [permit, setPermit] = useState(v.order.decl?.tradenetPermitNo ?? '')
  const unclassified = v.lines.filter((l) => !l.sgClass || l.state === 'proposed').length

  let title = ''
  let body = ''
  let extra: ReactNode = null
  let action: ReactNode = null
  switch (current) {
    case 'classify':
      title = t.progress.classify.title(unclassified)
      body = t.progress.classify.body
      if (page !== 'order') action = <Link to={`/orders/${id}`} className="btn primary">{t.progress.classify.action}<IconArrowRight /></Link>
      break
    case 'check':
      title = t.progress.check.title(v.blocking.length)
      body = t.progress.check.body
      extra = <IssueList issues={v.issues} />
      if (page !== 'declaration') action = <Link to={`/orders/${id}/declaration`} className="btn primary">{t.progress.check.action}<IconArrowRight /></Link>
      break
    case 'confirm':
      title = t.progress.confirm.title
      body = t.progress.confirm.body
      if (v.issues.length) extra = <IssueList issues={v.issues} />
      action =
        page === 'declaration' ? (
          <button
            className="btn primary"
            onClick={() => {
              confirmDeclaration(id, v.decl)
              toast(t.decl.confirmed)
            }}
          >
            <IconCheck />
            {t.progress.confirm.action}
          </button>
        ) : (
          <Link to={`/orders/${id}/declaration`} className="btn primary">{t.progress.confirm.open}<IconArrowRight /></Link>
        )
      break
    case 'permit':
      title = t.progress.permit.title
      body = t.progress.permit.body
      extra = (
        <div className="row wrap">
          <input
            className="input mono"
            style={{ flex: '1 1 220px', maxWidth: 320 }}
            value={permit}
            placeholder={t.decl.permitPlaceholder}
            aria-label={t.decl.permitNo}
            onChange={(e) => setPermit(e.target.value.toUpperCase())}
          />
          <button
            className="btn primary"
            disabled={!permit.trim()}
            onClick={() => {
              recordPermit(id, permit.trim())
              toast(t.decl.permitSaved)
            }}
          >
            {t.progress.permit.save}
          </button>
          {page !== 'delivery' && <Link to={`/orders/${id}/delivery`} className="btn ghost">{t.progress.permit.skip}</Link>}
        </div>
      )
      break
    case 'deliver':
      title = t.progress.deliver.title
      body = t.progress.deliver.body
      if (page !== 'delivery') action = <Link to={`/orders/${id}/delivery`} className="btn primary">{t.progress.deliver.action}<IconArrowRight /></Link>
      break
    case 'done':
      title = t.progress.done.title
      body = t.progress.done.body
      action = <Link to="/statements" className="btn">{t.progress.done.action}<IconArrowRight /></Link>
      break
  }

  return (
    <section className={`progress ${current === 'done' ? 'is-done' : ''}`}>
      <ol className="steps" aria-label={t.progress.label}>
        {STEPS.map((s, i) => (
          <li key={s} className={done[s] ? 'done' : s === current ? 'current' : ''} aria-current={s === current ? 'step' : undefined}>
            <span className="step-dot">{done[s] ? <IconCheck size={12} /> : i + 1}</span>
            <span className="step-label">{t.progress.steps[s]}</span>
          </li>
        ))}
      </ol>
      <div className="next">
        <div className="next-text">
          {current !== 'done' && <span className="next-kicker">{t.progress.next}</span>}
          <h2>{title}</h2>
          <p>{body}</p>
          {extra && <div className="next-extra">{extra}</div>}
        </div>
        {action && <div className="next-action">{action}</div>}
      </div>
    </section>
  )
}

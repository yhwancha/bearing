import { useMemo, useState } from 'react'
import { deleteRule } from '../actions'
import { fmtDate } from '../format'
import { t } from '../i18n'
import { useStore } from '../store'
import { Badge, Card, Empty, PageHead } from '../ui'
import { IconSearch, IconTrash } from '../ui/icons'
import { ClassBadge } from '../ui/sg'

export default function Rules() {
  const rules = useStore((s) => s.rules)
  const products = useStore((s) => s.products)
  const agencies = useStore((s) => s.agencies)
  const [q, setQ] = useState('')
  const rows = useMemo(() => {
    const needle = q.trim().toUpperCase()
    return [...rules]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((r) => ({ r, p: products.find((p) => p.id === r.productId) }))
      .filter(({ r, p }) => !needle || r.pattern.join(' ').includes(needle) || p?.name.toUpperCase().includes(needle))
  }, [rules, products, q])
  const approved = rules.filter((r) => r.source === 'approved').length

  return (
    <>
      <PageHead
        title={t.rules.title}
        sub={t.rules.sub(rules.length, approved)}
      />
      <Card
        pad={false}
        title={
          <div className="search">
            <IconSearch />
            <input className="input" placeholder={t.rules.search} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        }
      >
        {rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.rules.when}</th>
                  <th>{t.rules.declareAs}</th>
                  <th>{t.common.route}</th>
                  <th>{t.rules.scope}</th>
                  <th>{t.rules.source}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, p }) => (
                  <tr key={r.id}>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {r.pattern.map((t, i) => (
                          <code key={i} className="token">{t}</code>
                        ))}
                      </div>
                    </td>
                    <td>
                      {p ? (
                        <>
                          <div className="strong">{p.name}</div>
                          <div className="small muted">{p.spec} · <span className="mono">{p.sku}</span></div>
                        </>
                      ) : (
                        <span className="muted">{t.rules.removed}</span>
                      )}
                    </td>
                    <td><ClassBadge value={p?.sgClass} /></td>
                    <td className="small">{r.agencyId ? agencies.find((a) => a.id === r.agencyId)?.name : t.rules.allAgencies}</td>
                    <td>
                      {r.source === 'approved' ? <Badge tone="accent">{t.rules.approvedOn(fmtDate(r.createdAt))}</Badge> : <Badge>{t.rules.starter}</Badge>}
                    </td>
                    <td className="r">
                      <button className="btn ghost sm" aria-label={t.rules.deleteLabel} onClick={() => confirm(t.rules.deleteConfirm) && deleteRule(r.id)}>
                        <IconTrash size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title={t.rules.noMatch} />
        )}
      </Card>
    </>
  )
}

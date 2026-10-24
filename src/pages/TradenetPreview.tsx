import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { OrderView } from '../derive'
import { fmtMoney, fmtNum } from '../format'
import { downloadXlsx } from '../lib/xlsx'
import { t } from '../i18n'
import { useStore } from '../store'
import { permitDocs, permitSheets, printDocs, type DocField, type FixAt, type ItemKey } from '../tradenet'
import { Badge, Card, Empty, toast } from '../ui'
import { IconCheck, IconDownload, IconFile } from '../ui/icons'

function Missing({ fix, orderId }: { fix?: FixAt; orderId: string }) {
  const to = fix === 'vessel' ? `/orders/${orderId}` : fix === 'catalog' ? '/catalog' : undefined
  return (
    <span className="missing">
      {t.common.missing}
      {fix && (
        <>
          {' · '}
          {to ? <Link to={to}>{t.tradenet.fix[fix]}</Link> : t.tradenet.fix[fix]}
        </>
      )}
    </span>
  )
}

function Value({ x, orderId }: { x: DocField; orderId: string }) {
  if (x.value) return <>{x.value}</>
  if (x.required) return <Missing fix={x.fix} orderId={orderId} />
  return <span className="muted">— <span className="small">({t.tradenet.optional})</span></span>
}

/** The permit application as it will be keyed into TradeNet, with every gap pointed at where it is fixed. */
export default function TradenetPreview({ v }: { v: OrderView }) {
  const ws = useStore((s) => s.workspace)
  const agency = useStore((s) => s.agencies.find((a) => a.id === v.order.agencyId))
  const confirmed = !!v.order.decl?.confirmedAt
  const caRefs = (confirmed ? v.decl.caRefs : v.order.caRefs) ?? {}
  const docs = permitDocs(v.order, ws, agency, v.decl.lines, v.decl.permits, caRefs)
  const [tab, setTab] = useState(0)
  const d = docs[Math.min(tab, docs.length - 1)]
  const id = v.order.id
  const permitNo = v.order.decl?.tradenetPermitNo
  const cellMissing = (miss: ItemKey[], k: ItemKey, fix: FixAt) => miss.includes(k) && <Missing fix={fix} orderId={id} />

  return (
    <Card
      pad={false}
      title={
        <div className="row wrap">
          <h2>{t.tradenet.title}</h2>
          {confirmed ? <Badge tone="ok">{t.tradenet.confirmed}</Badge> : <Badge tone="warn">{t.tradenet.draft}</Badge>}
          {d && (d.missing ? <Badge tone="bad">{t.tradenet.missing(d.missing)}</Badge> : <Badge tone="ok"><IconCheck size={12} />{t.tradenet.complete}</Badge>)}
        </div>
      }
      actions={
        docs.length > 0 && (
          <div className="row" style={{ gap: 6 }}>
            <button className="btn sm" onClick={() => downloadXlsx(`${v.order.ref}-tradenet${confirmed ? '' : '-draft'}.xlsx`, permitSheets(v.order, docs))}>
              <IconDownload size={14} />
              {t.common.exportXlsx}
            </button>
            <button className="btn sm" onClick={() => printDocs(v.order, docs, permitNo) || toast(t.tradenet.printBlocked)}>
              <IconFile size={14} />
              {t.tradenet.print}
            </button>
          </div>
        )
      }
    >
      {!d ? (
        <Empty title={t.tradenet.noPermit}>{t.tradenet.noPermitBody}</Empty>
      ) : (
        <div className="tradenet">
          {docs.length > 1 && (
            <div className="tradenet-tabs">
              <div className="seg" role="tablist">
                {docs.map((x, i) => (
                  <button key={x.group.declarationType} role="tab" aria-selected={x === d} className={x === d ? 'on' : ''} onClick={() => setTab(i)}>
                    OUT · {x.group.declarationType}
                    {x.missing > 0 && <span className="tab-dot" aria-hidden />}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="tradenet-sections">
            {d.sections.map((s) => (
              <section key={s.key}>
                <h3>{t.tradenet.sections[s.key]}</h3>
                <dl className="kv tradenet-head">
                  {s.fields.map((x) => (
                    <div key={x.key} style={{ display: 'contents' }}>
                      <dt>{t.tradenet.fields[x.key]}</dt>
                      <dd className={x.key === 'cpc' || x.key.endsWith('Uen') ? 'mono' : ''}>
                        <Value x={x} orderId={id} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.common.seq}</th>
                  <th>{t.tradenet.items.hs}</th>
                  <th>{t.tradenet.items.description}</th>
                  <th>{t.tradenet.items.origin}</th>
                  <th className="r">{t.tradenet.items.outerQty}</th>
                  <th className="r">{t.tradenet.items.inQty}</th>
                  <th className="r">{t.tradenet.items.value}</th>
                  {d.group.declarationType === 'DRT' && <th>{t.tradenet.items.caLicence}</th>}
                </tr>
              </thead>
              <tbody>
                {d.items.map((x) => (
                  <tr key={x.seq}>
                    <td className="num muted">{x.seq}</td>
                    <td className="mono">{x.hs || cellMissing(x.missing, 'hs', 'catalog')}</td>
                    <td>{x.description}</td>
                    <td className="mono">{x.origin || cellMissing(x.missing, 'origin', 'catalog')}</td>
                    <td className="r num">
                      {fmtNum(x.outerQty)} <span className="muted small">{x.outerUnit}</span>
                    </td>
                    <td className="r num">
                      {x.inQty !== undefined ? (
                        <>
                          {fmtNum(x.inQty)} <span className="muted small">{x.inUnit}</span>
                        </>
                      ) : (
                        cellMissing(x.missing, 'inQty', 'catalog') || <span className="muted">—</span>
                      )}
                    </td>
                    <td className="r num">{fmtMoney(x.value, v.order.currency)}</td>
                    {d.group.declarationType === 'DRT' && <td className="mono">{x.caLicence || cellMissing(x.missing, 'caLicence', 'approvals')}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted tradenet-foot">{t.tradenet.foot}</p>
        </div>
      )}
    </Card>
  )
}

import { useState } from 'react'
import type { OrderView } from '../derive'
import { fmtMoney } from '../format'
import { downloadXlsx } from '../lib/xlsx'
import { t } from '../i18n'
import { lineAmount } from '../sg'
import { useStore } from '../store'
import { itemNote, permitPreviews, permitSheets } from '../tradenet'
import { Badge, Card, Empty } from '../ui'
import { IconDownload } from '../ui/icons'

export default function TradenetPreview({ v }: { v: OrderView }) {
  const ws = useStore((s) => s.workspace)
  const previews = permitPreviews(v.order, ws, v.decl.lines, v.decl.permits)
  const [tab, setTab] = useState(0)
  const confirmed = !!v.order.decl?.confirmedAt
  const p = previews[Math.min(tab, previews.length - 1)]

  return (
    <Card
      pad={false}
      title={
        <div className="row wrap">
          <h2>{t.tradenet.title}</h2>
          {confirmed ? <Badge tone="ok">{t.tradenet.confirmed}</Badge> : <Badge tone="warn">{t.tradenet.draft}</Badge>}
          {previews.length > 1 && (
            <div className="seg" role="tablist">
              {previews.map((x, i) => (
                <button key={x.group.declarationType} role="tab" aria-selected={i === tab} className={i === tab ? 'on' : ''} onClick={() => setTab(i)}>
                  OUT · {x.group.declarationType}
                </button>
              ))}
            </div>
          )}
        </div>
      }
      actions={
        <button
          className="btn sm"
          disabled={!previews.length}
          onClick={() => downloadXlsx(`${v.order.ref}-tradenet${confirmed ? '' : '-draft'}.xlsx`, permitSheets(v.order, previews))}
        >
          <IconDownload size={14} />
          {t.common.exportXlsx}
        </button>
      }
    >
      {!p ? (
        <Empty title={t.tradenet.noPermit}>{t.tradenet.noPermitBody}</Empty>
      ) : (
        <div className="tradenet">
          <dl className="kv tradenet-head">
            {p.header.map(([k, val]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt>{t.tradenet.fields[k]}</dt>
                <dd className={val ? '' : 'missing'}>{val || t.common.missing}</dd>
              </div>
            ))}
          </dl>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>{t.common.seq}</th>
                  <th>{t.common.hsCode}</th>
                  <th>{t.common.description}</th>
                  <th className="r">{t.common.qty}</th>
                  <th className="r">{t.common.value}</th>
                  <th>{t.common.note}</th>
                </tr>
              </thead>
              <tbody>
                {p.items.map((l, i) => (
                  <tr key={l.idx}>
                    <td className="num muted">{i + 1}</td>
                    <td className="mono">{l.hs || <span className="missing">{t.common.missing}</span>}</td>
                    <td>
                      {l.name} <span className="muted">· {l.spec}</span>
                    </td>
                    <td className="r num">
                      {l.qty} <span className="muted small">{l.unit}</span>
                    </td>
                    <td className="r num">{fmtMoney(lineAmount(l), v.order.currency)}</td>
                    <td className="small muted">{itemNote(l, t.ration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted tradenet-foot">
            {t.tradenet.foot}
          </p>
        </div>
      )}
    </Card>
  )
}

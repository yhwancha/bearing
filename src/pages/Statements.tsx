import { useMemo, useState } from 'react'
import { fmtDate, fmtMoney, fmtMonth, monthOf } from '../format'
import { downloadXlsx } from '../lib/xlsx'
import { monthlyStatement, type StatementRow } from '../sg'
import { useStore } from '../store'
import { Card, Empty, PageHead, Stat } from '../ui'
import { IconDownload, IconShip } from '../ui/icons'

function sheetRows(rows: StatementRow[], ws: { name: string; uen: string }, month: string) {
  return [
    ['Monthly Statement of Stores Supplied to Vessels'],
    ['Supplier', ws.uen ? `${ws.name} (UEN ${ws.uen})` : ws.name],
    ['Period', fmtMonth(month)],
    [],
    ['Vessel', 'IMO', 'Flag', 'Orders', 'Delivered', 'Item', 'Pack', 'Quantity', 'Unit', 'Value (SGD)'],
    ...rows.flatMap((r) =>
      r.items.map((i) => [r.vessel, r.imo ?? '', r.flag ?? '', r.orders.join(', '), r.deliveredOn.map(fmtDate).join(', '), i.name, i.spec, i.qty, i.unit, i.value]),
    ),
    [],
    ['Total', '', '', '', '', '', '', '', '', rows.reduce((s, r) => s + r.total, 0)],
  ]
}

export default function Statements() {
  const orders = useStore((s) => s.orders)
  const ws = useStore((s) => s.workspace)
  const current = monthOf(new Date().toISOString())
  const months = useMemo(() => {
    const set = new Set([current, ...orders.filter((o) => o.delivery).map((o) => monthOf(o.delivery!.at))])
    return [...set].sort().reverse()
  }, [orders, current])
  const [month, setMonth] = useState(current)
  const rows = useMemo(() => monthlyStatement(orders, month), [orders, month])
  const total = rows.reduce((s, r) => s + r.total, 0)
  const lines = rows.reduce((s, r) => s + r.items.length, 0)

  return (
    <>
      <PageHead
        title="Monthly statement"
        sub="Duty-paid, uncontrolled stores supplied without a permit. Singapore Customs requires them on the Monthly Statement of Stores Supplied to Vessels."
        actions={
          <>
            <select className="select" style={{ width: 'auto' }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              {months.map((m) => (
                <option key={m} value={m}>{fmtMonth(m)}</option>
              ))}
            </select>
            <button className="btn primary" disabled={!rows.length} onClick={() => downloadXlsx(`monthly-statement-${month}.xlsx`, [{ name: fmtMonth(month), rows: sheetRows(rows, ws, month) }])}>
              <IconDownload />
              Export .xlsx
            </button>
          </>
        }
      />
      <div className="stack">
        <div className="grid cols-3">
          <Stat label="Vessels supplied" value={rows.length} />
          <Stat label="Statement lines" value={lines} />
          <Stat label="Value" value={fmtMoney(total)} />
        </div>
        {rows.length ? (
          rows.map((r) => (
            <Card
              key={r.imo ?? r.vessel}
              pad={false}
              title={
                <div className="row">
                  <IconShip />
                  <h2>{r.vessel}</h2>
                  <span className="small muted mono">IMO {r.imo ?? '—'}</span>
                  <span className="small muted">· {r.flag ?? 'Flag missing'}</span>
                </div>
              }
              meta={`${r.orders.join(', ')} · delivered ${r.deliveredOn.map(fmtDate).join(', ')}`}
            >
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Pack</th>
                      <th className="r">Quantity</th>
                      <th className="r">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((i) => (
                      <tr key={i.name + i.spec}>
                        <td className="strong">{i.name}</td>
                        <td className="muted">{i.spec}</td>
                        <td className="r num">{i.qty} <span className="small muted">{i.unit}</span></td>
                        <td className="r num">{fmtMoney(i.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="strong">Vessel total</td>
                      <td className="r num strong">{fmtMoney(r.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          ))
        ) : (
          <Card>
            <Empty title={`Nothing to report for ${fmtMonth(month)}`}>Delivered statement-only lines appear here.</Empty>
          </Card>
        )}
      </div>
    </>
  )
}

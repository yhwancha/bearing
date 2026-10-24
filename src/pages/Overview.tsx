import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtMoney, fmtMonth, monthOf } from '../format'
import { t } from '../i18n'
import { monthlyStatement } from '../sg'
import { resetDemo, useStore } from '../store'
import { Card, PageHead, Stat, toast } from '../ui'
import { IconArrowRight, IconPlus, IconReset } from '../ui/icons'
import Intake from './Intake'
import { OrderTable, useOrderViews } from './Orders'

export default function Overview() {
  const views = useOrderViews()
  const orders = useStore((s) => s.orders)
  const workspace = useStore((s) => s.workspace)
  const [intake, setIntake] = useState(false)
  const month = monthOf(new Date().toISOString())
  const statementValue = monthlyStatement(orders, month).reduce((s, r) => s + r.total, 0)
  const open = views.filter((v) => v.status === 'review' || v.status === 'ready')
  const count = (s: string) => views.filter((v) => v.status === s).length
  return (
    <>
      <PageHead
        title={t.overview.title}
        sub={workspace.name}
        actions={
          <>
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm(t.overview.resetConfirm)) {
                  resetDemo()
                  toast(t.overview.resetDone)
                }
              }}
            >
              <IconReset />
              {t.overview.reset}
            </button>
            <button className="btn primary" onClick={() => setIntake(true)}>
              <IconPlus />
              {t.overview.newOrder}
            </button>
          </>
        }
      />
      <div className="stack">
        <div className="grid cols-4">
          <Stat label={t.overview.attention} value={count('review')} foot={t.overview.attentionFoot} />
          <Stat label={t.overview.ready} value={count('ready')} foot={t.overview.readyFoot} />
          <Stat label={t.overview.filed} value={count('filed')} foot={t.overview.filedFoot} />
          <Stat label={t.overview.statement(fmtMonth(month))} value={fmtMoney(statementValue)} foot={t.overview.statementFoot} />
        </div>
        <Card
          title={t.overview.open}
          pad={false}
          actions={
            <Link to="/orders" className="btn ghost sm">
              {t.overview.all}
              <IconArrowRight />
            </Link>
          }
        >
          <OrderTable views={open} compact />
        </Card>
      </div>
      {intake && <Intake onClose={() => setIntake(false)} />}
    </>
  )
}

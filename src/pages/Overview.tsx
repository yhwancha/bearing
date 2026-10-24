import { useState } from 'react'
import { Link } from 'react-router-dom'
import { fmtMoney, fmtMonth, monthOf } from '../format'
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
        title="Overview"
        sub={workspace.name}
        actions={
          <>
            <button
              className="btn ghost"
              onClick={() => {
                if (confirm('Reset the demo workspace? Your changes will be lost.')) {
                  resetDemo()
                  toast('Demo reset')
                }
              }}
            >
              <IconReset />
              Reset demo
            </button>
            <button className="btn primary" onClick={() => setIntake(true)}>
              <IconPlus />
              New order
            </button>
          </>
        }
      />
      <div className="stack">
        <div className="grid cols-4">
          <Stat label="Needs attention" value={count('review')} foot="Blocked before filing" />
          <Stat label="Ready to file" value={count('ready')} foot="All checks passed" />
          <Stat label="Filed, not delivered" value={count('filed')} foot="Awaiting delivery" />
          <Stat label={`Statement · ${fmtMonth(month)}`} value={fmtMoney(statementValue)} foot="Duty-paid stores delivered" />
        </div>
        <Card
          title="Open orders"
          pad={false}
          actions={
            <Link to="/orders" className="btn ghost sm">
              All orders
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

import { useMemo } from 'react'
import { Route, Routes } from 'react-router-dom'
import { viewOrder } from './derive'
import Catalog from './pages/Catalog'
import Declaration from './pages/Declaration'
import Delivery from './pages/Delivery'
import Order from './pages/Order'
import Orders from './pages/Orders'
import Overview from './pages/Overview'
import Rules from './pages/Rules'
import Statements from './pages/Statements'
import Shell from './Shell'
import { useStore } from './store'
import { Empty } from './ui'

export default function App() {
  const state = useStore((s) => s)
  const attention = useMemo(() => state.orders.filter((o) => viewOrder(state, o).status === 'review').length, [state])
  return (
    <Shell workspace={state.workspace.name} counts={{ orders: attention }}>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:id" element={<Order />} />
        <Route path="/orders/:id/declaration" element={<Declaration />} />
        <Route path="/orders/:id/delivery" element={<Delivery />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/catalog" element={<Catalog />} />
        <Route path="/rules" element={<Rules />} />
        <Route path="*" element={<Empty title="Page not found" />} />
      </Routes>
    </Shell>
  )
}

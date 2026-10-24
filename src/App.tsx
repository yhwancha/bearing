import { Route, Routes } from 'react-router-dom'
import Shell from './Shell'
import { PageHead } from './ui'

function Placeholder({ title }: { title: string }) {
  return <PageHead title={title} sub="Coming up next." />
}

export default function App() {
  return (
    <Shell workspace="Demo workspace">
      <Routes>
        <Route path="/" element={<Placeholder title="Overview" />} />
        <Route path="/orders" element={<Placeholder title="Orders" />} />
        <Route path="/statements" element={<Placeholder title="Statements" />} />
        <Route path="/catalog" element={<Placeholder title="Catalog" />} />
        <Route path="/rules" element={<Placeholder title="Rules" />} />
      </Routes>
    </Shell>
  )
}

import { useMemo, useState } from 'react'
import { deleteProduct, saveProduct } from '../actions'
import { fmtMoney, uid } from '../format'
import { isDutiable, RATION_LIMITS, SG_CLASS_INFO, SG_CLASSES } from '../sg'
import { useStore } from '../store'
import type { Product, RationKind, SgClass } from '../types'
import { Card, Empty, Modal, PageHead, toast } from '../ui'
import { IconPlus, IconSearch, IconTrash } from '../ui/icons'
import { ClassBadge } from '../ui/sg'

const KINDS = Object.keys(RATION_LIMITS) as RationKind[]

function blank(): Product {
  return { id: uid('p'), sku: '', name: '', spec: '', unit: 'PC', hs: '', category: 'Provisions', price: 0, sgClass: 'sea_store_paid' }
}

function ProductForm({ initial, onClose }: { initial: Product; onClose: () => void }) {
  const ruleCount = useStore((s) => s.rules.filter((r) => r.productId === initial.id).length)
  const isNew = !useStore((s) => s.products.some((p) => p.id === initial.id))
  const [p, setP] = useState(initial)
  const set = (patch: Partial<Product>) => setP((x) => ({ ...x, ...patch }))
  function setClass(c: SgClass) {
    set({
      sgClass: c,
      rationKind: isDutiable(c) ? p.rationKind ?? (c === 'dutiable_tobacco' ? 'cigarettes' : 'spirits') : undefined,
      rationUnitQty: isDutiable(c) ? p.rationUnitQty ?? 1 : undefined,
      controlAuthority: c === 'controlled' ? p.controlAuthority ?? '' : undefined,
    })
  }
  const valid = p.sku.trim() && p.name.trim() && p.unit.trim() && (p.sgClass !== 'controlled' || p.controlAuthority?.trim()) && (!isDutiable(p.sgClass) || (p.rationKind && p.rationUnitQty))

  return (
    <Modal
      title={isNew ? 'New product' : p.name || 'Edit product'}
      onClose={onClose}
      footer={
        <>
          {!isNew && (
            <button
              className="btn ghost danger"
              onClick={() => {
                if (confirm(ruleCount ? `Delete this product and its ${ruleCount} rule${ruleCount > 1 ? 's' : ''}?` : 'Delete this product?')) {
                  deleteProduct(p.id)
                  onClose()
                }
              }}
            >
              <IconTrash />
              Delete
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button
            className="btn primary"
            disabled={!valid}
            onClick={() => {
              saveProduct({ ...p, sku: p.sku.trim().toUpperCase(), name: p.name.trim() })
              toast(ruleCount ? `Saved — ${ruleCount} rule${ruleCount > 1 ? 's' : ''} now use the update` : 'Saved')
              onClose()
            }}
          >
            Save
          </button>
        </>
      }
    >
      <div className="grid cols-3" style={{ gap: 14 }}>
        <label className="field">
          <span>SKU</span>
          <input className="input mono" value={p.sku} onChange={(e) => set({ sku: e.target.value })} />
        </label>
        <label className="field" style={{ gridColumn: 'span 2' }}>
          <span>Declared name</span>
          <input className="input" value={p.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="field">
          <span>Pack</span>
          <input className="input" value={p.spec} onChange={(e) => set({ spec: e.target.value })} />
        </label>
        <label className="field">
          <span>Unit</span>
          <input className="input" value={p.unit} onChange={(e) => set({ unit: e.target.value.toUpperCase() })} />
        </label>
        <label className="field">
          <span>HS code</span>
          <input className="input mono" value={p.hs} onChange={(e) => set({ hs: e.target.value })} />
        </label>
        <label className="field">
          <span>Category</span>
          <input className="input" value={p.category} onChange={(e) => set({ category: e.target.value })} />
        </label>
        <label className="field">
          <span>Unit price (SGD)</span>
          <input className="input num" type="number" min={0} step="0.01" value={p.price} onChange={(e) => set({ price: Number(e.target.value) })} />
        </label>
        <div />
        <label className="field" style={{ gridColumn: 'span 3' }}>
          <span>Singapore route</span>
          <select className="select" value={p.sgClass ?? ''} onChange={(e) => setClass(e.target.value as SgClass)}>
            {SG_CLASSES.map((c) => (
              <option key={c} value={c}>{SG_CLASS_INFO[c].label} — {SG_CLASS_INFO[c].route}</option>
            ))}
          </select>
        </label>
        {p.sgClass === 'controlled' && (
          <label className="field" style={{ gridColumn: 'span 3' }}>
            <span>Competent Authority</span>
            <input className="input" value={p.controlAuthority ?? ''} placeholder="e.g. SPF Arms & Explosives" onChange={(e) => set({ controlAuthority: e.target.value })} />
          </label>
        )}
        {isDutiable(p.sgClass) && (
          <>
            <label className="field" style={{ gridColumn: 'span 2' }}>
              <span>Ration</span>
              <select className="select" value={p.rationKind ?? ''} onChange={(e) => set({ rationKind: e.target.value as RationKind })}>
                {KINDS.map((k) => (
                  <option key={k} value={k}>{RATION_LIMITS[k].label} — {RATION_LIMITS[k].perDay} {RATION_LIMITS[k].unit} per crew per day</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{p.rationKind ? RATION_LIMITS[p.rationKind].unit : 'Units'} per {p.unit || 'unit'}</span>
              <input className="input num" type="number" min={0} value={p.rationUnitQty ?? ''} onChange={(e) => set({ rationUnitQty: Number(e.target.value) || undefined })} />
            </label>
          </>
        )}
      </div>
    </Modal>
  )
}

export default function Catalog() {
  const products = useStore((s) => s.products)
  const rules = useStore((s) => s.rules)
  const [q, setQ] = useState('')
  const [cls, setCls] = useState<SgClass | ''>('')
  const [editing, setEditing] = useState<Product | null>(null)
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return products
      .filter((p) => (!cls || p.sgClass === cls) && (!needle || `${p.sku} ${p.name} ${p.hs} ${p.category}`.toLowerCase().includes(needle)))
      .sort((a, b) => a.sku.localeCompare(b.sku))
  }, [products, q, cls])

  return (
    <>
      <PageHead
        title="Catalog"
        sub="Your products and how Singapore Customs treats each one. Rules point here, so a fix applies to every future order."
        actions={
          <button className="btn primary" onClick={() => setEditing(blank())}>
            <IconPlus />
            New product
          </button>
        }
      />
      <Card
        pad={false}
        title={
          <div className="row wrap">
            <div className="search">
              <IconSearch />
              <input className="input" placeholder="Search SKU, name, HS" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="select" style={{ width: 'auto' }} value={cls} onChange={(e) => setCls(e.target.value as SgClass | '')} aria-label="Route">
              <option value="">All routes</option>
              {SG_CLASSES.map((c) => (
                <option key={c} value={c}>{SG_CLASS_INFO[c].label}</option>
              ))}
            </select>
          </div>
        }
        meta={`${shown.length} of ${products.length}`}
      >
        {shown.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th>HS</th>
                  <th>Route</th>
                  <th>Ration / authority</th>
                  <th className="r">Price</th>
                  <th className="r">Rules</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className="link" onClick={() => setEditing(p)}>
                    <td className="mono small">{p.sku}</td>
                    <td>
                      <div className="strong">{p.name}</div>
                      <div className="small muted">{p.spec} · {p.unit} · {p.category}</div>
                    </td>
                    <td className="mono small">{p.hs || '—'}</td>
                    <td><ClassBadge value={p.sgClass} /></td>
                    <td className="small muted">
                      {p.rationKind
                        ? `${RATION_LIMITS[p.rationKind].label} · ${p.rationUnitQty} ${RATION_LIMITS[p.rationKind].unit}/${p.unit}`
                        : p.controlAuthority ?? '—'}
                    </td>
                    <td className="r num">{fmtMoney(p.price)}</td>
                    <td className="r num">{rules.filter((r) => r.productId === p.id).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No products match" />
        )}
      </Card>
      {editing && <ProductForm initial={editing} onClose={() => setEditing(null)} />}
    </>
  )
}

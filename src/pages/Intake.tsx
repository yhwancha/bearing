import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addOrder } from '../actions'
import { readEmail } from '../lib/read'
import { TRAP_EMAIL } from '../seed'
import { useStore } from '../store'
import { Modal, Notice, toast } from '../ui'
import { IconSparkle } from '../ui/icons'

/** Paste an agency email → read vessel and lines → create the order. */
export default function Intake({ onClose }: { onClose: () => void }) {
  const agencies = useStore((s) => s.agencies)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [agencyId, setAgencyId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const out = await readEmail(text, agencies)
      if (!out.result.lines.length) {
        setError('No order lines found. Each line needs a description and a quantity, e.g. "RICE JASMINE 25KG BAG x 10".')
        return
      }
      const id = addOrder(out.result, text, agencyId || out.result.agencyId || agencies[0]?.id || '', out.source)
      toast(out.source === 'ai' ? `Read ${out.result.lines.length} lines` : `Read ${out.result.lines.length} lines offline (${out.fallbackReason})`)
      onClose()
      navigate(`/orders/${id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="New order"
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" onClick={() => setText(TRAP_EMAIL)}>Use sample email</button>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={!text.trim() || busy} onClick={submit}>
            <IconSparkle />
            {busy ? 'Reading…' : 'Read order'}
          </button>
        </>
      }
    >
      <div className="stack">
        <p className="muted">
          Paste the agency's email as it arrived. Bearing reads the vessel particulars and every line, then applies your rules.
        </p>
        <label className="field">
          <span>Email</span>
          <textarea
            className="textarea mono"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'From: ops@agency.example\nVessel: MV …\nIMO: …\nFlag: …\nCrew: …\n\n1. RICE JASMINE 25KG BAG x 10'}
            autoFocus
          />
        </label>
        <label className="field">
          <span>
            Agency <span className="hint">· detected from the sender when left blank</span>
          </span>
          <select className="select" value={agencyId} onChange={(e) => setAgencyId(e.target.value)}>
            <option value="">Detect automatically</option>
            {agencies.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Modal>
  )
}

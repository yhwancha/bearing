import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addOrder } from '../actions'
import { t } from '../i18n'
import { readEmail } from '../lib/read'
import { SAMPLES } from '../seed'
import { useStore } from '../store'
import { Badge, Modal, Notice, toast } from '../ui'
import { IconCheck, IconSparkle } from '../ui/icons'

/** Paste an agency email (or pick a sample) → read vessel and lines → create the order. */
export default function Intake({ onClose }: { onClose: () => void }) {
  const agencies = useStore((s) => s.agencies)
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const out = await readEmail(text, agencies)
      if (!out.result.lines.length) {
        setError(t.intake.noLines)
        return
      }
      const id = addOrder(out.result, text, out.result.agencyId || agencies[0]?.id || '', out.source)
      toast(out.source === 'ai' ? t.intake.readAi(out.result.lines.length) : t.intake.readOffline(out.result.lines.length, out.fallbackReason ?? ''))
      onClose()
      navigate(`/orders/${id}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t.intake.title}
      onClose={onClose}
      footer={
        <>
          <span className="spacer" />
          <button className="btn" onClick={onClose}>{t.common.cancel}</button>
          <button className="btn primary" disabled={!text.trim() || busy} onClick={submit}>
            <IconSparkle />
            {busy ? t.intake.reading : t.intake.read}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="stack" style={{ gap: 8 }}>
          <div>
            <div className="strong">{t.intake.samplesTitle}</div>
            <p className="small muted">{t.intake.samplesHint}</p>
          </div>
          <div className="samples" role="radiogroup" aria-label={t.intake.samplesTitle}>
            {SAMPLES.map((s) => {
              const copy = t.intake.samples[s.id]
              const on = text === s.email
              const vessel = s.email.match(/^Vessel:\s*(.+)$/m)?.[1]
              return (
                <button key={s.id} type="button" role="radio" aria-checked={on} className={`sample ${on ? 'on' : ''}`} onClick={() => setText(s.email)}>
                  <span className="sample-head">
                    <span className="strong">{copy.title}</span>
                    {on && <IconCheck size={14} />}
                  </span>
                  <span className="mono small muted">{vessel}</span>
                  <span className="small">{copy.desc}</span>
                  <span className="row wrap" style={{ gap: 4 }}>
                    {copy.tags.map((tag) => (
                      <Badge key={tag} tone="outline">{tag}</Badge>
                    ))}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <label className="field">
          <span>
            {t.intake.email} <span className="hint">· {t.intake.custom}</span>
          </span>
          <textarea
            className="textarea mono"
            rows={11}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'From: ops@agency.example\nVessel: MV …\nIMO: …\nFlag: …\nCrew: …\n\n1. RICE JASMINE 25KG BAG x 10'}
          />
        </label>
        <p className="small muted">{t.intake.intro}</p>
        {error && <Notice tone="bad">{error}</Notice>}
      </div>
    </Modal>
  )
}

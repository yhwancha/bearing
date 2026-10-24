/* Reading a pasted email into an order: the model first, the offline reader as fallback. */

import { heuristicRead, type ReadResult } from '../engine'
import type { Agency, VesselType } from '../types'
import { t } from '../i18n'
import { postJson } from './api'

export interface ReadOutcome {
  result: ReadResult
  source: 'ai' | 'heuristic'
  /** Why the model was not used, shown to the user. */
  fallbackReason?: string
}

interface ApiRead {
  subject: string
  agencyId: string
  vessel: { name: string; imo: string; flag: string; type: string; crew: number; voyageDays: number; location: string; eta: string }
  lines: { raw: string; desc: string; qty: number; orderUnit: string; code: string }[]
}

const orUndef = <T,>(v: T | '' | 0): T | undefined => (v === '' || v === 0 ? undefined : v)

export async function readEmail(text: string, agencies: Agency[]): Promise<ReadOutcome> {
  try {
    const r = await postJson<ApiRead>('/api/read', { text, agencies })
    const lines = r.lines.filter((l) => l.qty > 0 && l.desc.trim())
    if (!lines.length) throw new Error(t.api.noLines)
    return {
      source: 'ai',
      result: {
        subject: r.subject,
        agencyId: agencies.some((a) => a.id === r.agencyId) ? r.agencyId : undefined,
        vessel: {
          name: r.vessel.name.toUpperCase(),
          imo: orUndef(r.vessel.imo),
          flag: orUndef(r.vessel.flag),
          type: orUndef(r.vessel.type) as VesselType | undefined,
          crew: orUndef(r.vessel.crew),
          voyageDays: orUndef(r.vessel.voyageDays),
          location: orUndef(r.vessel.location),
          eta: orUndef(r.vessel.eta),
        },
        lines: lines.map((l, i) => ({ idx: i + 1, raw: l.raw, desc: l.desc.toUpperCase(), qty: l.qty, orderUnit: l.orderUnit.toUpperCase() || 'UNIT', code: l.code || undefined })),
      },
    }
  } catch (e) {
    return { result: heuristicRead(text, agencies), source: 'heuristic', fallbackReason: e instanceof Error ? e.message : t.api.down }
  }
}

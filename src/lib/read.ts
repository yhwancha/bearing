/* Reading a pasted email into an order. */

import { heuristicRead, type ReadResult } from '../engine'
import type { Agency } from '../types'

export interface ReadOutcome {
  result: ReadResult
  source: 'ai' | 'heuristic'
  /** Why the model was not used, shown to the user. */
  fallbackReason?: string
}

export async function readEmail(text: string, agencies: Agency[]): Promise<ReadOutcome> {
  return { result: heuristicRead(text, agencies), source: 'heuristic', fallbackReason: 'Offline reader' }
}
